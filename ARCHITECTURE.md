# Architecture — منصة أمن المعلومات

## Overview
Single-page application (SPA) built with zero dependencies. All code runs client-side. No build step required.

## Module Map (`script.js`)

```
Main IIFE ("use strict")
├── M00b Subjects         Single source of truth for the OFFICIAL study-plan
│                         subjects (دبلوم أمن المعلومات — تجسير مهني). Every
│                         subject carries its course code as stable id +
│                         nameAr, credit hours, semester (current/previous),
│                         day/time, content status. #subjectsGrid cards are
│                         rendered from this registry; current subjects
│                         without authored content show the honest Arabic
│                         empty state «سيتم إضافة المحتوى قريبًا». Archive
│                         subjects keep their real quiz links. Exposed as
│                         window.PLATFORM_SUBJECTS (assistant.js).
├── M01  Helpers          $id, $$, escHtml, debounce, fmtInt
├── M02  Store            localStorage wrapper (namespaced: motmi-portal:*)
├── M03  Sfx              Web Audio synth (good/bad/timeout/tick/flip presets)
├── M04  Preloader        Boot overlay lifecycle + CSS fallback keyframe
├── M05  PointerFX        Shared pointer state {tx,ty,active} + idle-aware rAF loop
│                         Hooks return truthy to keep loop alive; idle → pause
├── M06  Cursor           Custom cursor (dot+ring, GPU scale on hover)
│                         Gated by html[data-cursor-active] — JS sets only when live
├── M07  Particles        Hero canvas constellation (DPR-aware, pointer-attracted)
├── M08  Reveal/Nav       IntersectionObserver reveal + navbar frost toggle
├── M09  Counters         Eased count-up on first visibility
├── M10  MobileMenu       Drawer open/close + body scroll lock
├── M11  Tilt             3D card tilt via shared rAF hooks (max 7°)
├── M12  Magnetic         Button attraction effect (strength=22)
├── M13  QuizEngine       6 archived previous-semester banks · 20 questions
│                         (each tagged with a topic category) · practice vs
│                         timed-exam modes
│    ├── renderPicks()     Subject picker w/ best-score & resume badges +
│    │                     explicit practice/exam mode selector (persisted
│    │                     under the legacy "timed" key)
│    ├── startQuiz()       Start or resume from saved progress; accepts an
│    │                     optional index filter (retry-incorrect replays)
│    ├── showQuestion()    Timer bar, ARIA options group, "Question i of n"
│    │                     counter, feedback area; explanation drawer in
│    │                     practice mode (deferred to the result in exams)
│    ├── handleAnswer()    Grade, sfx, explanation drawer
│    ├── timeoutAnswer()   Auto-fail on timer expiry
│    ├── finishQuestion()  Shared tail: progress save + next button
│    ├── showResult()      Persists best score, clears the resume slot,
│    │                     builds wrongList (original index + outcome) and
│    │                     per-category stats
│    └── renderResult()    Score, answer + per-category breakdowns, deferred
│                          mistake review, retry-incorrect button and the
│                          continue-learning link to the owning path
│    Boot sanitizes persisted progress: entries with missing/invalid
│    idx/total/score are dropped; valid progress is never reset.
├── M14  Tools.Hash       SHA-256 (Web Crypto + FNV fallback) + visual grid
├── M15  Tools.Caesar     Arabic/Latin shift cipher
├── M16  Tools.Jwt        Base64URL decode + exp check
├── M17  Tools.Cidr       IPv4 subnet calculator (network/broadcast/hosts)
├── M18  Tools.Password   Entropy bits + crack time + rule checklist
├── M19  Tools.Encoders   Base64 / Hex / URL codecs
│                         ↑ M14–M19 = the 6 cybersecurity tools (hero counts 6)
├── M21  MaterialsFilter  Live search + tag chips for .work-grid
├── M22  Lang             AR/EN interface switcher (navbar toggle, persisted)
├── M23  PWA Registration navigator.serviceWorker.register("./sw.js")
├── M24  CyberGames       Incident Response Simulator & CTF (console)
├── M25  TerminalFX       Typewriter console driver (help/scan/block-ip → Flag)
├── M29  Tools.Flash      18 bilingual flashcards (study feature — separate
│                         from the 6-tool suite; terms embedded, no JSON)
├── M30  Stats.Live       Hero counters from real data + quiz jump links
│                         (subjects = official current-semester count from
│                         the SUBJECTS registry; questions from the bank)
├── M31  Nav.ToTop        Back-to-top button (appears after 600px)
├── M32  Nav.ScrollSpy    Highlights the section in view via aria-current
├── M33  ViewSwitcher     Instantly switches views while keeping one page
├── M36  ThemeSwitch      Dark default · light persisted (explicit choice wins,
│                         else OS prefers-color-scheme; pre-paint restore in
│                         index.html prevents theme-flash on load)
├── M37  ProgressHub      #progress — "تابع من حيث توقفت" resume card + best-score
│                         cards, built from the quiz engine's localStorage store.
│                         Phase 5 adds a stats strip (completed lessons, quiz
│                         attempts, labs completed, flashcards reviewed, overall
│                         learning-path progress and an overall %) plus a
│                         "Review incorrect answers" action (MissedBank) that
│                         replays only missed questions. Refresher wires:
│                         "nova:progress-changed" + "nova:view-changed" + locale.
├── M37b HeroContinue     Homepage hero "تابع من حيث توقفت" card — visible only
│                         when the quiz store has a resumable session or saved
│                         results; refreshes on the "nova:progress-changed"
│                         event dispatched by writeStore() after every write.
├── M38  Onboarding       Optional first-time wizard (skippable — no registration):
│                         step 1 level → step 2 subjects of interest → step 3
│                         learning style → recommended starting path. Persists
│                         "motmi-portal:onboarding"; recommending "Start"
│                         deep-links #path/fundamentals. Overlay is RTL-safe and
│                         mobile responsive; only learning preferences are
│                         stored locally (nothing personal).
│    Lightweight progress counters (also Phase 5):
│      · lessons opened  → "motmi-portal:lessons"  (MODULE 40 showLesson)
│      · flashcards flipped → "motmi-portal:flash" (MODULE 29)
│      · labs completed  → "motmi-portal:labs"     (MODULE 42 LABS_META)
│      · path checkmarks → "motmi-portal:paths"    (MODULE 39)
├── M39  LearningPaths    #paths (10 structured path cards) + shared #path
│                         detail view. Embedded LEARNING_PATHS data (AR/EN
│                         titles, levels, ordered topics, live/soon status).
│                         Topic progress: manual checkmarks in Store
│                         ("motmi-portal:paths") + auto-done via quiz results.
│                         Deep links "#path/<id>" — ViewSwitcher resolves the
│                         view, the module reads the id from the hash.
├── M40  Lessons          #lesson/<subject>/<key> — beginner lesson view
│    │                     (explanation, key concepts, practical example,
│    │                     common mistakes, AR/EN terminology). Embedded
│    │                     LESSONS data (6 lessons); topics without an
│    │                     authored lesson render an honest placeholder.
│    ├── nextLessonLink()  Suggested next lesson from LEARNING_PATHS order
│    ├── lessonResChips() Related quiz/tool/flash chips (topic's own res)
│    └── initLessons()    #lesson/… hash routing (strict guard — non-lesson
│                          hashes never touch the view)
│    Publishes QUIZ_CATS + SUBJECT_TO_PATH on `window` so the quiz result
│    screen can render category labels and the continue-learning link.
│    ViewSwitcher resolves the "lesson/" prefix and preserves the deep-link
│    hash on activation (same mechanism as "#path/<id>").
├── M42  ToolsEdu        Additive educational layer over the 12 tool cards —
│                         injects AR/EN name, difficulty, purpose, safety,
│                         safe-example, reset, copy, lesson/path/quiz chips.
│                         Embedded TOOLS_META + LABS_META data. Labs show
│                         objective/skills/hints/explanation + responsible-use
│                         warning + honest manual completion tracking. Original
│                         HTML untouched — all context added dynamically.
├── M38  Labs & IR        #redteam (Bash+SQL virtual FS + NetLab packet builder),
│                         #cryptolab (Vigenère · Enigma · RSA · DES · frequency ·
│                         hash-collision), #ir (SIEM table + charts & query syntax,
│                         kill-chain timeline, live incident sim + virtual team,
│                         RCA challenges). IIFE blocks, guarded by element-existence
│                         checks — they no-op on missing markup.
├── M43  SemesterDashboard #semester — official curriculum view rendered from
│                         window.PLATFORM_CURRENT_SEMESTER (current-semester.js is
│                         the single source of truth; nothing duplicated).
├── M47  HeroDash         Compact homepage dashboard: overall %, last lesson,
│                         next recommended quiz, Continue-Learning link. Read-only.
├── M48  GlobalSearch     Command palette (/ or Ctrl+K) over lessons, paths, tools,
│                         quizzes, flashcards, glossary. ARIA combobox + listbox.
├── M49  ReopenOnboarding Replay the intro tour on demand from the hero strip.
├── M50  Motivation       Local-only XP, levels, goals, streaks, badges
│                         ("motmi-portal:motivation"). Read-only over quiz store.
├── M51  SkillTree        Cybersecurity skill map (MODULE 51) with progress meters
│                         derived from real quiz/lesson data. Store "motmi-portal:skills".
├── M52  Revision         Transparent local review queue built from real missed
│                         questions (store "motmi-portal:revision"). No timers,
│                         no notifications; quiz engine untouched.
├── M53  ExamPrep         Exam-preparation mode in #progress: optional exam date,
                          day-granular countdown, daily recommendations, honest
                          per-subject readiness (0.5·quiz + 0.3·coverage +
                          0.2·mistake-free, weight redistribution when a subject
                          has no linked lessons), untimed practice-exam deck
                          sampled from the real question banks, weak-topic review
                          deep-links. Store "motmi-portal:exam-prep" (runs capped
                          at 10); all other stores are read-only here.
├── M55–M58 Hero Wave 1   HeroNow ribbon (time-of-day greeting + the next real
│                         class from the official timetable), HeroTabs tablist,
│                         HeroAdaptiveNext strip, and the navbar WhatsNew
│                         changelog popover (see README for the full list).
└── M59  HeroMedia        Animated hero background — two pointer-inert layers:
                          `.hero-bg` (the hero photo, drifting with a pure-CSS
                          heroDrift zoom/pan) and `.hero-media` (a 10s, 1600×900,
                          silent local loop `images/hero-bg.mp4` derived from the
                          same photo — replace that one file to ship a different
                          animation, and keep backweb.jpg as poster/fallback).
                          Playback is opt-in per device and vetoed for
                          prefers-reduced-motion, Save-Data/slow links, screens
                          narrower than 700px, and batteries below 20% while
                          unplugged; it pauses on hidden tabs and whenever the
                          hero leaves the viewport. No autoplay attribute plus
                          preload="none" means a vetoed device downloads 0 bytes.
                          Publishes window.PlatformHeroMedia; covered by
                          tests/hero-bg.test.js.
```

