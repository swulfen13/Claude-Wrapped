'use strict';
// Friends leaderboard client. Talks to *your own* Supabase project through the
// RPC functions in supabase/schema.sql. Only daily totals are ever uploaded.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { costOf, prettyModel } = require('./pricing');

const CONFIG_DIR = process.env.CCWRAPPED_HOME || path.join(os.homedir(), '.ccwrapped');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

// ---------- invite links ----------
// An invite bundles the project URL, the public (publishable/anon) key and the invite code,
// so friends only need one string. None of these are secrets.

function makeInvite(url, key, code) {
  return 'ccw1.' + Buffer.from(JSON.stringify({ u: url, k: key, c: code })).toString('base64url');
}

function readInvite(invite) {
  const s = String(invite || '').trim();
  if (!s.startsWith('ccw1.')) throw new Error('That doesn\'t look like a ccyear invite. It should start with "ccw1."');
  try {
    const o = JSON.parse(Buffer.from(s.slice(5), 'base64url').toString('utf8'));
    if (!o.u || !o.k || !o.c) throw new Error();
    return { url: o.u, key: o.k, code: o.c };
  } catch {
    throw new Error('This invite is damaged. Ask your friend to send it again.');
  }
}

// ---------- HTTP ----------

function normalizeUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(u)) throw new Error('The Supabase URL should look like https://<project>.supabase.co');
  return u;
}

async function rpc(conn, fn, args, fetchImpl = globalThis.fetch) {
  const headers = { 'Content-Type': 'application/json', apikey: conn.key };
  // Legacy anon keys are JWTs and also go in Authorization. New sb_publishable_ keys must not.
  if (String(conn.key).startsWith('eyJ')) headers.Authorization = `Bearer ${conn.key}`;
  let res;
  try {
    res = await fetchImpl(`${normalizeUrl(conn.url)}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
  } catch (e) {
    throw new Error(`Couldn't reach Supabase at ${conn.url}: ${e.message}`);
  }
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg = (body && (body.message || body.hint)) || text || res.statusText;
    if (res.status === 404 && /function|schema cache/i.test(msg)) {
      throw new Error('The leaderboard tables aren\'t set up in this Supabase project yet. Run supabase/schema.sql first.');
    }
    throw new Error(msg);
  }
  return body;
}

// ---------- daily rows ----------

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Aggregates events into the per-day totals that get uploaded. Nothing else leaves the machine. */
function dailyRows(events, maxDays = 400) {
  const days = new Map();
  const cutoff = Date.now() - maxDays * 86400000;
  for (const e of events) {
    if (e.ts < cutoff) continue;
    const k = dayKey(e.ts);
    if (!days.has(k)) days.set(k, { day: k, tokens: 0, output_tokens: 0, prompts: 0, cost: 0, models: {} });
    const d = days.get(k);
    if (e.kind === 'prompt') {
      d.prompts++;
      continue;
    }
    const tok = e.input + e.output + e.cacheWrite + e.cacheRead;
    d.tokens += tok;
    d.output_tokens += e.output;
    d.cost += costOf(e.model, e);
    const m = prettyModel(e.model);
    d.models[m] = (d.models[m] || 0) + tok;
  }
  return [...days.values()]
    .map((d) => ({ ...d, cost: Math.round(d.cost * 10000) / 10000 }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

// ---------- commands ----------

async function createBoard({ url, key, name, me }, fetchImpl) {
  if (!url || !key) throw new Error('Pass your Supabase project URL and publishable (anon) key: --url https://xyz.supabase.co --key sb_publishable_...');
  if (!name) throw new Error('Give the board a name: --name "Night Shift"');
  if (!me) throw new Error('Pick the name your friends will see: --me Paul');
  const conn = { url: normalizeUrl(url), key };
  const r = await rpc(conn, 'ccw_create_board', { board_name: name, owner_name: me }, fetchImpl);
  const board = { ...conn, code: r.invite_code, boardName: r.board_name, memberId: r.member_id, secret: r.secret, me, owner: true };
  return { board, invite: makeInvite(conn.url, key, r.invite_code) };
}

async function joinBoard(invite, me, fetchImpl) {
  if (!me) throw new Error('Pick the name your friends will see: --me <name>');
  const conn = readInvite(invite);
  const r = await rpc(conn, 'ccw_join_board', { code: conn.code, member_name: me }, fetchImpl);
  return { board: { ...conn, boardName: r.board_name, memberId: r.member_id, secret: r.secret, me, owner: false } };
}

async function syncBoard(board, events, fetchImpl) {
  const rows = dailyRows(events);
  if (!rows.length) return 0;
  return rpc(board, 'ccw_upsert_usage', { p_member_id: board.memberId, p_secret: board.secret, rows }, fetchImpl);
}

function sinceFor(period) {
  const d = new Date();
  if (period === 'today') return dayKey(d);
  if (period === 'week') return dayKey(d.getTime() - 6 * 86400000);
  if (period === 'month') return dayKey(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
  if (period === 'year') return `${d.getFullYear()}-01-01`;
  return null;
}

async function leaderboard(board, period = 'week', fetchImpl) {
  const rows = await rpc(board, 'ccw_leaderboard', { code: board.code, since: sinceFor(period) }, fetchImpl);
  return (rows || []).map((r) => ({
    rank: Number(r.rank),
    name: r.display_name,
    tokens: Number(r.tokens),
    output: Number(r.output_tokens),
    prompts: Number(r.prompts),
    cost: Number(r.cost),
    activeDays: Number(r.active_days),
    topModel: r.top_model,
    lastActive: r.last_active,
    me: r.display_name === board.me,
  }));
}

async function leaveBoard(board, fetchImpl) {
  return rpc(board, 'ccw_leave_board', { p_member_id: board.memberId, p_secret: board.secret }, fetchImpl);
}

/** Re-ranks leaderboard rows by another field (ties share a rank). */
function rerank(rows, field = 'tokens') {
  const sorted = [...rows].sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name));
  let rank = 0;
  let prev = null;
  return sorted.map((r, i) => {
    if (r[field] !== prev) rank = i + 1;
    prev = r[field];
    return { ...r, rank };
  });
}

module.exports = {
  rerank,
  CONFIG_FILE,
  loadConfig,
  saveConfig,
  makeInvite,
  readInvite,
  rpc,
  dailyRows,
  createBoard,
  joinBoard,
  syncBoard,
  leaderboard,
  leaveBoard,
  sinceFor,
};
