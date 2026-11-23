'use strict';
// Shields-style SVG badge, e.g. for a GitHub profile README.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Rough Verdana 11px widths, good enough for short labels.
const textWidth = (s) => [...String(s)].reduce((w, ch) => w + (/[ilI.,:;|!' ]/.test(ch) ? 3.6 : /[mwMW@%]/.test(ch) ? 10 : /[A-Z0-9#$]/.test(ch) ? 7.6 : /\p{Extended_Pictographic}/u.test(ch) ? 13 : 6.6), 0);

const COLORS = { cobalt: '#3047f0', ink: '#16173a', mint: '#1aa874', blush: '#e0457b', signal: '#c99400' };

function badgeSvg({ label = 'Claude Code', value, color = 'cobalt' }) {
  const lw = Math.round(textWidth(label) + 14);
  const vw = Math.round(textWidth(value) + 14);
  const w = lw + vw;
  const fill = COLORS[color] || color;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<title>${esc(label)}: ${esc(value)}</title>
<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${w}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#16173a"/><rect x="${lw}" width="${vw}" height="20" fill="${fill}"/><rect width="${w}" height="20" fill="url(#s)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(label)}</text><text x="${lw / 2}" y="14">${esc(label)}</text>
<text x="${lw + vw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(value)}</text><text x="${lw + vw / 2}" y="14">${esc(value)}</text>
</g></svg>
`;
}

const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

/** metric: tokens | hours | streak | cost | achievements | style */
function badgeFor(stats, metric = 'tokens') {
  const when = stats.year == null ? '' : ` in ${stats.year}`;
  const v = {
    tokens: `🔥 ${compact(stats.totals.tokens)} tokens${when}`,
    hours: `${Math.round(stats.activeHours)} hours${when}`,
    streak: `${stats.longestStreak}-day streak`,
    cost: `$${compact(stats.totals.cost)} at API prices${when}`,
    achievements: `${stats.achievements.filter((a) => a.unlocked).length}/${stats.achievements.length} achievements`,
    style: stats.archetype ? stats.archetype.title : 'Explorer',
  }[metric];
  if (!v) throw new Error('--metric must be tokens, hours, streak, cost, achievements or style');
  return badgeSvg({ value: v });
}

module.exports = { badgeSvg, badgeFor };
