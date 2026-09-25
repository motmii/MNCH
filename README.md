# منصة أمن المعلومات — الترم الحالي

A responsive, dark-themed cybersecurity education platform for Information Security diploma students (دبلوم أمن المعلومات — تجسير مهني, current semester). Built as a single-page application with zero dependencies — pure HTML, CSS, and vanilla JavaScript.

## ✨ Features

### Interactive Quiz Engine — practice & exam (Phase 3)
- The current semester follows the **official 5-course plan** (`SUBJECTS` registry, course-code identified); subjects without authored content show an honest Arabic empty state «سيتم إضافة المحتوى قريبًا»
- **6 previous-semester question banks are archived** (not deleted) — 20 questions in total, each tagged with a topic category; every archived card links to its real bank
- **Two explicit modes** — Practice (relaxed) and Timed Exam (per-question countdown); the choice is persisted under the legacy `timed` key so existing preferences survive
- **"Question 3 of 10" progress counter** while playing
- Practice mode: explanation drawer after every answer (auto-opens on mistakes)
- Exam mode: explanations move to the result screen so timing stays fair — a **review-your-mistakes** list shows each missed question with the correct answer and full explanation
- Final score with best-score tracking, answer breakdown (correct / wrong / timed-out / not counted) and a **per-category breakdown** that reveals strengths & weaknesses
- **Retry incorrect questions** — replays only the missed ones (original indexes are kept, so retries compose safely)
- **Continue-learning link** on the result screen jumps back to the owning learning path
- Hardened persistence: incomplete or corrupted progress entries are dropped at load; valid progress is never reset (IndexedDB + one-time localStorage migration untouched)
### Phase 4)
- **12 tool cards, each upgraded to an educational component** — every tool now shows AR/EN name, difficulty level, bilingual purpose, safe example input, reset button, copy button (where appropriate), validation + helpful error messages, and a link to the related lesson
- **Accurate safety explanations** — Caesar cipher is "educational only and NOT secure encryption"; JWT decoding "is NOT signature verification" with a "Never paste real tokens" warning; password analyzer "Runs 100% locally" with demo-password advice; vuln/portscan tools carry permission + legality warnings; a global no-real-secrets notice tops the tools section
- **4 hands-on labs** — CTF/Incident Response, Offensive Lab (Bash + SQL + NetLab), Incident Response Center, Interactive Cryptography Lab — each with objective, difficulty, skills practiced, hints, responsible-use warning, and honest manual completion tracking with post-completion explanation
- **Additive architecture** — the original 12 tool cards in HTML are untouched; all educational context is injected dynamically by JS (MODULE 42 · ToolsEdu) from embedded TOOLS_META + LABS_META data, so tool behavior is never rewritten
### Phase 5)
- **Current Semester dashboard (`#semester`) — implemented** — a dedicated view rendered by `script.js` (MODULE 43 · SemesterDashboard) from `window.PLATFORM_CURRENT_SEMESTER` in `current-semester.js` (single source of truth, no data duplication). It shows the semester title, program name, description, subject count and total credit hours, plus one card per official subject: course code, credit hours, weekly day/time schedule, difficulty, estimated study hours, short description, prerequisites, learning outcomes, common mistakes and key terms — with honest links to existing quiz banks (via the `data-quiz-jump` flow), tool cards (`data-tool-jump`) and lab views only; missing entries are never faked. Lesson arrays are currently empty, so each card shows the honest «سيتم إضافة الدروس قريبًا» (lessons will be added soon) empty state until authored lessons ship. The `#semester` route is a real view: desktop and mobile nav links scroll to it, mobile menu closes on tap, Back/Forward work, and opening `…/#semester` directly renders the dashboard (bilingual AR/EN, re-rendered on locale switch).
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
- **SEO** — bilingual `<title>` + meta description, Open Graph / Twitter cards, canonical URL, JSON-LD structured data, and a preloaded hero image.
- **Honest "Coming Soon" states preserved** — empty lessons/paths still show the Arabic «قريبًا» placeholders; no fake content.

