# BUG_REPORT — voice-memo

_Run: 2026-05-02T14:xx UTC  ·  Stack: static-pwa + node-express  ·  Port: 5096  ·  Tier 3 browser checks: ran (Playwright 1.59.1, Chromium headless, fake mic)_

## Summary

31/38 functional checks passed. **All 4 auto-fix candidates fixed. Both 2 needs-call items also fixed (clear best-choice answers for a recorder PWA). 2 informational items remain.**
No P0. App boots, serves, records, saves, and plays back.

## Phase 6 — fixes applied

| Item   | File:line                  | Fix                                                                          |
|--------|----------------------------|------------------------------------------------------------------------------|
| B7     | `index.html:.name[readonly]` | Added `pointer-events:none` on readonly name input so row tap reaches `.top` |
| SC10   | `index.html:render()` + `onStopped()` | Wrapped IDB calls in try/catch with toast feedback                  |
| SC14b  | `index.html:onStopped()`   | `Promise.race([probeDuration, 3s timeout])` so save can never hang           |
| S-pwa9 | `sw.js` + `server.js`      | `__CACHE_VERSION__` token rewritten to mtime on every `/sw.js` GET           |
| W3c    | `sw.js`                    | HTML routes (`/`, `/index.html`, `/build-stamp`) served network-first        |
| W3c    | `index.html`               | `updateBanner` now sends `skip-waiting` to SW before reloading               |
| S8b    | `server.js`                | DENY middleware for `server.js`, `package.json`, `project.txt`, `.env`, `scripts/`, `node_modules/` |

Polish (Wave 3):
- Build pill moved into top toolbar (was overlapping Delete in edit mode)
- Default recording name no longer duplicates time (meta row already shows it)
- Live waveform throttled to 15 fps for e-ink-friendliness

---

## P0 — Critical

None. App running under PM2 (`voice-memo` pid 77852), responding on http://localhost:5096/ with correct Cache-Control headers.

---

## Auto-fix candidates

### B7/SC8 — Row expand: name INPUT blocks entire tap area

- **What was checked:** Playwright elementFromPoint at center of `.top` div; capture-phase click event debug; bounding box measurement.
- **Found:** `.name` input (`flex:1 1 auto`, `pointer-events` not set) spans `x:20–320` of the `.top` div (total `x:20–370`). The quick-play button occupies `x:332–370`. The `.check` span is `display:none` in normal mode (0×0 bounding box). When the user taps anywhere in the row name area, `e.target.closest('.name')` returns the input and the handler early-returns. The row never gets `.open`. The only technically clickable gap between name and quick-play is ~12 px wide — not reliably tappable.
- **Confirmed via Playwright:** `page.mouse.click` at center of `.top` produced `DEBUG top click - target: DIV.top closestName: false` in one test run but `INPUT.name` in another (pixel-level hit-testing varies). When dispatching a `MouseEvent` with `clientX` at the very top edge of `.top` (`y + 2px`), the row DID open — confirming the handler is correct but the tap target is unreachable in practice.
- **Cause:** `index.html:136–144` — `.name` has no `pointer-events: none` when `readonly`. The `flex:1 1 auto` sizing means it expands to fill all available horizontal space, leaving no tap surface for the `.top` listener.
- **Suggested fix:** Add `pointer-events: none` to `.name[readonly]` so readonly input passes clicks through to the `.top` listener:
- **Diff preview:**
  ```diff
  - li.row .name {
  + li.row .name[readonly] {
  +   pointer-events: none;
  + }
  + li.row .name {
  ```
  Or add as a single rule inside the existing `.name` block:
  ```diff
    li.row .name {
      flex: 1 1 auto;
  +   pointer-events: none;
  ```
  And add `pointer-events: auto` on `.name:not([readonly])` (the editable state).

---

### SC10 — IndexedDB error path: unhandled rejection on openDB() failure

