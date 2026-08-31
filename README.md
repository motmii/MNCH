# منصة أمن المعلومات — الترم الثاني

A responsive, dark-themed cybersecurity education platform for diploma students (Semester 2). Built as a single-page application with zero dependencies — pure HTML, CSS, and vanilla JavaScript.

## ✨ Features

### Interactive Quiz Engine
- 6 subjects · 20 questions in total, with instant feedback
- **Timed Exam Mode** with per-question countdown timer
- Detailed answer explanations (collapsible drawers) on wrong answers
- **localStorage persistence**: resume mid-quiz, track best scores
- Subject picker with best-score / resume badges

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
├── index.html          # Main page (RTL Arabic)
├── style.css           # Full stylesheet (dark theme + RTL)
├── script.js           # All application logic (modular IIFE)
├── assistant.js        # AI assistant — MODULE 33 (local engine + widget UI)
├── worker.js           # Web Worker (entropy/hash off the main thread)
├── sw.js               # Service Worker (offline caching)
├── manifest.json       # PWA manifest
├── data/
│   └── quizzes.json    # Question bank (fetched at runtime)
├── images/
│   ├── icon.svg        # Favicon
│   ├── icon-maskable.svg # PWA icon
│   ├── network-sec.svg # Subject thumbnails (×6 SVGs)
│   ├── os-sec.svg
│   ├── crypto-viz.svg
│   ├── db-sec.svg
│   ├── secure-code.svg
│   └── hack-viz.svg
├── ASSISTANT.md        # AI assistant setup & optional LLM proxy guide
├── ARCHITECTURE.md     # Module map & data contracts
└── README.md
```

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

## ♿ Accessibility

- Keyboard navigation (`:focus-visible` outlines)
- ARIA labels on dynamic content (`role="status"`, `role="timer"`)
- Reduced-motion support (`prefers-reduced-motion`)
- RTL logical properties throughout

---

Designed & Developed by **Ahmed Motmi** — `motmi757@gmail.com`

---

## 🚀 Backend API

A production-grade REST backend for this platform lives in [`backend/`](backend/README.md):

- **Node.js + Express + PostgreSQL** with JWT auth (refresh-token rotation) and RBAC (Student / Instructor / Admin)
- **5 domains**: users & roles · question bank & exams · student progress & tracking · SRS flashcards · CTF lab
- Full schema in `backend/db/schema.sql`, seeded demo data via `npm run db:init`, live at `http://localhost:5000`

Quick start:

```bash
cd backend
cp .env.example .env
npm install
npm run db:init   # needs PostgreSQL (docker compose up -d db)
npm run dev
```

---

## Architecture Notes

- **Persistence**: Quiz progress/results in IndexedDB (`motmi-portal` DB). Legacy localStorage migrates automatically.
- **Data**: Question bank loaded from `data/quizzes.json` via `fetch()` — an embedded fallback bank ships in `script.js`. Flashcard terms are embedded in `script.js` (there is no `data/flashcards.json`).
- **Web Worker**: Password entropy and hash computations offloaded to `worker.js` (graceful fallback to main thread).
- **Contact Form**: Submits via Formspree API with honeypot spam protection.
- **AI Assistant**: `assistant.js` (MODULE 33) — Arabic-first chat widget grounded in platform content, fully offline by default; optional server-side LLM proxy via `window.PLATFORM_AI.endpoint` (see `ASSISTANT.md`).
- **Offline**: Service Worker precaches all static assets including JSON data files.
