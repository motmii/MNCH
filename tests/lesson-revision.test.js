"use strict";
/**
 * Phase 4 source + functional tests — lesson experience & local revision.
 *  1. Source-level wiring: helpers, delegation, dict keys (AR+EN), mounts,
 *     styles, cache bump, no external deps.
 *  2. Functional: MODULE 52 buildQueue executed in a stubbed browser
 *     (vm) against a fake local store — missed/unfinished/bookmark/stale
 *     reasons, dedupe, and validity pruning against real quiz banks.
 * Run: node tests/lesson-revision.test.js
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

/* ---------- module slices ---------- */
const REV_START = js.indexOf("/* @@REVISION_START@@ */");
const REV_END = js.indexOf("/* @@REVISION_END@@ */");
const rev = REV_START >= 0 && REV_END > REV_START ? js.slice(REV_START, REV_END) : "";
const m40Start = js.indexOf("/* MODULE 40");
const m40End = js.indexOf("/* @@LESSONS_D@@ */");
const m40 = m40Start >= 0 && m40End > m40Start ? js.slice(m40Start, m40End) : "";

const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
function hasKey(src, key) {
  return new RegExp('"' + key.replace(/\./g, "\\.") + '":').test(src);
}
const lessonKeys = [
  "lesson.objectives", "lesson.noObjectives", "lesson.time", "lesson.minutes", "lesson.timeNote",
  "lesson.difficulty", "lesson.difficultyUnknown", "lesson.difficultyEasy", "lesson.difficultyMedium",
  "lesson.difficultyHard", "lesson.fromQuizMix", "lesson.fromPath", "lesson.prerequisites",
  "lesson.prerequisitesNone", "lesson.checks", "lesson.noChecks", "lesson.showAnswer",
  "lesson.hideAnswer", "lesson.checkCorrect", "lesson.checkWrong", "lesson.markComplete",
  "lesson.completed", "lesson.markUndone", "lesson.bookmark", "lesson.bookmarked",
  "lesson.unbookmark", "lesson.notes", "lesson.notePlaceholder", "lesson.saveNote",
  "lesson.noteSaved", "lesson.clearNote", "lesson.noteTooLong", "lesson.relatedQuiz",
  "lesson.relatedLab", "lesson.noRelated"
];
const reviewKeys = [
  "review.title", "review.sub", "review.empty", "review.reasonMissed", "review.reasonUnfinished",
  "review.reasonBookmark", "review.reasonStale", "review.lastReview", "review.neverReviewed",
  "review.showing", "review.startMistakes", "review.startFive", "review.close", "review.next",
  "review.finish", "review.gotIt", "review.markWrong", "review.reveal", "review.timeLeft",
  "review.timeUp", "review.summary", "review.noMistakes", "review.backToQuiz", "review.openLesson"
];

console.log("— Phase 4 lesson helpers (source) —");
check("MODULE 40 slice found", m40.length > 0);
check("path-row lookup derives from real paths", m40.includes("function lessonPathRow"));
check("time estimate derives from word count", m40.includes("function lessonMinutes") && m40.includes("lessonWords"));
check("difficulty derives authored → quiz mix → path", m40.includes('source:"quiz-mix"') && m40.includes('source:"path"'));
check("prerequisites derive from earlier path topics", m40.includes("function lessonPrereqs"));
check("quick checks use real bank questions", m40.includes("function lessonChecks") && m40.includes("QUIZZES[subjectKey]"));
check("related quiz/lab helpers exist", m40.includes("function lessonRelatedQuiz") && m40.includes("function lessonRelatedLab"));
check("lab links use the real view target", m40.includes('r.k==="lab"&&r.view'));
check("local stores: lessons/bookmarks/notes/revision",
  m40.includes('lessonStore("lessons"') && m40.includes('lessonStore("bookmarks"') &&
  m40.includes('lessonStore("lesson-notes"') && m40.includes('lessonStore("revision"'));
check("notes capped at 2000 chars", m40.includes("slice(0,2000)"));
check("bookmark store persists and notifies", m40.includes('Store.set("bookmarks"') && m40.includes('"nova:progress-changed"'));

