# 03: Result, persistence, best score

**What to build:** an end-of-session result panel plus isolated, durable storage so the student sees their score, reviews missed cards, and builds a best score without touching the quiz state.

**Blocked by:** T02 (review engine + timing)

**Status:** done

- [x] End-of-run result panel shows correct / total, a percentage, and elapsed time.
- [x] Session results are written to the `infosec:flash:timed` namespace in localStorage.
- [x] Best score updates only when the new run is better than the stored best.
- [x] Missed cards are persisted as a "needs-review subset" and prioritized on the next run.
- [x] Write does not collide with the quiz `timed` key or `motmi-portal:*` counters.

**Blocked by:** T02

**Implementation note (T03):** MODULE 34 gained `STORE_KEY = "infosec:flash:timed"` with exception-guarded `readStore()/writeStore()` (private-mode/quota safe), a single `finishSession()` transition that freezes `finishedAt`, computes `pct = round(correct/total*100)` and writes `best` + `last` + `history` (capped at 10) + `review` in one merge, and the full result panel: score line, big %, m:ss elapsed (`fmtDur`), best-score line (or «no best yet»), a strict `pct > prevBest` «new best» badge (first run stores the baseline; ties never count), and the missed-cards review list (term + definition + priority hint) with an empty-state. Needs-review subset = (previous review ∪ this run's misses) − this run's correct − terms no longer in the bank; `startSession()` shuffles those terms to the FRONT of the deck. `window.FlashTimed` now also exposes `STORE_KEY` + `fmtDur`. 8 new i18n keys in ar + en (`flash.pct/elapsed/best/noBest/newBest/reviewTitle/reviewHint/reviewEmpty`), `.ft-pct/.ft-review*` styles, version triple → 1.29.0. Verified: 83/83 checks in `tests/flashcards-timed.test.js` (4 sequential runs over one shared localStorage double — baseline → better → worse → tie — with seeded `timed` + `motmi-portal:*` keys proven byte-identical), full suite 25/25.
