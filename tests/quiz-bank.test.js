"use strict";
/**
 * MODULE 98 · بنك الفترات test — past-quiz reference bank & revision sheet.
 * Part A validates data/quiz-bank.json outright (refs = question + answer
 * reference items; entries = full MCQ engines questions). Part B boots the
 * whole script.js with a disk-served fetch and verifies the real merge,
 * the dedicated bank hub (MODULE 99: one panel outside the subject grid,
 * rows that open the sheet directly), and the unified
 * revision sheet render through the live delegated click handler. Part C
 * re-boots with an EMPTY bank to prove a graceful, invisible failure.
 * The engine (startQuiz) must never run a refs-only bank. Source checks
 * pin the wiring.
 * Run: node tests/quiz-bank.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const cs = require(path.join(root, "current-semester.js"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  \u2713 " + name);
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}

/* ============================================================
   Part A · data/quiz-bank.json is a valid bank contract
   ============================================================ */
const OFFICIAL = ["260210030702", "260210030802", "260210030902", "260210031002", "260210031102"];
let bank = null;
try { bank = JSON.parse(fs.readFileSync(path.join(root, "data", "quiz-bank.json"), "utf8")); }
catch (e) { /* keep null */ }
check("quiz-bank.json parses", bank !== null);
check("version is 1", !!(bank && bank.version === 1));
check("_readme explains both shapes", !!(bank && typeof bank._readme === "object" && Array.isArray(bank._readme.how_to_add) && bank._readme.how_to_add.length >= 2));
check("entries is an array (may be empty until options arrive)", Array.isArray(bank && bank.entries));
check("refs is an array with real pasted content", Array.isArray(bank && bank.refs) && bank.refs.length > 0);

const entries = (bank && bank.entries) || [];
const refs = (bank && bank.refs) || [];
const seenIds = new Set();
let shapeOk = true;
entries.forEach((e, i) => {
  const tag = "entry #" + (i + 1);
  if (!e || typeof e !== "object") { shapeOk = false; return; }
  if (typeof e.id !== "string" || !e.id.trim() || seenIds.has(e.id)) { shapeOk = false; console.error("    " + tag + " missing/duplicate id"); return; }
  seenIds.add(e.id);
  if (OFFICIAL.indexOf(e.subjectId) === -1) { shapeOk = false; console.error("    " + tag + " subjectId not official: " + e.subjectId); }
  if (typeof e.source !== "string" || !e.source.trim()) { shapeOk = false; console.error("    " + tag + " missing source"); }
  if (typeof e.q !== "string" || !e.q.trim()) { shapeOk = false; console.error("    " + tag + " missing q"); }
  if (!Array.isArray(e.opts) || e.opts.length < 2 || e.opts.some((o) => typeof o !== "string")) { shapeOk = false; console.error("    " + tag + " bad opts"); }
  if (typeof e.a !== "number" || !Number.isInteger(e.a) || e.a < 0 || e.a >= (e.opts ? e.opts.length : 0)) { shapeOk = false; console.error("    " + tag + " bad answer index"); }
  if (typeof e.ex !== "string") { shapeOk = false; console.error("    " + tag + " missing ex"); }
});
refs.forEach((d, i) => {
  const tag = "ref #" + (i + 1);
  if (!d || typeof d !== "object") { shapeOk = false; return; }
  if (typeof d.id !== "string" || !d.id.trim() || seenIds.has(d.id)) { shapeOk = false; console.error("    " + tag + " missing/duplicate id"); return; }
  seenIds.add(d.id);
  if (OFFICIAL.indexOf(d.subjectId) === -1) { shapeOk = false; console.error("    " + tag + " subjectId not official"); }
  if (typeof d.source !== "string" || !d.source.trim()) { shapeOk = false; console.error("    " + tag + " missing source"); }
  if (typeof d.q !== "string" || !d.q.trim()) { shapeOk = false; console.error("    " + tag + " missing q"); }
  if (typeof d.answerText !== "string" || !d.answerText.trim()) { shapeOk = false; console.error("    " + tag + " missing answerText"); }
  if (typeof d.ex !== "string") { shapeOk = false; console.error("    " + tag + " missing ex"); }
});
check("every item matches its shape (entries MCQ, refs Q+answer; unique ids, official subjects)", shapeOk);

/* ============================================================
   Harness — stubbed browser like full-boot, but with a real
   on-disk fetch for the two data files.
   ============================================================ */
