"use strict";
/**
 * Phase 3 smoke test for MODULE 40 (Lessons) + the quiz-upgrade helpers.
 * Extracts the REAL LESSONS data, the REAL LEARNING_PATHS data and the
 * REAL MODULE 40 slice (QUIZ_CATS, SUBJECT_TO_PATH, category/retry helpers,
 * lesson view) from script.js and runs them in Node's `vm` with DOM/Lang
 * stubs, asserting:
 *   - route guard: non-lesson hashes (#path/x, "") never touch the lesson view
 *     (regression: a two-segment hash used to hijack the initial view)
 *   - LESSONS is EMPTY (migration 2): every #lesson/<subject>/<key> deep link —
 *     including ones built from the current course codes — renders the honest
 *     placeholder (no fake lesson content)
 *   - SUBJECT_TO_PATH routes exactly the 5 current course codes to real paths
 *   - computeCategoryBreakdown / retryIndices logic, incl. the topic-based
 *     fallback used by the current-semester question banks
 *   - quiz-upgrade wiring strings (mode selector, retry, review, breakdown)
 * Run: node tests/lessons-smoke.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");

/* ---------- extract real sources ---------- */
function bracketSlice(startAnchor, openCh, closeCh) {
  const s = src.indexOf(startAnchor);
  if (s < 0) throw new Error("anchor not found: " + startAnchor);
  const open = src.indexOf(openCh, s);
  let d = 0, q = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === "\"" || c === "'" || c === "`") { q = c; continue; }
    if (c === openCh) d++;
    else if (c === closeCh) { d--; if (d === 0) return src.slice(s, i + 1); }
  }
  throw new Error("unbalanced for " + startAnchor);
}
const lessonsSrc = bracketSlice("const LESSONS = {", "{", "}");
const pathsSrc = bracketSlice("const LEARNING_PATHS = [", "[", "]");
const mStart = src.indexOf("/* MODULE 40");
const mEnd = src.indexOf("/* @@LESSONS_D@@ */");
if (mStart < 0 || mEnd < 0 || mEnd <= mStart) throw new Error("MODULE 40 slice not found");
const m40Src = src.slice(mStart, mEnd);

/* Boot script runs once (its top-level const declarations would collide on a
   re-run); the function tail re-runs per scenario — function re-declaration
   is legal, and it still sees the consts via the shared vm global scope. */
const fnStart = m40Src.indexOf("function computeCategoryBreakdown");
if (fnStart < 0) throw new Error("helpers not found in MODULE 40 slice");
const bootSrc = lessonsSrc + "\n" + pathsSrc + "\n" + m40Src.slice(0, fnStart) +
  /* In the browser `window.getLearningPaths = …` creates a global binding
     (window IS the global object), which is what MODULE 40's bare
     `getLearningPaths()` resolves. Reproduce that here: `this` at the top
     level of a vm script is the context global. */
  "\n;this.getLearningPaths = function () { return LEARNING_PATHS; };\n";
const fnSrc = m40Src.slice(fnStart);

/* ---------- stub environment ---------- */
let lang = "ar";
function fakeEl(id) {
  const el = {
    id: id, _html: "",
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle() {} },
    setAttribute() {}, getAttribute() { return null; },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    focus() {}, scrollIntoView() {},
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html; }, set(v) { el._html = String(v); } });
  return el;
}
const interp = (key, p) => { let s = String(key); if (p) Object.keys(p).forEach((k) => { s = s.split("{" + k + "}").join(String(p[k])); }); return s; };
const sandbox = {
  console,
  location: { hash: "" },
  __activated: [],
  __body: fakeEl("lessonBody"),
  $id(id) { return id === "lessonBody" ? sandbox.__body : null; },
  document: { getElementById(id) { return id === "lessonBody" ? sandbox.__body : null; }, addEventListener() {} },
  window: null, /* self-reference set below */
  escHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])); },
  prefersReducedMotion: false,
  QUIZZES: {
    "260210030702": { name: "الخوارزميات", questions: [{}, {}, {}, {}] },
    "260210030802": { name: "مفاهيم نظم التشغيل", questions: [{}, {}, {}, {}] },
    "260210030902": { name: "السياسات والتشريعات والأخلاقيات والالتزام بها", questions: [{}, {}, {}, {}] },
    "260210031002": { name: "مكونات أنظمة تقنية المعلومات", questions: [{}, {}, {}, {}] },
    "260210031102": { name: "مبادئ التصميم في الأمن السيبراني", questions: [{}, {}, {}, {}] },
  },
  Lang: {
    get current() { return lang; },
    t(key, p) { return interp(key, p); },
    qt(key, p) { return interp(key, p); },
    onSwitch() {},
  },
};
sandbox.window = {
  addEventListener() {},
  NovaViews: { activate(v) { sandbox.__activated.push(v); } },
  getLearningPaths: null, /* the module slice re-publishes this */
};
sandbox.escL = sandbox.escHtml;
sandbox.esc = sandbox.escHtml;