console.log("\n— lesson view wiring —");
check("shell carries subject/topic for delegation", m40.includes("data-lsn-sub=") && m40.includes("data-lsn-topic="));
check("meta row renders time + difficulty chips", m40.includes("lesson-meta-chip") && m40.includes("lesson.minutes"));
check("objectives only when authored (honest otherwise)",
  m40.includes('Lang.t("lesson.objectives")') && m40.includes('Lang.t("lesson.noObjectives")'));
check("prereq/checks/notes/review blocks render", m40.includes("prereqHtml") && m40.includes("checksHtml") && m40.includes("notesHtml") && m40.includes("reviewHtml"));
check("mark-complete is a real toggle", m40.includes('data-lsn-complete="1"') && m40.includes("lesson.markUndone"));
check("bookmark is a real toggle", m40.includes('data-lsn-bookmark="1"') && m40.includes("lesson.unbookmark"));
check("mark-undone survives reopen (undone map)", m40.includes("st.undone"));
check("one delegated lesson listener, bound once", m40.includes("function bindLessonDelegation") && m40.includes("window.__lsnDelegated"));
check("quick-check answers disable + explain", m40.includes("lesson-check-fb") && m40.includes("lesson.checkCorrect"));
check("review buttons deep-link to revision UI", m40.includes('data-review-start="mistakes"') && m40.includes('data-review-start="five"'));

