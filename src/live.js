'use strict';
const { costOf, prettyModel } = require('./pricing');

const tokensOf = (e) => e.input + e.output + e.cacheWrite + e.cacheRead;

/** Small, cheap numbers for the live counter and the desktop widget. */
function liveStats(events, now = Date.now(), budget = null) {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const start = midnight.getTime();
  const out = {
    now,
    allTime: { tokens: 0, cost: 0, prompts: 0 },
    today: { tokens: 0, output: 0, cost: 0, prompts: 0 },
    lastHour: { tokens: 0 },
    last15min: { tokens: 0 },
    perHourToday: Array(24).fill(0),
    perMinute: Array(60).fill(0), // last 60 minutes, oldest first
    modelsToday: {},
    last: null,
  };
  for (const e of events) {
    if (e.kind === 'prompt') {
      out.allTime.prompts++;
      if (e.ts >= start) out.today.prompts++;
      continue;
    }
    const t = tokensOf(e);
    const c = costOf(e.model, e);
    out.allTime.tokens += t;
    out.allTime.cost += c;
    if (e.ts >= start) {
      out.today.tokens += t;
      out.today.output += e.output;
      out.today.cost += c;
      out.perHourToday[new Date(e.ts).getHours()] += t;
      const m = prettyModel(e.model);
      out.modelsToday[m] = (out.modelsToday[m] || 0) + t;
    }
    const age = now - e.ts;
    if (age >= 0 && age < 3600000) {
      out.lastHour.tokens += t;
      out.perMinute[59 - Math.floor(age / 60000)] += t;
      if (age < 900000) out.last15min.tokens += t;
    }
    if (!out.last || e.ts > out.last.ts) out.last = { ts: e.ts, model: prettyModel(e.model), project: e.project };
  }
  out.tokensPerMinute = out.last15min.tokens / 15;
  out.budget = budgetStatus(out, budget);
  return out;
}

/** budget: { usd } or { tokens } per day. Returns null when no budget is set. */
function budgetStatus(live, budget) {
  if (!budget || !(budget.usd > 0 || budget.tokens > 0)) return null;
  const kind = budget.usd > 0 ? 'usd' : 'tokens';
  const limit = kind === 'usd' ? budget.usd : budget.tokens;
  const used = kind === 'usd' ? live.today.cost : live.today.tokens;
  const ratio = used / limit;
  return { kind, limit, used, ratio, warn: ratio >= 0.8, over: ratio >= 1 };
}

/** "50M", "2.5k", "1e9", "20" -> number */
function parseAmount(v) {
  const m = String(v || '').trim().replace(/[$,_]/g, '').match(/^(\d+(?:\.\d+)?(?:e\d+)?)\s*([kmb])?$/i);
  if (!m) return NaN;
  return Number(m[1]) * ({ k: 1e3, m: 1e6, b: 1e9 }[String(m[2] || '').toLowerCase()] || 1);
}

module.exports = { liveStats, budgetStatus, parseAmount };