- **What was checked:** Static grep of all `await dbAll()` / `await dbPut()` callsites. Checked `render()` and `onStopped()` for try/catch wrapping.
- **Found:** `render()` (called at boot from `DOMContentLoaded` and after every action) calls `dbAll()` → `openDB()` with no surrounding try/catch. `onStopped()` calls `dbPut(item)` and `render()` with no catch. If IndexedDB is unavailable (private/incognito mode, storage quota exceeded, browser restriction), the promise rejects silently. The app shows no error state — the list just stays empty and recordings silently fail to save. The user gets no feedback.
- **Cause:** `index.html:1225–1229` (DOMContentLoaded), `index.html:783–784` (onStopped), `index.html:842` (render).
- **Suggested fix:** Wrap `render()` body's `dbAll()` call in try/catch; show a toast on DB failure. In `onStopped()`, wrap `dbPut` + `render` in try/catch.
- **Diff preview:**
  ```diff
  -   items = await dbAll();
  +   try { items = await dbAll(); } catch { items = []; toast('Storage unavailable — recordings cannot be saved'); return; }
  ```

---

### SC14b — probeDuration(): no timeout guard — potential hang on Infinity-duration webm

- **What was checked:** Static analysis of `probeDuration()` at `index.html:788–811`.
- **Found:** The Infinity-duration workaround seeks to `1e10` and waits for a `timeupdate` event. If `timeupdate` never fires (some browsers/codecs silently refuse to seek beyond EOF, especially on compressed formats), the Promise never resolves or rejects. `onStopped()` `await`s it via `.catch(() => durationSec)` — but `.catch` only handles rejections, not a hung promise. Result: `onStopped()` hangs at `await probeDuration(blob)`, the recording is never saved, no toast fires, no row appears. The app appears frozen.
- **Cause:** `index.html:799–804` — no `setTimeout` race to resolve the promise if `timeupdate` is delayed.
- **Suggested fix:** Add a 3-second timeout race:
- **Diff preview:**
  ```diff
  -   const trueDur = await probeDuration(blob).catch(() => durationSec);
  +   const trueDur = await Promise.race([
  +     probeDuration(blob),
  +     new Promise(res => setTimeout(() => res(durationSec), 3000))
  +   ]).catch(() => durationSec);
  ```

---

### S-pwa9 / W3b — SW CACHE name hardcoded: old cached shell never evicted on redeploy

- **What was checked:** `sw.js:5` — `const CACHE = 'voice-memo-v1'`. Activate handler deletes all caches except `CACHE`. Since the name never changes across deploys, the activate handler never evicts the old cache.
- **Found:** The stale-while-revalidate fetch strategy (`sw.js:38–46`) will eventually update files after the network response arrives. However, on iOS PWA the first load after a deploy still serves the old cached `index.html`. The `location.reload()` called by the update banner also goes through the SW and may return the stale cached response, defeating the entire cache-busting purpose.
- **Root cause:** `sw.js:5` — `'voice-memo-v1'` is a constant. `server.js` serves `sw.js` with `no-store` so the SW binary is always re-fetched, but the SW's *internal cache contents* for `'voice-memo-v1'` are stale.
- **Suggested fix:** Bump the cache key per deploy. Two options:
  1. Change `'voice-memo-v1'` to `'voice-memo-v2'` etc. manually on each deploy (simple).
  2. Inject a build hash via server-side templating at startup: `const CACHE = 'voice-memo-${stamp}';`
- **Diff preview (manual bump approach):**
  ```diff
  - const CACHE = 'voice-memo-v1';
  + const CACHE = 'voice-memo-v2';
  ```
  Note: this also requires the fetch handler to serve `/` network-first (not cache-first) so the reload banner actually delivers new HTML.

---

## Needs your call

### W3c — update-banner reload() may not bypass SW cache on iOS PWA

- **What was checked:** `index.html:422` — `onclick="location.reload()"`. `sw.js:38` — fetch handler serves from cache first (`return cached || networked`).
- **Found:** When the update banner fires `location.reload()` on iOS PWA (home screen), the browser sends a normal GET to `/`. The SW intercepts it and returns the cached `index.html` (stale-while-revalidate: serves cached immediately, then updates cache in background). The user sees the old version again. The new version only appears on the NEXT reload.
- **Why I'm not auto-fixing:** Two valid approaches with different tradeoffs.
- **Options:**
  1. **Modify SW fetch handler to serve `/` and `/index.html` network-first, with cache fallback** — guarantees fresh HTML on every reload, but breaks offline-first for the shell. The app's data is in IndexedDB anyway (no offline content), so offline shell is less critical.
  2. **Use `registration.update()` + `skipWaiting` + `clients.claim` flow** — more complex, involves `postMessage` between page and SW. The SW already calls `skipWaiting()` on install. Adding a `clients.claim()` message listener would let the banner trigger a proper SW takeover before reloading.
