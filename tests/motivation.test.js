"use strict";
/**
 * Phase 2 runtime test — MODULE 50 · Motivation.
 * Executes the real module slice in a stubbed browser and verifies:
 *   1. XP calculation and idempotent awards,
 *   2. level calculation,
 *   3. achievement unlocking from real progress data,
 *   4. streak calculation,
 *   5. existing-progress compatibility (idempotent backfill),
 *   6. corrupted/missing localStorage safety + reset confirmation,
 *   7. Arabic and English interface output,
 *   8. the four genuine-action hooks exist in script.js.
 * Run: node tests/motivation.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

const START = js.indexOf("/* @@MOTIVATION_START@@ */");
const END = js.indexOf("/* @@MOTIVATION_END@@ */");
if (START < 0 || END <= START) throw new Error("MODULE 50 markers not found");
const moduleSrc = js.slice(START, END);

const MOT_KEYS = [
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
];
const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
function dictValue(src, key) {
  const re = new RegExp('"' + key.replace(/\./g, "\\.") + '":\\s*"((?:[^"\\\\]|\\\\.)*)"');
  const m = re.exec(src);
  return m ? m[1].replace(/\\"/g, '"') : "";
}
function makeEl(id) {
  const el = {
    id, _html: "", _text: "", attrs: {}, dataset: {}, listeners: {}, style: {}, hidden: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el.attrs, k) ? el.attrs[k] : null; },
    removeAttribute(k) { delete el.attrs[k]; },
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {}, blur() {}, click() {},
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html; }, set(v) { el._html = String(v); } });
  Object.defineProperty(el, "textContent", { get() { return el._text; }, set(v) { el._text = String(v); } });
  return el;
}
const UI_IDS = [
  "heroDashLevel", "heroDashLevelTitle", "heroDashXp", "heroDashXpBar", "heroDashXpMeter",
  "heroDashXpNext", "heroDashDaily", "heroDashDailyBar", "heroDashDailyMeter",
  "heroDashWeekly", "heroDashWeeklyBar", "heroDashWeeklyMeter", "heroDashStreak",
  "heroDashBadges", "heroDashBadgeCount", "heroDashReset",
];

/** @param {Object} opts Boot options. @returns {Object} Harness. */
function boot(opts) {
  const o = opts || {};
  const storage = {};
  Object.keys(o.store || {}).forEach((k) => {
    const v = o.store[k];
    storage["motmi-portal:" + k] = (typeof v === "string") ? v : JSON.stringify(v);
  });
  const els = {};
  UI_IDS.forEach((id) => { els[id] = makeEl(id); });
  const docListeners = {};
  const winListeners = [];
  const storeBridge = {
    get(k, fb) {
      const key = "motmi-portal:" + k;
      if (!(key in storage)) return fb;
      try { return JSON.parse(storage[key]); } catch (e) { return fb; }
    },
    set(k, v) { storage["motmi-portal:" + k] = JSON.stringify(v); },
    remove(k) { delete storage["motmi-portal:" + k]; },
  };
  const lang = {
    current: o.locale || "ar",
    t(k, p) {
      let s = dictValue(lang.current === "en" ? enSrc : arSrc, k);
      if (!s) return k;
      if (p) Object.keys(p).forEach((x) => { s = s.split("{" + x + "}").join(String(p[x])); });
      return s;
    },
    onSwitch() {},
  };
  let results = o.results || {};
  const win = {
    PLATFORM_STORE: storeBridge,
    readStore() { return { results: results, progress: {} }; },
    QUIZZES: o.banks || {},
    getLearningPaths: () => (o.paths || []),
    Lang: lang,
    confirm: o.confirm || (() => true),
    addEventListener(t, fn) { winListeners.push([t, fn]); },
    removeEventListener() {},
  };
  const doc = {
    getElementById(id) { return els[id] || null; },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener() {},
  };
  const ctx = { window: win, document: doc, console: console, JSON: JSON, Date: Date, isFinite: isFinite };
  vm.createContext(ctx);
  vm.runInContext(moduleSrc, ctx, { filename: "module50.js" });
  return {
    api: win.PlatformMotivation,
    els: els, storage: storage, win: win, lang: lang, docListeners: docListeners,
    setResults(r) { results = r; },
  };
}

function totalFrom(state) {
  return Object.keys(state.events).reduce((sum, k) => sum + (state.events[k].xp || 0), 0);
}
function pad(n) { return n < 10 ? "0" + n : String(n); }
function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function shift(key, delta) {
  const p = key.split("-");
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}
const TODAY = dayKey(new Date());

