#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const { findLogFiles } = require('../src/find');
const { parseFiles } = require('../src/parse');
const { computeStats } = require('../src/stats');
const { renderHtml } = require('../src/render');
const { demoEvents } = require('../src/demo');
const board = require('../src/board');
const pkg = require('../package.json');

const HELP = `
ccwrapped ${pkg.version}
Your year with Claude Code, wrapped. Runs 100% locally.

Usage
  npx ccwrapped [options]                 Build your Wrapped report
  npx ccwrapped serve [--port 4747]       Live dashboard on localhost
  npx ccwrapped widget                    Small always-there live token counter
  npx ccwrapped board <command>           Friends leaderboard (see below)
  npx ccwrapped sync                      Upload your daily totals to your boards
  npx ccwrapped leaderboard [--period week]

Report options
  --year <yyyy>     Year to wrap (default: current year)
  --all             Use all your history instead of one year
  --name <name>     Put your name on the report ("Paul's 2026 ...")
  --lang <en|de>    Report language (default: en)
  --anonymize       Hide project names (project-1, project-2, ...)
  --out <file>      Where to write the HTML (default: ./claude-wrapped-<year>.html)
  --json            Print the raw stats as JSON instead of writing HTML

Common options
  --dir <path>      Extra folder with Claude Code logs (*.jsonl)
  --demo            Use generated sample data (nothing of yours is read)
  --no-open         Don't open anything in your browser
  -h, --help        Show this help
  -v, --version     Show version

Leaderboard (runs on your own Supabase project, see supabase/schema.sql)
  board create --name "Night Shift" --me Paul --url <supabase url> --key <publishable key>
  board join <invite> --me Lena
  board invite              Print the invite for your board(s)
  board list                Show the boards you're on
  board leave [--board 0]   Leave a board and delete your data on it
  leaderboard [--period today|week|month|year|all] [--board 0]
`;

const VALUE_FLAGS = new Set(['--year', '--name', '--lang', '--out', '--dir', '--port', '--url', '--key', '--me', '--period', '--board']);

function parseArgs(argv) {
  const o = { open: true, _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (VALUE_FLAGS.has(a)) {
      const v = argv[++i];
      if (v === undefined) fail(`Missing value for ${a}`);
      o[a.slice(2)] = v;
    } else if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-v' || a === '--version') o.version = true;
    else if (a === '--all') o.all = true;
    else if (a === '--anonymize') o.anonymize = true;
    else if (a === '--json') o.json = true;
    else if (a === '--demo') o.demo = true;
    else if (a === '--no-open') o.open = false;
    else if (a.startsWith('-')) fail(`Unknown option: ${a}. Run with --help to see all options.`);
    else o._.push(a);
  }
  if (o.year !== undefined) {
    o.year = Number(o.year);
    if (!(o.year > 2000 && o.year < 3000)) fail('--year needs a four-digit year, e.g. --year 2026');
  }
  return o;
}

function fail(msg) {
  process.stderr.write(`\x1b[31m✖\x1b[0m ${msg}\n`);
  process.exit(1);
}

function openUrl(target) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', target] : [target];
  try {
    const p = spawn(cmd, args, { stdio: 'ignore', detached: true });
    p.on('error', () => {});
    p.unref();
  } catch {
    /* no browser, the URL is printed anyway */
  }
}

/** Opens a URL as a small chromeless app window (Chrome / Edge / Chromium), else a normal tab. */
function openAppWindow(url) {
  const flags = [`--app=${url}`, '--window-size=380,300'];
  const tries =
    process.platform === 'darwin'
      ? [['open', ['-na', 'Google Chrome', '--args', ...flags]], ['open', ['-na', 'Microsoft Edge', '--args', ...flags]], ['open', ['-na', 'Chromium', '--args', ...flags]]]
      : process.platform === 'win32'
        ? [['cmd', ['/c', 'start', '', 'msedge', ...flags]], ['cmd', ['/c', 'start', '', 'chrome', ...flags]]]
        : [['google-chrome', flags], ['chromium', flags], ['chromium-browser', flags], ['microsoft-edge', flags]];
  const attempt = (i) => {
    if (i >= tries.length) return openUrl(url);
    const [cmd, args] = tries[i];
    let moved = false;
    const next = () => {
      if (moved) return;
      moved = true;
      attempt(i + 1);
    };
    const p = spawn(cmd, args, { stdio: 'ignore', detached: true });
    p.on('error', next);
    p.on('exit', (code) => {
      if (code) next();
    });
    p.unref();
  };
  attempt(0);
}

const c = {
  b: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  bl: (s) => `\x1b[34m${s}\x1b[0m`,
  g: (s) => `\x1b[32m${s}\x1b[0m`,
};
const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const int = (n) => new Intl.NumberFormat('en-US').format(Math.round(n));