vm.createContext(sandbox);
vm.runInContext(bootSrc, sandbox, { filename: "m40-boot.js" });
function run() { vm.runInContext(fnSrc, sandbox, { filename: "m40-fn.js" }); }
run(); /* first scenario: hash "" */

let failures = 0;
function check(name, cond) {
  if (cond) { console.log("  \u2713 " + name); }
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}

console.log("\u2014 route guard \u2014");
sandbox.location.hash = "#path/networking";
run();
check("non-lesson hash leaves lesson body untouched", sandbox.__body._html === "");
check("non-lesson hash does not activate the lesson view", sandbox.__activated.length === 0);
sandbox.location.hash = "";
run();
check("empty hash leaves lesson body untouched", sandbox.__body._html === "");

console.log("\n\u2014 empty LESSONS (migration 2): honest placeholder \u2014");
sandbox.location.hash = "#lesson/260210030702/algo-basics";
run();
let body = sandbox.__body._html;
check("lesson view activated via NovaViews", sandbox.__activated.indexOf("lesson") >= 0);
check("honest placeholder rendered for a course-code lesson link", body.indexOf("lesson-placeholder") >= 0);
check("placeholder uses the AR title key", body.indexOf("lesson.soonTitle") >= 0);
check("placeholder body copy present", body.indexOf("lesson.soonBody") >= 0);
check("no fake lesson content is rendered", body.indexOf("lesson-concept") < 0 && body.indexOf("lesson-term-grid") < 0);
check("placeholder offers the back-to-quiz CTA", body.indexOf("lesson.backToQuiz") >= 0);

console.log("\n\u2014 every current course code lands on the placeholder \u2014");
let allPlaceholder = true;
["260210030802/os-basics", "260210030902/pol-basics", "260210031002/itc-basics", "260210031102/des-basics"].forEach(function (pair) {
  sandbox.location.hash = "#lesson/" + pair;
  run();
  if (sandbox.__body._html.indexOf("lesson-placeholder") < 0) allPlaceholder = false;
});
check("4 more course-code lesson links render the placeholder", allPlaceholder);
check("legacy lesson links are honest too", (function () {
  sandbox.location.hash = "#lesson/networks/osi";
  run();
  return sandbox.__body._html.indexOf("lesson-placeholder") >= 0;
})());

console.log("\n\u2014 placeholder still activates the lesson view \u2014");
sandbox.location.hash = "#lesson/260210031102/nope";
run();
check("unknown topic renders honest placeholder", sandbox.__body._html.indexOf("lesson-placeholder") >= 0);
check("placeholder still activates the lesson view", sandbox.__activated.indexOf("lesson") >= 0);

console.log("\n\u2014 quiz-upgrade helpers \u2014");
const bd = sandbox.computeCategoryBreakdown({
  order: [0, 1, 2],
  questions: [{ cat: "osi" }, { cat: "osi" }, { cat: "tls" }],
  answers: [{ correct: true }, { correct: false }, { correct: true }],
});
check("breakdown: one entry per category", bd.length === 2);
const osi = bd.find((x) => x.cat === "osi");
const tls = bd.find((x) => x.cat === "tls");
check("breakdown: osi 1/2 = 50%", !!osi && osi.correct === 1 && osi.total === 2 && osi.pct === 50);
check("breakdown: tls 1/1 = 100%", !!tls && tls.correct === 1 && tls.total === 1 && tls.pct === 100);
check("breakdown: AR label from QUIZ_CATS", !!osi && String(osi.label).indexOf("\u0627\u0644\u0634\u0628\u0643\u0627\u062a") >= 0);
const b2 = sandbox.computeCategoryBreakdown({ order: [0], questions: [{ cat: "mystery" }], answers: [{ correct: true }] });
check("breakdown: unknown cat falls back to raw key", b2.length === 1 && b2[0].label === "mystery");

console.log("\n\u2014 breakdown: topic-based categories (current-semester banks) \u2014");
/* Current-semester question banks carry an Arabic `topic` (no `cat`): the
   breakdown must classify per topic and fall back to the raw topic label. */
