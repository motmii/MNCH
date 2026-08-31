# Architecture — منصة أمن المعلومات

## Overview
Single-page application (SPA) built with zero dependencies. All code runs client-side. No build step required.

## Module Map (`script.js`)

```
Main IIFE ("use strict")
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
├── M13  QuizEngine       6 subjects · 20 questions total, with explanations
│    ├── renderPicks()     Subject picker w/ best-score & resume badges
│    ├── startQuiz()       Start or resume from saved progress
│    ├── showQuestion()    Timer bar, ARIA options group, feedback area
│    ├── handleAnswer()    Grade, sfx, explanation drawer
│    ├── timeoutAnswer()   Auto-fail on timer expiry
│    ├── finishQuestion()  Shared tail: progress save + next button
│    └── showResult()      Final score + best-score persistence
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
├── M27  SalawatToast     24h-dismissible reminder toast (bottom-right)
├── M28  SalawatBanner    Slim auto-hiding top banner (nav offset aware)
├── M29  Tools.Flash      18 bilingual flashcards (study feature — separate
│                         from the 6-tool suite; terms embedded, no JSON)
├── M30  Stats.Live       Hero counters from real data + quiz jump links
├── M31  Nav.ToTop        Back-to-top button (appears after 600px)
└── M32  Nav.ScrollSpy    Highlights the section in view via aria-current
```

`M33 · AI.Assistant` lives in its own file, `assistant.js` (loaded after
`script.js`) — a floating Arabic-first assistant with a local knowledge
engine and an optional server-side LLM proxy. See `ASSISTANT.md`.

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
| Navigations | Network-first → cached index.html fallback |
| Same-origin statics | Cache-first → network + runtime cache |
| Cross-origin fonts | Stale-while-revalidate |

Cache versioning: bump `CACHE_VERSION` in `sw.js` to invalidate.
