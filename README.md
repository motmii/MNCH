# منصة أمن المعلومات — الترم الحالي

A responsive cybersecurity education platform for Information Security diploma students (دبلوم أمن المعلومات — تجسير مهني, current semester), themed in the platform's **V0 Obsidian** identity — a dark-only `#09090b` canvas with one neon instrument accent family (neon green · cyber cyan · glow purple), hairline structure, frosted-glass chrome, and an interactive particle-network background (MODULE 80 · CyberField). Built as a single-page application with zero dependencies — pure HTML, CSS, and vanilla JavaScript.

## ✨ Features

### Interactive Quiz Engine — practice & exam (Phase 3)
- The current semester follows the **official 5-course plan** (`SUBJECTS` registry, course-code identified); subjects without authored content show an honest Arabic empty state «سيتم إضافة المحتوى قريبًا»
- **6 previous-semester question banks are archived** (not deleted) — 20 questions in total, each tagged with a topic category; every archived card links to its real bank
- **Two explicit modes** — Practice (relaxed) and Timed Exam (per-question countdown); the choice is persisted under the legacy `timed` key so existing preferences survive
- **"Question 3 of 10" progress counter** while playing
- Practice mode: explanation drawer after every answer (auto-opens on mistakes)
- Exam mode: explanations move to the result screen so timing stays fair — a **review-your-mistakes** list shows each missed question with the correct answer and full explanation
- Final score with best-score tracking, answer breakdown (correct / wrong / timed-out / not counted) and a **per-category breakdown** that reveals strengths & weaknesses
- **Retry incorrect questions** — replays only the missed ones (original indexes are kept, so retries compose safely). The subject card in the quiz picker always opens the **full bank**; a missed-only replay runs only from explicit controls (the «راجع أخطاءك» button under the card, the result screen's retry, or the Progress hub)
- **Continue-learning link** on the result screen jumps back to the owning learning path
- Hardened persistence: incomplete or corrupted progress entries are dropped at load; valid progress is never reset (IndexedDB + one-time localStorage migration untouched)
### Phase 4)
- **12 tool cards, each upgraded to an educational component** — every tool now shows AR/EN name, difficulty level, bilingual purpose, safe example input, reset button, copy button (where appropriate), validation + helpful error messages, and a link to the related lesson
- **Accurate safety explanations** — Caesar cipher is "educational only and NOT secure encryption"; JWT decoding "is NOT signature verification" with a "Never paste real tokens" warning; password analyzer "Runs 100% locally" with demo-password advice; vuln/portscan tools carry permission + legality warnings; a global no-real-secrets notice tops the tools section
- **4 hands-on labs** — CTF/Incident Response, Offensive Lab (Bash + SQL + NetLab), Incident Response Center, Interactive Cryptography Lab — each with objective, difficulty, skills practiced, hints, responsible-use warning, and honest manual completion tracking with post-completion explanation
- **Additive architecture** — the original 12 tool cards in HTML are untouched; all educational context is injected dynamically by JS (MODULE 42 · ToolsEdu) from embedded TOOLS_META + LABS_META data, so tool behavior is never rewritten
### Phase 5)
- **Current Semester dashboard (`#semester`) — implemented** — a dedicated view rendered by `script.js` (MODULE 43 · SemesterDashboard) from `window.PLATFORM_CURRENT_SEMESTER` in `current-semester.js` (single source of truth, no data duplication). It shows the semester title, program name, description, subject count and total credit hours, plus one card per official subject: course code, credit hours, weekly day/time schedule, difficulty, estimated study hours, short description, prerequisites, learning outcomes, common mistakes and key terms — with honest links to existing quiz banks (via the `data-quiz-jump` flow), tool cards (`data-tool-jump`) and lab views only; missing entries are never faked. Lesson arrays are currently empty, so each card shows the honest «سيتم إضافة الدروس قريبًا» (lessons will be added soon) empty state until authored lessons ship. The `#semester` route is a real view: desktop and mobile nav links scroll to it, mobile menu closes on tap, Back/Forward work, and opening `…/#semester` directly renders the dashboard (bilingual AR/EN, re-rendered on locale switch).
- **Lecture access guide (`#guide`) — implemented** — MODULE 61 · LectureGuide renders the official "how do I join my live class" walkthrough from `current-semester.js → lectureGuide` (single source of truth): a phishing-awareness warning, the weekly timetable **derived** from each subject's `meta.schedule`, 6 ordered joining steps, 3 real Microsoft endpoints (https only, `target="_blank"` + `rel="noopener noreferrer"`, one-tap copy) and 5 troubleshooting disclosures in native `<details>` — plus an honest note that the actual meeting link is published by the department inside Teams, never here. Reachable from the desktop «المزيد» menu, the mobile menu, a compact inline card in `#semester` (`#semesterGuide`, outside `#semesterGrid`), a chip on every subject card (MODULE 00b / 43), and a contextual link in the hero "Now" strip shown only when a class is live, today or tomorrow (MODULE 55). It is its own shareable `…/#guide` route, fully bilingual, re-rendered on locale switch, DOM built with `createElement`/`textContent` (no raw HTML, no network) — covered by `tests/lecture-guide.test.js`.
- **Kali install guide (`#kali`) — MODULE 72 · KaliGuide** — an illustrated, bilingual, self-contained walkthrough for installing **Kali Linux on VirtualBox**: four requirement cards, official download links only (`virtualbox.org`, `kali.org` — https + `target="_blank"` + `rel="noopener noreferrer"`, SHA256 verification docs), 8 numbered steps each with a local SVG figure in `images/kali/` (honest «رسم توضيحي — ليست لقطة حقيقية» caption) and LTR command blocks (`apt update && full-upgrade`, `virtualbox-guest-x11`), 5 troubleshooting disclosures (VT-x, black screen, resolution, performance, networking) and an ethical-use reminder. The link sits beside **المواد/الاختبارات** in the desktop nav, mobile menu and footer; the view is registered in the ViewSwitcher, all strings have `kali.*` keys in both dictionaries, and the figures ship as local SVGs in `images/kali/` — covered by `tests/kali-guide.test.js`.
- **Course announcements bar (`#announceBar`) — MODULE 74 · AnnouncementsBar** — a dated student-reminder banner (e.g. a short quiz) rendered from the single source of truth `announcements.js` (`window.PLATFORM_ANNOUNCEMENTS`, bilingual, keyed by a real course code that already exists in the official plan). It mounts **outside** every view so it stays visible on all routes, appears only while a reminder is live/today/within its `leadDays` window, and then hides itself. Each entry shows the subject, the long-form date, the clock time, the duration and the honest weight, plus two local actions: **«أضف للتقويم»** (hands a one-off, floating-local-time `.ics` VEVENT — the same RFC 5545 shape as MODULE 69 — to the device calendar, because a static site cannot push real notifications) and a **review** deep-link to the real quiz view. Dismiss is local-only (`motmi-portal:announcements-dismissed`) and never blocks a live/today exam. Timing is day-granular from the visitor's own clock — **no timers, no Notification/Push APIs, no network, no innerHTML** — and MODULE 55 (`HeroNow`) additionally surfaces a red **quiz chip** on the "Now" strip when a dated quiz is near/live/today (`findUrgentQuiz`). Fully bilingual, re-renders on locale switch, and bundled locally — covered by `tests/announcements.test.js`.
- **Single-page SPA preserved** — pure HTML/CSS/JS, no build step
- **AI Assistant** — Arabic-first study assistant (MODULE 33) grounded in the platform's own content. It prefers platform material, adapts to the student's level, gives examples and step-by-step explanations, recommends lessons/tools/quizzes/labs, honestly flags topics outside its content, and refuses (or safely redirects) requests targeting real systems, credential theft, malware or unauthorized access. Ships with Arabic example prompts: «اشرح لي الفرق بين التشفير والترميز», «اختبرني في أساسيات الشبكات», «اشرح لي معنى هذا الجزء من JWT بشكل آمن», «ما المسار المناسب للمبتدئ في أمن المعلومات؟»
- **Optional first-time Onboarding (MODULE 38)** — a skippable 3-step wizard (level → subjects of interest → learning style) that recommends a starting path and lands you on `#path/fundamentals`. No registration required; choice persists in `motmi-portal:onboarding`.
- **Enriched Progress hub** — now aggregates Completed lessons, Quiz attempts, Best scores, Flashcards reviewed, Labs completed, Overall path progress and an Overall %, plus a **Continue learning** resume card and a **Review incorrect answers** action that replays only missed questions (via `MissedBank`).
- **Private-by-design tracking** — new lightweight local counters for lessons viewed (`motmi-portal:lessons`) and flashcards flipped (`motmi-portal:flash`); nothing leaves the device
- **Documentation** — this README + ARCHITECTURE cover purpose, audience, features, setup (frontend/backend), env vars, database, deployment, testing, project structure, security limitations, responsible-use and known limitations
- **No unnecessary personal data** — onboarding collects only learning preferences, stored locally

### Phase 6 — UI/UX refresh
- **Simplified homepage** — one primary CTA («ابدأ التعلم» / Start Learning), a bilingual platform identity block (العربية + English) with a short tagline, and a decluttered hero.
- **"Start Here" strip for new users** — a hero card pointing at the beginner-friendly **Fundamentals** learning path plus a button to replay the intro tour (MODULE 49 reopens the onboarding wizard on demand).
- **Compact learning dashboard (MODULE 47)** — on the homepage: overall progress %, last viewed lesson, next recommended quiz, and a Continue-Learning shortcut. Read-only: quiz/progress logic is untouched.
- **Global search (MODULE 48)** — a command palette (`/` or `Ctrl+K`, or the navbar button) that searches lessons, learning paths, tools, quizzes, flashcards and glossary terms. Fully keyboard navigable (combobox + listbox).
- **Collapsible hubs** — the quiz bank and flashcard grids are wrapped in expandable/collapsible sections to reduce page clutter.
- **Accessibility & mobile** — skip-to-content link, a standardized button system (44px touch targets, one clear primary style), improved mobile drawer, modal and assistant panel behavior, and RTL-safe logical properties throughout.
- **SEO & sharing** — bilingual `<title>` + meta description, canonical URL, JSON-LD structured data, `robots.txt` + `sitemap.xml`, a bilingual custom `404.html`, and Open Graph / Twitter `summary_large_image` metadata pointing at a local 1200×630 card (`images/og-cover.png`).
- **Honest "Coming Soon" states preserved** — empty lessons/paths still show the Arabic «قريبًا» placeholders; no fake content.

### Study & motivation features
- **Motivation (MODULE 50)** — local-only XP, levels, daily goals, streaks and badges derived from real activity; nothing leaves the device.
- **Skill tree (MODULE 51)** — a cybersecurity skill map whose progress meters are computed from real quiz and lesson data.
- **Revision queue (MODULE 52)** — a transparent review queue built from the questions you actually missed; no timers, no notifications, quiz engine untouched.
- **Exam preparation (MODULE 53)** — optional exam date with a day-granular countdown, daily study recommendations, honest per-subject readiness (0.5·quiz + 0.3·lesson coverage + 0.2·mistake-free, with disclosed weight redistribution for subjects without lessons), an untimed practice-exam deck sampled from the real question banks, and weak-topic review links. All data stays in local storage.

### Study tools (v1.22.25)
- **Spaced repetition (MODULE 62 · Srs)** — «مراجعة اليوم» builds a review queue from the questions you **actually missed** (`motmi-portal:missed`) and schedules them with a small SM-2 variant: *نسيتها / صعبة / تذكرتها / سهلة* drives the ease factor (floor 1.3) and the next interval (1 → 3 → `interval·ef` days), a lapse resets the streak, and a card answered well twice graduates out of the queue. State lives in `motmi-portal:srs`; keyboard `1-9` answers, `Enter` grades. No timers, no notifications, nothing invented.
- **Progress backup (MODULE 63 · Backup)** — because privacy means "yours, on this device", progress can now leave the device **with you**: export every platform key (`motmi-portal:*` + the quiz store) as one JSON file, and import it back on another device. Imports are validated (tagged payload, platform keys only, structured values only) before a single byte is written. Still zero network.
- **Full mock exam (MODULE 64 · MockExam)** — one paper built from the **real** banks: 4 questions from every subject, shuffled, with a **single total countdown** (45s/question, clamped 2–90 min) instead of a per-question timer, answers hidden until the end, and a per-subject breakdown on the result screen. It owns its own state and never touches the quiz engine or the missed bank.
- **Accessibility extras (MODULE 65 · A11yExtras)** — `1-9` pick a quiz answer and `Enter` presses «التالي» (only while a question is on screen, never while typing, never while another overlay is open), plus an opt-in **read-aloud flashcards** toggle (`#flashSpeakBtn`) that speaks a card through the browser's own Web Speech API in Arabic and stops when you leave the section.
- **Legacy update prompt (MODULE 66 · SwUpdate)** — retained in `script.js` as a dormant historical path for the retired service worker. Online-only mode never registers a worker, so the «تحديث الآن / لاحقًا» bar is not part of the live experience.
- **In-place chapter reader (MODULE 67 · MaterialViewer)** — chapter PDFs open inside the page in a focus-safe dialog instead of only downloading, with an honest «فتح في تبويب جديد» escape hatch. Only local `materials/*.pdf` paths are ever embedded, and the embedded document is released on close.
- **Install metadata** — `manifest.json` ships **192×192 / 512×512 / 512×512 maskable PNG icons**, real **wide + narrow screenshots** (generated by the dependency-free `tools/make-screenshots.js` PNG encoder), and four **app shortcuts** (ابدأ الاختبارات · مراجعة اليوم · البطاقات التعليمية · أدوات الطالب). CI verifies every manifest asset, exact PNG dimensions, `style.css?v=` / `package.json` / `sw.js` version agreement, and the social-card contract.

### What's New (MODULE 58)
- **Navbar 👍 button** — sits next to «المزيد» and opens a dated **«آخر التحديثات»** popover: the platform changelog sorted newest-first, bilingual (AR/EN), with a locally-stored unread dot. No network, no accounts — everything stays on the device.

### Hero background
- **CSS-first hero** — the homepage is painted by CSS gradients, the V0 Obsidian grid, and the global CyberField particle canvas; the hero downloads no photo or video.
- **Legacy media retired** — `images/backweb.jpg` and `images/hero-bg.mp4` remain in the repo as unused assets but are no longer loaded by the page or precached. `tests/hero-bg.test.js` enforces that the legacy hero layers stay purged.

### Cyber Tools Suite (6 cybersecurity tools)
| Tool | Description |
|------|-------------|
| 🔒 Hash Generator | SHA-256 via Web Crypto + visual fingerprint grid |
| 🔑 Caesar Cipher | Arabic/Latin shift cipher encoder-decoder |
| 🧩 JWT Debugger | Decode header/payload, expiry warnings |
| 🌐 Subnet Calculator | IPv4 CIDR breakdown (network/broadcast/hosts) |
| 🔐 Password Analyzer | Entropy bits + crack-time estimation + checklist |
| 🔁 Encoders | Base64 / Hex / URL encode-decode |

### Flashcards — Study Feature

**6 cybersecurity tools plus 18 flashcards** — the flashcards are a separate learning feature, not part of the interactive tools suite.

- 18 bilingual cybersecurity terms (AR/EN) with flip animations, search and shuffle

### Learning Paths (مسارات التعلم)
- **10 structured paths** covering the full journey: Fundamentals (the recommended starting point) · Computer Networks · Operating Systems & Linux · Cryptography · Web & Application Security · Ethical Hacking & Penetration Testing · Incident Response · CTF & Practical Labs — plus **Digital Forensics** and **Risk Management & Governance** as honest *coming-soon* placeholders (no fake content)
- Every path: AR/EN title & description, difficulty level (beginner / intermediate / advanced), ordered topic list, progress indicator, related quizzes/tools/labs (derived from the topic links — content is never duplicated), and a recommended *up-next* topic
- Topics link straight into the existing platform: quiz subjects (auto-marked done once the subject quiz has a saved result), the 12 interactive tools (deep-jump + scroll & flash), the 4 labs and the flashcards
- Manual topic checkmarks persist locally (`motmi-portal:paths`); deep links like `#path/crypto` work with browser Back/Forward
- A "beginner" 4-step box remains on the paths page, now with a direct *Start the recommended path* CTA

### Lessons (Phase 3)
- Topic pages at `#lesson/<subject>/<lesson>`: beginner-friendly explanation, key concepts, a practical example, common mistakes, and **AR/EN terminology pairs**
- Related practice questions, tools and labs reuse the topic's existing platform links — content is never duplicated
- **Suggested next lesson** follows the learning-path order; topics without authored lessons show a clean, honest placeholder
- No lessons are authored yet (`LESSONS` is currently empty), so every topic page shows the honest Arabic placeholder — no fabricated content; the view is data-driven, so adding one entry to the embedded `LESSONS` object publishes a lesson

### Interactive Labs (معامل المحاكاة)
Fully in-browser, zero-dependency simulation labs (all client-side, GDPR-friendly):
- **Red Team Lab** — a **Bash + SQL** terminal that runs real commands / SQL queries against an in-memory `students` table (try `' OR 1=1 --` and see how parameterization stops it), plus **NetLab** to build a TCP/UDP packet, watch the checksum computed step-by-step and the TTL decremented across router hops on an SVG path
- **Cryptography Lab** — historical ciphers (Vigenère, Enigma), RSA step-by-step, DES first round with real K-box/S-boxes, frequency analysis, and a birthday-attack hash-collision demo
- **IR Center** — a mini **SIEM** dashboard (filterable event table + bar/donut charts + query syntax like `type=brute sev>=high`), a **kill-chain timeline** builder, a **live incident simulator** with a virtual response team, and **Root-Cause-Analysis** challenges
- **CTF challenges** (existing `#games` section) link out from the labs hub

### Progress Hub (تقدمك)
- Reads your locally-saved quiz store and shows a **"continue where you left off"** resume card for any mid-quiz session plus best-score cards per subject
- **«ملاحظاتي» / "My notes" hub (v3.1.4)** — one panel collects every local lesson note (written inside any lesson) with its bilingual lesson and subject titles, a text excerpt, instant diacritics-insensitive **search**, **subject filter chips** with per-subject counts, a **Quick review** card deck over the filtered notes (reveal, wrapped previous/next, Esc and direction-aware arrow keys), inline **Edit** (Ctrl+Enter saves, Esc cancels), per-note **Open lesson** and **Delete** (confirmed) actions, a notes counter in the stats strip, and a one-click **Markdown export** that downloads everything to your device
- Honest empty state until you complete your first quiz; fully private (your device only)

### Study Materials
- Searchable & tag-filterable subject cards
- Download links for summaries, test banks, PDF compilations

### AI Assistant (مساعد المنصة)
- Floating Arabic-first chat assistant — answers from the platform's own content (subjects, quiz rules, tools, flashcard terms, CTF lab)
- Runs entirely in the browser via a local knowledge engine after the page loads; the conversation never leaves the browser
- Optional LLM mode: point `window.PLATFORM_AI.endpoint` at your own server proxy — API keys stay server-side (see `ASSISTANT.md`)

### PWA metadata (online-only)
- Web App Manifest (`manifest.json`) with 192/512/maskable PNG icons and install shortcuts
- Apple touch icon + 1200×630 social card
- **No service worker:** `index.html` unregisters legacy workers and clears Cache Storage at boot; `sw.js` is a retired historical record kept for the test suite, not registered.

## 🚀 Getting Started

1. Open `index.html` in any modern browser.
2. Serve over `https://` or `localhost` for the manifest, social metadata, and local fonts.

```bash
# Example: serve locally
npx serve .
# or
python -m http.server 8080
```

## 📁 Project Structure

```
MNCH/
├── index.html          # Single-page shell (RTL Arabic, bilingual AR/EN)
├── style.css           # V0 Obsidian stylesheet (RTL · glass · neon · CyberField)
├── ui-overhaul.css/js  # Additive UI refinement layer loaded after the core
├── motion.css/js       # Optional GSAP/ScrollTrigger/Lenis motion layer
├── script.js           # All application logic (one modular IIFE)
├── current-semester.js # Official curriculum data (window.PLATFORM_CURRENT_SEMESTER)
├── announcements.js    # Dated course reminders (window.PLATFORM_ANNOUNCEMENTS)
├── assistant.js        # Local-first AI assistant (MODULE 33)
├── worker.js           # Web Worker (entropy/hash off the main thread)
├── sw.js               # Retired service worker (historical only; not registered)
├── manifest.json       # PWA manifest (PNG icons + screenshots + shortcuts)
├── robots.txt          # Crawl rules + sitemap pointer
├── sitemap.xml         # Canonical URL index
├── 404.html            # Bilingual custom GitHub Pages 404
├── data/
│   └── quizzes.json    # Question bank (fetched at runtime)
├── images/
│   ├── mnch-logo.webp  # Navbar crest (512px, optimized)
│   ├── icon-32.png     # Browser favicon
│   ├── icon-192.png    # PWA icon 192×192
│   ├── icon-512.png    # PWA icon 512×512
│   ├── icon-maskable-512.png # Maskable PWA icon 512×512
│   ├── apple-touch-icon.png  # iOS home-screen icon 180×180
│   ├── og-cover.png    # 1200×630 Open Graph / Twitter card
│   ├── screenshots/    # Manifest screenshots (wide + narrow)
│   ├── algorithms.svg  # Current-semester subject thumbnails (×5)
│   ├── os-concepts.svg
│   ├── policies-ethics.svg
│   ├── it-components.svg
│   ├── security-design.svg
│   ├── kali/           # Kali guide figures (local SVGs)
│   ├── flashcards/     # Flashcard illustrations (×18 SVGs)
│   ├── backweb.jpg     # Legacy hero photo (unused)
│   └── hero-bg.mp4     # Legacy hero loop (unused)
├── fonts/              # Self-hosted Inter + IBM Plex Sans Arabic
├── vendor/             # Local GSAP, ScrollTrigger and Lenis copies
├── materials/          # Course PDFs served by the static host
├── tests/              # Zero-dependency Node test suites (run: npm test)
├── .github/workflows/  # CI — runs all suites on every push/PR
├── ASSISTANT.md        # AI assistant setup & optional LLM proxy guide
├── ARCHITECTURE.md     # Module map & data contracts
├── CONTRIBUTING.md     # How to contribute (bilingual)
├── package.json        # Release version + test script
├── LICENSE             # MIT
└── README.md
```

## 🧪 Testing

Zero-dependency test suites (plain Node.js, nothing to install):

```bash
npm test                     # runs every suite in tests/
node tests/full-boot.test.js # or run a single suite
```

CI runs the same suites on every push and pull request, including guards for every precached asset, exact PWA/OG image dimensions, release-version agreement, and the social-card metadata.

## 🤝 Contributing

Contributions are welcome — this repo is open source for students! See [CONTRIBUTING.md](CONTRIBUTING.md) for content rules (bilingual strings, honest «قريبًا» states, safety wording), local setup, and PR guidelines.

## 📄 License

Released under the [MIT License](LICENSE) — free to use, study, modify and share.

## 🎨 Design System

The identity is **V0 Obsidian** (v2.0.0) — a near-black `#09090b` canvas with
one neon instrument accent family (neon green · cyber cyan · glow purple),
hairline `rgba(255,255,255,0.1)` structure, and true frosted glass on the
navbar, overlays and foreground cards. It is **dark-only by design**: the
former light theme (Parchment) and the second palette (Ocean) were removed
in v2.0.0, so the platform ships one carefully built identity — `:root`
holds it, `<html data-theme="dark">` pins it, and there is no pre-paint
theme script at all (nothing to flash).

Every text/background pair was measured against WCAG AA on the obsidian
surfaces; the worst text pair in the set sits at **5.7:1** (`--dim` on
`--surface`). Semantic states (ok / bad / warn) stay outside the accent hue
so meaning never rides the neon, and the primary ribbon (`--grad`) stays
light in the single theme so it always carries dark ink (`--on-grad`).

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#09090B` | Page background (html paints it; body stays transparent) |
| `--surface` / `--surface-2` | `#101014` / `#17171C` | Cards & alt fills |
| `--text` / `--muted` / `--dim` | `#FAFAFA` / `#A1A1AA` / `#8B8B95` | Body, secondary & tertiary text (17.9:1 · 7.2:1 · 5.7:1) |
| `--accent` | `#3DF5A5` (12.7:1) | Primary accent — neon green (actions, focus, data) |
| `--accent-2` | `#6EE7FF` (12.3:1) | Cyber cyan — eyebrow/heading text & secondary marks |
| `--accent-3` | `#B79CFF` (7.6:1) | Glow purple — tertiary marks |
| `--grad` | `linear-gradient(135deg, #3DF5A5, #2BD98F 55%, #17BF7C)` — carries **ink** text (`--on-grad` `#04150D`) | Primary buttons / brand ribbon |
| `--glass` / `--glass-blur` | `rgba(255,255,255,0.03)` / `blur(14px) saturate(1.35)` | Glassmorphism (navbar, cluster, overlays, command centre) |
| `--ok` / `--bad` / `--warn` | `#4ADE80` / `#F87171` / `#FBBF24` | Semantic states — intentionally **not** the accent |
| `--on-media` / `--on-media-2` | `#F4F4F5` / `#A1A1AA` | Ink over the hero backdrop, which carries a dark scrim |
| `--hue-sat` / `--hue-light` | `68%` / `64%` | Five per-subject accent hues declared in `script.js`; only the hue travels in JS, so the ramp follows the identity for free |
| `--shadow-rgb` | `0 0 0` | Every shadow and dark scrim composes its alpha from this one ink |
| `--font-display` / `--font-body` | `"Inter"` with `"IBM Plex Sans Arabic"` for Arabic glyphs (both self-hosted) | Headings & body — Inter ships no Arabic, so the pair is seamless |
| `--font-mono` | `"JetBrains Mono"` (self-hosted, variable) | Data, codes, micro-labels |

**Ambient CyberField canvas (MODULE 80)**: a fixed `<canvas id="cyberCanvas">`
sits at `z-index: -1` behind every section — a slow particle constellation
(40–96 nodes by viewport area, device-pixel-ratio capped at 2) that links
nearby nodes and leans toward the pointer. It reads its colours from the
live tokens (`--accent-rgb` / `--accent-2-rgb`), pauses on a hidden tab,
draws a single static frame under `prefers-reduced-motion`, and is fully
pointer-inert (`pointer-events: none`, `aria-hidden="true"`). The `html`
element paints the obsidian wash + engineering grid while `body` stays
transparent, so the field reads through every glass surface above it
without ever sitting above content.

**Navbar & brand (MODULE 60 + MODULE 80)**: the top bar is one fixed,
frosted surface with three groups — logo lockup · links (`المزيد` dropdown
+ updates trigger) · actions (search · language · burger) — plus a
**View on GitHub** ghost CTA (`nav-gh` → `https://github.com/motmii/MNCH`)
that sits beside the primary CTA and collapses to an icon-only circle on
narrow bars. The logo is the **same shield mark the favicon & PWA icon
use**, inlined and token-tinted (no extra asset), beside a gradient
wordmark; Arabic text keeps `letter-spacing: 0` because tracking would
break the letter joins. One **primary CTA** (`nav.cta` → `#paths`) closes
the bar: outlined over the hero backdrop, filled once the bar frosts, and
hidden ≤1180px where the mobile menu already carries it. The scrolled bar,
the `.nav-cluster` capsule, the `.nav-more-menu` dropdown and the mobile
drawer are all true glass (`backdrop-filter: var(--glass-blur)`), and the
CSS-painted hero stays a faint texture behind the neon typography.

V0 Obsidian single identity · CyberField particle canvas · Frosted glass chrome · RTL layout · Custom cursor · GitHub CTA

## ♿ Accessibility

- Keyboard navigation (`:focus-visible` outlines)
- ARIA labels on dynamic content (`role="status"`, `role="timer"`)
- Reduced-motion support (`prefers-reduced-motion`)
- RTL logical properties throughout

---

Designed & Developed by **Ahmed Motmi** — `motmi757@gmail.com`

---

## 🌐 Deployment

This is a **fully static site** — no build step, no server, no dependencies. It works on any static host:

- **GitHub Pages**: push to `main`, then enable *Settings → Pages → Deploy from branch* (root). All asset paths are relative, so project sites (`user.github.io/repo/`) work out of the box.
- Any static server locally: `npx serve .` or `python -m http.server 8080`.

An optional Node.js/Express backend (accounts, synced progress) is maintained separately and is **not required** — the static frontend is fully functional without it (a network connection is required to load the site).

---

## Architecture Notes

- **Persistence**: Quiz progress/results in IndexedDB (`motmi-portal` DB). Legacy localStorage migrates automatically.
- **Data**: Question bank loaded from `data/quizzes.json` via `fetch()` — an embedded fallback bank ships in `script.js`. Flashcard terms are embedded in `script.js` (there is no `data/flashcards.json`).
- **Web Worker**: Password entropy and hash computations offloaded to `worker.js` (graceful fallback to main thread).
- **Learning modules**: `index.html` adds the Current Semester dashboard (`#semester`, rendered from `window.PLATFORM_CURRENT_SEMESTER` by MODULE 43), Learning Paths (`#paths` + shared detail view `#path`), the Labs hub (`#labs`) linking to the Red Team (`#redteam`), Cryptography (`#cryptolab`), IR (`#ir`) and CTF (`#games`) labs, plus a Progress hub (`#progress`) and About (`#about`) — all wired in `script.js` (MODULE 36 theme switch, MODULE 37 paths/progress/about, MODULE 39 structured learning paths, MODULE 43 semester dashboard, plus the Red Team · IR · Crypto · tools block).
- **Contact Form**: Submits via Formspree API with honeypot spam protection.
- **AI Assistant**: `assistant.js` (MODULE 33) — Arabic-first chat widget grounded in platform content, local-first by default; optional server-side LLM proxy via `window.PLATFORM_AI.endpoint` (see `ASSISTANT.md`).
- **Online-only**: no service worker is registered; legacy registrations are removed and Cache Storage is cleared at boot. `sw.js` is retained only as a historical test fixture.