async function loadEvents(o, year) {
  if (o.demo) return demoEvents(year || new Date().getFullYear());
  const { roots, files } = findLogFiles(o.dir);
  if (!files.length) {
    fail(
      'No Claude Code logs found.\n  Looked in: ' +
        (roots.length ? roots.join(', ') : '~/.claude/projects, ~/.config/claude/projects') +
        '\n  Try --dir <path>, or run with --demo to see a sample report.'
    );
  }
  const tty = process.stderr.isTTY;
  const parsed = await parseFiles(files, (done, total) => {
    if (tty && (done % 25 === 0 || done === total)) process.stderr.write(`\r  Reading logs… ${done}/${total}`);
  });
  if (tty) process.stderr.write('\r\x1b[K');
  return parsed.events;
}

function printSummary(s, label) {
  const line = (k, v) => console.log(`  ${c.dim(k.padEnd(18))} ${v}`);
  console.log('');
  console.log(c.b(c.bl(`  Claude Code Wrapped · ${label}`)));
  console.log('');
  line('Tokens', c.y(c.b(compact(s.totals.tokens))));
  line('Active hours', int(s.activeHours));
  line('Active days', `${int(s.activeDays)}  (longest streak ${s.longestStreak})`);
  line('Sessions', int(s.sessions));
  line('Prompts', int(s.totals.prompts));
  if (s.favoriteModel) line('Top model', s.favoriteModel);
  if (s.projects[0]) line('Top project', s.projects[0].name);
  line('Est. API value', `$${int(s.totals.cost)}`);
  console.log('');
}

// ---------- commands ----------

async function cmdReport(o) {
  const year = o.all ? null : o.year || new Date().getFullYear();
  const events = await loadEvents(o, year);
  const stats = computeStats(events, { year });
  if (o.json) return console.log(JSON.stringify(stats, null, 2));
  const label = year == null ? 'all time' : String(year);
  if (stats.empty) console.log(`\n  No Claude Code activity in ${label}. Try --all or another --year.\n`);
  else printSummary(stats, label);

  const meta = { lang: o.lang === 'de' ? 'de' : 'en', name: o.name || null, anonymize: !!o.anonymize, demo: !!o.demo, version: pkg.version };
  const out = path.resolve(o.out || `claude-wrapped-${year == null ? 'all-time' : year}${o.demo ? '-demo' : ''}.html`);
  fs.writeFileSync(out, renderHtml(stats, meta));
  const shown = out.startsWith(os.homedir()) ? '~' + out.slice(os.homedir().length) : out;
  console.log(`  ${c.g('✔')} Report saved to ${c.b(shown)}`);
  console.log(c.dim('    Everything was computed on your machine. Nothing was uploaded.'));
  console.log(c.dim('    Want it live? Run: npx ccwrapped serve\n'));
  if (o.open) openUrl(out);
}

function isOurServer(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/meta', headers: { Host: 'localhost' }, timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function cmdServe(o, { widget = false } = {}) {
  const { createServer } = require('../src/server');
  const port = Number(o.port || 4747);
  const base = `http://localhost:${port}`;
  const target = widget ? `${base}/widget` : base;
  const go = () => {
    if (!o.open) return;
    if (widget) openAppWindow(target);
    else openUrl(target);
  };
  const server = createServer({ dir: o.dir, demo: !!o.demo, lang: o.lang, name: o.name });
  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE' && (await isOurServer(port))) {
      console.log(`  ccwrapped is already running at ${c.b(base)}. Opening it.`);
      go();
      return;
    }
    fail(err.code === 'EADDRINUSE' ? `Port ${port} is in use. Try --port 4848.` : err.message);
  });
  server.listen(port, '127.0.0.1', () => {
    console.log('');
    console.log(c.b(c.bl('  ccwrapped is live')));
    console.log(`  Dashboard  ${c.b(base)}`);
    console.log(`  Widget     ${c.b(base + '/widget')}`);
    console.log(`  Wrapped    ${c.b(base + '/wrapped')}`);
    console.log(c.dim('\n  Only reachable from this computer. Press Ctrl+C to stop.\n'));
    go();
  });
}

function requireBoards() {
  const cfg = board.loadConfig();
  if (!cfg.boards || !cfg.boards.length) fail('You are not on a board yet. Create one with `ccwrapped board create` or join with `ccwrapped board join <invite>`.');
  return cfg;
}

function pickBoard(cfg, o) {
  const i = Number(o.board || 0);
  const b = cfg.boards[i];
  if (!b) fail(`No board #${i}. Run \`ccwrapped board list\`.`);
  return { b, i };
}

