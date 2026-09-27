"use strict";
/**
 * Phase 6 runtime test — MODULE 47 · HeroDash, MODULE 48 · GlobalSearch and
 * MODULE 49 · ReopenOnboarding.
 *
 * ux-refresh-smoke.test.js validates the SOURCE; this file EXECUTES the whole
 * script.js in a stubbed browser (same approach as full-boot.test.js) and
 * proves the three modules really work:
 *   1. the hero dashboard paints real values and the honest no-lesson state,
 *   2. it repaints when the question bank arrives (async fallback),
 *   3. the Continue-Learning shortcut deep-starts the recommended bank,
 *   4. "/" and Ctrl+K open the search dialog, Esc closes it (never while typing),
 *   5. typing renders grouped results from the real bank/glossary data and
 *      Enter deep-starts the picked quiz,
 *   6. [data-onboarding-reopen] replays the wizard through the MODULE 38 bridge,
 *   7. data-i18n-placeholder + <meta name="description"> are localized (MODULE 22).
 * Run: node tests/hero-dash-search.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const cs = require(path.join(root, "current-semester.js"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

/* Value of an Arabic dictionary entry — assertions compare the RENDERED text
   with the real dictionary value instead of duplicating UI strings. */
const dictArSrc = js.slice(js.indexOf("const DICT"), js.indexOf("en: {"));
function arValue(key) {
  const re = new RegExp('"' + key.replace(/\./g, "\\.") + '":\\s*"((?:[^"\\\\]|\\\\.)*)"');
  const m = re.exec(dictArSrc);
  return m ? m[1].replace(/\\"/g, '"') : "";
}

/* ---------- DOM stub (attributes + innerHTML + listeners) ---------- */
function makeEl(id) {
  const el = {
    id, _html: "", _text: "", attrs: {}, dataset: {}, listeners: {}, children: [],
    style: {}, hidden: false, focused: false,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); return this._s.has(c); },
    },
    setAttribute(k, v) {
      el.attrs[k] = String(v);
      if (k.indexOf("data-") === 0) {
        el.dataset[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = String(v);
      }
    },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; },
    removeAttribute(k) { delete el.attrs[k]; },
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { el.children.push(c); return c; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    contains() { return false; },
    scrollIntoView() {}, focus() { el.focused = true; }, blur() {}, click() {},
    remove() { el.removed = true; },
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html; }, set(v) { el._html = String(v); } });
  Object.defineProperty(el, "textContent", { get() { return el._text; }, set(v) { el._text = String(v); } });
  return el;
}

const ids = [
  "preloader", "nav", "navBurger", "mobileMenu", "langToggle", "themeToggle", "toTop",
  "quizApp", "flashGrid", "flashSearch", "flashShuffle", "flashEmpty", "subjectSearch", "resultsCount", "emptyState", "subjectsGrid",
  "progressApp", "heroContinue", "heroContinueMeta", "heroContinueBtn",
  "pathsGrid", "pathDetailBody", "lessonBody", "lessonView",
  "semesterGrid", "semesterMeta",
  "hero", "semester", "paths", "path", "subjects", "tools", "labs", "flash", "quiz",
  "progress", "games", "redteam", "ir", "cryptolab", "about", "contact", "lesson",
  "heroStartHere", "heroDash", "heroDashTitle", "heroDashWelcome", "heroDashPct", "heroDashBar", "heroDashOverallMeter",
  "heroDashPath", "heroDashPathMeta", "heroDashPathBar", "heroDashPathMeter", "heroDashPathLink",
  "heroDashLesson", "heroDashLessonMeta", "heroDashTasks", "heroDashTasksMeta", "heroDashLast",
  "heroDashQuiz", "heroDashContinue", "heroDashEmpty", "heroDashEmptyLink",
  "searchOpenBtn", "searchOverlay", "searchDialog", "searchInput", "searchResults", "searchClose",
  "onboardingOverlay", "onboardingBack", "onboardingSkip", "onboardingNext", "onboardingStart",
  "assistantRoot", "assistantPanel", "assistantFab",
];
const byId = {};
ids.forEach((id) => { byId[id] = makeEl(id); });
["tool-hash", "tool-caesar", "tool-jwt", "tool-cidr", "tool-password", "tool-encoders",
 "tool-playground", "tool-vuln", "tool-portscan", "tool-sniffer", "tool-fw", "tool-b64"
].forEach((id) => {
  byId[id] = Object.assign(makeEl(id), {
    querySelector(sel) { return sel === ".tool-title" ? { textContent: { trim: () => id } } : null; },
  });
});