function makeEl(id) {
  const el = {
    id, _html: "", style: {}, dataset: {}, listeners: {}, children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); return this._s.has(c); },
      contains(c) { return this._s.has(c); },
    },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { el.children.push(c); return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; },
    scrollIntoView() {}, focus() {}, blur() {}, click() {},
    remove() { el._removed = true; },
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html; }, set(v) { el._html = String(v); } });
  Object.defineProperty(el, "textContent", { get() { return el._text || ""; }, set(v) { el._text = String(v); } });
  return el;
}

const mappedFetch = {
  "quizzes.json": path.join(root, "data", "quizzes.json"),
  "quiz-bank.json": path.join(root, "data", "quiz-bank.json"),
};
function boot(bankJsonOverride) {
  const ids = [
    "preloader","nav","navBurger","mobileMenu","langToggle","toTop",
    "quizApp","bankHub","bankHubList","flashGrid","flashSearch","flashShuffle","flashEmpty","subjectSearch","resultsCount","emptyState","subjectsGrid",
    "progressApp","heroContinue","heroContinueMeta","heroContinueBtn",
    "pathsGrid","pathDetailBody","lessonBody","lessonView",
    "semesterGrid","semesterMeta",
    "hero","semester","paths","path","subjects","tools","labs","flash","quiz","kali",
    "progress","games","redteam","ir","cryptolab","about","contact","lesson","depth",
    "heroDash","heroDashPct","heroDashBar","heroDashLesson","heroDashQuiz","heroDashContinue",
    "searchOpenBtn","searchOverlay","searchDialog","searchInput","searchResults","searchClose",
    "onboardingOverlay","onboardingBack","onboardingSkip","onboardingNext","onboardingStart",
    "assistantRoot","assistantPanel","assistantFab",
  ];
  const byId = {};
  ids.forEach((id) => { byId[id] = makeEl(id); });
  const docListeners = {};
  const mainEl = makeEl("main");
  const documentStub = {
    hidden: false,
    getElementById(id) { return byId[id] || null; },
    querySelector(sel) { return sel === "main" ? mainEl : null; },
    querySelectorAll() { return []; },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent(ev) { (docListeners[ev && ev.type] || []).forEach((fn) => { try { fn(ev); } catch (e) { void e; } }); return true; },
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
  const fetchStub = (url) => {
    const name = String(url).split("?")[0].split("/").pop();
    const file = mappedFetch[name];
    if (!file) return Promise.reject(new Error("offline"));
    const parsed = name === "quiz-bank.json" && bankJsonOverride !== undefined
      ? bankJsonOverride
      : JSON.parse(fs.readFileSync(file, "utf8"));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(parsed) });
  };
  const windowStub = {
    PLATFORM_CURRENT_SEMESTER: cs,
    scrollY: 0,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
    requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    location: { hash: "", href: "http://localhost/" },
    history: { pushState() {}, replaceState() {} },
    scrollTo() {},
    getComputedStyle() { return {}; },
    localStorage: localStorageStub,
    navigator: { language: "ar", serviceWorker: undefined },
    CustomEvent: function (type, opts) { return { type, detail: opts && opts.detail }; },
    IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
    MutationObserver: function () { return { observe() {}, disconnect() {} }; },
    Worker: undefined,
    fetch: fetchStub,
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
    fetch: fetchStub,
    setTimeout, clearTimeout, setInterval, clearInterval,
    indexedDB: undefined,
  });
  vm.createContext(sandbox);
  const app = byId.quizApp;
  return { sandbox, app };
}
function drain() {
  /* Let the async fetch→json→merge chain settle (pure microtasks + a tick). */
  return new Promise((resolve) => setTimeout(resolve, 20));
}

