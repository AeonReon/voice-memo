#!/usr/bin/env node
// Vercel build step — replaces the __CACHE_VERSION__ token inside sw.js
// with the current commit SHA so the service worker rolls its cache name
// on every deploy. Run automatically by Vercel via `npm run vercel-build`.
// For local dev, server.js does the same substitution at request time.

const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', 'sw.js');
const stamp =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  String(Date.now());

const src = fs.readFileSync(SW_PATH, 'utf8');
const out = src.replace(/__CACHE_VERSION__/g, stamp);
fs.writeFileSync(SW_PATH, out);
console.log(`sw.js cache version → ${stamp}`);