`M33 · AI.Assistant` lives in its own file, `assistant.js` (loaded after
`script.js`) — a floating Arabic-first assistant with a local knowledge
engine and an optional server-side LLM proxy. See `ASSISTANT.md`.

Note: the original `M33` ViewSwitcher (in `script.js`) and the `M33 · AI.Assistant`
identifier (in `assistant.js`) share a number by historical accident; they are
two separate files/modules.

## Key Design Decisions

### Single rAF Loop (PointerFX)
All pointer-driven effects share one `requestAnimationFrame` loop. Each module registers a hook that returns `true` while it needs more frames. The loop **pauses itself** when no hook returns true — zero CPU usage at rest.

### Custom Cursor Gating
`cursor: none` is never applied globally in CSS. Instead, `script.js` sets `html[data-cursor-active="true"]` **only after** confirming:
1. `pointer: fine` media query matches
2. `prefers-reduced-motion` is not set  
3. Cursor elements exist in the DOM

CSS rules are scoped under `html[data-cursor-active="true"]`.

### Quiz Persistence Schema
```json
// localStorage key: "motmi-quiz-v1"
{
  "results": {
    "<subjectKey>": {
      "score": 3,
      "total": 4,
      "pct": 75,
      "last": 75,
      "date": "2026-01-15"
    }
  },
  "progress": {
    "<subjectKey>": {
      "idx": 2,
      "score": 1,
      "total": 4
    }
  }
}
// Separate key: "motmi-portal:sound" = true/false
// Separate key: "motmi-portal:timed" = true/false
```

