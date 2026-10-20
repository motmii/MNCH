"use strict";
/**
 * MODULE 74 · AnnouncementsBar + the MODULE 55 quiz chip.
 *
 * Static checks validate announcements.js / index.html / style.css /
 * sw.js / script.js sources; the runtime part EXECUTES MODULE 74 in a
 * vm with a stubbed DOM (same approach as whats-new.test.js) and proves:
 *   1. the banner renders a real, current reminder and hides when none,
 *   2. timing() classifies live / today / soon / past from the clock,
 *   3. buildIcs() is RFC 5545-shaped with a one-off VEVENT,
 *   4. MODULE 55.findUrgentQuiz surfaces the near/live/today quiz.
 * Run: node tests/announcements.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const ann = require(path.join(root, "announcements.js"));
const cs = require(path.join(root, "current-semester.js"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

console.log("- announcements.js: single source of truth -");
check("exposes items array", Array.isArray(ann.items));
check("no active reminders shipped (short-quiz alert removed on request)", ann.items.length === 0);
check("has a numeric leadDays", typeof ann.leadDays === "number" && ann.leadDays >= 0);
/* The banner engine stays covered via a fixture copy of the retired quiz
   item — the same facts the real registry carried before the removal. */
const FIXTURE_ITEM = {
  id: "quiz-os-2026-10-18",
  kind: "quiz",
  subjectKey: "260210030802",
  title: {
    ar: "الاختبار القصير الأول — مفاهيم نظم التشغيل",
    en: "First Short Quiz — Operating Systems Concepts"
  },
  date: "2026-10-18",
  startTime: "2:40 PM",
  endTime: "3:00 PM",
  durationMin: 20,
  questions: 5,
  weight: { ar: "5% من الدرجة النهائية", en: "5% of the final grade" },
  link: "#quiz"
};
const FIXTURE = Object.assign({}, ann, { items: [FIXTURE_ITEM] });
check("fixture item is bilingual", !!FIXTURE_ITEM.title.ar && !!FIXTURE_ITEM.title.en);
check("fixture item has an ISO date", /^\d{4}-\d{2}-\d{2}$/.test(FIXTURE_ITEM.date));
const realCodes = new Set(cs.subjects.map((s) => String(s.code || s.id)));
check("fixture subjectKey exists in the official plan", realCodes.has(String(FIXTURE_ITEM.subjectKey)));
check("fixture quiz carries honest facts (duration/questions/weight)",
  !!(FIXTURE_ITEM.durationMin && FIXTURE_ITEM.questions && FIXTURE_ITEM.weight && FIXTURE_ITEM.weight.ar));
check("fixture link points at an existing view (#quiz)", FIXTURE_ITEM.link.charAt(0) === "#");

console.log("- index.html: mount + load order -");
check("mounts #announceBar", html.includes('id="announceBar"'));
check("banner starts hidden", /id="announceBar"[^>]*hidden/.test(html));
check("banner is OUTSIDE #hero (before the hero header)",
  html.indexOf('id="announceBar"') < html.indexOf('id="hero"'));
check("hero quiz chip mount present", html.includes('id="heroNowQuiz"') && html.includes('class="hero-now-quiz"'));
check("quiz chip starts hidden", /id="heroNowQuiz"[^>]*hidden/.test(html));
check("announcements.js loaded before script.js",
  html.indexOf('src="announcements.js"') > -1 &&
  html.indexOf('src="announcements.js"') < html.indexOf('src="script.js"'));

console.log("- i18n: ar + en dictionaries -");
const dictStart = js.indexOf("const DICT");
const arStart = js.indexOf("ar: {", dictStart);
const enStart = js.indexOf("en: {", arStart);
const arSrc = js.slice(arStart, enStart);
const enSrc = js.slice(enStart);
const KEYS = ["announce.title", "announce.chipLive", "announce.chipToday", "announce.chipInDays",
  "announce.duration", "announce.ics", "announce.review", "announce.dismiss",
  "announce.icsQuestions", "announce.heroQuiz", "announce.heroQuizStarts"];
KEYS.forEach((k) => {
  check('dict key "' + k + '" in ar + en',
    arSrc.includes('"' + k + '"') && enSrc.includes('"' + k + '"'));
});