console.log("\n— quiz delegated handler fix —");
const bindStart = js.indexOf("function bindQuizDelegation");
const bindEnd = js.indexOf("function clearQuizData", bindStart);
const bindSrc = bindStart >= 0 && bindEnd > bindStart ? js.slice(bindStart, bindEnd) : "";
check("exactly one delegated click listener on the quiz mount",
  (bindSrc.match(/app\.addEventListener\("click"/g) || []).length === 1);
check("mode toggle handled inside the single listener", bindSrc.includes('t.closest(".q-mode-btn")'));
check("option answering still delegated", bindSrc.includes('t.closest(".q-option")'));

console.log("\n— MODULE 52 · revision (source) —");
check("MODULE 52 exists and is isolated by markers", rev.length > 0);
check("queue reads missed questions from the local store", rev.includes('sget("missed"'));
check("queue reads unfinished lessons", rev.includes('sget("lessons"') && rev.includes("ls.undone"));
check("queue reads bookmarks", rev.includes('sget("bookmarks"'));
check("queue reads prior review dates", rev.includes('sget("revision"'));
check("queue prunes entries that no longer resolve to real banks", rev.includes("bank.questions.length"));
check("stale rule is 7 days and transparent", rev.includes("STALE_AFTER") && rev.includes("7 * DAY_MS"));
check("every item exposes its reason", rev.includes("REASON_KEY") && rev.includes("review.reasonMissed"));
check("queue is capped with shown/total note", rev.includes("QUEUE_CAP") && rev.includes("review.showing"));
check("five-minute practice has a real countdown", rev.includes("FIVE_MIN_MS") && rev.includes("setInterval"));
check("correct answer retires the mistake locally", rev.includes("missedRemove") && rev.includes("saveReview"));
check("summary reports correct/answered/remaining", rev.includes("review.summary"));
check("exposed for diagnostics", rev.includes("window.PlatformRevision"));
check("no external dependency introduced", !/require\(|import\s+|<script[^>]+src=["']https?:/.test(rev));

console.log("\n— mounts, styles, cache —");
check("revision mount added to the progress view", html.includes('id="revisionApp"'));
check("revision mount is live-region polite", html.includes('class="revision-app reveal" aria-live="polite"'));
check("lesson + revision styles exist", css.includes(".lesson-meta-chip") && css.includes(".lesson-check-opt") && css.includes(".rev-list") && css.includes(".rev-card"));
check("RTL-safe logical properties used", css.includes("margin-inline-start") && css.includes("border-inline-start") && css.includes("padding-inline-start"));
check("responsive collapse present", /@media \(max-width: 720px\)[\s\S]*\.rev-item \{ flex-direction: column/.test(css));
check("focus-visible styles present", css.includes(".rev-opt:focus-visible") && css.includes(".lesson-check-opt:focus-visible"));
check("reduced-motion support present", /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.rev-opt/.test(css));
check("service worker cache bumped", /CACHE_VERSION = "v1\.(22\.[6-9]|2[3-9]\.\d+)"/.test(sw));

console.log("\n— bilingual dict coverage —");
check("all lesson keys exist in Arabic", lessonKeys.every((k) => hasKey(arSrc, k)));
check("all lesson keys exist in English", lessonKeys.every((k) => hasKey(enSrc, k)));
check("all review keys exist in Arabic", reviewKeys.every((k) => hasKey(arSrc, k)));
check("all review keys exist in English", reviewKeys.every((k) => hasKey(enSrc, k)));


console.log("\n— functional: buildQueue in a stubbed browser —");
(function functional() {
  const quizJson = JSON.parse(fs.readFileSync(path.join(root, "data", "quizzes.json"), "utf8"));
  const realCode = Object.keys(quizJson)[0];
  const bankSize = quizJson[realCode].questions.length;

  const data = {};
  const now = Date.now();
  data["missed"] = {};
  data["missed"][realCode + ":0"] = now;
  data["missed"][realCode + ":1"] = now;
  data["missed"]["bogus-subject:5"] = now;              /* must be pruned */
  data["missed"][realCode + ":" + (bankSize + 50)] = now; /* out of range → pruned */
  data["lessons"] = { v: 1, done: {}, undone: { "260210030702/مفاهيم أساسية": true }, last: { key: "260210030802/موضوع", sub: "260210030802", topic: "موضوع", ts: now } };
  data["bookmarks"] = { v: 1, items: { "260210031102/تصميم": true } };
  data["revision"] = { v: 1, last: {} };
  data["revision"].last["missed:" + realCode + ":0"] = now;
  data["revision"].last["old:stale:1"] = now - 10 * 86400000;
  data["revision"].last["fresh:ok:1"] = now - 86400000;

  const mount = {
    _html: "",
    addEventListener() {}, querySelector() { return null; },
  };
  Object.defineProperty(mount, "innerHTML", { get() { return mount._html; }, set(v) { mount._html = String(v); } });

  const win = {};
  const sandbox = {
    console,
    document: { getElementById(id) { return id === "revisionApp" ? mount : null; }, addEventListener() {}, dispatchEvent() {} },
    Lang: { current: "ar", t(k) { return k; }, onSwitch() {} },
    setInterval() { return 0; }, clearInterval() {},
  };
  win.PLATFORM_STORE = {
    get(k, fb) { return k in data ? data[k] : fb; },
    set(k, v) { data[k] = v; },
    remove(k) { delete data[k]; },
  };
  win.QUIZZES = quizJson;
  win.PLATFORM_LESSONS = {};
  sandbox.window = win;
  vm.createContext(sandbox);
  vm.runInContext(rev, sandbox, { filename: "module52.js" });

  const api = win.PlatformRevision;
  check("MODULE 52 boots and exposes its API", !!api && typeof api.buildQueue === "function");
  if (!api) return;

  const q = api.buildQueue();
  const kinds = q.reduce((a, x) => { a[x.kind] = (a[x.kind] || 0) + 1; return a; }, {});
  check("invalid missed entries pruned (2 valid of 4)", (kinds.missed || 0) === 2);
  check("unfinished lessons queued (undone + last-opened)", (kinds.unfinished || 0) === 2);
  check("bookmarked topic queued", (kinds.bookmark || 0) === 1);
  check("only entries stale > 7 days resurface", (kinds.stale || 0) === 1);
  check("reviewed items keep their last-review timestamp",
    q.some((x) => x.id === "missed:" + realCode + ":0" && x.lastReviewed === now));
  check("queue ids are unique", new Set(q.map((x) => x.id)).size === q.length);
  check("initial queue render produced markup", mount._html.includes("rev-shell"));
})();

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);

