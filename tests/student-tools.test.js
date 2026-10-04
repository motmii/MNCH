"use strict";
/**
 * Student tools tests — MODULE 68 (GPA) · MODULE 69 (timetable → .ics) ·
 * MODULE 70 (study timer), all mounted in the #student view.
 *
 *  1. Source-level: markers, defensive boot, local-only storage, no network,
 *     no notifications, createElement-only DOM, dict keys (AR + EN), mounts,
 *     router entry, styles, print sheet, cache/version bumps.
 *  2. Functional (vm, stubbed browser): GPA math + the "what do the remaining
 *     subjects need?" solver, RFC 5545 calendar authoring (CRLF, escaping,
 *     75-octet folding, floating local time, clamped repetition), and the
 *     timer state machine + logging driven by a faked clock.
 * Run: node tests/student-tools.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

/* Slice one module out of script.js (header comment to closing marker, both included). */
function moduleSource(startMark, endMark) {
  const a = js.indexOf(startMark);
  const b = js.indexOf(endMark);
  if (a < 0 || b < a) return "";
  const head = js.lastIndexOf("/* =", a);
  const tail = js.indexOf("*/", b) + 2;
  return js.slice(head >= 0 && head < a ? head : a, tail);
}
const gpaSrc = moduleSource("@@GPA_START@@", "@@GPA_END@@");
const icsSrc = moduleSource("@@ICS_START@@", "@@ICS_END@@");
const timerSrc = moduleSource("@@TIMER_START@@", "@@TIMER_END@@");

/* ---------- dict lookup (same technique as paths-i18n.test.js) ---------- */
const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
function hasKey(src, key) { return new RegExp('"' + key.replace(/\./g, "\\.") + '":').test(src); }

const STUDENT_KEYS = [
  "student.eyebrow", "student.title", "student.sub", "student.missingData", "student.localNote",
  "gpa.title", "gpa.sub", "gpa.scaleLabel", "gpa.scale500", "gpa.scale400", "gpa.scalePercent",
  "gpa.pointsHint", "gpa.colSubject", "gpa.colCredits", "gpa.colPoints", "gpa.notGraded",
  "gpa.termGpa", "gpa.creditsCounted", "gpa.priorTitle", "gpa.priorCredits", "gpa.priorGpa",
  "gpa.cumulative", "gpa.targetTitle", "gpa.target", "gpa.needLabel", "gpa.needValue",
  "gpa.needImpossible", "gpa.needGuaranteed", "gpa.needAllFilled", "gpa.bestSubject",
  "gpa.worstSubject", "gpa.noData", "gpa.reset", "gpa.note",
  "ics.title", "ics.sub", "ics.startLabel", "ics.weeksLabel", "ics.exportBtn", "ics.copyBtn",
  "ics.printBtn", "ics.downloaded", "ics.copied", "ics.copyFail", "ics.noSchedule",
  "ics.rowCount", "ics.colDay", "ics.colSubject", "ics.colTime", "ics.note", "ics.guideLink",
  "timer.title", "timer.sub", "timer.subjectLabel", "timer.focusLabel", "timer.breakLabel",
  "timer.start", "timer.pause", "timer.resume", "timer.reset", "timer.stateIdle",
  "timer.stateRunning", "timer.statePaused", "timer.stateDone", "timer.modeFocus",
  "timer.modeBreak", "timer.autoPaused", "timer.timeLeft", "timer.sessionSaved",
  "timer.totalAll", "timer.today", "timer.vsPlanned", "timer.sound", "timer.noSubject",
  "timer.note", "nav.student"
];

console.log("— MODULE 68/69/70 source —");
check("MODULE 68 exists between markers", gpaSrc.length > 0);
check("MODULE 69 exists between markers", icsSrc.length > 0);
check("MODULE 70 exists between markers", timerSrc.length > 0);
check("every module boots defensively on a missing mount",
  [gpaSrc, icsSrc, timerSrc].every((s) => /if \(!mount\) return;/.test(s) && /typeof document\.createElement !== "function"/.test(s)));
check("each module binds its delegated listeners once",
  gpaSrc.includes("__gpaBound") && icsSrc.includes("__icsBound") && timerSrc.includes("__timerBound"));
check("each module re-renders on a locale switch", [gpaSrc, icsSrc, timerSrc].every((s) => s.includes("L10N.onSwitch(")));
check("each module exposes a public surface for tests",
  gpaSrc.includes("window.PlatformGpa") && icsSrc.includes("window.PlatformIcs") && timerSrc.includes("window.PlatformStudyTimer"));
