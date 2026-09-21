"use strict";
/**
 * Full-boot regression test — "blank Current Semester page".
 * Runs the ENTIRE script.js (all modules, in order) inside a stubbed
 * browser environment, then asserts that the semester dashboard module
 * actually executed and populated #semesterMeta + #semesterGrid.
 * This catches the real-world failure mode where an earlier module
 * throws and silently aborts the rest of the shared IIFE.
 * Run: node tests/full-boot.test.js
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

function makeEl(id) {
  const el = {
    id, _html: "", style: {}, dataset: {}, listeners: {}, children: [],
    classList: {
      _s: new Set(),
      add(...c){ c.forEach((x)=>this._s.add(x)); },
      remove(...c){ c.forEach((x)=>this._s.delete(x)); },
      toggle(c, f){ if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); return this._s.has(c); },
      contains(c){ return this._s.has(c); },
    },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener(t, fn){ (el.listeners[t] = el.listeners[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c){ el.children.push(c); return c; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    closest(){ return null; },
    scrollIntoView(){}, focus(){}, blur(){}, click(){},
    remove(){ el._removed = true; },
  };
  Object.defineProperty(el, "innerHTML", { get(){ return el._html; }, set(v){ el._html = String(v); } });
  Object.defineProperty(el, "textContent", { get(){ return el._text || ""; }, set(v){ el._text = String(v); } });
  return el;
}

const ids = [
  "preloader","nav","navBurger","mobileMenu","langToggle","themeToggle","toTop",
  "quizApp","flashGrid","flashSearch","flashShuffle","flashEmpty","subjectSearch","resultsCount","emptyState","subjectsGrid",
  "progressApp","heroContinue","heroContinueMeta","heroContinueBtn",
  "pathsGrid","pathDetailBody","lessonBody","lessonView",
  "semesterGrid","semesterMeta",
  /* ViewSwitcher sections (VIEWS registry) */
  "hero","semester","paths","path","subjects","tools","labs","flash","quiz",
  "progress","games","redteam","ir","cryptolab","about","contact","lesson",
  "heroDash","heroDashPct","heroDashBar","heroDashLesson","heroDashQuiz","heroDashContinue",
  "searchOpenBtn","searchOverlay","searchDialog","searchInput","searchResults","searchClose",
  "onboardingOverlay","onboardingBack","onboardingSkip","onboardingNext","onboardingStart",
  "salawatBanner","salawatBannerClose","assistantRoot","assistantPanel","assistantFab",
];
const byId = {};
ids.forEach((id) => { byId[id] = makeEl(id); });

const TOOL_IDS = ["tool-hash","tool-caesar","tool-jwt","tool-cidr","tool-password","tool-encoders","tool-playground","tool-vuln","tool-portscan","tool-sniffer","tool-fw","tool-b64"];
TOOL_IDS.forEach((id) => {
  byId[id] = Object.assign(makeEl(id), {
    querySelector(sel){ return sel === ".tool-title" ? { textContent: { trim: () => id } } : null; },
  });
});
const docListeners = {};
const mainEl = makeEl("main");
const documentStub = {
  getElementById(id){ return byId[id] || null; },
  querySelector(sel){ return sel === "main" ? mainEl : null; },
  querySelectorAll(){ return []; },
  addEventListener(t, fn){ (docListeners[t] = docListeners[t] || []).push(fn); },
  removeEventListener(){},
  dispatchEvent(ev){ (docListeners[ev && ev.type] || []).forEach((fn) => { try { fn(ev); } catch (e) { void e; } }); return true; },
  createElement(){ return makeEl(""); },
  documentElement: { setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){}, style: { setProperty(){} }, lang: "ar", dir: "rtl" },
  body: makeEl("body"),
  title: "",
  readyState: "complete",
};

const storage = {};
const localStorageStub = {
  getItem(k){ return storage[k] !== undefined ? storage[k] : null; },
  setItem(k, v){ storage[k] = String(v); },
  removeItem(k){ delete storage[k]; },
};

const winListeners = [];
const windowStub = {
  PLATFORM_CURRENT_SEMESTER: cs,
  addEventListener(t, fn){ winListeners.push([t, fn]); },
  removeEventListener(){},
  dispatchEvent(){ return true; },
  matchMedia(){ return { matches: false, addEventListener(){}, addListener(){} }; },
  requestAnimationFrame(){ return 0; },
  cancelAnimationFrame(){},
  location: { hash: "", href: "http://localhost/" },
  history: { pushState(){}, replaceState(){} },
  scrollTo(){},
  getComputedStyle(){ return {}; },
  localStorage: localStorageStub,
  navigator: { language: "ar", serviceWorker: undefined },
  CustomEvent: function (type, opts) { return { type, detail: opts && opts.detail }; },
  IntersectionObserver: function () { return { observe(){}, unobserve(){}, disconnect(){} }; },
  MutationObserver: function () { return { observe(){}, disconnect(){} }; },
  Worker: undefined,
  fetch: () => Promise.reject(new Error("offline-stub")),
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

let threw = null;
try {
  vm.runInContext(js, sandbox, { filename: "script.js" });
} catch (e) { threw = e; }
check("full script.js executes without throwing", !threw);
if (threw) console.error("    → " + threw.message);

const metaHtml = byId.semesterMeta.innerHTML;
const gridHtml = byId.semesterGrid.innerHTML;
check("#semesterMeta populated after full boot", metaHtml.trim().length > 0);
check("#semesterGrid populated after full boot", gridHtml.trim().length > 0);
check("5 subject cards present after full boot", (gridHtml.match(/class="work-card sem-card"/g) || []).length === 5);
check("view-switcher registered (#semester resolvable)", typeof sandbox.NovaViews === "object" && sandbox.NovaViews && typeof sandbox.NovaViews.resolveViewId === "function");
if (sandbox.NovaViews) {
  check("resolveViewId('#semester') === 'semester'", sandbox.NovaViews.resolveViewId("#semester") === "semester");
}

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);

