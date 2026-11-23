'use strict';
// `ccwrapped statusline`: one line for Claude Code's status bar.
// Claude Code runs the command on every update and pipes session info as JSON to stdin.
// Speed matters, so it asks a running `ccwrapped serve` first and only falls back to
// reading today's log files itself (cached for a few seconds).
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { findLogFiles } = require('./find');
const { parseFiles } = require('./parse');
const { liveStats } = require('./live');
const board = require('./board');

const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const money = (n) => `$${n >= 100 || Number.isInteger(n) ? Math.round(n) : n.toFixed(2)}`;
const C = { dim: '\x1b[2m', y: '\x1b[33m', r: '\x1b[31m', g: '\x1b[32m', b: '\x1b[1m', x: '\x1b[0m' };

function readStdin(timeoutMs = 150) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve(null);
    let data = '';
    const done = () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : null);
      } catch {
        resolve(null);
      }
    };
    const t = setTimeout(() => {
      process.stdin.pause();
      done();
    }, timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => {
      clearTimeout(t);
      done();
    });
  });
}

function fromServer(port = 4747) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/live', headers: { Host: 'localhost' }, timeout: 250 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          resolve(res.statusCode === 200 ? JSON.parse(body) : null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function fromLogs(budget) {
  const cacheFile = path.join(board.CONFIG_FILE, '..', 'statusline-cache.json');
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const files = findLogFiles().files.filter((f) => {
    try {
      return fs.statSync(f).mtimeMs >= midnight.getTime();
    } catch {
      return false;
    }
  });
  const sig = files.map((f) => `${f}:${fs.statSync(f).size}`).join('|') + `|${midnight.getTime()}|${JSON.stringify(budget || {})}`;
  try {
    const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (c.sig === sig) return c.live;
  } catch {
    /* no cache yet */
  }
  const { events } = await parseFiles(files);
  const live = liveStats(events, Date.now(), budget);
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ sig, live }));
  } catch {
    /* read-only home, fine */
  }
  return live;
}

function render(live, session) {
  const parts = [];
  if (session && session.model && session.model.display_name) parts.push(`${C.b}${session.model.display_name}${C.x}`);
  const dir = session && session.workspace && (session.workspace.current_dir || session.workspace.project_dir);
  if (dir) parts.push(`${C.dim}${path.basename(dir)}${C.x}`);
  if (!live) {
    parts.push(`${C.dim}ccwrapped: no data yet${C.x}`);
    return parts.join(' │ ');
  }
  const b = live.budget;
  const color = b && b.over ? C.r : b && b.warn ? C.y : C.y;
  parts.push(`🔥 ${color}${compact(live.today.tokens)}${C.x} today`);
  parts.push(`${money(live.today.cost)}`);
  if (live.tokensPerMinute > 0) parts.push(`${C.dim}~${compact(live.tokensPerMinute)}/min${C.x}`);
  if (b) {
    const pctUsed = Math.round(b.ratio * 100);
    const limit = b.kind === 'usd' ? money(b.limit) : compact(b.limit);
    parts.push(b.over ? `${C.r}⚠ ${pctUsed}% of ${limit} budget${C.x}` : `${b.warn ? C.y : C.g}${pctUsed}% of ${limit}${C.x}`);
  }
  return parts.join(' │ ');
}

async function statusline() {
  const session = await readStdin();
  const cfg = board.loadConfig();
  let live = await fromServer(cfg.port || 4747);
  if (!live) live = await fromLogs(cfg.budget);
  else if (cfg.budget && !live.budget) live.budget = require('./live').budgetStatus(live, cfg.budget);
  process.stdout.write(render(live, session) + '\n');
}

/** Adds the status line to ~/.claude/settings.json without touching anything else. */
function installStatusline({ force = false, command } = {}) {
  const dir = process.env.CLAUDE_CONFIG_DIR ? process.env.CLAUDE_CONFIG_DIR.split(path.delimiter)[0] : path.join(os.homedir(), '.claude');
  const file = path.join(dir, 'settings.json');
  let settings = {};
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, 'utf8');
    try {
      settings = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      throw new Error(`${file} isn't valid JSON, so I didn't touch it. Fix it or add the status line by hand.`);
    }
    if (settings.statusLine && !force) {
      return { file, changed: false, existing: settings.statusLine };
    }
    fs.copyFileSync(file, file + '.ccwrapped-backup');
  }
  settings.statusLine = { type: 'command', command, padding: 0 };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return { file, changed: true };
}

module.exports = { statusline, render, installStatusline };
