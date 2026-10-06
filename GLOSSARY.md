# Glossary

Repository domain vocabulary for **infosec-platform** — an Arabic-first cybersecurity education platform for Information Security diploma students.

Use these terms exactly as defined here. Don't drift to synonyms the glossary avoids.

## Core concepts

| Term | Definition |
|---|---|
| **Platform** | The single-page, zero-dependency Arabic-first cybersecurity education platform (frontend + static PWA). |
| **Subject** | A course-code entry in the `SUBJECTS` registry, one of the official 5-course plan. |
| **Question bank** | A set of questions tagged by topic category. Six previous-semester banks are archived (not deleted); the current set holds 20 questions. |
| **Lesson** | A unit of study content (module) that a quiz or progress item can reference. |
| **Learning path** | A curated sequence of subjects/lessons routed from the homepage (e.g. `#path/fundamentals`). |
| **Quiz** | Interactive practice/exam: Practice (relaxed) vs Timed Exam (per-question countdown), with best-score and review-of-mistakes tracking. |
| **Flashcard** | A card in the flashcard grid with review progress. |
| **Tool** | A cybersecurity tool upgraded to an educational component (safe example input, reset, copy, validation, lesson link). |
| **Lab** | A hands-on exercise (e.g. the Kali install guide) with offline-capable content. |
| **AI assistant** | Arabic-first study assistant (MODULE 33) grounded in platform content. |
| **Onboarding wizard** | Optional 3-step skippable first-run (level → subjects → learning style), persisted under `motmi-portal:onboarding`. |
| **Service worker** | PWA cache layer that registers with subpath scope and precaches assets plus an offline fallback for static hosting (GitHub Pages). |
| **View / ViewSwitcher** | Router-driven screen that switches by view path, mapping modules to screens. |
| **Progress hub** | Aggregated local progress (IndexedDB + one-time localStorage migration). |

## Notes

- Terms are added and updated by the `/domain-modeling` skill as concepts get resolved.
- Add a row whenever a concept is named in an issue, spec, or design.