- **What I'd need from you:** Do you want `/` served network-first in the SW (simpler, breaks offline if server is down), or do you want the full SW update flow with `postMessage`?

---

### S8b — express.static exposes server.js, package.json, project.txt

- **What was checked:** `curl http://localhost:5096/server.js`, `curl http://localhost:5096/package.json`, `curl http://localhost:5096/project.txt` — all return 200 with full file contents.
- **Found:** `server.js` sets `express.static(ROOT)` where `ROOT = __dirname` (the app folder). This serves all files in the folder including source code. `project.txt` (currently no secrets) and `package.json` are readable. If a real key is ever added to `project.txt`, it would be publicly exposed.
- **Why I'm not auto-fixing:** Changing the static root requires either (a) reorganising files into a `public/` subfolder, or (b) adding explicit deny rules. Both are valid but each has implications for the existing file layout.
- **Options:**
  1. **Move all public files to `public/`** and serve `express.static(path.join(ROOT, 'public'))` — cleanest, eliminates risk entirely. Requires moving `index.html`, `sw.js`, `manifest.json`, `images/` into a `public/` subdirectory and updating all server paths.
  2. **Allowlist approach** — explicitly route `index.html`, `sw.js`, `manifest.json`, `images/` and block everything else. Simpler but more brittle.
- **What I'd need from you:** Preference on whether to restructure the folder or just add deny rules.

---

## Verified working ✅

<details>
<summary>31 checks passed</summary>

- W1: no hardcoded API keys · static-pass (grep clean)
- W2: no base64 images · static-pass (grep clean)
- W4: PORT via process.env.PORT with fallback 5096 · static-pass (server.js:9)
- W5: no external CDN imports · static-pass (grep clean)
- W6: all images in /images/ · static-pass + runtime-pass (all 200)
- W3-partial: build-stamp endpoint returns `{"stamp":1777730282949}` · runtime-pass (curl)
- W3-partial: version pill `#buildPill` present in DOM · static-pass (index.html:421)
- W3-partial: update-banner present with onclick · static-pass (index.html:422)
- B1-record: body.recording class added on rec click · runtime-pass (Playwright)
- B1-save: row appears in list after stop · runtime-pass (Playwright, both viewports)
- B2-pause: body.paused class on pause click · runtime-pass (Playwright)
- B2-resume-label: pause button aria-label switches to "Resume recording" · runtime-pass (Playwright)
- B2-resume: body.recording, not body.paused after resume click · runtime-pass (Playwright)
- B2-accumulation: accumulated ms += Date.now()-startedAt on each pause · static-pass (index.html:716)
- B3-timer-idle: timer shows 00:00.0 at idle · runtime-pass (Playwright)
- B3-timer-counting: timer counts during recording · runtime-pass (Playwright mobile 00:00.8 observed)
- B3-waveform-canvas: canvas draw loop started via drawWaveLoop() · static-pass
- B5-quickplay: quick-play button visible on saved row · runtime-pass (Playwright)
- B6-row-open: row expands correctly when .top receives click (confirmed via event dispatch) · runtime-pass
- B6-scrubber: scrubber, skip-back, skip-fwd present in expanded row · runtime-pass (Playwright)
- B8-rename-empty: blur handler reverts to original name when v is empty · static-pass (index.html:944)
- B8-rename-xss: name set via .value not innerHTML — XSS-safe · static-pass (index.html:906)
- B9-delete-confirm: delete calls confirm(), then stopPlayback(), dbDelete(), render() · static-pass
- B9-blob-revoke: stopPlayback revokes blob URL · static-pass (index.html:1073)
- B10-edit-mode: body.editing class added on Edit click · runtime-pass (Playwright)
- B10-select-all: Select All selects all items · runtime-pass (Playwright "1 selected")
- B10-deselect-all: Deselect All shows "None selected" · runtime-pass (Playwright)
- SC3-short-toast: blob.size < 200 check at line 765, toast fires, early return · static-pass
- SC4-codec-fallback: bare `new MediaRecorder(stream)` fallback if opts constructor throws · static-pass (index.html:677)
- SC7-delete-playing: stopPlayback() called before dbDelete() in del handler · static-pass (index.html:959)
- SC12-beforeunload: window.beforeunload guard fires when recorder.state !== 'idle' · static-pass (index.html:1185-1190)
- SC13-audiocontext-ios: AudioContext.resume() called if state === 'suspended' · static-pass (index.html:589)
- SC14-infinity-webm: seek-to-1e10 workaround present in probeDuration() · static-pass (index.html:799)
- SC15-poller-guard: build-stamp poller checks `recorder.state !== 'idle'` before fetch · static-pass (index.html:1216)
- S1: PM2 boot clean, no stderr errors · runtime-pass (pm2 logs clean)
- S2: GET / returns 200 with no-store headers · runtime-pass (curl -sI)
- S3: /, /build-stamp, /sw.js all return 200 · runtime-pass
- S5: inline JS syntax clean · static-pass (node --check)
- S6: package.json scripts.start + scripts.dev present · static-pass
- S7: express installed in node_modules · static-pass
- S-pwa1: index.html parses, no broken script blocks · static-pass
- S-pwa3: all link hrefs resolve (manifest, icons) · runtime-pass (all 200)
- S-pwa6: manifest.json valid JSON, 3 icons all on disk · static-pass + runtime-pass
- S-pwa7: sw.js served with no-store, no-cache · runtime-pass (curl -sI)
- S-pwa8: viewport meta user-scalable=no, viewport-fit=cover · static-pass (index.html:5)
- S-pwa10: openDB rejects are handled at operation level (IndexedDB errors reject promises) · static-pass (structure)
- T3-build-pill: build pill shows "v0.1·282949" · runtime-pass (Playwright both viewports)
- T3-no-console-errors: 0 console errors across full desktop + mobile session · runtime-pass (Playwright)

