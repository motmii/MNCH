# Architecture — منصة أمن المعلومات

## Overview
Single-page application (SPA) built with zero dependencies. All code runs client-side. No build step required.

> **Runtime mode (v3.1.0):** online-only. `index.html` unregisters every legacy service worker and clears Cache Storage at boot; nothing registers `sw.js`, and the hero loads no photo/video. Service-worker and hero-media notes below are historical records kept for the test suite.

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
│    ├── renderPicks()     Quiz workspace: mode rail, recommended next,
│    │                     progress pulse + subject rows with meters and
│    │                     best-score/resume labels (practice/exam mode is
│    │                     persisted under the legacy "timed" key)
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
├── M23  PWA Registration REMOVED — online-only boot unregisters legacy
│                         workers and clears Cache Storage; sw.js is historical
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
├── M36  ThemeSwitch      REMOVED in v2.0.0 — the platform ships ONE
│                         identity (V0 Obsidian, dark-only). No pre-paint
│                         theme script, no data-theme/data-palette CSS,
│                         no runtime toggle lookups remain.
├── M36b PaletteSwitch    REMOVED in v2.0.0 — see M36.
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
│    │                     LESSONS data (currently empty — no authored
│    │                     lessons yet); topics without an authored lesson
│    │                     render an honest placeholder.
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
├── M62  Srs              Spaced repetition in #progress (#srsApp): a review queue
│                         seeded ONLY from the missed-question bank, scheduled
│                         by a PURE small SM-2 variant (lapse → due today,
│                         good/easy → 1 / 3 / interval·ef days, ease floored at
│                         1.3, two passes graduate the card). Store
│                         "motmi-portal:srs"; self-rated grades, no timers and
│                         no notifications. Keyboard: 1-9 answer, Enter = "got it".
├── M63  Backup           Export/import the whole local progress as one JSON file
│                         (#backupApp). collect() reads only "motmi-portal:*" plus
│                         the quiz store; validate() accepts a payload only when it
│                         is tagged and every kept key is a platform key holding a
│                         structured value; restore() writes only that. Blob
│                         download + FileReader, 512 KB cap, zero network.
├── M64  MockExam         One full paper in the quiz section (#mockApp): an equal,
│                         non-over-sampled, shuffled slice from every real bank,
│                         with a SINGLE total countdown (45s/question clamped to
│                         2–90 min) instead of a per-question timer, answers
│                         hidden until the end, then a per-subject breakdown.
│                         Own state only — the quiz engine, the missed bank and the
│                         subject stores are never written.
├── M65  A11yExtras       Additive accessibility: quiz shortcuts (1-9 answer,
│                         Enter/Space = next) that only fire while a question is on
│                         screen, never while typing and never while another
│                         overlay is open; plus an opt-in read-aloud flashcards
│                         toggle (Web Speech API, ar-SA, cancelled on view change).
│                         Touches no existing control.
├── M66  SwUpdate         Dormant legacy path: retained code for the retired
│                         service worker's optional update bar. No worker is
│                         registered, so the bar never appears in online-only
│                         mode. DOM is built with createElement/textContent only.
├── M67  MaterialViewer   Chapter PDFs open in place inside a hidden, inert
│                         role="dialog" instead of only downloading. isLocalPdf()
│                         accepts relative "materials/*.pdf" only (absolute,
│                         protocol-relative, data: and non-PDF are refused), the
│                         click delegation upgrades the existing chapter links,
│                         and the embedded document is released on close/Escape.
├── M59  HeroMedia        RETIRED — the page loads no hero photo or video.
                          The hero is painted by CSS gradients, the V0 Obsidian
                          grid, and the CyberField canvas. images/backweb.jpg and
                          images/hero-bg.mp4 remain as unused assets;
                          tests/hero-bg.test.js enforces that the legacy layers
                          stay purged.
├── M60  BrandLockup      Top bar gains the platform shield lockup and one clearly
                          primary action (index.html markup + style.css layer —
                          CSS-only module, no script.js block; documented in
                          "The top bar" section below).
├── M61  LectureGuide     #guide — the lecture access guide. script.js renders it
                          from current-semester.js → lectureGuide (bilingual
                          single source of truth): phishing-awareness warning,
                          weekly timetable DERIVED from each subject's
                          meta.schedule (never duplicated), 6 ordered joining
                          steps, 3 real Microsoft endpoints (https only,
                          target="_blank" + rel="noopener noreferrer" + one-tap
                          copy), 5 native <details> troubleshooting entries and
                          an honest note that the real meeting link is published
                          by the department inside Teams. Three surfaces, one
                          data source: the standalone shareable route
                          (#guideBody), a compact inline card in #semester
                          (#semesterGuide — deliberately outside #semesterGrid,
                          so the subject grid is untouched) and a contextual
                          #heroNowGuide link in the HeroNow strip shown only
                          when a class is live, today or tomorrow (MODULE 55).
                          Entry links also sit in the navbar "المزيد" menu, the
                          mobile menu and every subject card (MODULE 00b / 43
                          chips). DOM is built with createElement/textContent
                          only — never raw HTML, never a network call — and the
                          whole view re-renders on locale switch. Covered by
                          tests/lecture-guide.test.js.
├── M72  KaliGuide        #kali — «تثبت كالي»: an illustrated 8-step guide to
                          installing Kali Linux inside VirtualBox. Static
                          markup translated by MODULE 22 (Lang); every string
                          has a data-i18n key in BOTH dicts (ar + en). Four
                          requirement cards, official download links
                          (virtualbox.org / kali.org, https only,
                          target="_blank" + rel="noopener noreferrer"), six
                          local SVG figures in images/kali/ (local assets, honest
                          «not a real screenshot» captions), two LTR command
                          blocks, 5 troubleshooting <details> entries and an
                          ethical-use reminder. Own shareable route (#kali)
                          registered in the ViewSwitcher; link sits in the
                          desktop nav, mobile menu and footer. Layer closed in
                          style.css (MODULE 72) with a ≤900px stack rule,
                           reduced-motion and print rules. Covered by
                           tests/kali-guide.test.js.
└── M80  CyberField       The v2.0.0 identity layer. script.js ships an
                           interactive particle-network canvas
                           (<canvas id="cyberCanvas">, fixed at z-index: -1,
                           pointer-inert) — 40–96 nodes by viewport area,
                           DPR capped at 2, colours read from the live
                           --accent-rgb/--accent-2-rgb tokens, paused on a
                           hidden tab, one static frame under
                           prefers-reduced-motion, clean no-op without a
                           canvas/context. style.css re-declares the
                           platform tokens (V0 Obsidian), moves the ambient
                           wash + engineering grid onto html (body stays
                           transparent so the field reads through), frosts
                           the navbar/cluster/overlays, styles the GitHub
                           CTA (nav-gh), frames the CSS-painted hero behind the
                           neon typography, and self-hosts Inter +
                           JetBrains Mono. The theme switch (M36) and the
                           second palette (M36b) are gone: one identity.
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
  id: "crypto", ico: ICON.key,
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

### Navbar & Brand Layer (MODULE 60 · MODULE 80 · `index.html` + `style.css`)
The top bar is one fixed, frosted surface (`.nav` → `.nav.is-scrolled` grouped
with `backdrop-filter: var(--glass-blur)`) split into `.nav-main` (logo lockup
· links · “المزيد” · updates trigger · primary CTA · GitHub CTA) and
`.nav-actions` (search · language · burger), separated by a logical
inline-start divider.

- **Logo lockup** — `.logo` holds a decorative `.logo-mark` (the same shield
  path `images/icon.svg` is built from, inlined so it needs no extra asset or
  network request) plus a `.logo-word` gradient wordmark. The mark's colours
  are live tokens (`.logo-disc` = `var(--bg)`, `.logo-glyph` = `var(--text)`,
  stops = `var(--accent)` / `var(--accent-2)`), so the navbar mark follows the
  V0 Obsidian palette while the PWA icon keeps its fixed stops.
- **Arabic rule** — a wordmark (or any Arabic text) must keep
  `letter-spacing: 0`; tracking breaks the joins between letters.
- **Primary CTA** — `.nav-cta` reuses the existing `nav.cta` i18n key and the
  `#paths` target. It renders outlined while the bar is transparent (contrast
  over the hero backdrop) and becomes the filled gradient primary once the bar
  frosts; it is hidden ≤1180px, where the mobile menu already carries it.
- **GitHub CTA (MODULE 80)** — `.nav-gh` is a ghost pill linking to
  `https://github.com/motmii/MNCH` (`target="_blank"` + `rel="noopener
  noreferrer"`, bilingual `aria-label`). It keeps media-chrome contrast while
  the bar floats, gains the cyan hover halo once scrolled, and collapses to
  an icon-only circle ≤860px.
- **Glass layer (MODULE 80)** — `.nav-cluster`, `.nav-more-menu` and
  `.mobile-menu` share the same frosted treatment over the CSS-painted hero
  backdrop; legacy `.hero-media` layer rules have been removed.
- The layer is **additive**: no pre-existing selector (`.logo`, `.logo-dot`,
  `.nav-main`, `.nav-actions`) is overridden beyond the intended additions.

### Preloader Fallback
`.preloader` has a CSS keyframe (`preloaderFallback 5s forwards`) that force-hides the overlay after 5 seconds even if JavaScript fails entirely.

### RTL Support
All directional properties use CSS logical equivalents:
- `inset-inline-start/end` instead of `left/right`
- `padding-inline-start/end` instead of `padding-left/right`
- `text-align: start` instead of `text-align: right`
- `transform-origin: right` for nav underline animation

## Service Worker Strategy (retired)
The platform is **online-only**. `index.html` unregisters every legacy worker
and deletes all Cache Storage buckets at boot; nothing calls
`navigator.serviceWorker.register`. `sw.js` and its versioned cache remain in the
repository only so the historical offline-era tests can verify the retired
implementation — it is not a live caching layer.

The retired implementation still documents its old contract for those tests:
navigations were network-first with a cached shell, static assets used
stale-while-revalidate with `ignoreSearch` for `?v=` URLs, and install read
`PRECACHE_REQUESTS` with `cache: "reload"` to avoid HTTP-cache staleness.