const bdTopic = sandbox.computeCategoryBreakdown({
  order: [0, 1, 2],
  questions: [{ topic: "مفاهيم أساسية" }, { topic: "مفاهيم أساسية" }, { topic: "التعقيد الزمني" }],
  answers: [{ correct: true }, { correct: true }, { correct: false }],
});
check("breakdown: topics produce separate entries", bdTopic.length === 2);
const t1 = bdTopic.find((x) => x.cat === "مفاهيم أساسية");
const t2 = bdTopic.find((x) => x.cat === "التعقيد الزمني");
check("breakdown: topic 2/2 = 100%", !!t1 && t1.correct === 2 && t1.total === 2 && t1.pct === 100);
check("breakdown: topic label falls back to the raw Arabic topic", !!t2 && t2.label === "التعقيد الزمني");
check("breakdown: no cat → never collapses into 'general'", !bdTopic.some((x) => x.cat === "general"));

/* Integration: run the real helper over the REAL current bank questions. */
const fs2 = require("fs");
const path2 = require("path");
const quizJson = JSON.parse(fs2.readFileSync(path2.join(__dirname, "..", "data", "quizzes.json"), "utf8"));
const realBank = quizJson["260210031102"].questions;
const bdReal = sandbox.computeCategoryBreakdown({
  order: realBank.map(function (q, i) { return i; }),
  questions: realBank,
  answers: realBank.map(function (q, i) { return { correct: i % 3 === 0 }; }),
});
check("breakdown: real bank yields " + realBank.length + " scored questions", bdReal.reduce(function (a, x) { return a + x.total; }, 0) === realBank.length);
check("breakdown: real bank classifies by its authored topics", bdReal.length >= 5 && bdReal.every((x) => x.pct >= 0 && x.pct <= 100));
check("breakdown: real bank labels are the Arabic topics (no raw keys lost)", bdReal.every((x) => x.label && x.label === x.cat));

/* SUBJECT_TO_PATH must route exactly the 5 current course codes to real paths. */
const stp = sandbox.window.SUBJECT_TO_PATH;
const CODES = ["260210030702", "260210030802", "260210030902", "260210031002", "260210031102"];
const PATH_IDS = sandbox.getLearningPaths().map(function (p) { return p.id; });
check("SUBJECT_TO_PATH covers exactly the 5 course codes", !!stp && JSON.stringify(Object.keys(stp).sort()) === JSON.stringify(CODES.slice().sort()));
check("SUBJECT_TO_PATH values resolve to real path ids", !!stp && Object.keys(stp).every(function (k) { return PATH_IDS.indexOf(stp[k]) >= 0; }));
check("SUBJECT_TO_PATH has no legacy keys", !stp || !["networks", "os", "crypto", "db", "secureCode", "ethical"].some(function (k) { return k in stp; }));
check("LEARNING_PATHS quiz refs all resolve (real data)", (function () {
  const banks = Object.keys(quizJson);
  let ok = true;
  sandbox.getLearningPaths().forEach(function (p) {
    (p.topics || []).forEach(function (t) {
      if (t.res && t.res.k === "quiz" && banks.indexOf(t.res.key) < 0) ok = false;
    });
  });
  return ok;
})());
check("retry: keeps wrong-answer positions", JSON.stringify(sandbox.retryIndices({ order: [0, 1, 2, 3], answers: [{ correct: true }, { correct: false }, { correct: true }, { correct: false }] })) === "[1,3]");
check("retry: null when nothing is wrong", sandbox.retryIndices({ order: [0, 1], answers: [{ correct: true }, { correct: true }] }) === null);

console.log("\n\u2014 quiz-upgrade wiring (source-level) \u2014");
check("mode selector buttons (practice/exam)", src.includes("data-mode=\"practice\"") && src.includes("data-mode=\"exam\""));
check("mode persisted under the legacy Store key", src.includes("Store.set(\"timed\"") && src.includes("Store.get(\"timed\""));
check("question progress counter wired", src.includes("q-count") && src.includes("\"count\""));
check("retry-incorrect button rendered", src.includes("id=\"qRetryWrong\""));
check("retry filter threaded into startQuiz", /startQuiz\([^)]*,\s*false\s*,/.test(src));
check("category breakdown rendered", src.includes("q-cat-breakdown") && src.includes("catBreakdown"));
check("deferred review block rendered", src.includes("q-review-item") && src.includes("reviewTitle"));
check("wrongList pairs index with outcome", src.includes("wrongList.push({ qi: ord[i], o: o })"));
check("continue-learning link to owning path", src.includes("q-continue-link") && src.includes("(window.SUBJECT_TO_PATH || {})[key]"));
check("boot sanitize drops invalid progress entries", src.includes("cleanProgress[k] = { idx: e.idx, score: e.score, total: e.total }"));
check("ViewSwitcher routes lesson/ prefix", src.includes("/^lesson\\//.test(id)"));
check("activate preserves lesson deep links", src.includes("viewId === \"lesson\" && /^#lesson\\//.test(location.hash)"));
check("lesson section registered in VIEWS", /\$id\("lesson"\)/.test(src));

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);

