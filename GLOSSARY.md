# Glossary

Repository domain vocabulary for **infosec-platform** — an Arabic-first cybersecurity education platform for Information Security diploma students.

Use these terms exactly as defined here. Don't drift to synonyms the glossary avoids.

## Core concepts

| Term | Definition |
|---|---|
| **Platform** | The single-page, zero-dependency Arabic-first cybersecurity education platform (static frontend, online-only). |
| **Subject** | A course-code entry in the `SUBJECTS` registry, one of the official 5-course plan. |
| **Question bank** | A set of questions tagged by topic category. Six previous-semester banks are archived (not deleted); the current set holds 20 questions. |
| **Lesson** | A unit of study content (module) that a quiz or progress item can reference. |
| **Learning path** | A curated sequence of subjects/lessons routed from the homepage (e.g. `#path/fundamentals`). |
| **Quiz** | Interactive practice/exam: Practice (relaxed) vs Timed Exam (per-question countdown), with best-score and review-of-mistakes tracking. |
| **Flashcard** | A card in the flashcard grid with review progress. |
| **Tool** | A cybersecurity tool upgraded to an educational component (safe example input, reset, copy, validation, lesson link). |
| **Lab** | A hands-on exercise (e.g. the Kali install guide) with self-contained content. |
| **AI assistant** | Arabic-first study assistant (MODULE 33) grounded in platform content. |
| **Onboarding wizard** | Optional 3-step skippable first-run (level → subjects → learning style), persisted under `motmi-portal:onboarding`. |
| **Service worker** | Retired PWA cache layer. The platform is online-only; any legacy registration is unregistered and its caches are cleared on load. |
| **View / ViewSwitcher** | Router-driven screen that switches by view path, mapping modules to screens. |
| **Progress hub** | Aggregated local progress (IndexedDB + one-time localStorage migration). |


## Flashcard review mode

**Flashcard card bank**:
The embedded dataset of term/definition pairs for the timed review feature. Bundled with the app so the mode issues no network requests after the page loads. _Avoid_: question bank, term bank.

**Match mode**:
The term → definition matching task: a definition is shown and the user selects the matching term. The default mode for this feature. _Avoid_: recall, cue, quiz.

**Per-question countdown**:
A time limit per card (base ~10s). When it expires, the card auto-advances, is marked wrong, and its definition is revealed. _Avoid_: total timer, session clock.

**Flashcard**:
A single review card in the timed review mode, showing one term and its definition. _Avoid_: quiz question, flashcard grid (which is the separate non-timed review list).

**Needs-review subset**:
The set of missed cards persisted after a session; the timed review mode prioritizes it on the next pass. _Avoid_: mistake bank, revision queue.

**Flashcard session result**:
One timed run's output: score (% correct), elapsed time, and the listed missed cards. _Avoid_: quiz attempt, scoreboard.

**Best score (flash)**:
The highest % correct across local flashcard runs, stored under the `infosec:flash:timed` namespace. _Avoid_: best score (the quiz-time concept).

## Notes

- Terms are added and updated by the `/domain-modeling` skill as concepts get resolved.
- Add a row whenever a concept is named in an issue, spec, or design.