### Learning Paths Schema (MODULE 39)

```js
// Embedded in script.js — LEARNING_PATHS (append a path = no other changes)
{
  id: "crypto", ico: "🔐",
  level: "beginner" | "intermediate" | "advanced",
  status: "live" | "soon",          // "soon" → honest coming-soon placeholder
  recommended: true,                // optional — the beginner starting path
  title: { ar, en }, desc: { ar, en },
  topics: [{                        // ordered lessons
    id: "c-rsa",
    t: { ar, en },
    res: {                          // optional link to EXISTING content only
      k: "quiz",  key: "crypto"     // → data-quiz-jump flow + auto-done
      // k: "tool", id: "tool-hash", ar, en   (deep-jump to a .tool-card id)
      // k: "lab",  view: "cryptolab"         (lab/section view link)
      // k: "flash"                           (flashcards view)
    }
  }],
  related: [{ k: "lab", view: "ir" }] // optional (soon paths: honest pointer)
}

// localStorage key: "motmi-portal:paths" (Store)
{ "v": 1, "done": { "<pathId>": { "<topicId>": true } } }
```

### ToolsEdu + Labs Meta Schema (MODULE 42)

```js
// Embedded in script.js — TOOLS_META (12 entries, one per tool card)
{
  "tool-hash": {
    name: { ar, en },                     // bilingual tool name
    level: "beginner" | "intermediate" | "advanced",
    path: "crypto",                       // owning learning path id
    lesson: "crypto/hashing" | null,      // → #lesson/<subject>/<key> (must resolve)
    quiz: "crypto" | null,                // → data-quiz-jump flow
    purpose: { ar, en },                  // learning objective
    safety: { ar, en },                   // required safety/limitation wording
    example: { fill: [{ id, value }], click?: "btnId" },  // safe demo input
    copy: "outputElId" | null             // copy-target element id
  }
}

// Embedded in script.js — LABS_META (4 entries: games, redteam, ir, cryptolab)
{
  games: {
    status: "live" | "soon",              // "soon" → honest placeholder
    level: "intermediate" | "advanced",
    name: { ar, en },
    objective: { ar, en },
    skills: [{ ar, en }, ...],            // ≥ 3 items
    hints: [{ ar, en }, ...],             // ≥ 2 items
    explanation: { ar, en }               // shown after completion
  }
}
```

