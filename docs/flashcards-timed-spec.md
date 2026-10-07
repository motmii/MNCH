# Timed Flashcard Review Mode (InfoSec terms)

## Problem Statement

Students need a fast, low-friction, fully-offline way to drill Arabic-first InfoSec term knowledge between lessons, without disturbing the existing timed quiz or requiring a network connection. The drill should be structured, scoreable, mistake-reviewable, and composable with the platform's local progress story.

## Solution

A new client-side review route surfaced through the existing ViewSwitcher, using an embedded card bank (a dedicated module of term/definition pairs bundled with the app). It uses a single, clearly-scored **match mode (term -> definition)**, a **per-question countdown** with auto-advance on expiry, immediate **definition reveal** after every selection and every "I don't know", a **result** of correct / total, a **best-score (flash)** saved locally, and a **needs-review subset** that the next pass prioritizes. The whole feature is **offline-first** (card bank bundled and precached by the service worker) and **does not touch the existing quiz state or the `motmi-portal:*` counters**.

## User Stories

1. As a student, I want to open a separate, uncluttered review route, so I can drill terms without dashboard noise.
2. As a student, I want each card to show a definition and let me pick the matching term, so I can test recognition/recall accurately.
3. As a student, I want a per-question countdown with auto-advance when time runs out, so I keep a steady pace and never get stuck.
4. As a student, I want the correct definition revealed immediately after any selection or "I don't know", so I learn from every card.
5. As a student, I want a result of correct / total shown as a %, so I get immediate feedback.
6. As a student, I want a "review mistakes" panel of missed terms with correct definitions, so I target weak spots.
7. As a student, I want the next session to prioritize missed cards, so weak terms keep coming back.
8. As a student, I want my best score saved locally, so I can track progress without a backend.
9. As a student, I want the mode to work fully offline, so I can review anywhere.
10. As a student, I want Arabic-first RTL, keyboard navigable (arrows, Enter, 1-4), so the platform language and accessibility are respected.
11. As a student, I want this mode in its own route, so it doesn't collide with the timed quiz's keys.
12. As a student, I want the card bank to be easy to extend by an author, so new terms are added without a build step.

## Implementation Decisions

- **Card bank module**: an embedded dataset of term/definition pairs, bundled with the app JS and cached by the service worker; zero network. Authors extend it through a documented data-file format. Syntactically simple and JSON-like.
- **Task mode**: single, clearly-scored **match mode (term -> definition)**. Recall/cue mode deferred to a later toggle.
- **Timing mechanic**: **per-question countdown** (base ~10s, gentle total-elapsed warning). On expiry: auto-advance, mark wrong, reveal the definition.
- **Feedback**: every outcome (correct, wrong, "I don't know", time-up) reveals the correct definition and the term - nothing is hidden.
- **Scoring**: correct = +1; wrong / "I don't know" / time-up = 0. Result = correct / total, shown as a %, plus a review-only outcome.
- **Best score (flash)**: the highest % across local runs, stored in a dedicated namespace; does not shadow the quiz's best score.
- **Persistence**: dedicated localStorage namespace `infosec:flash:timed` - session results + best score. Isolated from the legacy quiz `timed` key and the `motmi-portal:*` counters.
- **Needs-review subset**: missed cards persisted after each run and reused with priority in the next run.
- **Route**: new view path `flashcards/timed` registered through the existing ViewSwitcher; surfaced via a dashboard/band entry. Fragment route, so no server config for static hosting.
- **Architecture**: no new backend, API, or service changes; adds a single vertical slice through the existing routing/view system. Prefer existing seams (ViewSwitcher) over new ones.
- **Offline/PWA**: card bank bundled and precached exactly like the rest of the app; reviews work under full offline.
- **Language/accessibility**: Arabic-first RTL layout, per-option keyboard navigation, screen-reader live region for the current term, safe horizontal layout on narrow screens.

## Testing Decisions

- Test the card bank: correct term/definition shape, duplicate terms rejected, no empty definitions.
- Test the timing mechanic directly: countdown, auto-advance on expiry, reveal on expiry, no false auto-advance on a correct answer.
- Test scoring: correct/total computation; "I don't know" and time-up counted as wrong; best score updated to a true maximum.
- Test the needs-review subset: missed cards are persisted and reused with priority on the next run.
- Test persistence isolation: the `infosec:flash:timed` namespace does not collide with the quiz `timed` key or the `motmi-portal:*` counters.
- Test routing: `flashcards/timed` opens through ViewSwitcher, renders the card bank, and behaves consistently with other views on back/forward.
- Test offline: a full offline reload still presents the card bank (precached), with no network fetch.
- Test RTL and keyboard: Arabic-first layout, keyboard navigation (arrows + Enter), screen-reader live region, no horizontal overflow.

## Out of Scope

- Recall/cue mode (definitions -> choose term) - deferred to a future toggle.
- Total-session timer configurability - per-question only for now.
- Authoring UI for managing cards - deferred (data file + documented format).
- Remote best score or leaderboard - local only.
- Sharing results to a server or social.
- Integration with the quiz/question-bank engine.

## Further Notes

- Follows the existing offline-first PWA posture; no new network dependency.
- Follows the app's Arabic-first RTL, zero-dependency, vanilla-JS conventions.
- Reuses the existing best-score + review-of-mistakes pattern, in a distinct namespace.
- Publish this spec into the project issue tracker under the `ready-for-agent` triage label, and create tracer-bullet tickets that block in dependency order.
