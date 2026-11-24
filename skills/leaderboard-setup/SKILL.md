---
name: leaderboard-setup
description: Set up or join a ccyear friends leaderboard for Claude Code token usage. Creates the tables in the user's own Supabase project through the Supabase MCP server, creates a board and prints the invite. Use when the user wants to compete with friends on tokens burned, create a leaderboard, or join one with an invite.
---

# ccyear leaderboard setup

You are helping the user run a private leaderboard where they and their friends compare how many Claude Code tokens they use. It runs on **the user's own Supabase project**, so they own the data. Nothing is hosted by the ccyear authors.

Only daily totals are ever uploaded: tokens, output tokens, prompts, estimated cost and tokens per model. Never prompts, code, file names or project names. Tell the user this once, up front, in one sentence.

## 1. Find out what they want

Ask in one message (skip anything they already told you):

- **Join or create?** If a friend sent them an invite (a string starting with `ccw1.`), they only need to join.
- **Display name** their friends will see (1 to 32 characters).
- **Board name** (only when creating), for example "Night Shift".

## 2a. Joining with an invite

No Supabase access is needed. Run:

```bash
npx @swulfen/ccyear board join <invite> --me "<name>"
```

If it says the name is taken, ask for another name. Then go to step 4.

## 2b. Creating a board

### Connect Supabase

Check whether Supabase MCP tools are available (tool names containing `supabase`, such as `list_projects`, `apply_migration`, `get_project_url`, `get_publishable_keys`).

If they are not available, tell the user how to connect it and stop until they confirm:

```bash
claude mcp add --transport http supabase https://mcp.supabase.com/mcp
```

Then they run `/mcp` in Claude Code and sign in to Supabase. If they don't want to connect MCP, use the manual path at the bottom.

### Pick the project

1. List their projects. Ask which one to use, or whether to create a new one.
2. A new project may cost money outside the free tier. Show any cost the tools report and wait for a clear yes before creating it.
3. If they pick an existing project, say that you'll add three tables and a few functions, all prefixed `ccw_`, and touch nothing else, and wait for a yes.

### Apply the schema

Apply the SQL in [schema.sql](schema.sql), unchanged, as one migration named `ccwrapped_leaderboard`. It is idempotent, so running it again is safe. Do not edit it, and do not run any other SQL that changes or deletes data.

Then check it worked:

- Run `select count(*) from public.ccw_leaderboard('does-not-exist');` and expect `0`.
- If the Supabase tools offer security advisors, run them and mention anything that refers to `ccw_` objects. The tables intentionally have RLS enabled with no policies; all access goes through `SECURITY DEFINER` functions. That is expected.

### Create the board

Get the project URL and a publishable key (`sb_publishable_...`, or the legacy `anon` key if that's all there is). Never use or print a `service_role` or secret key.

```bash
npx @swulfen/ccyear board create --name "<board name>" --me "<name>" --url "<project url>" --key "<publishable key>"
```

## 3. Share the invite

The command prints a line like `npx @swulfen/ccyear board join ccw1.… --me <their name>`. Give it to the user exactly as printed and tell them to send it to their friends. They can print it again anytime with `npx @swulfen/ccyear board invite`.

The invite contains the project URL, the publishable key and the board code. These are not secrets in Supabase's model, but anyone with the invite can join the board, so it should only go to people they want on it.

## 4. Keep it updated

- `npx @swulfen/ccyear serve` opens the live dashboard on localhost and syncs every 10 minutes while it runs.
- `npx @swulfen/ccyear sync` uploads once.
- `npx @swulfen/ccyear leaderboard --period week` shows the ranking in the terminal.

Offer to set up a scheduled `npx @swulfen/ccyear sync` (cron on macOS/Linux, Task Scheduler on Windows) if they want rankings to update without the dashboard running.

## Manual path (no MCP)

1. In the Supabase dashboard, open **SQL Editor**, paste [schema.sql](schema.sql) and run it.
2. In **Project Settings → API keys**, copy the project URL and the publishable key.
3. Run the `board create` command from step 2b.

## Troubleshooting

| Message | Fix |
| --- | --- |
| `The leaderboard tables aren't set up…` | The schema hasn't been applied to that project. Apply it. |
| `Invite code not found` | The invite is from another project or the board was deleted. Ask for a fresh invite. |
| `Unknown member or wrong secret` | The local config in `~/.ccwrapped/config.json` doesn't match. Leave and join again. |
| `No API key found in request` | The key is missing or wrong. Use the publishable key. |

Firebase isn't supported. If the user asks for it, say so and offer Supabase.
