'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { computeStats, withPrevious } = require('../src/stats');
const { demoHistory } = require('../src/demo');
const { exportCsv } = require('../src/export');
const { badgeFor, badgeSvg } = require('../src/badge');
const { liveStats, parseAmount } = require('../src/live');
const { render, installStatusline } = require('../src/statusline');
const { rerank } = require('../src/board');

const events = demoHistory(2026);
const stats = withPrevious(computeStats(events, { year: 2026 }), events);

test('archetype, achievements and year over year', () => {
  assert.ok(stats.archetype && stats.archetype.title);
  assert.strictEqual(stats.achievements.length, 16);
  const million = stats.achievements.find((a) => a.id === 'million');
  assert.strictEqual(million.unlocked, true);
  assert.strictEqual(million.progress, 1);
  assert.strictEqual(stats.previous.year, 2025);
  assert.ok(stats.previous.change.tokens > 0);
  const empty = computeStats([], { year: 2026 });
  assert.ok(empty.achievements.every((a) => !a.unlocked));
});

test('csv export groups, totals and guards against formula injection', () => {
  const csv = exportCsv(events, { by: 'project', year: 2026 });
  const lines = csv.trim().split('\n');
  assert.match(lines[0], /^project,sessions,prompts/);
  const total = lines.slice(1).reduce((s, l) => s + Number(l.split(',')[5]), 0);
  assert.strictEqual(total, stats.totals.tokens);
  const evil = exportCsv([{ ts: Date.now(), kind: 'prompt', session: 's', project: '=HYPERLINK("x")' }], { by: 'project' });
  assert.ok(evil.includes(`"'=HYPERLINK(""x"")"`));
  assert.throws(() => exportCsv(events, { by: 'nope' }), /--by/);
});

test('badges are valid svg and escape text', () => {
  const svg = badgeFor(stats, 'tokens');
  assert.match(svg, /^<svg[^>]+role="img"/);
  assert.match(svg, /tokens in 2026/);
  assert.ok(!badgeSvg({ value: '<script>' }).includes('<script>'));
  assert.throws(() => badgeFor(stats, 'nope'), /--metric/);
});

test('budget status and amounts', () => {
  assert.strictEqual(parseAmount('50M'), 5e7);
  assert.strictEqual(parseAmount('$20'), 20);
  assert.ok(Number.isNaN(parseAmount('lots')));
  const now = Date.now();
  const ev = [{ ts: now - 1000, kind: 'assistant', model: 'claude-sonnet-4-5', input: 1e6, output: 0, cacheWrite: 0, cacheRead: 0, project: 'p' }];
  const l = liveStats(ev, now, { usd: 2 });
  assert.strictEqual(l.budget.kind, 'usd');
  assert.ok(l.budget.ratio > 1.4 && l.budget.over);
  assert.strictEqual(liveStats(ev, now, null).budget, null);
  const line = render(l, { model: { display_name: 'Opus 4.5' }, workspace: { current_dir: '/a/b/my-app' } });
  assert.match(line, /Opus 4\.5/);
  assert.match(line, /my-app/);
  assert.match(line, /budget/);
});

test('statusline install keeps other settings and never overwrites silently', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-sl-'));
  const prev = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = dir;
  try {
    fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ model: 'opus', statusLine: { type: 'command', command: 'mine' } }));
    const r1 = installStatusline({ command: 'ccyear statusline' });
    assert.strictEqual(r1.changed, false);
    const r2 = installStatusline({ command: 'ccyear statusline', force: true });
    assert.strictEqual(r2.changed, true);
    const s = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
    assert.strictEqual(s.model, 'opus');
    assert.strictEqual(s.statusLine.command, 'ccyear statusline');
    assert.ok(fs.existsSync(path.join(dir, 'settings.json.ccwrapped-backup')));
    fs.writeFileSync(path.join(dir, 'settings.json'), '{ broken');
    assert.throws(() => installStatusline({ command: 'x' }), /valid JSON/);
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = prev;
  }
});

test('leaderboard can be re-ranked with ties', () => {
  const rows = [
    { name: 'a', tokens: 5, activeDays: 3 },
    { name: 'b', tokens: 9, activeDays: 3 },
    { name: 'c', tokens: 1, activeDays: 6 },
  ];
  assert.deepStrictEqual(rerank(rows, 'activeDays').map((r) => [r.name, r.rank]), [['c', 1], ['a', 2], ['b', 2]]);
  assert.deepStrictEqual(rerank(rows, 'tokens').map((r) => r.name), ['b', 'a', 'c']);
});
