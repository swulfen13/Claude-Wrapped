/* global META, CCWCharts, CCWCard */
(function () {
  'use strict';
  const L = 'en-US';
  const $ = (id) => document.getElementById(id);
  const esc = CCWCharts.esc;
  const nf = (n, d = 0) => new Intl.NumberFormat(L, { maximumFractionDigits: d }).format(n);
  const compact = (n) => new Intl.NumberFormat(L, { notation: 'compact', maximumFractionDigits: n >= 1e9 ? 2 : 1 }).format(n);
  const money = (n) => new Intl.NumberFormat(L, { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
  const pct = (x) => new Intl.NumberFormat(L, { style: 'percent', maximumFractionDigits: 0 }).format(x);
  const monthShort = (i) => new Intl.DateTimeFormat(L, { month: 'short' }).format(new Date(2000, i, 1));
  const hourLabel = (h) => new Intl.DateTimeFormat(L, { hour: 'numeric' }).format(new Date(2000, 0, 1, h));
  const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const RANGE_NAMES = { today: 'today', week: 'the last 7 days', month: 'the last 30 days', year: String(new Date().getFullYear()), all: 'all time' };
  const CARD_PERIOD = { today: 'day', week: 'week', month: 'month', year: String(new Date().getFullYear()), all: 'journey so far' };
  const MODEL_COLORS = ['#3047f0', '#ffd23f', '#6fe3b4', '#ff8db4', '#9aa3ff', '#ffe68f', '#b8f0d8', '#ffc6da'];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ago = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} days ago`;
  };
  const getJSON = async (u, o) => {
    const r = await fetch(u, o);
    const b = await r.json();
    if (!r.ok) throw new Error(b.error || r.statusText);
    return b;
  };

  let range = 'year';
  let period = 'week';
  let stats = null;

  // ---------- live counter ----------
  let shown = 0;
  let target = 0;
  function tick() {
    if (Math.abs(target - shown) < 1) shown = target;
    else shown += (target - shown) * 0.12;
    $('liveToday').textContent = nf(Math.round(shown));
    if (shown !== target) requestAnimationFrame(tick);
  }
  async function refreshLive() {
    try {
      const l = await getJSON('/api/live');
      target = l.today.tokens;
      if (reduce) { shown = target; $('liveToday').textContent = nf(target); } else requestAnimationFrame(tick);
      const parts = [];
      parts.push(l.tokensPerMinute > 0 ? `~${compact(l.tokensPerMinute)} tokens/min right now` : 'Quiet right now');
      parts.push(`${nf(l.today.prompts)} prompts today`);
      parts.push(`${money(l.today.cost)} at API prices`);
      if (l.last) parts.push(`last reply: ${esc(l.last.model)} in ${esc(META.demo ? l.last.project : l.last.project)}, ${ago(l.last.ts)}`);
      $('liveSub').innerHTML = parts.join(' · ');
      const bud = l.budget;
      const head = document.querySelector('.live');
      head.classList.toggle('warn', !!(bud && bud.warn && !bud.over));
      head.classList.toggle('over', !!(bud && bud.over));
      if (bud) {
        const lim = bud.kind === 'usd' ? money(bud.limit) : `${compact(bud.limit)} tokens`;
        $('budget').hidden = false;
        $('budget').innerHTML = `<span class="bbar"><i style="width:${Math.min(bud.ratio, 1) * 100}%"></i></span> ${bud.over ? 'Over your daily budget: ' : ''}${pct(bud.ratio)} of your ${lim} daily budget`;
      } else $('budget').hidden = true;
      const max = Math.max(...l.perMinute, 1);
      $('spark').innerHTML = l.perMinute.map((v) => `<i style="height:${(v / max) * 100}%" title="${compact(v)}"></i>`).join('');
      const p = $('pulse');
      p.classList.remove('stale', 'beat');
      void p.offsetWidth;
      p.classList.add('beat');
    } catch (e) {
      $('pulse').classList.add('stale');
      $('liveSub').textContent = 'Lost connection to ccwrapped. Is it still running?';
    }
  }

  // ---------- range stats ----------
  async function refreshStats() {
    try {
      stats = await getJSON(`/api/stats?range=${range}`);
    } catch (e) {
      return;
    }
    const S = stats;
    $('kpis').innerHTML = [
      [compact(S.totals.tokens), 'tokens'],
      [money(S.totals.cost), 'est. API value'],
      [nf(S.activeHours, S.activeHours < 10 ? 1 : 0), 'active hours'],
      [nf(S.totals.prompts), 'prompts'],
      [nf(S.sessions), 'sessions'],
    ].map(([v, k], i) => `<div class="kpi"><b>${v}</b><span>${k}</span>${i === 0 && S.previous && S.previous.change.tokens != null ? `<em class="delta ${S.previous.change.tokens >= 0 ? 'up' : 'down'}">${S.previous.change.tokens >= 0 ? '+' : ''}${pct(S.previous.change.tokens)} vs ${S.previous.year}</em>` : ''}</div>`).join('');

    const got = (S.achievements || []).filter((a) => a.unlocked).length;
    $('achNote').textContent = `${got} of ${(S.achievements || []).length} unlocked in ${RANGE_NAMES[range]}.`;
    $('styleTag').innerHTML = S.archetype ? `Your style: <strong>${esc(S.archetype.title)}</strong>` : '';
    $('ach').innerHTML = (S.achievements || []).map((a) => `<li class="${a.unlocked ? 'on' : 'off'}" title="${esc(a.desc)}"><span class="ico" aria-hidden="true">${a.icon}</span><span><b>${esc(a.title)}</b><small>${a.unlocked ? esc(a.desc) : esc(a.label)}</small><i class="prog"><i style="width:${a.progress * 100}%"></i></i></span></li>`).join('');

    if (range === 'today' || range === 'week') {
      $('activityTitle').textContent = 'Prompts by hour';
      $('activityNote').textContent = `When you worked, ${RANGE_NAMES[range]}.`;
      $('activity').innerHTML = CCWCharts.bars(S.byHour, S.byHour.map((_, h) => (h % 3 === 0 ? String(h) : '')), nf, S.topHour, 900);
    } else {
      $('activityTitle').textContent = 'Activity';
      $('activityNote').textContent = 'Tokens per day. Darker means busier.';
      const now = new Date();
      const start = range === 'month' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29) : range === 'year' ? new Date(now.getFullYear(), 0, 1) : new Date(S.range.first || Date.now());
      const end = range === 'year' ? new Date(now.getFullYear(), 11, 31) : now;
      $('activity').innerHTML = CCWCharts.heatmap(S.days, start, end, { fmt: compact, month: monthShort, weekdays: WEEK });
    }

    $('models').innerHTML = S.models.length
      ? `<div class="modelbar thin">${S.models.map((m, i) => `<span style="width:${m.share * 100}%;background:${MODEL_COLORS[i % 8]}" title="${esc(m.name)}"></span>`).join('')}</div>` +
        CCWCharts.table(['Model', 'Tokens', 'Share', 'Est. cost'], S.models.map((m, i) => [`<i class="dot" style="background:${MODEL_COLORS[i % 8]}"></i>${esc(m.name)}`, compact(m.tokens), pct(m.share), money(m.cost)]), S.models.map((m) => m.share))
      : '<p class="note">No replies in this range yet.</p>';
    $('projects').innerHTML = CCWCharts.table(['Project', 'Tokens', 'Sessions', 'Prompts'], S.projects.map((p) => [esc(p.name), compact(p.tokens), nf(p.sessions), nf(p.prompts)]), S.projects.map((p) => p.tokens / (S.projects[0].tokens || 1)));
    $('tools').innerHTML = CCWCharts.table(['Tool', 'Calls'], S.tools.map((t) => [esc(t.name), nf(t.count)]), S.tools.map((t) => t.count / (S.tools[0].count || 1)));
    drawCard();
  }

  // ---------- exports ----------
  function updateExports() {
    $('exports').querySelectorAll('a[data-by]').forEach((a) => {
      a.href = `/api/export.csv?range=${range}&by=${a.dataset.by}`;
      a.setAttribute('download', '');
    });
  }

  // ---------- leaderboard ----------
  let rankBy = 'tokens';
  let lastRows = [];
  const PERIOD_WORD = { today: 'day', week: 'week', month: 'month', year: 'year', all: 'all time' };
  const BY_LABEL = { tokens: 'tokens', activeDays: 'active days', prompts: 'prompts' };
  const fmtBy = (x) => (rankBy === 'activeDays' ? nf(x.activeDays) : compact(x[rankBy]));
  function rerank(rows) {
    const sorted = [...rows].sort((a, b) => b[rankBy] - a[rankBy] || a.name.localeCompare(b.name));
    let rank = 0, prev = null;
    return sorted.map((r, i) => {
      if (r[rankBy] !== prev) rank = i + 1;
      prev = r[rankBy];
      return { ...r, rank };
    });
  }
  async function refreshBoard() {
    const body = $('boardBody');
    if (!META.boards.length) {
      $('periods').hidden = true;
      $('rankBy').hidden = true;
      body.innerHTML = `<div class="setup">
        <strong>Compete with your friends.</strong> Leaderboards run on your own free Supabase project, so you and your friends own the data. Only daily totals are shared: tokens, prompts, cost and models. Never prompts, code or project names.
        <ol>
          <li>Create a Supabase project and run <code class="cmd">supabase/schema.sql</code> in its SQL editor. Or ask Claude Code to do it for you with the <em>leaderboard-setup</em> skill.</li>
          <li>Create a board: <code class="cmd">npx ccwrapped board create --name "Night Shift" --me YourName --url https://xyz.supabase.co --key sb_publishable_…</code></li>
          <li>Send the invite it prints to your friends. They run <code class="cmd">npx ccwrapped board join &lt;invite&gt; --me TheirName</code></li>
        </ol></div>`;
      return;
    }
    const b = META.boards[0];
    $('boardNote').innerHTML = `${esc(b.name)}. You're on it as <strong>${esc(b.me)}</strong>.`;
    try {
      const r = await getJSON(`/api/board?board=0&period=${period}`);
      const rows = rerank(r.rows);
      lastRows = rows;
      const max = Math.max(...rows.map((x) => x[rankBy]), 1);
      body.innerHTML = (rows.length
        ? `<ol class="lb">${rows.map((x) => `<li class="${x.me ? 'me' : ''}">
            <span class="rk">${x.rank}</span>
            <span class="who">${esc(x.name)}<small>${x.topModel ? esc(x.topModel) + ' · ' : ''}${nf(x.prompts)} prompts · ${nf(x.activeDays)} days</small></span>
            <span class="track"><span style="width:${(x[rankBy] / max) * 100}%"></span></span>
            <span class="tok">${fmtBy(x)}${rankBy === 'activeDays' ? '<small> days</small>' : ''}</span></li>`).join('')}</ol>`
        : '<p class="note">Nobody has synced yet.</p>') +
        `<div class="invite"><span>Invite a friend:</span><code class="cmd">npx ccwrapped board join ${esc(b.invite)} --me Name</code><button class="btn ghost small" id="copyInvite" type="button">Copy</button><button class="btn ghost small" id="syncNow" type="button">Sync now</button>${rows.length ? '<button class="btn small" id="winnerCard" type="button">Make winner card</button>' : ''}</div>`;
      if ($('winnerCard')) $('winnerCard').onclick = () => drawWinner(b.name);
      $('copyInvite').onclick = (e) => navigator.clipboard.writeText(`npx ccwrapped board join ${b.invite} --me Name`).then(() => (e.target.textContent = 'Copied'));
      $('syncNow').onclick = async (e) => {
        e.target.textContent = 'Syncing…';
        try {
          const s = await getJSON('/api/sync', { method: 'POST' });
          e.target.textContent = s.ok ? 'Synced' : 'Sync failed';
          refreshBoard();
        } catch (err) {
          e.target.textContent = 'Sync failed';
        }
      };
    } catch (e) {
      body.innerHTML = `<p class="note">Couldn't load the leaderboard: ${esc(e.message)}</p>`;
    }
  }

  // ---------- card designer ----------
  const STAT_DEFS = {
    hours: { label: 'active hours', get: (S) => nf(S.activeHours) },
    days: { label: 'active days', get: (S) => nf(S.activeDays) },
    streak: { label: 'day streak', get: (S) => nf(S.longestStreak) },
    peak: { label: 'peak hour', get: (S) => hourLabel(S.topHour) },
    model: { label: 'top model', get: (S) => S.favoriteModel || '–' },
    project: { label: 'top project', get: (S, anon) => (S.projects[0] ? (anon ? 'project-1' : S.projects[0].name) : '–') },
    prompts: { label: 'prompts', get: (S) => nf(S.totals.prompts) },
    sessions: { label: 'sessions', get: (S) => nf(S.sessions) },
    cost: { label: 'at API prices', get: (S) => money(S.totals.cost) },
    lines: { label: 'lines written', get: (S) => compact(S.linesWritten) },
    tools: { label: 'tool calls', get: (S) => compact(S.toolCalls) },
    right: { label: '“absolutely right”s', get: (S) => nf(S.absolutelyRight) },
    style: { label: 'coding style', get: (S) => (S.archetype ? S.archetype.title.replace(/^The /, '') : '–') },
    achievements: { label: 'achievements', get: (S) => `${(S.achievements || []).filter((a) => a.unlocked).length}/${(S.achievements || []).length}` },
    yoy: { label: 'vs last year', get: (S) => (S.previous && S.previous.change.tokens != null ? `${S.previous.change.tokens >= 0 ? '+' : ''}${pct(S.previous.change.tokens)}` : '–') },
  };
  const HERO = {
    tokens: (S) => [compact(S.totals.tokens), 'tokens'],
    hours: (S) => [nf(S.activeHours), 'active hours'],
    cost: (S) => [money(S.totals.cost), 'at API prices'],
    prompts: (S) => [nf(S.totals.prompts), 'prompts'],
    lines: (S) => [compact(S.linesWritten), 'lines written'],
  };
  const design = { theme: 'cobalt', format: 'portrait', stats: ['hours', 'days', 'streak', 'peak', 'model', 'project'] };
  const STORE = 'ccwrapped.card';
  try { Object.assign(design, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* storage blocked */ }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(design)); } catch (e) { /* ignore */ } };

  function buildControls() {
    $('themes').innerHTML = Object.entries(CCWCard.THEMES).map(([k, t]) => `<button type="button" data-theme="${k}" aria-pressed="${k === design.theme}" aria-label="${t.name}" title="${t.name}" style="background:linear-gradient(135deg, ${t.bg} 55%, ${t.hero} 55%)"></button>`).join('');
    $('formats').innerHTML = Object.entries(CCWCard.FORMATS).map(([k, f]) => `<button type="button" data-format="${k}" aria-pressed="${k === design.format}">${f.name}</button>`).join('');
    $('cardStats').innerHTML = Object.entries(STAT_DEFS).map(([k, d]) => `<label class="check"><input type="checkbox" value="${k}" ${design.stats.includes(k) ? 'checked' : ''}> ${esc(d.label)}</label>`).join('');
    if (design.title) $('cardTitle').value = design.title;
    if (design.hero) $('cardHero').value = design.hero;
    $('cardAnon').checked = !!design.anon;
    $('statCount').textContent = `(${design.stats.length} of 6)`;
  }
  function wireControls() {
    $('themes').onclick = (e) => {
      const b = e.target.closest('[data-theme]');
      if (!b) return;
      design.theme = b.dataset.theme;
      [...$('themes').children].forEach((x) => x.setAttribute('aria-pressed', x === b));
      save(); drawCard();
    };
    $('formats').onclick = (e) => {
      const b = e.target.closest('[data-format]');
      if (!b) return;
      design.format = b.dataset.format;
      [...$('formats').children].forEach((x) => x.setAttribute('aria-pressed', x === b));
      save(); drawCard();
    };
    $('cardStats').onchange = (e) => {
      const k = e.target.value;
      if (e.target.checked) {
        design.stats.push(k);
        if (design.stats.length > 6) {
          const drop = design.stats.shift();
          $('cardStats').querySelector(`input[value="${drop}"]`).checked = false;
        }
      } else design.stats = design.stats.filter((s) => s !== k);
      $('statCount').textContent = `(${design.stats.length} of 6)`;
      save(); drawCard();
    };
    $('cardTitle').oninput = (e) => { design.title = e.target.value; save(); drawCard(); };
    $('cardHero').onchange = (e) => { design.hero = e.target.value; save(); drawCard(); };
    $('cardAnon').onchange = (e) => { design.anon = e.target.checked; save(); drawCard(); };
    $('cardDownload').onclick = () => {
      const a = document.createElement('a');
      a.download = winnerMode ? `ccwrapped-winner-${period}.png` : `ccwrapped-${range}-${design.format}.png`;
      a.href = $('card').toDataURL('image/png');
      a.click();
    };
  }
  let winnerMode = false;
  function drawWinner(boardName) {
    if (!lastRows.length) return;
    winnerMode = true;
    const [w, ...rest] = lastRows;
    const word = PERIOD_WORD[period];
    const total = lastRows.reduce((s, x) => s + x[rankBy], 0);
    CCWCard.draw($('card'), {
      theme: design.theme,
      format: design.format,
      subtitle: `${boardName} · ${period === 'all' ? 'all time' : 'this ' + word}`,
      heading: ['Token king', period === 'all' ? 'of all time' : `of the ${word}`],
      hero: { value: w.name, label: `${fmtBy(w)} ${BY_LABEL[rankBy]}` },
      stats: [
        ...rest.slice(0, 3).map((x) => ({ value: x.name, label: `#${x.rank} · ${fmtBy(x)} ${BY_LABEL[rankBy]}` })),
        { value: rankBy === 'activeDays' ? nf(total) : compact(total), label: `${BY_LABEL[rankBy]} on the board` },
      ],
      stamp: '#1',
      footer: 'npx ccwrapped',
    });
    $('designer').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  function drawCard() {
    winnerMode = false;
    if (!stats) return;
    const S = stats;
    const [hv, hl] = (HERO[design.hero] || HERO.tokens)(S);
    const who = META.name ? `${META.name}'s` : 'My';
    CCWCard.draw($('card'), {
      theme: design.theme,
      format: design.format,
      subtitle: design.title || `${who} ${CARD_PERIOD[range]} with Claude Code`,
      heading: ['Claude Code', range === 'year' || range === 'all' ? 'Wrapped' : 'Stats'],
      hero: { value: hv, label: hl },
      stats: design.stats.map((k) => ({ value: STAT_DEFS[k].get(S, design.anon), label: STAT_DEFS[k].label })),
      stamp: range === 'year' ? String(new Date().getFullYear()).slice(2) : range === 'all' ? '∞' : '',
      footer: 'npx ccwrapped',
    });
  }

  // ---------- wiring ----------
  $('ranges').onclick = (e) => {
    const b = e.target.closest('[data-range]');
    if (!b) return;
    range = b.dataset.range;
    [...$('ranges').children].forEach((x) => x.setAttribute('aria-pressed', x === b));
    updateExports();
    refreshStats();
  };
  $('periods').onclick = (e) => {
    const b = e.target.closest('[data-period]');
    if (!b) return;
    period = b.dataset.period;
    [...$('periods').children].forEach((x) => x.setAttribute('aria-pressed', x === b));
    refreshBoard();
  };
  $('rankBy').onclick = (e) => {
    const b = e.target.closest('[data-by]');
    if (!b) return;
    rankBy = b.dataset.by;
    [...$('rankBy').children].forEach((x) => x.setAttribute('aria-pressed', x === b));
    refreshBoard();
  };
  updateExports();
  buildControls();
  wireControls();
  refreshLive();
  refreshStats();
  refreshBoard();
  setInterval(refreshLive, 5000);
  setInterval(refreshStats, 60000);
  setInterval(refreshBoard, 120000);
})();
