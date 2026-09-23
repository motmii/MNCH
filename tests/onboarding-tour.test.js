"use strict";
/**
 * Onboarding tour test — MODULE 54 · OnboardingTour (first-visit walkthrough).
 * Asserts on the REAL index.html, style.css and script.js:
 *   - the dialog markup (role/aria wiring, Next · Back · Skip, step counter)
 *   - the CSS shell (bottom coach panel, dashed highlight, focus, reduced
 *     motion, mobile) inside the existing visual identity
 *   - both dictionaries carry every tour.* key (AR + EN)
 *   - MODULE 38 hands the first visit over to the tour (never two modals)
 *   - the module itself, executed in a vm sandbox:
 *       first visit → auto-opens once after load · Next/Back move the steps ·
 *       the related element is highlighted · Skip / Escape / the final step
 *       persist { done: true } · a seen visitor never auto-opens again ·
 *       manual replay still works · blocked localStorage, a missing
 *       ViewSwitcher and a deep-link entry all fail gracefully.
 * Run: node tests/onboarding-tour.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const src = fs.readFileSync(path.join(root, "script.js"), "utf8");

let failures = 0;
function check(n, c) {
  if (c) { console.log("  \u2713 " + n); }
  else { failures++; console.error("  \u2717 FAIL: " + n); }
}
const count = (h, n) => h.split(n).length - 1;

/* ---------- the module slices used by the behavioural checks ---------- */
const START = "/* @@TOUR_START@@ */";
const END = "/* @@TOUR_END@@ */";
const iStart = src.indexOf(START);
const iEnd = src.indexOf(END);
if (iStart < 0 || iEnd < iStart) throw new Error("MODULE 54 markers not found");
const tourSrc = src.slice(iStart, iEnd);

const wStart = src.lastIndexOf("\n/* ===", src.indexOf("MODULE 38 · Onboarding"));
const wEnd = src.indexOf("\n/* MODULE 39b", wStart);
if (wStart < 0 || wEnd < 0) throw new Error("MODULE 38 slice not found");
const wizardSrc = src.slice(wStart, wEnd);

/* ---------- DOM double ---------- */

/**
 * Minimal element double (attributes · classList · listeners · focus).
 * @param {string} id Element id.
 * @returns {Object} Element double.
 */
