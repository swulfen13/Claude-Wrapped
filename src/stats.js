'use strict';
const path = require('path');
const { costOf, prettyModel } = require('./pricing');

const IDLE_GAP_MS = 10 * 60 * 1000; // gaps longer than this don't count as active time

const LANGS = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  py: 'Python', ipynb: 'Python', rs: 'Rust', go: 'Go', java: 'Java', kt: 'Kotlin', swift: 'Swift',
  c: 'C', h: 'C', cpp: 'C++', cc: 'C++', hpp: 'C++', cs: 'C#', rb: 'Ruby', php: 'PHP',
  html: 'HTML', css: 'CSS', scss: 'CSS', vue: 'Vue', svelte: 'Svelte', md: 'Markdown', mdx: 'Markdown',
  json: 'JSON', yml: 'YAML', yaml: 'YAML', toml: 'TOML', sql: 'SQL', sh: 'Shell', bash: 'Shell',
  ps1: 'PowerShell', dart: 'Dart', lua: 'Lua', ex: 'Elixir', zig: 'Zig',
};

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function topN(map, n, score) {
  return [...map.entries()]
    .map(([k, v]) => ({ name: k, ...(typeof v === 'object' ? v : { value: v }) }))
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}

function inc(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by);
}

function persona(topHour) {
  if (topHour < 5) return 'night-owl';
  if (topHour < 9) return 'early-bird';
  if (topHour < 18) return 'daylight';
  return 'evening';
}

/**
 * @param {Array} allEvents normalised events from parse.js
 * @param {{year?: number|null}} opts year=null means all time
 */