### Study & motivation features
- **Motivation (MODULE 50)** — local-only XP, levels, daily goals, streaks and badges derived from real activity; nothing leaves the device.
- **Skill tree (MODULE 51)** — a cybersecurity skill map whose progress meters are computed from real quiz and lesson data.
- **Revision queue (MODULE 52)** — a transparent review queue built from the questions you actually missed; no timers, no notifications, quiz engine untouched.
- **Exam preparation (MODULE 53)** — optional exam date with a day-granular countdown, daily study recommendations, honest per-subject readiness (0.5·quiz + 0.3·lesson coverage + 0.2·mistake-free, with disclosed weight redistribution for subjects without lessons), an untimed practice-exam deck sampled from the real question banks, and weak-topic review links. All data stays in local storage.

### What's New (MODULE 58)
- **Navbar 👍 button** — sits next to «المزيد» and opens a dated **«آخر التحديثات»** popover: the platform changelog sorted newest-first, bilingual (AR/EN), with a locally-stored unread dot. No network, no accounts — everything stays on the device.

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
- 6 authored lessons ship today (networks ×2, crypto ×2, secure coding, ethics); the view is data-driven — add one entry to the embedded `LESSONS` object to publish more

### Interactive Labs (معامل المحاكاة)
Fully in-browser, zero-dependency simulation labs (all client-side, GDPR-friendly):
- **Red Team Lab** — a **Bash + SQL** terminal that runs real commands / SQL queries against an in-memory `students` table (try `' OR 1=1 --` and see how parameterization stops it), plus **NetLab** to build a TCP/UDP packet, watch the checksum computed step-by-step and the TTL decremented across router hops on an SVG path
- **Cryptography Lab** — historical ciphers (Vigenère, Enigma), RSA step-by-step, DES first round with real K-box/S-boxes, frequency analysis, and a birthday-attack hash-collision demo
- **IR Center** — a mini **SIEM** dashboard (filterable event table + bar/donut charts + query syntax like `type=brute sev>=high`), a **kill-chain timeline** builder, a **live incident simulator** with a virtual response team, and **Root-Cause-Analysis** challenges
- **CTF challenges** (existing `#games` section) link out from the labs hub

### Progress Hub (تقدمك)
- Reads your locally-saved quiz store and shows a **"continue where you left off"** resume card for any mid-quiz session plus best-score cards per subject
- Honest empty state until you complete your first quiz; fully private (your device only)

### Study Materials
- Searchable & tag-filterable subject cards
- Download links for summaries, test banks, PDF compilations

### AI Assistant (مساعد المنصة)
- Floating Arabic-first chat assistant — answers from the platform's own content (subjects, quiz rules, tools, flashcard terms, CTF lab)
- Works fully offline via a local knowledge engine; the conversation never leaves the browser
- Optional LLM mode: point `window.PLATFORM_AI.endpoint` at your own server proxy — API keys stay server-side (see `ASSISTANT.md`)

### PWA Ready
- Service Worker for offline caching
- Web App Manifest (`manifest.json`)
- Installable on mobile/desktop

## 🚀 Getting Started

1. Open `index.html` in any modern browser.
2. For full PWA support, serve over `https://` or `localhost`.

```bash
# Example: serve locally
npx serve .
# or
python -m http.server 8080
```

## 📁 Project Structure

```
nova-studio/
├── index.html          # Main page (RTL Arabic) — includes Learning Paths, Labs hub, IR center, Progress & About
├── style.css           # Full stylesheet (dark + light themes, RTL)
├── script.js           # All application logic (modular IIFE) incl. MODULE 36/37/39/40 (theme, paths/progress, structured paths, lessons + quiz upgrades) + Red Team · IR · Crypto labs
├── current-semester.js # Official current-semester curriculum data (window.PLATFORM_CURRENT_SEMESTER) — consumed by the #semester dashboard (MODULE 43)
├── assistant.js        # AI assistant — MODULE 33 (local engine + widget UI)
├── worker.js           # Web Worker (entropy/hash off the main thread)
├── sw.js               # Service Worker (offline caching)
├── manifest.json       # PWA manifest
├── data/
│   └── quizzes.json    # Question bank (fetched at runtime)
├── images/
│   ├── icon.svg        # Favicon
│   ├── icon-maskable.svg # PWA icon
│   ├── backweb.jpg     # Hero background
│   ├── algorithms.svg  # Current-semester subject thumbnails (×5)
│   ├── os-concepts.svg
│   ├── policies-ethics.svg
│   ├── it-components.svg
│   ├── security-design.svg
│   └── flashcards/     # Flashcard illustrations (×18 SVGs)
├── tests/              # Zero-dependency Node test suites (run: npm test)
├── .github/workflows/  # CI — runs all suites on every push/PR
├── ASSISTANT.md        # AI assistant setup & optional LLM proxy guide
├── ARCHITECTURE.md     # Module map & data contracts
├── CONTRIBUTING.md     # How to contribute (bilingual)
├── LICENSE             # MIT
└── README.md
```

