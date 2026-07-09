#!/usr/bin/env node
// Dev live-reload watcher for Alto Translate extension pages.
//
// Watches the options/onboarding/vocabulary page folders (plus a few shared
// CSS/JS files) and pushes reload events to any open extension page running
// utils/dev-reload.js via Server-Sent Events.
//
// No external dependencies — uses Node's built-in http and fs modules.
// Polling is used instead of fs.watch so atomic saves from editors (VSCode,
// vim, etc.) are caught reliably on macOS.
//
// Usage:  npm run dev

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8890;
const POLL_MS = 400;
const DEBOUNCE_MS = 150;

// Each rule watches a directory. `scope` decides which page(s) reload:
//   - a page name ("options" | "onboarding" | "vocabulary") → only that page
//   - "all" → every connected extension page
const RULES = [
  { dir: 'options', scope: 'options' },
  { dir: 'onboarding', scope: 'onboarding' },
  { dir: 'vocabulary', scope: 'vocabulary' },
  { dir: 'utils', scope: 'all', exts: ['.css', '.js'] },
  { dir: 'content', scope: 'all', exts: ['.css'] },
];

const PAGE_EXTS = /\.(html|css|js|mjs)$/i;

/** @type {Set<import('node:http').ServerResponse>} */
const clients = new Set();

const server = http.createServer((req, res) => {
  if (req.url === '/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(': connected\n\n');
    clients.add(res);
    const ping = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { /* client gone */ }
    }, 25000);
    req.on('close', () => {
      clearInterval(ping);
      clients.delete(res);
      const n = clients.size;
      console.log(`[dev] client disconnected (${n} connected)`);
    });
    console.log(`[dev] client connected (${clients.size} connected)`);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Alto Translate dev watcher alive.\n${clients.size} client(s) connected.\n`);
});

function broadcast(scope, file) {
  if (clients.size === 0) return;
  const payload = JSON.stringify({ scope, file, t: Date.now() });
  for (const res of clients) {
    try {
      res.write(`event: reload\ndata: ${payload}\n\n`);
    } catch { /* drop */ }
  }
}

function scopeFor(filePath) {
  const dir = path.basename(path.dirname(filePath));
  const rule = RULES.find((r) => r.dir === dir);
  return rule ? rule.scope : 'all';
}

async function scan() {
  /** @type {Map<string, number>} */
  const out = new Map();
  for (const rule of RULES) {
    const base = path.join(ROOT, rule.dir);
    let entries = [];
    try {
      entries = await fs.readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name);
      if (rule.exts) {
        if (!rule.exts.includes(ext)) continue;
      } else if (!PAGE_EXTS.test(ent.name)) {
        continue;
      }
      const full = path.join(base, ent.name);
      try {
        const st = await fs.stat(full);
        out.set(full, Math.floor(st.mtimeMs));
      } catch { /* transient */ }
    }
  }
  return out;
}

let prev = await scan();
let debounceTimer = null;
let pendingEvent = null;

async function tick() {
  const next = await scan();

  // changed or added files
  for (const [file, mtime] of next) {
    if (prev.get(file) !== mtime) {
      pendingEvent = { file, scope: scopeFor(file) };
      break;
    }
  }
  // deleted files
  if (!pendingEvent) {
    for (const file of prev.keys()) {
      if (!next.has(file)) {
        pendingEvent = { file, scope: scopeFor(file) };
        break;
      }
    }
  }

  prev = next;

  if (pendingEvent) {
    if (debounceTimer) clearTimeout(debounceTimer);
    const ev = pendingEvent;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      pendingEvent = null;
      const rel = path.relative(ROOT, ev.file);
      console.log(`[dev] ${rel} changed → reload ${ev.scope}`);
      broadcast(ev.scope, rel);
    }, DEBOUNCE_MS);
  }
}

setInterval(tick, POLL_MS);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n[dev] Alto Translate live-reload → http://localhost:${PORT}`);
  console.log('[dev] Watching:', RULES.map((r) => r.dir).join(', '));
  console.log('[dev] Open options/onboarding/vocabulary page(s) and edit.\n');
});
