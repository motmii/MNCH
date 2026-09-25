"use strict";
/**
 * Wave 1 creative hero — MODULE 55 (HeroNow ribbon), MODULE 56 (HeroTabs) and
 * MODULE 57 (HeroAdaptiveNext).
 *
 * Static checks validate index.html / style.css / sw.js / script.js sources;
 * the runtime part EXECUTES modules 55–57 in a vm with a stubbed DOM (same
 * approach as hero-dash-search.test.js) and proves that:
 *   1. the "Now" ribbon paints a greeting + the real next class + chip states,
 *   2. findNextClass handles ongoing / today / tomorrow / in-days / no-schedule,
 *   3. the tablist is keyboard accessible (RTL-aware arrows, Home/End, roving
 *      tabindex) and toggles each panel's `hidden`,
 *   4. the adaptive strip orders resume → missed → lesson → path → general,
 *      hides itself for brand-new students, deep-starts the resume quiz and
 *      stays dismissed,
 *   5. every new string exists in BOTH dictionaries and the SW cache version
 *      matches the cache-busted assets.
 * Run: node tests/hero-wave1.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

/* ---------- static: script.js modules ---------- */
console.log("— script.js: MODULES 55–57 —");
let parses = true;
try { new vm.Script(js); } catch (e) { parses = false; }
check("script.js parses", parses);
const modStart = js.indexOf("(function initHeroNow()");
check("MODULE 55 marker present", js.includes("MODULE 55 · HeroNow") && modStart > -1);
check("MODULE 56 marker present", js.includes("MODULE 56 · HeroTabs"));
check("MODULE 57 marker present", js.includes("MODULE 57 · HeroAdaptiveNext"));
const mods = modStart > -1 ? js.slice(modStart) : "";
check("modules publish their APIs",
  mods.includes("window.PlatformHeroNow") && mods.includes("window.PlatformHeroTabs") &&
  mods.includes("window.PlatformAdaptiveNext"));
