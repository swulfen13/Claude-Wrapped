'use strict';
const { costOf, prettyModel } = require('./pricing');

const IDLE_GAP_MS = 10 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');
const day = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const iso = (ts) => (ts ? new Date(ts).toISOString() : '');
const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s;
};

/**
 * by: project | day | model | session. Returns CSV text (with a header row).
 * Active hours are counted per group, from gaps of up to 10 minutes between its events.
 */
function exportCsv(events, { by = 'project', since = null, year = null } = {}) {
  const keyOf = {
    project: (e) => e.project,
    day: (e) => day(e.ts),
    model: (e) => (e.kind === 'assistant' ? prettyModel(e.model) : null),
    session: (e) => e.session,
  }[by];
  if (!keyOf) throw new Error('--by must be project, day, model or session');
  const groups = new Map();
  for (const e of events) {
    if (since != null && e.ts < since) continue;
    if (year != null && new Date(e.ts).getFullYear() !== year) continue;
    const k = keyOf(e);
    if (k == null) continue;
    if (!groups.has(k)) groups.set(k, { key: k, project: e.project, sessions: new Set(), prompts: 0, responses: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0, first: e.ts, last: e.ts, activeMs: 0, prev: null });
    const g = groups.get(k);
    g.sessions.add(e.session);
    if (g.prev != null && e.ts - g.prev > 0 && e.ts - g.prev <= IDLE_GAP_MS) g.activeMs += e.ts - g.prev;
    g.prev = e.ts;
    g.first = Math.min(g.first, e.ts);
    g.last = Math.max(g.last, e.ts);
    if (e.kind === 'prompt') {
      g.prompts++;
      continue;
    }
    g.responses++;
    g.input += e.input;
    g.output += e.output;
    g.cacheWrite += e.cacheWrite;
    g.cacheRead += e.cacheRead;
    g.cost += costOf(e.model, e);
  }
  const head = [by, ...(by === 'session' ? ['project'] : []), 'sessions', 'prompts', 'responses', 'active_hours', 'total_tokens', 'input_tokens', 'output_tokens', 'cache_write_tokens', 'cache_read_tokens', 'est_cost_usd', 'first_activity', 'last_activity'];
  const rows = [...groups.values()]
    .sort((a, b) => (by === 'day' ? a.key.localeCompare(b.key) : b.input + b.output + b.cacheWrite + b.cacheRead - (a.input + a.output + a.cacheWrite + a.cacheRead)))
    .map((g) => [
      g.key,
      ...(by === 'session' ? [g.project] : []),
      g.sessions.size,
      g.prompts,
      g.responses,
      (g.activeMs / 3600000).toFixed(2),
      g.input + g.output + g.cacheWrite + g.cacheRead,
      g.input,
      g.output,
      g.cacheWrite,
      g.cacheRead,
      g.cost.toFixed(4),
      iso(g.first),
      iso(g.last),
    ]);
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

module.exports = { exportCsv };
