# 02: Review engine + timing mechanic

**What to build:** a full, scored session where the student sees one card at a time and works through the deck with a per-question countdown, auto-advance on time-out, and definition reveal after every outcome.

**Blocked by:** T01 (card bank module)

**Status:** done

- [x] Engine renders one card at a time from the card bank.
- [x] Per-question countdown (base ~10s) runs and is visible.
- [x] On expiry: auto-advance, mark wrong, and reveal the definition automatically.
- [x] A correct answer does not auto-advance.
- [x] "I don't know" reveals the definition and counts as wrong.

> **Implementation note:** on expiry the reveal is shown for a short
> hold (`REVEAL_HOLD_MS = 1600`) before the automatic advance, so
> "reveal the definition automatically" and "auto-advance" both hold —
> the reveal is visible, then the deck moves on without input.

**Blocked by:** T01
