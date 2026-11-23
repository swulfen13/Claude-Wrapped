'use strict';
// Local dashboard server. Binds to 127.0.0.1 only, so nothing is reachable from your network.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { findLogFiles } = require('./find');
const { createIncrementalReader } = require('./parse');
const { computeStats, withPrevious } = require('./stats');
const { liveStats } = require('./live');
const { renderHtml } = require('./render');
const { demoHistory } = require('./demo');
const board = require('./board');
const { exportCsv } = require('./export');
const { badgeFor } = require('./badge');

const DASH = path.join(__dirname, 'dashboard');
const REPORT = path.join(__dirname, 'report');
const read = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');

function sinceFor(range, now = Date.now()) {
  const d = new Date(now);
  if (range === 'today') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (range === 'week') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6).getTime();
  if (range === 'month') return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29).getTime();
  return null;
}

function page(file, meta) {
  const css = read(REPORT, 'styles.css') + '\n' + read(DASH, 'dashboard.css');
  const js = [read(REPORT, 'charts.js'), read(REPORT, 'card.js'), read(DASH, file.replace('.html', '.js'))].join('\n');
  return read(DASH, file)
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js)
    .replace('/*__META__*/', () => `const META = ${JSON.stringify(meta).replace(/</g, '\\u003c')};`);
}

function createServer(opts = {}) {
  const reader = createIncrementalReader();
  const demo = !!opts.demo;
  let demoData = demo ? demoHistory(new Date().getFullYear()) : null;
  let files = [];
  let lastScan = 0;
  let lastRead = 0;
  let boardCache = new Map(); // key -> {at, rows}
  let syncState = { at: null, error: null };

  async function events() {
    if (demo) return demoData;
    const now = Date.now();
    if (now - lastScan > 30000) {
      files = findLogFiles(opts.dir).files;
      lastScan = now;
    }
    if (now - lastRead > 2000) {
      lastRead = now;
      await reader.update(files);
    }
    return reader.events();
  }

  async function syncAll() {
    const cfg = board.loadConfig();
    if (demo || !cfg.boards || !cfg.boards.length) return;
    const ev = await events();
    for (const b of cfg.boards) {
      try {
        await board.syncBoard(b, ev);
        syncState = { at: Date.now(), error: null };
      } catch (e) {
        syncState = { at: Date.now(), error: e.message };
      }
    }
    boardCache.clear();
  }

  const meta = () => {
    const cfg = board.loadConfig();
    return {
      demo,
      lang: opts.lang || 'en',
      name: opts.name || null,
      boards: (cfg.boards || []).map((b, i) => ({
        index: i,
        name: b.boardName,
        me: b.me,
        owner: !!b.owner,
        invite: board.makeInvite(b.url, b.key, b.code),
      })),
      sync: syncState,
      budget: cfg.budget || null,
    };
  };

  const json = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const html = (res, body) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  };

  const server = http.createServer(async (req, res) => {
    // Block DNS-rebinding: only answer requests addressed to localhost.
    const host = String(req.headers.host || '').split(':')[0];
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/') return html(res, page('dashboard.html', meta()));
      if (req.method === 'GET' && url.pathname === '/widget') return html(res, page('widget.html', meta()));
      if (req.method === 'GET' && url.pathname === '/wrapped') {
        const y = url.searchParams.get('year');
        const year = y === 'all' ? null : Number(y) || new Date().getFullYear();
        const ev = await events();
        const stats = withPrevious(computeStats(ev, { year }), ev);
        return html(res, renderHtml(stats, { lang: opts.lang || 'en', name: opts.name || null, anonymize: url.searchParams.has('anonymize') }));
      }
      if (req.method === 'GET' && url.pathname === '/api/meta') return json(res, 200, meta());
      if (req.method === 'GET' && url.pathname === '/api/live') return json(res, 200, liveStats(await events(), Date.now(), board.loadConfig().budget));
      if (req.method === 'GET' && url.pathname === '/api/export.csv') {
        const range = url.searchParams.get('range') || 'year';
        const by = url.searchParams.get('by') || 'project';
        const csv = exportCsv(await events(), { by, since: sinceFor(range), year: range === 'year' ? new Date().getFullYear() : null });
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ccwrapped-${by}-${range}.csv"`, 'Cache-Control': 'no-store' });
        return res.end(csv);
      }
      if (req.method === 'GET' && url.pathname === '/badge.svg') {
        const ev = await events();
        const svg = badgeFor(computeStats(ev, { year: new Date().getFullYear() }), url.searchParams.get('metric') || 'tokens');
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
        return res.end(svg);
      }
      if (req.method === 'GET' && url.pathname === '/api/stats') {
        const range = url.searchParams.get('range') || 'year';
        const year = range === 'year' ? new Date().getFullYear() : null;
        const ev = await events();
        let stats = computeStats(ev, { year, since: sinceFor(range) });
        if (range === 'year') stats = withPrevious(stats, ev);
        return json(res, 200, { ...stats, rangeName: range });
      }
      if (req.method === 'GET' && url.pathname === '/api/board') {
        const cfg = board.loadConfig();
        const idx = Number(url.searchParams.get('board') || 0);
        const period = url.searchParams.get('period') || 'week';
        const b = cfg.boards && cfg.boards[idx];
        if (!b) return json(res, 200, { configured: false, rows: [] });
        const key = `${idx}:${period}`;
        const hit = boardCache.get(key);
        if (hit && Date.now() - hit.at < 60000) return json(res, 200, { configured: true, rows: hit.rows });
        const rows = await board.leaderboard(b, period);
        boardCache.set(key, { at: Date.now(), rows });
        return json(res, 200, { configured: true, rows });
      }
      if (req.method === 'POST' && url.pathname === '/api/sync') {
        await syncAll();
        return json(res, 200, { ok: !syncState.error, ...syncState });
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } catch (e) {
      json(res, 500, { error: e.message });
    }
  });

  let timer = null;
  server.on('listening', () => {
    syncAll().catch(() => {});
    timer = setInterval(() => syncAll().catch(() => {}), 10 * 60 * 1000);
    timer.unref();
  });
  server.on('close', () => clearInterval(timer));
  return server;
}

module.exports = { createServer, sinceFor };
