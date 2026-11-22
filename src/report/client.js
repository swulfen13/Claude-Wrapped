/* global DATA, META */
(function () {
  'use strict';

  const I18N = {
    en: {
      locale: 'en-US',
      yours: 'Your',
      possessive: (n) => `${n}'s`,
      allTime: 'all time',
      titleLine: (who, period) => `${who} ${period} with Claude Code`,
      wrapped: 'Wrapped',
      scroll: 'Scroll down to see how your year went.',
      tokensKicker: 'Tokens went back and forth between you and Claude.',
      tokensSub: (out, cache, books) => `${out} of them were written by Claude. ${cache} were cache reads that kept your context warm. Printed out, that’s about ${books} copies of War and Peace.`,
      timeKicker: 'You spent this many hours actively building.',
      activeDays: 'days with at least one prompt',
      streak: 'day streak, your longest',
      sessions: 'sessions',
      prompts: 'prompts sent',
      rhythmKicker: 'Your rhythm',
      persona: {
        'night-owl': 'Night owl',
        'early-bird': 'Early bird',
        daylight: 'Daytime builder',
        evening: 'Evening hacker',
      },
      rhythmSub: (h, wd) => `Most of your prompts landed around ${h}. ${wd} was your strongest weekday.`,
      bestKicker: 'Your peaks',
      bestMonth: 'was your biggest month',
      bestDay: (d) => `Your biggest day was ${d}.`,
      bestDaySub: (tok, pr, hrs) => `${tok} tokens, ${pr} prompts and about ${hrs} hours of active work.`,
      longest: (p, h) => `Your longest session ran ${h} hours in ${p}.`,
      modelKicker: 'Your go-to model',
      modelSub: (share) => `It handled ${share} of all your tokens.`,
      reposKicker: 'Where the work happened',
      reposSub: (n, b) => `${n} projects and ${b} branches. These five got the most attention.`,
      toolsKicker: 'Claude was busy',
      toolCalls: 'tool calls',
      linesWritten: 'lines written or edited',
      filesTouched: 'files touched',
      absolutely: 'times Claude told you “You’re absolutely right”',
      favTool: (t) => `Favorite tool: ${t}.`,
      planMode: 'plans made in plan mode',
      subagents: 'subagents sent off',
      valueKicker: 'At API prices, this year would have cost',
      valueSub: 'An estimate from public list prices per model. If you’re on a Pro or Max plan, you paid your subscription, not this.',
      shareKicker: 'Share your Wrapped',
      shareSub: 'Download the card and post it. Only the numbers on the card leave your machine, and only if you post them.',
      download: 'Download card',
      copy: 'Copy summary',
      copied: 'Copied',
      breakdown: 'The full breakdown',
      breakdownSub: (from, to) => `Everything from ${from} to ${to}, computed locally from your Claude Code logs.`,
      heatmap: 'Activity calendar',
      heatNote: 'Tokens per day. Darker means busier.',
      less: 'Less',
      more: 'More',
      months: 'Tokens by month',
      weekdays: 'Prompts by weekday',
      hours: 'Prompts by hour of day',
      models: 'Models',
      projects: 'Projects',
      tools: 'Tools',
      langs: 'Languages Claude edited',
      langsNote: 'By file extension of edits and writes.',
      colModel: 'Model', colTokens: 'Tokens', colShare: 'Share', colCost: 'Est. cost', colProject: 'Project',
      colSessions: 'Sessions', colPrompts: 'Prompts', colTool: 'Tool', colCalls: 'Calls', colLang: 'Language', colEdits: 'Edits',
      footer: 'Made with claude-wrapped. Your data never left your computer. Not affiliated with Anthropic.',
      emptyTitle: 'No Claude Code activity found',
      emptySub: 'Claude Wrapped reads the session logs Claude Code stores in ~/.claude/projects. Use Claude Code for a bit, pick another year with --year, or try the demo with --demo.',
      weekdaysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      weekdaysLong: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      cardTokens: 'tokens',
      cardHours: 'active hours',
      cardDays: 'active days',
      cardStreak: 'day streak',
      cardModel: 'top model',
      cardRepo: 'top project',
      cardPeak: 'peak hour',
    },
    de: {
      locale: 'de-DE',
      yours: 'Dein',
      possessive: (n) => (/[sxzß]$/i.test(n) ? `${n}'` : `${n}s`),
      allTime: 'gesamtes',
      titleLine: (who, period) => `${who} ${period} mit Claude Code`,
      wrapped: 'Wrapped',
      scroll: 'Scroll runter. Da steckt ein ganzes Jahr drin.',
      tokensKicker: 'So viele Tokens gingen zwischen dir und Claude hin und her.',
      tokensSub: (out, cache, books) => `${out} davon hat Claude geschrieben. ${cache} waren Cache-Reads, die deinen Kontext warm gehalten haben. Ausgedruckt wären das etwa ${books}-mal Krieg und Frieden.`,
      timeKicker: 'So viele Stunden hast du aktiv gebaut.',
      activeDays: 'Tage mit mindestens einem Prompt',
      streak: 'Tage am Stück, dein Rekord',
      sessions: 'Sessions',
      prompts: 'Prompts gesendet',
      rhythmKicker: 'Dein Rhythmus',
      persona: {
        'night-owl': 'Nachteule',
        'early-bird': 'Frühaufsteher',
        daylight: 'Tagschicht',
        evening: 'Feierabend-Hacker',
      },
      rhythmSub: (h, wd) => `Die meisten Prompts kamen gegen ${h}. Dein stärkster Wochentag war ${wd}.`,
      bestKicker: 'Deine Höhepunkte',
      bestMonth: 'war dein stärkster Monat',
      bestDay: (d) => `Dein stärkster Tag war der ${d}.`,
      bestDaySub: (tok, pr, hrs) => `${tok} Tokens, ${pr} Prompts und rund ${hrs} Stunden aktive Arbeit.`,
      longest: (p, h) => `Deine längste Session lief ${h} Stunden in ${p}.`,
      modelKicker: 'Dein Lieblingsmodell',
      modelSub: (share) => `Es hat ${share} all deiner Tokens verarbeitet.`,
      reposKicker: 'Hier wurde gearbeitet',
      reposSub: (n, b) => `${n} Projekte und ${b} Branches. Diese fünf bekamen die meiste Zeit.`,
      toolsKicker: 'Claude war fleißig',
      toolCalls: 'Tool-Aufrufe',
      linesWritten: 'Zeilen geschrieben oder geändert',
      filesTouched: 'Dateien bearbeitet',
      absolutely: 'Mal hat Claude gesagt: „You’re absolutely right“',
      favTool: (t) => `Lieblings-Tool: ${t}.`,
      planMode: 'Pläne im Plan-Modus',
      subagents: 'Subagents losgeschickt',
      valueKicker: 'Zu API-Preisen hätte dein Jahr gekostet',
      valueSub: 'Geschätzt mit den öffentlichen Listenpreisen pro Modell. Mit Pro- oder Max-Abo hast du nur dein Abo bezahlt, nicht das hier.',
      shareKicker: 'Teil dein Wrapped',
      shareSub: 'Lad die Karte runter und poste sie. Nur die Zahlen auf der Karte verlassen deinen Rechner, und nur wenn du sie postest.',
      download: 'Karte herunterladen',
      copy: 'Zusammenfassung kopieren',
      copied: 'Kopiert',
      breakdown: 'Alles im Detail',
      breakdownSub: (from, to) => `Alles vom ${from} bis ${to}, lokal aus deinen Claude-Code-Logs berechnet.`,
      heatmap: 'Aktivitätskalender',
      heatNote: 'Tokens pro Tag. Je dunkler, desto mehr los.',
      less: 'Weniger',
      more: 'Mehr',
      months: 'Tokens pro Monat',
      weekdays: 'Prompts pro Wochentag',
      hours: 'Prompts pro Uhrzeit',
      models: 'Modelle',
      projects: 'Projekte',
      tools: 'Tools',
      langs: 'Sprachen, die Claude bearbeitet hat',
      langsNote: 'Nach Dateiendung der Edits und Writes.',
      colModel: 'Modell', colTokens: 'Tokens', colShare: 'Anteil', colCost: 'Kosten (geschätzt)', colProject: 'Projekt',
      colSessions: 'Sessions', colPrompts: 'Prompts', colTool: 'Tool', colCalls: 'Aufrufe', colLang: 'Sprache', colEdits: 'Edits',
      footer: 'Erstellt mit claude-wrapped. Deine Daten haben deinen Rechner nie verlassen. Kein offizielles Anthropic-Produkt.',
      emptyTitle: 'Keine Claude-Code-Aktivität gefunden',
      emptySub: 'Claude Wrapped liest die Session-Logs, die Claude Code in ~/.claude/projects speichert. Nutz Claude Code ein bisschen, wähl mit --year ein anderes Jahr oder probier die Demo mit --demo.',
      weekdaysShort: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      weekdaysLong: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
      cardTokens: 'Tokens',
      cardHours: 'aktive Stunden',
      cardDays: 'aktive Tage',
      cardStreak: 'Tage am Stück',
      cardModel: 'Top-Modell',
      cardRepo: 'Top-Projekt',
      cardPeak: 'Peak-Uhrzeit',
    },
  };

  const T = I18N[META.lang] || I18N.en;
  const L = T.locale;
  const D = DATA;
  const C = { ink: '#16173a', cobalt: '#3047f0', signal: '#ffd23f', mint: '#6fe3b4', blush: '#ff8db4', paper: '#f5f5fa' };
  const MODEL_COLORS = [C.cobalt, C.signal, C.mint, C.blush, '#9aa3ff', '#ffe68f', '#b8f0d8', '#ffc6da'];

  // ---------- formatting ----------
  const nf = (n, d = 0) => new Intl.NumberFormat(L, { maximumFractionDigits: d }).format(n);
  const compact = (n) => new Intl.NumberFormat(L, { notation: 'compact', maximumFractionDigits: n >= 1e9 ? 2 : 1 }).format(n);
  const money = (n) => new Intl.NumberFormat(L, { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 100 ? 0 : 2 }).format(n);
  const pct = (x) => new Intl.NumberFormat(L, { style: 'percent', maximumFractionDigits: 0 }).format(x);
  const monthName = (i, style = 'long') => new Intl.DateTimeFormat(L, { month: style }).format(new Date(2000, i, 1));
  const dateLong = (s) => new Intl.DateTimeFormat(L, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s + 'T12:00:00'));
  const dateTs = (ts) => new Intl.DateTimeFormat(L, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ts));
  const hourLabel = (h) => new Intl.DateTimeFormat(L, { hour: 'numeric' }).format(new Date(2000, 0, 1, h));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const repoName = (name, i) => (META.anonymize ? `project-${i + 1}` : name);

  const who = META.name ? T.possessive(META.name) : T.yours;
  const period = D.year == null ? T.allTime : String(D.year);
  document.title = `${T.titleLine(who, period)} · Wrapped`;
  document.documentElement.lang = META.lang;

  const app = document.getElementById('app');

  if (D.empty) {
    app.innerHTML = `<section class="empty bg-cobalt"><h1 class="big">${esc(T.emptyTitle)}</h1><p class="sub">${esc(T.emptySub)}</p></section>`;
    return;
  }

  // ---------- story slides ----------
  const slides = [];
  const s = (cls, html) => slides.push(`<section class="slide ${cls}">${html}</section>`);
  const count = (n, fmt) => `<span data-count="${n}" data-fmt="${fmt}">${fmtBy(fmt, n)}</span>`;
  function fmtBy(fmt, n) {
    if (fmt === 'compact') return compact(n);
    if (fmt === 'money') return money(n);
    if (fmt === 'int') return nf(Math.round(n));
    return nf(n, 1);
  }

  s('bg-cobalt', `
    <p class="kicker">${esc(T.titleLine(who, period))}</p>
    <h1 class="title-mega">Claude<br>Code<br>${esc(T.wrapped)}</h1>
    <p class="scroll-hint">${esc(T.scroll)}</p>
    <div class="year-stamp" aria-hidden="true">${D.year == null ? '∞' : String(D.year).slice(2)}</div>`);

  const books = D.totals.output / (587000 / 0.75); // War and Peace ~587k words, ~0.75 words per token
  s('bg-signal', `
    <p class="kicker">${esc(T.tokensKicker)}</p>
    <p class="mega">${count(D.totals.tokens, 'compact')}</p>
    <p class="sub">${esc(T.tokensSub(compact(D.totals.output), compact(D.totals.cacheRead), nf(Math.max(books, 0.1), books < 10 ? 1 : 0)))}</p>`);

  s('bg-mint', `
    <p class="kicker">${esc(T.timeKicker)}</p>
    <p class="mega">${count(D.activeHours, 'int')}<small>h</small></p>
    <div class="facts">
      <div class="fact"><b>${nf(D.activeDays)}</b><span>${esc(T.activeDays)}</span></div>
      <div class="fact"><b>${nf(D.longestStreak)}</b><span>${esc(T.streak)}</span></div>
      <div class="fact"><b>${nf(D.sessions)}</b><span>${esc(T.sessions)}</span></div>
      <div class="fact"><b>${nf(D.totals.prompts)}</b><span>${esc(T.prompts)}</span></div>
    </div>`);

  const maxHour = Math.max(...D.byHour, 1);
  s('bg-ink', `
    <p class="kicker">${esc(T.rhythmKicker)}</p>
    <h2 class="big">${esc(T.persona[D.persona])}</h2>
    <p class="sub">${esc(T.rhythmSub(hourLabel(D.topHour), T.weekdaysLong[D.topWeekday]))}</p>
    <div>
      <div class="hours" role="img" aria-label="${esc(T.hours)}">
        ${D.byHour.map((v, h) => `<i class="${h === D.topHour ? 'peak' : ''}" style="height:${(v / maxHour) * 100}%" title="${hourLabel(h)}: ${nf(v)}"></i>`).join('')}
      </div>
      <div class="hours-axis"><span>${hourLabel(0)}</span><span>${hourLabel(6)}</span><span>${hourLabel(12)}</span><span>${hourLabel(18)}</span></div>
    </div>`);

  const ls = D.longestSession;
  s('bg-blush', `
    <p class="kicker">${esc(T.bestKicker)}</p>
    <h2 class="big">${esc(monthName(D.bestMonth.index))}</h2>
    <p class="kicker">${esc(T.bestMonth)}</p>
    ${D.bestDay ? `<p class="sub"><strong>${esc(T.bestDay(dateLong(D.bestDay.date)))}</strong> ${esc(T.bestDaySub(compact(D.bestDay.tokens), nf(D.bestDay.prompts), nf(D.bestDay.hours, 1)))}</p>` : ''}
    ${ls && ls.hours > 0 ? `<p class="sub">${esc(T.longest(repoName(ls.project, D.projects.findIndex((p) => p.name === ls.project)), nf(ls.hours, 1)))}</p>` : ''}`);

  if (D.models.length) {
    s('bg-paper', `
      <p class="kicker">${esc(T.modelKicker)}</p>
      <h2 class="big">${esc(D.models[0].name)}</h2>
      <p class="sub">${esc(T.modelSub(pct(D.models[0].share)))}</p>
      <div class="modelbar" role="img" aria-label="${esc(T.models)}">
        ${D.models.map((m, i) => `<span style="width:${m.share * 100}%;background:${MODEL_COLORS[i % MODEL_COLORS.length]}" title="${esc(m.name)} ${pct(m.share)}"></span>`).join('')}
      </div>
      <div class="legend">${D.models.map((m, i) => `<span><i style="background:${MODEL_COLORS[i % MODEL_COLORS.length]}"></i>${esc(m.name)} ${pct(m.share)}</span>`).join('')}</div>`);
  }

  if (D.projects.length) {
    s('bg-cobalt', `
      <p class="kicker">${esc(T.reposKicker)}</p>
      <ol class="ranking">
        ${D.projects.slice(0, 5).map((p, i) => `<li><span class="name">${esc(repoName(p.name, i))}</span><span class="val">${compact(p.tokens)} ${esc(T.cardTokens)}</span></li>`).join('')}
      </ol>
      <p class="sub">${esc(T.reposSub(nf(D.projectsCount), nf(D.branches)))}</p>`);
  }

  s('bg-signal', `
    <p class="kicker">${esc(T.toolsKicker)}</p>
    <p class="mega">${count(D.toolCalls, 'compact')}</p>
    <p class="kicker">${esc(T.toolCalls)}${D.tools[0] ? '. ' + esc(T.favTool(D.tools[0].name)) : ''}</p>
    <div class="facts">
      <div class="fact"><b>${compact(D.linesWritten)}</b><span>${esc(T.linesWritten)}</span></div>
      <div class="fact"><b>${nf(D.filesTouched)}</b><span>${esc(T.filesTouched)}</span></div>
      ${D.planMode ? `<div class="fact"><b>${nf(D.planMode)}</b><span>${esc(T.planMode)}</span></div>` : ''}
      ${D.subagentCalls ? `<div class="fact"><b>${nf(D.subagentCalls)}</b><span>${esc(T.subagents)}</span></div>` : ''}
      <div class="fact"><b>${nf(D.absolutelyRight)}</b><span>${esc(T.absolutely)}</span></div>
    </div>`);

  s('bg-ink', `
    <p class="kicker">${esc(T.valueKicker)}</p>
    <p class="mega">${count(D.totals.cost, 'money')}</p>
    <p class="sub">${esc(T.valueSub)}</p>`);

  s('bg-paper', `
    <div class="share-wrap">
      <canvas id="card" width="1080" height="1350" aria-label="Share card"></canvas>
      <div>
        <p class="kicker">${esc(T.shareKicker)}</p>
        <p class="sub" style="margin:14px 0 18px">${esc(T.shareSub)}</p>
        <button class="btn" id="dl">${esc(T.download)}</button>
        <button class="btn ghost" id="cp">${esc(T.copy)}</button>
      </div>
    </div>`);

  // ---------- breakdown ----------
  const panels = [];
  panels.push(`<div class="panel"><h3>${esc(T.heatmap)}</h3><p class="note">${esc(T.heatNote)}</p><div class="heat-wrap">${heatmap()}</div>
    <div class="heat-legend">${esc(T.less)} ${[0, 1, 2, 3, 4].map((l) => `<i style="background:${heatColor(l)}"></i>`).join('')} ${esc(T.more)}</div></div>`);
  panels.push(`<div class="grid2">
    <div class="panel"><h3>${esc(T.months)}</h3>${bars(D.byMonth.map((m) => m.tokens), D.byMonth.map((_, i) => monthName(i, 'short')), compact, D.bestMonth.index)}</div>
    <div class="panel"><h3>${esc(T.weekdays)}</h3>${bars(D.byWeekday, T.weekdaysShort, nf, D.topWeekday)}</div>
  </div>`);
  panels.push(`<div class="panel"><h3>${esc(T.hours)}</h3>${bars(D.byHour, D.byHour.map((_, h) => (h % 3 === 0 ? String(h) : '')), nf, D.topHour, 1300)}</div>`);
  panels.push(`<div class="grid2">
    <div class="panel"><h3>${esc(T.models)}</h3>${table([T.colModel, T.colTokens, T.colShare, T.colCost], D.models.map((m) => [esc(m.name), compact(m.tokens), pct(m.share), money(m.cost)]), D.models.map((m) => m.share))}</div>
    <div class="panel"><h3>${esc(T.projects)}</h3>${table([T.colProject, T.colTokens, T.colSessions, T.colPrompts], D.projects.map((p, i) => [esc(repoName(p.name, i)), compact(p.tokens), nf(p.sessions), nf(p.prompts)]), D.projects.map((p) => p.tokens / (D.projects[0].tokens || 1)))}</div>
  </div>`);
  panels.push(`<div class="grid2">
    <div class="panel"><h3>${esc(T.tools)}</h3>${table([T.colTool, T.colCalls], D.tools.map((t) => [esc(t.name), nf(t.count)]), D.tools.map((t) => t.count / (D.tools[0].count || 1)))}</div>
    <div class="panel"><h3>${esc(T.langs)}</h3><p class="note">${esc(T.langsNote)}</p>${table([T.colLang, T.colEdits], D.languages.map((l) => [esc(l.name), nf(l.count)]), D.languages.map((l) => l.count / (D.languages[0].count || 1)))}</div>
  </div>`);

  app.innerHTML = slides.join('') + `
    <section class="breakdown">
      <h2>${esc(T.breakdown)}</h2>
      <p class="sub">${esc(T.breakdownSub(dateTs(D.range.first), dateTs(D.range.last)))}</p>
      ${panels.join('')}
    </section>
    <footer>${esc(T.footer)}<br><code>npx ccwrapped</code></footer>`;

  // ---------- charts ----------
  function heatColor(level) {
    return ['#e4e5f0', '#c7ccfb', '#8c98f6', '#5468f2', C.cobalt][level];
  }
  function heatmap() {
    const map = new Map(D.days.map((d) => [d.date, d.tokens]));
    const sorted = D.days.map((d) => d.tokens).filter((t) => t > 0).sort((a, b) => a - b);
    const q = (p) => sorted[Math.floor(p * (sorted.length - 1))] || 0;
    const th = [q(0.25), q(0.5), q(0.75)];
    const level = (t) => (!t ? 0 : t <= th[0] ? 1 : t <= th[1] ? 2 : t <= th[2] ? 3 : 4);
    const startYear = D.year != null ? D.year : new Date(D.range.first).getFullYear();
    const start = D.year != null ? new Date(D.year, 0, 1) : new Date(D.range.first);
    const end = D.year != null ? new Date(D.year, 11, 31) : new Date(D.range.last);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // back to Monday
    const cell = 13, gap = 3, left = 30, top = 18;
    let x = 0, out = '', lastMonth = -1;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7), x++) {
      for (let r = 0; r < 7; r++) {
        const day = new Date(d); day.setDate(d.getDate() + r);
        if (day > end) break;
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const inRange = D.year == null || day.getFullYear() === startYear;
        const t = map.get(key) || 0;
        if (inRange) out += `<rect x="${left + x * (cell + gap)}" y="${top + r * (cell + gap)}" width="${cell}" height="${cell}" rx="3" fill="${heatColor(level(t))}"><title>${key}: ${compact(t)} tokens</title></rect>`;
        if (r === 0 && day.getMonth() !== lastMonth && inRange && day.getDate() <= 7) {
          lastMonth = day.getMonth();
          out += `<text x="${left + x * (cell + gap)}" y="11">${esc(monthName(day.getMonth(), 'short'))}</text>`;
        }
      }
    }
    const rowLabels = [0, 2, 4].map((r) => `<text x="0" y="${top + r * (cell + gap) + 10}">${esc(T.weekdaysShort[r])}</text>`).join('');
    const w = left + x * (cell + gap);
    return `<svg class="chart heat" viewBox="0 0 ${w} ${top + 7 * (cell + gap)}" role="img" aria-label="${esc(T.heatmap)}">${rowLabels}${out}</svg>`;
  }
  function bars(values, labels, fmt, hi, W = 640) {
    const H = 220, pad = 24, n = values.length, max = Math.max(...values, 1);
    const bw = (W - pad) / n;
    let out = '';
    values.forEach((v, i) => {
      const h = (v / max) * (H - 50);
      const x = i * bw + 2;
      out += `<rect x="${x}" y="${H - 22 - h}" width="${Math.max(bw - 5, 2)}" height="${h}" rx="3" fill="${i === hi ? C.cobalt : '#c7ccfb'}"><title>${esc(labels[i] || i)}: ${fmt(v)}</title></rect>`;
      if (labels[i]) out += `<text x="${x + (bw - 5) / 2}" y="${H - 6}" text-anchor="middle">${esc(labels[i])}</text>`;
      if (i === hi) out += `<text x="${x + (bw - 5) / 2}" y="${H - 28 - h}" text-anchor="middle" font-weight="600">${fmt(v)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${out}</svg>`;
  }
  function table(head, rows, shares) {
    if (!rows.length) return '<p class="note">–</p>';
    return `<table><thead><tr>${head.map((h, i) => `<th class="${i ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
      .map((r, ri) => `<tr>${r.map((c, i) => (i === 0 ? `<td class="barcell"><span style="width:${Math.max(shares[ri] || 0, 0.02) * 100}%"></span>${c}</td>` : `<td class="n">${c}</td>`)).join('')}</tr>`)
      .join('')}</tbody></table>`;
  }

  // ---------- count-up: the one motion moment ----------
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const el = e.target, target = Number(el.dataset.count), fmt = el.dataset.fmt, t0 = performance.now(), dur = 1400;
        const step = (now) => {
          const p = Math.min((now - t0) / dur, 1), k = 1 - Math.pow(1 - p, 4);
          el.textContent = fmtBy(fmt, target * k);
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.6 });
    document.querySelectorAll('[data-count]').forEach((el) => io.observe(el));
  }

  // ---------- share card ----------
  const summaryLines = () => [
    `${T.titleLine(who, period)} · Wrapped`,
    `${compact(D.totals.tokens)} ${T.cardTokens}`,
    `${nf(D.activeHours)} ${T.cardHours} · ${nf(D.activeDays)} ${T.cardDays} · ${nf(D.longestStreak)} ${T.cardStreak}`,
    `${T.cardModel}: ${D.favoriteModel || '–'} · ${T.cardPeak}: ${hourLabel(D.topHour)}`,
    'npx ccwrapped',
  ].join('\n');

  async function drawCard() {
    const cv = document.getElementById('card');
    const ctx = cv.getContext('2d');
    try { await document.fonts.ready; } catch (e) { /* fonts optional */ }
    const display = getComputedStyle(document.documentElement).getPropertyValue('--display');
    const body = getComputedStyle(document.documentElement).getPropertyValue('--body');
    const W = 1080, H = 1350;
    ctx.fillStyle = C.cobalt; ctx.fillRect(0, 0, W, H);
    // outlined year
    ctx.save();
    ctx.font = `800 620px ${display}`; ctx.strokeStyle = 'rgba(245,245,250,0.22)'; ctx.lineWidth = 3;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.strokeText(D.year == null ? '∞' : String(D.year).slice(2), W + 30, H + 70);
    ctx.restore();

    ctx.fillStyle = C.paper; ctx.textBaseline = 'top';
    ctx.font = `500 38px ${body}`; ctx.fillText(T.titleLine(who, period), 72, 76);
    ctx.font = `800 132px ${display}`; ctx.fillText('Claude Code', 72, 130); ctx.fillText(T.wrapped, 72, 250);

    ctx.fillStyle = C.signal;
    let size = 250; ctx.font = `800 ${size}px ${display}`;
    while (ctx.measureText(compact(D.totals.tokens)).width > 940 && size > 120) { size -= 10; ctx.font = `800 ${size}px ${display}`; }
    ctx.fillText(compact(D.totals.tokens), 66, 400 + (250 - size) * 0.8);
    ctx.fillStyle = C.paper; ctx.font = `600 40px ${body}`; ctx.fillText(T.cardTokens, 74, 650);

    const topRepo = D.projects[0] ? repoName(D.projects[0].name, 0) : '–';
    const cells = [
      [nf(D.activeHours), T.cardHours], [nf(D.activeDays), T.cardDays], [nf(D.longestStreak), T.cardStreak],
      [D.favoriteModel || '–', T.cardModel], [topRepo, T.cardRepo],
    ];
    cells.forEach(([v, k], i) => {
      const wide = i >= 3, cx = wide ? 72 + (i - 3) * 480 : 72 + i * 320, cy = 760 + (wide ? 190 : 0), maxW = wide ? 450 : 290;
      ctx.fillStyle = i < 3 ? C.mint : C.blush; ctx.fillRect(cx, cy, 60, 8);
      ctx.fillStyle = C.paper; ctx.font = `800 76px ${display}`;
      let val = String(v); while (ctx.measureText(val).width > maxW && val.length > 3) val = val.slice(0, -2) + '…';
      ctx.fillText(val, cx, cy + 26);
      ctx.font = `500 28px ${body}`; ctx.globalAlpha = 0.85; ctx.fillText(k, cx, cy + 112); ctx.globalAlpha = 1;
    });
    ctx.fillStyle = C.signal; ctx.fillRect(0, H - 110, W, 110);
    ctx.fillStyle = C.ink; ctx.font = `700 40px ${body}`; ctx.textBaseline = 'middle';
    ctx.fillText('npx ccwrapped', 72, H - 55);
  }
  drawCard();
  document.getElementById('dl').addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = `claude-wrapped-${D.year == null ? 'all-time' : D.year}.png`;
    a.href = document.getElementById('card').toDataURL('image/png');
    a.click();
  });
  document.getElementById('cp').addEventListener('click', async (ev) => {
    try { await navigator.clipboard.writeText(summaryLines()); ev.target.textContent = T.copied; } catch (e) { /* clipboard blocked */ }
  });
})();