console.log("— module + genuine-action hooks —");
check("MODULE 50 markers present", START >= 0 && END > START);
check("namespaced localStorage key", js.includes('STORE_KEY = "motivation"') && js.includes('"motmi-portal:" + STORE_KEY'));
["lesson", "quiz", "flash", "lab"].forEach((kind) => {
  check("genuine hook present: " + kind, js.indexOf('awardMotivation("' + kind + '"') >= 0);
});

console.log("\n— XP calculation —");
const xp = boot({ banks: { b1: { name: "Bank", questions: [1] } } });
check("fresh state has no XP", Object.keys(xp.api.getState().events).length === 0);
check("flashcard first review grants 5 XP", xp.api.award("flash", 0) === true && totalFrom(xp.api.getState()) === 5);
check("re-reviewing the same card grants no XP", xp.api.award("flash", 0) === false && totalFrom(xp.api.getState()) === 5);
check("lesson, quiz and lab grant their XP values",
  xp.api.award("lesson", "s/t") === true &&
  xp.api.award("quiz", "b1") === true &&
  xp.api.award("lab", "redteam") === true &&
  totalFrom(xp.api.getState()) === 130);
check("unknown kind / empty id are rejected",
  xp.api.award("badge", "x") === false && xp.api.award("lab", "") === false);
check("today's daily and weekly XP reflect genuine awards",
  xp.api.getState().days[TODAY] === 130 &&
  xp.els.heroDashDaily.textContent.indexOf("130") >= 0 &&
  xp.els.heroDashWeekly.textContent.indexOf("130") >= 0);

console.log("\n— level calculation —");
const l0 = xp.api.getLevelInfo(0), l99 = xp.api.getLevelInfo(99), l130 = xp.api.getLevelInfo(130), l550 = xp.api.getLevelInfo(550);
check("0 XP → level 1, 100 remaining", l0.level === 1 && l0.into === 0 && l0.remaining === 100);
check("99 XP → level 1 at 99%", l99.level === 1 && l99.pct === 99);
check("130 XP → level 2 with 30 into-level XP", l130.level === 2 && l130.into === 30 && l130.next === 3);
check("level titles cap at six while the number grows", l550.level === 6 && l550.titleLevel === 6);
check("UI paints level + XP", xp.els.heroDashLevel.textContent === "2" && xp.els.heroDashXp.textContent.indexOf("130") >= 0);

console.log("\n— achievement unlocking (real data only) —");
const locked = boot({ banks: { b1: { questions: [1] } } });
check("a student with no activity unlocks nothing",
  Object.keys(locked.api.getState().badges).length === 0 &&
  locked.els.heroDashBadges.innerHTML.indexOf("is-locked") >= 0);

const CODES = ["260210030702", "260210030802", "260210030902", "260210031002", "260210031102"];
const allBanks = {}, allResults = {}, streakDays = {};
CODES.forEach((code) => { allBanks[code] = { name: code, questions: [1] }; allResults[code] = { pct: 85 }; });
for (let i = 0; i < 7; i++) streakDays[shift(TODAY, -i)] = 40;
const full = boot({
  banks: allBanks,
  results: allResults,
  store: {
    motivation: { v: 1, events: {}, days: streakDays, badges: {}, bestStreak: 0 },
    labs: { v: 1, done: { ir: true, redteam: true, cryptolab: true } },
    lessons: { v: 1, done: { "s/t": true } },
    flash: { v: 1, reviewed: { 0: true } },
  },
});
const fullBadges = full.api.getState().badges;
check("all nine achievements unlock from genuine existing progress",
  Object.keys(fullBadges).length === 9);
["firstLesson", "firstQuiz", "quizMaster", "labExplorer", "cryptoApprentice",
 "networkNavigator", "incidentResponder", "streak7", "semesterFinisher"].forEach((id) => {
  check("badge unlocked: " + id, !!fullBadges[id]);
});
check("badge counter + unlocked style paint",
  full.els.heroDashBadgeCount.textContent.indexOf("9") >= 0 &&
  full.els.heroDashBadges.innerHTML.indexOf("is-unlocked") >= 0);
check("quizMaster requires 80%+ in every bank", (function () {
  const low = boot({ banks: { a: { questions: [1] }, b: { questions: [1] } }, results: { a: { pct: 90 }, b: { pct: 50 } } });
  return !low.api.getState().badges.quizMaster;
})());

