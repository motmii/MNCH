# المساهمة في المنصة · Contributing

هذه المنصة مفتوحة المصدر لطلاب دبلوم أمن المعلومات — مساهماتك مرحّب بها! 💜
This platform is open source for Information Security diploma students — contributions are welcome!

## طرق المساهمة · Ways to contribute

- **إضافة أسئلة** لبنوك الأسئلة في `data/quizzes.json` — Add questions to the quiz banks
- **تأليف دروس** جديدة — Author new lessons (add an entry to the `LESSONS` object in `script.js`)
- **إضافة مصطلحات** للبطاقات التعليمية — Add flashcard terms
- **إصلاح أخطاء** لغوية أو تقنية — Fix typos, translation issues, or bugs
- **تحسين إمكانية الوصول** (Accessibility) والتصميم — Improve a11y & design

## قواعد المحتوى · Content rules

1. **الصدق أولًا** — Never fake content. If something isn't ready, use the honest «قريبًا» (coming soon) empty state.
2. **ثنائي اللغة** — All user-facing strings need both Arabic (`ar`) and English (`en`) versions.
3. **الأمان التعليمي** — Tools must keep their safety wording (e.g. Caesar is "educational only, NOT secure encryption"; JWT decoding "is NOT signature verification"). Never request real secrets, tokens, or passwords from users.
4. **الخصوصية** — Everything runs client-side. No tracking, no personal data leaves the device.
5. **بدون اعتماديات** — Zero-dependency vanilla HTML/CSS/JS. No build step, no frameworks.

## التطوير محليًا · Local development

```bash
# Serve locally (any static server works)
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080` (or the printed port).

## الاختبارات · Running tests

All tests are plain Node.js scripts — no dependencies needed:

```bash
npm test            # runs every suite in tests/
# or a single suite:
node tests/full-boot.test.js
```

**Please run `npm test` before opening a pull request** — CI runs the same suites.

## بنية الكود · Code structure

- `index.html` — the single page (all sections/views)
- `script.js` — all logic, organized as numbered MODULEs inside one IIFE (see `ARCHITECTURE.md` for the module map)
- `style.css` — full stylesheet (dark + light themes, RTL-first)
- `current-semester.js` — the official curriculum data (`window.PLATFORM_CURRENT_SEMESTER`), single source of truth for the `#semester` dashboard
- `data/quizzes.json` — the question bank (an embedded fallback ships in `script.js`)
- `sw.js` — service worker; **bump `CACHE_VERSION` whenever you change any shipped asset**

## إرشادات الـ Pull Request · PR guidelines

- وصف واضح لما تغيّر ولماذا — a clear description of what & why
- لقطات شاشة للتغييرات المرئية — screenshots for visual changes
- اختبار واحد على الأقل للميزات الجديدة — at least a smoke test for new features
- Commit messages by convention are welcome (`feat:`, `fix:`, `docs:`…) but not enforced

شكرًا لمساهمتك في تعليم أمن المعلومات! 🚀
Thank you for helping teach cybersecurity!
