"use strict";
/**
 * MODULE 90 · Motion layer — Lenis + GSAP integration tests.
 *
 * Static checks validate index.html / motion.css / motion.js / sw.js /
 * package.json sources (local vendoring, defer order, precache, version
 * agreement, data-lenis-prevent coverage, Arabic RTL safety).
 *
 * Runtime checks execute motion.js in a stubbed browser:
 *   T01  without gsap/Lenis → returns silently, zero side effects;
 *   T02  with stubs → the reduced-motion gate registers, Lenis is
 *        constructed (autoRaf off), gsap.ticker drives lenis.raf,
 *        ScrollTrigger.update is wired to lenis scroll, listeners bind;
 *   T03  cleanup (media flip) undoes class/ticker/lenis/listeners.
 * Run: node tests/motion.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "motion.css"), "utf8");
const js = fs.readFileSync(path.join(root, "motion.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

/* ============================================================
   1 · vendored libraries — local, versioned, present on disk
   ============================================================ */
console.log("\u2014 motion: vendored libs \u2014");
["vendor/gsap.min.js", "vendor/ScrollTrigger.min.js", "vendor/lenis.min.js"].forEach((f) => {
  check("vendor copy exists: " + f, fs.existsSync(path.join(root, f)));
});
const gsapSrc = fs.readFileSync(path.join(root, "vendor/gsap.min.js"), "utf8");
const stSrc = fs.readFileSync(path.join(root, "vendor/ScrollTrigger.min.js"), "utf8");
const lenisSrc = fs.readFileSync(path.join(root, "vendor/lenis.min.js"), "utf8");
check("gsap vendor is GSAP 3.x (header)", /GSAP 3\.\d+/.test(gsapSrc.slice(0, 400)));
check("ScrollTrigger vendor is the matching release", /ScrollTrigger 3\.\d+/.test(stSrc.slice(0, 600)));
check("lenis vendor exposes globalThis.Lenis", lenisSrc.includes("globalThis.Lenis"));
check("package.json pins gsap + lenis", !!(pkg.dependencies && pkg.dependencies.gsap && pkg.dependencies.lenis));

/* ============================================================
   2 · index.html wiring
   ============================================================ */
console.log("\u2014 motion: index.html wiring \u2014");
check("motion.css loaded after style.css",
  html.indexOf('href="style.css?v=') !== -1 &&
  html.indexOf('href="motion.css"') > html.indexOf('href="style.css?v='));
const iGsap = html.indexOf('src="vendor/gsap.min.js"');
const iST = html.indexOf('src="vendor/ScrollTrigger.min.js"');
const iLenis = html.indexOf('src="vendor/lenis.min.js"');
const iMotion = html.indexOf('src="motion.js"');
check("vendor scripts + motion.js load with defer in order",
  iGsap !== -1 && iST > iGsap && iLenis > iST && iMotion > iLenis &&
  /src="vendor\/gsap\.min\.js" defer/.test(html) && /src="motion\.js" defer/.test(html));
check("motion.js loads after the platform (script.js & assistant.js)",
  iMotion > html.indexOf('src="script.js"') && iMotion > html.indexOf('src="assistant.js"'));