function elStub(id) {
  const el = {
    id, hidden: false, disabled: false, textContent: "", focused: false,
    scrolled: 0, scrollOpts: null, _attrs: {}, _classes: new Set(), _listeners: {}, styleVars: {},
    style: {
      setProperty(k, v) { el.styleVars[k] = String(v); },
      removeProperty(k) { delete el.styleVars[k]; },
    },
    dataset: {},
    classList: {
      add(c) { el._classes.add(c); },
      remove(c) { el._classes.delete(c); },
      contains(c) { return el._classes.has(c); },
      toggle(c, f) {
        if (f === undefined) { if (el._classes.has(c)) el._classes.delete(c); else el._classes.add(c); }
        else if (f) el._classes.add(c); else el._classes.delete(c);
        return el._classes.has(c);
      },
    },
    setAttribute(k, v) { el._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(el._attrs, k) ? el._attrs[k] : null; },
    removeAttribute(k) { delete el._attrs[k]; },
    addEventListener(t, fn) { (el._listeners[t] = el._listeners[t] || []).push(fn); },
    removeEventListener() {},
    closest(sel) { return sel === "#" + el.id ? el : null; },
    focus() { el.focused = true; },
    blur() {},
    scrollIntoView(opts) { el.scrolled += 1; el.scrollOpts = opts || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  return el;
}

/**
 * Boot MODULE 54 in an isolated vm sandbox.
 * @param {Object=} opts Scenario options (storage · blockedStorage · noViews · …).
 * @returns {Object} Harness (elements · listeners · call recorders · helpers).
 */
function bootTour(opts) {
  const o = opts || {};
  const storage = Object.assign({}, o.storage || {});
  const ls = {
    getItem(k) {
      if (o.blockedStorage) throw new Error("storage-blocked");
      return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null;
    },
    setItem(k, v) { if (o.blockedStorage) throw new Error("storage-blocked"); storage[k] = String(v); },
    removeItem(k) { delete storage[k]; },
  };
  const Store = {
    NS: "motmi-portal",
    get(k, fb) {
      try {
        const raw = ls.getItem(Store.NS + ":" + k);
        return raw === null ? (fb === undefined ? null : fb) : JSON.parse(raw);
      } catch (e) { return fb === undefined ? null : fb; }
    },
    set(k, v) { try { ls.setItem(Store.NS + ":" + k, JSON.stringify(v)); } catch (e) { /* blocked */ } },
    remove(k) { try { ls.removeItem(Store.NS + ":" + k); } catch (e) { /* blocked */ } },
  };

  const ids = ["tourOverlay", "tourTitle", "tourStepText", "tourArea", "tourCounter", "tourNext", "tourBack", "tourSkip"];
  const byId = {};
  ids.forEach((id) => { byId[id] = elStub(id); });
  const panelStub = elStub("tourPanelStub");
  const targets = {
    ".hero-brand": Object.assign(elStub("heroBrand"), {
      getBoundingClientRect() { return { top: 120, bottom: 200, left: 300, right: 700, width: 400, height: 80 }; },
    }),
    "#heroDash": Object.assign(elStub("heroDash"), {
      getBoundingClientRect() { return { top: 420, bottom: 520, left: 300, right: 700, width: 400, height: 100 }; },
    }),
  };

  const docListeners = {};
  const winListeners = {};
  const timers = [];
  const rafQueue = [];
  const trapCalls = [];
  const viewCalls = [];
  let currentView = o.startView || "hero";

  let lang = "ar";
  const langListeners = [];
  const Lang = {
    t(key, params) {
      let s = lang + "|" + key;
      if (params) Object.keys(params).forEach((k) => { s += "|" + k + "=" + params[k]; });
      return s;
    },
    onSwitch(fn) { langListeners.push(fn); },
    get current() { return lang; },
    switchTo(next) { lang = next; langListeners.forEach((fn) => { fn(lang); }); },
  };

  const views = {
    current() { return currentView; },
    activate(id, activateOpts) {
      currentView = id;
      viewCalls.push({ id: id, replace: !!(activateOpts && activateOpts.replace) });
    },
  };

  const documentStub = {
    getElementById(id) { return byId[id] || null; },
    querySelector(sel) { return Object.prototype.hasOwnProperty.call(targets, sel) ? targets[sel] : null; },
    querySelectorAll() { return []; },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    dispatchEvent(ev) { (docListeners[ev && ev.type] || []).forEach((fn) => fn(ev)); return true; },
    body: { style: {} },
    documentElement: { dir: "rtl" },
    readyState: o.readyState || "loading",
  };
  const windowStub = {
    addEventListener(t, fn) { (winListeners[t] = winListeners[t] || []).push(fn); },
    matchMedia() { return { matches: !!o.reducedMotion, addEventListener() {}, addListener() {} }; },
    localStorage: ls,
    innerWidth: 1280,
    innerHeight: 800,
  };
  if (!o.noViews) windowStub.NovaViews = views;

  const sandbox = {
    console, window: windowStub, document: documentStub, localStorage: ls,
    location: { hash: o.hash || "", href: "https://example.test/" },
    Store, Lang,
    $id: (id) => byId[id] || null,
    $$: () => [],
    createFocusTrap: () => ({
      activate() { trapCalls.push("activate"); },
      deactivate() { trapCalls.push("deactivate"); },
      focusFirst() { trapCalls.push("focusFirst"); return null; },
      isActive() { return false; },
    }),
    anotherOverlayOpen: () => !!o.otherOverlayOpen,
    CustomEvent: function (type, init) { return { type: type, detail: init && init.detail }; },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {},
    requestAnimationFrame(fn) { rafQueue.push(fn); return rafQueue.length; },
  };
  byId.tourOverlay.querySelector = (sel) => (sel === ".tour-panel" ? panelStub : null);
  vm.createContext(sandbox);
  vm.runInContext(tourSrc, sandbox, { filename: "module54.js" });

  return {
    sandbox, storage, byId, targets, panelStub, winListeners, docListeners, timers, rafQueue, trapCalls, viewCalls, Lang,
    api: sandbox.window.NovaTour,
    /** Fire the deferred window "load" listener. @returns {void} */
    fireLoad() { (winListeners.load || []).forEach((fn) => fn()); },
    /** Run every pending setTimeout callback. @returns {void} */
    flush() { while (timers.length) { const fn = timers.shift(); fn(); } },
    /** Run every pending rAF callback (scroll-settle + re-pin). @returns {void} */
    flushRaf() { let g = 0; while (rafQueue.length && g++ < 8) { const fns = rafQueue.splice(0); fns.forEach((fn) => fn()); this.flush(); } },
    /** Run pending timers + frames until the anchor settles. @returns {void} */
    flushTimers() { let g = 0; while ((timers.length || rafQueue.length) && g++ < 12) { this.flush(); this.flushRaf(); } },
    /** Click a tour control by id. @param {string} id @returns {void} */
    click(id) {
      const target = byId[id];
      (byId.tourOverlay._listeners.click || []).forEach((fn) => fn({ target: target, stopPropagation() {} }));
    },
    /** Dispatch a page-level keydown. @param {string} key @returns {void} */
    key(k) { (docListeners.keydown || []).forEach((fn) => fn({ key: k, preventDefault() {} })); },
    /** @returns {boolean} True while the overlay is visible. */
    isVisible() { return byId.tourOverlay.getAttribute("aria-hidden") === "false"; },
    /** Parsed value of a namespaced store key. @param {string} key @returns {Object|null} */
    stored(key) {
      const raw = storage["motmi-portal:" + key];
      return raw === undefined ? null : JSON.parse(raw);
    },
  };
}


/* ============================================================
   index.html — dialog markup
   ============================================================ */
console.log("\u2014 index.html: tour dialog \u2014");
check("mounts #tourOverlay", html.includes('id="tourOverlay"'));
check("reuses the MODULE 38 overlay shell", html.includes('class="onboarding-overlay tour-overlay"'));
check("dialog + modal roles", html.includes('id="tourOverlay"') && html.includes('role="dialog"') && html.includes('aria-modal="true"'));
check("labelled by the step heading", html.includes('aria-labelledby="tourTitle"'));
check("describes counter + step text + area", html.includes('aria-describedby="tourCounter tourStepText tourArea"'));
check("starts hidden", /id="tourOverlay"[\s\S]{0,260}aria-hidden="true"/.test(html));
check("has Next · Skip · Back controls", html.includes('id="tourNext"') && html.includes('id="tourSkip"') && html.includes('id="tourBack"'));
check("has a step counter", html.includes('id="tourCounter"'));
check("heading is focusable for announcements", html.includes('id="tourTitle" tabindex="-1"'));
check("Skip label is localized", html.includes('id="tourSkip"') && html.includes('data-i18n="tour.skip"'));
check("Back label is localized", /id="tourBack"[^>]*data-i18n="tour\.back"/.test(html));
check("Next label is module-owned (Finish on the last step)", /id="tourNext"[^>]*>/.test(html) && !/id="tourNext"[^>]*data-i18n=/.test(html));
check("panel uses the existing .onboarding-panel", html.includes('class="onboarding-panel tour-panel"'));
check("replay control added to the Start-Here strip", html.includes("data-tour-reopen"));
check("MODULE 38 markup untouched (4 wizard steps)", count(html, 'data-os-step="') === 4 && html.includes("data-onboarding-reopen"));
check("no new script/dependency was added", count(html, "<script src=") === 3);

/* ============================================================
   style.css — coach panel + highlight ring
   ============================================================ */
console.log("\n\u2014 style.css: coach panel & highlight \u2014");
[".tour-overlay", ".tour-panel", ".tour-count", ".tour-title", ".tour-text", ".tour-area",
 ".tour-foot", ".tour-hint", ".is-tour-highlight"].forEach((sel) => {
  check("style for " + sel, css.includes(sel));
});
check("highlight is a dashed ring (not colour-only)", /\.is-tour-highlight\s*\{[^}]*outline:\s*3px dashed/.test(css));
check("highlight clears the fixed navbar", /\.is-tour-highlight\s*\{[^}]*scroll-margin-block-start/.test(css));
check("visible focus indicator inside the panel", css.includes(".tour-panel :focus-visible"));
check("panel sits above the navbar/assistant", /\.tour-overlay\s*\{[^}]*z-index:\s*1500/.test(css));
check("RTL-safe action placement", css.includes(".tour-foot #tourNext { margin-inline-start: auto; }"));
check("mobile layout rule", /@media \(max-width:\s*640px\)\s*\{\s*\.tour-overlay/.test(css));
check("reduced-motion guard", /@media \(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.tour-overlay/.test(css));
/* The popover itself is pinned with physical top/left by JS (measured from
   getBoundingClientRect, RTL-aware in code) — the no-physical-offsets rule
   therefore applies to text/action layout only, not to the anchored panel
   and its pointer arrow. */
check("no physical left/right offsets in tour text layout",
  !/\.tour-(?:count|title|text|area|foot|hint)\s*\{[^}]*(?:^|\s)(?:left|right):/.test(css));
check("panel anchored with JS-driven offsets (not a fixed bottom sheet)",
  /\.tour-panel\s*\{[^}]*position:\s*fixed/.test(css) &&
  /\.tour-panel\s*\{[^}]*--tour-top/.test(css) &&
  /\[data-tour-place="(below|above)"\]/.test(css));
check("pointer arrow points at the target", css.includes(".tour-panel::after"));

/* ============================================================
   i18n — every key in both dictionaries
   ============================================================ */
console.log("\n\u2014 i18n (AR + EN) \u2014");
const KEYS = ["tour.next", "tour.finish", "tour.back", "tour.skip", "tour.counter", "tour.areaLabel", "tour.hint", "starthere.tour"];
for (let i = 1; i <= 8; i++) KEYS.push("tour.s" + i + "Title", "tour.s" + i + "Text", "tour.s" + i + "Area");
["ar", "en"].forEach((loc) => {
  const scoped = src.slice(src.indexOf(loc + ": {", src.indexOf("const DICT")));
  KEYS.forEach((key) => {
    const re = new RegExp('"' + key.replace(/\./g, "\\.") + '":');
    check('"' + key + '" in ' + loc, re.test(scoped));
  });
});
check("every html data-i18n key exists in the dictionaries", ["tour.back", "tour.skip", "tour.hint", "starthere.tour"]
  .every((k) => new RegExp('"' + k.replace(/\./g, "\\.") + '":').test(src)));

/* ============================================================
   module wiring
   ============================================================ */
console.log("\n\u2014 module wiring \u2014");
check("MODULE 54 is declared before MODULE 38 (bridge available at boot)",
  src.indexOf("MODULE 54 · OnboardingTour") > 0 &&
  src.indexOf("MODULE 38 · Onboarding — optional first-time learning-path") > src.indexOf("MODULE 54 · OnboardingTour"));
check("module markers present", src.includes(START) && src.includes(END));
check("single namespaced key + Store wrapper only",
  tourSrc.includes('var STORE_KEY = "tour";') && tourSrc.includes("Store.get(") && tourSrc.includes("Store.set(") &&
  !/localStorage\s*\./.test(tourSrc) && !/sessionStorage\s*\./.test(tourSrc));
check("no innerHTML in the tour (textContent only)", tourSrc.indexOf("innerHTML") < 0);
check("reuses the shared focus trap", /createFocusTrap\(overlay\)/.test(tourSrc));
check("reuses anotherOverlayOpen", tourSrc.includes("anotherOverlayOpen(overlay)"));
check("reuses the Lang dictionary + switch hook", tourSrc.includes("Lang.t(") && tourSrc.includes("Lang.onSwitch("));
check("reuses the NovaViews bridge", tourSrc.includes("window.NovaViews"));
check("publishes window.NovaTour", tourSrc.includes("window.NovaTour = {"));
check("keyboard + reduced-motion aware", tourSrc.includes('e.key === "Escape"') && tourSrc.includes("prefers-reduced-motion: reduce"));
check("MODULE 38 yields the first visit to the tour",
  src.includes("firstVisitTour.ownsFirstVisit") && src.includes("var firstVisitTour = window.NovaTour;"));
check("A11Y bridge keeps outside modules working", src.includes("window.PLATFORM_A11Y = {"));

/* ============================================================
   behaviour — first visit
   ============================================================ */
console.log("\n\u2014 behaviour: first visit \u2014");
const t1 = bootTour();
check("nothing opens before load", !t1.isVisible());
check("auto-open deferred to window load", (t1.winListeners.load || []).length === 1);
t1.fireLoad();
check("still closed until the delay elapses", t1.timers.length === 1 && !t1.isVisible());
t1.flush();
check("overlay opens on the first visit", t1.isVisible());
check("focus trap activated (focus moved into the tour)", t1.trapCalls.indexOf("activate") > -1);
check("step indicator shows 1 of 8", t1.byId.tourCounter.textContent === "ar|tour.counter|i=1|n=8");
check("step title comes from the dictionary", t1.byId.tourTitle.textContent === "ar|tour.s1Title");
check("step text comes from the dictionary", t1.byId.tourStepText.textContent === "ar|tour.s1Text");
check("area is named in words", t1.byId.tourArea.textContent === "ar|tour.areaLabel ar|tour.s1Area");
check("Back is disabled (not hidden) on step 1", t1.byId.tourBack.disabled === true);
check("heading focused so screen readers announce the step", t1.byId.tourTitle.focused === true);
check("related element highlighted + scrolled into view",
  t1.targets[".hero-brand"].classList.contains("is-tour-highlight") && t1.targets[".hero-brand"].scrolled === 1);
check("smooth scroll centers the target before anchoring",
  t1.targets[".hero-brand"].scrollOpts && t1.targets[".hero-brand"].scrollOpts.block === "center" &&
  t1.targets[".hero-brand"].scrollOpts.behavior === "smooth");
check("popover anchored next to the target (inside the viewport, with an arrow)",
  t1.byId.tourOverlay.styleVars["--tour-top"] === "216px" &&
  t1.byId.tourOverlay.styleVars["--tour-left"] === "340px" &&
  t1.panelStub.getAttribute("data-tour-place") === "below" &&
  t1.panelStub.getAttribute("data-tour-place") !== "center" &&
  t1.byId.tourOverlay.styleVars["--tour-arrow"] === "160px");
check("no storage key written just by opening", Object.keys(t1.storage).length === 0);
check("no unrelated localStorage keys touched", t1.storage["motmi-portal:onboarding"] === undefined);

/* ============================================================
   behaviour — Next · Back · highlight moves · language switch
   ============================================================ */
console.log("\n\u2014 behaviour: Next · Back · highlight \u2014");
const t2 = bootTour();
t2.fireLoad();
t2.flush();
t2.flushTimers();
t2.click("tourNext");
t2.flushTimers();
check("Next advances the step indicator", t2.byId.tourCounter.textContent === "ar|tour.counter|i=2|n=8");
check("Back becomes available", t2.byId.tourBack.disabled === false);
check("highlight moved to the dashboard", t2.targets["#heroDash"].classList.contains("is-tour-highlight"));
check("previous highlight cleared", !t2.targets[".hero-brand"].classList.contains("is-tour-highlight"));
check("popover re-anchored next to the new target",
  t2.byId.tourOverlay.styleVars["--tour-top"] === "104px" &&
  t2.byId.tourOverlay.styleVars["--tour-left"] === "340px" &&
  t2.panelStub.getAttribute("data-tour-place") === "above");
t2.click("tourNext");
check("step 3 activates its view (replace \u2192 clean history)",
  t2.viewCalls.length === 1 && t2.viewCalls[0].id === "paths" && t2.viewCalls[0].replace === true);
check("a step whose element is absent still renders", t2.byId.tourCounter.textContent === "ar|tour.counter|i=3|n=8");
t2.click("tourBack");
check("Back returns to the previous step", t2.byId.tourCounter.textContent === "ar|tour.counter|i=2|n=8");
t2.Lang.switchTo("en");
check("panel re-renders when the interface language changes", t2.byId.tourTitle.textContent === "en|tour.s2Title");

/* ============================================================
   behaviour — Skip · Escape · completion
   ============================================================ */
console.log("\n\u2014 behaviour: Skip · Escape · completion \u2014");
const t3 = bootTour();
t3.fireLoad();
t3.flush();
t3.click("tourSkip");
check("Skip closes the overlay", !t3.isVisible());
check("focus returned to the opener (trap deactivated)", t3.trapCalls.indexOf("deactivate") > -1);
check("highlight ring removed", !t3.targets[".hero-brand"].classList.contains("is-tour-highlight"));
check("Skip persists { done: true }", (t3.stored("tour") || {}).done === true && t3.stored("tour").reason === "skip");
check("seen() reports the stored state", t3.api.seen() === true);
check("only the tour key is written", Object.keys(t3.storage).length === 1 && !!t3.storage["motmi-portal:tour"]);
check("a skipped tour never auto-opens again",
  (function () { const t = bootTour({ storage: t3.storage }); return (t.winListeners.load || []).length === 0; })());
t3.api.open();
check("manual replay from the Start-Here control still works", t3.isVisible());

const t4 = bootTour();
t4.fireLoad();
t4.flush();
t4.key("Escape");
check("Escape closes for good", !t4.isVisible() && (t4.stored("tour") || {}).reason === "escape");

const t5 = bootTour();
t5.fireLoad();
t5.flush();
for (let i = 0; i < 7; i++) t5.click("tourNext");
check("final step indicator shows 8 of 8", t5.byId.tourCounter.textContent === "ar|tour.counter|i=8|n=8");
check("primary action becomes Finish", t5.byId.tourNext.textContent === "ar|tour.finish");
t5.click("tourNext");
check("finishing closes the tour", !t5.isVisible());
check("finishing persists { done: true }", (t5.stored("tour") || {}).done === true && t5.stored("tour").reason === "done");
check("entry view restored after the tour",
  t5.viewCalls.length > 0 && t5.viewCalls[t5.viewCalls.length - 1].id === "hero" &&
  t5.viewCalls[t5.viewCalls.length - 1].replace === true);
check("a completed tour never auto-opens again",
  (function () { const t = bootTour({ storage: t5.storage }); return (t.winListeners.load || []).length === 0 && t.api.seen() === true; })());

/* ============================================================
   behaviour — returning visitor + graceful degradation
   ============================================================ */
console.log("\n\u2014 behaviour: returning visitor & degradation \u2014");
const seed = {
  "motmi-portal:tour": JSON.stringify({ v: 1, done: true, reason: "skip" }),
  "motmi-portal:onboarding": JSON.stringify({ done: true }),
  "motmi-portal:paths": JSON.stringify({ v: 1, done: { fundamentals: true } }),
};
const t6 = bootTour({ storage: seed });
check("returning visitor: no auto-open scheduled", (t6.winListeners.load || []).length === 0);
check("returning visitor: seen() is true", t6.api.seen() === true);
t6.flush();
check("refreshing the page does not reopen the tour", !t6.isVisible());
check("existing progress keys are left untouched",
  t6.storage["motmi-portal:paths"] === seed["motmi-portal:paths"] &&
  t6.storage["motmi-portal:onboarding"] === seed["motmi-portal:onboarding"]);

const t7 = bootTour({ blockedStorage: true });
check("boots with localStorage blocked", !!t7.api);
t7.fireLoad();
t7.flush();
check("still offers the tour once when storage is blocked", t7.isVisible());
let blockedThrew = null;
try { t7.click("tourSkip"); } catch (e) { blockedThrew = e; }
check("Skip never throws without storage", !blockedThrew && !t7.isVisible());
check("in-memory guard keeps it closed for this page load", t7.api.seen() === true);

const t8 = bootTour({ noViews: true });
t8.fireLoad();
t8.flush();
check("works without the ViewSwitcher bridge", t8.isVisible());
t8.click("tourNext");
t8.click("tourNext");
check("steps still advance", t8.byId.tourCounter.textContent === "ar|tour.counter|i=3|n=8");

const t9 = bootTour({ hash: "#path/fundamentals" });
t9.fireLoad();
t9.flush();
t9.click("tourNext");
t9.click("tourNext");
check("a deep-link entry is never rewritten by the tour", t9.viewCalls.length === 0);

const t10 = bootTour({ otherOverlayOpen: true });
t10.fireLoad();
t10.flush();
check("never stacks on another open modal", !t10.isVisible());
t10.api.open();
check("manual open respects the same guard", !t10.isVisible());

const t11 = bootTour({ reducedMotion: true });
t11.fireLoad();
t11.flush();
check("reduced motion \u2192 highlight without smooth scrolling",
  t11.targets[".hero-brand"].scrollOpts && t11.targets[".hero-brand"].scrollOpts.block === "center" &&
  t11.targets[".hero-brand"].scrollOpts.behavior === undefined);

/* ============================================================
   MODULE 38 handoff — a new student never gets two modals
   ============================================================ */
console.log("\n\u2014 MODULE 38 handoff \u2014");
function bootWizard(novaTour, onboardingDone) {
  const els = {};
  ["onboardingOverlay", "onboardingBack", "onboardingSkip", "onboardingNext", "onboardingStart"].forEach((id) => { els[id] = elStub(id); });
  const steps = [1, 2, 3, 4].map((i) => { const el = elStub("step" + i); el.dataset = { osStep: String(i) }; return el; });
  const ls = {
    getItem(k) { return (k === "motmi-portal:onboarding" && onboardingDone) ? JSON.stringify({ done: true }) : null; },
    setItem() {}, removeItem() {},
  };
  let threw = null;
  const sb = {
    console,
    $id: (id) => els[id] || null,
    $$: () => [],
    Store: { get(k, fb) { return fb; }, set() {} },
    Lang: { current: "ar", t: (k) => "ar|" + k },
    localStorage: ls,
    document: {
      body: { style: {} },
      querySelectorAll(sel) { return sel === "[data-os-step]" ? steps : []; },
      querySelector() { return null; },
      addEventListener() {},
      dispatchEvent() { return true; },
    },
    window: { NovaViews: { activate() {} } },
    createFocusTrap: () => ({ activate() {}, deactivate() {}, focusFirst() { return null; }, isActive() { return false; } }),
    anotherOverlayOpen: () => false,
    CustomEvent: function () {},
    setTimeout() { return 0; },
  };
  if (novaTour) sb.window.NovaTour = novaTour;
  vm.createContext(sb);
  try { vm.runInContext(wizardSrc, sb, { filename: "module38.js" }); } catch (e) { threw = e; }
  return { els, threw };
}
const w1 = bootWizard({ ownsFirstVisit: true }, false);
check("MODULE 38 still executes cleanly", !w1.threw);
check("wizard stays closed while the tour owns the first visit",
  w1.els.onboardingOverlay.getAttribute("aria-hidden") === "true");
const w2 = bootWizard(null, false);
check("wizard auto-opens as before when the tour is not mounted",
  w2.els.onboardingOverlay.getAttribute("aria-hidden") === "false");
const w3 = bootWizard({ ownsFirstVisit: true }, true);
check("a finished wizard stays hidden as before",
  w3.els.onboardingOverlay.getAttribute("aria-hidden") === "true");

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);

