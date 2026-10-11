# 06: Offline + edge cases + verification

**What to build:** confidence that the mode works fully offline and handles the edge cases a student might hit, verified by a smoke test.

**Blocked by:** T01 (card bank), T03 (result persistence)

**Status:** done

- [x] Full offline reload still presents the card bank (precached) with no network fetch.
- [x] Empty-state rendering when the bank has no terms.
- [x] Long definitions do not overflow the card/screen.
- [x] End-to-end smoke test passes for a complete scored run.

**Blocked by:** T01, T03

## Implementation note (agent)

**Offline contract** — MODULE 34 + `data/flashcards.js` make zero
network calls (no fetch/XHR/EventSource/beacon/WebSocket); the whole
offline shell (`index.html` + `style.css` + `script.js` +
`data/flashcards.js`) is in `PRECACHE_ASSETS`; navigations fall back to
the cached app shell; the page registers the worker (`serviceWorker.register`).

**CSS layer integrity** — the MODULE 34 block sits top-level (brace
balance over comment-stripped CSS: prior rules closed, block balanced,
file balanced end-to-end; `.timer-clock` keeps its own background).
Long-content guard: `.flashcards-timed-mount { max-width: 100%;
overflow-wrap: anywhere; }` plus `overflow-wrap: anywhere` on every
long-text surface, so a no-break-opportunity definition can never widen
the page/card on a narrow screen.

**Empty bank** — `#flashcards-timed-empty` ships hidden with
`data-i18n="flash.empty"`; `flash.empty` exists in BOTH ar + en dicts;
`paint()` reveals the message and `startSession()` refuses a ghost deck
(stays `idle`) when the bank is empty.

**End-to-end smoke** — a full scored run inside a network-free vm
sandbox (no fetch/XHR/EventSource at all): boots to the start screen,
perfect run reaches the result panel with score + % + clean review, the
SR live region carries the final score, and best/last/history/review
persist under `infosec:flash:timed` with non-negative elapsed ms.

**Version** triple in lockstep at **1.30.1** (package.json ↔ sw.js
`CACHE_VERSION` ↔ index.html `style.css?v=`).

**Tests** (`tests/flashcards-timed.test.js`, header T01–T06):
**all checks passed, EXIT=0** — 5 offline-contract + 6 CSS-integrity +
5 empty-bank + 9 end-to-end smoke. Full suite `node tests/run-all.js`:
**25/25 suites passed, EXIT=0**.

**Caveat:** verified via static + vm harness only; no real-browser smoke test (same limitation as T01–T05).