const scriptSrcs = html.match(/<script src="[^"]*"/g) || [];
check("zero external scripts (CSP 'self' intact)",
  scriptSrcs.every((s) => !/src="https?:/.test(s)));
check("CSP script-src stays 'self'-only",
  html.includes("script-src 'self' 'unsafe-inline'"));

const preventAttrs = [
  ["mobile menu drawer", /id="mobileMenu"[^>]*data-lenis-prevent/],
  ["AI assistant chat log", /id="assistantLog"[^>]*data-lenis-prevent/],
  ["search palette results", /id="searchResults"[^>]*data-lenis-prevent/],
  ["PDF material viewer body", /class="mat-viewer-body"[^>]*data-lenis-prevent/],
  ["Canva studio panel", /class="canva-studio-panel"[^>]*data-lenis-prevent/],
];
preventAttrs.forEach(([name, re]) => {
  check("data-lenis-prevent on " + name, re.test(html));
});

/* ============================================================
   3 · release plumbing — precache + version agreement
   ============================================================ */
console.log("\u2014 motion: precache & version \u2014");
["motion.css", "motion.js", "vendor/gsap.min.js", "vendor/ScrollTrigger.min.js", "vendor/lenis.min.js"]
  .forEach((f) => {
    check("sw.js precaches " + f, sw.includes('"./' + f + '"'));
  });
check("CACHE_VERSION matches package.json", sw.includes('CACHE_VERSION = "v' + pkg.version + '"'));
check("style.css?v matches package.json", html.includes("style.css?v=" + pkg.version));

/* ============================================================
   4 · Arabic RTL safety (the CRITICAL rule)
   ============================================================ */
console.log("\u2014 motion: Arabic RTL safety \u2014");
check("word splitter splits on whitespace (never per character)",
  js.includes("split(/(\\s+)/)") && !/split\((["'])\1\)/.test(js));
check("no letter-spacing introduced by motion.js", !/letterSpacing\s*:/.test(js));
check("no letter-spacing property introduced by motion.css", !/letter-spacing\s*:/.test(css));
check("gradient phrase (.grad) animated without transforms",
  js.includes('.classList.contains("grad")') && js.includes("soft"));
check("word units are inline-block (line wrapping intact)",
  /html\.motion-on \.m-word\s*\{[^}]*display:\s*inline-block/.test(css));

/* ============================================================
   5 · integration contracts
   ============================================================ */
console.log("\u2014 motion: integration contracts \u2014");
check("gsap.ticker drives lenis.raf (autoRaf off)",
  js.includes("autoRaf: false") && js.includes("lenis.raf(time * 1000)") &&
  js.includes("gsap.ticker.add(tick)"));
check("ScrollTrigger.update wired to lenis scroll", js.includes('lenis.on("scroll", ScrollTrigger.update)'));
check("reduced-motion gate via gsap.matchMedia",
  js.includes("gsap.matchMedia()") && js.includes("(prefers-reduced-motion: no-preference)"));
check("no-preference gate adds/removes html.motion-on",
  js.includes('classList.add("motion-on")') && js.includes('classList.remove("motion-on")'));
check("Lenis prevent delegates to [data-lenis-prevent] + dynamic drawers",
  js.includes("node.closest(NO_SCROLL_SEL)") && js.includes('"[data-lenis-prevent], .q-explain"'));
check("ViewSwitcher integration via nova:view-changed",
  js.includes('doc.addEventListener("nova:view-changed"') && js.includes("lenis.resize()"));
check("anchor handling is capture-phase and skips ViewSwitcher routes",
  js.includes('doc.addEventListener("click", onAnchorClick, true)') && js.includes("NV.resolveViewId"));
check("tilt/magnetic cards never get a transform tween",
  js.includes('classList.contains("tilt")') && js.includes('el.__motionTilt'));
check("language switches rebuild + replay the hero words",
  js.includes("window.Lang.onSwitch") && js.includes("function rebuildHeroWords") &&
  js.includes("delete el.__motionSplit") && js.includes("if (dead"));
check("cleanup disarms late lang callbacks", js.includes("dead = true;"));
check("cleanup destroys lenis + removes listeners",
  js.includes("lenis.destroy()") && js.includes('rootEl.classList.remove("motion-on")'));
check("card reveals are scroll-triggered batches (once)", js.includes("ScrollTrigger.batch("));

/* ============================================================
   6 · runtime — stub browser execution (T01–T03)
   ============================================================ */
console.log("\u2014 motion: runtime (stub boot) \u2014");

function makeClassList() {
  const s = new Set();
  return {
    _s: s,
    add: (...c) => c.forEach((x) => s.add(x)),
    remove: (...c) => c.forEach((x) => s.delete(x)),
    contains: (c) => s.has(c),
  };
}

function makeDocStub() {
  const listeners = [];
  const removals = [];
  return {
    _listeners: listeners,
    _removals: removals,
    documentElement: { classList: makeClassList() },
    body: { classList: makeClassList() },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ classList: makeClassList(), style: {}, appendChild() {} }),
    createDocumentFragment: () => ({ appendChild() {} }),
    createTextNode: (t) => ({ nodeType: 3, nodeValue: t }),
    addEventListener: (t, fn, capture) => listeners.push({ t, fn, capture: !!capture }),
    removeEventListener: (t, fn, capture) => removals.push({ t, capture: !!capture }),
  };
}

function makeGapStubs() {
  const calls = {
    registerPlugin: [], tickerAdd: [], tickerRemove: [], lagSmoothing: [],
    mmAdd: [], lenisCtor: [], lenisOn: [], lenisDestroy: 0, lenisScrollTo: [],
  };
  let mmCallback = null;
  const gsap = {
    ticker: {
      add: (fn) => calls.tickerAdd.push(fn),
      remove: (fn) => calls.tickerRemove.push(fn),
      lagSmoothing: (v) => calls.lagSmoothing.push(v),
    },
    registerPlugin: (p) => calls.registerPlugin.push(p),
    matchMedia: () => ({ add: (q, fn) => { calls.mmAdd.push(q); mmCallback = fn; } }),
    set: () => {},
    to: () => ({ kill() {} }),
    from: () => ({ kill() {} }),
    fromTo: () => ({ kill() {} }),
    timeline: () => ({ from: () => ({ kill() {} }), to: () => ({ kill() {} }) }),
  };
  function Lenis(options) {
    calls.lenisCtor.push(options);
    this.on = (evt, fn) => calls.lenisOn.push(evt);
    this.raf = () => {};
    this.resize = () => {};
    this.scrollTo = (...a) => calls.lenisScrollTo.push(a);
    this.destroy = () => { calls.lenisDestroy++; };
  }
  const ScrollTrigger = { update() {}, refresh() {}, batch() { return { kill() {} }; } };
  return { calls, gsap, Lenis, ScrollTrigger, getCallback: () => mmCallback };
}

function runMotion(windowStub, docStub) {
  const sandbox = {
    window: windowStub,
    document: docStub,
    navigator: { userAgent: "node" },
    requestAnimationFrame: (fn) => { fn(); return 1; },
    setTimeout: (fn) => 0,
    clearTimeout: () => {},
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(js, sandbox);
  return sandbox;
}

/* T01 — silent no-op without the vendored libs */
(function t01() {
  const docStub = makeDocStub();
  let threw = null;
  try { runMotion({}, docStub); } catch (e) { threw = e; }
  check("T01 no gsap/Lenis → silent return, no listeners",
    !threw && docStub._listeners.length === 0 &&
    !docStub.documentElement.classList.contains("motion-on"));
})();

/* T02 — full stub boot */
(function t02() {
  const docStub = makeDocStub();
  const stubs = makeGapStubs();
  const windowStub = {
    gsap: stubs.gsap,
    ScrollTrigger: stubs.ScrollTrigger,
    Lenis: stubs.Lenis,
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  };
  let threw = null;
  let cleanup = null;
  try {
    runMotion(windowStub, docStub);
    const cb = stubs.getCallback();
    if (cb) cleanup = cb({});
  } catch (e) { threw = e; }

  check("T02 boots without errors", !threw);
  check("registers ScrollTrigger plugin", stubs.calls.registerPlugin.length === 1);
  check("reduced-motion gate registered",
    stubs.calls.mmAdd.length === 1 && stubs.calls.mmAdd[0] === "(prefers-reduced-motion: no-preference)");
  check("html.motion-on set inside the gate", docStub.documentElement.classList.contains("motion-on"));
  check("Lenis constructed with autoRaf:false", (() => {
    const o = stubs.calls.lenisCtor[0];
    return stubs.calls.lenisCtor.length === 1 && o && o.autoRaf === false && typeof o.prevent === "function";
  })());
  check("lenis scroll → ScrollTrigger.update", stubs.calls.lenisOn.includes("scroll"));
  check("gsap.ticker drives lenis.raf + lagSmoothing(0)",
    stubs.calls.tickerAdd.length === 1 && stubs.calls.lagSmoothing[0] === 0);
  check("prevent() honours [data-lenis-prevent] ancestors", (() => {
    const prevent = stubs.calls.lenisCtor[0].prevent;
    const inside = { closest: (sel) => (sel.indexOf("data-lenis-prevent") !== -1 ? {} : null) };
    const outside = { closest: () => null };
    return prevent(inside) === true && prevent(outside) === false && prevent(null) === false;
  })());
  check("listeners: view-changed + capture click + pointermove gated",
    docStub._listeners.some((l) => l.t === "nova:view-changed") &&
    docStub._listeners.some((l) => l.t === "click" && l.capture === true) &&
    !docStub._listeners.some((l) => l.t === "pointermove"));

  /* T03 — cleanup on media flip */
  let cThrew = null;
  try { if (cleanup) cleanup(); } catch (e) { cThrew = e; }
  check("T03 cleanup runs without errors", !cThrew && typeof cleanup === "function");
  check("cleanup removes motion-on + destroys lenis + stops ticker",
    !docStub.documentElement.classList.contains("motion-on") &&
    stubs.calls.lenisDestroy === 1 && stubs.calls.tickerRemove.length === 1);
  check("cleanup removes document listeners",
    docStub._removals.some((l) => l.t === "nova:view-changed") &&
    docStub._removals.some((l) => l.t === "click" && l.capture === true));
})();

/* ---------- result ---------- */
console.log("");
if (failures) {
  console.error("\u2717 " + failures + " check(s) failed");
  process.exit(1);
}
console.log("\u2713 all checks passed");
