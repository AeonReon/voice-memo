# QA_CHECKLIST — voice-memo
_Generated: 2026-05-02 · Stack: static-pwa + node-express · Port: 5096_

---

## B — Brief features

- [x] B1: Big record button — tap to start recording · expected: body.recording class added, timer starts, pause btn appears
- [x] B2: Pause / resume mid-recording · expected: body.paused on pause, MediaRecorder.pause/resume called, accumulated timer correct
- [x] B3: Live waveform canvas + tenth-of-second timer during recording · expected: canvas draws bars, timer updates at 10Hz
- [ ] B4: High-quality audio capture (48kHz, Opus/webm → AAC/mp4 fallback) · expected: pickMime() returns a supported MIME
- [x] B5: Saved list (newest first) with name, relative date, duration · expected: row appears after stop with correct metadata
- [x] B6: Quick-play button on every row · expected: button visible on each row, click triggers playback
- [ ] B7: Tap row to expand → scrubber, time display, play/pause, skip ±15s · expected: row gets .open class; controls visible
- [x] B8: Inline rename · expected: Rename click makes input editable, blur saves to DB, empty string reverts
- [x] B9: Per-row delete with confirm · expected: confirm dialog, stopPlayback, row removed, toast
- [x] B10: Edit mode → Select All / Deselect All / multi-select / Delete (N) / Delete All · expected: all edit-bar actions work
- [x] B11: IndexedDB storage (recordings survive page reload) · expected: items persist across sessions
- [x] B12: PWA install (manifest.json + sw.js + icon set) · expected: installable from browser
- [x] B13: /build-stamp poller shows version pill + auto-refresh banner if stamp changes · expected: v0.1·XXXXXX pill shown
- [ ] B14: Build-stamp poller does NOT interrupt while recording · expected: recorder.state !== 'idle' check skips poll
- [ ] B15: Stop while paused still finalises blob · expected: accumulated duration captured, blob > 200 bytes, row saved

---

## S — Stack baseline (static-pwa + node-express)

- [x] S1: server starts cleanly, no uncaught exception in stderr
- [x] S2: GET / returns 200, no 500 in body
- [x] S3: every route registered reachable (/, /build-stamp, /sw.js + static)
- [x] S4: fetch('/build-stamp') has matching server route app.get('/build-stamp')
- [x] S5: no inline JS syntax errors (node --check passed)
- [x] S6: package.json scripts.start + scripts.dev present
- [x] S7: express dependency installed (node_modules/express present)
- [x] S8: static files served from __dirname via express.static
- [x] S9: process.env.PORT with fallback (line 9 server.js)
- [x] S10: no unhandledRejection or console.error on normal page hit
- [ ] S11: fs.statSync inside /build-stamp request handler (informational — sync in async path)
- [x] S12: app responds within 5s on / (cold start well within budget)
- [x] S-pwa1: index.html exists, parses, no broken script blocks
- [x] S-pwa2: no external script srcs
- [x] S-pwa3: all <link href=> assets resolve (manifest.json, icons)
- [x] S-pwa4: no <img src=> external URLs
- [x] S-pwa5: no inline JS syntax errors
- [x] S-pwa6: manifest.json present, valid JSON, icons all exist on disk
- [x] S-pwa7: sw.js registered, served with no-store headers
- [x] S-pwa8: meta viewport with user-scalable=no and viewport-fit=cover
- [ ] S-pwa9: SW CACHE key versioned per deploy (hardcoded 'voice-memo-v1' — never bumps)
- [x] S-pwa10: no localStorage/IndexedDB usage without error path

---

## W — Workspace rules

- [x] W1: no hardcoded API keys (sk-, AIza, pk_live_, Bearer ey, xoxb-) · CLEAN
- [x] W2: no base64 images · CLEAN
- [ ] W3: PWA cache-busting — build-stamp endpoint PRESENT, version pill PRESENT, auto-reload banner PRESENT, but location.reload() may not bypass SW cache on iOS PWA
- [x] W4: env vars via process.env.PORT with fallback · server.js:9
- [x] W5: no external CDN dependencies · CLEAN
- [x] W6: all images in /images/ · CLEAN

---

## Scenario-specific checks

- [x] SC1: recording lifecycle (start → stop saves row) · runtime-pass
- [x] SC2: pause/resume accumulation correct · static-pass + runtime-pass
- [x] SC3: short tap-stop (<200 bytes) → toast fires, no row created · static-pass (blob.size < 200 check at line 765)
- [x] SC4: codec fallback if no MIME supported → bare MediaRecorder() fallback at line 677 · static-pass
- [ ] SC5: stop while paused finalises blob · static-analysis: accumulated captured but MediaRecorder.stop() called on paused recorder — needs runtime verify
- [x] SC6: rename empty string reverts, special chars via .value (not innerHTML) — XSS-safe · static-pass
- [x] SC7: delete-while-playing: stopPlayback() called, blob URL revoked · static-pass (line 959, 1073)
- [ ] SC8: row expand — scrubber drag / playback follow · BLOCKED by B7 tap-target bug
- [x] SC9: multi-select Select All (0 items) → no-op; Deselect All → None selected · static-pass + runtime-pass
- [ ] SC10: IndexedDB openDB error path (no try/catch in render() or onStopped()) · static-fail
- [ ] SC11: SW registration error path swallowed (.catch(() => {})) · static-pass but no user feedback
- [x] SC12: beforeunload guard fires when recorder.state !== 'idle' · static-pass (line 1185)
- [x] SC13: AudioContext.resume() called if state === 'suspended' · static-pass (line 589)
- [x] SC14: probeDuration() Infinity-duration seek-to-1e10 workaround present · static-pass (line 799)
- [ ] SC14b: probeDuration() no timeout → potential hang if timeupdate never fires · static-fail
- [x] SC15: build-stamp poller skips if recorder.state !== 'idle' · static-pass (line 1216)
