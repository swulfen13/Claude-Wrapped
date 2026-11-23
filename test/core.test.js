'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCollector, parseFiles } = require('../src/parse');
const { computeStats } = require('../src/stats');
const { prettyModel, costOf } = require('../src/pricing');
const { demoEvents } = require('../src/demo');
const { renderHtml } = require('../src/render');

const usage = (o) => ({ input_tokens: 10, output_tokens: o, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 });

function fixture() {
  const base = { sessionId: 's1', cwd: '/home/u/code/my-app', gitBranch: 'main' };
  return [
    { ...base, type: 'user', uuid: 'u1', timestamp: '2026-03-02T21:00:00Z', message: { role: 'user', content: 'Add a login page' } },
    // streamed chunks of the same message: must count once, with the final usage
    { ...base, type: 'assistant', requestId: 'r1', timestamp: '2026-03-02T21:00:05Z', message: { id: 'm1', model: 'claude-sonnet-4-5-20250929', usage: usage(1), content: [{ type: 'text', text: "You're absolutely right!" }] } },
    { ...base, type: 'assistant', requestId: 'r1', timestamp: '2026-03-02T21:00:06Z', message: { id: 'm1', model: 'claude-sonnet-4-5-20250929', usage: usage(50), content: [{ type: 'tool_use', id: 't1', name: 'Write', input: { file_path: '/x/login.tsx', content: 'a\nb\nc' } }] } },
    // tool results are not prompts
    { ...base, type: 'user', uuid: 'u2', timestamp: '2026-03-02T21:00:07Z', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] } },
    { ...base, type: 'assistant', requestId: 'r2', timestamp: '2026-03-02T21:01:00Z', message: { id: 'm2', model: 'claude-opus-4-5-20251101', usage: usage(20), content: [{ type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: '/x/app.py', old_string: 'x', new_string: 'y\nz' } }] } },
    { ...base, type: 'assistant', timestamp: '2026-03-02T21:01:01Z', message: { id: 'm3', model: '<synthetic>', usage: usage(5), content: [] } },
    { ...base, type: 'user', isMeta: true, uuid: 'u3', timestamp: '2026-03-02T21:02:00Z', message: { role: 'user', content: 'meta' } },
    { ...base, sessionId: 's2', type: 'user', uuid: 'u4', timestamp: '2025-12-31T10:00:00Z', message: { role: 'user', content: 'old year' } },
  ];
}

test('collector de-duplicates streamed chunks and ignores tool results, meta and synthetic', () => {
  const c = createCollector();
  for (const r of fixture()) c.add(r, '/p/-home-u-code-my-app/s1.jsonl');
  const ev = c.events();
  const prompts = ev.filter((e) => e.kind === 'prompt');
  const asst = ev.filter((e) => e.kind === 'assistant');
  assert.strictEqual(prompts.length, 2);
  assert.strictEqual(asst.length, 2);
  assert.strictEqual(asst[0].output, 50);
  assert.deepStrictEqual(asst[0].tools, ['Write']);
  assert.strictEqual(asst[0].linesWritten, 3);
  assert.strictEqual(asst[0].absolutelyRight, 1);
  assert.strictEqual(asst[0].project, 'my-app');
});

test('stats filter by year and aggregate', () => {
  const c = createCollector();
  for (const r of fixture()) c.add(r, 'f.jsonl');
  const s = computeStats(c.events(), { year: 2026 });
  assert.strictEqual(s.totals.prompts, 1);
  assert.strictEqual(s.totals.output, 70);
  assert.strictEqual(s.totals.tokens, 2 * 10 + 70 + 2 * 100 + 2 * 1000);
  assert.strictEqual(s.projects[0].name, 'my-app');
  assert.strictEqual(s.linesWritten, 5);
  assert.deepStrictEqual(s.languages.map((l) => l.name).sort(), ['Python', 'TypeScript']);
  assert.strictEqual(s.models.length, 2);
  assert.strictEqual(s.activeDays, 1);
  const all = computeStats(c.events(), { year: null });
  assert.strictEqual(all.totals.prompts, 2);
  assert.strictEqual(all.sessions, 2);
});

test('parseFiles reads jsonl from disk and skips broken lines', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-'));
  const f = path.join(dir, 's1.jsonl');
  fs.writeFileSync(f, fixture().map((r) => JSON.stringify(r)).join('\n') + '\n{broken\n');
  const { events, badLines } = await parseFiles([f]);
  assert.strictEqual(badLines, 1);
  assert.strictEqual(events.length, 4);
});

test('model names and pricing', () => {
  assert.strictEqual(prettyModel('claude-opus-4-5-20251101'), 'Opus 4.5');
  assert.strictEqual(prettyModel('claude-3-5-sonnet-20241022'), 'Sonnet 3.5');
  assert.strictEqual(prettyModel('claude-haiku-4-5-20251001'), 'Haiku 4.5');
  const t = { input: 1e6, output: 0, cacheWrite: 0, cacheRead: 0 };
  assert.strictEqual(costOf('claude-opus-4-1-20250805', t), 15);
  assert.strictEqual(costOf('claude-opus-4-5-20251101', t), 5);
  assert.strictEqual(costOf('claude-sonnet-4-5', t), 3);
});

test('demo data renders to a self-contained html page', () => {
  const s = computeStats(demoEvents(2026), { year: 2026 });
  assert.ok(!s.empty && s.totals.tokens > 0 && s.longestStreak > 0);
  const html = renderHtml(s, { lang: 'de', name: 'Paul', anonymize: false });
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('const DATA = {'));
  assert.ok(!html.includes('</script><script>alert'));
});

test('html escapes data that could break out of the script tag', () => {
  const s = computeStats([], { year: 2026 });
  s.projects = [{ name: '</script><script>alert(1)</script>' }];
  const html = renderHtml(s, { lang: 'en' });
  assert.ok(!html.includes('</script><script>alert(1)'));
});

test('incremental reader only reads appended lines', async () => {
  const { createIncrementalReader } = require('../src/parse');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-inc-'));
  const f = path.join(dir, 's1.jsonl');
  const recs = fixture().map((r) => JSON.stringify(r));
  fs.writeFileSync(f, recs.slice(0, 2).join('\n') + '\n' + recs[2].slice(0, 20)); // last line half-written
  const r = createIncrementalReader();
  await r.update([f]);
  assert.strictEqual(r.events().length, 2);
  fs.appendFileSync(f, recs[2].slice(20) + '\n' + recs.slice(3).join('\n') + '\n');
  assert.strictEqual(await r.update([f]), true);
  assert.strictEqual(r.events().length, 4);
  assert.strictEqual(await r.update([f]), false);
});

test('the skill ships the exact same schema as supabase/schema.sql', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'schema.sql'), 'utf8');
  const b = fs.readFileSync(path.join(__dirname, '..', 'skills', 'leaderboard-setup', 'schema.sql'), 'utf8');
  assert.strictEqual(a, b, 'Run: cp supabase/schema.sql skills/leaderboard-setup/schema.sql');
});
