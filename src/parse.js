'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);
const ABSOLUTELY_RIGHT = /you'?re absolutely right/gi;

function projectName(cwd, file) {
  if (cwd) return path.basename(cwd.replace(/[\\/]+$/, '')) || cwd;
  // Fallback: folder name like "-Users-paul-code-my-app"
  const folder = path.basename(path.dirname(file));
  const parts = folder.split('-').filter(Boolean);
  return parts[parts.length - 1] || folder;
}

function countLines(s) {
  if (typeof s !== 'string' || !s) return 0;
  return s.split('\n').length;
}

function isRealPrompt(rec) {
  if (rec.type !== 'user' || rec.isMeta) return false;
  const msg = rec.message;
  if (!msg || msg.role !== 'user') return false;
  const c = msg.content;
  if (typeof c === 'string') {
    const t = c.trim();
    // Skip slash-command scaffolding and local command output
    return t.length > 0 && !t.startsWith('<local-command') && !t.startsWith('<command-');
  }
  if (Array.isArray(c)) return c.some((p) => p && p.type === 'text' && p.text && p.text.trim());
  return false;
}

/**
 * Creates a collector that turns raw JSONL records into normalised events,
 * de-duplicating streamed assistant chunks and history copied by resumed sessions.
 */
function createCollector() {
  const assistants = new Map(); // key -> event
  const prompts = new Map(); // uuid -> event
  const toolIds = new Set();

  function add(rec, file) {
    if (!rec || typeof rec !== 'object' || !rec.timestamp) return;
    const ts = Date.parse(rec.timestamp);
    if (Number.isNaN(ts)) return;
    const base = {
      ts,
      session: rec.sessionId || path.basename(file, '.jsonl'),
      project: projectName(rec.cwd, file),
      branch: rec.gitBranch || null,
      sidechain: !!rec.isSidechain,
    };

    if (isRealPrompt(rec)) {
      const key = rec.uuid || `${base.session}:${ts}`;
      if (!prompts.has(key)) prompts.set(key, { ...base, kind: 'prompt', planMode: rec.permissionMode === 'plan' });
      return;
    }

    if (rec.type !== 'assistant' || !rec.message) return;
    const msg = rec.message;
    const model = msg.model;
    if (!model || model === '<synthetic>') return;
    const key = `${msg.id || rec.uuid}:${rec.requestId || ''}`;
    let ev = assistants.get(key);
    if (!ev) {
      ev = {
        ...base,
        kind: 'assistant',
        model,
        input: 0,
        output: 0,
        cacheWrite: 0,
        cacheRead: 0,
        tools: [],
        files: [],
        linesWritten: 0,
        absolutelyRight: 0,
      };
      assistants.set(key, ev);
    }
    const u = msg.usage || {};
    ev.input = Math.max(ev.input, u.input_tokens || 0);
    ev.output = Math.max(ev.output, u.output_tokens || 0);
    ev.cacheWrite = Math.max(ev.cacheWrite, u.cache_creation_input_tokens || 0);
    ev.cacheRead = Math.max(ev.cacheRead, u.cache_read_input_tokens || 0);

    const content = Array.isArray(msg.content) ? msg.content : [];
    for (const part of content) {
      if (!part) continue;
      if (part.type === 'tool_use') {
        const id = part.id || `${key}:${part.name}:${ev.tools.length}`;
        if (toolIds.has(id)) continue;
        toolIds.add(id);
        ev.tools.push(part.name);
        const inp = part.input || {};
        if (EDIT_TOOLS.has(part.name)) {
          const fp = inp.file_path || inp.notebook_path;
          if (fp) ev.files.push(fp);
          if (part.name === 'Write') ev.linesWritten += countLines(inp.content);
          else if (part.name === 'Edit') ev.linesWritten += countLines(inp.new_string);
          else if (part.name === 'MultiEdit' && Array.isArray(inp.edits)) {
            for (const e of inp.edits) ev.linesWritten += countLines(e && e.new_string);
          } else if (part.name === 'NotebookEdit') ev.linesWritten += countLines(inp.new_source);
        }
      } else if (part.type === 'text' && typeof part.text === 'string') {
        const m = part.text.match(ABSOLUTELY_RIGHT);
        if (m) ev.absolutelyRight = Math.max(ev.absolutelyRight, m.length);
      }
    }
  }

  function events() {
    return [...prompts.values(), ...assistants.values()].sort((a, b) => a.ts - b.ts);
  }

  return { add, events };
}

async function parseFiles(files, onProgress) {
  const collector = createCollector();
  let done = 0;
  let badLines = 0;
  for (const file of files) {
    const stream = fs.createReadStream(file, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line || line[0] !== '{') continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        badLines++;
        continue;
      }
      collector.add(rec, file);
    }
    done++;
    if (onProgress) onProgress(done, files.length);
  }
  return { events: collector.events(), badLines };
}

module.exports = { createCollector, parseFiles, projectName };
