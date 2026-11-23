/* Shared share-card renderer, used by the Wrapped report and the dashboard designer. */
(function () {
  'use strict';
  const C = { ink: '#16173a', cobalt: '#3047f0', signal: '#ffd23f', mint: '#6fe3b4', blush: '#ff8db4', paper: '#f5f5fa' };

  const THEMES = {
    cobalt: { name: 'Cobalt', bg: C.cobalt, text: C.paper, hero: C.signal, accent: [C.mint, C.blush], band: C.signal, bandText: C.ink, stroke: 'rgba(245,245,250,0.22)' },
    midnight: { name: 'Midnight', bg: C.ink, text: C.paper, hero: C.mint, accent: [C.signal, C.blush], band: C.mint, bandText: C.ink, stroke: 'rgba(245,245,250,0.16)' },
    signal: { name: 'Signal', bg: C.signal, text: C.ink, hero: C.cobalt, accent: [C.ink, C.cobalt], band: C.ink, bandText: C.signal, stroke: 'rgba(22,23,58,0.16)' },
    mint: { name: 'Mint', bg: C.mint, text: C.ink, hero: C.ink, accent: [C.cobalt, C.blush], band: C.cobalt, bandText: C.paper, stroke: 'rgba(22,23,58,0.16)' },
    blush: { name: 'Blush', bg: C.blush, text: C.ink, hero: C.ink, accent: [C.cobalt, C.signal], band: C.ink, bandText: C.blush, stroke: 'rgba(22,23,58,0.16)' },
    paper: { name: 'Paper', bg: C.paper, text: C.ink, hero: C.cobalt, accent: [C.blush, C.mint], band: C.cobalt, bandText: C.paper, stroke: 'rgba(22,23,58,0.1)' },
  };
  const FORMATS = {
    portrait: { name: 'Post 4:5', w: 1080, h: 1350 },
    square: { name: 'Square 1:1', w: 1080, h: 1080 },
    story: { name: 'Story 9:16', w: 1080, h: 1920 },
  };

  function fit(ctx, text, maxW, weight, size, family, min) {
    let s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (ctx.measureText(text).width > maxW && s > min) {
      s -= 6;
      ctx.font = `${weight} ${s}px ${family}`;
    }
    return s;
  }
  function clip(ctx, text, maxW) {
    let v = String(text);
    while (ctx.measureText(v).width > maxW && v.length > 3) v = v.slice(0, -2) + '…';
    return v;
  }

  /**
   * opts = { theme, format, subtitle, heading: [line1, line2], hero: {value, label},
   *          stats: [{value, label}], stamp, footer }
   */
  async function draw(canvas, opts) {
    const th = THEMES[opts.theme] || THEMES.cobalt;
    const fm = FORMATS[opts.format] || FORMATS.portrait;
    canvas.width = fm.w;
    canvas.height = fm.h;
    const ctx = canvas.getContext('2d');
    try { await document.fonts.ready; } catch (e) { /* optional */ }
    const cs = getComputedStyle(document.documentElement);
    const display = cs.getPropertyValue('--display') || 'sans-serif';
    const body = cs.getPropertyValue('--body') || 'sans-serif';
    const W = fm.w, H = fm.h, M = 72, square = opts.format === 'square', story = opts.format === 'story';

    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    if (opts.stamp) {
      ctx.save();
      ctx.font = `800 ${story ? 760 : 620}px ${display}`; ctx.strokeStyle = th.stroke; ctx.lineWidth = 3;
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.strokeText(opts.stamp, W + 30, H + 70);
      ctx.restore();
    }

    ctx.fillStyle = th.text; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    let y = story ? 140 : 76;
    ctx.font = `500 38px ${body}`; ctx.fillText(clip(ctx, opts.subtitle || '', W - 2 * M), M, y);
    y += 54;
    const heading = opts.heading || ['Claude Code', 'Wrapped'];
    if (square) {
      fit(ctx, heading.join(' '), W - 2 * M, 800, 110, display, 60);
      ctx.fillText(heading.join(' '), M, y); y += 118;
    } else {
      ctx.font = `800 132px ${display}`;
      heading.forEach((line) => { ctx.fillText(clip(ctx, line, W - 2 * M), M, y); y += 120; });
      y += story ? 120 : 30;
    }

    const hero = opts.hero || { value: '', label: '' };
    ctx.fillStyle = th.hero;
    const hs = fit(ctx, String(hero.value), W - 2 * M + 10, 800, square ? 220 : story ? 300 : 250, display, 110);
    ctx.fillText(String(hero.value), M - 6, y);
    y += hs * 1.04;
    ctx.fillStyle = th.text; ctx.font = `600 40px ${body}`; ctx.fillText(hero.label || '', M + 2, y);

    const stats = (opts.stats || []).slice(0, square ? 4 : 6);
    const band = 110;
    const rowH = story ? 210 : square ? 170 : 160;
    const rows = Math.ceil(stats.length / 2);
    const gridTop = H - band - (story ? 120 : 50) - rows * rowH;
    stats.forEach((s, i) => {
      const cx = M + (i % 2) * 480, cy = gridTop + Math.floor(i / 2) * rowH;
      ctx.fillStyle = th.accent[Math.floor(i / 2) % 2]; ctx.fillRect(cx, cy, 60, 8);
      ctx.fillStyle = th.text;
      fit(ctx, String(s.value), 450, 800, 76, display, 44);
      ctx.fillText(clip(ctx, s.value, 450), cx, cy + 26);
      ctx.font = `500 28px ${body}`; ctx.globalAlpha = 0.85; ctx.fillText(clip(ctx, s.label, 450), cx, cy + 112); ctx.globalAlpha = 1;
    });

    ctx.fillStyle = th.band; ctx.fillRect(0, H - band, W, band);
    ctx.fillStyle = th.bandText; ctx.font = `700 40px ${body}`; ctx.textBaseline = 'middle';
    ctx.fillText(opts.footer || 'npx ccwrapped', M, H - band / 2);
  }

  window.CCWCard = { draw, THEMES, FORMATS };
})();