/* The result list parses its own innerHTML so the selection logic
   (aria-activedescendant) can be asserted. */
byId.searchResults.querySelectorAll = function (sel) {
  if (sel !== ".search-option") return [];
  const blocks = String(byId.searchResults.innerHTML).match(/<li class="search-option"[^>]*>/g) || [];
  return blocks.map((b) => {
    const id = (/id="([^"]*)"/.exec(b) || [])[1] || "";
    const di = (/data-i="([^"]*)"/.exec(b) || [])[1] || "";
    const o = makeEl(id);
    o.setAttribute("data-i", di);
    return o;
  });
};

const docListeners = {};
const dispatchErrors = [];
const mainEl = makeEl("main");
const metaDescEl = makeEl("meta-description");
const documentStub = {
  getElementById(id) { return byId[id] || null; },
  querySelector(sel) {
    if (sel === "main") return mainEl;
    if (sel === 'meta[name="description"]') return metaDescEl;
    return null;
  },
  querySelectorAll(sel) {
    if (sel === "[data-i18n-placeholder]") return [byId.searchInput];
    return [];
  },
  addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
  removeEventListener() {},
  dispatchEvent(ev) {
    (docListeners[ev && ev.type] || []).forEach((fn) => {
      try { fn(ev); } catch (e) { dispatchErrors.push(String((e && e.message) || e)); }
    });
    return true;
  },
  createElement() { return makeEl(""); },
  documentElement: { setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, style: { setProperty() {} }, lang: "ar", dir: "rtl" },
  body: makeEl("body"),
  title: "",
  readyState: "complete",
};

const storage = {};
const localStorageStub = {
  getItem(k) { return storage[k] !== undefined ? storage[k] : null; },
  setItem(k, v) { storage[k] = String(v); },
  removeItem(k) { delete storage[k]; },
};
const windowStub = {
  PLATFORM_CURRENT_SEMESTER: cs,
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
  requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  location: { hash: "", href: "http://localhost/" },
  history: { pushState() {}, replaceState() {} },
  scrollTo() {}, getComputedStyle() { return {}; },
  localStorage: localStorageStub,
  navigator: { language: "ar", serviceWorker: undefined },
  CustomEvent: function (type, opts) { return { type, detail: opts && opts.detail }; },
  IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
  MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  Worker: undefined,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  setTimeout, clearTimeout, setInterval, clearInterval,
  innerWidth: 1280, innerHeight: 800,
};
const sandbox = Object.assign(windowStub, {
  console,
  window: windowStub,
  document: documentStub,
  localStorage: localStorageStub,
  navigator: windowStub.navigator,
  location: windowStub.location,
  history: windowStub.history,
  CustomEvent: windowStub.CustomEvent,
  IntersectionObserver: windowStub.IntersectionObserver,
  MutationObserver: windowStub.MutationObserver,
  matchMedia: windowStub.matchMedia,
  requestAnimationFrame: windowStub.requestAnimationFrame,
  fetch: windowStub.fetch,
  setTimeout, clearTimeout, setInterval, clearInterval,
  indexedDB: undefined,
});
vm.createContext(sandbox);

/* The real index.html ships these initial states — mirror them. */
byId.searchDialog.setAttribute("aria-hidden", "true");
byId.searchOverlay.hidden = true;
byId.searchInput.setAttribute("data-i18n-placeholder", "search.placeholder");

/* ---------- boot the whole script.js ---------- */
console.log("— full boot —");
let threw = null;
try { vm.runInContext(js, sandbox, { filename: "script.js" }); } catch (e) { threw = e; }
check("full script.js executes without throwing", !threw);
if (threw) console.error("    → " + threw.message);

