"use strict";
/**
 * Phase 2 smoke test for MODULE 39 (LearningPaths).
 * Extracts the real module source from script.js and runs it inside
 * Node's `vm` with DOM/Store/Lang stubs, asserting:
 *   - 10 path cards render (8 live + 2 coming-soon), recommended first
 *   - detail view: titles, ordered topics, progress math, related chips
 *   - persisted manual checkmarks advance progress + "up next"
 *   - quiz topics deep-link the CURRENT course codes (migration 2) and
 *     auto-complete from quiz results stored under those codes
 *   - EN locale renders English titles
 *   - unknown / bare deep links render honest empty states
 * Run: node tests/paths-smoke.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const fnAnchor = src.indexOf("(function initLearningPaths() {");
/* Stop before MODULE 40 (Phase 3) starts — its top-level consts
   cannot be re-declared in the shared VM context on re-runs. */
const endMarker = src.indexOf("\n/* MODULE 40", fnAnchor);
if (fnAnchor < 0 || endMarker < 0) throw new Error("MODULE 39 source not found");
const moduleSrc = src.slice(fnAnchor, endMarker);

/* ---------- Stub environment ---------- */
function fakeElement(id) {
  const el = {
    id: id,
    _html: "",
    listeners: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    scrollIntoView() {},
    focus() {},
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return el._html; },
    set(v) { el._html = String(v); },
  });
  return el;
}

let lang = "ar";
const QUIZ_RESULTS = {};   // subject key → saved result (simulates quizCache)
const storage = {};        // namespaced Store values

const DICT = {
  "paths.level.beginner": "مبتدئ", "paths.level.intermediate": "متوسط", "paths.level.advanced": "متقدم",
  "paths.badge.soon": "قريبًا", "paths.badge.recommended": "الأنسب للبداية",
  "paths.stat.topics": "المواضيع: {n}", "paths.stat.quizzes": "الاختبارات: {n}",
  "paths.progressLabel": "إنجاز المسار", "paths.progressOf": "{done} من {total}",
  "paths.next": "الموضوع التالي: {topic}", "paths.nextCard": "التالي: {topic}",
  "paths.open": "استعرض المسار", "paths.topicsTitle": "مواضيع المسار — بالترتيب",
  "paths.relatedQuiz": "اختبارات مرتبطة", "paths.relatedTools": "أدوات ومعامل مرتبطة",
  "paths.markDone": "تحديد كمكتمل", "paths.markUndone": "إلغاء التحديد",
  "paths.doneByQuiz": "مكتمل عبر اختبار المادة", "paths.complete": "أكملت هذا المسار",
  "paths.soonTitle": "هذا المسار قيد الإعداد", "paths.soonBody": "قيد الإعداد",
  "paths.soonMeanwhile": "وفي الأثناء", "paths.emptyPick": "اختر مسارًا",
  "paths.unknownTitle": "المسار غير موجود", "paths.unknownBody": "لم نعثر",
  "paths.viewAll": "عرض كل المسارات",
  "labs.redteam": "المختبر الهجومي", "labs.ir": "الاستجابة للحوادث",
  "labs.cryptolab": "مختبر التشفير", "labs.games": "تحديات CTF",
  "nav.flashcards": "البطاقات",
};