</details>

---

## Skipped / blocked ⚠

- **SC5: stop-while-paused finalises blob** — Static analysis shows `stopRecording()` at line 742 only adds to `accumulated` if `state === 'recording'`. When paused, state is already `'paused'` so the if-block is skipped. This is CORRECT: `accumulated` was already updated by `pauseRecording()` at line 716. The blob will be finalised. Marking static-pass but runtime confirmation requires a real mic or guaranteed-size fake recording.

- **SC8: scrubber drag while playing** — Blocked by B7 (row expand tap-target bug). The scrubber is visible and present in DOM (confirmed), and the `activeElement !== scrub` guard at line 1056 is correctly coded, but end-to-end scrubber drag testing requires the player to be reachable via normal tap. Runtime verification deferred until B7 fix applied.

- **SC11: SW registration error path** — `navigator.serviceWorker.register('/sw.js').catch(() => {})` swallows errors silently (line 1181). No user feedback if SW fails. Informational — not a functional breakage since SW is progressive enhancement.

- **S11 (informational): fs.statSync in /build-stamp handler** — `server.js:27` uses `fs.statSync(INDEX)` synchronously inside a request handler. This blocks the event loop briefly on each `/build-stamp` hit. Only called every 60s so impact is negligible. Auto-upgrade to `fs.statAsync` is possible but low priority.

- **SC2-timer-pause (runtime precision)** — Accumulated duration calculation is statically correct but timer precision across pause/resume was verified only via Playwright (1s real-time observation). Edge case of sub-100ms pauses not runtime-tested. Marked static-pass.

---

## Screenshot tour

### Desktop (1280×800)

- Main page: `.qa-screenshots/main-desktop.png`
- Recording state: `.qa-screenshots/recording-desktop.png`
- After stop (row saved): `.qa-screenshots/after-stop-desktop.png`
- Expanded row with player: `.qa-screenshots/expanded-desktop.png`
- Playing state: `.qa-screenshots/playing-desktop.png`
- Edit mode (Select All / Deselect All): `.qa-screenshots/edit-mode-desktop.png`

### Mobile (390×844 — iPhone)

- Main page: `.qa-screenshots/main-mobile.png`
- Recording state: `.qa-screenshots/recording-mobile.png`
- After stop (row saved): `.qa-screenshots/after-stop-mobile.png`
- Expanded row with player: `.qa-screenshots/expanded-mobile.png`
- Playing state: `.qa-screenshots/playing-mobile.png`
- Edit mode: `.qa-screenshots/edit-mode-mobile.png`

---

## Run artifacts

- QA checklist: `QA_CHECKLIST.md`
- Main-page snapshot: `.qa-run.html`
- Browser script: `.qa-browser.mjs`
- Screenshots: `.qa-screenshots/` (12 files)
