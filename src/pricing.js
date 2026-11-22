'use strict';

// USD per million tokens. These are list prices for the API and only used to
// show an *estimated* API-equivalent value. Subscription users do not pay this.
// Cache writes are billed at 1.25x input, cache reads at 0.1x input.
const TABLE = [
  { match: /opus-4-(0|1)\b|opus-4-20|opus-4-1-|3-opus|opus-3/, input: 15, output: 75 },
  { match: /opus/, input: 5, output: 25 },
  { match: /haiku-3-5|3-5-haiku/, input: 0.8, output: 4 },
  { match: /haiku-3|3-haiku/, input: 0.25, output: 1.25 },
  { match: /haiku/, input: 1, output: 5 },
  { match: /sonnet/, input: 3, output: 15 },
];
const FALLBACK = { input: 3, output: 15 };

function priceFor(model) {
  const m = String(model || '').toLowerCase();
  for (const row of TABLE) if (row.match.test(m)) return row;
  return FALLBACK;
}

function costOf(model, t) {
  const p = priceFor(model);
  return (
    (t.input * p.input + t.cacheWrite * p.input * 1.25 + t.cacheRead * p.input * 0.1 + t.output * p.output) / 1e6
  );
}

/** "claude-opus-4-5-20251101" -> "Opus 4.5" */
function prettyModel(model) {
  const m = String(model || '').toLowerCase().replace(/^claude-/, '').replace(/-\d{8}$/, '');
  const fam = (m.match(/opus|sonnet|haiku|fable|mythos/) || [null])[0];
  if (!fam) return model;
  const nums = m.replace(fam, '').match(/\d+/g) || [];
  const version = nums.filter((n) => n.length <= 2).join('.');
  const name = fam[0].toUpperCase() + fam.slice(1);
  return version ? `${name} ${version}` : name;
}

module.exports = { priceFor, costOf, prettyModel };
