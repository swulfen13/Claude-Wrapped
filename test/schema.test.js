'use strict';
// Runs supabase/schema.sql against an in-process Postgres (PGlite) when it is installed:
//   npm i --no-save @electric-sql/pglite && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let PGlite, pgcrypto;
try {
  ({ PGlite } = require('@electric-sql/pglite'));
  ({ pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto'));
} catch {
  /* optional */
}

test('leaderboard schema: create, join, upload, rank, auth', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`create role anon; create role authenticated;`);
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8'));
  // run it twice: must be idempotent
  await db.exec(fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8'));

  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const owner = (await one(`select public.ccw_create_board('Night Shift', 'paul') as r`)).r;
  assert.ok(owner.invite_code && owner.secret && owner.member_id);

  const friend = (await one(`select public.ccw_join_board($1, 'lena') as r`, [owner.invite_code.toUpperCase()])).r;
  assert.strictEqual(friend.board_name, 'Night Shift');
  await assert.rejects(db.query(`select public.ccw_join_board($1, 'lena')`, [owner.invite_code]), /already taken/);
  await assert.rejects(db.query(`select public.ccw_join_board('nope', 'max')`), /not found/);

  const rows = (day, tokens, model) => JSON.stringify([{ day, tokens, output_tokens: tokens / 10, prompts: 3, cost: 1.5, models: { [model]: tokens } }]);
  await one(`select public.ccw_upsert_usage($1, $2, $3::jsonb)`, [owner.member_id, owner.secret, rows('2026-11-20', 1000, 'Opus 4.5')]);
  await one(`select public.ccw_upsert_usage($1, $2, $3::jsonb)`, [owner.member_id, owner.secret, rows('2026-11-20', 1500, 'Opus 4.5')]); // update, not duplicate
  await one(`select public.ccw_upsert_usage($1, $2, $3::jsonb)`, [friend.member_id, friend.secret, rows('2026-11-21', 9000, 'Sonnet 4.5')]);
  await assert.rejects(db.query(`select public.ccw_upsert_usage($1, 'wrong', $2::jsonb)`, [friend.member_id, rows('2026-11-21', 1, 'x')]), /wrong secret/);

  const board = (await db.query(`select * from public.ccw_leaderboard($1)`, [owner.invite_code])).rows;
  assert.deepStrictEqual(board.map((r) => [Number(r.rank), r.display_name, Number(r.tokens), r.top_model]), [
    [1, 'lena', 9000, 'Sonnet 4.5'],
    [2, 'paul', 1500, 'Opus 4.5'],
  ]);
  const since = (await db.query(`select * from public.ccw_leaderboard($1, '2026-11-21')`, [owner.invite_code])).rows;
  assert.strictEqual(Number(since.find((r) => r.display_name === 'paul').tokens), 0);

  // the public role can't touch the tables directly
  await db.exec(`set role anon`);
  await assert.rejects(db.query(`select * from public.ccw_daily_usage`), /permission denied/);
  const viaRpc = (await db.query(`select * from public.ccw_leaderboard($1)`, [owner.invite_code])).rows;
  assert.strictEqual(viaRpc.length, 2);
  await db.exec(`reset role`);

  assert.strictEqual((await one(`select public.ccw_leave_board($1, $2) as ok`, [friend.member_id, friend.secret])).ok, true);
  assert.strictEqual((await db.query(`select * from public.ccw_leaderboard($1)`, [owner.invite_code])).rows.length, 1);
});
