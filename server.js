// Voice Memo — tiny static server with no-cache + build-stamp endpoint
// Serves the PWA. All audio data lives in IndexedDB on the device — the
// server holds no user content and has no API.

const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = parseInt(process.env.PORT, 10) || 5096;
const ROOT = __dirname;
const INDEX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

// Files that must NEVER be served by the static handler — keep source code
// and config off the public surface. The static handler is .use'd last, so
// these explicit denies short-circuit before it.
const DENY = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
  '/project.txt',
  '/QA_CHECKLIST.md',
  '/BUG_REPORT.md',
  '/.env',
  '/.gitignore',
]);

const app = express();

app.use((req, res, next) => {
  if (DENY.has(req.path) || req.path.startsWith('/scripts/') || req.path.startsWith('/node_modules/') || req.path.startsWith('/.qa-')) {
    return res.status(404).send('Not found');
  }
  next();
});

// no-store on the entry doc so iOS PWA picks up new builds reliably
app.get('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(INDEX);
});

// build-stamp drives the auto-reload banner
app.get('/build-stamp', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const stamp = Math.floor(fs.statSync(INDEX).mtimeMs);
    res.json({ stamp });
  } catch (e) {
    res.status(500).json({ stamp: 0, error: e.message });
  }
});

// Serve sw.js with no-store, and rewrite the __CACHE_VERSION__ token so the
// SW's internal cache name rolls over on every deploy. This is what keeps
// stale shells from sticking around on iOS PWAs.
app.get('/sw.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  try {
    const stamp = Math.floor(fs.statSync(SW).mtimeMs);
    const body = fs.readFileSync(SW, 'utf8').replace(/__CACHE_VERSION__/g, String(stamp));
    res.send(body);
  } catch (e) {
    res.status(500).send('// sw read error: ' + e.message);
  }
});

app.use(express.static(ROOT, {
  setHeaders: (res, filePath) => {
    // Long-cache the icon set + manifest (they're versioned by name)
    if (/\.(png|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
}));

app.listen(PORT, () => {
  console.log(`voice-memo listening on http://localhost:${PORT}`);
});
