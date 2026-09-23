"use strict";
/**
 * Phase 5 tests — Exam Preparation mode (MODULE 53).
 *  1. Source-level: markers, honest-weight constants, local-only storage,
 *     no notifications/network/deps, dict keys (AR+EN), mount, styles,
 *     cache bump.
 *  2. Functional (vm, stubbed browser): readiness math (exact weighted
 *     formula + weight redistribution), weak-topic grouping, daily
 *     recommendations (urgency ordering + cap), date parsing/countdown,
 *     practice deck sampling from real banks.
 * Run: node tests/exam-prep.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

const REV_START = js.indexOf("/* @@EXAM_PREP_START@@ */") >= 0 ? js.indexOf("/* @@EXAM_PREP_START@@ */") : js.indexOf("@@EXAM_PREP_START@@");
const REV_END = js.indexOf("/* @@EXAM_PREP_END@@ */");
const m53 = REV_START >= 0 && REV_END > REV_START ? js.slice(js.lastIndexOf("/* =", REV_START), REV_END) : "";

const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
function hasKey(src, key) { return new RegExp('"' + key.replace(/\./g, "\\.") + '":').test(src); }
const examKeys = [
  "exam.title", "exam.sub", "exam.datePrompt", "exam.dateLabel", "exam.save", "exam.skip", "exam.edit",
  "exam.remove", "exam.dateSaved", "exam.dateRemoved", "exam.invalidDate", "exam.daysLeft", "exam.dayLeft",
  "exam.today", "exam.passed", "exam.dailyTitle", "exam.dailyEmpty", "exam.recReview", "exam.recWeak",
  "exam.recLesson", "exam.recSubject", "exam.recPractice", "exam.readinessTitle", "exam.readinessSub",
  "exam.breakdown", "exam.notTested", "exam.noLessons", "exam.weakTitle", "exam.weakEmpty", "exam.missedCount",
  "exam.practiceTitle", "exam.practiceSub", "exam.start", "exam.progress", "exam.from", "exam.next",
  "exam.finish", "exam.correct", "exam.wrong", "exam.summaryTitle", "exam.summaryLine", "exam.encHigh",
  "exam.encMid", "exam.encLow", "exam.lastRun", "exam.finalTitle", "exam.finalLine", "exam.finalNoteHigh",
  "exam.finalNoteMid", "exam.finalNoteLow", "exam.finalNoData", "exam.openQuiz", "exam.openLessons"
];

console.log("— MODULE 53 source —");
check("module exists between markers", m53.length > 0);
check("weights are explicit (quiz .5 / lessons .3 / mistakes .2)",
  m53.includes("W_QUIZ = 0.5") && m53.includes("W_LESSONS = 0.3") && m53.includes("W_MISTAKES = 0.2"));