check("DOM is built with createElement/textContent only (no innerHTML)", !/innerHTML/.test(gpaSrc + icsSrc + timerSrc));
check("no network calls anywhere (fetch/XHR/beacon)", !/fetch\(|XMLHttpRequest|navigator\.sendBeacon/.test(gpaSrc + icsSrc + timerSrc));
check("no notifications; no background ticking outside the timer",
  !/new\s+Notification|requestPermission/.test(gpaSrc + icsSrc + timerSrc) &&
  !/setInterval|setTimeout/.test(gpaSrc) && !/setInterval/.test(icsSrc));
check("local-only stores used through MODULE 02 Store",
  gpaSrc.includes('STORE_KEY = "gpa"') && timerSrc.includes('STORE_KEY = "study-time"') &&
  gpaSrc.includes("window.PLATFORM_STORE") && timerSrc.includes("window.PLATFORM_STORE"));
check("GPA never hard-codes an «official» scale (editable presets + disclaimer)",
  gpaSrc.includes("gpa.pointsHint") && gpaSrc.includes("gpa.note") && /input\.max = String\(scale\(\)\.max\)/.test(gpaSrc));
check("schedule rows are derived from the official plan only",
  icsSrc.includes("window.PLATFORM_CURRENT_SEMESTER") && icsSrc.includes("meta.schedule"));
check("calendar events use floating local time (no invented TZID)",
  icsSrc.includes("localStamp") && !/TZID=|TZID:/.test(icsSrc));
check("no meeting link is ever emitted", !/https?:/.test(icsSrc));
check("RFC 5545 basics present (CRLF, escaping, 75-octet folding)",
  icsSrc.includes('"\\r\\n"') && icsSrc.includes("escapeText") && icsSrc.includes("foldLine") && icsSrc.includes("MAX = 75"));
check("timer never counts time away (visibility + view-change auto-pause)",
  timerSrc.includes("visibilitychange") && timerSrc.includes("nova:view-changed") && timerSrc.includes("pause(true)"));
check("timer logs only genuinely completed focus sessions",
  timerSrc.includes("addMinutes") && /if \(session\.mode === "focus"\)/.test(timerSrc) && timerSrc.includes('session.status = "done"'));
check("timer sound is opt-in", timerSrc.includes("prefs.sound !== true") && timerSrc.includes("Sfx.play"));

console.log("\n— mounts, router, styles, cache —");
check("index.html mounts #student with three additive cards",
  html.includes('id="student"') && html.includes('id="gpaApp"') && html.includes('id="icsApp"') && html.includes('id="timerApp"'));
check("#student is registered in the ViewSwitcher VIEWS list", js.includes('$id("student")'));
check("navbar «المزيد» menu links to #student", /href="#student" data-i18n="nav.student"/.test(html));
check("student styles exist",
  css.includes(".student-shell") && css.includes(".gpa-row") && css.includes(".ics-table") && css.includes(".timer-time"));
check("RTL-safe logical properties used", /border-inline-start: 3px/.test(css) && css.includes("inset-inline-start"));
check("focus-visible styles present", css.includes(".student-input:focus-visible"));
check("mobile breakpoint present", /@media \(max-width: 720px\)[\s\S]*\.gpa-row \{ grid-template-columns: 1fr/.test(css));
check("reduced-motion support present", /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.timer-bar-fill \{ transition: none/.test(css));
check("print sheet exists and is scoped to #student",
  /@media print \{[\s\S]*main > :not\(#student\) \{ display: none !important; \}/.test(css));
check("service worker cache bumped to at least v1.23.0", (function () {
  const m = /CACHE_VERSION = "v(\d+)\.(\d+)\.(\d+)"/.exec(sw);
  if (!m) return false;
  const v = [Number(m[1]), Number(m[2]), Number(m[3])];
  return v[0] > 1 || (v[0] === 1 && (v[1] > 23 || (v[1] === 23 && v[2] >= 0)));
})());
/* Release consistency, cross-file instead of a hard-coded number — the
   same convention tests/lecture-guide.test.js already uses, and it cannot
   stale-fail the next release. */
const swCache = (sw.match(/CACHE_VERSION\s*=\s*"v([\d.]+)"/) || [])[1];
check("package version matches the cache version", !!swCache && pkg.version === swCache);
check("style.css?v matches the release (cache-busting guard)", html.includes("style.css?v=" + pkg.version));
check("PWA shortcut points at #student",
  Array.isArray(manifest.shortcuts) && manifest.shortcuts.some((s) => /#student$/.test(s.url || "")));
check("an update-log entry announces the feature",
  js.includes("Student tools — GPA, timetable and study timer") && js.includes("أدوات الطالب — المعدل والجدول والمؤقّت"));

console.log("\n— hidden keys & store namespace —");
check("no student key accidentally re-declares an existing one",
  (function () {
    const names = STUDENT_KEYS.filter((k) => (arSrc.match(new RegExp('"' + k.replace(/\./g, "\\.") + '":', "g")) || []).length > 1);
    return names.length === 0;
  })());

/* ============================================================
   Functional harness — a tiny DOM stub good enough for the three
   modules (createElement/appendChild/textContent/setAttribute), plus a
   Store stub and a controllable clock. Nothing here touches a browser.
   ============================================================ */
function makeEl(tag) {
  const node = {
    tagName: String(tag || "div").toUpperCase(),
    id: "",
    className: "",
    textContent: "",
    value: "",
    checked: false,
    hidden: false,
    disabled: false,
    href: "",
    rel: "",
    type: "",
    min: "",
    max: "",
    step: "",
    style: {},
    children: [],
    attrs: {},
    _listeners: {},
    parent: null,
    appendChild(c) { this.children.push(c); if (c) c.parent = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    dispatch(t, ev) { (this._listeners[t] || []).forEach((fn) => fn(ev)); },
    focus() {},
    select() {},
    click() {},
    closest(sel) {
      let cur = this;
      while (cur) {
        const m = /^\[([a-z-]+)\]$/.exec(sel);
        if (m && cur.getAttribute && cur.getAttribute(m[1]) !== null) return cur;
        if (sel.charAt(0) === "#" && cur.id === sel.slice(1)) return cur;
        cur = cur.parent;
      }
      return null;
    }
  };
  Object.defineProperty(node, "firstChild", { get() { return this.children[0] || null; } });
  Object.defineProperty(node, "lastChild", { get() { return this.children[this.children.length - 1] || null; } });
  return node;
}
/** Every textContent in a subtree, joined (for assertions). */
function deepText(node) {
  if (!node) return "";
  let out = String(node.textContent || "");
  (node.children || []).forEach((c) => { out += " " + deepText(c); });
  return out;
}
function makeStore(data) {
  return {
    get(k, fb) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : fb; },
    set(k, v) { data[k] = v; },
    remove(k) { delete data[k]; }
  };
}
function makeLang() {
  return {
    current: "ar",
    t(k, p) {
      let s = "⟦" + k + "⟧";
      if (p) Object.keys(p).forEach((x) => { s = s.split("{" + x + "}").join(String(p[x])); });
      return s;
    },
    onSwitch() {}
  };
}
const PLAN_SUBJECTS = [
  {
    code: "260210030702", name: { ar: "الخوارزميات", en: "Algorithms" }, estimatedHours: 18,
    meta: { creditHours: 3, schedule: { day: { ar: "الأحد", en: "Sunday" }, startTime: "09:00 AM", endTime: "12:00 PM" } }
  },
  {
    code: "260210030802", name: { ar: "مفاهيم نظم التشغيل", en: "Operating Systems Concepts" }, estimatedHours: 14,
    meta: { creditHours: 3, schedule: { day: { ar: "الإثنين", en: "Monday" }, startTime: "12:00 PM", endTime: "03:00 PM" } }
  },
  { code: "260210030902", name: { ar: "بدون موعد" , en: "No slot" }, estimatedHours: 10, meta: { creditHours: 2 } }
];
/** Boot one module source in a sandbox and hand back { win, doc, mounts, data }. */
function boot(src, opts) {
  const o = opts || {};
  const data = o.data || {};
  const mounts = { gpaApp: makeEl("div"), icsApp: makeEl("div"), timerApp: makeEl("div") };
  const doc = {
    hidden: false,
    body: makeEl("body"),
    _listeners: {},
    createElement: makeEl,
    getElementById(id) { return mounts[id] || null; },
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    dispatch(t, ev) { (this._listeners[t] || []).forEach((fn) => fn(ev)); },
    execCommand() { return true; },
    querySelector() { return null; }
  };
  const win = {};
  const intervals = [];
  const store = makeStore(data);
  const plan = { subjects: o.subjects === null ? [] : (o.subjects || PLAN_SUBJECTS) };
  win.PLATFORM_STORE = store;
  win.PLATFORM_CURRENT_SEMESTER = plan;
  const sandbox = {
    console,
    document: doc,
    Lang: o.lang || makeLang(),
    PLATFORM_STORE: store,
    PLATFORM_CURRENT_SEMESTER: plan,
    Blob: function () { },
    URL: { createObjectURL() { return "blob:x"; }, revokeObjectURL() { } },
    navigator: { clipboard: null },
    Sfx: { play() { } },
    Date: o.Date || Date,
    setInterval(fn, ms) { intervals.push({ fn: fn, ms: ms }); return intervals.length; },
    clearInterval() { },
    setTimeout() { return 0; },
    CustomEvent: function () { },
    requestAnimationFrame(fn) { fn(); }
  };
  sandbox.window = win;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "student-module.js" });
  return { win: win, doc: doc, mounts: mounts, data: data, intervals: intervals, sandbox: sandbox };
}

console.log("\n— functional: GPA math (#gpaApp) —");
(function gpaFunctional() {
  /* A stored state with one corrupt scale, one string grade, bad prior, bad target. */
  const boot1 = boot(gpaSrc, {
    data: {
      gpa: { v: 1, scale: "9.99", p: { "260210030702": "4.5", "bogus": "x" }, prior: { credits: "nope", gpa: null }, target: -3 }
    }
  });
  const api = boot1.win.PlatformGpa;
  check("MODULE 68 boots and exposes its API", !!api && typeof api.compute === "function");
  if (!api) return;

  check("subject rows come from the official plan (code · name · credits)",
    api.subjectRows().length === 3 && api.subjectRows()[0].code === "260210030702" && api.subjectRows()[0].credits === 3);
  check("corrupt stored scale falls back to the default preset", api.state().scale === "5.00");
  check("only numeric grades survive a corrupt payload",
    api.state().p["260210030702"] === 4.5 && !("bogus" in api.state().p));
  check("a non-numeric prior and a negative target are dropped", api.state().prior.credits === null && api.state().target === null);

  const entries = [{ credits: 3, points: 4.5 }, { credits: 3, points: 3.5 }, { credits: 2, points: null }];
  const c = api.compute(entries, null);
  check("term GPA is credit-weighted (6 credits → 4.00)", c.credits === 6 && Math.abs(c.term - 4) < 1e-9);
  check("ungraded credits are reported as pending, never as a zero", c.pending === 2);
  const cPrior = api.compute(entries, { credits: 30, gpa: 4.25 });
  check("prior record folds into the cumulative GPA",
    Math.abs(cPrior.cumulative - (24 + 30 * 4.25) / 36) < 1e-9 && Math.abs(cPrior.term - 4) < 1e-9);
  check("empty input computes no GPA at all", api.compute([], null).term === null);

  const need = api.requiredAverage(entries, null, 4, 5);
  check("«what do I need» solves the weighted equation (4.00 needed)",
    need.reason === "ok" && Math.abs(need.need - 4) < 1e-9);
  check("an unreachable target is reported honestly",
    api.requiredAverage(entries, null, 4.9, 5).reason === "impossible");
  check("an already-safe target is reported as guaranteed",
    api.requiredAverage(entries, null, 2, 5).reason === "guaranteed");
  check("no pending credits → the solver says so instead of guessing",
    api.requiredAverage([{ credits: 3, points: 4 }], null, 4.5, 5).reason === "filled");

  const text = deepText(boot1.mounts.gpaApp);
  check("the card rendered the plan subjects and the scale presets",
    text.includes("الخوارزميات") && text.includes("⟦gpa.scale500⟧") && text.includes("⟦gpa.termGpa⟧"));
  check("empty plan renders the honest data-missing state",
    deepText(boot(gpaSrc, { subjects: null }).mounts.gpaApp).includes("⟦student.missingData⟧"));
})();

console.log("\n— functional: timetable → .ics (#icsApp) —");
(function icsFunctional() {
  const b = boot(icsSrc);
  const api = b.win.PlatformIcs;
  check("MODULE 69 boots and exposes its API", !!api && typeof api.build === "function");
  if (!api) return;

  check("times parse in 12h and 24h form",
    api.parseTime("09:00 AM").h === 9 && api.parseTime("12:00 PM").h === 12 &&
    api.parseTime("12:30 AM").h === 0 && api.parseTime("12:30 AM").m === 30 &&
    api.parseTime("3:00 pm").h === 15 && api.parseTime("13:00").h === 13);
  check("invalid times are refused (never guessed)",
    api.parseTime("9:99") === null && api.parseTime("الظهر") === null && api.parseTime("") === null);
  check("weekday vocabulary resolves both languages",
    api.dayCode({ ar: "الأحد", en: "Sunday" }) === "SU" && api.dayCode("thursday") === "TH" && api.dayCode("اليوم") === "");

  const rows = api.rows();
  check("rows derive from the plan and skip subjects without a slot", rows.length === 2 && rows[0].dayCode === "SU");
  check("day label reuses the plan text (no duplication)", rows[0].day === "الأحد");

  const ics = api.build(rows, { startDate: "2026-09-06", weeks: 16, stamp: new Date(Date.UTC(2026, 8, 1, 8, 0, 0)), description: "test" });
  check("calendar skeleton is RFC 5545 shaped",
    ics.includes("BEGIN:VCALENDAR") && ics.includes("VERSION:2.0") &&
    ics.includes("PRODID:-//MNCH//Information Security Platform//AR") && ics.includes("END:VCALENDAR"));
  check("CRLF line endings only", ics.indexOf("\n") >= 0 && !/\n/.test(ics.replace(/\r\n/g, "")));
  check("one VEVENT per scheduled subject",
    (ics.match(/BEGIN:VEVENT/g) || []).length === 2 && (ics.match(/END:VEVENT/g) || []).length === 2);
  check("the Sunday lecture starts on the first Sunday on/after the chosen date",
    ics.includes("DTSTART:20260906T090000") && ics.includes("DTEND:20260906T120000"));
  check("the Monday lecture lands on its own weekday (12:00 PM → 12:00)",
    ics.includes("DTSTART:20260907T120000") && ics.includes("DTEND:20260907T150000"));
  check("times are floating local time (no Z, no TZID)",
    /DTSTART:\d{8}T\d{6}\r\n/.test(ics) && !/DTSTART:.*Z/.test(ics) && !ics.includes("TZID"));
  check("repetition equals the chosen number of weeks", ics.includes("RRULE:FREQ=WEEKLY;COUNT=16"));
  check("DTSTAMP is a real UTC instant", /DTSTAMP:20260901T080000Z/.test(ics));
  check("UIDs are unique per subject", (function () {
    const uids = (ics.match(/UID:([^\r\n]+)/g) || []);
    return uids.length === 2 && uids[0] !== uids[1] && uids.every((u) => u.indexOf("26021003") > 0);
  })());
  check("no meeting link or URL is ever emitted", !/http|URL:/i.test(ics));
  check("long Arabic lines fold at 75 octets with space continuations", (function () {
    const lines = api.fold("DESCRIPTION:" + "ا".repeat(80)).split("\r\n");
    return lines.length > 1 && lines.every((l) => Buffer.byteLength(l, "utf8") <= 75) &&
      lines.slice(1).every((l) => l.charAt(0) === " ");
  })());
  check("week count is clamped to a sane range",
    /COUNT=30/.test(api.build(rows, { startDate: "2026-09-06", weeks: 99 })) &&
    /COUNT=1\r\n/.test(api.build(rows, { startDate: "2026-09-06", weeks: 0 })) &&
    /COUNT=16/.test(api.build(rows, { startDate: "2026-09-06", weeks: "abc" })));
  check("special characters are escaped in TEXT values",
    api.escape("a, b; c\\d\ne") === "a\\, b\\; c\\\\d\\ne");
  check("default start date is the coming Sunday", api.defaultStartDate().getDay() === 0);
  check("calendar file name is stable", api.fileName() === "mnch-timetable.ics");

  const text = deepText(b.mounts.icsApp);
  check("the card rendered the timetable and its actions",
    text.includes("⟦ics.colDay⟧") && text.includes("الخوارزميات") && text.includes("⟦ics.exportBtn⟧"));
  check("no weekly slots → honest empty state", deepText(boot(icsSrc, { subjects: null }).mounts.icsApp).includes("⟦ics.noSchedule⟧"));
})();

console.log("\n— functional: study timer (#timerApp) —");
(function timerFunctional() {
  /* Controllable clock: the module reads Date.now() and `new Date()`. */
  let NOW = Date.UTC(2026, 8, 29, 10, 0, 0);
  class FakeDate extends Date {
    constructor(...args) { if (args.length === 0) super(NOW); else super(...args); }
    static now() { return NOW; }
  }
  const CODE = "260210030702";
  const b = boot(timerSrc, {
    Date: FakeDate,
    data: { "study-time": { v: 1, prefs: { code: CODE, focus: 25, break: 5, sound: false } } }
  });
  const api = b.win.PlatformStudyTimer;
  const doc = b.doc;
  check("MODULE 70 boots and exposes its API", !!api && typeof api.start === "function");
  if (!api) return;

  check("clock formatting is mm:ss (and h:mm:ss past an hour)",
    api.mmss(1500) === "25:00" && api.mmss(59) === "00:59" && api.mmss(3661) === "1:01:01" && api.mmss(-5) === "00:00");
  check("remaining seconds are computed from the end timestamp",
    api.computeRemaining(NOW + 60000, NOW) === 60 && api.computeRemaining(NOW - 1, NOW) === 0);

  check("stored preferences are honoured at boot",
    api.state().prefs.focus === 25 && api.state().prefs.code === CODE && api.state().totals[CODE] === undefined);
  check("the clock starts at the configured focus length", api.state().remaining === 1500 && api.state().status === "idle");

  api.start();
  check("start switches to running and schedules a 1s tick",
    api.state().status === "running" && b.intervals.length === 1 && b.intervals[0].ms === 1000);
  NOW += 5 * 60000;
  api.tick();
  check("ticking recomputes the remaining time (20:00 left)", api.state().remaining === 1200);

  api.pause(false);
  check("manual pause keeps the remaining time", api.state().status === "paused" && api.state().remaining === 1200);

  api.start();
  check("resume continues from the paused instant", api.state().status === "running" && api.state().remaining === 1200);
  doc.hidden = true;
  doc.dispatch("visibilitychange");
  check("hiding the tab auto-pauses (time away is never counted)", api.state().status === "paused");

  api.start();
  doc.dispatch("nova:view-changed", { detail: { viewId: "quiz" } });
  check("leaving the section auto-pauses too", api.state().status === "paused");
  api.start();
  doc.dispatch("nova:view-changed", { detail: { viewId: "student" } });
  check("staying in the section does not pause", api.state().status === "running");

  NOW += 25 * 60000;
  api.tick();
  check("a completed focus session is logged and announced",
    api.state().status === "done" && api.state().totals[CODE] === 25 && api.state().message.includes("⟦timer.sessionSaved⟧"));
  check("the day bucket records the same minutes",
    Object.keys(api.state().days).length === 1 && Object.keys(api.state().days).map((k) => api.state().days[k])[0] === 25);
  check("the session is persisted under motmi-portal:study-time",
    b.data["study-time"] && b.data["study-time"].totals[CODE] === 25 && b.data["study-time"].prefs.focus === 25);
  check("completion auto-arms a short break", api.state().mode === "break" && api.state().remaining === 300);

  api.start();
  NOW += 5 * 60000;
  api.tick();
  check("a finished break returns to focus without logging anything",
    api.state().status === "idle" && api.state().mode === "focus" && api.state().totals[CODE] === 25);

  check("non-positive minutes are refused (nothing is invented)", (function () {
    const log = api.addMinutes({ v: 1, prefs: {}, totals: {}, days: {}, last: {} }, CODE, 0);
    const log2 = api.addMinutes(log, CODE, -30);
    return Object.keys(log.totals).length === 0 && Object.keys(log2.totals).length === 0;
  })());
  check("corrupt stored buckets are dropped on load", (function () {
    const clean = api.sanitizeLog({ v: 1, prefs: { focus: 999, break: -4, sound: "yes" }, totals: { a: "x", b: 12 }, days: null });
    return clean.prefs.focus === 90 && clean.prefs.break === 1 && clean.prefs.sound === false &&
      clean.totals.b === 12 && clean.totals.a === undefined;
  })());

  const text = deepText(b.mounts.timerApp);
  check("the card rendered the subject list and the controls",
    text.includes("الخوارزميات") && text.includes("⟦timer.start⟧") && text.includes("⟦timer.totalAll⟧"));
  check("no subjects → honest empty state", deepText(boot(timerSrc, { subjects: null }).mounts.timerApp).includes("⟦timer.noSubject⟧"));
})();

console.log("\n— dict keys (AR + EN) —");
check("all student keys exist in Arabic", STUDENT_KEYS.every((k) => hasKey(arSrc, k)));
check("all student keys exist in English", STUDENT_KEYS.every((k) => hasKey(enSrc, k)));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);






