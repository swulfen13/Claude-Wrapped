/* global CCWCharts */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const nf = (n) => new Intl.NumberFormat('en-US').format(Math.round(n));
  const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: n >= 1e9 ? 2 : 1 }).format(n);
  const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shown = 0, target = 0;
  function tick() {
    shown = Math.abs(target - shown) < 1 ? target : shown + (target - shown) * 0.12;
    $('count').textContent = nf(shown);
    if (shown !== target) requestAnimationFrame(tick);
  }
  async function refresh() {
    try {
      const l = await (await fetch('/api/live')).json();
      target = l.today.tokens;
      if (reduce) { shown = target; $('count').textContent = nf(target); } else requestAnimationFrame(tick);
      $('allTime').textContent = compact(l.allTime.tokens);
      $('cost').textContent = money(l.today.cost);
      $('prompts').textContent = nf(l.today.prompts);
      $('rate').textContent = l.tokensPerMinute > 0 ? `~${compact(l.tokensPerMinute)}/min` : 'idle';
      const max = Math.max(...l.perMinute, 1);
      $('spark').innerHTML = l.perMinute.map((v) => `<i style="height:${(v / max) * 100}%"></i>`).join('');
      $('last').textContent = l.last ? `Last reply: ${l.last.model} in ${l.last.project}` : '';
      $('pulse').classList.remove('stale');
    } catch (e) {
      $('pulse').classList.add('stale');
      $('rate').textContent = 'offline';
    }
  }
  refresh();
  setInterval(refresh, 4000);
})();
