-- ccyear friends leaderboard
-- Run this once in your own Supabase project (SQL editor, `supabase db push`, or the Supabase MCP).
--
-- Design
--   * Tables are locked with RLS and have no policies, so the public API key can't read or write them.
--   * Everything goes through the SECURITY DEFINER functions below.
--   * Joining a board needs its invite code. Writing your own stats needs your member secret,
--     which only your machine knows (we store a SHA-256 hash of it).
--   * Only daily totals are uploaded: tokens, prompts, estimated cost and tokens per model.
--     Never prompts, code, file names or project names.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ccw_boards (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.ccw_members (
  id uuid primary key default extensions.gen_random_uuid(),
  board_id uuid not null references public.ccw_boards(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 32),
  secret_hash text not null,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  unique (board_id, display_name)
);

create table if not exists public.ccw_daily_usage (
  member_id uuid not null references public.ccw_members(id) on delete cascade,
  day date not null,
  tokens bigint not null default 0 check (tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  prompts integer not null default 0 check (prompts >= 0),
  cost numeric(12, 4) not null default 0 check (cost >= 0),
  models jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (member_id, day)
);

alter table public.ccw_boards enable row level security;
alter table public.ccw_members enable row level security;
alter table public.ccw_daily_usage enable row level security;
revoke all on public.ccw_boards, public.ccw_members, public.ccw_daily_usage from anon, authenticated;

-- helpers -------------------------------------------------------------------

create or replace function public.ccw_hash(secret text)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(secret, 'sha256'), 'hex')
$$;

create or replace function public.ccw_random(n integer)
returns text language sql volatile set search_path = '' as $$
  select translate(encode(extensions.gen_random_bytes(n), 'base64'), '+/=', 'xyz')
$$;

-- create a board (you become its owner) -------------------------------------

create or replace function public.ccw_create_board(board_name text, owner_name text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  b public.ccw_boards;
  secret text := public.ccw_random(24);
  m_id uuid;
begin
  insert into public.ccw_boards (name, invite_code)
  values (trim(board_name), lower(public.ccw_random(9)))
  returning * into b;
  insert into public.ccw_members (board_id, display_name, secret_hash, is_owner)
  values (b.id, trim(owner_name), public.ccw_hash(secret), true)
  returning id into m_id;
  return json_build_object('board_name', b.name, 'invite_code', b.invite_code, 'member_id', m_id, 'secret', secret);
end $$;

-- join a board with an invite code ------------------------------------------

create or replace function public.ccw_join_board(code text, member_name text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  b public.ccw_boards;
  secret text := public.ccw_random(24);
  m_id uuid;
begin
  select * into b from public.ccw_boards where invite_code = lower(trim(code));
  if b.id is null then
    raise exception 'Invite code not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.ccw_members where board_id = b.id) >= 200 then
    raise exception 'This board is full' using errcode = 'P0001';
  end if;
  begin
    insert into public.ccw_members (board_id, display_name, secret_hash)
    values (b.id, trim(member_name), public.ccw_hash(secret))
    returning id into m_id;
  exception when unique_violation then
    raise exception 'The name "%" is already taken on this board', trim(member_name) using errcode = '23505';
  end;
  return json_build_object('board_name', b.name, 'invite_code', b.invite_code, 'member_id', m_id, 'secret', secret);
end $$;

-- upload your daily totals ----------------------------------------------------
-- rows: [{"day":"2026-11-22","tokens":123,"output_tokens":45,"prompts":6,"cost":1.23,"models":{"Opus 4.5":100}}]

create or replace function public.ccw_upsert_usage(p_member_id uuid, p_secret text, rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if not exists (
    select 1 from public.ccw_members where id = p_member_id and secret_hash = public.ccw_hash(p_secret)
  ) then
    raise exception 'Unknown member or wrong secret' using errcode = '28000';
  end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 400 then
    raise exception 'rows must be an array with at most 400 days' using errcode = '22023';
  end if;

  insert into public.ccw_daily_usage as u (member_id, day, tokens, output_tokens, prompts, cost, models, updated_at)
  select p_member_id,
         (r->>'day')::date,
         greatest(coalesce((r->>'tokens')::bigint, 0), 0),
         greatest(coalesce((r->>'output_tokens')::bigint, 0), 0),
         greatest(coalesce((r->>'prompts')::integer, 0), 0),
         greatest(coalesce((r->>'cost')::numeric, 0), 0),
         case when jsonb_typeof(r->'models') = 'object' then r->'models' else '{}'::jsonb end,
         now()
  from jsonb_array_elements(rows) as r
  where (r->>'day')::date between date '2023-01-01' and (current_date + 1)
  on conflict (member_id, day) do update
    set tokens = excluded.tokens,
        output_tokens = excluded.output_tokens,
        prompts = excluded.prompts,
        cost = excluded.cost,
        models = excluded.models,
        updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- the leaderboard -------------------------------------------------------------

create or replace function public.ccw_leaderboard(code text, since date default null)
returns table (
  rank bigint,
  display_name text,
  tokens bigint,
  output_tokens bigint,
  prompts bigint,
  cost numeric,
  active_days bigint,
  top_model text,
  last_active date
) language sql stable security definer set search_path = '' as $$
  with b as (
    select id from public.ccw_boards where invite_code = lower(trim(code))
  ),
  usage as (
    select m.id, m.display_name, d.*
    from public.ccw_members m
    join b on b.id = m.board_id
    left join public.ccw_daily_usage d on d.member_id = m.id and (since is null or d.day >= since)
  ),
  models as (
    select id, key as model, sum(value::bigint) as t
    from usage, jsonb_each_text(coalesce(models, '{}'::jsonb))
    group by id, key
  ),
  top as (
    select distinct on (id) id, model from models order by id, t desc
  ),
  agg as (
    select u.id, u.display_name,
           coalesce(sum(u.tokens), 0)::bigint as tokens,
           coalesce(sum(u.output_tokens), 0)::bigint as output_tokens,
           coalesce(sum(u.prompts), 0)::bigint as prompts,
           coalesce(sum(u.cost), 0) as cost,
           count(u.day) filter (where u.tokens > 0) as active_days,
           max(u.day) as last_active
    from usage u group by u.id, u.display_name
  )
  select rank() over (order by a.tokens desc), a.display_name, a.tokens, a.output_tokens, a.prompts,
         round(a.cost, 2), a.active_days, t.model, a.last_active
  from agg a left join top t on t.id = a.id
  order by a.tokens desc, a.display_name
$$;

-- leave a board (deletes your rows) --------------------------------------------

create or replace function public.ccw_leave_board(p_member_id uuid, p_secret text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from public.ccw_members where id = p_member_id and secret_hash = public.ccw_hash(p_secret);
  return found;
end $$;

-- only the RPCs are callable from the API ---------------------------------------

revoke all on function public.ccw_hash(text), public.ccw_random(integer) from public, anon, authenticated;
revoke all on function public.ccw_create_board(text, text), public.ccw_join_board(text, text),
  public.ccw_upsert_usage(uuid, text, jsonb), public.ccw_leaderboard(text, date), public.ccw_leave_board(uuid, text)
  from public;
grant execute on function public.ccw_create_board(text, text), public.ccw_join_board(text, text),
  public.ccw_upsert_usage(uuid, text, jsonb), public.ccw_leaderboard(text, date), public.ccw_leave_board(uuid, text)
  to anon, authenticated;