## 🧪 Testing

Zero-dependency test suites (plain Node.js, nothing to install):

```bash
npm test                     # runs every suite in tests/
node tests/full-boot.test.js # or run a single suite
```

CI runs the same suites on every push and pull request, plus a guard that verifies every asset precached by the service worker actually exists.

## 🤝 Contributing

Contributions are welcome — this repo is open source for students! See [CONTRIBUTING.md](CONTRIBUTING.md) for content rules (bilingual strings, honest «قريبًا» states, safety wording), local setup, and PR guidelines.

## 📄 License

Released under the [MIT License](LICENSE) — free to use, study, modify and share.

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#07070d` | Page background |
| `--surface` | `#12121e` | Card backgrounds |
| `--accent` | `#8b5cf6` | Primary accent (violet) |
| `--accent-2` | `#22d3ee` | Secondary accent (cyan) |
| `--accent-3` | `#f472b6` | Tertiary accent (pink) |
| `--font-display` | Tajawal / Space Grotesk | Headings |
| `--font-body` | Tajawal / Inter | Body text |

Dark cyber theme · Glassmorphism · RTL layout · Custom cursor · Particle canvas

**Theme switcher**: a navbar toggle flips between a dark-by-default theme and a light educational theme. The choice is persisted, an explicit stored choice wins, and otherwise the OS `prefers-color-scheme` is followed (with a pre-paint script to prevent any flash of the wrong theme).

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

- **GitHub Pages**: push to `main`, then enable *Settings → Pages → Deploy from branch* (root). All asset paths and the service-worker scope are relative, so project sites (`user.github.io/repo/`) work out of the box.
- Any static server locally: `npx serve .` or `python -m http.server 8080`.

An optional Node.js/Express backend (accounts, synced progress) is maintained separately and is **not required** — the platform is fully functional offline-first without it.

---

## Architecture Notes

- **Persistence**: Quiz progress/results in IndexedDB (`motmi-portal` DB). Legacy localStorage migrates automatically.
- **Data**: Question bank loaded from `data/quizzes.json` via `fetch()` — an embedded fallback bank ships in `script.js`. Flashcard terms are embedded in `script.js` (there is no `data/flashcards.json`).
- **Web Worker**: Password entropy and hash computations offloaded to `worker.js` (graceful fallback to main thread).
- **Learning modules**: `index.html` adds the Current Semester dashboard (`#semester`, rendered from `window.PLATFORM_CURRENT_SEMESTER` by MODULE 43), Learning Paths (`#paths` + shared detail view `#path`), the Labs hub (`#labs`) linking to the Red Team (`#redteam`), Cryptography (`#cryptolab`), IR (`#ir`) and CTF (`#games`) labs, plus a Progress hub (`#progress`) and About (`#about`) — all wired in `script.js` (MODULE 36 theme switch, MODULE 37 paths/progress/about, MODULE 39 structured learning paths, MODULE 43 semester dashboard, plus the Red Team · IR · Crypto · tools block).
- **Contact Form**: Submits via Formspree API with honeypot spam protection.
- **AI Assistant**: `assistant.js` (MODULE 33) — Arabic-first chat widget grounded in platform content, fully offline by default; optional server-side LLM proxy via `window.PLATFORM_AI.endpoint` (see `ASSISTANT.md`).
- **Offline**: Service Worker precaches all static assets including JSON data files and the hero background (`images/backweb.jpg`).
