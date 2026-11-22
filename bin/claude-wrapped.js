#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { findLogFiles } = require('../src/find');
const { parseFiles } = require('../src/parse');
const { computeStats } = require('../src/stats');
const { renderHtml } = require('../src/render');
const { demoEvents } = require('../src/demo');
const pkg = require('../package.json');

const HELP = `
ccwrapped ${pkg.version}
Your year with Claude Code, wrapped. Runs 100% locally.

Usage
  npx ccwrapped [options]

Options
  --year <yyyy>     Year to wrap (default: current year)
  --all             Use all your history instead of one year
  --name <name>     Put your name on the report ("Paul's 2026 ...")
  --lang <en|de>    Report language (default: from your system, else en)
  --anonymize       Hide project names (project-1, project-2, ...)
  --out <file>      Where to write the HTML (default: ./claude-wrapped-<year>.html)
  --dir <path>      Extra folder with Claude Code logs (*.jsonl)
  --json            Print the raw stats as JSON instead of writing HTML
  --demo            Use generated sample data (nothing of yours is read)
  --no-open         Don't open the report in your browser
  -h, --help        Show this help
  -v, --version     Show version
`;

function parseArgs(argv) {
  const o = { open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) fail(`Missing value for ${a}`);
      return v;
    };
    if (a === '-h' || a === '--help') o.help = true;
    else if (a === '-v' || a === '--version') o.version = true;
    else if (a === '--year') o.year = Number(next());
    else if (a === '--all') o.all = true;
    else if (a === '--name') o.name = next();
    else if (a === '--lang') o.lang = next();
    else if (a === '--anonymize') o.anonymize = true;
    else if (a === '--out') o.out = next();
    else if (a === '--dir') o.dir = next();
    else if (a === '--json') o.json = true;
    else if (a === '--demo') o.demo = true;
    else if (a === '--no-open') o.open = false;
    else fail(`Unknown option: ${a}. Run with --help to see all options.`);
  }
  if (o.year !== undefined && !(o.year > 2000 && o.year < 3000)) fail('--year needs a four-digit year, e.g. --year 2026');
  return o;
}

function fail(msg) {
  process.stderr.write(`\x1b[31m✖\x1b[0m ${msg}\n`);
  process.exit(1);
}

function systemLang() {
  const l = (process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || '').toLowerCase();
  return l.startsWith('de') ? 'de' : 'en';
}

function openFile(file) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', file] : [file];
  try {
    const p = spawn(cmd, args, { stdio: 'ignore', detached: true });
    p.on('error', () => {});
    p.unref();
  } catch {
    /* no browser available, the path is printed anyway */
  }
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

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) return console.log(HELP);
  if (o.version) return console.log(pkg.version);

  const year = o.all ? null : o.year || new Date().getFullYear();
  let events;
  if (o.demo) {
    events = demoEvents(year || new Date().getFullYear());
  } else {
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
    events = parsed.events;
  }

  const stats = computeStats(events, { year });
  if (o.json) return console.log(JSON.stringify(stats, null, 2));

  const label = year == null ? 'all time' : String(year);
  if (stats.empty) {
    console.log(`\n  No Claude Code activity in ${label}. Try --all or another --year.\n`);
  } else {
    printSummary(stats, label);
  }

  const meta = { lang: o.lang === 'de' || o.lang === 'en' ? o.lang : systemLang(), name: o.name || null, anonymize: !!o.anonymize, demo: !!o.demo, version: pkg.version };
  const out = path.resolve(o.out || `claude-wrapped-${year == null ? 'all-time' : year}${o.demo ? '-demo' : ''}.html`);
  fs.writeFileSync(out, renderHtml(stats, meta));
  const shown = out.startsWith(os.homedir()) ? '~' + out.slice(os.homedir().length) : out;
  console.log(`  ${c.g('✔')} Report saved to ${c.b(shown)}`);
  console.log(c.dim('    Everything was computed on your machine. Nothing was uploaded.\n'));
  if (o.open) openFile(out);
}

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
