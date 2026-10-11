# 01: Card bank module

**What to build:** a ready, embedded deck of InfoSec term/definition pairs that the timed review mode can consume, with the card bank module exposing the terms to the review engine.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Card bank module loads and exposes `terms` (an array of term/definition pairs) — `window.FLASHCARDS_TERMS`.
- [x] Duplicate `term` values are rejected at load.
- [x] Empty or whitespace-only `definition` values are rejected at load.
- [x] Module is bundled into the app JS and cached by the service worker (no network fetch at runtime).
