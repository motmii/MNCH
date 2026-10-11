# 05: RTL + keyboard + accessibility

**What to build:** a fully keyboard-operable, Arabic-first RTL flashcard review interface so students can navigate by keyboard and the layout flows correctly for the platform's language.

**Blocked by:** T02 (review engine + timing), T04 (route + discovery)

**Status:** done

- [x] Arabic-first RTL layout applied to the card and options.
- [x] Per-option keyboard navigation (arrows + Enter) works.
- [x] Screen-reader live region announces the current term and its definition.
- [x] No horizontal overflow on narrow screens.

**Blocked by:** T02, T04

## Implementation note (agent)

**script.js · MODULE 34**
- Pure keyboard helpers, exposed on the seam as `FlashTimed.keyNav`: `arrowStep(key, rtl)` — vertical arrows direction-neutral, Left/Right flipped under RTL; `cycleIdx(i, step, n)` — wrap-around focus cycling; `hotIdx(key)` — digits `1..4` → choice index (spec user story 10). `dirRtl()` reads the computed direction of `.ft-choices`, defaulting to RTL (Arabic-first platform).
- Delegated `keydown` on `#flashcards-timed-mount` (survives every repaint, sibling of the click handler): arrows cycle the four definition buttons (from `#ftTerm`, forward/back enters the list), digits answer directly; Enter/Space stay native because every choice is a real `<button type="button">`.
- `announce()` writes the persistent `#ftLive` SR region: `flash.srTerm` (card i/n + term) while the question runs, `flash.srReveal` (term + definition) only AFTER the reveal — never before, so the answer is not spoiled — and `flash.score` on done.
- `moveFocus()` state machine: question → `#ftTerm` (tabindex=-1), revealed → `[data-ft="next"]`, done → `.ft-done h3` (now `tabindex="-1"`). It runs from `paint()` only when focus was already inside the mount (`$mount.contains(document.activeElement)` captured BEFORE the innerHTML swap), so route entry and locale switches never steal focus from the ViewSwitcher heading.
- i18n: `flash.srTerm` / `flash.srReveal` added to BOTH ar + en dicts.

**index.html**
- `#ftLive` (`.sr-only`, `role="status"`, `aria-live="polite"`, `aria-atomic="true"`) added OUTSIDE the painted mount so the live region persists across repaints — a live region rebuilt via innerHTML never announces.

**style.css** (T05 block, before `/* END MODULE 34 */`)
- Explicit `direction: rtl` on the card + option surfaces; `.ft-term` keeps its isolated LTR run for Latin acronyms.
- Overflow guards: `min-width: 0` on every flex/grid child and `overflow-wrap: anywhere` on all long-text surfaces — no horizontal overflow on narrow screens.
- `:focus-visible` rings on the managed focus targets (`.ft-term`, `.ft-done h3`).

**Version** triple bumped to **1.30.0** (package.json ↔ sw.js `CACHE_VERSION` ↔ index.html `style.css?v=`).

**Tests** (`tests/flashcards-timed.test.js`, header now T01–T05): +24 checks → **122/122 pass, EXIT=0** — 16 source-contract (keydown delegation, arrow/digit keys, native buttons, live-region wiring + phase guard, i18n keys in both dicts, focus machine + containment guard, tabindex, CSS layer: explicit RTL, LTR isolation, overflow guards, focus rings, logical alignment) + 8 vm behavioral through `FlashTimed.keyNav` (direction matrix, wrap-around, hotkey bounds, seam regression). Full suite `node tests/run-all.js`: **25/25, EXIT=0**. Encoding probe clean on all touched files (BOM=False, Arabic=True, mojibake=False).

**Caveat:** verified via static + vm harness only; no real-browser smoke test (same limitation as T01–T04).