function addBoard(newBoard) {
  const cfg = board.loadConfig();
  cfg.boards = (cfg.boards || []).filter((x) => !(x.url === newBoard.url && x.code === newBoard.code));
  cfg.boards.push(newBoard);
  board.saveConfig(cfg);
}

async function syncAfterJoin(o, b) {
  try {
    const events = await loadEvents(o, null);
    const n = await board.syncBoard(b, events);
    console.log(`  ${c.g('✔')} Uploaded ${n} days of totals.`);
  } catch (e) {
    console.log(c.dim(`  Couldn't sync yet: ${e.message}`));
  }
}

async function cmdBoard(o) {
  const sub = o._[1];
  if (sub === 'create') {
    const { board: b, invite } = await board.createBoard({ url: o.url, key: o.key, name: o.name, me: o.me }).catch((e) => fail(e.message));
    addBoard(b);
    console.log(`\n  ${c.g('✔')} Board ${c.b(b.boardName)} created. You're on it as ${c.b(b.me)}.`);
    console.log('\n  Send this to your friends:\n');
    console.log(`    ${c.y(`npx ccwrapped board join ${invite} --me <their name>`)}\n`);
    await syncAfterJoin(o, b);
    console.log(c.dim('  Your totals sync every 10 minutes while `ccwrapped serve` runs, or run `ccwrapped sync`.\n'));
    return;
  }
  if (sub === 'join') {
    const invite = o._[2];
    if (!invite) fail('Paste the invite you got: ccwrapped board join ccw1.xxxx --me <name>');
    const { board: b } = await board.joinBoard(invite, o.me).catch((e) => fail(e.message));
    addBoard(b);
    console.log(`\n  ${c.g('✔')} You joined ${c.b(b.boardName)} as ${c.b(b.me)}.`);
    await syncAfterJoin(o, b);
    console.log(c.dim('  See the ranking with `ccwrapped leaderboard` or in `ccwrapped serve`.\n'));
    return;
  }
  if (sub === 'invite' || sub === 'list') {
    const cfg = requireBoards();
    console.log('');
    cfg.boards.forEach((b, i) => {
      console.log(`  ${c.dim('#' + i)} ${c.b(b.boardName)} as ${b.me}${b.owner ? c.dim(' (owner)') : ''}`);
      console.log(`     ${c.y(`npx ccwrapped board join ${board.makeInvite(b.url, b.key, b.code)} --me <name>`)}`);
    });
    console.log('');
    return;
  }
  if (sub === 'leave') {
    const cfg = requireBoards();
    const { b, i } = pickBoard(cfg, o);
    await board.leaveBoard(b).catch((e) => fail(e.message));
    cfg.boards.splice(i, 1);
    board.saveConfig(cfg);
    console.log(`  ${c.g('✔')} You left ${b.boardName}. Your data on it was deleted.`);
    return;
  }
  fail('Unknown board command. Use: create, join, invite, list or leave. See --help.');
}

async function cmdSync(o) {
  const cfg = requireBoards();
  const events = await loadEvents(o, null);
  for (const b of cfg.boards) {
    try {
      const n = await board.syncBoard(b, events);
      console.log(`  ${c.g('✔')} ${b.boardName}: uploaded ${n} days`);
    } catch (e) {
      console.log(`  \x1b[31m✖\x1b[0m ${b.boardName}: ${e.message}`);
    }
  }
}

async function cmdLeaderboard(o) {
  const cfg = requireBoards();
  const { b } = pickBoard(cfg, o);
  const period = o.period || 'week';
  const rows = await board.leaderboard(b, period).catch((e) => fail(e.message));
  console.log(`\n  ${c.b(b.boardName)} ${c.dim('· ' + period)}\n`);
  const max = Math.max(...rows.map((r) => r.tokens), 1);
  for (const r of rows) {
    const bar = '█'.repeat(Math.max(1, Math.round((r.tokens / max) * 24)));
    const name = r.me ? c.y(c.b(r.name.padEnd(14))) : r.name.padEnd(14);
    console.log(`  ${String(r.rank).padStart(2)}  ${name} ${c.bl(bar)} ${c.b(compact(r.tokens))} ${c.dim(r.topModel || '')}`);
  }
  console.log('');
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.version) return console.log(pkg.version);
  if (o.help) return console.log(HELP);
  const cmd = o._[0];
  if (!cmd || cmd === 'wrap') return cmdReport(o);
  if (cmd === 'serve' || cmd === 'dashboard') return cmdServe(o);
  if (cmd === 'widget') return cmdServe(o, { widget: true });
  if (cmd === 'board') return cmdBoard(o);
  if (cmd === 'sync') return cmdSync(o);
  if (cmd === 'leaderboard' || cmd === 'lb') return cmdLeaderboard(o);
  fail(`Unknown command: ${cmd}. Run with --help.`);
}

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