console.log("\n— streak calculation —");
const gap = boot({ store: { motivation: { v: 1, events: {}, days: { [TODAY]: 40, [shift(TODAY, -3)]: 40 }, badges: {} } } });
check("a gap resets the current streak", gap.api.getState().bestStreak === 1);
const chain = boot({ store: { motivation: { v: 1, events: {}, days: { [TODAY]: 40, [shift(TODAY, -1)]: 40, [shift(TODAY, -2)]: 40 }, badges: {} } } });
check("consecutive days calculate a three-day streak",
  chain.api.getState().bestStreak === 3 && chain.els.heroDashStreak.textContent.indexOf("3") >= 0);
check("weekly XP sums the last seven genuine days", full.els.heroDashWeekly.textContent.indexOf("280") >= 0);
check("missing activity → zero streak", locked.api.getState().bestStreak === 0);

console.log("\n— existing progress compatibility —");
const compat = boot({
  banks: { b1: { name: "Bank", questions: [1] } },
  results: { b1: { score: 1, total: 1, pct: 100, date: TODAY } },
  store: {
    labs: { v: 1, done: { ir: true } },
    lessons: { v: 1, done: { "s/t": true } },
    flash: { v: 1, reviewed: { 0: true, 1: true } },
  },
});
check("existing genuine progress backfills exact XP (40+60+25+10)",
  totalFrom(compat.api.getState()) === 135);
check("backfilled quiz date credits today's real activity day",
  compat.api.getState().days[TODAY] === 40);
check("existing progress unlocks its earned badges",
  !!compat.api.getState().badges.firstQuiz &&
  !!compat.api.getState().badges.labExplorer &&
  !!compat.api.getState().badges.incidentResponder &&
  !!compat.api.getState().badges.firstLesson);
const beforeSync = JSON.stringify(compat.api.getState().events);
compat.api.sync();
check("backfill is idempotent (no duplicate XP)",
  JSON.stringify(compat.api.getState().events) === beforeSync);

console.log("\n— corrupted data + reset confirmation —");
const brokenJson = boot({ store: { motivation: "{not valid json" } });
check("corrupted JSON falls back to safe defaults",
  Object.keys(brokenJson.api.getState().events).length === 0 &&
  Object.keys(brokenJson.api.getState().badges).length === 0);
const brokenShape = boot({
  store: { motivation: { v: "x", events: { bad: { xp: -5 }, ok: { xp: 40 } }, days: { nope: 50 }, badges: { x: "a" }, bestStreak: "a" } },
});
check("invalid events/days/badges are dropped",
  totalFrom(brokenShape.api.getState()) === 40 &&
  Object.keys(brokenShape.api.getState().days).length === 0 &&
  Object.keys(brokenShape.api.getState().badges).length === 0);
const conf = boot({
  confirm: () => false,
  store: { motivation: { v: 1, events: { "flash:0": { xp: 5, ts: 0 } }, days: {}, badges: {} } },
});
conf.els.heroDashReset.listeners.click[0]();
check("declining the confirmation keeps motivation data", totalFrom(conf.api.getState()) === 5);
conf.win.confirm = () => true;
conf.els.heroDashReset.listeners.click[0]();
check("confirming reset clears XP/badges/streak and the motivation key",
  totalFrom(conf.api.getState()) === 0 &&
  Object.keys(conf.api.getState().badges).length === 0 &&
  !("motmi-portal:motivation" in conf.storage));

console.log("\n— Arabic / English interface —");
const ar = boot({ locale: "ar" });
ar.api.award("flash", 0);
check("Arabic XP label renders", ar.els.heroDashXp.textContent.indexOf("نقطة خبرة") >= 0);
check("Arabic achievement names render",
  ar.els.heroDashBadges.innerHTML.indexOf(dictValue(arSrc, "motivation.badge.firstQuiz")) >= 0);
const en = boot({ locale: "en" });
en.api.award("flash", 0);
check("English XP label renders", en.els.heroDashXp.textContent.indexOf("XP") >= 0);
check("English achievement names render",
  en.els.heroDashBadges.innerHTML.indexOf(dictValue(enSrc, "motivation.badge.firstQuiz")) >= 0);
["ar", "en"].forEach((loc) => {
  const src = loc === "ar" ? arSrc : enSrc;
  const missing = MOT_KEYS.filter((k) => !dictValue(src, k));
  check("all motivation keys present in " + loc, missing.length === 0);
});
check("RTL/LTR switching remains wired through Lang",
  js.includes('root.dir = cur === "ar" ? "rtl" : "ltr"'));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);