(async function main() {
  /* ---------- Part B · real boot: refs merge + hub cards + sheet ---------- */
  {
    const { sandbox, app } = boot();
    let threw = null;
    try { vm.runInContext(js, sandbox, { filename: "script.js" }); } catch (e) { threw = e; }
    check("script.js boot executes without throwing", !threw);
    if (threw) console.error("    \u2192 " + threw.message);
    await drain();

    const Q = sandbox.window.QUIZZES;
    const bankKeys = Q ? Object.keys(Q).filter((k) => k.indexOf("bank:") === 0) : [];
    check("QUIZZES exposed on window", !!Q);
    check("reference banks merged into QUIZZES (OS + components)", bankKeys.length === 2);
    const osQ = Q && Q["bank:260210030802"];
    const compQ = Q && Q["bank:260210031002"];
    check("OS bank holds its 5 reference items", !!(osQ && osQ.refs.length === 5 && osQ.questions.length === 0));
    check("components bank holds its 10 reference items", !!(compQ && compQ.refs.length === 10 && compQ.questions.length === 0));
    check("bank names carry the بنك الفترات prefix", !!(osQ && osQ.name.indexOf("بنك الفترات — ") === 0));
    const r0 = osQ && osQ.refs[0];
    check("ref items keep the reference shape (q/answerText/ex)", !!(r0 && typeof r0.q === "string" && typeof r0.answerText === "string" && typeof r0.ex === "string"));
    check("official count intact (5 subjects + 2 banks)", Object.keys(Q).length === OFFICIAL.length + 2);

    /* MODULE 99 · banks left the grid — they live in #bankHub now. */
    const html = app.innerHTML;
    check("bank cards removed from the subject grid", html.indexOf("بنك الفترات — ") === -1);
    check("subject grid holds no sheet targets (no data-sheet-sub)", html.indexOf("data-sheet-sub") === -1);
    check("subject grid keeps only official subject cards (prefix-tolerant match: q-pick q-subject-card)", (html.match(/q-pick q-subject-card/g) || []).length === OFFICIAL.length);

    const hubEl = sandbox.document.getElementById("bankHub");
    const hubList = sandbox.document.getElementById("bankHubList");
    check("bank hub panel is visible after the merge", !!(hubEl && hubEl.hidden === false));
    const hubHtml = hubList.innerHTML;
    check("hub renders exactly one row per bank (OS + components)", (hubHtml.match(/data-sheet-sub=/g) || []).length === 2);
    check("hub rows target the OS and components sheets", hubHtml.indexOf('data-sheet-sub="bank:260210030802"') !== -1 && hubHtml.indexOf('data-sheet-sub="bank:260210031002"') !== -1);
    check("hub rows carry the revision-sheet labels", hubHtml.indexOf("ورقة مراجعة") !== -1 && hubHtml.indexOf("سؤالاً وجوابًا") !== -1 && hubHtml.indexOf("مرجع الفاينل") !== -1);

    /* Drive the delegated click handler like a real tap on the ref card. */
    const click = app.listeners.click && app.listeners.click[0];
    const evStub = { preventDefault() {}, stopPropagation() {} };
    evStub.target = {
      closest(sel) {
        if (sel === "[data-sheet-sub]") return { getAttribute: () => "bank:260210031002" };
        return null;
      },
    };
    click(evStub);
    const sheet = app.innerHTML;
    check("revision sheet renders with the sheet shell", sheet.indexOf("q-sheet") !== -1 && sheet.indexOf("q-sheet-item") !== -1);
    check("sheet hides answers behind native <details>", sheet.indexOf("<details") !== -1);
    check("sheet body carries answers + explanations", sheet.indexOf("الإجابة") !== -1 && sheet.indexOf("q-sheet-answer") !== -1);
    check("sheet cites the quiz source per item", sheet.indexOf("المرجع") !== -1);
    check("all 10 component items on the sheet", (sheet.match(/<details /g) || []).length === 10);

    const back = { preventDefault() {}, stopPropagation() {}, target: { closest(sel) { return sel === "#qSheetBack" ? {} : null; } } };
    click(back);
    check("back returns to the test library", app.innerHTML.indexOf("q-dashboard") !== -1);
    check("sheet view leaves no stray state (library re-rendered)", app.innerHTML.indexOf("اختر المادة") !== -1);

    /* MODULE 99 · the hub row opens the sheet through its own delegation
       (hub is outside #quizApp, so it binds its own listener). */
    const hubClick = hubEl && hubEl.listeners.click && hubEl.listeners.click[0];
    const hubEv = { preventDefault() {}, stopPropagation() {}, target: { closest(sel) { return sel === "[data-sheet-sub]" ? { getAttribute: () => "bank:260210030802" } : null; } } };
    if (hubClick) hubClick(hubEv);
    const osSheet = app.innerHTML;
    check("hub row click opens the OS revision sheet (5 items)", osSheet.indexOf("q-sheet-item") !== -1 && (osSheet.match(/<details /g) || []).length === 5);
    click(back);

    /* The engine still runs a REAL MCQ bank exactly as before. */
    const openRun = { preventDefault() {}, stopPropagation() {}, target: { closest(sel) { return sel === ".q-pick" ? { dataset: { sub: "260210030702" } } : null; } } };
    click(openRun);
    check("official MCQ bank still launches its engine run", app.innerHTML.indexOf("q-question") !== -1 && app.innerHTML.indexOf("q-option") !== -1);

    /* Refs-only banks can NEVER start the engine (startQuiz guard). */
    const refRun = { preventDefault() {}, stopPropagation() {}, target: { closest(sel) { return sel === ".q-pick" ? { dataset: { sub: "bank:260210030802" } } : null; } } };
    click(refRun);
    check("refs-only bank cannot be launched by a stray .q-pick click (no ref run replaces the view)", app.innerHTML.indexOf("بنك الفترات — مفاهيم نظم التشغيل") === -1 && app.innerHTML.indexOf("q-option") !== -1);
  }

  /* ---------- Part C · graceful empty: empty file merges nothing ---------- */
  {
    const { sandbox } = boot({ version: 1, _readme: {}, entries: [], refs: [] });
    let threw = null;
    try { vm.runInContext(js, sandbox, { filename: "script.js" }); } catch (e) { threw = e; }
    check("boot survives an empty bank file", !threw);
    await drain();
    const Q = sandbox.window.QUIZZES;
    const bankKeys = Q ? Object.keys(Q).filter((k) => k.indexOf("bank:") === 0) : [];
    check("empty bank merges zero keys", bankKeys.length === 0);
    check("main banks unaffected by an empty bank file", Object.keys(Q).length === OFFICIAL.length);
    const hubEl = sandbox.document.getElementById("bankHub");
    check("empty bank keeps the hub panel hidden", !!(hubEl && hubEl.hidden === true));
  }

  /* ---------- Part D · source-level wiring ---------- */
  const i0 = js.indexOf("MODULE 98 \u00b7 \u0628\u0646\u0643 \u0627\u0644\u0641\u062a\u0631\u0627\u062a");
  const i1 = js.indexOf("async function loadQuizData()");
  const layer = i0 !== -1 && i1 !== -1 ? js.slice(i0, i1) : "";
  check("sanitizeQuizBank module present", js.indexOf("function sanitizeQuizBank(") !== -1);
  check("sanitize accepts the whole raw payload (entries + refs)", layer.indexOf("src.entries") !== -1 && layer.indexOf("src.refs") !== -1);
  check("bank loader present (loadQuizBankData)", js.indexOf("async function loadQuizBankData(") !== -1);
  check("loader fetches data/quiz-bank.json", layer.indexOf("./data/quiz-bank.json") !== -1);
  check("loadQuizData awaits the bank merge", js.indexOf("await loadQuizBankData()") !== -1);
  check("bank keys use the bank:<subjectId> namespace", layer.indexOf('"bank:" + subId') !== -1);
  check("bank failure is a console warn, never a throw", layer.indexOf("console.warn") !== -1);
  check("renderSheet defined", js.indexOf("function renderSheet(") !== -1);
  check("sheet is reachable from bank cards", js.indexOf('data-sheet-sub="${esc(k)}"') !== -1);
  check("sheet button check precedes the card picker (handler order)", js.indexOf("[data-sheet-sub]") < js.indexOf("t.closest(\".q-pick\")"));
  check("sheet back control wired", js.indexOf("#qSheetBack") !== -1);
  check("lang switch repaints an open sheet", js.indexOf('quizView === "sheet"') !== -1);
  check("startQuiz guard blocks empty banks (refs-only never runs)", js.indexOf("bank.questions.length === 0) return;") !== -1);
  check("renderBankHub renders the dedicated list (MODULE 99)", js.indexOf("function renderBankHub(") !== -1);
  check("hub delegation registered once on #bankHub", js.indexOf('hub.dataset.bankDelegated === "1"') !== -1);
  check("refs-only grid cards removed (old MODULE 98 injection gone)", js.indexOf("const refCard") === -1);
  check("hub markup in index.html sits after the quiz grid, before MockExam", (() => {
    try {
      const ih = fs.readFileSync(path.join(root, "index.html"), "utf8");
      const at = ih.indexOf('id="bankHub"');
      return at !== -1 && at > ih.indexOf('id="quizApp"') && at < ih.indexOf('id="mockApp"');
    } catch (e) { return false; }
  })());
  check("CSS MODULE 99 present", css.indexOf("MODULE 99") !== -1 && css.indexOf(".bank-hub") !== -1);
  check("no network in the bank layer beyond the JSON", !/WebSocket|XMLHttpRequest|sendBeacon/.test(layer));
  check("CSS MODULE 98 present", css.indexOf("MODULE 98") !== -1 && css.indexOf(".q-sheet-item") !== -1);
  check("CSS reduced-motion guard for the sheet", css.indexOf(".q-sheet-hint { transition: none; }") !== -1);
  check("no data-theme introduced", js.indexOf("data-theme") === -1 && css.indexOf("data-theme") === -1);

  console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