const sandbox = {
  console,
  location: { hash: "" },
  window: { addEventListener() {}, NovaViews: { current: () => "path" } },
  $id(id) {
    if (id === "pathsGrid") return sandbox.__grid;
    if (id === "pathDetailBody") return sandbox.__detail;
    return null;
  },
  document: {
    getElementById(id) {
      if (id === "pathsGrid") return sandbox.__grid;
      if (id === "pathDetailBody") return sandbox.__detail;
      return null;
    },
    addEventListener() {},
  },
  prefersReducedMotion: false,
  QUIZZES: {
    "260210030702": { name: "الخوارزميات", questions: Array.from({ length: 20 }, function () { return {}; }) },
    "260210030802": { name: "مفاهيم نظم التشغيل", questions: Array.from({ length: 20 }, function () { return {}; }) },
    "260210030902": { name: "السياسات والتشريعات والأخلاقيات والالتزام بها", questions: Array.from({ length: 20 }, function () { return {}; }) },
    "260210031002": { name: "مكونات أنظمة تقنية المعلومات", questions: Array.from({ length: 20 }, function () { return {}; }) },
    "260210031102": { name: "مبادئ التصميم في الأمن السيبراني", questions: Array.from({ length: 20 }, function () { return {}; }) },
  },
  readStore() { return { results: QUIZ_RESULTS, progress: {} }; },
  escHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
    ));
  },
  Store: {
    get(key, fallback) {
      const v = storage["motmi-portal:" + key];
      return v === undefined ? fallback : v;
    },
    set(key, v) { storage["motmi-portal:" + key] = v; },
  },
  Lang: {
    get current() { return lang; },
    t(key, params) {
      let s = DICT[key] || key;
      if (params) Object.keys(params).forEach((k) => { s = s.split("{" + k + "}").join(String(params[k])); });
      return s;
    },
    onSwitch() {},
  },
};
sandbox.__grid = fakeElement("pathsGrid");
sandbox.__detail = fakeElement("pathDetailBody");

vm.createContext(sandbox);
/* Re-run the module whenever stub state changes (it re-renders on init).
   The module IIFE is self-contained, so a re-run is a cheap full repaint. */
function runModule() { vm.runInContext(moduleSrc, sandbox, { filename: "module39.js" }); }
runModule();

let failures = 0;
function check(name, cond) {
  if (cond) { console.log("  \u2713 " + name); }
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}
const count = (hay, needle) => hay.split(needle).length - 1;

console.log("\u2014 grid \u2014");
let grid = sandbox.__grid._html;
check("renders 10 path cards", count(grid, 'data-path-id="') === 10);
check("8 live cards (no is-soon class)", count(grid, '"path-card"') + count(grid, '"path-card is-recommended"') === 8);
check("2 coming-soon cards", count(grid, "path-card is-soon") === 2);
check("recommended path is fundamentals, first in DOM", grid.indexOf('data-path-id="fundamentals"') < grid.indexOf('data-path-id="networking"') && grid.indexOf("path-card is-recommended") < grid.indexOf('data-path-id="networking"'));
check("recommended badge rendered", grid.includes("\u0627\u0644\u0623\u0646\u0633\u0628 \u0644\u0644\u0628\u062f\u0627\u064a\u0629"));
check("coming-soon badge rendered", grid.includes("\u0642\u0631\u064a\u0628\u064b\u0627"));
check("AR titles rendered (networking)", grid.includes("\u0627\u0644\u0634\u0628\u0643\u0627\u062a \u0627\u0644\u062d\u0627\u0633\u0648\u0628\u064a\u0629"));
check("no legacy subject keys anywhere on the path grid", !/data-quiz-jump="(networks|os|crypto|db|secureCode|ethical)"/.test(grid));
check("progress text \u201c0 \u0645\u0646 N\u201d on live cards", grid.includes("0 \u0645\u0646"));
check("level chips cover all three levels", grid.includes("is-beginner") && grid.includes("is-intermediate") && grid.includes("is-advanced"));

console.log("\n\u2014 detail: live path (networking) \u2014");
sandbox.location.hash = "#path/networking";
runModule();
let detail = sandbox.__detail._html;
check("AR title rendered", detail.includes("\u0627\u0644\u0634\u0628\u0643\u0627\u062a \u0627\u0644\u062d\u0627\u0633\u0648\u0628\u064a\u0629"));
check("6 ordered topic rows", count(detail, 'class="path-topic"') === 6);
check("numbered order preserved", detail.indexOf("\u0623\u0633\u0627\u0633\u064a\u0627\u062a \u0627\u0644\u0634\u0628\u0643\u0627\u062a") < detail.indexOf("TCP/UDP"));
check("progress starts 0 \u0645\u0646 6", detail.includes("0 \u0645\u0646 6"));
check("up-next chip points at topic 1 at 0%", detail.includes("\u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u062a\u0627\u0644\u064a"));
check("no quiz chip on this path (no fake res)", !detail.includes("path-chip is-quiz"));
check("lab chips link to redteam view", detail.includes('href="#redteam"'));
check("toggle buttons start aria-pressed=false", detail.includes('aria-pressed="false"'));

