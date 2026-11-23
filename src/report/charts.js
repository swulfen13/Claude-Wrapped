/* Tiny SVG chart helpers shared by the report and the dashboard. */
(function () {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const HEAT = ['#e4e5f0', '#c7ccfb', '#8c98f6', '#5468f2', '#3047f0'];
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function bars(values, labels, fmt, hi, W = 640, H = 220) {
    const n = values.length, max = Math.max(...values, 1);
    const bw = (W - 24) / n;
    let out = '';
    values.forEach((v, i) => {
      const h = (v / max) * (H - 50);
      const x = i * bw + 2;
      const w = Math.max(bw - 5, 2);
      out += `<rect x="${x}" y="${H - 22 - h}" width="${w}" height="${h}" rx="3" fill="${i === hi ? '#3047f0' : '#c7ccfb'}"><title>${esc(labels[i] || i)}: ${fmt(v)}</title></rect>`;
      if (labels[i]) out += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${esc(labels[i])}</text>`;
      if (i === hi && v > 0) out += `<text x="${x + w / 2}" y="${H - 28 - h}" text-anchor="middle" font-weight="600">${fmt(v)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${out}</svg>`;
  }

  /** days: [{date:'YYYY-MM-DD', tokens}], start/end: Date */
  function heatmap(days, start, end, o) {
    const map = new Map(days.map((d) => [d.date, d.tokens]));
    const sorted = days.map((d) => d.tokens).filter((t) => t > 0).sort((a, b) => a - b);
    const q = (p) => sorted[Math.floor(p * (sorted.length - 1))] || 0;
    const th = [q(0.25), q(0.5), q(0.75)];
    const level = (t) => (!t ? 0 : t <= th[0] ? 1 : t <= th[1] ? 2 : t <= th[2] ? 3 : 4);
    const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const s = new Date(first);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    const cell = 13, gap = 3, left = 30, top = 18;
    let x = 0, out = '', lastMonth = -1;
    for (let d = new Date(s); d <= last; d.setDate(d.getDate() + 7), x++) {
      for (let r = 0; r < 7; r++) {
        const day = new Date(d);
        day.setDate(d.getDate() + r);
        if (day > last) break;
        if (day < first) continue;
        const k = key(day), t = map.get(k) || 0;
        out += `<rect x="${left + x * (cell + gap)}" y="${top + r * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${HEAT[level(t)]}"><title>${k}: ${o.fmt(t)} tokens</title></rect>`;
        if (day.getMonth() !== lastMonth && (day.getDate() <= 7 || x === 0) && r === 0) {
          lastMonth = day.getMonth();
          out += `<text x="${left + x * (cell + gap)}" y="11">${esc(o.month(day.getMonth()))}</text>`;
        }
      }
    }
    const rowLabels = [0, 2, 4].map((r) => `<text x="0" y="${top + r * (cell + gap) + 10}">${esc(o.weekdays[r])}</text>`).join('');
    const w = Math.max(left + x * (cell + gap), 200);
    return `<svg class="chart heat" style="min-width:${Math.min(w, 860)}px" viewBox="0 0 ${w} ${top + 7 * (cell + gap)}" role="img">${rowLabels}${out}</svg>`;
  }

  function table(head, rows, shares) {
    if (!rows.length) return '<p class="note">Nothing here yet.</p>';
    return `<table><thead><tr>${head.map((h, i) => `<th class="${i ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
      .map((r, ri) => `<tr>${r.map((c, i) => (i === 0 ? `<td class="barcell"><span style="width:${Math.max(shares[ri] || 0, 0.02) * 100}%"></span>${c}</td>` : `<td class="n">${c}</td>`)).join('')}</tr>`)
      .join('')}</tbody></table>`;
  }

  window.CCWCharts = { bars, heatmap, table, esc, HEAT };
})();