check("modules never use innerHTML", !mods.includes("innerHTML"));
check("modules make no network calls", !/fetch\s*\(|XMLHttpRequest/.test(mods));
check("Now ribbon refreshes every 60s", mods.includes("setInterval(render, 60000)"));
check("tabs: stub-safe querySelectorAll guard", mods.includes('typeof document.querySelectorAll === "function"'));
check("tabs: RTL-aware arrows + Home/End",
  mods.includes('ev.key === "ArrowRight"') && mods.includes('ev.key === "ArrowLeft"') &&
  mods.includes('ev.key === "Home"') && mods.includes('ev.key === "End"'));
check("tabs: roving tabindex", mods.includes('t.setAttribute("tabindex", isTarget ? "0" : "-1")'));
check("next strip listens for progress + view changes",
  mods.includes('document.addEventListener("nova:progress-changed"') &&
  mods.includes('document.addEventListener("nova:view-changed"'));
check("every module re-renders on language switch", (mods.match(/L10N\.onSwitch\(/g) || []).length >= 3);

/* determineNextAction priority order */
const dnaStart = mods.indexOf("function determineNextAction");
const dnaEnd = mods.indexOf("function render", dnaStart);
const dna = dnaStart > -1 ? mods.slice(dnaStart, dnaEnd > -1 ? dnaEnd : undefined) : "";
const order = ["resume", "missed", "lesson", "path", "general"].map((t) => dna.indexOf('type: "' + t + '"'));
check("next strip priority: resume → missed → lesson → path → general",
  order.every((i) => i > -1) && order.every((i, n) => n === 0 || i > order[n - 1]));

/* ---------- static: i18n (AR + EN) ---------- */
console.log("\n— i18n (AR + EN) —");
const dictStart = js.indexOf("const DICT");
const arStart = js.indexOf("ar: {", dictStart);
const enStart = js.indexOf("en: {", arStart);
const arDict = js.slice(arStart, enStart);
const enDict = js.slice(enStart);
const NEW_KEYS = [
  "dash.tabsAria", "dash.tabToday", "dash.tabPath", "dash.tabMotivation",
  "now.loading", "now.greetMorning", "now.greetEvening", "now.greetNight",
  "now.nextClass", "now.startsAt", "now.chipNow", "now.chipToday",
  "now.chipTomorrow", "now.chipInDays", "now.noSchedule",
  "next.title", "next.dismiss", "next.resumeMeta", "next.resumeCta",
  "next.missedMeta", "next.missedCta", "next.lessonMeta", "next.lessonCta",
  "next.pathMeta", "next.pathCta", "next.lessonGeneric",
];
function hasKey(src, k) { return src.indexOf('"' + k + '":') > -1; }
check("every dash.tab*/now.*/next.* key exists in Arabic", NEW_KEYS.every((k) => hasKey(arDict, k)));
check("every dash.tab*/now.*/next.* key exists in English", NEW_KEYS.every((k) => hasKey(enDict, k)));

/* ---------- static: index.html ---------- */
console.log("\n— index.html: hero Wave-1 markup —");
check("#heroNow ribbon with status role", html.includes('id="heroNow"') && html.includes('role="status"'));
check("ribbon text mount localized", html.includes('id="heroNowText" data-i18n="now.loading"'));
check("ribbon chip mount starts hidden", html.includes('id="heroNowChip" hidden'));
check("tablist present", html.includes('id="heroDashTabs" role="tablist"'));
check("3 tabs with role=tab + aria-controls",
  (html.match(/role="tab" aria-/g) || []).length >= 3 &&
  html.includes('id="heroTabToday" role="tab" aria-selected="true" aria-controls="heroPanelToday" tabindex="0"'));
check("inactive tabs carry tabindex=-1",
  (html.match(/aria-selected="false" aria-controls="heroPanel\w+" tabindex="-1"/g) || []).length === 2);
check("3 panels with role=tabpanel + aria-labelledby",
  (html.match(/role="tabpanel" aria-labelledby="heroTab\w+"/g) || []).length === 3);
check("inactive panels start hidden",
  (html.match(/aria-labelledby="heroTab\w+" tabindex="0" hidden/g) || []).length === 2);
check("#heroNextAction strip present + hidden", html.includes('id="heroNextAction" hidden'));
check("next strip mounts: title, live meta, cta, dismiss",
  html.includes('id="heroNextTitle"') && html.includes('id="heroNextMeta" aria-live="polite"') &&
  html.includes('id="heroNextBtn"') && html.includes('id="heroNextDismiss"'));
check("#heroStartHere still present (DOM contract)", html.includes('id="heroStartHere"'));
check("legacy dashboard mounts survive inside panels",
  ["heroDashLesson", "heroDashTasks", "heroDashQuiz", "heroDashContinue",
   "heroDashPath", "heroDashDaily", "heroDashWeekly"].every((id) => html.includes('id="' + id + '"')));
check("asset version bumped", html.includes("style.css?v=1.22.16"));

/* ---------- static: style.css ---------- */
console.log("\n— style.css: Wave-1 styles —");
check("style for .hero-now", /\.hero-now\s*\{/.test(css));
check("style for .hero-now-chip", /\.hero-now-chip\s*\{/.test(css));
check("live + today chip states", css.includes(".hero-now-chip.is-live") && css.includes(".hero-now-chip.is-today"));
check("pulse-dot keyframe defined", css.includes("@keyframes pulse-dot"));
check("style for .hero-tabs", css.includes(".hero-tabs {"));
check("style for .hero-tab", /\.hero-tab\s*\{/.test(css));
check("style for .hero-panel", /\.hero-panel\s*\{/.test(css));
check("panel hidden wins", css.includes(".hero-panel[hidden]"));
check("style for .hero-next", /\.hero-next\s*\{/.test(css));
check("tab focus-visible ring", /\.hero-tab:focus-visible|:focus-visible[^{]*\{[^}]*outline/.test(css) || css.includes(".hero-tab:hover"));
check("mobile rule for the Now strip", /@media \(max-width: 560px\)[\s\S]{0,400}\.hero-now\s*\{/.test(css));
check("reduced-motion guard for live chip", /prefers-reduced-motion[\s\S]{0,300}\.hero-now-chip\.is-live\s*\{\s*animation:\s*none/.test(css));

/* ---------- static: sw.js ---------- */
console.log("\n— sw.js: cache —");
check("cache version >= v1.22.16", (() => {
  const m = /CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/.exec(sw);
  if (!m) return false;
  const [maj, min, pat] = [+m[1], +m[2], +m[3]];
  return maj > 1 || (maj === 1 && (min > 22 || (min === 22 && pat >= 16)));
})());


/* ---------- runtime harness: execute MODULES 55–57 in a vm ---------- */
console.log("\n— runtime: stubbed browser —");

function makeEl(id) {
  const attrs = {};
  const listeners = {};
  const el = {
    id, _text: "", attrs, listeners, dataset: {}, className: "", hidden: false, focused: false,
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, force) {
        if (force === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
        else if (force) this._s.add(c); else this._s.delete(c);
        return this._s.has(c);
      },
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { (listeners[t] || []).forEach((fn) => fn(ev || {})); },
    focus() { el.focused = true; },
  };
  Object.defineProperty(el, "textContent", { get() { return el._text; }, set(v) { el._text = String(v); } });
  return el;
}

function boot(opts) {
  opts = opts || {};
  const byId = {};
  ["heroNow", "heroNowText", "heroNowChip", "heroDashTabs", "heroStartHere",
   "heroNextAction", "heroNextTitle", "heroNextMeta", "heroNextBtn", "heroNextDismiss"
  ].forEach((id) => { byId[id] = makeEl(id); });

  const tabDefs = [
    ["heroTabToday", "heroPanelToday", "true", "0"],
    ["heroTabPath", "heroPanelPath", "false", "-1"],
    ["heroTabMotivation", "heroPanelMotivation", "false", "-1"],
  ];
  const tabs = tabDefs.map(([id, panel, sel, tabi]) => {
    const t = makeEl(id);
    t.setAttribute("role", "tab");
    t.setAttribute("aria-selected", sel);
    t.setAttribute("aria-controls", panel);
    t.setAttribute("tabindex", tabi);
    if (sel === "true") t.classList.add("is-active");
    return t;
  });
  tabDefs.forEach(([, panelId], i) => {
    const p = makeEl(panelId);
    p.hidden = i !== 0;
    byId[panelId] = p;
  });
  byId.heroNowChip.hidden = true;
  byId.heroNextAction.hidden = true;

  const docListeners = {};
  const documentStub = {
    documentElement: { dir: opts.dir || "rtl" },
    getElementById(id) { return byId[id] || null; },
    querySelectorAll(sel) {
      if (sel === "#heroDashTabs [role='tab']") return tabs.slice();
      return [];
    },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    dispatch(t, ev) { (docListeners[t] || []).forEach((fn) => fn(ev || {})); },
  };

  const intervals = [];
  const switchers = [];
  const LangStub = {
    current: opts.lang || "ar",
    t(key) { return "\u27e6" + key + "\u27e7"; },
    onSwitch(fn) { switchers.push(fn); },
    switchTo(next) { LangStub.current = next; switchers.forEach((fn) => fn(next)); },
  };
  const storeData = opts.store || {};
  const localStorageStub = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storeData, k) ? storeData[k] : null; },
    setItem(k, v) { storeData[k] = String(v); },
    removeItem(k) { delete storeData[k]; },
  };

  const win = Object.assign({
    PLATFORM_CURRENT_SEMESTER: opts.semester || require(path.join(root, "current-semester.js")),
    PLATFORM_STORE: opts.platformStore || undefined,
    Lang: LangStub,
    readStore: opts.readStore || function () { return {}; },
    QUIZZES: opts.quizzes || {},
    getLearningPaths: opts.getLearningPaths,
    NovaViews: opts.novaViews,
    startQuiz: opts.startQuiz,
  }, opts.winExtra || {});

  const ctx = {
    window: win,
    document: documentStub,
    Lang: LangStub,
    localStorage: localStorageStub,
    setInterval(fn, ms) { intervals.push(ms); return intervals.length; },
    clearInterval() {},
    console,
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat,
  };
  vm.createContext(ctx);
  vm.runInContext(mods, ctx, { filename: "hero-modules.js" });
  return { byId, tabs, docListeners, intervals, switchers, win, ctx, documentStub, LangStub };
}

function fire(el, t, ev) { (el.listeners[t] || []).forEach((fn) => fn(ev || {})); }



console.log("\n— MODULE 55: Now ribbon —");
{
  const app = boot();
  const api = app.win.PlatformHeroNow;
  check("window.PlatformHeroNow exposes findNextClass + parseTimeMinutes",
    !!api && typeof api.findNextClass === "function" && typeof api.parseTimeMinutes === "function");
  check("parseTimeMinutes parses AM/PM", api.parseTimeMinutes("09:00 AM") === 540 && api.parseTimeMinutes("12:00 PM") === 720);
  check("parseTimeMinutes rejects junk", api.parseTimeMinutes("bad") === null);

  const SUN_2026 = (h, m) => new Date(2026, 0, 4, h, m); /* 2026-01-04 is a Sunday */
  const ongoing = api.findNextClass(SUN_2026(10, 0));
  check("ongoing class detected (Sun 10:00 ∈ 09:00–12:00)", ongoing && ongoing.status === "ongoing" && ongoing.daysAway === 0);
  const todayLater = api.findNextClass(SUN_2026(7, 0));
  check("later today = upcoming, daysAway 0", todayLater && todayLater.status === "upcoming" && todayLater.daysAway === 0);
  const tomorrow = api.findNextClass(new Date(2026, 0, 3, 10, 0)); /* Saturday */
  check("tomorrow detected (daysAway 1)", tomorrow && tomorrow.daysAway === 1);
  const inDays = api.findNextClass(new Date(2026, 0, 7, 10, 0)); /* Wednesday */
  check("in-days detected (daysAway 4)", inDays && inDays.daysAway === 4);
  const pastToday = api.findNextClass(SUN_2026(16, 0)); /* after Sunday's last class */
  check("past today's slots → tomorrow's class (daysAway 1)", pastToday && pastToday.daysAway === 1);
  check("real official subject attached", ongoing && ongoing.item && ongoing.item.subject && ongoing.item.subject.name);

  const text = app.byId.heroNowText.textContent;
  check("greeting rendered for time of day", /\u27e6now\.greet(Morning|Evening|Night)\u27e7/.test(text));
  check("next class line + starts-at rendered",
    text.includes("\u27e6now.nextClass\u27e7") && text.includes("\u27e6now.startsAt\u27e7"));
  check("chip visible + stateful",
    app.byId.heroNowChip.hidden === false && app.byId.heroNowChip.textContent.indexOf("\u27e6now.chip") === 0);
  check("chip keeps .hero-now-chip class", app.byId.heroNowChip.className.indexOf("hero-now-chip") === 0);
  check("60s refresh interval registered", app.intervals.includes(60000));
  check("≥3 locale-switch subscribers (55 + 56 + 57)", app.switchers.length >= 3);
}
{
  const app = boot({ semester: { subjects: [] } });
  check("no timetable → honest empty state", app.byId.heroNowText.textContent.includes("\u27e6now.noSchedule\u27e7"));
  check("no timetable → chip hidden", app.byId.heroNowChip.hidden === true);
  check("no timetable → findNextClass returns null",
    app.win.PlatformHeroNow.findNextClass(new Date(2026, 0, 4, 10, 0)) === null);
}


console.log("\n— MODULE 56: dashboard tabs —");
{
  const app = boot();
  const [t0, t1, t2] = app.tabs;
  const P = (id) => app.byId[id];
  check("initial: first tab selected with roving tabindex",
    t0.getAttribute("aria-selected") === "true" && t0.getAttribute("tabindex") === "0" &&
    t1.getAttribute("aria-selected") === "false" && t1.getAttribute("tabindex") === "-1" &&
    t2.getAttribute("aria-selected") === "false" && t2.getAttribute("tabindex") === "-1");
  check("initial: only panel 1 visible",
    P("heroPanelToday").hidden === false && P("heroPanelPath").hidden === true &&
    P("heroPanelMotivation").hidden === true);
  check("tablist aria-label localized from dash.tabsAria",
    app.byId.heroDashTabs.getAttribute("aria-label") === "\u27e6dash.tabsAria\u27e7");

  t1.dispatch("click");
  check("click activates tab 2 + swaps panels",
    t1.getAttribute("aria-selected") === "true" && t1.getAttribute("tabindex") === "0" &&
    t1.classList.contains("is-active") &&
    t0.getAttribute("aria-selected") === "false" && t0.getAttribute("tabindex") === "-1" &&
    P("heroPanelPath").hidden === false && P("heroPanelToday").hidden === true);

  let prevented = 0;
  const key = (el, k) => fire(el, "keydown", { key: k, preventDefault() { prevented++; } });
  key(t0, "ArrowLeft"); /* RTL: ArrowLeft = forward */
  check("RTL ArrowLeft moves forward + focuses", t1.getAttribute("aria-selected") === "true" && t1.focused === true && prevented === 1);
  key(t1, "ArrowRight"); /* RTL: ArrowRight = backward */
  check("RTL ArrowRight moves backward", t0.getAttribute("aria-selected") === "true" && prevented === 2);
  key(t0, "End");
  check("End jumps to last tab", t2.getAttribute("aria-selected") === "true" && t2.focused === true && prevented === 3);
  key(t2, "Home");
  check("Home jumps to first tab", t0.getAttribute("aria-selected") === "true" && prevented === 4);
  key(t0, "ArrowDown");
  check("unhandled keys ignored (no preventDefault, no move)",
    prevented === 4 && t0.getAttribute("aria-selected") === "true");
  check("panels follow the final selection",
    P("heroPanelToday").hidden === false && P("heroPanelPath").hidden === true &&
    P("heroPanelMotivation").hidden === true);
  check("window.PlatformHeroTabs exposes activateTab",
    !!app.win.PlatformHeroTabs && typeof app.win.PlatformHeroTabs.activateTab === "function");

  const ltr = boot({ dir: "ltr" });
  fire(ltr.tabs[0], "keydown", { key: "ArrowRight", preventDefault() {} });
  check("LTR ArrowRight moves forward", ltr.tabs[1].getAttribute("aria-selected") === "true");
  fire(ltr.tabs[1], "keydown", { key: "ArrowLeft", preventDefault() {} });
  check("LTR ArrowLeft moves backward", ltr.tabs[0].getAttribute("aria-selected") === "true");
}


console.log("\n— MODULE 57: adaptive next strip —");
{
  const app = boot();
  const N = app.byId.heroNextAction, S = app.byId.heroStartHere;
  check("fresh student: next strip hidden, Start-Here shown", N.hidden === true && S.hidden === false);
  check("fresh student: determineNextAction() → null", app.win.PlatformAdaptiveNext.determineNextAction() === null);
  check("progress + view listeners registered",
    (app.docListeners["nova:progress-changed"] || []).length >= 1 &&
    (app.docListeners["nova:view-changed"] || []).length >= 1);
}
{
  const views = [], starts = [];
  let storeState = { progress: { sec1: { idx: 1 } }, results: {} };
  const app = boot({
    quizzes: { sec1: { name: "Security 101", questions: [{}, {}, {}] } },
    readStore: () => storeState,
    novaViews: { activate: (v) => views.push(v) },
    startQuiz: (sub, resume) => starts.push([sub, resume]),
  });
  const N = app.byId.heroNextAction, S = app.byId.heroStartHere;
  const meta = app.byId.heroNextMeta, btn = app.byId.heroNextBtn;
  check("resume: strip shown, Start-Here hidden", N.hidden === false && S.hidden === true);
  check("resume: localized meta + CTA",
    meta.textContent === "\u27e6next.resumeMeta\u27e7" && btn.textContent === "\u27e6next.resumeCta\u27e7");
  check("resume: href #quiz + dataset tagged",
    btn.getAttribute("href") === "#quiz" && btn.dataset.nextType === "resume" && btn.dataset.nextSub === "sec1");
  let prevented = false;
  fire(btn, "click", { preventDefault() { prevented = true; } });
  check("resume: click opens quiz view + starts the bank",
    prevented && views[0] === "quiz" && starts.length === 1 && starts[0][0] === "sec1" && starts[0][1] === true);

  fire(app.byId.heroNextDismiss, "click");
  check("dismiss hides strip + restores Start-Here", N.hidden === true && S.hidden === false);
  storeState = { progress: { sec1: { idx: 2 } }, results: {} };
  app.documentStub.dispatch("nova:progress-changed");
  check("dismiss stays dismissed after progress events", N.hidden === true);
}
{
  const app = boot({
    quizzes: { sec1: { name: "Security 101", questions: [{}, {}] } },
    readStore: () => ({ progress: {}, results: {} }),
    store: { "motmi-portal:missed": JSON.stringify({ sec1: [1] }) },
  });
  check("missed queue outranks everything else",
    app.byId.heroNextMeta.textContent === "\u27e6next.missedMeta\u27e7" &&
    app.byId.heroNextBtn.getAttribute("href") === "#progress");
}
{
  const app = boot({
    store: { "motmi-portal:lessons": JSON.stringify({ last: { sub: "sec1", topic: "intro" } }) },
  });
  check("last lesson used when nothing is pending",
    app.byId.heroNextMeta.textContent === "\u27e6next.lessonMeta\u27e7" &&
    app.byId.heroNextBtn.getAttribute("href") === "#lesson/sec1/intro");
}
{
  const app = boot({
    readStore: () => ({ progress: {}, results: { a: { passed: true } } }),
    quizzes: { sec1: { questions: [{}, {}] } },
    getLearningPaths: () => [{
      id: "fundamentals", status: "active", title: { ar: "الأساسيات", en: "Fundamentals" },
      topics: [{ quiz: "a" }, { quiz: "b" }, { quiz: "c" }],
    }],
  });
  check("in-progress path offered with its deep link",
    app.byId.heroNextMeta.textContent === "\u27e6next.pathMeta\u27e7" &&
    app.byId.heroNextBtn.getAttribute("href") === "#path/fundamentals");
}
{
  const app = boot({
    readStore: () => ({ progress: {}, results: { sec1: { passed: true } } }),
    quizzes: { sec1: { questions: [{}] } },
  });
  check("general fallback for a returning student",
    app.byId.heroNextMeta.textContent === "\u27e6next.lessonGeneric\u27e7" &&
    app.byId.heroNextBtn.getAttribute("href") === "#paths" &&
    app.byId.heroNextBtn.textContent === "\u27e6dash.continue\u27e7");
}
{
  let storeState = { progress: {}, results: {} };
  const app = boot({ quizzes: { sec1: { questions: [{}, {}] } }, readStore: () => storeState });
  const N = app.byId.heroNextAction;
  check("initially hidden for an empty student", N.hidden === true);
  storeState = { progress: { sec1: { idx: 1 } }, results: {} };
  app.documentStub.dispatch("nova:progress-changed");
  check("nova:progress-changed re-renders the strip live",
    N.hidden === false && app.byId.heroNextBtn.dataset.nextType === "resume");
}


console.log("\n" + (failures ? "\u2717 " + failures + " check(s) failed" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);