function computeStats(allEvents, opts = {}) {
  const year = opts.year === undefined ? new Date().getFullYear() : opts.year;
  let events = year == null ? allEvents : allEvents.filter((e) => new Date(e.ts).getFullYear() === year);
  if (opts.since != null) events = events.filter((e) => e.ts >= opts.since);

  const totals = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0, prompts: 0, responses: 0 };
  const byHour = Array(24).fill(0);
  const byWeekday = Array(7).fill(0); // 0 = Monday
  const byMonth = Array.from({ length: 12 }, () => ({ tokens: 0, prompts: 0 }));
  const days = new Map(); // dayKey -> {tokens, prompts}
  const models = new Map();
  const projects = new Map();
  const tools = new Map();
  const langs = new Map();
  const branches = new Set();
  const sessions = new Map();
  let linesWritten = 0;
  let absolutelyRight = 0;
  let planMode = 0;
  let subagentCalls = 0;
  let filesTouched = new Set();
  let activeMs = 0;
  let lastTs = null;

  for (const e of events) {
    const d = new Date(e.ts);
    const dk = dayKey(d);
    if (!days.has(dk)) days.set(dk, { tokens: 0, prompts: 0, activeMs: 0 });
    const day = days.get(dk);

    if (lastTs != null) {
      const gap = e.ts - lastTs;
      if (gap > 0 && gap <= IDLE_GAP_MS) {
        activeMs += gap;
        day.activeMs += gap;
      }
    }
    lastTs = e.ts;

    if (!sessions.has(e.session)) sessions.set(e.session, { start: e.ts, end: e.ts, project: e.project, tokens: 0, prompts: 0, last: e.ts, activeMs: 0 });
    const s = sessions.get(e.session);
    if (e.ts - s.last > 0 && e.ts - s.last <= IDLE_GAP_MS) s.activeMs += e.ts - s.last;
    s.last = Math.max(s.last, e.ts);
    s.end = Math.max(s.end, e.ts);

    if (!projects.has(e.project)) projects.set(e.project, { tokens: 0, prompts: 0, sessions: new Set(), cost: 0 });
    const p = projects.get(e.project);
    p.sessions.add(e.session);
    if (e.branch && e.branch !== 'HEAD') branches.add(`${e.project}@${e.branch}`);

    if (e.kind === 'prompt') {
      totals.prompts++;
      byHour[d.getHours()]++;
      byWeekday[(d.getDay() + 6) % 7]++;
      byMonth[d.getMonth()].prompts++;
      day.prompts++;
      p.prompts++;
      s.prompts++;
      if (e.planMode) planMode++;
      continue;
    }

    const tok = e.input + e.output + e.cacheWrite + e.cacheRead;
    const cost = costOf(e.model, e);
    totals.responses++;
    totals.input += e.input;
    totals.output += e.output;
    totals.cacheWrite += e.cacheWrite;
    totals.cacheRead += e.cacheRead;
    totals.cost += cost;
    byMonth[d.getMonth()].tokens += tok;
    day.tokens += tok;
    p.tokens += tok;
    p.cost += cost;
    s.tokens += tok;

    const name = prettyModel(e.model);
    if (!models.has(name)) models.set(name, { tokens: 0, output: 0, responses: 0, cost: 0 });
    const m = models.get(name);
    m.tokens += tok;
    m.output += e.output;
    m.responses++;
    m.cost += cost;

    for (const t of e.tools) {
      inc(tools, t);
      if (t === 'ExitPlanMode') planMode++;
      if (t === 'Task' || t === 'Agent') subagentCalls++;
    }
    for (const f of e.files) {
      filesTouched.add(f);
      const ext = path.extname(f).slice(1).toLowerCase();
      const lang = LANGS[ext];
      if (lang) inc(langs, lang);
    }
    linesWritten += e.linesWritten;
    absolutelyRight += e.absolutelyRight;
  }

  const totalTokens = totals.input + totals.output + totals.cacheWrite + totals.cacheRead;

  // Day-level highlights
  const dayList = [...days.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date));
  const bestDay = dayList.reduce((best, d) => (!best || d.tokens > best.tokens ? d : best), null);
  let longestStreak = 0;
  let streakEnd = null;
  let run = 0;
  let prev = null;
  for (const d of dayList) {
    if (d.prompts === 0 && d.tokens === 0) continue;
    const cur = new Date(d.date + 'T12:00:00');
    run = prev && Math.round((cur - prev) / 86400000) === 1 ? run + 1 : 1;
    if (run > longestStreak) {
      longestStreak = run;
      streakEnd = d.date;
    }
    prev = cur;
  }

  const bestMonthIdx = byMonth.reduce((bi, m, i) => (m.tokens > byMonth[bi].tokens ? i : bi), 0);
  const topHour = byHour.reduce((bi, v, i) => (v > byHour[bi] ? i : bi), 0);
  const topWeekday = byWeekday.reduce((bi, v, i) => (v > byWeekday[bi] ? i : bi), 0);

  const sessionList = [...sessions.entries()].map(([id, s]) => ({ id, ...s }));
  const longestSession = sessionList.reduce((b, s) => (!b || s.activeMs > b.activeMs ? s : b), null);

  const modelList = topN(models, 8, (x) => x.tokens).map((m) => ({ ...m, share: totalTokens ? m.tokens / totalTokens : 0 }));
  const projectList = topN(projects, 10, (x) => x.tokens).map((p) => ({
    name: p.name,
    tokens: p.tokens,
    prompts: p.prompts,
    sessions: p.sessions.size,
    cost: p.cost,
  }));

  const first = events.length ? events[0].ts : null;
  const last = events.length ? events[events.length - 1].ts : null;

  return {
    generatedAt: new Date().toISOString(),
    year,
    range: { first, last },
    empty: events.length === 0,
    totals: { ...totals, tokens: totalTokens },
    sessions: sessions.size,
    projectsCount: projects.size,
    activeDays: dayList.filter((d) => d.prompts || d.tokens).length,
    activeHours: activeMs / 3600000,
    byHour,
    byWeekday,
    byMonth,
    days: dayList.map((d) => ({ date: d.date, tokens: d.tokens, prompts: d.prompts })),
    bestDay: bestDay && { date: bestDay.date, tokens: bestDay.tokens, prompts: bestDay.prompts, hours: bestDay.activeMs / 3600000 },
    bestMonth: { index: bestMonthIdx, ...byMonth[bestMonthIdx] },
    topHour,
    topWeekday,
    persona: persona(topHour),
    longestStreak,
    streakEnd,
    longestSession: longestSession && {
      project: longestSession.project,
      hours: longestSession.activeMs / 3600000,
      prompts: longestSession.prompts,
      tokens: longestSession.tokens,
      start: longestSession.start,
    },
    models: modelList,
    favoriteModel: modelList[0] ? modelList[0].name : null,
    projects: projectList,
    tools: topN(tools, 12, (x) => x.value).map((t) => ({ name: t.name, count: t.value })),
    toolCalls: [...tools.values()].reduce((a, b) => a + b, 0),
    languages: topN(langs, 8, (x) => x.value).map((l) => ({ name: l.name, count: l.value })),
    filesTouched: filesTouched.size,
    branches: branches.size,
    linesWritten,
    absolutelyRight,
    planMode,
    subagentCalls,
  };
}

module.exports = { computeStats, prettyModel };