- All 12 tool cards in HTML are untouched — educational context is injected
  dynamically by `initToolsEdu()` from embedded data (additive architecture).
- Every tool links to its owning path; tools with a `lesson` also link to that
  lesson; safety wording is mandatory and surfaced prominently.
- Labs track completion in `Store("labs")` as `{ v: 1, done: { "<viewId>": true } }`.
- Lesson/quiz references are validated against real content at test time — a tool
  whose `lesson` doesn't resolve to an authored lesson is a test failure.
- Topic done = manual flag **or** (`res.k === "quiz"` and the quiz store has a
  result for that subject). Path progress = done / topics.length.
- Related quizzes/tools/labs chips are **derived** from the topic links —
  resource content is never duplicated.
- Deep links: `#path/<id>` (ViewSwitcher `resolveViewId` maps the prefix to the
  shared `#path` view and `activate()` preserves the full hash; unknown ids and
  bare `#path` render honest empty states).

### Preloader Fallback
`.preloader` has a CSS keyframe (`preloaderFallback 5s forwards`) that force-hides the overlay after 5 seconds even if JavaScript fails entirely.

### RTL Support
All directional properties use CSS logical equivalents:
- `inset-inline-start/end` instead of `left/right`
- `padding-inline-start/end` instead of `padding-left/right`
- `text-align: start` instead of `text-align: right`
- `transform-origin: right` for nav underline animation

## Service Worker Strategy
| Request Type | Strategy |
|---|---|
| Navigations | Network-first → cached `index.html` shell fallback |
| Statics + API/JSON (HTML/CSS/JS/images/fonts/fetched data) | Stale-while-revalidate into the versioned runtime cache |
| Precache (app shell + subject images + flashcards + `backweb.jpg` + the animated `hero-bg.mp4`) | Versioned cache refreshed on each `CACHE_VERSION` bump |
| Media byte-range requests (the animated hero loop) | Cached full copy when one exists, otherwise streamed straight from the network — a `206` response is never stored |

Notes: `OFFLINE_API_PATTERNS` / `API_CACHE_NAME` are declared hooks for future
network-first API caching but are currently unused — the fetch handler routes
every non-navigation GET through stale-while-revalidate.

Cache versioning: bump `CACHE_VERSION` in `sw.js` to invalidate (currently `v1.22.18`).