/* ---------- MODULE 22 · placeholder + meta description i18n ---------- */
console.log("— MODULE 22 · localized placeholder & SEO description —");
check("search placeholder localized from data-i18n-placeholder",
  byId.searchInput.getAttribute("placeholder") === arValue("search.placeholder"));
check("<meta name=description> localized",
  metaDescEl.getAttribute("content") === arValue("meta.description"));

/* ---------- MODULE 48 · closed on load ---------- */
console.log("— MODULE 48 · GlobalSearch —");
check("dialog starts closed (aria-hidden=true)", byId.searchDialog.getAttribute("aria-hidden") === "true");
check("overlay starts hidden", byId.searchOverlay.hidden === true);

/* ---------- MODULE 38/49 · reopen bridge ---------- */
console.log("— MODULE 38/49 · onboarding reopen bridge —");
check("window.NovaOnboarding.open exposed by MODULE 38",
  !!sandbox.NovaOnboarding && typeof sandbox.NovaOnboarding.open === "function");

/* ---------- async part: the bank arrives, then real interactions ---------- */
(async function main() {
  await new Promise((r) => setTimeout(r, 60)); /* let the embedded bank fallback land */

  /* Spies installed AFTER boot — the modules read them at click time. */
  const started = [];
  const activated = [];
  sandbox.startQuiz = (key) => { started.push(key); };
  sandbox.NovaViews.activate = (view) => { activated.push(view); };

  /* ---------- MODULE 47 · HeroDash (real data) ---------- */
  console.log("— MODULE 47 · HeroDash (after the bank arrives) —");
  const banks = sandbox.QUIZZES || {};
  const bankKeys = Object.keys(banks);
  check("dashboard sees the real question banks", bankKeys.length === 5);
  const firstKey = bankKeys[0];
  const realPaths = sandbox.getLearningPaths();
  const recommendedPath = realPaths.filter((p) => p.recommended)[0];
  const realLabs = [...new Set(realPaths.flatMap((p) => (p.topics || []).map((t) => t.res).filter((r) => r && r.k === "lab").map((r) => r.view)))];
  check("overall % painted (no saved results yet)", byId.heroDashPct.textContent === "0");
  check("progress bar width matches the %", byId.heroDashBar.style.width === "0%");
  check("new-student welcome + useful empty state are shown",
    byId.heroDashTitle.textContent === arValue("dash.welcomeNew") && byId.heroDashEmpty.hidden === false);
  check("current path uses the real recommended path",
    byId.heroDashPath.textContent === recommendedPath.title.ar &&
    byId.heroDashPathLink.getAttribute("href") === "#path/" + recommendedPath.id);
  check("next lesson is a real path topic with an honest coming-soon note",
    byId.heroDashLesson.textContent === recommendedPath.topics[0].t.ar &&
    byId.heroDashLessonMeta.textContent === arValue("dash.lessonSoon"));
  check("unfinished quiz/lab counts come from real data",
    byId.heroDashTasks.textContent === arValue("dash.readyCounts")
      .replace("{quizzes}", String(bankKeys.length)).replace("{labs}", String(realLabs.length)));
  check("last-lesson context stays honest for a new student",
    byId.heroDashLast.textContent === arValue("dash.noLesson"));
  check("next-quiz cell shows the REAL subject name",
    byId.heroDashQuiz.textContent === "الخوارزميات" && banks[firstKey].name === "الخوارزميات");
  check("Continue CTA deep-starts that bank (data-quiz)",
    byId.heroDashContinue.getAttribute("data-quiz") === firstKey &&
    byId.heroDashContinue.getAttribute("href") === "#quiz");
  check("fresh visitor gets the start-now label",
    byId.heroDashContinue.textContent === arValue("dash.continueFresh"));
  byId.heroDashContinue.listeners.click[0]({ preventDefault() {} });
  check("CTA click activates the quiz view and starts the recommended bank",
    activated.indexOf("quiz") >= 0 && started[0] === firstKey);

  /* ---------- MODULE 48 · GlobalSearch behaviour ---------- */
  console.log("— MODULE 48 · GlobalSearch behaviour —");
  const keydown = (init) => documentStub.dispatchEvent(Object.assign({ type: "keydown", preventDefault() {} }, init));
  keydown({ key: "/", target: { tagName: "DIV" } });
  check("'/'' opens the dialog", byId.searchDialog.getAttribute("aria-hidden") === "false" &&
    byId.searchDialog.classList.contains("is-open"));
  check("overlay + body scroll lock applied", byId.searchOverlay.hidden === false &&
    documentStub.body.classList.contains("search-open"));
  check("combobox expanded + honest start hint",
    byId.searchInput.getAttribute("aria-expanded") === "true" &&
    byId.searchResults.innerHTML.indexOf(arValue("search.start")) >= 0);

  byId.searchInput.value = "الخوارزميات";
  byId.searchInput.listeners.input[0]({});
  const html1 = byId.searchResults.innerHTML;
  check("results are grouped (search.group.quiz) and typed as options",
    html1.indexOf('class="search-group"') >= 0 && html1.indexOf(arValue("search.group.quiz")) >= 0 &&
    html1.indexOf('class="search-option"') >= 0 && html1.indexOf('role="option"') >= 0);
  check("the real bank name is found", html1.indexOf("الخوارزميات") >= 0);
  check("first hit is pre-selected", byId.searchInput.getAttribute("aria-activedescendant") === "searchOpt0");

  byId.searchInput.listeners.keydown[0]({ key: "Enter", preventDefault() {} });
  check("Enter picks the result: quiz view + deep-start + dialog closed",
    activated.indexOf("quiz") >= 0 && started.indexOf(firstKey) >= 0 &&
    byId.searchDialog.getAttribute("aria-hidden") === "true" && byId.searchOverlay.hidden === true);

  keydown({ key: "k", ctrlKey: true, target: { tagName: "DIV" } });
  check("Ctrl+K reopens the dialog", byId.searchDialog.getAttribute("aria-hidden") === "false");
  byId.searchInput.value = "ا";
  byId.searchInput.listeners.input[0]({});
  const optionCount = (byId.searchResults.innerHTML.match(/<li class="search-option"/g) || []).length;
  byId.searchInput.listeners.keydown[0]({ key: "ArrowDown", preventDefault() {} });
  check("↑↓ moves the selection (" + optionCount + " options)",
    optionCount > 1 && byId.searchInput.getAttribute("aria-activedescendant") === "searchOpt1");
  keydown({ key: "Escape", target: { tagName: "DIV" } });
  check("Esc closes the dialog and releases the scroll lock",
    byId.searchDialog.getAttribute("aria-hidden") === "true" &&
    !documentStub.body.classList.contains("search-open"));
  keydown({ key: "/", target: { tagName: "INPUT" } });
  check("'/' never hijacks typing inside a form field",
    byId.searchDialog.getAttribute("aria-hidden") === "true");

  /* ---------- MODULE 49 · ReopenOnboarding ---------- */
  console.log("— MODULE 49 · ReopenOnboarding —");
  let reopened = 0;
  const realApi = sandbox.NovaOnboarding;
  sandbox.NovaOnboarding = { open() { reopened++; } };
  const triggerTarget = { closest: (sel) => (sel === "[data-onboarding-reopen]" ? { nodeType: 1 } : null) };
  documentStub.dispatchEvent({ type: "click", target: triggerTarget, preventDefault() {} });
  check("[data-onboarding-reopen] replays the wizard through the bridge", reopened === 1);
  documentStub.dispatchEvent({ type: "click", target: { closest: () => null }, preventDefault() {} });
  check("an unrelated click never reopens the wizard", reopened === 1);
  sandbox.NovaOnboarding = realApi;
  check("the real bridge resets to step 1 and shows the overlay", (function () {
    let shown = false;
    const overlayEl = byId.onboardingOverlay;
    const origSet = overlayEl.setAttribute;
    overlayEl.setAttribute = function (k, v) { if (k === "aria-hidden" && String(v) === "false") shown = true; return origSet.call(overlayEl, k, v); };
    try { realApi.open(); } catch (e) { return false; }
    overlayEl.setAttribute = origSet;
    return shown;
  })());

  /* ---------- MODULE 47 · state matrix (sliced, stubbed store) ---------- */
  console.log("— MODULE 47 · HeroDash state matrix (isolated slice) —");
  const dashSrc = js.slice(js.indexOf("(function initHeroDash()"), js.indexOf("(function initGlobalSearch()"));
  check("MODULE 47 slice extracted (ends before MODULE 48)",
    dashSrc.length > 500 && dashSrc.indexOf("initGlobalSearch") < 0);

  /**
   * Run the REAL MODULE 47 against a stubbed data source.
   * @param {Object} state {banks,results,progress,store,paths,subMap,subjects}
   * @returns {{els:Object,calls:{activate:string[],start:string[]}}} Result.
   */
  function runDash(state) {
    const els = {};
    [
      "heroDashPct", "heroDashBar", "heroDashOverallMeter", "heroDashTitle", "heroDashWelcome",
      "heroDashPath", "heroDashPathMeta", "heroDashPathBar", "heroDashPathMeter", "heroDashPathLink",
      "heroDashLesson", "heroDashLessonMeta", "heroDashTasks", "heroDashTasksMeta", "heroDashLast",
      "heroDashQuiz", "heroDashContinue", "heroDashEmpty"
    ].forEach((id) => { els[id] = makeEl(id); });
    const calls = { activate: [], start: [] };
    const dict = {};
    [
      "dash.noLesson", "dash.continue", "dash.continueFresh", "dash.resumeQuiz", "dash.newQuiz",
      "dash.allDone", "dash.welcomeNew", "dash.welcomeBack", "dash.welcomeEmpty", "dash.welcomeActive",
      "dash.overall", "dash.overallAria", "dash.noPath", "dash.noPathBody", "dash.pathProgress",
      "dash.pathNext", "dash.pathComplete", "dash.pathAria", "dash.lessonSoon", "dash.lessonReady",
      "dash.pendingCounts", "dash.readyCounts", "dash.pendingQuiz", "dash.pendingLab",
      "dash.allCaughtUp", "dash.lastOpened", "labs.redteam", "labs.ir", "labs.crypto", "labs.games"
    ].forEach((key) => { dict[key] = arValue(key); });
    const win = {
      Lang: {
        current: "ar",
        t(k, p) {
          let s = (k in dict) ? dict[k] : k;
          if (p) Object.keys(p).forEach((x) => { s = s.split("{" + x + "}").join(String(p[x])); });
          return s;
        },
        onSwitch() {},
      },
      QUIZZES: state.banks || {},
      readStore: () => ({ results: state.results || {}, progress: state.progress || {} }),
      PLATFORM_STORE: { get: (k) => (state.store && state.store[k]) || null },
      getLearningPaths: () => state.paths || [],
      SUBJECT_TO_PATH: state.subMap || {},
      PLATFORM_SUBJECTS: state.subjects || [],
      NovaViews: { activate: (v) => calls.activate.push(v) },
      startQuiz: (k) => calls.start.push(k),
      setTimeout, clearTimeout,
    };
    const ctx = {
      console, window: win, setTimeout, clearTimeout,
      document: { getElementById: (id) => els[id] || null, addEventListener() {} },
    };
    vm.createContext(ctx);
    vm.runInContext(dashSrc, ctx, { filename: "module47.js" });
    return { els: els, calls: calls };
  }

  const banks2 = { b1: { name: "بنك ألفا", questions: [1, 2, 3] }, b2: { name: "بنك بيتا", questions: [1, 2, 3] } };

  const r1 = runDash({ banks: banks2 });
  check("empty store → 0% + new-student welcome and no-path state",
    r1.els.heroDashPct.textContent === "0" &&
    r1.els.heroDashTitle.textContent === arValue("dash.welcomeNew") &&
    r1.els.heroDashPath.textContent === arValue("dash.noPath") &&
    r1.els.heroDashLesson.textContent === arValue("dash.noPath") &&
    r1.els.heroDashEmpty.hidden === false);

  const r2 = runDash({ banks: banks2, results: { b1: { score: 2, total: 3, pct: 67 } } });
  check("saved result → mean % painted on the bar",
    r2.els.heroDashPct.textContent === "67" && r2.els.heroDashBar.style.width === "67%");
  check("un-attempted bank recommended next (new-quiz label)",
    r2.els.heroDashQuiz.textContent === arValue("dash.newQuiz").replace("{sub}", "بنك بيتا") &&
    r2.els.heroDashContinue.getAttribute("data-quiz") === "b2");
  check("returning visitor gets the continue label",
    r2.els.heroDashContinue.textContent === arValue("dash.continue"));

  const r3 = runDash({ banks: banks2, results: { b1: { pct: 67 }, b2: { pct: 33 } } });
  check("all banks attempted → mean % of both banks", r3.els.heroDashPct.textContent === "50");
  check("lowest score recommended next", r3.els.heroDashContinue.getAttribute("data-quiz") === "b2");

  const r4 = runDash({ banks: banks2, progress: { b2: { idx: 1, total: 3 } } });
  check("mid-quiz session → resume label + resume action",
    r4.els.heroDashQuiz.textContent === arValue("dash.resumeQuiz").replace("{sub}", "بنك بيتا") &&
    r4.els.heroDashContinue.getAttribute("data-action") === "resume" &&
    r4.els.heroDashContinue.getAttribute("data-subject") === "b2");
  r4.els.heroDashContinue.listeners.click[0]({ preventDefault() {} });
  check("resume shortcut activates the quiz view and resumes the session",
    r4.calls.activate.indexOf("quiz") >= 0 && r4.calls.start[0] === "b2");

  const r5 = runDash({
    banks: banks2,
    paths: [{ id: "fundamentals", title: { ar: "الأساسيات", en: "Fundamentals" }, topics: [{ id: "x", t: { ar: "مقدمة في الأمن", en: "Intro" }, lsn: { sub: "s1", key: "t1" } }] }],
    subMap: { s1: "fundamentals" },
    store: { lessons: { last: { sub: "s1", topic: "t1" } } },
  });
  check("next learning step resolves from the real learning-path data",
    r5.els.heroDashLesson.textContent === "مقدمة في الأمن" &&
    r5.els.heroDashLessonMeta.textContent === arValue("dash.lessonSoon"));
  check("last opened lesson remains visible in the continue panel",
    r5.els.heroDashLast.textContent === arValue("dash.lastOpened").replace("{title}", "مقدمة في الأمن"));

  const r6 = runDash({ banks: banks2, paths: [], subMap: {}, store: { lessons: { last: { sub: "s1", topic: "t1" } } } });
  check("unresolvable last lesson → honest label (never a fake title)",
    r6.els.heroDashLast.textContent === arValue("dash.noLesson") &&
    r6.els.heroDashLesson.textContent === arValue("dash.noPath"));

  const r7 = runDash({
    banks: banks2,
    paths: [{
      id: "fundamentals", title: { ar: "الأساسيات", en: "Fundamentals" },
      topics: [
        { id: "done", t: { ar: "موضوع مكتمل", en: "Done topic" } },
        { id: "lab", t: { ar: "تدريب عملي", en: "Practice" }, res: { k: "lab", view: "redteam" } },
      ],
    }],
    store: { paths: { done: { fundamentals: { done: true } } }, labs: { done: {} } },
  });
  check("manual path progress + unfinished lab render from existing stores",
    r7.els.heroDashPathBar.style.width === "50%" &&
    r7.els.heroDashTasks.textContent === arValue("dash.pendingCounts").replace("{quizzes}", "2").replace("{labs}", "1") &&
    r7.els.heroDashTasksMeta.textContent.indexOf(arValue("dash.pendingLab").replace("{name}", arValue("labs.redteam"))) >= 0 &&
    r7.els.heroDashEmpty.hidden === true);

  /* ---------- shared safety net ---------- */
  check("no delegated listener threw during the interactions", dispatchErrors.length === 0);
  if (dispatchErrors.length) console.error("    → " + dispatchErrors.join(" | "));

  console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
  process.exit(failures ? 1 : 0);
})();