console.log("\n\u2014 detail: fundamentals (current-semester quiz links) \u2014");
sandbox.location.hash = "#path/fundamentals";
runModule();
detail = sandbox.__detail._html;
check("5 ordered topic rows", count(detail, 'class="path-topic"') === 5);
check("quiz chip targets the OS-concepts course code", detail.includes('data-quiz-jump="260210030802"'));
check("quiz chip targets the security-design course code", detail.includes('data-quiz-jump="260210031102"'));
check("quiz chip shows the live bank question count 20", detail.includes('class="path-chip-n">20'));
check("no legacy subject keys on quiz chips", !/data-quiz-jump="(networks|os|crypto|db|secureCode|ethical)"/.test(detail));

console.log("\n\u2014 detail: manual toggles persist \u2014");
sandbox.location.hash = "#path/networking";
storage["motmi-portal:paths"] = { v: 1, done: { networking: { "n-osi": true } } };
runModule();
detail = sandbox.__detail._html;
check("progress advances to 1 \u0645\u0646 6", detail.includes("1 \u0645\u0646 6"));
check("up-next chip shows 2nd topic", detail.includes("\u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u0627\u0644\u062a\u0627\u0644\u064a") && detail.includes("\u062a\u0623\u0645\u064a\u0646 \u0627\u0644\u0627\u062a\u0635\u0627\u0644"));
check("done row carries is-done class", detail.includes("path-topic is-done"));
delete storage["motmi-portal:paths"];

console.log("\n\u2014 detail: quiz auto-completion \u2014");
sandbox.location.hash = "#path/fundamentals";
QUIZ_RESULTS["260210030802"] = { score: 20, total: 20, pct: 100 };
QUIZ_RESULTS["260210031102"] = { score: 18, total: 20, pct: 90 };
runModule();
detail = sandbox.__detail._html;
check("both quiz topics auto-done \u2192 2 \u0645\u0646 5", detail.includes("2 \u0645\u0646 5"));
check("auto-done toggles disabled with hint", detail.includes(" disabled") && detail.includes("\u0645\u0643\u062a\u0645\u0644 \u0639\u0628\u0631 \u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u0645\u0627\u062f\u0629"));
delete QUIZ_RESULTS["260210030802"];
delete QUIZ_RESULTS["260210031102"];

console.log("\n\u2014 detail: coming-soon paths \u2014");
sandbox.location.hash = "#path/forensics";
runModule();
detail = sandbox.__detail._html;
check("no topic list for soon path", !detail.includes('class="path-topic"'));
check("coming-soon title box", detail.includes("\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631 \u0642\u064a\u062f \u0627\u0644\u0625\u0639\u062f\u0627\u062f"));
check("honest \u201cmeanwhile\u201d pointer to IR lab", detail.includes("\u0648\u0641\u064a \u0627\u0644\u0623\u062b\u0646\u0627\u0621") && detail.includes('href="#ir"'));

sandbox.location.hash = "#path/riskgov";
runModule();
detail = sandbox.__detail._html;
check("riskgov soon box without meanwhile links", detail.includes("\u0642\u064a\u062f \u0627\u0644\u0625\u0639\u062f\u0627\u062f") && !detail.includes('href="#ir"'));

console.log("\n\u2014 deep-link edge cases \u2014");
sandbox.location.hash = "#path/does-not-exist";
runModule();
detail = sandbox.__detail._html;
check("unknown id \u2192 not-found state + view-all link", detail.includes("\u0627\u0644\u0645\u0633\u0627\u0631 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f") && detail.includes('href="#paths"'));

sandbox.location.hash = "#path";
runModule();
detail = sandbox.__detail._html;
check("bare #path \u2192 pick-a-path state", detail.includes("\u0627\u062e\u062a\u0631 \u0645\u0633\u0627\u0631\u064b\u0627"));

console.log("\n\u2014 EN locale \u2014");
sandbox.location.hash = "#path/operating-systems";
lang = "en";
runModule();
detail = sandbox.__detail._html;
check("EN title rendered", detail.includes("Operating Systems and Linux"));
check("beginner level chip still applied in EN", detail.includes("path-level is-beginner"));
lang = "ar";
runModule();

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);