check("weight redistribution when a subject has no lessons", m53.includes("wq = W_QUIZ / s") && m53.includes("wm = W_MISTAKES / s"));
check("own state stored locally under exam-prep", m53.includes('STORE_KEY = "exam-prep"'));
check("practice runs capped", m53.includes("RUN_CAP") && m53.includes("slice(-RUN_CAP)"));
check("read-only access to quiz results via window.readStore", m53.includes("window.readStore"));
check("weak topics derive from the real missed store + question.topic", m53.includes("function weakTopics") && m53.includes("q.topic"));
check("countdown is day-granular (no timers)", m53.includes("daysUntil") && !/setInterval|setTimeout/.test(m53));
check("no notifications anywhere", !/Notification|PushManager|serviceWorker\.ready/.test(m53));
check("no network or external deps", !/fetch\(|XMLHttpRequest|import\s|require\(|https?:\/\//.test(m53));
check("single delegated listener bound once", m53.includes("window.__examDelegated"));
check("edit + remove exam date supported", m53.includes("data-exam-edit") && m53.includes("data-exam-remove"));
check("practice exam sampled from real banks", m53.includes("buildDeck") && m53.includes("EXAM_PER_SUBJECT"));
check("summary stored locally then shown", m53.includes("ep.runs") && m53.includes("renderSummary"));
check("exposed for diagnostics/tests", m53.includes("window.PlatformExamPrep"));

console.log("\n— mounts, styles, cache, dicts —");
check("exam mount added to the progress view", html.includes('id="examApp"'));
check("mount is live-region polite", html.includes('class="exam-app reveal" aria-live="polite"'));
check("exam styles exist", css.includes(".exam-shell") && css.includes(".exam-bar") && css.includes(".exam-opt") && css.includes(".exam-rec"));
check("RTL-safe logical properties used", /margin-inline-start/.test(css) && /border-inline-start: 3px/.test(css));
check("focus-visible styles present", css.includes(".exam-opt:focus-visible") && css.includes(".exam-date-input:focus-visible"));
check("mobile collapse present", /@media \(max-width: 720px\)[\s\S]*\.exam-date-form \{ flex-direction: column/.test(css));
check("reduced-motion support present", /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.exam-bar/.test(css));
check("service worker cache bumped to v1.22.7", /CACHE_VERSION = "v1\.22\.7"/.test(sw));
check("all exam keys exist in Arabic", examKeys.every((k) => hasKey(arSrc, k)));
check("all exam keys exist in English", examKeys.every((k) => hasKey(enSrc, k)));

console.log("\n— functional: readiness math, weak topics, recs, deck —");
(function functional() {
  const quizJson = JSON.parse(fs.readFileSync(path.join(root, "data", "quizzes.json"), "utf8"));
  const codes = Object.keys(quizJson);
  const S1 = codes[0], S2 = codes[1];
  const size1 = quizJson[S1].questions.length;

  const data = {};
  const now = Date.now();
  data["missed"] = {};
  data["missed"][S1 + ":0"] = now;                 /* same topic as :1 in real banks? checked below */
  data["missed"]["bogus:9"] = now;                 /* must be pruned */
  data["lessons"] = { v: 1, done: {}, undone: {} };
  data["lessons"].done[S1 + "/topic-a"] = now;
  data["lessons"].done[S1 + "/topic-b"] = now;
  data["lessons"].undone[S2 + "/topic-c"] = true;
  data["exam-prep"] = { v: 1, date: null, runs: [] };

  const mount = { _html: "", addEventListener() {}, querySelector() { return null; } };
  Object.defineProperty(mount, "innerHTML", { get() { return mount._html; }, set(v) { mount._html = String(v); } });

  const win = {};
  const sandbox = {
    console,
    document: { getElementById(id) { return id === "examApp" ? mount : null; }, addEventListener() {}, dispatchEvent() {} },
    Lang: { current: "ar", t(k) { return k; }, onSwitch() {} },
  };
  win.PLATFORM_STORE = {
    get(k, fb) { return k in data ? data[k] : fb; },
    set(k, v) { data[k] = v; },
    remove(k) { delete data[k]; },
  };
  win.QUIZZES = quizJson;
  win.PLATFORM_SUBJECTS = codes.map((c) => ({ id: c, quizKey: c }));
  win.readStore = () => ({ results: (function () { const r = {}; r[S1] = { score: 16, total: 20, pct: 80 }; return r; })() });
  /* 4 real lessons mapped to S1 via path topics */
  win.getLearningPaths = () => [{ id: "p1", topics: [1, 2, 3, 4].map((n) => ({ id: "t" + n, lsn: { sub: S1, key: "k" + n } })) }];
  sandbox.window = win;
  vm.createContext(sandbox);
  vm.runInContext(m53, sandbox, { filename: "module53.js" });

  const api = win.PlatformExamPrep;
  check("MODULE 53 boots and exposes its API", !!api && typeof api.buildReadiness === "function");
  if (!api) return;

  /* readiness: 0.5·80 + 0.3·(2/4) + 0.2·(1-1/size) */
  const mf = Math.round(100 * (1 - 1 / size1));
  const expect = Math.round(0.5 * 80 + 0.3 * 50 + 0.2 * mf);
  const r1 = api.readinessFor(S1, (function () { const t = {}; t[S1] = 4; return t; })());
  check("readiness matches the published weighted formula (" + expect + "%)", r1.pct === expect && r1.quiz === 80 && r1.coverage === 50 && r1.mistakeFree === mf);
  check("tested flag reflects a real quiz result", r1.tested === true);

  const r2 = api.readinessFor(S2, {});
  const expect2 = Math.round((0.5 / 0.7) * 0 + (0.2 / 0.7) * 100);
  check("weight redistributed when no lessons exist (quiz weight → 5/7)", r2.pct === expect2 && r2.lessonsTotal === 0);
  check("untested subject honestly reports quiz = 0", r2.quiz === 0 && r2.tested === false);

  const weak = api.weakTopics();
  check("weak topics grouped from real missed entries", weak.length >= 1 && weak[0].count === 1 && weak[0].subject === S1);
  check("bogus missed entries pruned from weak topics", !weak.some((w) => w.subject === "bogus"));

  const recs = api.recommendations(api.buildReadiness(), weak, 2);
  check("urgent (≤3 days) → mistakes review first", recs.length > 0 && recs[0].kind === "review");
  check("recommendations capped at 4", recs.length <= 4);
  const recsCalm = api.recommendations(api.buildReadiness(), weak, null);
  check("no date → practice suggestion included", recsCalm.some((r) => r.kind === "practice"));

  check("invalid dates rejected", api.parseDate("tomorrow") === null && api.parseDate("2026-13-99") === null);
  const in5 = new Date(Date.now() + 5 * 86400000);
  const iso = in5.getFullYear() + "-" + String(in5.getMonth() + 1).padStart(2, "0") + "-" + String(in5.getDate()).padStart(2, "0");
  check("countdown computes real day distance", api.daysUntil(iso) === 5);

  const deck = api.buildDeck();
  const perSubj = deck.reduce((a, d) => { a[d.subject] = (a[d.subject] || 0) + 1; return a; }, {});
  check("practice deck drawn from real banks (≤4 per subject)",
    deck.length > 0 && Object.keys(perSubj).every((k) => perSubj[k] <= 4 && quizJson[k]));
  check("deck items are real question objects with answers",
    deck.every((d) => d.q && Array.isArray(d.q.opts || d.q.options) && typeof (typeof d.q.a === "number" ? d.q.a : d.q.correct) === "number"));

  check("initial render produced the exam shell", mount._html.includes("exam-shell"));
})();

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);

