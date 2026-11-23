'use strict';
const test = require('node:test');
const assert = require('node:assert');
const board = require('../src/board');

let hasPglite = true;
try {
  require.resolve('@electric-sql/pglite');
} catch {
  hasPglite = false;
}

const ev = (daysAgo, kind, tokens, model = 'claude-opus-4-5-20251101') => {
  const ts = Date.now() - daysAgo * 86400000;
  return kind === 'prompt'
    ? { ts, kind, session: 's', project: 'secret-project' }
    : { ts, kind, session: 's', project: 'secret-project', model, input: 0, output: tokens / 2, cacheWrite: 0, cacheRead: tokens / 2, tools: [], files: [] };
};

test('invites round-trip and reject junk', () => {
  const inv = board.makeInvite('https://abc.supabase.co', 'sb_publishable_x', 'code123');
  assert.deepStrictEqual(board.readInvite(inv), { url: 'https://abc.supabase.co', key: 'sb_publishable_x', code: 'code123' });
  assert.throws(() => board.readInvite('hello'), /doesn't look like/);
  assert.throws(() => board.readInvite('ccw1.!!!'), /damaged/);
});

test('daily rows only contain totals, never project names', () => {
  const rows = board.dailyRows([ev(1, 'prompt'), ev(1, 'assistant', 1000), ev(0, 'assistant', 500, 'claude-sonnet-4-5')]);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].tokens, 1000);
  assert.strictEqual(rows[0].prompts, 1);
  assert.deepStrictEqual(Object.keys(rows[1].models), ['Sonnet 4.5']);
  assert.ok(!JSON.stringify(rows).includes('secret-project'));
});

test('rpc sends publishable keys only as apikey', async () => {
  const calls = [];
  const fake = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, text: async () => '[]' };
  };
  await board.rpc({ url: 'https://a.supabase.co/', key: 'sb_publishable_abc' }, 'ccw_leaderboard', {}, fake);
  await board.rpc({ url: 'https://a.supabase.co', key: 'eyJhbGciOi.x.y' }, 'ccw_leaderboard', {}, fake);
  assert.strictEqual(calls[0].url, 'https://a.supabase.co/rest/v1/rpc/ccw_leaderboard');
  assert.strictEqual(calls[0].init.headers.Authorization, undefined);
  assert.strictEqual(calls[1].init.headers.Authorization, 'Bearer eyJhbGciOi.x.y');
});

test('end to end: create, invite, join, sync, rank', { skip: !hasPglite && 'PGlite not installed' }, async () => {
  const { startFakeSupabase } = require('./fake-supabase');
  const fake = await startFakeSupabase();
  try {
    const { board: owner, invite } = await board.createBoard({ url: fake.url, key: 'k', name: 'Night Shift', me: 'paul' });
    const { board: friend } = await board.joinBoard(invite, 'lena');
    await assert.rejects(board.joinBoard(invite, 'lena'), /already taken/);
    await board.syncBoard(owner, [ev(0, 'assistant', 1000), ev(0, 'prompt')]);
    await board.syncBoard(friend, [ev(0, 'assistant', 5000), ev(3, 'assistant', 5000)]);
    const week = await board.leaderboard(owner, 'week');
    assert.deepStrictEqual(week.map((r) => [r.rank, r.name, r.tokens, r.me]), [
      [1, 'lena', 10000, false],
      [2, 'paul', 1000, true],
    ]);
    const today = await board.leaderboard(friend, 'today');
    assert.strictEqual(today.find((r) => r.name === 'lena').tokens, 5000);
    await board.leaveBoard(friend);
    assert.strictEqual((await board.leaderboard(owner, 'all')).length, 1);
  } finally {
    fake.server.close();
  }
});
