'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Directories where Claude Code keeps its per-project session logs. */
function candidateRoots(extra) {
  const home = os.homedir();
  const roots = [];
  if (extra) roots.push(path.resolve(extra));
  if (process.env.CLAUDE_CONFIG_DIR) {
    for (const p of process.env.CLAUDE_CONFIG_DIR.split(path.delimiter)) {
      if (p) roots.push(path.join(p, 'projects'));
    }
  }
  roots.push(path.join(home, '.claude', 'projects'));
  roots.push(path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'claude', 'projects'));
  return [...new Set(roots)];
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(full);
  }
}

/** Returns { roots: string[] (existing), files: string[] } */
function findLogFiles(extraDir) {
  const roots = candidateRoots(extraDir).filter((r) => {
    try {
      return fs.statSync(r).isDirectory();
    } catch {
      return false;
    }
  });
  const files = [];
  for (const r of roots) walk(r, files);
  return { roots, files };
}

module.exports = { findLogFiles, candidateRoots };
