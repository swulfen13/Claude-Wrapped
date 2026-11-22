'use strict';

// Generates a believable, fully synthetic year of Claude Code usage so people
// can try the report (and you can take screenshots) without sharing real data.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROJECTS = [
  { name: 'pixel-garden', w: 9, ext: ['tsx', 'ts', 'css'] },
  { name: 'api-gateway', w: 6, ext: ['go', 'yaml', 'md'] },
  { name: 'ml-experiments', w: 5, ext: ['py', 'ipynb', 'md'] },
  { name: 'side-quest', w: 4, ext: ['rs', 'toml'] },
  { name: 'landing-page', w: 3, ext: ['html', 'css', 'js'] },
  { name: 'dotfiles', w: 1, ext: ['sh', 'lua'] },
  { name: 'invoice-bot', w: 2, ext: ['ts', 'json', 'sql'] },
];
const TOOLS = [
  ['Read', 30], ['Edit', 22], ['Bash', 20], ['Grep', 10], ['Write', 6], ['Glob', 5],
  ['TodoWrite', 4], ['Task', 2], ['WebSearch', 2], ['MultiEdit', 2], ['WebFetch', 1], ['ExitPlanMode', 1],
];

function pick(r, list, key = 'w') {
  const total = list.reduce((s, x) => s + (Array.isArray(x) ? x[1] : x[key]), 0);
  let v = r() * total;
  for (const x of list) {
    v -= Array.isArray(x) ? x[1] : x[key];
    if (v <= 0) return x;
  }
  return list[list.length - 1];
}

function modelFor(month, r) {
  if (month < 3) return r() < 0.75 ? 'claude-sonnet-4-20250514' : 'claude-opus-4-20250514';
  if (month < 9) return r() < 0.7 ? 'claude-sonnet-4-5-20250929' : r() < 0.6 ? 'claude-opus-4-1-20250805' : 'claude-haiku-4-5-20251001';
  return r() < 0.6 ? 'claude-opus-4-5-20251101' : r() < 0.7 ? 'claude-sonnet-4-5-20250929' : 'claude-haiku-4-5-20251001';
}

function demoEvents(year = new Date().getFullYear(), seed = 42) {
  const r = rng(seed);
  const events = [];
  const now = new Date();
  const end = year === now.getFullYear() ? now : new Date(year, 11, 31, 23, 59);
  let sessionN = 0;
  for (let d = new Date(year, 0, 1); d <= end; d.setDate(d.getDate() + 1)) {
    const month = d.getMonth();
    const dow = d.getDay();
    const ramp = 0.35 + month / 14; // usage grows over the year
    const weekend = dow === 0 || dow === 6 ? 0.45 : 1;
    const vacation = month === 7 && d.getDate() > 10 && d.getDate() < 24 ? 0.05 : 1;
    if (r() > ramp * weekend * vacation * 1.1) continue;
    const nSessions = 1 + Math.floor(r() * (2 + month / 4));
    for (let s = 0; s < nSessions; s++) {
      sessionN++;
      const proj = pick(r, PROJECTS);
      const session = `demo-${sessionN}`;
      const startHour = r() < 0.55 ? 20 + Math.floor(r() * 5) : 9 + Math.floor(r() * 10);
      let ts = new Date(d.getFullYear(), month, d.getDate(), startHour % 24, Math.floor(r() * 60)).getTime();
      if (ts > end.getTime()) continue;
      const turns = 3 + Math.floor(r() * 25);
      const branch = r() < 0.6 ? 'main' : `feat/${['auth', 'charts', 'search', 'onboarding', 'perf'][Math.floor(r() * 5)]}`;
      for (let t = 0; t < turns; t++) {
        const base = { session, project: proj.name, branch, sidechain: false };
        events.push({ ...base, ts, kind: 'prompt', planMode: r() < 0.04 });
        const steps = 1 + Math.floor(r() * 6);
        for (let k = 0; k < steps; k++) {
          ts += 4000 + Math.floor(r() * 40000);
          const tool = pick(r, TOOLS)[0];
          const isEdit = ['Edit', 'Write', 'MultiEdit'].includes(tool);
          const ext = proj.ext[Math.floor(r() * proj.ext.length)];
          events.push({
            ...base,
            ts,
            kind: 'assistant',
            model: modelFor(month, r),
            input: 5 + Math.floor(r() * 400),
            output: 80 + Math.floor(r() * 1800),
            cacheWrite: Math.floor(r() * 6000),
            cacheRead: 15000 + Math.floor(r() * 90000),
            tools: [tool],
            files: isEdit ? [`/src/${proj.name}/file${Math.floor(r() * 40)}.${ext}`] : [],
            linesWritten: isEdit ? 3 + Math.floor(r() * (tool === 'Write' ? 160 : 30)) : 0,
            absolutelyRight: r() < 0.012 ? 1 : 0,
          });
        }
        ts += 20000 + Math.floor(r() * 240000);
      }
    }
  }
  return events.sort((a, b) => a.ts - b.ts);
}

module.exports = { demoEvents };
