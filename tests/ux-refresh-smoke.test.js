"use strict";
/**
 * UI/UX refresh smoke test (Phase 6 — MODULE 47 HeroDash + MODULE 48 GlobalSearch).
 * Validates the hero brand (AR+EN), Start Here strip, compact dashboard mounts,
 * search dialog, collapsible hubs, skip link, SEO/OG meta, the duplicate
 * current-semester.js regression fix, i18n key coverage (ar + en), new CSS,
 * and the service-worker cache bump.
 * Run: node tests/ux-refresh-smoke.test.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

console.log("— index.html: hero & identity —");
check("platform brand AR+EN", html.includes("hero-brand-ar") && html.includes("Information Security Platform"));
check("short tagline (data-i18n hero.tagline)", html.includes('data-i18n="hero.tagline"'));
check("primary CTA is Start Learning", html.includes('href="#paths" class="btn btn-primary btn-lg'));
check("Start Here strip mounts #heroStartHere", html.includes('id="heroStartHere"'));
check("Start Here links to Fundamentals path", html.includes('href="#path/fundamentals"'));
check("onboarding reopen trigger present", html.includes("data-onboarding-reopen"));

console.log("— index.html: compact dashboard —");
["heroDash", "heroDashTitle", "heroDashWelcome", "heroDashPct", "heroDashBar", "heroDashOverallMeter",
 "heroDashPath", "heroDashPathMeta", "heroDashPathBar", "heroDashPathMeter", "heroDashPathLink",
 "heroDashLesson", "heroDashLessonMeta", "heroDashTasks", "heroDashTasksMeta", "heroDashLast",
 "heroDashQuiz", "heroDashContinue", "heroDashEmpty", "heroDashEmptyLink",
 "heroDashMotivation", "motivationTitle", "heroDashLevel", "heroDashLevelTitle", "heroDashXp",
 "heroDashXpBar", "heroDashXpMeter", "heroDashXpNext", "heroDashDaily", "heroDashDailyBar",
 "heroDashDailyMeter", "heroDashWeekly", "heroDashWeeklyBar", "heroDashWeeklyMeter",
 "heroDashStreak", "heroDashBadges", "heroDashBadgeCount", "heroDashReset"].forEach((id) => {
  check("mounts #" + id, html.includes('id="' + id + '"'));
});
check("progress bar role=progressbar", html.includes('role="progressbar"'));

console.log("— index.html: global search —");
["searchOpenBtn", "searchOverlay", "searchDialog", "searchInput", "searchResults", "searchClose"].forEach((id) => {
  check("mounts #" + id, html.includes('id="' + id + '"'));
});
check("dialog uses role=dialog + aria-modal", html.includes('id="searchDialog" class="search-dialog" role="dialog" aria-modal="true"'));
check("input uses combobox pattern", html.includes('role="combobox"'));
check("results list uses listbox role", html.includes('role="listbox"'));

console.log("— index.html: collapsible hubs & a11y —");
check("quiz hub collapsible", html.includes('data-i18n="collapsible.showQuizzes"'));
check("flashcards hub collapsible", html.includes('data-i18n="collapsible.showCards"'));
check("skip link present", html.includes('class="skip-link"') && html.includes('data-i18n="a11y.skip"'));

console.log("— index.html: navbar brand lockup + primary CTA (MODULE 60) —");
check("logo lockup wraps a mark + a wordmark",
  html.includes('class="logo-mark"') && html.includes('class="logo-word"'));
check("wordmark + accent dot share one line box (baseline kept)",
  /class="logo-text"><span class="logo-word">/.test(html));
check("logo mark is decorative (aria-hidden inside the named link)",
  /class="logo-mark" aria-hidden="true"/.test(html));
check("logo mark reuses the same shield path as images/icon.svg",
  html.includes("M50 12 L82 24 V52 C82 71 68 84 50 90 C32 84 18 71 18 52 V24 Z"));
check("logo mark colours come from theme tokens (no hardcoded dark rect)",
  html.includes('class="logo-disc"') && html.includes('class="logo-glyph"'));
check("navbar CTA present, reusing the existing nav.cta key",
  html.includes('class="btn btn-primary btn-sm nav-cta"') && html.includes('data-i18n="nav.cta"'));
check("navbar CTA sits after the updates trigger and before nav-actions", (() => {
  const cta = html.indexOf("nav-cta");
  return cta > html.indexOf("navUpdates") && cta < html.indexOf('class="nav-actions"');
})());

console.log("— index.html: SEO —");
check("Open Graph metadata", html.includes('property="og:title"') && html.includes('property="og:description"') && html.includes('property="og:image"'));
check("canonical link", html.includes('rel="canonical"'));
check("Twitter card metadata", html.includes('name="twitter:card"'));
check("JSON-LD structured data", html.includes('application/ld+json'));
check("bilingual title", html.includes("منصة أمن المعلومات | Information Security Platform"));
check("hero background preloaded", html.includes('rel="preload" as="image" href="images/backweb.jpg"'));

console.log("— index.html: regressions —");
check("current-semester.js loaded exactly once", html.split('src="current-semester.js"').length - 1 === 1);
check("assistant.js deferred", html.includes('src="assistant.js" defer'));
console.log("— script.js: modules —");
check("MODULE 47 HeroDash present", js.includes("initHeroDash"));
check("MODULE 48 GlobalSearch present", js.includes("initGlobalSearch"));
check("MODULE 49 ReopenOnboarding present", js.includes("initReopenOnboarding"));
check("last-lesson tracking hook in showLesson", js.includes("st2ok.last = { key: lkey"));
check("flashcard glossary exposed for search", js.includes("window.PLATFORM_FLASH_TERMS"));
check("search index reads real path data", js.includes("window.getLearningPaths"));
check("search index reads quiz bank", js.includes("quizEntries"));
check("quiz results can deep-start (data-quiz attr)", js.includes("data-quiz"));
check("placeholder i18n support added", js.includes("data-i18n-placeholder"));
check("meta description localized", js.includes('meta[name="description"]'));

console.log("— script.js: i18n coverage (both locales) —");
const NEW_KEYS = [
  "meta.description", "a11y.skip", "hero.tagline", "hero.ctaSemester",
  "starthere.title", "starthere.desc", "starthere.cta", "starthere.wizard",
  "dash.progressLabel", "dash.lastLesson", "dash.nextQuiz", "dash.continue",
  "dash.continueFresh", "dash.noLesson", "dash.resumeQuiz", "dash.newQuiz", "dash.allDone",
  "dash.kicker", "dash.welcomeNew", "dash.welcomeBack", "dash.welcomeEmpty", "dash.welcomeActive",
  "dash.overall", "dash.overallAria", "dash.currentPath", "dash.pathAria", "dash.pathProgress",
  "dash.pathNext", "dash.pathComplete", "dash.noPath", "dash.noPathBody", "dash.nextLesson",
  "dash.lessonSoon", "dash.lessonReady", "dash.pending", "dash.pendingCounts", "dash.readyCounts",
  "dash.pendingQuiz", "dash.pendingLab", "dash.allCaughtUp", "dash.emptyBody", "dash.emptyCta",
  "dash.openPath", "dash.lastOpened", "dash.continueLabel",
  "motivation.kicker", "motivation.level", "motivation.levelTitle.1", "motivation.levelTitle.6",
  "motivation.xp", "motivation.xpNext", "motivation.levelAria", "motivation.dailyGoal",
  "motivation.weeklyGoal", "motivation.goalValue", "motivation.dailyAria", "motivation.weeklyAria",
  "motivation.streak", "motivation.streakHint", "motivation.streakDays", "motivation.achievements",
  "motivation.achievementsCount", "motivation.locked", "motivation.unlocked", "motivation.reset",
  "motivation.resetNote", "motivation.resetConfirm",
  "motivation.badge.firstLesson", "motivation.badge.firstLessonDesc",
  "motivation.badge.firstQuiz", "motivation.badge.firstQuizDesc",
  "motivation.badge.quizMaster", "motivation.badge.quizMasterDesc",
  "motivation.badge.labExplorer", "motivation.badge.labExplorerDesc",
  "motivation.badge.cryptoApprentice", "motivation.badge.cryptoApprenticeDesc",
  "motivation.badge.networkNavigator", "motivation.badge.networkNavigatorDesc",
  "motivation.badge.incidentResponder", "motivation.badge.incidentResponderDesc",
  "motivation.badge.streak7", "motivation.badge.streak7Desc",
  "motivation.badge.semesterFinisher", "motivation.badge.semesterFinisherDesc",
  "collapsible.showQuizzes", "collapsible.showCards",
  "search.title", "search.placeholder", "search.hint", "search.empty", "search.start",
  "search.group.lesson", "search.group.path", "search.group.tool", "search.group.quiz",
  "search.group.flash", "search.group.term"
];
["ar", "en"].forEach((loc) => {
  const scoped = js.slice(js.indexOf(loc + ": {", js.indexOf("const DICT")));
  NEW_KEYS.forEach((key) => {
    const re = new RegExp('"' + key.replace(/\./g, "\\.") + '":');
    check('"' + key + '" in ' + loc, re.test(scoped));
  });
});

console.log("— style.css: new component styles —");
[".hero-brand", ".hero-start", ".hero-dash", ".hero-command", ".hero-dash-head", ".hero-dash-panel",
 ".hero-dash-empty", ".hero-dash-link", ".search-toggle", ".search-dialog",
 ".search-panel", ".search-option", ".collapsible", ".skip-link", ".sr-only",
 ".btn-lg", ".search-flash", ".hero-dash-motivation", ".motivation-top", ".motivation-level",
 ".motivation-goals", ".motivation-goal", ".motivation-badges", ".motivation-badge",
 ".motivation-reset-row", ".hero-dash-bar.is-xp"].forEach((sel) => {
  check("style for " + sel, css.includes(sel));
});
console.log("— style.css: MODULE 60 navbar brand layer —");
[".logo-mark", ".logo-word", ".logo-text", ".logo-shield", ".logo-disc", ".logo-glyph",
 ".logo-stop-a", ".logo-stop-b", ".nav-cta"].forEach((sel) => {
  check("style for " + sel, css.includes(sel));
});
check("module markers present",
  css.includes("MODULE 60 · BrandLockup") && css.includes("END MODULE 60 · BrandLockup"));
check("wordmark keeps Arabic letter-spacing at 0",
  /\.logo-word\s*\{[\s\S]{0,320}letter-spacing: 0;/.test(css));
check("wordmark clips the shared text gradient",
  /\.logo-word\s*\{[\s\S]{0,520}background: var\(--grad-text\);/.test(css));
check("light theme re-paints both logo gradient stops",
  css.includes('[data-theme="light"] .logo-mark .logo-stop-a') &&
  css.includes('[data-theme="light"] .logo-mark .logo-stop-b'));
check("CTA outlined while the bar is transparent (contrast over the photo)",
  /\.nav:not\(\.is-scrolled\) \.nav-cta\s*\{[\s\S]{0,220}border-color: rgba\(255, 255, 255, 0\.42\);/.test(css));

console.log("— style.css: navbar rhythm & motion tokens —");
check("one spacing rhythm declared on .nav (8 · 12 · 20 · 32)",
  /\.nav\s*\{[\s\S]{0,700}--nav-rhythm-xs: 0\.5rem;[\s\S]{0,200}--nav-rhythm-sm: 0\.75rem;[\s\S]{0,200}--nav-rhythm-md: 1\.25rem;[\s\S]{0,200}--nav-rhythm-lg:/.test(css));
check("the three bar groups consume the tokens, not hard-coded gaps",
  /\.nav-main\s*\{\s*gap: var\(--nav-rhythm-lg\);\s*\}/.test(css) &&
  /\.nav-links\s*\{\s*gap: var\(--nav-rhythm-md\);\s*\}/.test(css) &&
  /\.nav-actions\s*\{\s*gap: var\(--nav-rhythm-xs\); padding-inline-start: var\(--nav-rhythm-xs\); \}/.test(css));
check("lockup gap is the same 8px step as the icon row",
  /\.logo\s*\{[\s\S]{0,200}gap: var\(--nav-rhythm-xs\);/.test(css));
check("one transition duration for the whole bar (300ms + one curve)",
  /--nav-dur: 0\.3s;/.test(css) && /--nav-ease: cubic-bezier\(0\.16, 1, 0\.3, 1\);/.test(css) &&
  /\.nav-links a,[\s\S]{0,260}transition-duration: var\(--nav-dur\);[\s\S]{0,90}transition-timing-function: var\(--nav-ease\);/.test(css));
check("CTA, toggles, updates trigger and «المزيد» are all covered",
  /\.nav-actions > button,[\s\S]{0,80}\.nav-updates \.updates-toggle,[\s\S]{0,80}\.nav-more-details > summary \{/.test(css));
check("density step ≤1320px re-points the same tokens",
  /@media \(max-width: 1320px\) \{\s*\.nav \{\s*--nav-rhythm-lg: 1rem;\s*--nav-rhythm-md: var\(--nav-rhythm-sm\);/.test(css));
check("≤1180px still resets the actions divider (layer-order guard)",
  /@media \(max-width: 1180px\) \{\s*\/\*[\s\S]{0,320}\.nav-actions \{ padding-inline-start: 0; \}/.test(css));
check("scrolled CTA hover halo is token-based (--glow)",
  /\.nav\.is-scrolled \.nav-cta:hover \{\s*box-shadow:[\s\S]{0,220}0 0 0 3px var\(--glow\);/.test(css));
check("reduced motion switches every bar transition off",
  /prefers-reduced-motion[\s\S]{0,300}\.nav-cta,\s*\.nav-links a,[\s\S]{0,220}\{ transition: none; \}/.test(css));
check("CTA hidden where the burger menu carries it",
  /@media \(max-width: 1180px\)[\s\S]{0,200}\.nav-cta\s*\{\s*display: none;\s*\}/.test(css));
check("reduced-motion guard for the CTA",
  /prefers-reduced-motion[\s\S]{0,320}\.nav-cta,/.test(css));

check("mobile assistant panel rule", css.includes("max-height: 72dvh"));
check("mobile drawer scrollable", css.includes("overflow-y: auto"));

console.log("— sw.js: cache —");
const verMatch = sw.match(/CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/);
check("cache version >= v1.22.0", !!verMatch && (+verMatch[1] > 1 || (+verMatch[1] === 1 && +verMatch[2] >= 22)));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);