console.log("- script.js: MODULE 74 -");
const modStart = js.indexOf("(function initAnnouncementsBar()");
const modEnd = js.indexOf("/* @@ANNOUNCE_END@@ */", modStart);
const mod = modStart >= 0 && modEnd > modStart ? js.slice(modStart, modEnd) : "";
check("MODULE 74 marker + entry point", js.includes("MODULE 74 · AnnouncementsBar") && modStart > -1);
check("reads the single source of truth", mod.includes("window.PLATFORM_ANNOUNCEMENTS"));
check("day-granular timing, no per-second timers", mod.includes("function timing") && !/setInterval/.test(mod));
check("no notifications / push APIs", !/Notification|PushManager|requestPermission|serviceWorker\.ready/.test(mod));
check("no network calls", !/fetch\s*\(|XMLHttpRequest/.test(mod));
check("no innerHTML (createElement/textContent only)", !mod.includes("innerHTML"));
check("local-only dismiss store key", mod.includes("announcements-dismissed"));
check("ICS is floating local time (no invented TZID)", /localStamp/.test(mod) && !/TZID=/.test(mod));
check("ICS is one-off (no RRULE)", !/RRULE/.test(mod));
check("exposes window.PlatformAnnouncements", mod.includes("window.PlatformAnnouncements"));
check("MODULE 55 exposes findUrgentQuiz", js.includes("findUrgentQuiz: findUrgentQuiz"));

console.log("- style.css: MODULE 74 layer -");
const cssAt = css.indexOf("MODULE 74 · AnnouncementsBar");
const layer = cssAt > -1 ? css.slice(cssAt) : "";
[".announce-bar", ".announce-row", ".announce-chip", ".announce-title",
  ".announce-actions", ".announce-btn", ".announce-dismiss", ".hero-now-quiz"].forEach((sel) => {
  check("style for " + sel, layer.includes(sel));
});
check("hidden state respected", layer.includes(".announce-bar[hidden]"));
check("live/today states styled", layer.includes(".announce-chip--live") && layer.includes('.announce-bar[data-status="live"]'));
check("reduced-motion guard", layer.includes("prefers-reduced-motion: reduce"));
check("mobile rule", /@media \(max-width: 560px\)[\s\S]*\.announce-bar/.test(layer));
check("layer closed with END marker", layer.includes("END MODULE 74"));

console.log("- service worker: cache + precache -");
const verMatch = sw.match(/CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/);
check("cache version >= v1.31.0 (announcements bump)",
  !!verMatch && ((+verMatch[1] > 1) || (+verMatch[1] === 1 && (+verMatch[2] > 31 || (+verMatch[2] === 31 && +verMatch[3] >= 0)))));
check("sw.js precaches announcements.js", sw.includes('"./announcements.js"'));


/* ============================================================
   runtime: boot MODULE 74 in a vm with a stub DOM
   ============================================================ */
console.log("\n- runtime: stubbed browser -");

function makeNode(id) {
  return {
    id: id, hidden: false, attrs: {}, listeners: {}, children: [],
    _text: "", className: "", type: "", href: "", dataset: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
    closest() { return null; },
    focus() {},
    get firstChild() { return this.children[0] || null; }
  };
}

function boot(registry) {
  const bar = makeNode("announceBar");
  bar.hidden = true;
  const byId = { announceBar: bar };
  const documentStub = {
    getElementById(id) { return byId[id] || null; },
    createElement(tag) { const n = makeNode(""); n.tagName = String(tag).toUpperCase(); return n; },
    addEventListener() {},
    body: { appendChild() {}, removeChild() {} }
  };
  const LangStub = {
    current: "ar",
    t(key, params) {
      const table = {
        "announce.chipLive": "الآن", "announce.chipToday": "اليوم",
        "announce.chipInDays": "بعد {n} أيام", "announce.duration": "{n} دقيقة",
        "announce.ics": "أضف للتقويم", "announce.review": "راجع المادة",
        "announce.dismiss": "إخفاء التنبيه", "announce.icsQuestions": "عدد الأسئلة: {n}",
        "announce.title": "تنبيهات المواد"
      };
      let s = table[key];
      if (s == null) return key;
      if (params) Object.keys(params).forEach((k) => { s = s.replace("{" + k + "}", String(params[k])); });
      return s;
    },
    onSwitch() {}
  };
  const localStorageStub = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const sandbox = {
    console, document: documentStub, localStorage: localStorageStub, Lang: LangStub,
    PLATFORM_CURRENT_SEMESTER: cs, PLATFORM_STORE: null, PLATFORM_ANNOUNCEMENTS: registry || ann,
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat, Intl,
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(mod, sandbox, { filename: "announcements.js" });
  return { sandbox, bar };
}

/* --- timing classification (pure) --- */
{
  const api = boot().sandbox.window.PlatformAnnouncements;
  const item = FIXTURE_ITEM;
  check("timing: same day inside window → live",
    api.timing(item, new Date(2026, 9, 18, 14, 45)).status === "live");
  check("timing: same day before start → today",
    api.timing(item, new Date(2026, 9, 18, 9, 0)).status === "today");
  check("timing: 3 days ahead → soon",
    api.timing(item, new Date(2026, 9, 15, 12, 0)).status === "soon" &&
    api.timing(item, new Date(2026, 9, 15, 12, 0)).daysAway === 3);
  check("timing: beyond leadDays → past",
    api.timing(item, new Date(2026, 9, 1, 12, 0)).status === "past");
  check("timing: after the day → past",
    api.timing(item, new Date(2026, 9, 19, 9, 0)).status === "past");
  check("timing: bad date → null", api.timing({ date: "not-a-date" }, new Date()) === null);
  check("parseTimeMinutes AM/PM",
    api.parseTimeMinutes("2:40 PM") === 880 && api.parseTimeMinutes("12:00 PM") === 720);
}

/* --- ICS output --- */
{
  const api = boot().sandbox.window.PlatformAnnouncements;
  const ics = api.buildIcs(FIXTURE_ITEM, new Date(2026, 0, 1, 0, 0, 0));
  check("buildIcs: RFC 5545 skeleton",
    ics.includes("BEGIN:VCALENDAR") && ics.includes("BEGIN:VEVENT") && ics.includes("END:VEVENT") && ics.includes("END:VCALENDAR"));
  check("buildIcs: has DTSTART/DTEND/SUMMARY/UID/DTSTAMP",
    /DTSTART:\d{8}T\d{6}/.test(ics) && /DTEND:\d{8}T\d{6}/.test(ics) &&
    ics.includes("SUMMARY:") && ics.includes("UID:") && ics.includes("DTSTAMP:"));
  check("buildIcs: CRLF line endings", ics.indexOf("\r\n") > -1);
  check("buildIcs: no meeting link / no network", !/https?:\/\//.test(ics));
  check("chipFor live", (api.chipFor({ status: "live" }) || "").length > 0);
  check("chipFor soon substitutes {n}", api.chipFor({ status: "soon", daysAway: 4 }).indexOf("4") > -1);
}


/* --- the banner never fabricates a reminder for an elapsed/far exam --- */
{
  const app = boot(FIXTURE);
  const api = app.sandbox.window.PlatformAnnouncements;
  const original = FIXTURE_ITEM.date;
  FIXTURE_ITEM.date = "2099-01-10";       /* far future → past → hidden */
  api.render();
  check("far-future reminder hides the banner", app.bar.hidden === true);
  FIXTURE_ITEM.date = "2001-01-01";       /* genuinely elapsed exam */
  api.render();
  check("elapsed exam date does not resurrect the banner", app.bar.hidden === true);
  FIXTURE_ITEM.date = original;
  api.render();
  /* Clock-relative: the fixture quiz is 2026-10-18 — on/before that day the
     banner must show; once it has passed it must stay hidden. */
  const today = new Date();
  const daysAway = Math.round((new Date(2026, 9, 18) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  if (daysAway >= 0 && daysAway <= ann.leadDays) {
    check("a near/future quiz surfaces the banner (not hidden)",
      app.bar.hidden === false && app.bar.getAttribute("data-status") !== null);
  } else {
    check("an out-of-window fixture quiz keeps the banner hidden", app.bar.hidden === true);
  }
}

/* --- the shipped (empty) registry keeps the banner hidden --- */
{
  const app = boot();
  const api = app.sandbox.window.PlatformAnnouncements;
  api.render();
  check("empty registry keeps the banner hidden", app.bar.hidden === true);
}

/* --- MODULE 55.findUrgentQuiz surfaces a near/live quiz --- */
{
  const heroModStart = js.indexOf("(function initHeroNow()");
  const heroMod = heroModStart >= 0 ? js.slice(heroModStart) : "";
  check("MODULE 55 source sliced", heroModStart > -1);
  const fnStart = heroMod.indexOf("function findUrgentQuiz");
  const fnEnd = heroMod.indexOf("function render()", fnStart);
  const fnSrc = heroMod.slice(fnStart, fnEnd > -1 ? fnEnd : undefined);
  function makeFind(registry) {
    const sandbox = {
      window: { PLATFORM_ANNOUNCEMENTS: registry, PLATFORM_CURRENT_SEMESTER: cs },
      Date, Math, isNaN, String, Number, Array, Object,
      parseTimeMinutes(str) {
        const m = String(str).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!m) return null;
        let h = parseInt(m[1], 10); const min = parseInt(m[2], 10);
        const ap = m[3] ? m[3].toUpperCase() : null;
        if (ap === "PM" && h < 12) h += 12;
        if (ap === "AM" && h === 12) h = 0;
        return h * 60 + min;
      }
    };
    vm.createContext(sandbox);
    vm.runInContext("findUrgentQuiz = " + fnSrc.trim(), sandbox, { filename: "findUrgentQuiz.js" });
    return sandbox.findUrgentQuiz;
  }
  let test = null;
  try { test = makeFind(FIXTURE); } catch (e) { /* fall through */ }
  check("findUrgentQuiz extracted", typeof test === "function");
  if (typeof test === "function") {
    const live = test(new Date(2026, 9, 18, 14, 45));
    check("findUrgentQuiz: live on exam day inside window", !!live && live.status === "live");
    const soon = test(new Date(2026, 9, 15, 9, 0));
    check("findUrgentQuiz: soon within lead window", !!soon && soon.status === "soon" && soon.daysAway === 3);
    check("findUrgentQuiz: null when far away", test(new Date(2026, 8, 1, 9, 0)) === null);
    check("findUrgentQuiz: null after the exam", test(new Date(2026, 9, 25, 9, 0)) === null);
  }
  check("findUrgentQuiz: shipped empty registry → always null", (() => {
    try { return makeFind(ann)(new Date(2026, 9, 18, 14, 45)) === null; } catch (e) { return false; }
  })());
}

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);

