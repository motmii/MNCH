/* ============================================================
   منصة أمن المعلومات — الترم الحالي
   Application core · modular IIFE architecture · JSDoc-documented
   ------------------------------------------------------------
   Modules:
    01 Helpers   02 Store    03 Sfx       04 Preloader
    05 PointerFX 06 Cursor           08 Reveal/Nav
    09 Counters  10 MobileMenu 11 Tilt/Magnetic
    12 ContactForm 13 QuizEngine 14-19 CyberTools
    21 MaterialsFilter 22 Lang (AR/EN) 23 PWA
   ============================================================ */
(() => {
"use strict";

/* ---------- 01 · Helpers ------------------------------------ */

/**
 * Shorthand for document.getElementById.
 * @param {string} id Element id.
 * @returns {HTMLElement|null} Element or null.
 */
const $id = (id) => document.getElementById(id);

/**
 * querySelectorAll returning a concrete array.
 * @param {string} sel CSS selector.
 * @param {ParentNode=} root Optional root.
 * @returns {HTMLElement[]} Elements.
 */
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Selector for controls participating in normal keyboard tab order. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

/* Ref-counted inert records let modal controllers cooperate without wiping an
   inert/aria-hidden value that was already present in the document. */
const inertRecords = new WeakMap();

/**
 * Toggle keyboard/screen-reader access for background elements.
 * @param {HTMLElement[]} elements Background elements.
 * @param {boolean} active True to inert, false to restore.
 * @returns {void}
 */
function setElementsInert(elements, active) {
  elements.forEach((el) => {
    if (!el || typeof el.setAttribute !== "function") return;
    let rec = inertRecords.get(el);
    if (active) {
      if (!rec) {
        rec = {
          refs: 0,
          hadInert: typeof el.hasAttribute === "function" ? el.hasAttribute("inert") : !!el.inert,
          ariaHidden: typeof el.getAttribute === "function" ? el.getAttribute("aria-hidden") : null
        };
        inertRecords.set(el, rec);
      }
      rec.refs += 1;
      if (!rec.hadInert) {
        try { el.inert = true; } catch { /* property is progressive */ }
        el.setAttribute("inert", "");
      }
      el.setAttribute("aria-hidden", "true");
      return;
    }
    if (!rec) return;
    rec.refs = Math.max(0, rec.refs - 1);
    if (rec.refs > 0) return;
    if (!rec.hadInert) {
      try { el.inert = false; } catch { /* property is progressive */ }
      if (typeof el.removeAttribute === "function") el.removeAttribute("inert");
    }
    if (rec.ariaHidden === null) {
      if (typeof el.removeAttribute === "function") el.removeAttribute("aria-hidden");
    } else {
      el.setAttribute("aria-hidden", rec.ariaHidden);
    }
    inertRecords.delete(el);
  });
}

/**
 * Create a small modal focus controller. Escape behavior stays local to each
 * existing modal; this helper owns Tab wrapping, background inerting, and
 * returning focus to the control that opened the overlay.
 * @param {HTMLElement|HTMLElement[]} roots Modal and any persistent trigger.
 * @param {{background?: function(): HTMLElement[]}=} options Options.
 * @returns {{activate:function(),deactivate:function(Object=),focusFirst:function(string=):HTMLElement|null,isActive:function():boolean}}
 */
function createFocusTrap(roots, options = {}) {
  const focusRoots = (Array.isArray(roots) ? roots : [roots]).filter(Boolean);
  const rootSet = new Set(focusRoots);
  const getBackground = options.background || (() => {
    const children = document.body && document.body.children ? [...document.body.children] : [];
    return children.filter((el) => !rootSet.has(el) && !/^(?:SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName || ""));
  });
  let active = false;
  let opener = null;
  let inerted = [];

  /** @returns {HTMLElement[]} Tabbable elements in trap order. */
  function focusables() {
    const out = [];
    focusRoots.forEach((root) => {
      if (!root) return;
      if (typeof root.matches === "function" && root.matches(FOCUSABLE_SELECTOR)) out.push(root);
      if (typeof root.querySelectorAll === "function") $$(FOCUSABLE_SELECTOR, root).forEach((el) => out.push(el));
    });
    return [...new Set(out)].filter((el) =>
      el && el.getAttribute && el.getAttribute("aria-hidden") !== "true" &&
      el.getAttribute("tabindex") !== "-1"
    );
  }

  /** @param {HTMLElement|null} target Candidate focus target. @returns {boolean} */
  function containsFocus(target) {
    return !!target && focusRoots.some((root) =>
      root === target || (typeof root.contains === "function" && root.contains(target))
    );
  }

  /**
   * Focus the first matching control, falling back to the first tabbable item.
   * @param {string=} selector Preferred selector inside the trap.
   * @returns {HTMLElement|null} Focused element.
   */
  function focusFirst(selector) {
    let target = null;
    if (selector) {
      for (const root of focusRoots) {
        target = root && typeof root.querySelector === "function" ? root.querySelector(selector) : null;
        if (target) break;
      }
    }
    target = target || focusables()[0] || focusRoots[0] || null;
    if (target && typeof target.focus === "function") {
      try { target.focus({ preventScroll: true }); }
      catch { target.focus(); }
    }
    return target;
  }

  /** @param {KeyboardEvent} e Key event. @returns {void} */
  function onKeydown(e) {
    if (!active || e.key !== "Tab") return;
    const items = focusables();
    if (!items.length) {
      e.preventDefault();
      focusFirst();
      return;
    }
    const current = document.activeElement;
    const index = items.indexOf(current);
    if (e.shiftKey && index <= 0) {
      e.preventDefault();
      items[items.length - 1].focus({ preventScroll: true });
    } else if (!e.shiftKey && (index === -1 || index === items.length - 1)) {
      e.preventDefault();
      items[0].focus({ preventScroll: true });
    }
  }

  /** Keep programmatic focus from escaping while the modal is active. */
  function onFocusIn(e) {
    if (!active || containsFocus(e.target)) return;
    e.stopPropagation();
    focusFirst();
  }

  return {
    /** Activate inerting and keyboard containment. @returns {void} */
    activate() {
      if (active) return;
      active = true;
      opener = document.activeElement || null;
      inerted = getBackground();
      setElementsInert(inerted, true);
      document.addEventListener("keydown", onKeydown, true);
      document.addEventListener("focusin", onFocusIn, true);
    },
    /**
     * Restore the page and optionally focus the opener.
     * @param {{restoreFocus?: boolean}=} opts Close options.
     * @returns {void}
     */
    deactivate(opts = {}) {
      if (!active) return;
      active = false;
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      setElementsInert(inerted, false);
      inerted = [];
      const target = opener;
      opener = null;
      if (opts.restoreFocus === false || !target || typeof target.focus !== "function") return;
      if (document.contains && !document.contains(target)) return;
      if (typeof target.closest === "function" && target.closest("[inert]")) return;
      try { target.focus({ preventScroll: true }); }
      catch { target.focus(); }
    },
    focusFirst,
    /** @returns {boolean} Active state. */
    isActive() { return active; }
  };
}

/** True when another application modal is open. @param {HTMLElement=} except @returns {boolean} */
function anotherOverlayOpen(except) {
  return $$(".mobile-menu.is-open, .onboarding-overlay[aria-hidden='false'], .search-dialog.is-open")
    .some((el) => el !== except);
}


/**
 * Escape HTML-significant characters.
 * @param {string} s Raw text.
 * @returns {string} Escaped text.
 */
function escHtml(s) {
  return s.replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

/**
 * Delay a callback until its source event stops firing.
 * @template {Function} F
 * @param {F} fn Callback.
 * @param {number} ms Quiet period ms.
 * @returns {F} Debounced wrapper.
 */
function debounce(fn, ms) {
  let t = null;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Format an integer with Arabic thousands separators.
 * @param {number} n Number to format.
 * @returns {string} Localized string.
 */
function fmtInt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Fetch a JSON resource with automatic retries using exponential
 * backoff + jitter, and a per-attempt abort timeout.
 * @param {string} url Resource URL.
 * @param {{retries?:number, baseDelay?:number, timeout?:number}=} opts
 *   retries: extra attempts after the first (default 3).
 *   baseDelay: first backoff in ms (default 400, doubles each retry, cap 4s).
 *   timeout: per-attempt abort timeout in ms (default 8000).
 * @returns {Promise<*>} Parsed JSON body.
 * @throws {Error} The last observed network/HTTP/parsing error.
 */
async function fetchJsonWithRetry(url, opts) {
  const retries = opts && opts.retries != null ? opts.retries : 3;
  const baseDelay = opts && opts.baseDelay != null ? opts.baseDelay : 400;
  const timeoutMs = opts && opts.timeout != null ? opts.timeout : 8000;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    /* Backoff before every attempt except the first: base·2^n ± 30% jitter. */
    if (attempt > 0) {
      const exp = Math.min(baseDelay * Math.pow(2, attempt - 1), 4000);
      const wait = Math.round(exp * (0.7 + Math.random() * 0.6));
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (err) {
      lastError = err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastError || new Error("fetch-failed");
}

/**
 * Keep only well-formed quiz subjects from an untrusted payload.
 * @param {*} raw Parsed JSON of unknown shape.
 * @returns {Object<string,{name:string,questions:Array}>} Cleaned store.
 */
function sanitizeQuizPayload(raw) {
  const out = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    Object.keys(raw).forEach((key) => {
      const subj = raw[key];
      if (subj && typeof subj.name === "string" && Array.isArray(subj.questions)) {
        const questions = subj.questions.filter((q) =>
          q && typeof q.q === "string" &&
          Array.isArray(q.opts) && q.opts.length >= 2 &&
          typeof q.a === "number" && q.a >= 0 && q.a < q.opts.length
        );
        if (questions.length > 0) out[key] = { name: subj.name, questions };
      }
    });
  }
  return out;
}

/**
 * Report one genuine completed action to the local motivation system.
 * The bridge is optional and idempotent — awarding the same real action
 * twice never grants duplicate XP. Failures are swallowed so learning
 * features never break when storage is unavailable.
 * @param {"lesson"|"quiz"|"flash"|"lab"} kind Action kind.
 * @param {string|number} id Stable action id.
 * @returns {void}
 */
function awardMotivation(kind, id) {
  try {
    const api = window.PlatformMotivation;
    if (api && typeof api.award === "function") api.award(kind, id);
  } catch (e) { /* motivation is additive, never fatal */ }
}

/* ---------- 02 · Store -------------------------------------- */
const Store = {
  NS: "motmi-portal",
  /**
   * Read JSON from localStorage.
   * @param {string} key Key.
   * @param {*=} fallback Fallback value.
   * @returns {*} Parsed value or fallback.
   */
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`${Store.NS}:${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  /**
   * Persist a JSON value.
   * @param {string} key Key.
   * @param {*} value Value.
   * @returns {void}
   */
  set(key, value) {
    try { localStorage.setItem(`${Store.NS}:${key}`, JSON.stringify(value)); } catch {}
  },
  /**
   * Delete an entry.
   * @param {string} key Key.
   * @returns {void}
   */
  remove(key) {
    try { localStorage.removeItem(`${Store.NS}:${key}`); } catch {}
  }
};

/* Store bridge — the top-level modules that live OUTSIDE this IIFE
   (MODULE 47 · HeroDash) read the same namespaced keys (lessons / paths /
   labs / flash) through this reference instead of re-implementing storage. */
window.PLATFORM_STORE = Store;

/* A11y bridge — top-level modules OUTSIDE this IIFE that own a modal
   (MODULE 48 · GlobalSearch) reuse the same focus containment and the same
   "another modal is open" guard instead of re-implementing them. */ 
window.PLATFORM_A11Y = {
  createFocusTrap: createFocusTrap,
  anotherOverlayOpen: anotherOverlayOpen,
  setElementsInert: setElementsInert
};

/* ============================================================
   MODULE 54 · OnboardingTour — الجولة التعريفية للمستخدم الجديد
   ------------------------------------------------------------
   Eight short steps (Arabic-first, RTL) that explain the platform
   to a first-time student: purpose → dashboard / progress →
   learning paths, subjects & lessons → quizzes (progress is saved)
   → labs & security tools → study materials → the AI assistant →
   navigation & search.

   Design notes
   · Declared BEFORE MODULE 38 on purpose: the preferences wizard
     asks this module's bridge whether the guided tour owns the
     first visit, so a new student never gets two modals at once.
   · Shows once per browser. The state lives in localStorage through
     the shared Store wrapper (MODULE 02) under "motmi-portal:tour";
     Skip, Escape and the final step all persist { done: true }.
     No other key is read, written or reset.
   · Reuses the existing overlay shell (.onboarding-overlay /
     .onboarding-panel, MODULE 38 CSS), the shared focus trap
     (Tab wrap · background inerting · focus restore) and
     MODULE 22's Lang dictionary — no new framework, no duplicate
     modal system.
   · Highlighting is best-effort: the described view is activated
     through the public window.NovaViews bridge (MODULE 33) and the
     related element receives the .is-tour-highlight ring, while
     the panel always names the area in words (never colour-only).
   · Fails gracefully: without markup, without storage, without
     NovaViews or with prefers-reduced-motion the tour either stays
     silent or degrades to a plain, scroll-free step list.
   ============================================================ */
/* @@TOUR_START@@ */
(function initOnboardingTour() {
  var overlay = $id("tourOverlay");
  if (!overlay) return; /* markup absent → the tour simply does not exist */

  var STORE_KEY = "tour";   /* → "motmi-portal:tour" through Store (MODULE 02) */
  var AUTO_DELAY = 700;     /* let the preloader (MODULE 04) fade out first */

  /* The eight first-visit steps — one per main area of the platform.
     `view` is a ViewSwitcher (MODULE 33) view id, `target` the element to
     highlight; both are best effort (a missing section never breaks a step).
     `t` / `x` / `a` are MODULE 22 dictionary keys: title, explanation and the
     spoken name of the highlighted area. */
  var STEPS = [
    { view: "hero",  target: ".hero-brand",   t: "tour.s1Title", x: "tour.s1Text", a: "tour.s1Area" },
    { view: "hero",  target: "#heroDash",     t: "tour.s2Title", x: "tour.s2Text", a: "tour.s2Area" },
    { view: "paths", target: "#paths",        t: "tour.s3Title", x: "tour.s3Text", a: "tour.s3Area" },
    { view: "quiz",  target: "#quizApp",      t: "tour.s4Title", x: "tour.s4Text", a: "tour.s4Area" },
    { view: "labs",  target: "#labs",         t: "tour.s5Title", x: "tour.s5Text", a: "tour.s5Area" },
    { view: "flash", target: "#flash",        t: "tour.s6Title", x: "tour.s6Text", a: "tour.s6Area" },
    { view: "hero",  target: "#assistantRoot", t: "tour.s7Title", x: "tour.s7Text", a: "tour.s7Area" },
    { view: "hero",  target: "#nav",          t: "tour.s8Title", x: "tour.s8Text", a: "tour.s8Area" }
  ];
  var TOTAL = STEPS.length;

  var titleEl = $id("tourTitle");
  var textEl = $id("tourStepText");
  var areaEl = $id("tourArea");
  var countEl = $id("tourCounter");
  var nextBtn = $id("tourNext");
  var backBtn = $id("tourBack");
  var trap = createFocusTrap(overlay);

  var step = 0;            /* 0-based index of the visible step */
  var open = false;        /* overlay visible? */
  var marked = false;      /* in-memory "seen" — also covers blocked storage */
  var langBound = false;   /* Lang.onSwitch registered once, lazily */
  var pinnedEntry = false; /* deep link active → never navigate views */
  var returnView = null;   /* view the visitor came from (restored on close) */
  var highlighted = null;  /* element currently carrying the ring */
  /* ---------- persisted state (never touches other keys) ---------- */

  /**
   * True once the tour was completed or skipped in this browser.
   * @returns {boolean} Seen state.
   */
  function seen() {
    if (marked) return true;
    var saved = Store.get(STORE_KEY, null);
    return !!(saved && saved.done);
  }

  /**
   * Store "never show the tour again" (additive — every other key stays as it
   * is). A blocked or unavailable localStorage is tolerated: the in-memory flag
   * still keeps the tour closed for the rest of this page load.
   * @param {string} reason "done" | "skip" | "escape"
   * @returns {void}
   */
  function remember(reason) {
    marked = true;
    Store.set(STORE_KEY, { v: 1, done: true, reason: reason, at: Date.now() });
  }

  /* ---------- small helpers ---------- */

  /** @returns {boolean} True when the visitor asked for reduced motion. */
  function reducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) { return false; }
  }

  /**
   * Show the view that owns the described area — best effort, through the
   * public MODULE 33 bridge, and skipped entirely for deep-link entries so a
   * "#path/…" or "#lesson/…" destination is never rewritten.
   * @param {string} viewId Target view id.
   * @returns {void}
   */
  function showView(viewId) {
    if (!viewId || pinnedEntry) return;
    try {
      var views = window.NovaViews;
      if (!views || typeof views.activate !== "function") return;
      var current = typeof views.current === "function" ? views.current() : null;
      /* replace → the tour never pollutes the visitor's Back history. */
      if (current !== viewId) views.activate(viewId, { replace: true });
    } catch (e) { /* view switching is additive, never mandatory */ }
  }

  /** Put the visitor back on the view the tour started from. @returns {void} */
  function restoreView() {
    var target = returnView;
    returnView = null;
    showView(target);
  }

  /** Drop the ring from the previously highlighted element. @returns {void} */
  function clearHighlight() {
    if (highlighted && highlighted.classList) highlighted.classList.remove("is-tour-highlight");
    highlighted = null;
    resetAnchor();
  }

  /* ---------- anchored popover positioning ---------- */

  var PANEL_GAP = 16;      /* breathing room between the target and the popover */
  var VIEW_MARGIN = 12;    /* minimum distance from any viewport edge */
  var pinQueued = false;   /* a re-pin is already scheduled on the next frame */
  var pinTimer = 0;        /* fallback timer when rAF is unavailable */

  /**
   * Viewport size (guarded — the vm sandbox has no window.innerWidth).
   * @returns {{w:number,h:number}} Viewport dimensions.
   */
  function viewport() {
    var w = 0;
    var h = 0;
    try {
      if (typeof window !== "undefined" && window) {
        if (typeof window.innerWidth === "number") w = window.innerWidth;
        if (typeof window.innerHeight === "number") h = window.innerHeight;
      }
    } catch (e) { /* keep the fallbacks below */ }
    return { w: w || 1024, h: h || 700 };
  }

  /**
   * Measured panel box (guarded — offsetWidth is 0 in the vm sandbox).
   * @returns {{w:number,h:number}} Panel dimensions.
   */
  function panelBox() {
    var panel = tourPanel();
    var w = 0;
    var h = 0;
    try {
      if (panel && typeof panel.getBoundingClientRect === "function") {
        var r = panel.getBoundingClientRect();
        if (r) { w = r.width || 0; h = r.height || 0; }
      }
    } catch (e) { /* keep the fallbacks below */ }
    if (!w && panel) { try { w = panel.offsetWidth || 0; } catch (e2) { w = 0; } }
    if (!h && panel) { try { h = panel.offsetHeight || 0; } catch (e3) { h = 0; } }
    return { w: w || 360, h: h || 300 };
  }

  /** @returns {Object|null} The floating popover panel. */
  function tourPanel() {
    try {
      if (overlay.querySelector) {
        var p = overlay.querySelector(".tour-panel");
        if (p) return p;
      }
    } catch (e) { /* fall through to the overlay */ }
    return overlay;
  }

  /** Clear any inline anchor so a missing target degrades to the CSS fallback. @returns {void} */
  function resetAnchor() {
    try {
      if (overlay && overlay.style && typeof overlay.style.removeProperty === "function") {
        overlay.style.removeProperty("--tour-top");
        overlay.style.removeProperty("--tour-left");
        overlay.style.removeProperty("--tour-shift");
        overlay.style.removeProperty("--tour-arrow");
      }
    } catch (e) { /* inline anchoring is additive */ }
    try {
      var panel0 = tourPanel();
      if (panel0 && panel0.removeAttribute && panel0 !== overlay) panel0.removeAttribute("data-tour-place");
    } catch (e2) { /* the arrow placement is additive */ }
  }

  /**
   * Pin the popover next to the highlighted target: below it when room
   * allows, above it otherwise, horizontally aligned to the target and
   * clamped inside the viewport. Without a measurable target the CSS
   * fallback (centered popover) stays in place.
   * @returns {void}
   */
  function positionTour() {
    if (!open) return;
    var el = highlighted;
    var panel = tourPanel();
    if (!el || typeof el.getBoundingClientRect !== "function") return;
    var rect = null;
    try { rect = el.getBoundingClientRect(); } catch (e) { rect = null; }
    if (!rect) return;
    if (!rect.width && !rect.height && !rect.top && !rect.bottom && !rect.left && !rect.right) return;
    var vp = viewport();
    var box = panelBox();
    var pw = Math.min(box.w, vp.w - VIEW_MARGIN * 2);
    var ph = Math.min(box.h, vp.h - VIEW_MARGIN * 2);
    var rtl = false;
    try { rtl = !!(document && document.documentElement && document.documentElement.dir === "rtl"); }
    catch (e2) { rtl = false; }
    var left = rtl ? (rect.right - pw) : rect.left;
    if (typeof left !== "number" || isNaN(left)) left = (vp.w - pw) / 2;
    left = Math.max(VIEW_MARGIN, Math.min(left, Math.max(VIEW_MARGIN, vp.w - pw - VIEW_MARGIN)));
    var cx = (typeof rect.left === "number" ? rect.left : left) + (rect.width || 0) / 2;
    var arrow = Math.max(20, Math.min(Math.max(20, pw - 20), cx - left));
    var place = "below";
    var top = (typeof rect.bottom === "number" ? rect.bottom : 0) + PANEL_GAP;
    if (top + ph > vp.h - VIEW_MARGIN) {
      var above = (typeof rect.top === "number" ? rect.top : vp.h) - PANEL_GAP - ph;
      if (above >= VIEW_MARGIN) { place = "above"; top = above; }
      else {
        place = (above > (vp.h - VIEW_MARGIN - top)) ? "above" : "below";
        top = place === "above" ? above : top;
      }
    }
    top = Math.max(VIEW_MARGIN, Math.min(top, Math.max(VIEW_MARGIN, vp.h - ph - VIEW_MARGIN)));
    try {
      if (overlay && overlay.style && typeof overlay.style.setProperty === "function") {
        overlay.style.setProperty("--tour-top", Math.round(top) + "px");
        overlay.style.setProperty("--tour-left", Math.round(left) + "px");
        overlay.style.setProperty("--tour-shift", "none");
        overlay.style.setProperty("--tour-arrow", Math.round(arrow) + "px");
      }
      if (panel && panel.setAttribute && panel !== overlay) panel.setAttribute("data-tour-place", place);
    } catch (e3) { /* anchoring is additive — the fallback stays readable */ }
  }

  /** Schedule a re-pin on the next frame (scroll/resize safe). @returns {void} */
  function queuePin() {
    if (!open || pinQueued) return;
    pinQueued = true;
    var run = function () { pinQueued = false; positionTour(); };
    try {
      if (typeof window !== "undefined" && window && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(run);
        return;
      }
    } catch (e) { /* fall through to the timer */ }
    try { pinTimer = setTimeout(run, 16); } catch (e2) { pinQueued = false; }
  }

  /**
   * Scroll the target into view first (smooth unless reduced motion), then
   * anchor the popover once the scroll settles. Missing markup is fine.
   * @param {Object} sStep Step definition.
   * @returns {void}
   */
  function scrollTarget(sStep) {
    var el = null;
    try { el = sStep.target ? document.querySelector(sStep.target) : null; } catch (e) { el = null; }
    if (!el || !el.classList) { resetAnchor(); positionTour(); return; }
    if (highlighted !== el) {
      clearHighlight();
      try { el.classList.add("is-tour-highlight"); } catch (e0) { /* ring is additive */ }
      highlighted = el;
    }
    var smooth = !reducedMotion();
    if (typeof el.scrollIntoView !== "function") { positionTour(); return; }
    try {
      el.scrollIntoView(smooth ? { block: "center", behavior: "smooth" } : { block: "center" });
    } catch (e2) {
      try { el.scrollIntoView(); } catch (e3) { /* nothing to scroll */ }
    }
    /* Anchor after the smooth scroll settles: two frames when available,
       one guarded timer otherwise. */
    var settle = function () { positionTour(); };
    try {
      if (smooth && typeof window !== "undefined" && window && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(function () { window.requestAnimationFrame(settle); });
        return;
      }
    } catch (e4) { /* fall through to the timer */ }
    try { setTimeout(settle, smooth ? 350 : 0); } catch (e5) { positionTour(); }
  }

  /**
   * Highlight the element a step talks about: a dashed ring (the panel also
   * names the area in words, so colour is never the only cue), scrolled into
   * view first, with the popover anchored next to it. Missing markup is fine.
   * @param {Object} sStep Step definition.
   * @returns {void}
   */
  function highlight(sStep) {
    scrollTarget(sStep);
  }

  /**
   * Subscribe to MODULE 22 language switches once, so the panel re-renders in
   * the new locale. Deferred to the first open because Lang is declared later
   * in this IIFE than the module body.
   * @returns {void}
   */
  function bindLang() {
    if (langBound) return;
    langBound = true;
    try {
      if (typeof Lang !== "undefined" && Lang && typeof Lang.onSwitch === "function") {
        Lang.onSwitch(function () { if (open) render(step); });
      }
    } catch (e) { /* the locale hook is optional */ }
  }
  /* ---------- rendering ---------- */

  /**
   * Paint step `n` (0-based): localized text, counter, highlight and focus.
   * @param {number} n Step index.
   * @returns {void}
   */
  function render(n) {
    step = Math.max(0, Math.min(n, TOTAL - 1));
    var current = STEPS[step];
    var last = step === TOTAL - 1;
    showView(current.view);
    if (titleEl) titleEl.textContent = Lang.t(current.t);
    if (textEl) textEl.textContent = Lang.t(current.x);
    if (areaEl) areaEl.textContent = Lang.t("tour.areaLabel") + " " + Lang.t(current.a);
    if (countEl) countEl.textContent = Lang.t("tour.counter", { i: step + 1, n: TOTAL });
    if (nextBtn) nextBtn.textContent = Lang.t(last ? "tour.finish" : "tour.next");
    /* Back is disabled — not hidden — on the first step, so the panel never
       creates an invisible focus stop (display rules beat [hidden] on .btn). */
    if (backBtn) backBtn.disabled = step === 0;
    highlight(current);
    /* Scroll/resize re-pins the popover next to the target (throttled). */
    bindRepin();
    queuePin();
    /* Focus the step heading: a screen reader announces the new step while the
       shared trap keeps the tab order inside the dialog. */
    if (titleEl && typeof titleEl.focus === "function") {
      try { titleEl.focus({ preventScroll: true }); }
      catch (e) { try { titleEl.focus(); } catch (e2) { /* not focusable */ } }
    }
  }

  /* ---------- open / close ---------- */

  /**
   * Open the tour on step 1 — used by the first-visit timer and by the manual
   * replay control ([data-tour-reopen]). Never stacks on another modal.
   * @returns {void}
   */
  function openTour() {
    if (open || anotherOverlayOpen(overlay)) return;
    bindLang();
    returnView = null;
    pinnedEntry = false;
    try {
      var views = window.NovaViews;
      if (views && typeof views.current === "function") returnView = views.current();
    } catch (e) { returnView = null; }
    /* A deep link (#path/… · #lesson/…) must survive the tour untouched. */
    try { pinnedEntry = /^#(?:path|lesson)\//.test(location.hash || ""); } catch (e2) { pinnedEntry = false; }
    open = true;
    overlay.setAttribute("aria-hidden", "false");
    trap.activate();
    render(0);
  }

  /**
   * Close the tour for good (Skip · Escape · final step).
   * @param {string} reason "done" | "skip" | "escape"
   * @returns {void}
   */
  function closeTour(reason) {
    if (!open) return;
    open = false;
    clearHighlight();
    /* Restore the original view while the overlay still counts as open, so the
       ViewSwitcher's own focus handling stays out of the way; the shared trap
       then returns focus to the element that opened the tour. */
    restoreView();
    overlay.setAttribute("aria-hidden", "true");
    trap.deactivate();
    remember(reason);
    dispatchDone(reason);
  }

  /**
   * Tell the rest of the page that the first visit is over (additive).
   * @param {string} reason End reason.
   * @returns {void}
   */
  function dispatchDone(reason) {
    try {
      if (typeof CustomEvent !== "function" || !document.dispatchEvent) return;
      document.dispatchEvent(new CustomEvent("nova:tour-done", { detail: { reason: reason } }));
    } catch (e) { /* notifying other modules is optional */ }
  }

  /** Advance, or finish on the last step. @returns {void} */
  function nextStep() {
    if (step >= TOTAL - 1) { closeTour("done"); return; }
    render(step + 1);
  }

  /* ---------- wiring ---------- */

  /* Delegated clicks inside the panel (Next · Back · Skip) — the MODULE 38
     pattern. Enter/Space keep working because these are real buttons. */
  overlay.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("#tourNext")) nextStep();
    else if (t.closest("#tourBack")) render(step - 1);
    else if (t.closest("#tourSkip")) closeTour("skip");
  });

  /* The dimmed backdrop never dismisses the tour — leaving is an explicit
     choice (Skip, Escape or the final step). */
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) e.stopPropagation();
  });

  /* Escape = skip for good. */
  document.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape" || e.key === "Esc") {
      e.preventDefault();
      closeTour("escape");
    }
  });

  /* Manual replay — the same delegated-trigger pattern as MODULE 49. */
  document.addEventListener("click", function (e) {
    var trigger = (e.target && e.target.closest) ? e.target.closest("[data-tour-reopen]") : null;
    if (!trigger) return;
    e.preventDefault();
    openTour();
  });

  /* Keep the popover glued to its target while it is open. Listeners are
     attached once (capture for scroll so nested scrollers count too) and
     every callback is throttled through queuePin. */
  var repinBound = false;
  function bindRepin() {
    if (repinBound) return;
    repinBound = true;
    try {
      if (window && typeof window.addEventListener === "function") {
        window.addEventListener("resize", queuePin);
        window.addEventListener("scroll", queuePin, true);
      }
    } catch (e) { /* re-pinning is additive */ }
    try {
      if (document && typeof document.addEventListener === "function") {
        document.addEventListener("scroll", queuePin, true);
      }
    } catch (e2) { /* re-pinning is additive */ }
  }

  /* ---------- first visit ---------- */

  /** Auto-open once per browser, never on top of another modal. @returns {void} */
  function autoOpen() {
    if (open || seen() || anotherOverlayOpen(overlay)) return;
    openTour();
  }

  if (!seen()) {
    /* script.js is deferred: "load" is the moment the preloader (MODULE 04)
       starts fading — exactly when a welcome tour belongs on screen. */
    if (document.readyState === "complete") setTimeout(autoOpen, AUTO_DELAY);
    else window.addEventListener("load", function () { setTimeout(autoOpen, AUTO_DELAY); });
  }

  /* Public bridge: the Start-Here control replays the tour, and MODULE 38 asks
     `ownsFirstVisit` before it auto-opens its preferences wizard. */
  window.NovaTour = {
    ownsFirstVisit: true,
    /** Replay from step 1. @returns {void} */
    open: openTour,
    /** Close exactly like the "Skip tour" button. @returns {void} */
    close: function () { closeTour("skip"); },
    /** @returns {boolean} True while the panel is visible. */
    isOpen: function () { return open; },
    /** @returns {boolean} True once the tour was completed or skipped. */
    seen: seen,
    /** @returns {number} Number of steps in the tour. */
    stepCount: function () { return TOTAL; }
  };
})();
/* @@TOUR_END@@ */

/* ============================================================
   MODULE 38 · Onboarding — optional first-time learning-path
   wizard. Shows a 3-step modal asking for the student's level,
   subjects of interest and preferred learning style, then
   recommends a starting path. Skippable. No registration needed.
   Persists state in localStorage under "motmi-portal:onboarding".
   ============================================================ */
(function initOnboarding() {
  var STORE_KEY = "motmi-portal:onboarding";
  var overlay = $id("onboardingOverlay");
  if (!overlay) return;

    /* Don't auto-show if the user dismissed it before. */
  var done = false;
  try { done = JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); done = done && done.done; } catch { done = false; }

  /* Reopen bridge (MODULE 49 · ReopenOnboarding): the wizard stays fully
     wired even when it was finished/dismissed, so the "جولة التعريف" button
     in the Start-Here strip can replay it. Only the AUTOMATIC first-visit
     show is suppressed (see the guard at the end of this module). */
  window.NovaOnboarding = {
    open: function () {
      if (anotherOverlayOpen(overlay)) return;
      state = { level: null, subjects: [], styles: [] };
      clearSelections(".btn-level, .btn-subject, .btn-style");
      showStep(1);
    },
    isOpen: function () { return overlay.getAttribute("aria-hidden") === "false"; }
  };

  /* State collected during onboarding */
  var state = { level: null, subjects: [], styles: [] };
  var stepEls = {};
  var step = 1;
  var OS_STEPS = 4;

  /* Find step elements by data-os-step. */
  var stepNodes = document.querySelectorAll("[data-os-step]");
  for (var i = 0; i < stepNodes.length; i++) stepEls[stepNodes[i].dataset.osStep] = stepNodes[i];
  var backBtn = $id("onboardingBack");
  var skipBtn = $id("onboardingSkip");
  var nextBtn = $id("onboardingNext");
  var startLink = $id("onboardingStart");
  var trap = createFocusTrap(overlay);

  /** Toggle a value in an array state field. @param {string} key @param {string} val @returns {void} */
  function toggleArr(key, val) {
    var arr = state[key];
    var idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
  }

  /** Keep the visual and ARIA pressed states in lockstep. */
  function setPressed(btn, on) {
    if (btn && btn.setAttribute) btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  /** Clear a selection group before replaying/skipping the wizard. */
  function clearSelections(selector) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove("is-active");
      setPressed(nodes[i], false);
    }
  }

  /**
   * Resolve a subject value to a display name.
   * Onboarding step 2 stores official COURSE CODES (the same ids used by the
   * SUBJECTS registry); read the name from window.PLATFORM_SUBJECTS so the
   * summary shows «الخوارزميات» instead of «260210030702». Falls back to the
   * raw value when the registry is not mounted yet.
   * @param {string} value Selected course code.
   * @returns {string} Display name.
   */
  function subjectLabel(value) {
    try {
      var reg = window.PLATFORM_SUBJECTS;
      if (reg && reg.length) {
        for (var i = 0; i < reg.length; i++) {
          if (reg[i] && (reg[i].code === value || reg[i].id === value)) {
            return Lang.current === "en" && reg[i].nameEn ? reg[i].nameEn : reg[i].nameAr;
          }
        }
      }
    } catch { /* registry unavailable → show the raw value */ }
    return value;
  }

  /** Render the summary step from collected answers. @returns {void} */
    function renderSummary() {
    var levelEl = document.querySelector("[data-os-summary-level]");
    var subjEl = document.querySelector("[data-os-summary-subjects]");
    var styleEl = document.querySelector("[data-os-summary-style]");
    if (levelEl) levelEl.textContent = Lang.t("onboarding.summaryLevel", { level: state.level || "—" });
    if (subjEl) subjEl.textContent = Lang.t("onboarding.summarySubjects", { subjects: (state.subjects.length ? state.subjects.map(subjectLabel).join("، ") : "—") });
    if (styleEl) styleEl.textContent = Lang.t("onboarding.summaryStyle", { style: (state.styles.length ? state.styles.join("، ") : "—") });
  }

  /** Close the overlay and mark onboarding as done. @returns {void} */
  function finishOnboarding() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ done: true })); } catch { /* storage blocked — overlay must still close */ }
    trap.deactivate();
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /** Show step N (1-based). @param {number} n @returns {void} */
  function showStep(n) {
    var opening = overlay.getAttribute("aria-hidden") !== "false";
    Object.keys(stepEls).forEach(function (k) {
      var el = stepEls[k];
      if (el) el.hidden = String(+k) !== String(n);
    });
    step = n;
    if (backBtn) backBtn.style.display = n > 1 ? "" : "none";
    if (nextBtn) nextBtn.style.display = n >= OS_STEPS ? "none" : "";
    if (startLink) startLink.style.display = n >= OS_STEPS ? "" : "none";
    if (overlay) overlay.setAttribute("aria-hidden", "false");
    if (opening) {
      trap.activate();
      document.body.style.overflow = "hidden";
    }
    trap.focusFirst(".onboarding-step:not([hidden]) button, .onboarding-step:not([hidden]) a");
  }

  function handleNext() {
    if (step < OS_STEPS - 1) { showStep(step + 1); return; }
    if (step === OS_STEPS - 1) { renderSummary(); }
    showStep(OS_STEPS);
  }

  function handleBack() {
    if (step > 1) showStep(step - 1);
  }

  function handleSkip() {
    if (step === 2) {
      state.subjects = [];
      clearSelections(".btn-subject");
      showStep(step + 1);
      return;
    }
    finishOnboarding();
  }

  function handleLevel(e) {
    var btn = e.target.closest(".btn-level");
    if (!btn) return;
    state.level = btn.dataset.osLevel;
    var btns = document.querySelectorAll(".btn-level");
    btns.forEach(function (b) {
      var active = b === btn;
      b.classList.toggle("is-active", active);
      setPressed(b, active);
    });
    showStep(step + 1);
  }

  function handleSubject(e) {
    var btn = e.target.closest(".btn-subject");
    if (!btn) return;
    toggleArr("subjects", btn.dataset.osSubj);
    setPressed(btn, btn.classList.toggle("is-active"));
  }

  function handleStyle(e) {
    var btn = e.target.closest(".btn-style");
    if (!btn) return;
    toggleArr("styles", btn.dataset.osStyle);
    setPressed(btn, btn.classList.toggle("is-active"));
  }

  function handleStart(e) {
    /* The Start control is a real <a href="#path/fundamentals">, so we
       simply mark onboarding done and let the ViewSwitcher navigate. */
    finishOnboarding();
    /* The ViewSwitcher routes #path/fundamentals to the shared #path view
       on its own (hashchange → resolveViewId). Nothing else to do. */
  }

  /* Bind delegated events on the overlay. */
  overlay.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest(".btn-level")) handleLevel(e);
    else if (t.closest(".btn-subject")) handleSubject(e);
    else if (t.closest(".btn-style")) handleStyle(e);
    else if (t.closest("#onboardingNext")) handleNext();
    else if (t.closest("#onboardingBack")) handleBack();
    else if (t.closest("#onboardingStart")) handleStart(e);
    else if (t.closest("#onboardingSkip")) handleSkip();
  });

  /* Prevent accidental dismissal — clicking outside the panel does nothing. */
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      /* keep the modal open; the user uses Next/Skip to proceed */
      e.stopPropagation();
    }
  });

  /* Escape closes only from step 1 (don't let users bail mid-flow easily). */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.getAttribute("aria-hidden") === "false") {
      if (step === 1) finishOnboarding();
      else showStep(Math.max(1, step - 1));
    }
  });

  /* Auto-show only for first-time visitors. A finished/dismissed wizard stays
     hidden until [data-onboarding-reopen] (MODULE 49) replays it — the module
     itself keeps running above, so every control still works after a reopen.
     While the guided first-visit TOUR (MODULE 54) is mounted it owns that very
     first visit, so this preferences wizard never opens by itself; its stored
     answers are never touched and its Start-Here control still replays it. */
  var firstVisitTour = window.NovaTour;
  if (done || (firstVisitTour && firstVisitTour.ownsFirstVisit)) {
    overlay.setAttribute("aria-hidden", "true");
    return;
  }

  /* Render localized step 1 on load, keep the panel closed until mounted. */
  showStep(1);
})();
/* MODULE 39b · Lessons — removed in migration 2.
   The authored lessons belonged to the previous-semester subjects,
   which were removed from the platform entirely. The lesson view
   (#lesson) and its routing remain and now show an honest
   unavailable state; new lessons for the current-semester subjects
   will be added here later (same embedded structure). */
const LESSONS = {};

/* Expose the lesson registry so the top-level modules (MODULE 48 · search)
   can index authored lessons without duplicating content. It is empty today
   — so the search simply renders no lesson group instead of inventing one. */
window.PLATFORM_LESSONS = LESSONS;


/* ============================================================
   MODULE 00b · Subjects — single source of truth for the official
   study-plan subjects (دبلوم أمن المعلومات — تجسير مهني).
   ------------------------------------------------------------
   The subject cards in #subjectsGrid are RENDERED from this
   registry only — a subject name lives in exactly one place.
   Every subject is identified by its OFFICIAL COURSE CODE
   (stable unique id), never by array index, and every subject
   owns a full Arabic question bank in data/quizzes.json under
   the same code (quizKey). The previous-semester subjects were
   removed from the platform entirely (migration 2) — there is
   no archive section and no old-subject content anywhere.
   Exposed on window as PLATFORM_SUBJECTS for the AI assistant
   and Stats.Live.
   ============================================================ */
const SUBJECTS = [
  /* ---- current semester · official study plan (exactly 5 subjects) ---- */
  {
    id: "260210030702", code: "260210030702",
    nameAr: "الخوارزميات", nameEn: "",
    creditHours: 3, semester: "current",
    day: "الأحد", startTime: "09:00 AM", endTime: "12:00 PM",
    descriptionAr: "تحليل الخوارزميات وتعقيدها الزمني، هياكل البيانات، استراتيجيات التصميم (فرّق تسُد، الجشع، البرمجة الديناميكية)، والرسوم البيانية.",
    icon: "images/algorithms.svg", hue: 190,
    tag: "algorithms", panel: "01", contentStatus: "available", quizKey: "260210030702"
  },
  {
    id: "260210030802", code: "260210030802",
    nameAr: "مفاهيم نظم التشغيل", nameEn: "",
    creditHours: 3, semester: "current",
    day: "الأحد", startTime: "12:00 PM", endTime: "03:00 PM",
    descriptionAr: "وظائف نظام التشغيل، العمليات والخيوط والجدولة، إدارة الذاكرة والترحيل، المزامنة والأقفال الميتة، ونظم الملفات.",
    icon: "images/os-concepts.svg", hue: 205,
    tag: "osconcepts", panel: "02", contentStatus: "available", quizKey: "260210030802"
  },
  {
    id: "260210030902", code: "260210030902",
    nameAr: "السياسات والتشريعات والأخلاقيات والالتزام بها", nameEn: "",
    creditHours: 3, semester: "current",
    day: "الاثنين", startTime: "09:00 AM", endTime: "12:00 PM",
    descriptionAr: "سياسات الأمن وأنواعها، التشريعات والخصوصية والملكية الفكرية، الأخلاقيات المهنية والإذن القانوني، والامتثال.",
    icon: "images/policies-ethics.svg", hue: 265,
    tag: "policy", panel: "03", contentStatus: "available", quizKey: "260210030902"
  },
  {
    id: "260210031002", code: "260210031002",
    nameAr: "مكونات أنظمة تقنية المعلومات", nameEn: "",
    creditHours: 3, semester: "current",
    day: "الاثنين", startTime: "12:00 PM", endTime: "03:00 PM",
    descriptionAr: "مكونات أنظمة تقنية المعلومات من عتاد وبرمجيات وشبكات ومرافق، والمحاكاة الافتراضية والسحابة، وعلاقتها بتأمين البيئة.",
    icon: "images/it-components.svg", hue: 130,
    tag: "components", panel: "04", contentStatus: "available", quizKey: "260210031002"
  },
  {
    id: "260210031102", code: "260210031102",
    nameAr: "مبادئ التصميم في الأمن السيبراني", nameEn: "",
    creditHours: 3, semester: "current",
    day: "الثلاثاء", startTime: "09:00 AM", endTime: "12:00 PM",
    descriptionAr: "مبادئ تصميم الأمن: الدفاع في العمق، أقل الصلاحيات، الفصل بين المهام، الثقة الصفرية، والتحكم في الوصول.",
    icon: "images/security-design.svg", hue: 300,
    tag: "design", panel: "05", contentStatus: "available", quizKey: "260210031102"
  },
];

  

/* Current-semester subject count (official schedule). */
const CURRENT_SUBJECT_COUNT = SUBJECTS.filter((s) => s.semester === "current").length;

/** Official current-semester subject count (defensive for Stats.Live). */
function getCurrentSubjectCount() {
  try { return CURRENT_SUBJECT_COUNT; } catch (e) { return 0; }
}

/* Expose for the AI assistant (assistant.js) and Stats.Live. */
window.PLATFORM_SUBJECTS = SUBJECTS;

/* ---- Render all subject cards from the registry (single source) ---- */
(function renderSubjectsGrid() {
  "use strict";
  const grid = document.getElementById("subjectsGrid");
  if (!grid) return;
  const escS = (v) => escHtml(String(v));

  /* Seeded question counts so cards never show empty badges before
     Stats.Live overwrites them from the live question bank. */
  const COUNT_SEED = { "260210030702": 20, "260210030802": 20, "260210030902": 20, "260210031002": 20, "260210031102": 20 };

  function linksHtml(s) {
    let html = "";
    if (s.contentStatus === "available" && s.quizKey) {
      const n = COUNT_SEED[s.quizKey] || "";
      html += `<a href="#quiz" class="card-link" data-quiz-jump="${escS(s.quizKey)}">بنك الأسئلة <span class="res-count" data-res="${escS(s.quizKey)}">${n}</span></a>`;
    } else {
      html += `<span class="card-link is-soon" title="سيتم إضافة المحتوى قريبًا">بنك الأسئلة</span>`;
    }
    html += `<span class="card-link is-soon" title="سيتم إضافة المحتوى قريبًا">تحميل التجميعات ⬇</span>`;
    html += `<span class="card-link is-soon" title="سيتم إضافة المحتوى قريبًا">الملخصات</span>`;
    return html;
  }

  function descHtml(s) {
    const meta = `رمز المقرر ${escS(s.code)} • ${s.creditHours} ساعات معتمدة • ${escS(s.day)} ${escS(s.startTime)} – ${escS(s.endTime)}`;
    return meta + (s.descriptionAr ? ` — ${escS(s.descriptionAr)}` : "");
  }

  function cardHtml(s) {
    const tags = "current " + s.tag;
    const label = "مادة ";
    return (
      `<article class="work-card reveal tilt" data-subj-code="${escS(s.id)}" data-tags="${escS(tags)}"` +
      (s.quizKey ? ` data-quiz="${escS(s.quizKey)}"` : "") +
      `>` +
      `<div class="work-card-inner">` +
      `<div class="work-thumb" style="--hue: ${s.hue}"><span class="thumb-label">${label}${s.panel}</span>` +
      `<img class="thumb-img" src="${escS(s.icon)}" alt="${escS(s.nameAr)}" onerror="this.onerror=null;this.src='images/icon-maskable.svg'" width="800" height="600" loading="lazy" decoding="async" /></div>` +
      `<div class="work-info">` +
      `<h3>${escS(s.nameAr)} <span class="arrow">↖</span></h3>` +
      `<p>${descHtml(s)}</p>` +
      `<span class="work-year">الترم الحالي</span>` +
      `<div class="card-links">${linksHtml(s)}</div>` +
      `</div>` +
      `</div>` +
      `</article>`
    );
  }

  grid.innerHTML = SUBJECTS.map(cardHtml).join("");
})();

/* ---------- 02a · IdbStore — IndexedDB key/value persistence ------ */
const IdbStore = (() => {
  const DB_NAME = "motmi-portal";
  const STORE = "kv";
  var _db = null;

  /**
   * Open (and memoise) the database, creating the store on first run.
   * @returns {Promise<IDBDatabase>} Resolves with an open connection.
   */
  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("no-idb"));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror = () => reject(req.error || new Error("idb-open-failed"));
    });
  }

  /**
   * Run one operation against the key/value store.
   * @template T
   * @param {"readonly"|"readwrite"} mode Transaction mode.
   * @param {function(IDBObjectStore): IDBRequest} fn Operation factory.
   * @returns {Promise<T>} Request result.
   */
  function tx(mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const t = db.transaction(STORE, mode);
          const req = fn(t.objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        })
    );
  }

  return {
    /** Read a value by key. @param {string} key @returns {Promise<*>} */
    get(key) { return tx("readonly", (s) => s.get(key)); },
    /** Write a value under a key. @param {string} key @param {*} val @returns {Promise<void>} */
    set(key, val) { return tx("readwrite", (s) => s.put(val, key)).then(() => undefined); },
    /** Delete a key. @param {string} key @returns {Promise<void>} */
    del(key) { return tx("readwrite", (s) => s.delete(key)).then(() => undefined); },
    /**
     * One-time migration of legacy quiz data from localStorage.
     * @returns {Promise<void>}
     */
    async migrateFromLocalStorage() {
      try {
        const raw = localStorage.getItem(`${Store.NS}:quiz`);
        if (!raw) return;
        const existing = await this.get("quiz");
        if (!existing) await this.set("quiz", JSON.parse(raw));
        localStorage.removeItem(`${Store.NS}:quiz`);
      } catch {}
    }
  };
})();

/* ---------- 02b · WorkerBridge — offload heavy computation ------ */
const WorkerBridge = (() => {
  var _worker = null;

  /**
   * Lazily create the Web Worker.
   * @returns {Worker|null} Worker instance or null if unsupported.
   */
  function getWorker() {
    if (_worker) return _worker;
    if (!window.Worker || location.protocol === "file:") return null;
    try { _worker = new Worker("./worker.js"); } catch { return null; }
    return _worker;
  }

  /**
   * Send a task to the worker and await its response.
   * @param {string} type Task type ("hash"|"password"|"cidr").
   * @param {*} payload Data for the task.
   * @returns {Promise<*>} Computed result or null if no worker.
   */
  function run(type, payload) {
    var w = getWorker();
    if (!w) return Promise.resolve(null);
    return new Promise(function (resolve, reject) {
      var id = Math.random().toString(36).slice(2, 11);
      var settled = false;
      /**
       * Route worker messages by correlation ID.
       * @param {MessageEvent} e Worker message event.
       * @returns {void}
       */
      function onMsg(e) {
        if (e.data.id !== id) return;
        cleanup();
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.result);
      }
      /** Reject on worker-level failure so callers can fall back. @returns {void} */
      function onErr() {
        cleanup();
        reject(new Error("worker-failed"));
      }
      function cleanup() {
        settled = true;
        w.removeEventListener("message", onMsg);
        w.removeEventListener("error", onErr);
      }
      w.addEventListener("message", onMsg);
      w.addEventListener("error", onErr);
      if (settled) return;
      try {
        w.postMessage({ id: id, type: type, payload: payload });
      } catch (err) {
        /* e.g. the worker was terminated between getWorker() and the
           post — release the listeners and reject so callers can
           fall back to the main thread. */
        cleanup();
        reject(err);
      }
    });
  }

  return { run: run };
})();

/* ---------- 03 · Sfx ---------------------------------------- */
const Sfx = (() => {
  let ctx = null;
  let master = null;
  let enabled = Store.get("sound", true) === true;

  /** Create/resume AudioContext after user gesture. @returns {AudioContext|null} */
  function ensureCtx() {
    if (!enabled) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /**
   * Schedule one tone.
   * @param {number} freq Hz.
   * @param {number} dur Seconds.
   * @param {OscillatorType} type Waveform.
   * @param {number} when Offset seconds.
   * @param {number} vol Volume.
   * @returns {void}
   */
  function tone(freq, dur, type, when = 0, vol = 1) {
    const c = ensureCtx();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime + when);
    g.gain.linearRampToValueAtTime(vol * 0.5, c.currentTime + when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
    o.connect(g).connect(master);
    o.start(c.currentTime + when);
    o.stop(c.currentTime + when + dur + 0.05);
  }

  return {
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; },
    /**
     * Play a named preset.
     * @param {"good"|"bad"|"timeout"|"tick"|"flip"} kind Preset.
     * @returns {void}
     */
    play(kind) {
      switch (kind) {
        case "good": tone(523.25, 0.12, "triangle"); tone(783.99, 0.18, "triangle", 0.09); break;
        case "bad": tone(196, 0.2, "square", 0, 0.55); tone(146.83, 0.28, "square", 0.1, 0.55); break;
        case "timeout": tone(330, 0.14, "sawtooth", 0, 0.45); tone(262, 0.24, "sawtooth", 0.12, 0.45); break;
        case "tick": tone(880, 0.05, "sine", 0, 0.35); break;
        case "flip": tone(659.25, 0.07, "triangle", 0, 0.4); break;
      }
    }
  };
})();

 
 
/* ============================================================
   MODULE 04 · Preloader — boot overlay lifecycle
   ============================================================ */

/** Fade out and remove the preloader overlay. @returns {void} */
function hidePreloader() {
  const pre = $id("preloader");
  if (!pre) return;
  pre.classList.add("is-done");
  setTimeout(() => pre.remove(), 800);
}
window.addEventListener("load", () => setTimeout(hidePreloader, 600));
setTimeout(hidePreloader, 4000); // hard safety net

/* ============================================================
   MODULE 05 · PointerFX — shared pointer + idle-aware rAF loop
   ------------------------------------------------------------
   Cursor / tilt / magnetic modules only record cheap target
   values; one requestAnimationFrame loop applies them and
   pauses itself when nothing is animating (no CPU thrash).
   ============================================================ */
const prefersReducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pointerFine = window.matchMedia("(pointer: fine)").matches;

const pointer = { tx: 0, ty: 0, active: false };
/** Hooks returning true while they still have frame work. */
const renderHooks = [];
const fxLoop = { running: false };

/** Start the shared render loop if idle. @returns {void} */
function startFxLoop() {
  if (fxLoop.running) return;
  fxLoop.running = true;
  requestAnimationFrame(fxTick);
}

/** Run all hooks; keep looping only while work remains. @returns {void} */
function fxTick() {
  let work = false;
  for (let i = 0; i < renderHooks.length; i++) {
    if (renderHooks[i]() === true) work = true;
  }
  if (work) requestAnimationFrame(fxTick);
  else fxLoop.running = false;
}

/**
 * Register a per-frame hook.
 * @param {Function} hook Frame callback; return truthy to continue.
 * @returns {void}
 */
function addRenderHook(hook) { renderHooks.push(hook); }

if (pointerFine && !prefersReducedMotion) {
  window.addEventListener("mousemove", (e) => {
    pointer.tx = e.clientX;
    pointer.ty = e.clientY;
    pointer.active = true;
    startFxLoop();
  }, { passive: true });
}

/* ============================================================
   MODULE 06 · Cursor — custom cursor, JS-gated activation
   ============================================================ */
(function initCursor() {
  const curDot = document.querySelector(".cursor-dot");
  const curRing = document.querySelector(".cursor-ring");
  if (!curDot || !curRing || !pointerFine || prefersReducedMotion) return;

  /* Success → allow CSS to hide the native cursor */
  document.documentElement.setAttribute("data-cursor-active", "true");

  pointer.tx = -100; pointer.ty = -100;
  curDot.style.left = "-100px"; curDot.style.top = "-100px";
  curRing.style.left = "-100px"; curRing.style.top = "-100px";

  let ringX = -100, ringY = -100;

  addRenderHook(() => {
    curDot.style.left = pointer.tx + "px";
    curDot.style.top = pointer.ty + "px";
    ringX += (pointer.tx - ringX) * 0.18;
    ringY += (pointer.ty - ringY) * 0.18;
    curRing.style.left = ringX + "px";
    curRing.style.top = ringY + "px";
    return Math.abs(pointer.tx - ringX) > 0.2 || Math.abs(pointer.ty - ringY) > 0.2;
  });

  $$(".work-card-inner").forEach((el) => {
    el.addEventListener("mouseenter", () => curRing.classList.add("is-hovering"));
    el.addEventListener("mouseleave", () => curRing.classList.remove("is-hovering"));
  });
})(); 
 

/* ============================================================
   MODULES 08-09 · Reveal & navbar · animated counters
   ============================================================ */
(function initRevealAndNav() {
  const nav = $id("nav");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  $$(".reveal").forEach((el) => io.observe(el));

    /** Toggle the navbar's frosted state. On the hero (dark backdrop) the
      nav stays transparent until scrolled > 40px; on all other views the
      light background requires a always-frosted nav for text contrast.
      @returns {void} */
  function onScroll() {
    if (!nav) return;
    const hero = $id("hero");
    const onHero = hero && hero.classList.contains("is-active");
    if (onHero) nav.classList.toggle("is-scrolled", window.scrollY > 40);
    else nav.classList.add("is-scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();

(function initCounters() {
  const els = $$("[data-count]");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.count || "0");
      if (!isFinite(target)) return; /* non-numeric hooks ("questions"…) are owned by Stats.Live */
      const duration = 1400;
      const start = performance.now();
      function tick(now) {
        const t = Math.min((now - start) / duration, 1);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = String(target);
      }
      requestAnimationFrame(tick);
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
})();

/* ============================================================
   MODULE 10 · Mobile menu drawer
   ============================================================ */
(function initMobileMenu() {
  const burger = $id("navBurger");
  const menu = $id("mobileMenu");
  const trap = burger && menu ? createFocusTrap([burger, menu], {
    background: () => $$(".skip-link, .preloader, .cursor-dot, .cursor-ring, .nav-inner > *:not(#navBurger), main, .footer, #toTop, #assistantRoot, #salawatBanner, #onboardingOverlay, #searchOverlay, #searchDialog")
  }) : null;

  /**
   * Open/close the drawer and lock body scrolling.
   * @param {boolean} open Desired state.
   * @returns {void}
   */
  function setMenu(open) {
    if (!menu || !burger) return;
    if (open && anotherOverlayOpen(menu)) return;
    menu.classList.toggle("is-open", open);
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
    menu.setAttribute("aria-hidden", String(!open));
    try { menu.inert = !open; } catch { /* inert is progressive */ }
    if (open) menu.removeAttribute("inert");
    else menu.setAttribute("inert", "");
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      trap.activate();
      /* Move focus into the drawer so keyboard users are not stranded. */
      trap.focusFirst("a, button");
    } else {
      trap.deactivate();
    }
  }

  if (burger && menu) {
    burger.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    /* Escape closes the drawer and returns focus to the burger. */
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !menu.classList.contains("is-open")) return;
      setMenu(false);
      burger.focus({ preventScroll: true });
    });
  }
})();
 
/* ============================================================
   MODULES 11-12 · Tilt / Magnetic effects + Contact form
   ============================================================ */
(function initTilt() {
  if (!pointerFine || prefersReducedMotion) return;
  const MAX_TILT = 7;

  $$(".tilt").forEach((card) => {
    let cx = 0, cy = 0, hovering = false;
    card.addEventListener("mouseenter", () => { hovering = true; startFxLoop(); });
    card.addEventListener("mouseleave", () => { hovering = false; });

    addRenderHook(() => {
      let tx = 0, ty = 0;
      if (hovering) {
        const r = card.getBoundingClientRect();
        tx = (pointer.tx - r.left) / r.width - 0.5;
        ty = (pointer.ty - r.top) / r.height - 0.5;
      }
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      const active = hovering || Math.abs(cx) > 0.001 || Math.abs(cy) > 0.001;
      if (active) {
        card.style.transform =
          `perspective(900px) rotateX(${(-cy * MAX_TILT).toFixed(2)}deg)` +
          ` rotateY(${(cx * MAX_TILT).toFixed(2)}deg) translateY(${hovering ? -5 : 0}px)`;
      } else if (card.style.transform) card.style.transform = "";
      return active;
    });
  });
})();

(function initMagnetic() {
  if (!pointerFine || prefersReducedMotion) return;
  const STRENGTH = 22;

  $$(".magnetic").forEach((btn) => {
    let cx = 0, cy = 0, hovering = false;
    btn.addEventListener("mouseenter", () => { hovering = true; startFxLoop(); });
    btn.addEventListener("mouseleave", () => { hovering = false; });

    addRenderHook(() => {
      let tx = 0, ty = 0;
      if (hovering) {
        const r = btn.getBoundingClientRect();
        tx = ((pointer.tx - (r.left + r.width / 2)) / r.width) * STRENGTH;
        ty = ((pointer.ty - (r.top + r.height / 2)) / r.height) * STRENGTH;
      }
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      const active = hovering || Math.abs(cx) > 0.05 || Math.abs(cy) > 0.05;
      if (active) btn.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      else if (btn.style.transform) btn.style.transform = "";
      return active;
    });
  });
})();

(function initContactForm() {
  const form = $id("contactForm");
  const statusEl = $id("formStatus");
  const submitBtn = form ? form.querySelector(".form-submit") : null;
  if (!form || !statusEl) return;
  const fields = $$("input:not([type=hidden]), select, textarea", form);

  /** In-flight guard — blocks a second submit while a request is open. */
  let sending = false;

  /**
   * Render a status line under the form.
   * @param {string} msg Arabic message.
   * @param {boolean=} isError Error styling flag.
   * @returns {void}
   */
  function showStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", isError);
  }

  /**
   * Toggle the submit button's loading state.
   * @param {boolean} loading True to disable and show progress text.
   * @returns {void}
   */
  function setLoading(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    const label = submitBtn.querySelector(".submit-text") || submitBtn;
    label.textContent = loading ? Lang.t("contact.sending") : Lang.t("contact.submit");
    submitBtn.setAttribute("aria-busy", String(loading));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* Duplicate-submission guard (double click / Enter while in flight). */
    if (sending) return;

    /* Honeypot: silently accept but discard bot submissions. */
    const honeypot = form.querySelector('[name="_gotcha"]');
    if (honeypot && honeypot.value.trim()) return;

    let firstInvalid = null;
    fields.forEach((f) => {
      const g = f.closest(".form-field");
      const bad = !f.checkValidity();
      if (bad && !firstInvalid) firstInvalid = f;
      if (g) g.classList.toggle("has-error", bad);
      f.setAttribute("aria-invalid", bad ? "true" : "false");
    });
    if (!form.checkValidity()) {
      showStatus(Lang.t("contact.invalid"), true);
      if (firstInvalid && typeof firstInvalid.focus === "function") firstInvalid.focus();
      return;
    }

    setLoading(true);
    sending = true;
    const data = Object.fromEntries(new FormData(form));

    try {
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          service: data.service,
          message: data.message,
          _subject: "مساهمة جديدة — منصة أمن المعلومات"
        })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      showStatus(Lang.t("contact.sent"));
      form.reset();
    } catch (err) {
      showStatus(Lang.t("contact.error"), true);
    } finally {
      sending = false;
      setLoading(false);
    }
  });

  fields.forEach((f) => f.addEventListener("input", () => {
    const g = f.closest(".form-field");
    if (g) g.classList.remove("has-error");
    f.setAttribute("aria-invalid", "false");
  }));
})(); 
 
/* ============================================================
   MODULE 13 · QuizEngine — question bank (5 current-semester courses)
   Question shape: { q, ex, opts[4], a, t? (per-question seconds) }
   ============================================================ */
/* ============================================================
   Embedded fallback bank — mirrors data/quizzes.json schema.
   Question shape: { id, subjectId, difficulty, topic, q, ex,
   opts[4], a } (topic doubles as the category label).
   Keyed by the OFFICIAL course codes of the current-semester
   study plan — never by legacy subject keys. Used whenever the
   external file fails or validates empty.
   ============================================================ */
const MOCK_QUIZZES = {
  "260210030702": { name: "الخوارزميات", questions: [
    { id: "algo-001", subjectId: "260210030702", difficulty: "easy", topic: "مفاهيم أساسية", q: "ما المقصود بالخوارزمية؟", opts: ["سلسلة خطوات محددة ومنتهية لحل مشكلة","لغة برمجة عالية المستوى","جهاز لحساب العمليات الحسابية","برنامج لمكافحة الفيروسات"], a: 0, ex: "الخوارزمية سلسلة خطوات محددة ومنتهية لتنفيذ مهمة أو حل مشكلة، وهي مستقلة عن لغة البرمجة." },
    { id: "algo-002", subjectId: "260210030702", difficulty: "easy", topic: "التعقيد الزمني", q: "ماذا يقيس التعقيد الزمني (Time Complexity) للخوارزمية؟", opts: ["عدد أسطر الكود","كيف ينمو زمن التنفيذ مع نمو حجم المدخلات","حجم ملف البرنامج على القرص","عدد الأخطاء البرمجية"], a: 1, ex: "التعقيد الزمني يصف كيف يتغير زمن التنفيذ مع نمو حجم المدخلات (n)، وليس عدد الأسطر ولا حجم الملف." },
    { id: "algo-003", subjectId: "260210030702", difficulty: "easy", topic: "الخوارزميات وتطبيقاتها", q: "ما التعقيد الزمني للبحث الخطي في مصفوفة من n عنصرًا في أسوأ حالة؟", opts: ["O(1)","O(log n)","O(n)","O(n²)"], a: 2, ex: "في أسوأ حالة (العنصر غير موجود أو في النهاية) يفحص البحث الخطي كل العناصر واحدًا تلو الآخر، فيكون التعقيد O(n)." },
  ]},
  "260210030802": { name: "مفاهيم نظم التشغيل", questions: [
    { id: "osys-001", subjectId: "260210030802", difficulty: "easy", topic: "وظائف نظام التشغيل", q: "ما الوظيفة الأساسية لنظام التشغيل؟", opts: ["إدارة موارد الجهاز وتوفير واجهة بين المستخدم والعتاد","تصميم الصور والجرافيك","تشفير رسائل البريد الإلكتروني","استضافة المواقع على الإنترنت"], a: 0, ex: "نظام التشغيل يدير المعالج والذاكرة والأجهزة والملفات، ويوفّر واجهة تتيح للبرامج استخدام العتاد بأمان." },
    { id: "osys-002", subjectId: "260210030802", difficulty: "easy", topic: "العمليات", q: "ما المقصود بالعملية (Process)؟", opts: ["برنامج مخزن على القرص فقط","برنامج قيد التنفيذ مع موارده","ملف إعدادات للنظام","جهاز طرفي متصل بالحاسب"], a: 1, ex: "العملية برنامج قيد التنفيذ وتشمل كودها وذاكرتها وسجلاتها وحالتها؛ البرنامج المخزن ساكن ويصير عملية عند تشغيله." },
    { id: "osys-003", subjectId: "260210030802", difficulty: "easy", topic: "العمليات والخيوط", q: "ما الفرق الجوهري بين العملية والخيط (Thread)؟", opts: ["الخيط أثقل من العملية عند الإنشاء","الخيوط داخل العملية الواحدة تشارك ذاكرتها ومواردها","العملية تشارك ذاكرتها مع كل العمليات","لا فرق بينهما"], a: 1, ex: "الخيوط وحدات تنفيذ داخل العملية تشارك ذاكرتها ومواردها، بينما لكل عملية فضاء ذاكرة مستقل خاص بها." },
  ]},
  "260210030902": { name: "السياسات والتشريعات والأخلاقيات والالتزام بها", questions: [
    { id: "pol-001", subjectId: "260210030902", difficulty: "easy", topic: "مفاهيم أساسية", q: "ما المقصود بسياسة الأمن (Security Policy)؟", opts: ["وثيقة تحدد القواعد والمسؤوليات المطلوبة لحماية أصول المنظمة","برنامج مضاد للفيروسات","جهاز جدار حماية متطور","نسخة احتياطية من البيانات"], a: 0, ex: "سياسة الأمن وثيقة رسمية تحدد ما يجوز وما لا يجوز، والمسؤوليات والعقوبات، بهدف حماية أصول المعلومات." },
    { id: "pol-002", subjectId: "260210030902", difficulty: "easy", topic: "السياسات الأمنية", q: "ما الهدف الأساسي من سياسة كلمات المرور؟", opts: ["إلزام المستخدمين بكلمات مرور قوية وتغييرها دوريًا","منع استخدام الحاسب تمامًا","تسريع تسجيل الدخول","حذف الحسابات القديمة"], a: 0, ex: "تفرض السياسة حدًا أدنى من الطول والتعقيد والتغيير الدوري لتقليل احتمال تخمين كلمات المرور أو كسرها." },
    { id: "pol-003", subjectId: "260210030902", difficulty: "easy", topic: "السياسات الأمنية", q: "ما المقصود بسياسة الاستخدام المقبول (Acceptable Use Policy)؟", opts: ["وثيقة تحدد الاستخدامات الجائزة والممنوعة لموارد المنظمة","عقد توظيف الموظفين","دليل تركيب الأجهزة","قائمة أسعار الخدمات"], a: 0, ex: "توضّح AUP للمستخدم ما يُسمح به عند استخدام الشبكة والأجهزة والبريد الإلكتروني، وما يُمنع، وما يترتب على المخالفة." },
  ]},
  "260210031002": { name: "مكونات أنظمة تقنية المعلومات", questions: [
    { id: "itc-001", subjectId: "260210031002", difficulty: "easy", topic: "مكونات النظام", q: "ما المكونات الأساسية لنظام تقنية المعلومات؟", opts: ["العتاد والبرمجيات والبيانات والشبكات والمستخدمون","المعالج والشاشة فقط","الكابلات والراوترات فقط","البريد الإلكتروني والمتصفح"], a: 0, ex: "نظام تقنية المعلومات يتكامل من عتاد وبرمجيات وبيانات وشبكات وعنصر بشري — وإهمال تأمين أي مكون يُضعف النظام كله." },
    { id: "itc-002", subjectId: "260210031002", difficulty: "easy", topic: "العتاد", q: "ما وظيفة وحدة المعالجة المركزية (CPU)؟", opts: ["تنفيذ التعليمات والعمليات الحسابية والمنطقية","تخزين الملفات نهائيًا","عرض الصور على الشاشة","الاستقبال اللاسلكي للشبكة"], a: 0, ex: "المعالج هو عقل الحاسب: ينفذ التعليمات ويجري العمليات الحسابية والمنطقية ويوجه عمل بقية المكونات." },
    { id: "itc-003", subjectId: "260210031002", difficulty: "easy", topic: "العتاد", q: "ما الفرق الأساسي بين ذاكرة RAM ووحدة التخزين (كالقرص الصلب)؟", opts: ["RAM ذاكرة عمل مؤقتة متطايرة، والتخزين يحفظ البيانات دائمًا","RAM أبطأ من القرص الصلب","التخزين يفقد بياناته عند إطفاء الجهاز","لا فرق بينهما في الوظيفة"], a: 0, ex: "RAM ذاكرة عمل سريعة تفقد محتواها بانقطاع الكهرباء، بينما يحفظ القرص (HDD/SSD) البيانات دائمًا حتى بعد الإطفاء." },
  ]},
  "260210031102": { name: "مبادئ التصميم في الأمن السيبراني", questions: [
    { id: "des-001", subjectId: "260210031102", difficulty: "easy", topic: "مبادئ أساسية", q: "ما المقصود بالدفاع في العمق (Defense in Depth)؟", opts: ["تطبيق عدة طبقات من الضوابط الأمنية بحيث لا يعتمد الأمن على ضابط واحد","وضع جدار حماية واحد قوي","إخفاء أسماء الأنظمة عن المستخدمين","تشفير كلمات المرور فقط"], a: 0, ex: "يبني الدفاع في العمق طبقات متتابعة تقنية وإدارية وبشرية؛ فإذا فشلت طبقة ظلّت الطبقات التالية تحمي النظام." },
    { id: "des-002", subjectId: "260210031102", difficulty: "easy", topic: "مبادئ أساسية", q: "ماذا يعني مبدأ أقل الصلاحيات (Least Privilege)؟", opts: ["منح كل مستخدم أو برنامج أدنى صلاحيات تكفي لإنجاز مهمته","منح الجميع صلاحيات كاملة","منع جميع الصلاحيات نهائيًا","توزيع الصلاحيات عشوائيًا"], a: 0, ex: "يقلل أقل الصلاحيات سطح الهجوم وحدود الضرر: فحتى لو اختُرق الحساب ظل أثره محدودًا بصلاحياته الضيقة." },
    { id: "des-003", subjectId: "260210031102", difficulty: "easy", topic: "المصادقة والتحكم بالوصول", q: "ما الفرق بين المصادقة (Authentication) والتخويل (Authorization)؟", opts: ["المصادقة تثبت الهوية، والتخويل يحدد ما يُسمح لهذه الهوية بفعله","المصادقة تحدد الأذونات والتخويل يثبت الهوية","كلاهما مصطلحان لمعنى واحد","المصادقة للتشفير والتخويل للضغط"], a: 0, ex: "أولًا تُثبت الهوية (كلمة مرور أو بصمة) ثم تُحدد أذوناتها (قراءة/كتابة/إدارة) — تسلسل لا يصح عكسه." },
  ]}
};

var QUIZZES = {};

async function loadQuizData() {
  let data = null;
  try {
    data = await fetchJsonWithRetry("./data/quizzes.json");
  } catch (e) {
    console.warn("Quiz data unavailable — falling back to embedded bank:", e.message);
  }

  /* Empty or failed fetch resolves to the embedded bank seamlessly. */
  const cleaned = sanitizeQuizPayload(data);
  if (Object.keys(cleaned).length > 0) {
    Object.assign(QUIZZES, cleaned);
  } else {
    Object.assign(QUIZZES, MOCK_QUIZZES);
    console.info("Quizzes: using embedded fallback bank.");
  }
  if (app) renderPicks();
  /* The bank just arrived — subject keys in QUIZZES are now resolvable,
     so notify listeners (e.g. HeroContinue) to re-evaluate saved progress. */
  document.dispatchEvent(new CustomEvent("nova:progress-changed"));
}

 
/* ============================================================
   MODULE 13 · QuizEngine — state, persistence & countdown
   ------------------------------------------------------------
   Persistence layer: IndexedDB (via IdbStore) with a write-
   through in-memory cache. Legacy localStorage data migrates
   automatically via IdbStore.migrateFromLocalStorage().
   ============================================================ */
const TIME_PER_Q = 30; // seconds per question in timed mode
let timedMode = Store.get("timed", false) === true;

/** In-memory mirror of the persisted store (deep-cloned on read). */
var quizCache = { results: {}, progress: {} };
/** Set to true after IdbStore loads existing data. */
var cacheReady = false;

let curKey = null;
let curIndex = 0;
let score = 0;
let total = 0;
let answered = false;
/** Per-question outcomes of the current run: "good" | "bad" | "timeout". */
let outcomes = [];

/**
 * Question order for the active run. null = natural order (all
 * questions). Array of question-indexes = filtered run (retry-wrong).
 * @type {number[]|null}
 */
var questionOrder = null;

/** Which view the quiz surface shows ("pick" | "question" | "result"). */
var quizView = "pick";
/** Last computed result payload, kept for locale re-renders. */
var lastResult = null;

/** @type {number|null} */ var timerId = null;
/** @type {number} */ var deadline = 0;
/** Exam-level deadline (ms timestamp) in timed mode. @type {number} */
var examDeadline = 0;
/** Guard flag to prevent double-click on "Show Result" button. @type {boolean} */
var isShowingResult = false;

/**
 * Read a deep clone of the quiz store from the in-memory cache.
 * @returns {{results:Object,progress:Object}} Store snapshot.
 */
function readStore() {
  return JSON.parse(JSON.stringify(quizCache));
}

/* Expose the shared quiz helpers for the top-level modules (MODULE
   43/47/48) that live outside this IIFE's scope. QUIZZES is exposed by
   reference: loadQuizData() mutates the same object, so the alias stays
   in sync. */
window.readStore = readStore;
window.QUIZZES = QUIZZES;
window.startQuiz = startQuiz;

/* Live accessor for the AI assistant (assistant.js reads window.quizCache
   for progress-aware answers). A getter is required because quizCache is
   re-assigned on hydration/write — a plain alias would go stale and the
   assistant would keep answering from an empty store. */
try {
  Object.defineProperty(window, "quizCache", { get: () => quizCache, configurable: true });
} catch (e) { /* older engines: assistant falls back to {} as before */ }

/**
 * Persist the quiz store: update cache immediately, then
 * fire-and-forget an async IndexedDB write.
 * @param {{results?:object,progress?:object}} d Payload.
 * @returns {void}
 */
function writeStore(d) {
  quizCache = JSON.parse(JSON.stringify(d));
  /* Fire-and-forget write; swallow rejections so an IndexedDB
     open/tx error (e.g. storage blocked, versioned DB) can never
     surface as an unhandled promise rejection in the console. */
  IdbStore.set("quiz", d).catch(() => {});
  /* Notify live modules (e.g. HeroContinue) so they refresh the moment
     the store changes. Additive — no behavior change. */
  document.dispatchEvent(new CustomEvent("nova:progress-changed"));
}

/**
 * Remove the saved resume-point for one subject.
 * @param {string} key Subject key.
 * @returns {void}
 */
function clearProgress(key) {
  const d = readStore();
  if (d.progress) { delete d.progress[key]; writeStore(d); }
}

/**
 * Save the current position so reloads can resume mid-quiz.
 * @param {number} nextIdx Next unanswered index.
 * @returns {void}
 */
function saveProgress(nextIdx) {
  if (nextIdx >= total) return;
  /* retry-wrong runs are transient subsets over the bank; a resume
     point tied to questionOrder would be ambiguous, so skip it. */
  if (questionOrder) return;
  const d = readStore();
  d.progress = d.progress || {};
  d.progress[curKey] = { idx: nextIdx, score, total };
  writeStore(d);
}

/** Halt any running countdown. @returns {void} */
function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

/**
 * Clear all transient quiz state so every subject is selectable again.
 * Persisted results are intentionally kept.
 * @returns {void}
 */
function resetEngineState() {
  stopTimer();
  questionOrder = null;
  curKey = null;
  curIndex = 0;
  score = 0;
  total = 0;
  answered = false;
  outcomes = [];
  examDeadline = 0;
  isShowingResult = false;
}

/** Start per-question countdown in timed mode. @returns {void} */
function startTimer() {
  stopTimer();
  if (!timedMode) return;
  /* Per-question override (q.t seconds), falling back to TIME_PER_Q. */
  var qSecs = Number(current().t) > 0 ? Number(current().t) : TIME_PER_Q;
  deadline = Date.now() + qSecs * 1000;
  /* Set the overall exam deadline on the first question of an exam run. */
  if (!examDeadline || curIndex === 0) {
    examDeadline = Date.now() + total * TIME_PER_Q * 1000;
  }

  const tick = () => {
    var remain = Math.max(0, deadline - Date.now());
    var frac = remain / (qSecs * 1000);
    var fill = app.querySelector(".q-timer-fill");
    if (fill) fill.style.width = (frac * 100).toFixed(1) + "%";
    var bar = app.querySelector(".q-timer");
    if (bar) bar.classList.toggle("is-low", frac <= 0.25);
    var tEl = app.querySelector("#qTimerText");
    if (tEl) tEl.textContent = "\u23F1 " + Math.ceil(remain / 1000) + " \u062B";
    /* Exam timer display. */
    var examEl = app.querySelector("#qExamTimer");
    if (examEl) {
      var exR = Math.max(0, examDeadline - Date.now());
      var em = Math.floor(exR / 60000);
      var es = Math.floor((exR % 60000) / 1000);
      examEl.textContent = (em < 10 ? "0" : "") + em + ":" + (es < 10 ? "0" : "") + es;
      examEl.classList.toggle("is-low", exR <= 30000);
    }
    if (remain <= 0) timeoutAnswer();
    /* Exam time expired — auto-submit. */
    else if (Date.now() >= examDeadline) showResult();
  };
  tick();
  timerId = setInterval(tick, 150);
}

/**
 * Escape HTML-significant characters (quiz alias).
 * @param {string} s Raw text.
 * @returns {string} Escaped text.
 */
function esc(s) { return escHtml(s); }

/* MODULE 13a · MissedBank — localStorage persistence for missed questions */
const MissedBank = {
  KEY: "missed",
  read() {
    try {
      const v = Store.get(MissedBank.KEY, null);
      return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
    } catch { return {}; }
  },
  write(obj) { try { Store.set(MissedBank.KEY, obj); } catch {} },
  idOf(k, i) { return k + ":" + i; },
  add(k, i) { const l = MissedBank.read(); l[MissedBank.idOf(k, i)] = Date.now(); MissedBank.write(l); },
  remove(k, i) { const l = MissedBank.read(); const id = MissedBank.idOf(k, i); if (id in l) { delete l[id]; MissedBank.write(l); } },
  forSubject(k) { const l = MissedBank.read(); const p = k + ":"; return Object.keys(l).filter((id) => id.indexOf(p) === 0).map((id) => parseInt(id.slice(p.length), 10)).filter((qi) => Number.isInteger(qi) && qi >= 0).sort((a, b) => a - b); },
  countForSubject(k) { return MissedBank.forSubject(k).length; },
  prune() { const l = MissedBank.read(); const ks = Object.keys(l); if (!ks.length) return; let ch = false; ks.forEach((id) => { const ps = id.split(":"); const idx = parseInt(ps[ps.length - 1], 10); const k = ps.slice(0, -1).join(":"); const b = QUIZZES[k]; if (!b || !b.questions || idx >= b.questions.length) { delete l[id]; ch = true; } }); if (ch) MissedBank.write(l); }
};

/** Quiz UI mount point. @type {HTMLElement|null} */
const app = $id("quizApp"); 
 
/**
 * Render the subject picker with badges, mode switch and clear action.
 * @returns {void}
 */
function renderPicks() {
  quizView = "pick";
  const data = readStore();
  const results = data.results || {};
  const progress = data.progress || {};
  const keys = Object.keys(QUIZZES);
  const hasData = Object.keys(results).length > 0 || Object.keys(progress).length > 0;
  const noBank = keys.length === 0; /* quiz data not loaded (yet) */

  const chips = keys.map((k) => {
    const best = results[k];
    const res = progress[k] && progress[k].idx > 0 && progress[k].idx < progress[k].total;
    const missedCount = MissedBank.countForSubject(k);
    return (
      `<button type="button" class="q-pick" data-sub="${esc(k)}"${res ? ' data-resume="1"' : ""}>` +
      `${esc(QUIZZES[k].name)}` +
      (best ? `<span class="q-best">${esc(Lang.qt("best", { pct: best.pct }))}</span>` : "") +
      (res ? `<span class="q-resume">${esc(Lang.qt("resume"))}</span>` : "") +
      (missedCount ? `<span class="q-missed">${missedCount} خطأ</span>` : "") +
      "</button>"
    );
  }).join("");

  const picksHtml = noBank
    ? '<div class="q-data-error" role="alert">' +
      `<p>${esc(Lang.qt("dataError"))}</p>` +
      `<button type="button" class="btn btn-sm btn-primary" id="qRetry">${esc(Lang.qt("retry"))}</button>` +
      "</div>"
    : '<div class="q-subject-picks">' + chips + "</div>";

  const modeRow = noBank
    ? ""
    : '<div class="q-mode-row">' +
      '<div class="q-mode-selector" role="group" aria-label="' + esc(Lang.qt("modePractice")) + '">' +
      `<button type="button" class="q-mode-btn${timedMode ? "" : " is-active"}" data-mode="practice" aria-pressed="${timedMode ? "false" : "true"}">${esc(Lang.qt("modePractice"))}</button>` +
      `<button type="button" class="q-mode-btn${timedMode ? " is-active" : ""}" data-mode="exam" aria-pressed="${timedMode ? "true" : "false"}">${esc(Lang.qt("modeExam"))}</button>` +
      "</div>" +
      (hasData
        ? `<button type="button" class="btn btn-ghost btn-sm q-clear" id="qClear">${esc(Lang.qt("clear"))}</button>`
        : "") +
      "</div>" +
      `<p class="q-feedback" role="status">${esc(Lang.qt("pickPrompt"))}</p>`;

  app.innerHTML = picksHtml + modeRow;

  /* Interactions are handled by the delegated listeners bound once in
     bindQuizDelegation() — no per-render binding, so buttons can never
     end up dead after a re-render. */
}

/**
 * Start (or resume) a quiz for one subject.
 * @param {string} key Subject key.
 * @param {boolean=} resume Resume from saved progress when valid.
 * @returns {void}
 */
function startQuiz(key, resume = false, filter) {
  /* Guard: reject unknown keys (tampered DOM/data) instead of crashing. */
  const bank = QUIZZES[key];
  if (!bank || !Array.isArray(bank.questions) || bank.questions.length === 0) return;
  curKey = key;
  /* Retry-wrong: run only the supplied question indexes.
     The filtered run is traversed in position (curIndex) order;
     current() maps the position through questionOrder. */
  let ord;
  if (Array.isArray(filter) && filter.length) {
    ord = filter.map(Number).filter((qi) => Number.isInteger(qi) && qi >= 0 && qi < bank.questions.length);
    if (!ord.length) ord = bank.questions.map((_, i) => i);
  } else {
    ord = bank.questions.map((_, i) => i);
  }
  /* Exam mode: randomize the question order on every attempt. */
  if (timedMode && ord.length > 1) {
    for (let i = ord.length - 1; i > 0; i--) {
      const jx = Math.floor(Math.random() * (i + 1));
      const tmp = ord[i]; ord[i] = ord[jx]; ord[jx] = tmp;
    }
  }
  questionOrder = (timedMode || Array.isArray(filter)) ? ord : null;
  total = questionOrder ? questionOrder.length : bank.questions.length;
  const p = resume ? (readStore().progress || {})[key] : null;

  /* Exam runs always start fresh. */
  if (!timedMode && p && p.idx > 0 && p.idx < total && p.total === total) {
    curIndex = p.idx;
    score = p.score || 0;
    showQuestion(Lang.qt("resumed", { i: curIndex + 1, total }));
  } else {
    curIndex = 0;
    score = 0;
    outcomes = []; /* fresh run → reset the per-question breakdown */
    clearProgress(key);
    showQuestion();
  }
}

/**
 * Current question object for the active subject.
 * @returns {{q:string,ex:string,opts:string[],a:number}} Question.
 */
function current() {
  const qs = QUIZZES[curKey].questions;
  return qs[questionOrder ? questionOrder[curIndex] : curIndex];
}

/**
 * Render one question: top bar, timers, ARIA-wired options, actions.
 * @param {string=} resumeNote Optional banner shown after resuming.
 * @returns {void}
 */
function showQuestion(resumeNote) {
  quizView = "question";
  const q = current();
  answered = false;
  stopTimer();
  const pct = Math.round((curIndex / total) * 100);
  const optsHtml = q.opts
    .map((opt, i) => `<button type="button" class="q-option" data-i="${i}">${esc(opt)}</button>`)
    .join("");
  const timerBar = timedMode
    ? '<div class="q-timer" role="timer" aria-label="الوقت المتبقي لهذا السؤال"><div class="q-timer-fill" style="width:100%"></div></div>'
    : "";
  const timerText = timedMode
    ? '<span class="q-timer-text" id="qTimerText" role="timer"></span>'
    : "";

  const modeBadge = `<span class="q-mode-badge ${timedMode ? "is-exam" : "is-practice"}">${esc(Lang.qt(timedMode ? "modeBadgeExam" : "modeBadgePractice"))}</span>`;
  app.innerHTML =
    '<div class="q-top-bar">' +
    `<span class="q-subject-title">${esc(QUIZZES[curKey].name)}</span>` +
    modeBadge +
    (timedMode ? '<span class="q-exam-timer" id="qExamTimer" role="timer" aria-label="الوقت المتبقي للاختبار">00:00</span>' : "") +
    `<span class="q-count">${esc(Lang.qt("count", { i: curIndex + 1, total }))}</span>` +
    `<span class="q-score">${esc(Lang.qt("score", { n: score }))}</span>` +
    timerText +
    "</div>" +
    timerBar +
    `<div class="q-progress"><div class="q-progress-fill" style="width:${pct}%"></div></div>` +
    (resumeNote ? `<p class="q-note">${esc(resumeNote)}</p>` : "") +
    `<h3 class="q-question" id="qQ" tabindex="-1">${esc(q.q)}</h3>` +
    `<div class="q-options" role="group" aria-labelledby="qQ">${optsHtml}</div>` +
    '<p class="q-feedback" id="qFeedback" role="status"></p>' +
    `<div class="q-actions"><button type="button" class="btn btn-ghost" id="qRestart">${esc(Lang.qt("restartSubject"))}</button></div>`;

  /* Move focus to the new question so keyboard and screen-reader users do not
     have to rediscover where the replaced content begins. */
  const questionHeading = app.querySelector("#qQ");
  if (questionHeading) questionHeading.focus({ preventScroll: true });

  /* Option + restart clicks are handled by the delegated listeners. */
  startTimer();
} 
 
/**
 * Grade a clicked option and finish the question.
 * @param {number} i Chosen option index.
 * @returns {void}
 */
function handleAnswer(i) {
  if (answered) return;
  answered = true;
  stopTimer();
  const q = current();
  const correct = q.a === i;
  if (correct) score++;
  Sfx.play(correct ? "good" : "bad");

  const opts = $$(".q-option", app);
  opts.forEach((b) => b.setAttribute("disabled", ""));
  /* Exam mode suppresses correct/incorrect highlighting. */
  if (!timedMode) {
    opts[q.a].classList.add("is-correct");
    if (!correct) opts[i].classList.add("is-wrong");
  }
  /* Record into the missed bank. */
  const qi = questionOrder ? questionOrder[curIndex] : curIndex;
  if (correct) MissedBank.remove(curKey, qi);
  else MissedBank.add(curKey, qi);

  finishQuestion(correct, i);
}

/** Time expired: reveal the correct answer without scoring. @returns {void} */
function timeoutAnswer() {
  stopTimer();
  if (answered) return;
  answered = true;
  if (!timedMode) Sfx.play("timeout");
  const q = current();
  const opts = $$(".q-option", app);
  opts.forEach((b) => b.setAttribute("disabled", ""));
  if (!timedMode) opts[q.a].classList.add("is-correct");
  /* Record timeout into the missed bank. */
  const qi = questionOrder ? questionOrder[curIndex] : curIndex;
  MissedBank.add(curKey, qi);
  finishQuestion(null, null);
}

/**
 * Shared tail: feedback, explanation drawer, persistence, next button.
 * @param {boolean|null} correct Null when the question timed out.
 * @param {number|null} chosenIdx Chosen index (null on timeout).
 * @returns {void}
 */
function finishQuestion(correct, chosenIdx) {
  const q = current();
  const fb = app.querySelector("#qFeedback");

  /* Track this question's outcome for the result-screen breakdown. */
  outcomes.push(correct === null ? "timeout" : (correct ? "good" : "bad"));

  if (timedMode) {
    fb.className = "q-feedback is-exam";
    fb.textContent = "تم تسجيل إجابتك";
  } else if (correct === null) {
    fb.className = "q-feedback is-timeout";
    fb.textContent = Lang.qt("timeout", { ans: q.opts[q.a] });
  } else {
    fb.className = correct ? "q-feedback is-good" : "q-feedback is-bad";
    fb.textContent = correct
      ? Lang.qt("correct")
      : Lang.qt("wrong", { ans: q.opts[q.a] });
  }

  app.querySelector(".q-progress-fill").style.width =
    Math.round(((curIndex + 1) / total) * 100) + "%";
  app.querySelector(".q-score").textContent = Lang.qt("score", { n: score });
  const qCount = app.querySelector(".q-count");
  if (qCount) qCount.textContent = Lang.qt("count", { i: curIndex + 1, total });

  /* Explanation drawer — suppress during exam; auto-open on wrong/timeout answers */
  if (q.ex && !timedMode) {
    const wrongPick = chosenIdx !== null && chosenIdx !== q.a;
    const openAttr = correct === null || wrongPick ? " open" : "";
    fb.insertAdjacentHTML(
      "afterend",
      `<details class="q-explain"${openAttr}><summary>${esc(Lang.qt("explain"))}</summary><p>${esc(q.ex)}</p></details>`
    );
  }

  saveProgress(curIndex + 1);

  const isLast = curIndex + 1 >= total;
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.id = "qNext";
  nextBtn.className = "btn btn-primary";
  nextBtn.textContent = isLast ? Lang.qt("showResult") : Lang.qt("next");
  /* Advance/result handled by the delegated #qNext listener. */
  app.querySelector(".q-actions").appendChild(nextBtn);
  nextBtn.focus({ preventScroll: true });
}

/**
 * Render the final score, persist the attempt (best kept), clear progress.
 * @returns {void}
 */
function showResult() {
  /* Guard: prevent double-click / re-entry once the result is rendered. */
  if (isShowingResult || quizView === "result") return;
  isShowingResult = true;
  stopTimer();
  /* Guard: a zero-length quiz cannot be scored — bail out cleanly. */
  if (!total || total <= 0) { isShowingResult = false; return; }
  /* Guard: ensure the quiz bank is still loaded. */
  if (!curKey || !QUIZZES[curKey]) { isShowingResult = false; return; }

  try {
    const pct = Math.round((score / total) * 100);

    const d = readStore();
    const prevBest = d.results && d.results[curKey] ? d.results[curKey].pct : 0;
    d.results = d.results || {};
    d.results[curKey] = {
      score,
      total,
      pct: Math.max(prevBest, pct),
      last: pct,
      date: new Date().toISOString().slice(0, 10)
    };
    if (d.progress) delete d.progress[curKey];
    writeStore(d);
    /* Genuine quiz completion — idempotent per bank (retakes never farm XP). */
    awardMotivation("quiz", curKey);

    /* Track wrong/timed-out question indices for the retry feature.
       The run position maps through questionOrder (null = natural), so
       wrongIndices always holds ORIGINAL bank question indexes — safe
       to replay via startQuiz(key, false, wrongIndices) even on a
       second retry over a filtered subset. */
    const questions = QUIZZES[curKey].questions || [];
    const ord = questionOrder || questions.map((_, i) => i);
    const wrongIndices = [];
    /* wrongList pairs each missed question's ORIGINAL bank index with its
       outcome ("bad"|"timeout") so the result screen can render a deferred
       explanation review (exam mode hides between-question explanations). */
    const wrongList = [];
    outcomes.forEach((o, i) => {
      if (o !== "good") {
        wrongIndices.push(ord[i]);
        wrongList.push({ qi: ord[i], o: o });
      }
    });

    /* Compute per-category breakdown from question cat field. */
    const catStats = {};
    ord.forEach((qi, i) => {
      const q = questions[qi];
      if (!q) return;
      const cat = q.cat || "general";
      catStats[cat] = catStats[cat] || { ok: 0, n: 0 };
      catStats[cat].n++;
      if (outcomes[i] === "good") catStats[cat].ok++;
    });

    /* Keep the payload so a locale switch can re-render this view. */
    lastResult = { key: curKey, score, total, pct, prevBest, outcomes: outcomes.slice(), wrongIndices, wrongList, catStats };
    renderResult();
  } catch (err) {
    /* Never leave the flag locked on error — allow retry. */
    isShowingResult = false;
    console.error("showResult failed:", err);
  }
}

/**
 * Render the result screen from the stored payload (pure DOM work,
 * no persistence side effects — safe to call on locale switches).
 * @returns {void}
 */
function renderResult() {
  quizView = "result";
  const { key, score: s, total: tt, pct, prevBest, outcomes: oc, wrongIndices, wrongList, catStats } = lastResult;
  const newRecord = !prevBest || pct > prevBest;
  const note =
    pct >= 80 ? Lang.qt("noteHi")
    : pct >= 60 ? Lang.qt("noteMid")
    : Lang.qt("noteLo");

  /* Answer breakdown. On a resumed session the questions answered before
     the reload have no recorded outcome — surfaced honestly as "غير محسوبة". */
  let breakdownHtml = "";
  if (Array.isArray(oc)) {
    const good = oc.filter((o) => o === "good").length;
    const bad = oc.filter((o) => o === "bad").length;
    const timedOut = oc.filter((o) => o === "timeout").length;
    const unknown = Math.max(0, tt - oc.length);
    const chip = (cls, n, label) =>
      '<span class="q-chip ' + cls + '"><b>' + n + "</b>" + esc(label) + "</span>";
    breakdownHtml =
      '<div class="q-result-stats" role="list" aria-label="' + esc(Lang.qt("resBreakdown")) + '">' +
      chip("is-good", good, Lang.qt("resGood")) +
      chip("is-bad", bad, Lang.qt("resBad")) +
      (timedOut ? chip("is-timeout", timedOut, Lang.qt("resTimeout")) : "") +
      (unknown ? chip("is-unknown", unknown, Lang.qt("resUnknown")) : "") +
      "</div>";
  }

  /* Per-category breakdown — shows strength/weakness by topic. */
  let catHtml = "";
  if (catStats && Object.keys(catStats).length > 0) {
    const curLang = Lang.current || "ar";
    /* QUIZ_CATS lives inside the MODULE 40 IIFE (declared further below) and
       is published on `window` there. Read it defensively: a missing map
       degrades to raw category keys instead of killing the result render. */
    const CATS = window.QUIZ_CATS || {};
    const catItems = Object.keys(catStats).map((cat) => {
      const st = catStats[cat];
      const catName = (CATS[cat] && (CATS[cat][curLang] || CATS[cat].ar)) || cat;
      return '<span class="q-chip"><b>' + st.ok + '/' + st.n + "</b> " + esc(catName) + "</span>";
    }).join("");
    catHtml = '<div class="q-result-stats q-cat-breakdown" role="list" aria-label="' + esc(Lang.qt("catBreakdown")) + '">' + catItems + "</div>";
  }

  /* Deferred review (exam mode): between-question explanations stay hidden
     during a timed run, so the full explanation for every missed answer is
     shown here instead. Practice mode already explains after each answer. */
  let reviewHtml = "";
  if (wrongList && wrongList.length > 0) {
    const qs = (QUIZZES[key] && QUIZZES[key].questions) || [];
    const items = wrongList.map((w) => {
      const q = qs[w.qi];
      if (!q) return "";
      const ans = q.opts && q.opts[q.a] != null ? q.opts[q.a] : "";
      const head = w.o === "timeout"
        ? esc(Lang.qt("timeout", { ans: ans }))
        : esc(Lang.qt("wrong", { ans: ans }));
      return '<li class="q-review-item"><p class="q-review-q">' + esc(q.q || "") + "</p><p>" + head + "</p>" +
        (q.ex
          ? '<details class="q-explain" open><summary>' + esc(Lang.qt("explain")) + "</summary><p>" + esc(q.ex) + "</p></details>"
          : "") +
        "</li>";
    }).join("");
    if (items) {
      reviewHtml = '<section class="q-review" aria-label="' + esc(Lang.qt("reviewTitle")) + '"><h4>' + esc(Lang.qt("reviewTitle")) + '</h4><ul class="q-review-list">' + items + "</ul></section>";
    }
  }

  /* Retry-incorrect button — only when there are wrong/timed-out answers. */
  let retryHtml = "";
  if (wrongIndices && wrongIndices.length > 0) {
    retryHtml = `<button type="button" class="btn btn-ghost" id="qRetryWrong">${esc(Lang.qt("retryWrong"))}</button>`;
  }

  /* Continue-learning link — back to the owning learning path.
     SUBJECT_TO_PATH lives inside the MODULE 40 IIFE (below) and is
     published on `window` there; resolve defensively. */
  let continueHtml = "";
  const ownerPath = (window.SUBJECT_TO_PATH || {})[key];
  if (ownerPath) {
    continueHtml = `<a href="#path/${ownerPath}" class="btn btn-primary q-continue-link">${esc(Lang.qt("continueLearn"))} →</a>`;
  }

  const subjectName = (QUIZZES[key] && QUIZZES[key].name) || key;
  app.innerHTML =
    '<div class="q-result">' +
    `<div class="q-result-score-wrap"><div class="q-result-score" role="status">${s}/${tt}</div></div>` +
    `<p class="q-result-label">${esc(Lang.qt("resultIn", { sub: subjectName }))}${timedMode ? esc(Lang.qt("timedSuffix")) : ""}</p>` +
    `<p class="q-result-note">${esc(note)}</p>` +
    breakdownHtml +
    catHtml +
    reviewHtml +
    `<p class="q-result-label">${esc(Lang.qt("bestSaved", { pct: Math.max(prevBest, pct) }))}${newRecord ? esc(Lang.qt("newRec")) : ""}</p>` +
    "</div>" +
    '<div class="q-actions">' +
    retryHtml +
    `<button type="button" class="btn btn-ghost" id="qAgain">${esc(Lang.qt("retake"))}</button>` +
    `<button type="button" class="btn btn-ghost" id="qPick">${esc(Lang.qt("pickOther"))}</button>` +
    continueHtml +
    "</div>";
  /* #qRetryWrong / #qAgain / #qPick clicks are handled by the delegated listeners. */
}

/**
 * Bind ONE delegated click/change pair on the quiz mount. Because
 * #quizApp itself is never replaced (only its innerHTML), these
 * survive every re-render — including the result screen — so the
 * retake / choose-subject buttons can never end up dead.
 * @returns {void}
 */
function bindQuizDelegation() {
  if (!app || app.dataset.qDelegated === "1") return;
  app.dataset.qDelegated = "1";

  /* ONE delegated click listener per quiz mount — every branch below
     guards on its own selector. Registering a second listener made
     each click traverse two handlers; mode toggles now live here too. */
  app.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;

    const modeBtn = t.closest(".q-mode-btn");
    if (modeBtn) {
      const newMode = modeBtn.dataset.mode === "exam";
      if (newMode !== timedMode) {
        timedMode = newMode;
        Store.set("timed", timedMode);
        renderPicks();
      }
      return;
    }

    const pick = t.closest(".q-pick");
    if (pick) {
      const sub = pick.dataset.sub;
      /* Re-test missed questions for this subject when available. */
      const missed = MissedBank.forSubject(sub);
      if (missed.length) { startQuiz(sub, false, missed); return; }
      startQuiz(sub, pick.dataset.resume === "1");
      return;
    }

    if (t.closest("#qAgain")) {
      const key = curKey;
      resetEngineState();
      startQuiz(key, false);
      return;
    }
    if (t.closest("#qPick")) {
      resetEngineState();
      renderPicks();
      app.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start"
      });
      return;
    }
    if (t.closest("#qNext")) {
      if (curIndex + 1 >= total) showResult();
      else { curIndex++; showQuestion(); }
      return;
    }
    if (t.closest("#qRestart")) { startQuiz(curKey, false); return; }
    if (t.closest("#qRetry")) { loadQuizData(); return; }
    if (t.closest("#qClear")) { clearQuizData(); return; }
    if (t.closest("#qRetryWrong")) { startQuiz(curKey, false, lastResult.wrongIndices); return; }

    const opt = t.closest(".q-option");
    if (opt && !opt.hasAttribute("disabled")) {
      Sfx.play("tick");
      handleAnswer(parseInt(opt.dataset.i, 10));
    }
  });
}

/** Wipe saved quiz data and repaint the picker. @returns {Promise<void>} */
async function clearQuizData() {
  try { await IdbStore.del("quiz"); } catch {}
  quizCache = { results: {}, progress: {} };
  renderPicks();
}

/* Merge topic lessons from data/lessons.json into LESSONS. */
async function loadLessonData() {
  let data = null;
  try { data = await fetchJsonWithRetry("./data/lessons.json"); }
  catch (e) { console.warn("Lesson data unavailable:", e.message); return; }
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  let merged = 0;
  Object.keys(data).forEach((sk) => {
    const topics = data[sk];
    if (!topics || typeof topics !== "object" || Array.isArray(topics)) return;
    if (!LESSONS[sk] || typeof LESSONS[sk] !== "object") LESSONS[sk] = {};
    Object.keys(topics).forEach((tk) => {
      const L = topics[tk];
      if (L && typeof L === "object" && L.title && L.title.ar && L.explanation && L.explanation.ar) { LESSONS[sk][tk] = L; merged++; }
    });
  });
  if (merged > 0) console.info("Lessons: merged " + merged + " topic(s).");
}

/* Bootstrap the quiz UI only if its mount point exists. */
/* Bootstrap the quiz UI only if its mount point exists. */
(async function bootQuiz() {
  if (!app) return;
  bindQuizDelegation();
  try { await IdbStore.migrateFromLocalStorage(); } catch {}
  try {
    const saved = await IdbStore.get("quiz");
    if (saved && typeof saved === "object") {
      const r = (saved.results && typeof saved.results === "object") ? saved.results : {};
      const p = (saved.progress && typeof saved.progress === "object") ? saved.progress : {};
      const cleanProgress = {};
      Object.keys(p).forEach((k) => {
        const e = p[k];
        if (e && typeof e === "object"
            && typeof e.idx === "number" && e.idx >= 0
            && typeof e.total === "number" && e.total > 0
            && typeof e.score === "number" && e.score >= 0
            && e.idx < e.total) {
          cleanProgress[k] = { idx: e.idx, score: e.score, total: e.total };
        }
      });
      quizCache = { results: r, progress: cleanProgress };
    }
  } catch {}
  cacheReady = true;
  renderPicks();
  /* Saved data just hydrated into quizCache — notify listeners (e.g.
     HeroContinue) so the homepage continue-card paints on first load,
     not only after the next store write or view switch. */
  document.dispatchEvent(new CustomEvent("nova:progress-changed"));
  loadQuizData();
  loadLessonData();
  MissedBank.prune();

  /* Live locale switching for the picker / result screens. A question
     in progress keeps its language until the next render (by design). */
  Lang.onSwitch(() => {
    if (!app) return;
    if (quizView === "pick") renderPicks();
    else if (quizView === "result" && lastResult) renderResult();
  });
})(); 
 
/* ============================================================
   MODULE 14 · Tools.Hash — SHA-256 generator & fingerprint
   ============================================================ */
(function initHashTool() {
  const input = $id("hashInput");
  const out = $id("hashOut");
  const fp = $id("hashFp");
  const copyBtn = $id("hashCopy");
  if (!input || !out) return;

  /**
   * Compute a SHA-256 hex digest via Web Crypto, with an FNV-1a×4
   * fallback that is ALWAYS labeled as a fallback, never shown as SHA-256.
   * @param {string} text Input text.
   * @returns {Promise<string>} Hex digest or FNV-1a×4 fallback string.
   */
  async function sha256Hex(text) {
    if (window.crypto && window.crypto.subtle && crypto.subtle.digest) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch (err) {
        console.warn("[Tools.Hash] Web Crypto SHA-256 failed:", err && err.message);
      }
    }
    // Web Crypto unavailable or failed — do NOT pretend this is SHA-256.
    return "FNV-1a×4-FALLBACK:" + fnv1a32x4(text);
  }

  /**
   * FNV-1a×4 fallback used only when Web Crypto is unavailable.
   * Returns 4 concatenated 32-bit FNV-1a fingerprints as hex.
   * This is NOT a cryptographic hash and is NOT SHA-256.
   * @param {string} text
   * @returns {string} hex fingerprint
   */
  function fnv1a32x4(text) {
    let out = "";
    for (let r = 0; r < 4; r++) {
      let h = (0x811c9dc5 ^ Math.imul(r + 1, 0x9e3779b9)) >>> 0;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i) + r;
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      out += h.toString(16).padStart(8, "0");
    }
    return out;
  }

  /**
   * Render the hash as a colored fingerprint grid (2 hex digits/cell).
   * @param {string} hex Hex digest.
   * @returns {void}
   */
  function visualize(hex) {
    if (!fp) return;
    const cells = [];
    for (let i = 0; i < hex.length; i += 2) {
      const b = parseInt(hex.slice(i, i + 2), 16);
      if (Number.isNaN(b)) {
        cells.push(`<i style="background:#334155"></i>`);
        continue;
      }
      cells.push(
        `<i style="background:hsl(${b % 360} 85% ${28 + (b % 35)}%);animation-delay:${(i / 2) * 8}ms"></i>`
      );
    }
    fp.innerHTML = cells.join("");
  }

  /**
   * Render a fallback fingerprint (FNV-1a×4) without pretending it is SHA-256.
   * @param {string} fallback Hex string with the FNV prefix removed.
   * @returns {void}
   */
  function visualizeFallback(fallback) {
    if (!fp) return;
    const hex = fallback.replace(/^FNV-1a×4-FALLBACK:/, "");
    const cells = [];
    for (let i = 0; i < hex.length; i += 2) {
      const b = parseInt(hex.slice(i, i + 2), 16);
      if (Number.isNaN(b)) {
        cells.push(`<i style="background:#334155"></i>`);
        continue;
      }
      cells.push(
        `<i style="background:hsl(${b % 360} 85% ${28 + (b % 35)}%);animation-delay:${(i / 2) * 8}ms"></i>`
      );
    }
    fp.innerHTML = cells.join("");
  }

  const run = debounce(async () => {
    if (!input.value) { out.textContent = "—"; if (fp) fp.innerHTML = ""; return; }
    try {
      const hex = await sha256Hex(input.value);
      out.textContent = hex;
      if (hex.startsWith("FNV-1a×4-FALLBACK:")) {
        // Never display the FNV fallback as if it were SHA-256.
        out.classList.add("is-fallback");
        visualizeFallback(hex);
      } else {
        out.classList.remove("is-fallback");
        visualize(hex);
      }
    } catch { out.textContent = "تعذّر توليد البصمة في هذا المتصفح."; }
  }, 150);

  input.addEventListener("input", run);

  if (copyBtn) copyBtn.addEventListener("click", async () => {
    if (!out.textContent || out.textContent === "—") return;
    try {
      await navigator.clipboard.writeText(out.textContent);
      copyBtn.textContent = "تم النسخ ✓";
      setTimeout(() => { copyBtn.textContent = "نسخ البصمة"; }, 1500);
    } catch {}
  });
})(); 
 
/* ============================================================
   MODULE 15 · Tools.Caesar — Arabic/Latin shift cipher
   ============================================================ */
(function initCaesarTool() {
  const cIn = $id("cipherIn");
  const cOut = $id("cipherOut");
  const range = $id("shiftRange");
  const val = $id("shiftVal");
  if (!cIn || !cOut || !range || !val) return;

  const AR = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي";
  const EN = "abcdefghijklmnopqrstuvwxyz";

  /**
   * Wrap a shifted alphabet index into [0, len), supporting negative shifts.
   * @param {number} i Shifted index.
   * @param {number} len Alphabet length.
   * @returns {number} Normalised index.
   */
  function wrapIdx(i, len) { return ((i % len) + len) % len; }

  /**
   * Shift Arabic/Latin letters by k positions; others pass through.
   * @param {string} text Source text.
   * @param {number} k Shift amount.
   * @returns {string} Transformed text.
   */
  function shiftText(text, k) {
    return [...text].map((ch) => {
      const ai = AR.indexOf(ch);
      if (ai > -1) return AR[wrapIdx(ai + k, AR.length)];
      const lower = ch.toLowerCase();
      const ei = EN.indexOf(lower);
      if (ei > -1) {
        const s = EN[wrapIdx(ei + k, 26)];
        return ch === lower ? s : s.toUpperCase();
      }
      return ch;
    }).join("");
  }

  /** Recompute output from current input and shift. @returns {void} */
  function runCipher() {
    const k = parseInt(range.value, 10);
    val.textContent = String(k);
    cOut.textContent = cIn.value ? shiftText(cIn.value, k) : "—";
  }

  cIn.addEventListener("input", runCipher);
  range.addEventListener("input", runCipher);
  runCipher();

  /* Copy-to-clipboard with transient "تم النسخ" feedback (parity with
     the hash tool; silently ignored when the clipboard is unavailable). */
  const cCopy = $id("cipherCopy");
  if (cCopy) cCopy.addEventListener("click", async () => {
    const text = cOut.textContent;
    if (!text || text === "—") return;
    try {
      await navigator.clipboard.writeText(text);
      const prev = cCopy.textContent;
      cCopy.textContent = "تم النسخ ✓";
      setTimeout(() => { cCopy.textContent = prev; }, 1500);
    } catch {}
  });
})();

/* ============================================================
   MODULE 16 · Tools.Jwt — decoder & claims inspector
   ============================================================ */
(function initJwtTool() {
  const input = $id("jwtIn");
  const parts = $id("jwtParts");
  const hEl = $id("jwtHeader");
  const pEl = $id("jwtPayload");
  const sEl = $id("jwtSig");
  const warn = $id("jwtWarn");
  if (!input || !parts || !hEl || !pEl || !sEl || !warn) return;

  /**
   * Decode a Base64URL segment into UTF-8 text.
   * @param {string} seg Base64URL segment.
   * @returns {string} Decoded text.
   */
  function b64urlDecode(seg) {
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  /** Recompute the decoded view from the current token. @returns {void} */
  function run() {
    const token = input.value.trim();
    if (!token) { parts.hidden = true; warn.textContent = ""; return; }

    const segs = token.split(".");
    hEl.textContent = pEl.textContent = sEl.textContent = "";
    let warnings = "";

    if (segs.length !== 3 || !segs[0] || !segs[1]) {
      parts.hidden = false;
      warn.textContent = "⚠ بنية غير صالحة: يجب أن يكون الرمز ثلاثة أجزاء مفصولة بنقطتين.";
      return;
    }

    try { hEl.textContent = JSON.stringify(JSON.parse(b64urlDecode(segs[0])), null, 2); }
    catch { warnings += "⚠ تعذّر فك ترويسة JSON. "; }

    let payload = {};
    try { payload = JSON.parse(b64urlDecode(segs[1])); }
    catch { warnings += "⚠ تعذّر فك حمولة JSON. "; }

    try {
      pEl.textContent = JSON.stringify(payload, null, 2);
      sEl.textContent = segs[2] || "(فارغ)";
      parts.hidden = false;

      if (payload.exp) {
        const ms = payload.exp * 1000;
        warnings += Date.now() > ms
          ? `⛔ انتهت صلاحية الرمز في ${new Date(ms).toLocaleString("ar")}.`
          : `✅ الرمز صالح حتى ${new Date(ms).toLocaleString("ar")}.`;
      } else if (!warnings) {
        warnings = "ℹ لا يحتوي الرمز على حقل انتهاء صلاحية (exp).";
      }
      warn.textContent = warnings;
    } catch {
      parts.hidden = false;
      warn.textContent = warnings + "⚠ تعذّر فك ترميز Base64URL.";
    }
  }

  input.addEventListener("input", debounce(run, 200));
})(); 
 
/* ============================================================
   MODULE 17 · Tools.Cidr — IPv4 subnet calculator
   ============================================================ */
(function initCidrTool() {
  const ipEl = $id("cidrIp");
  const prefixEl = $id("cidrPrefix");
  const errEl = $id("cidrError");
  const tbody = document.querySelector("#cidrTableBody");
  if (!ipEl || !prefixEl || !errEl || !tbody) return;

  /**
   * Convert dotted IPv4 to a 32-bit unsigned integer.
   * @param {string} ip Dotted address.
   * @returns {number|null} Integer, or null when invalid.
   */
  function ipToInt(ip) {
    const octets = ip.split(".");
    if (octets.length !== 4) return null;
    let n = 0;
    for (const o of octets) {
      if (!/^\d{1,3}$/.test(o)) return null;
      const v = Number(o);
      if (v > 255) return null;
      n = n * 256 + v;
    }
    return n >>> 0;
  }

  /**
   * Convert a 32-bit unsigned integer to dotted notation.
   * @param {number} n Address integer.
   * @returns {string} Dotted address.
   */
  function intToIp(n) {
    return [(n >>> 24), (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
  }

  /** Recalculate and render the subnet breakdown table. @returns {void} */
  function run() {
    const ipInt = ipToInt(ipEl.value.trim());
    let prefix = parseInt(prefixEl.value, 10);
    if (Number.isNaN(prefix)) prefix = 24;
    prefix = Math.min(32, Math.max(0, prefix));

    if (ipInt === null) {
      errEl.hidden = false;
      errEl.textContent = "أدخل عنوان IPv4 صحيحًا (مثال: 192.168.1.10).";
      tbody.innerHTML = "";
      return;
    }
    errEl.hidden = true;

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const network = (ipInt & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const totalHosts = Math.pow(2, 32 - prefix);
    const usableHosts = prefix >= 31 ? totalHosts : Math.max(0, totalHosts - 2);
    const firstUsable = prefix >= 31 ? network : network + 1;
    const lastUsable = prefix >= 31 ? broadcast : broadcast - 1;

    const rows = [
      ["عنوان الشبكة", `${intToIp(network)} /${prefix}`],
      ["قناع الشبكة", intToIp(mask)],
      ["Wildcard Mask", intToIp((~mask >>> 0))],
      ["أول عنوان مضيف", intToIp(firstUsable)],
      ["آخر عنوان مضيف", intToIp(lastUsable)],
      ["عنوان البث (Broadcast)", intToIp(broadcast)],
      ["إجمالي العناوين", fmtInt(totalHosts)],
      ["المضيفون المتاحون", fmtInt(usableHosts)]
    ];
    tbody.innerHTML = rows
      .map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`)
      .join("");
  }

  const runDebounced = debounce(run, 250);
  ipEl.addEventListener("input", runDebounced);
  prefixEl.addEventListener("input", runDebounced);
  run();
})(); 
 
/* ============================================================
   MODULE 18 · Tools.Password — entropy & strength analyzer
   ============================================================ */
(function initPasswordTool() {
  const input = $id("pwInput");
  const eye = $id("pwEye");
  const fill = $id("pwFill");
  const verdict = $id("pwVerdict");
  const list = $id("pwList");
  if (!input || !fill || !verdict || !list) return;

  /** Ubiquitous passwords treated as instant-fail. @type {string[]} */
  const COMMON = ["123456", "password", "qwerty", "111111", "abc123",
    "admin", "letmein", "iloveyou", "000000", "password1"];

  /**
   * Analyse a password: rules, character pool, entropy bits.
   * @param {string} pw Candidate password.
   * @returns {{rules:Object<string,boolean>,entropy:number}} Analysis.
   */
  /**
   * Keyboard / sequential / repeated-character patterns that indicate a
   * weak, predictable password regardless of raw entropy.
   * @param {string} pw
   * @returns {{keyboard:boolean, sequential:boolean, repeated:boolean, dedupe:number}}
   */
  function patternFlags(pw) {
    const lower = pw.toLowerCase();
    const keyboardRows = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
    let keyboard = false, sequential = false, repeated = false, runs = 0;
    const letters = lower.replace(/[^a-z]/g, "");
    const digits = lower.replace(/[^0-9]/g, "");

    // Repeated characters anywhere (e.g. "aaa", "111", "abab")
    for (let i = 0; i < pw.length - 1; i++) {
      if (pw[i] === pw[i + 1]) {
        repeated = true;
        runs++;
      }
    }

    // Keyboard runs (same row, adjacent keys) of length >= 4
    if (letters.length >= 4) {
      for (const row of keyboardRows) {
        for (let i = 0; i <= letters.length - 4; i++) {
          const slice = letters.slice(i, i + 4);
          if (row.includes(slice)) {
            // Allow forward or backward runs (e.g. "asdf" or "fghj" or "poiu")
            const forward = row.indexOf(slice) >= 0;
            const backward = row.indexOf(slice.split("").reverse().join("")) >= 0;
            if (forward || backward) keyboard = true;
          }
        }
      }
    }

    // Sequential letters or digits (abc, cba, 123, 321, etc.), length >= 3
    function hasSequential(str) {
      if (str.length < 3) return false;
      for (let i = 0; i <= str.length - 3; i++) {
        const a = str.charCodeAt(i), b = str.charCodeAt(i + 1), c = str.charCodeAt(i + 2);
        if (b - a === 1 && c - b === 1) return true;
        if (a - b === 1 && b - c === 1) return true;
      }
      return false;
    }
    if (hasSequential(letters)) sequential = true;
    if (hasSequential(digits)) sequential = true;

    return { keyboard, sequential, repeated, runs, short: pw.length < 8 };
  }

  /**
   * Analyse a password: rules, character pool, entropy bits, pattern flags.
   * @param {string} pw Candidate password.
   * @returns {{rules:Object<string,boolean>,entropy:number,flags:object}} Analysis.
   */
  function analyze(pw) {
    const rules = {
      len12: pw.length >= 12,
      len8: pw.length >= 8,
      case: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
      digit: /\d/.test(pw),
      symbol: /[^A-Za-z0-9\s]/.test(pw),
      common: pw.length > 0 && !COMMON.some((c) => pw.toLowerCase().includes(c)),
      keyboardPattern: false,
      sequentialPattern: false,
      repeatedChars: false,
    };
    const flags = patternFlags(pw);
    rules.keyboardPattern = flags.keyboard;
    rules.sequentialPattern = flags.sequential;
    rules.repeatedChars = flags.repeated;

    let pool = 0;
    if (/[a-z]/.test(pw)) pool += 26;
    if (/[A-Z]/.test(pw)) pool += 26;
    if (/\d/.test(pw)) pool += 10;
    if (/[^A-Za-z0-9\s]/.test(pw)) pool += 33;
    if (/[\u0600-\u06FF]/.test(pw)) pool += 36; // Arabic letters
    const bits = pool > 0 ? Math.log2(pool) : 0; // guard: zero-pool input
    const entropy = pw.length ? +(pw.length * bits).toFixed(1) : 0;
    return { rules, entropy, flags };
  }

  /**
   * Humanise estimated offline crack time at 10⁴ guesses/sec.
   * @param {number} seconds Estimated seconds.
   * @returns {string} Readable Arabic duration.
   */
  function crackTime(seconds) {
    if (seconds < 1) return "أقل من ثانية";
    const units = [
      [31104000, "عام", "أعوام"],
      [2592000, "شهر", "أشهر"],
      [86400, "يوم", "أيام"],
      [3600, "ساعة", "ساعات"],
      [60, "دقيقة", "دقائق"]
    ];
    for (const [secs, one, many] of units) {
      if (seconds >= secs) {
        const v = Math.floor(seconds / secs);
        return `${fmtInt(v)} ${v === 1 ? one : many}`;
      }
    }
    return `${Math.floor(seconds)} ثانية`;
  }

  /** Recompute meter, verdict and checklist (delegates to worker). @returns {void} */
  async function run() {
    const pw = input.value;
    let analysis = null;
    if (pw) {
      try { analysis = await WorkerBridge.run("password", { password: pw }); } catch {}
      if (!analysis) analysis = analyze(pw); // main-thread fallback
    } else {
      analysis = analyze(pw);
    }
    var rules = analysis.rules;
    var entropy = analysis.entropy;

    $$("li", list).forEach((li) => {
      li.dataset.ok = String(Boolean(rules[li.dataset.rule]));
    });

    let cls = "";
    let label = pw ? "ضعيفة جدًا 🔴" : "ابدأ بالكتابة لتحليل القوة…";
    if (pw && entropy >= 80) { cls = "is-strong"; label = "قوية جدًا 🟢"; }
    else if (pw && entropy >= 60) { cls = "is-good"; label = "قوة جيدة 🔵"; }
    else if (pw && entropy >= 40) { cls = "is-fair"; label = "مقبولة 🟠"; }
    else if (pw) { cls = "is-weak"; }

    fill.className = `pw-meter-fill ${cls}`.trim();
    fill.style.width = pw ? `${Math.min(100, Math.round(entropy))}%` : "0%";

    var crackLabel = analysis.crackTime || crackTime(Math.pow(2, Math.min(entropy, 128)) / 2 / 10000);
    // Downgrade strength when predictable patterns exist, even if entropy is high.
    if (pw && (rules.keyboardPattern || rules.sequentialPattern || rules.repeatedChars || !rules.common)) {
      if (cls === "is-strong") { cls = "is-fair"; label = "مقبولة 🟠 (ب존속 أنماط متوقعة)"; }
      else if (cls === "is-good") { cls = "is-fair"; label = "مقبولة 🟠 (ب존속 أنماط متوقعة)"; }
    }
    verdict.textContent = pw
      ? `${label} — الإنتروبيا: ${entropy} بت · زمن الكسر التقديري: ${crackLabel} (تقديري — يعتمد على قوة الجهاز وهجوم القاموس)`
      : label;
  }

  if (eye) eye.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    eye.setAttribute("aria-pressed", String(show));
    eye.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
  });

  input.addEventListener("input", run);
  run();
})(); 
 
/* ============================================================
   MODULE 19 · Tools.Encoders — Base64 / Hex / URL codecs
   ============================================================ */
(function initEncodersTool() {
  const tabs = $$(".enc-tab");
  const input = $id("encIn");
  const out = $id("encOut");
  const err = $id("encErr");
  const encodeBtn = $id("encEncode");
  const decodeBtn = $id("encDecode");
  const copyBtn = $id("encCopy");
  if (!input || !out || !err || !tabs.length || !encodeBtn || !decodeBtn) return;

  let mode = "b64";

  /** UTF-8 safe Base64 encode. @param {string} t Text. @returns {string} */
  function toB64(t) {
    const bytes = new TextEncoder().encode(t);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /** UTF-8 safe Base64 decode. @param {string} b Base64. @returns {string} */
  function fromB64(b) {
    const bin = atob(b.replace(/\s+/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  /** Hex-encode UTF-8 bytes. @param {string} t Text. @returns {string} */
  function toHex(t) {
    return [...new TextEncoder().encode(t)]
      .map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** Decode hex to UTF-8. @param {string} h Hex. @returns {string} */
  function fromHex(h) {
    const clean = h.replace(/\s+/g, "");
    if (clean.length % 2 || /[^0-9a-f]/i.test(clean)) throw new Error("bad hex");
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    return new TextDecoder().decode(bytes);
  }

  /**
   * Apply the active codec in the chosen direction.
   * @param {"encode"|"decode"} direction Operation direction.
   * @returns {void}
   */
  function apply(direction) {
    err.hidden = true;
    const value = input.value;
    if (!value) { out.textContent = "—"; return; }
    try {
      let result;
      if (mode === "b64") result = direction === "encode" ? toB64(value) : fromB64(value);
      else if (mode === "hex") result = direction === "encode" ? toHex(value) : fromHex(value);
      else result = direction === "encode"
        ? encodeURIComponent(value)
        : decodeURIComponent(value.replace(/\+/g, " "));
      out.textContent = result;
    } catch {
      out.textContent = "—";
      err.hidden = false;
      err.textContent = "المدخل غير صالح لفك الترميز بهذه الصيغة.";
    }
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
    mode = tab.dataset.enc;
  }));
  encodeBtn.addEventListener("click", () => apply("encode"));
  decodeBtn.addEventListener("click", () => apply("decode"));
  if (copyBtn) copyBtn.addEventListener("click", async () => {
    if (!out.textContent || out.textContent === "—") return;
    try {
      await navigator.clipboard.writeText(out.textContent);
      copyBtn.textContent = "تم النسخ ✓";
      setTimeout(() => { copyBtn.textContent = "نسخ"; }, 1500);
    } catch {}
  });
})(); 
 
/* ============================================================
   MODULE 21 · MaterialsFilter — live search + tag chips
   ============================================================ */
(function initMaterialsFilter() {
  const grid = document.querySelector(".work-grid");
  const input = $id("subjectSearch");
  const countEl = $id("resultsCount");
  const emptyEl = $id("emptyState");
  const chips = $$("#subjects .tag-row .tag-chip");
  if (!grid || !input || !chips.length) return;
  const cards = $$(".work-card", grid);

  let activeTag = "all";

  /** Apply the combined search query + active tag to all cards. @returns {void} */
  function applyFilters() {
    const q = input.value.trim().toLowerCase();
    let visible = 0;

    cards.forEach((card) => {
      const tags = (card.dataset.tags || "").split(/\s+/).filter(Boolean);
      const text = card.textContent.toLowerCase();
      const tagOk = activeTag === "all" || tags.includes(activeTag);
      const textOk = !q || text.includes(q);
      const show = tagOk && textOk;
      card.classList.toggle("is-hidden", !show);
      if (show) visible++;
    });

    if (countEl) countEl.textContent = `عرض ${visible} من ${cards.length} مادة`;
    if (emptyEl) emptyEl.hidden = visible !== 0;
    grid.classList.toggle("is-empty", visible === 0);
  }

  input.addEventListener("input", applyFilters);
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      activeTag = chip.dataset.tag;
      applyFilters();
    })
  );

  applyFilters();
})();

/* ============================================================
   MODULE 22 · Lang — AR/EN interface switcher (navbar toggle)
   Persists the choice; swaps <html lang/dir> + <title>; translates
   every [data-i18n] / [data-i18n-html] node and exposes Lang.t()
   for dynamic modules. Content authored in Arabic (question banks,
   lab scenarios) stays as-is; interface chrome is bilingual.
   ============================================================ */
const Lang = (() => {
  const DICT = {
    ar: {
      "meta.title": "منصة أمن المعلومات — الترم الحالي",
      "meta.description": "منصة أمن المعلومات (Information Security Platform) — منصة عربية تعليمية لطلاب دبلوم أمن المعلومات: مسارات تعلم منظمة، اختبارات تفاعلية، أدوات أمنية ومعامل محاكاة تعمل دون اتصال.",
      "a11y.skip": "تخطي إلى المحتوى الرئيسي",
      "nav.home": "الرئيسية", "nav.semester": "الترم الحالي",
      "nav.paths": "مسارات التعلم", "nav.subjects": "المواد",
      "nav.skills": "شجرة المهارات",
      "nav.quiz": "الاختبارات", "nav.tools": "الأدوات", "nav.labs": "المعامل",
      "nav.flashcards": "البطاقات", "nav.progress": "تقدمك", "nav.about": "حول المنصة", "nav.contact": "التواصل",
      "nav.games": "تحديات CTF", "nav.redteam": "المختبر الهجومي", "nav.ir": "الاستجابة للحوادث", "nav.cryptolab": "مختبر التشفير",
      "nav.cta": "ابدأ التعلم",
      "hero.eyebrow": "✦ منصة تعليمية وتدريبية عملية — دبلوم أمن المعلومات (تجسير مهني)",
      "hero.title1": "منصة تعليمية", "hero.title2": "وتدريبية عملية ", "hero.titleAccent": "لطلاب أمن المعلومات",
      "hero.sub": "منصة عربية متكاملة لطلاب أمن المعلومات: تعلّم أساسيات كل مادة، راجِع المصطلحات بالبطاقات، اختبر نفسك بأسئلة عملية، وطبّق ما تعلّمته بأدوات أمنية ومعامل محاكاة حقيقية — كل ذلك يعمل داخل متصفحك وبدون إنترنت.",
      "hero.ctaStart": "ابدأ رحلة التعلم", "hero.ctaTools": "جرّب الأدوات", "hero.ctaLabs": "ادخل المعامل العملية",
      "hero.ctaQuiz": "ابدأ الاختبار", "hero.ctaSubjects": "تصفح المواد",
      "hero.tagline": "منصة عربية تعليمية لطلاب دبلوم أمن المعلومات — تعلّم، اختبر نفسك، وتدرّب عمليًا داخل متصفحك ودون اتصال.",
      "hero.ctaSemester": "استكشف الترم الحالي",
      "hero.credit": "صُمّم وطُوّر بواسطة <em class=\"grad\">أحمد مطمي</em>",
      "hero.statq": "سؤال تدريبي", "hero.stats": "مواد دراسية",
      "hero.statTools": "أدوات تفاعلية",
      "hero.continueLabel": "متابعة التعلم", "hero.continueBtn": "تابع من حيث توقفت",
      "hero.continueAt": "عند السؤال {i} من {total}",
      "hero.continueResults": "لديك نتائج محفوظة — أكمل مراجعتك", "hero.continueReviewBtn": "اعرض تقدمك",
      /* ---------- MODULE 47/49 · Start-Here strip + HeroDash (Phase 6) ---------- */
      "starthere.title": "جديد هنا؟ ابدأ من هنا",
      "starthere.desc": "مسار «الأساسيات» مصمم للمبتدئين — خمس خطوات قصيرة تنقلك من الصفر إلى أول اختبار.",
      "starthere.cta": "ابدأ مسار الأساسيات",
      "starthere.wizard": "جولة التعريف",
      "starthere.tour": "جولة الأقسام",
      "dash.progressLabel": "تقدمك",
      "dash.lastLesson": "آخر درس",
      "dash.nextQuiz": "الاختبار التالي",
      "dash.continue": "متابعة التعلم",
      "dash.continueFresh": "ابدأ الآن",
      "dash.noLesson": "لا يوجد درس مفتوح بعد",
      "dash.resumeQuiz": "استئناف: {sub}",
      "dash.newQuiz": "اختبار جديد: {sub}",
      "dash.allDone": "أكملت جميع الاختبارات 🎉",
      /* Phase 1 · student command-center dashboard */
      "dash.kicker": "لوحة الطالب",
      "dash.welcomeNew": "مرحبًا بك في لوحة تعلّمك",
      "dash.welcomeBack": "مرحبًا بعودتك — لوحة تعلّمك جاهزة",
      "dash.welcomeEmpty": "ابدأ مسارًا أو اختبارًا وسيظهر تقدمك هنا — محفوظًا على جهازك فقط.",
      "dash.welcomeActive": "لديك نشاط محفوظ. تابع من حيث توقفت أو راجع ما تبقى من الاختبارات والمعامل.",
      "dash.overall": "التقدم العام في الاختبارات",
      "dash.overallAria": "نسبة التقدم العامة في الاختبارات",
      "dash.currentPath": "المسار الحالي",
      "dash.pathAria": "نسبة إنجاز المسار الحالي",
      "dash.pathProgress": "{done} من {total} موضوعًا",
      "dash.pathNext": "التالي: {topic}",
      "dash.pathComplete": "اكتمل المسار",
      "dash.noPath": "لا يوجد مسار محدد بعد",
      "dash.noPathBody": "افتح مسار تعلم لبدء تتبع الموضوعات.",
      "dash.nextLesson": "الدرس التالي",
      "dash.lessonSoon": "موضوع حقيقي من المسار؛ محتوى الدرس سيُضاف قريبًا.",
      "dash.lessonReady": "درس متاح الآن داخل هذا المسار.",
      "dash.pending": "عمل غير مكتمل",
      "dash.pendingCounts": "{quizzes} اختبارات · {labs} معامل متبقية",
      "dash.readyCounts": "{quizzes} اختبارات · {labs} معامل جاهزة للبدء",
      "dash.pendingQuiz": "اختبار: {name}",
      "dash.pendingLab": "مختبر: {name}",
      "dash.allCaughtUp": "كل الاختبارات والمعامل مكتملة",
      "dash.emptyBody": "لا يوجد تقدم محفوظ بعد. ابدأ بالمسار المقترح أو أول اختبار — ستظهر خطوتك التالية هنا تلقائيًا.",
      "dash.emptyCta": "استكشف مسارات التعلم",
      "dash.openPath": "افتح المسار",
      "dash.lastOpened": "آخر درس: {title}",
      "dash.continueLabel": "متابعة التعلم",
      /* Phase 2 · local motivation system */
      "motivation.kicker": "نظام التحفيز المحلي",
      "motivation.level": "المستوى",
      "motivation.levelTitle.1": "مستكشف",
      "motivation.levelTitle.2": "متعلّم",
      "motivation.levelTitle.3": "ممارس",
      "motivation.levelTitle.4": "مدافع",
      "motivation.levelTitle.5": "متخصص",
      "motivation.levelTitle.6": "خبير",
      "motivation.xp": "{xp} نقطة خبرة",
      "motivation.xpNext": "تبقّى {remaining} نقطة للمستوى {next}",
      "motivation.levelAria": "التقدم نحو المستوى التالي",
      "motivation.dailyGoal": "هدف الدراسة اليومي",
      "motivation.weeklyGoal": "هدف الدراسة الأسبوعي",
      "motivation.goalValue": "{xp} / {goal} نقطة",
      "motivation.dailyAria": "التقدم نحو هدف الدراسة اليومي",
      "motivation.weeklyAria": "التقدم نحو هدف الدراسة الأسبوعي",
      "motivation.streak": "سلسلة الدراسة",
      "motivation.streakHint": "أيام متتالية من النشاط الحقيقي",
      "motivation.streakDays": "{days} يوم",
      "motivation.achievements": "الإنجازات",
      "motivation.achievementsCount": "{done} من {total}",
      "motivation.locked": "مقفل",
      "motivation.unlocked": "مفتوح",
      "motivation.reset": "إعادة ضبط التحفيز",
      "motivation.resetNote": "تُحفظ بيانات التحفيز على جهازك فقط، وإعادة الضبط لا تحذف نتائج الاختبارات أو تقدم المسارات.",
      "motivation.resetConfirm": "هل تريد إعادة ضبط نقاط الخبرة والإنجازات والسلسلة؟ لن تُحذف نتائج الاختبارات أو تقدم المسارات.",
      "motivation.badge.firstLesson": "أول درس",
      "motivation.badge.firstLessonDesc": "أكمل أول درس حقيقي.",
      "motivation.badge.firstQuiz": "أول اختبار",
      "motivation.badge.firstQuizDesc": "أكمل أول اختبار تجريبي.",
      "motivation.badge.quizMaster": "إتقان الاختبارات",
      "motivation.badge.quizMasterDesc": "اجتز جميع بنوك الأسئلة المتاحة بنسبة 80% أو أكثر.",
      "motivation.badge.labExplorer": "مستكشف المعامل",
      "motivation.badge.labExplorerDesc": "أكمل أول مختبر عملي.",
      "motivation.badge.cryptoApprentice": "متدرّب التشفير",
      "motivation.badge.cryptoApprenticeDesc": "أكمل اختبار مبادئ التصميم أو مختبر التشفير.",
      "motivation.badge.networkNavigator": "ملّاح الشبكات",
      "motivation.badge.networkNavigatorDesc": "أنجز نصف مسار الشبكات أو المختبر الهجومي.",
      "motivation.badge.incidentResponder": "مستجيب الحوادث",
      "motivation.badge.incidentResponderDesc": "أكمل مختبر الاستجابة أو نصف مسار الحوادث.",
      "motivation.badge.streak7": "سلسلة سبعة أيام",
      "motivation.badge.streak7Desc": "تعلّم سبعة أيام متتالية.",
      "motivation.badge.semesterFinisher": "مُنجز الترم",
      "motivation.badge.semesterFinisherDesc": "أكمل اختبارات مواد الترم الخمس.",
      "features.materials": "مواد دراسية", "features.quizzes": "اختبارات تدريبية",
      "features.summaries": "ملخصات", "features.flashcards": "بطاقات تعليمية",
      "features.tools": "أدوات أمنية تفاعلية", "features.labs": "معامل عملية",
      "subjects.eyebrow": "المواد الدراسية والتجميعات",
      "subjects.title": "مواد <em class=\"grad\">الترم الحالي</em> وملفاتها",
      "subjects.sub": "مواد الفصل الدراسي الحالي وفق الخطة الرسمية: رمز المقرر والساعات والجدول، ولكل مادة بنك أسئلة تدريبي كامل مع شرح لكل إجابة.",
      "tools.eyebrow": "أدوات الأمن السيبراني",
      "tools.title": "جرّب <em class=\"grad\">الأدوات</em> مباشرة",
      "tools.sub": "اثنتا عشرة أداة تفاعلية تعمل بالكامل في متصفحك — من تشفير Caesar إلى تحليل JWT وحساب الشبكات.",
      "quiz.eyebrow": "الاختبارات التجريبية", "quiz.title": "اختبر نفسك في كل مادة",
      "quiz.sub": "أسئلة لكل مادة مع شرح فوري لكل إجابة، وضع مؤقّت اختياري، وحفظ تلقائي للنتائج.",
      "quiz.hint": "💡 اختر مادة للبدء — يمكنك استكمال محاولة سابقة أو إعادة الاختبار من الصفر.",
      "flash.eyebrow": "البطاقات التعليمية",
      "flash.title": "راجع المصطلحات <em class=\"grad\">بالبطاقات</em>",
      "flash.sub": "اضغط على أي بطاقة لقلبها — مصطلح أمني بالعربية مقابل معناه بالإنجليزية مع شرح موجز.",
      "flash.shuffle": "خلط البطاقات", "flash.tap": "اضغط للقلب",
      "collapsible.showQuizzes": "عرض بنوك الأسئلة", "collapsible.showCards": "عرض كل البطاقات (18)",
      "games.eyebrow": "مختبر الحوادث + التحدي (CTF)",
      "games.title": "قائد <em class=\"grad\">الاستجابة للحوادث</em>",
      "games.sub": "محاكاة حقيقية: تستقبل تنبيهات هجمات (SQLi، فحص منافذ، DDoS، تشفير)، وتتعامل معها عبر طرفية أوامر — حلّل، خفّف، ثم استخرج العَلَم.",
      "about.eyebrow": "عن المنصة", "about.title": "لماذا هذه <em class=\"grad\">المنصة؟</em>",
      "contact.eyebrow": "تواصل معنا", "contact.title": "سؤال أو <em class=\"grad\">اقتراح؟</em>",
      "contact.sub": "نسعد بملاحظاتك ومساهماتك في المحتوى — أرسل رسالتك وسنعود إليك بأسرع وقت.",
      "contact.name": "اسمك", "contact.email": "بريدك الإلكتروني", "contact.type": "نوع الرسالة",
      "contact.message": "رسالتك", "contact.submit": "إرسال المساهمة ✦",
      "contact.sending": "جارٍ إرسال رسالتك…", "contact.sent": "✓ تم إرسال رسالتك بنجاح. شكراً لتواصلك!",
      "contact.error": "✗ تعذر الإرسال. جرّب البريد motmi757@gmail.com", "contact.invalid": "⚠️ يرجاء تصحيح الحقول المطلوبة.",
      "contact.fallback": "افتح تطبيق البريد",
      "footer.copy": "© 2026 منصة أمن المعلومات — صُمّم وطُوّر بواسطة أحمد مطمي.",
      "footer.local": "دبلوم أمن المعلومات (تجسير مهني) • الترم الحالي",
      "paths.eyebrow": "مسارات التعلم",
      "paths.title": "من أين تبدأ؟ إليك <em class=\"grad\">مساراتك</em>",
      "paths.sub": "عشرة مسارات منظمة تغطي رحلتك كاملة في أمن المعلومات — من الأساسيات إلى الاختراق الأخلاقي والاستجابة للحوادث: لكل مسار مواضيع مرتبة واختبارات وأدوات عملية.",
      "paths.level.beginner": "مبتدئ", "paths.level.intermediate": "متوسط", "paths.level.advanced": "متقدم",
      "paths.badge.soon": "قريبًا", "paths.badge.recommended": "الأنسب للبداية",
      "paths.stat.topics": "المواضيع: {n}", "paths.stat.quizzes": "الاختبارات: {n}",
      "paths.progressLabel": "إنجاز المسار", "paths.progressOf": "{done} من {total}",
      "paths.next": "الموضوع التالي: {topic}", "paths.nextCard": "التالي: {topic}",
      "paths.open": "استعرض المسار",
      "paths.topicsTitle": "مواضيع المسار — بالترتيب",
      "paths.relatedQuiz": "اختبارات مرتبطة", "paths.relatedTools": "أدوات ومعامل مرتبطة",
      "paths.markDone": "تحديد كمكتمل", "paths.markUndone": "إلغاء التحديد",
      "paths.doneByQuiz": "مكتمل عبر اختبار المادة",
      "paths.complete": "أكملت هذا المسار — أحسنت! 🎉",
      "paths.soonTitle": "هذا المسار قيد الإعداد",
      "paths.soonBody": "محتوى هذا المسار لم يُنشر بعد — نفضّل قول ذلك بصراحة بدل عرض محتوى ناقص. يمكنك استكمال باقي المسارات حتى تجهز.",
      "paths.soonMeanwhile": "وفي الأثناء — أقرب محتوى متاح الآن:",
      "paths.back": "رجوع إلى المسارات",
      "paths.emptyPick": "اختر مسارًا لتظهر تفاصيله هنا.",
      "paths.unknownTitle": "المسار غير موجود",
      "paths.unknownBody": "لم نعثر على هذا المسار — ربما تغيّر رابطه. اختر مسارًا من القائمة.",
      "paths.viewAll": "عرض كل المسارات",
      "paths.lesson": "درس",
      /* Phase 3 · cybersecurity skill tree */
      "skills.eyebrow": "شجرة المهارات",
      "skills.title": "خريطة <em class=\"grad\">المهارات</em>",
      "skills.sub": "مساراتك الحالية معروضة كشجرة مهارات: النسبة، المتطلبات، الدروس والاختبارات والمعامل، والخطوة التالية — بدون تكرار بيانات المسارات.",
      "skills.listAlt": "قائمة المهارات (بديل قابل للوصول)",
      "skills.listIntro": "كل عنصر يمثل مسارًا حقيقيًا من مسارات التعلم.",
      "skills.completion": "الإنجاز",
      "skills.prerequisites": "المتطلبات السابقة",
      "skills.prerequisitesNone": "لا توجد متطلبات سابقة.",
      "skills.relatedLessons": "الدروس المرتبطة",
      "skills.relatedQuizzes": "الاختبارات المرتبطة",
      "skills.relatedLabs": "المعامل المرتبطة",
      "skills.noLessons": "لا توجد دروس منشورة بعد.",
      "skills.noQuizzes": "لا يوجد اختبار مرتبط بعد.",
      "skills.noLabs": "لا يوجد مختبر مرتبط بعد.",
      "skills.nextAction": "الخطوة التالية",
      "skills.comingSoon": "قريبًا — لا محتوى منشورًا بعد.",
      "skills.reviewPath": "مراجعة المسار",
      "skills.startQuiz": "ابدأ الاختبار",
      "skills.openLab": "افتح المعمل",
      "skills.reviewFlashcards": "راجع البطاقات",
      "skills.openPath": "افتح المسار",
      "skills.nextTopic": "التالي: {topic}",
      "skills.recommended": "الأنسب للبداية",
      "skills.soon": "قريبًا",
      "lesson.back": "رجوع إلى المسارات",
      "lesson.soonTitle": "هذا الدرس قيد الإعداد",
      "lesson.soonBody": "محتوى هذا الدرس ليس منشورًا بعد — نفضّل أن نقول ذلك بوضوح.",
      "lesson.backToQuiz": "ارجع إلى الاختبارات",
      "lesson.keyConcepts": "المفاهيم الأساسية",
      "lesson.practicalExample": "مثال تطبيقي",
      "lesson.commonMistakes": "أخطاء شائعة يجب تجنبها",
      "lesson.terminology": "المصطلحات (عربي/إنجليزي)",
      "lesson.relatedPractice": "تدريب مرتبط",
      "lesson.takeQuiz": "اختبر نفسك في هذا الموضوع",
      "lesson.nextLesson": "الدرس التالي",
      /* Phase 4 · lesson experience + local revision */
      "lesson.objectives": "أهداف التعلم",
      "lesson.noObjectives": "ستُضاف الأهداف مع محتوى الدرس.",
      "lesson.time": "المدة التقريبية",
      "lesson.minutes": "{minutes} د",
      "lesson.timeNote": "تقدير من طول المحتوى الظاهر فقط.",
      "lesson.difficulty": "الصعوبة",
      "lesson.difficultyUnknown": "تظهر الصعوبة مع محتوى الدرس.",
      "lesson.difficultyEasy": "سهلة",
      "lesson.difficultyMedium": "متوسطة",
      "lesson.difficultyHard": "متقدمة",
      "lesson.fromQuizMix": "تقدير من مزيج الأسئلة المتاحة.",
      "lesson.fromPath": "من مستوى المسار.",
      "lesson.prerequisites": "المتطلبات السابقة",
      "lesson.prerequisitesNone": "لا متطلبات إضافية في هذا المسار.",
      "lesson.checks": "تحقق سريع",
      "lesson.noChecks": "لا توجد أسئلة تحقق مرتبطة بعد.",
      "lesson.showAnswer": "إظهار الإجابة",
      "lesson.hideAnswer": "إخفاء الإجابة",
      "lesson.checkCorrect": "إجابة صحيحة.",
      "lesson.checkWrong": "ليست صحيحة — راجع الشرح.",
      "lesson.markComplete": "تحديد كمكتمل",
      "lesson.completed": "مكتمل ✓",
      "lesson.markUndone": "إلغاء الإكمال",
      "lesson.bookmark": "حفظ للاحقًا",
      "lesson.bookmarked": "محفوظ ✓",
      "lesson.unbookmark": "إزالة الحفظ",
      "lesson.notes": "ملاحظاتي المحلية",
      "lesson.notePlaceholder": "اكتب ملاحظة قصيرة هنا — تُحفظ على جهازك فقط.",
      "lesson.saveNote": "حفظ الملاحظة",
      "lesson.noteSaved": "تم حفظ الملاحظة محليًا.",
      "lesson.clearNote": "مسح الملاحظة",
      "lesson.noteTooLong": "الملاحظة طويلة؛ تم حفظ أول 2000 حرف.",
      "lesson.relatedQuiz": "الاختبار المرتبط",
      "lesson.relatedLab": "المعمل المرتبط",
      "lesson.noRelated": "لا روابط إضافية بعد.",
      "review.title": "مراجعة محلية شفافة",
      "review.sub": "قائمة من الأخطاء والدروس غير المكتملة والمواضيع المحفوظة ومواعيد المراجعة السابقة — كلها من بيانات جهازك.",
      "review.empty": "لا عناصر مراجعة بعد. أخطاؤك ودروسك غير المكتملة ومواضيعك المحفوظة ستظهر هنا.",
      "review.reasonMissed": "سؤال أخطأت فيه",
      "review.reasonUnfinished": "درس غير مكتمل",
      "review.reasonBookmark": "موضوع محفوظ",
      "review.reasonStale": "يحتاج مراجعة",
      "review.lastReview": "آخر مراجعة: {date}",
      "review.neverReviewed": "لم يُراجع بعد",
      "review.showing": "عرض {shown} من {total}",
      "review.startMistakes": "مراجعة الأخطاء",
      "review.startFive": "تدريب خمس دقائق",
      "review.close": "إغلاق المراجعة",
      "review.next": "التالي",
      "review.finish": "إنهاء",
      "review.gotIt": "أجبت صحيحًا — إزالة من الأخطاء",
      "review.markWrong": "تسجيل كخطأ",
      "review.reveal": "إظهار الشرح",
      "review.timeLeft": "المتبقي {time}",
      "review.timeUp": "انتهت الخمس دقائق — تم حفظ ما أُجيب عنه فقط.",
      "review.summary": "النتيجة: {correct} صحيحة من {answered} — المتبقي {remaining}",
      "review.noMistakes": "لا توجد أخطاء محفوظة بعد.",
      "review.backToQuiz": "العودة إلى الاختبارات",
      "review.openLesson": "فتح الدرس",
      "exam.title": "الاستعداد للاختبار",
      "exam.sub": "خطّط بهدوء — تقدّم ثابت كل يوم أفضل من الحفظ في اللحظة الأخيرة.",
      "exam.datePrompt": "حدّد تاريخ اختبارك (اختياري) ليظهر العدّ التنازلي وتوصيات يومية مبنية على تقدّمك الحقيقي.",
      "exam.dateLabel": "تاريخ الاختبار",
      "exam.save": "حفظ التاريخ",
      "exam.skip": "لاحقًا",
      "exam.edit": "تعديل التاريخ",
      "exam.remove": "إزالة التاريخ",
      "exam.dateSaved": "تم حفظ التاريخ — بالتوفيق، خطوة خطوة.",
      "exam.dateRemoved": "تمت إزالة التاريخ — يمكنك تحديده مجددًا في أي وقت.",
      "exam.invalidDate": "تعذّر قراءة التاريخ — اختره من حقل التاريخ.",
      "exam.daysLeft": "تبقّى {days} يومًا — خطوة كل يوم تصنع فرقًا.",
      "exam.dayLeft": "تبقّى يوم واحد — راجع بهدوء وثق بما تعلّمته.",
      "exam.today": "الاختبار اليوم — خذ نفسًا عميقًا، أنت مستعد أكثر مما تظن.",
      "exam.passed": "مرّ هذا التاريخ — حدّثه إن كان هناك اختبار قادم.",
      "exam.dailyTitle": "تركيز اليوم",
      "exam.dailyEmpty": "لا توصيات الآن — استمر على نفس الوتيرة الهادئة.",
      "exam.recReview": "راجع {count} من أسئلة أخطأت فيها — تصحيحها أسرع طريق للتحسّن.",
      "exam.recWeak": "أعد النظر في «{topic}» ({subject}) — ظهر في أخطائك.",
      "exam.recLesson": "أكمل الدرس: {lesson}",
      "exam.recSubject": "امنح {subject} بعض الوقت اليوم (الجاهزية {pct}%).",
      "exam.recPractice": "جرّب اختبارًا تدريبيًا عندما تشعر بالجاهزية.",
      "exam.readinessTitle": "جاهزية المواد",
      "exam.readinessSub": "نِسَب حقيقية من بياناتك: الاختبار 50% · الدروس 30% · الخلو من الأخطاء 20%",
      "exam.breakdown": "اختبار {quiz}% · دروس {lessons}% · خالٍ من الأخطاء {mistakes}%",
      "exam.notTested": "لم يُختبر بعد",
      "exam.noLessons": "لا دروس مرتبطة — أُعيد توزيع الوزن على الاختبار والأخطاء.",
      "exam.weakTitle": "مواضيع تحتاج مراجعة لطيفة",
      "exam.weakEmpty": "لا مواضيع ضعيفة مسجلة — عمل رائع!",
      "exam.missedCount": "{count} أخطاء",
      "exam.practiceTitle": "اختبار تدريبي",
      "exam.practiceSub": "أسئلة حقيقية من كل المواد — بلا مؤقّت ولا ضغط.",
      "exam.start": "ابدأ الاختبار التدريبي",
      "exam.progress": "السؤال {i} من {total}",
      "exam.from": "من: {subject}",
      "exam.next": "التالي",
      "exam.finish": "إنهاء",
      "exam.correct": "إجابة صحيحة ✓",
      "exam.wrong": "ليست الإجابة — اقرأ الشرح بهدوء.",
      "exam.summaryTitle": "نتيجة الاختبار التدريبي",
      "exam.summaryLine": "{correct} صحيحة من {total} ({pct}%)",
      "exam.encHigh": "ممتاز! حافظ على هذا المستوى بمراجعة خفيفة.",
      "exam.encMid": "جيد جدًا — ركّز على المواضيع التي أخطأت فيها.",
      "exam.encLow": "بداية طيبة — كل خطأ اليوم نقطة إضافية غدًا.",
      "exam.lastRun": "آخر محاولة تدريبية: {pct}% في {date}",
      "exam.finalTitle": "خلاصة الجاهزية",
      "exam.finalLine": "جاهزيتك العامة {pct}% — {note}",
      "exam.finalNoteHigh": "استعداد قوي، يكفي مراجعة الأخطاء المتبقية.",
      "exam.finalNoteMid": "على الطريق الصحيح — واصل التركيز على المواضيع الضعيفة.",
      "exam.finalNoteLow": "كل يوم مراجعة يقرّبك — ابدأ بأقل مادة جاهزية.",
      "exam.finalNoData": "ابدأ باختبار أو درس واحد وستظهر هنا جاهزيتك الحقيقية.",
      "exam.openQuiz": "فتح الاختبارات",
      "exam.openLessons": "فتح الدروس",

      "beginner.title": "مبتدئ؟ ابدأ من هنا — خطواتك الأربع",
      "beginner.s1": "اختر مادة من «المواد» واقرأ وصفها.", "beginner.s2": "احفظ المصطلحات ببطاقات الفلاش السريعة.", "beginner.s3": "اختبر نفسك في المادة واقرأ شرح كل إجابة.", "beginner.s4": "طبّق بأداة تفاعلية واحدة ثم جرّب معمل المحاكاة.",
      "beginner.cta": "ابدأ الخطوة الأولى", "beginner.pathCta": "ابدأ المسار الموصى به",
      "toolsEdu.notice": "⚠️ أدوات تعليمية تعمل محليًا في متصفحك — لا تُدخل كلمات مرور حقيقية أو مفاتيح API أو رموز خاصة أو أي بيانات سرية.",
      "toolsEdu.name": "الاسم", "toolsEdu.purpose": "الهدف التعليمي", "toolsEdu.safety": "تنبيه وحدود الأداة",
      "toolsEdu.tryExample": "مثال آمن", "toolsEdu.reset": "إعادة ضبط", "toolsEdu.copy": "نسخ النتيجة", "toolsEdu.copied": "✓ تم النسخ",
      "toolsEdu.related": "مرتبط بـ", "toolsEdu.lessonChip": "الدرس", "toolsEdu.pathChip": "المسار", "toolsEdu.quizChip": "اختبار",
      "labs.objective": "الهدف", "labs.skills": "المهارات المُتدرَّبة", "labs.hints": "تلميحات",
      "labs.markDone": "تحديد المعمل كمكتمل", "labs.markUndone": "إلغاء الإكمال", "labs.completed": "مكتمل ✓",
      "labs.explainTitle": "ماذا تعلمت؟",
      "labs.responsibleUse": "⚠️ استخدام مسؤول: هذه محاكاة تعليمية داخل متصفحك فقط — لا تُجرِّب هذه التقنيات على أنظمة أو شبكات لا تملكها أو لا تملك إذنًا خطيًا باختبارها.",
      "labs.eyebrow": "المعامل العملية",
      "labs.title": "المعامل <em class=\"grad\">التطبيقية</em> والتدريب العملي",
      "labs.sub": "أربع معامل محاكاة تعمل كاملة داخل متصفحك — من محاكاة الهجمات إلى الاستجابة للحوادث وفك الشفرات.",
      "labs.enter": "ادخل المعمل",
      "labs.redteam": "المختبر الهجومي", "labs.redteam.sub": "طرفية Bash وقاعدة بيانات قابلة للحقن وبناء حزم الشبكة — افهم كيف تُنفَّذ الهجمات وكيف تُمنع.",
      "labs.ir": "الاستجابة للحوادث", "labs.ir.sub": "محاكاة زمنية حقيقية مع لوحة SIEM وتحليل الخط الزمني وتحديات تحديد السبب الجذري.",
      "labs.crypto": "مختبر التشفير", "labs.crypto.sub": "فيجينير وإنجما وRSA خطوة بخطوة وتحليل التردد — شاهد خوارزميات التشفير تعمل أمامك.",
      "labs.games": "تحديات CTF", "labs.games.sub": "سيناريوهات اختراق مصغّرة (SQLi، فحص منافذ، DDoS) عبر طرفية أوامر — احل وتعلّم.",
      "progress.eyebrow": "متابعة التعلم",
      "progress.title": "تقدمك <em class=\"grad\">في المنصة</em>",
      "progress.sub": "نتائج اختباراتك وأفضل درجاتك محفوظة على جهازك فقط — تابع من حيث توقفت متى شئت.",
      "progress.resumeTitle": "تابع من حيث توقفت",
      "progress.atQuestion": "أنت عند السؤال {i} من {total}",
      "progress.resumeBtn": "استكمال الاختبار",
      "progress.restartBtn": "إعادة الاختبار",
      "progress.bestTitle": "أفضل نتائجك",
      "progress.best": "آخر نتيجة: {score} من {total}",
      "progress.retakeBtn": "أعد الاختبار",
      "progress.emptyTitle": "لم تبدأ بعد! 🎯",
      "progress.emptySub": "ابدأ بأول اختبار في أي مادة وستظهر هنا نتائجك وأفضل درجاتك وتقدّمك — كل ذلك محفوظ على جهازك فقط.",
      "progress.emptyCta": "ابدأ أول اختبار",
      "about.sub": "منصة عربية لطلاب دبلوم أمن المعلومات تجمع بين التعليم والتدريب العملي — تعلّم المادة نظريًا ثم طبّقها بالأدوات والمعامل.",
      "about.lead": "منصة عربية متكاملة لطالب دبلوم أمن المعلومات: المحتوى النظري للمواد، أدوات عملية، معامل محاكاة، ومساعد ذكي يجيب من محتوى المنصة — كل ذلك يعمل محليًا وفي وضع عدم الاتصال.",
      "about.p1": "محتوى منظم", "about.p1d": "لكل مادة: تجميعة، ملخصات، وبنك أسئلة جاهز للطباعة.",
      "about.p2": "اختبارات ذكية", "about.p2d": "شرح فوري لكل إجابة، تتبّع أفضل نتيجة، واستكمال المحاولة السابقة.",
      "about.p3": "يعمل دون إنترنت", "about.p3d": "تقنية PWA — ثبّت المنصة على هاتفك واستخدمها بدون اتصال.",
      "about.p4": "خصوصية كاملة", "about.p4d": "لا حسابات ولا تتبّع — نتائجك تُحفظ على جهازك فقط.",
      "about.p5": "تدريب عملي", "about.p5d": "معامل محاكاة للهجمات والاستجابة للحوادث وتحديات CTF داخل المتصفح.",
      "about.p6": "مساعد ذكي", "about.p6d": "يجيب عن أسئلتك من محتوى المنصة نفسها — في أي وقت وبدون إنترنت.",
      "onboarding.title": "مرحبًا بك في منصة أمن المعلومات 👋",
      "onboarding.subtitle": "أسئلة سريعة لنقترح لك مسارًا مناسبًا — لا يتطلب تسجيلًا.",
      "onboarding.skip": "تخطي",
      "onboarding.next": "التالي",
      "onboarding.back": "رجوع",
      "onboarding.finish": "ابدأ التعلم",
      "onboarding.step1Title": "مستواك الحالي؟",
      "onboarding.step1Desc": "يساعدنا هذا في تخصيص تجربتك التعليمية.",
      "onboarding.level.beginner": "مبتدئ — أبدأ من الصفر",
      "onboarding.level.intermediate": "متوسط — لدي معرفة سابقة",
      "onboarding.level.advanced": "متقدم — أعمق في المواضيع",
      "onboarding.step2Title": "ما الذي يهمك؟ (اختياري)",
      "onboarding.step2Desc": "اختر المواد التي تريد التركيز عليها.",
      "onboarding.subj.algorithms": "الخوارزميات", "onboarding.subj.osconcepts": "مفاهيم نظم التشغيل",
      "onboarding.subj.policy": "السياسات والتشريعات والأخلاقيات",
      "onboarding.subj.components": "مكونات أنظمة تقنية المعلومات", "onboarding.subj.design": "مبادئ التصميم في الأمن السيبراني",
      "onboarding.step3Title": "طريقة التعلم المفضلة؟",
      "onboarding.step3Desc": "يمكنك دمج أكثر من طريقة.",
      "onboarding.style.theory": "شرح نظري",
      "onboarding.style.quizzes": "اختبارات",
      "onboarding.style.practical": "تدريب عملي",
      "onboarding.recommendedTitle": "المسار المقترح لك",
      "onboarding.recommendedDesc": "بناءً على اختياراتك، ننصح بالبدء هنا:",
      "onboarding.summaryLevel": "المستوى: {level}",
      "onboarding.summarySubjects": "المواد: {subjects}",
      "onboarding.summaryStyle": "الأسلوب: {style}",
      /* ---------- MODULE 54 · OnboardingTour — الجولة التعريفية (8 خطوات) ---------- */
      "tour.next": "التالي",
      "tour.finish": "إنهاء الجولة",
      "tour.back": "رجوع",
      "tour.skip": "تخطي الجولة",
      "tour.counter": "الخطوة {i} من {n}",
      "tour.areaLabel": "القسم المميّز:",
      "tour.hint": "استخدم Tab للتنقل بين الأزرار · Esc لتخطي الجولة.",
      "tour.s1Title": "أهلًا بك في منصة أمن المعلومات 👋",
      "tour.s1Text": "منصة عربية لتعلّم أمن المعلومات: تعلّم الأساسيات، اختبر نفسك، وتدرّب عمليًا — كل ذلك داخل متصفحك.",
      "tour.s1Area": "الواجهة الرئيسية للمنصة",
      "tour.s2Title": "لوحة الطالب — تقدّمك",
      "tour.s2Text": "هنا يظهر ملخّص تقدّمك: النسبة العامة، آخر درس، والخطوة التالية. كل الأرقام محفوظة على جهازك فقط.",
      "tour.s2Area": "لوحة الطالب",
      "tour.s3Title": "المسارات والمواد والدروس",
      "tour.s3Text": "مسارات مرتّبة من الأساسيات إلى المستوى المتقدم. اختر مسارًا ثم تابع دروسه خطوة بخطوة.",
      "tour.s3Area": "مسارات التعلم والدروس",
      "tour.s4Title": "الاختبارات وحفظ التقدّم",
      "tour.s4Text": "اختبر نفسك في كل مادة، وتُحفظ إجاباتك ونتيجتك تلقائيًا — ويمكنك الاستئناف من حيث توقفت.",
      "tour.s4Area": "الاختبارات",
      "tour.s5Title": "المعامل والأدوات الأمنية",
      "tour.s5Text": "طبّق ما تعلّمته: معامل محاكاة وأدوات أمنية آمنة تعمل داخل المتصفح وبدون إنترنت.",
      "tour.s5Area": "المعامل العملية والأدوات",
      "tour.s6Title": "المواد الدراسية والمصادر",
      "tour.s6Text": "راجع المصطلحات بالبطاقات، وافتح ملفات المواد والملخصات وبنوك الأسئلة من قسم المواد.",
      "tour.s6Area": "البطاقات والمواد الدراسية",
      "tour.s7Title": "مساعد المنصة الذكي",
      "tour.s7Text": "اسأله عن أي موضوع في المنصة: يشرح ويقترح دروسًا واختبارات، ويعمل محليًا داخل متصفحك.",
      "tour.s7Area": "مساعد المنصة",
      "tour.s8Title": "التنقّل والبحث",
      "tour.s8Text": "من الشريط العلوي تنتقل بين الأقسام، ويفتح البحث السريع بالضغط على / أو Ctrl+K.",
      "tour.s8Area": "الشريط العلوي والبحث",
      "progress.lessons": "الدروس المكتملة",
      "progress.labs": "المعامل المكتملة",
      "progress.flashcards": "البطاقات المراجعة",
      "progress.paths": "إنجاز المسارات",
      "progress.attempts": "محاولات الاختبار",
      "progress.reviewWrong": "راجع أخطاءك",
      "progress.overall": "التقدم الكلي",
      "semester.eyebrow": "دليل الترم الحالي",
      "semester.title": "لوحة <em class=\"grad\">الترم الحالي</em>",
      "semester.sub": "خطة الترم الحالي كاملة في مكان واحد: المواد الرسمية، الجدول الأسبوعي، الساعات المعتمدة، وحلقات الوصول إلى الاختبارات والأدوات والمعامل.",
      "semester.program": "البرنامج",
      "semester.subjectsCount": "المواد",
      "semester.credits": "الساعات المعتمدة",
      "semester.code": "رمز المقرر",
      "semester.schedule": "الجدول",
      "semester.creditHours": "ساعات معتمدة",
      "semester.estHours": "ساعات دراسة تقديرية",
      "semester.prerequisites": "المتطلبات السابقة",
      "semester.prerequisitesNone": "لا توجد متطلبات سابقة لهذه المادة.",
      "semester.outcomes": "مخرجات التعلم",
      "semester.mistakes": "أخطاء شائعة",
      "semester.terms": "مصطلحات أساسية",
      "semester.lessons": "الدروس",
      "semester.lessonsSoon": "سيتم إضافة الدروس قريبًا.",
      "semester.quizChip": "بنك الأسئلة",
      "semester.tools": "أدوات ذات صلة",
      "semester.labs": "معامل ذات صلة",
      "semester.missingData": "بيانات الترم الحالي غير متوفرة حاليًا.",
      /* ---------- MODULE 48 · GlobalSearch (Phase 6) ---------- */
      "search.title": "بحث في المنصة",
      "search.placeholder": "ابحث: درس، مسار، أداة، اختبار، مصطلح…",
      "search.hint": "أو Ctrl+K للفتح · Esc للإغلاق · ↑↓ للتنقل",
      "search.empty": "لا نتائج مطابقة — جرّب كلمة أخرى.",
      "search.start": "اكتب للبحث في الدروس والمسارات والأدوات والاختبارات والمصطلحات.",
      "search.group.lesson": "الدروس",
      "search.group.path": "المسارات",
      "search.group.tool": "الأدوات",
      "search.group.quiz": "الاختبارات",
      "search.group.flash": "البطاقات",
      "search.group.term": "المصطلحات والشرح"
    },
    en: {
      "meta.title": "Information Security Platform — Current Semester",
      "meta.description": "Information Security Platform — an Arabic-first educational platform for Information Security diploma students: structured learning paths, interactive quizzes, security tools and simulation labs that work offline.",
      "a11y.skip": "Skip to main content",
      "semester.eyebrow": "Current semester guide",
      "semester.title": "The <em class=\"grad\">Current Semester</em> board",
      "semester.sub": "The full current-semester plan in one place: official subjects, weekly schedule, credit hours, and gateways to quizzes, tools and labs.",
      "semester.program": "Program",
      "semester.subjectsCount": "Subjects",
      "semester.credits": "Credit hours",
      "semester.code": "Course code",
      "semester.schedule": "Schedule",
      "semester.creditHours": "credit hours",
      "semester.estHours": "estimated study hours",
      "semester.prerequisites": "Prerequisites",
      "semester.prerequisitesNone": "No prerequisites for this subject.",
      "semester.outcomes": "Learning outcomes",
      "semester.mistakes": "Common mistakes",
      "semester.terms": "Key terms",
      "semester.lessons": "Lessons",
      "semester.lessonsSoon": "Lessons will be added soon.",
      "semester.quizChip": "Question bank",
      "semester.tools": "Related tools",
      "semester.labs": "Related labs",
      "semester.missingData": "Current-semester data is not available right now.",
      "nav.home": "Home", "nav.semester": "Current Semester",
      "nav.paths": "Learning Paths", "nav.subjects": "Subjects",
      "nav.skills": "Skill Tree",
      "nav.quiz": "Quizzes", "nav.tools": "Tools", "nav.labs": "Labs",
      "nav.flashcards": "Flashcards", "nav.progress": "Your Progress", "nav.about": "About", "nav.contact": "Contact",
      "nav.games": "CTF Lab", "nav.redteam": "Red Team Lab", "nav.ir": "Incident Response", "nav.cryptolab": "Crypto Lab",
      "nav.cta": "Start learning",
      "hero.eyebrow": "✦ An educational & practical training platform — Infosec Diploma (Professional Bridging)",
      "hero.title1": "An educational &", "hero.title2": "practical training platform ", "hero.titleAccent": "for Infosec students",
      "hero.sub": "An Arabic-first platform for Information Security students: learn the fundamentals of every subject, review terms with flashcards, quiz yourself with practical questions, then apply what you learned with security tools and real simulation labs — all in your browser, even offline.",
      "hero.ctaStart": "Start Learning", "hero.ctaTools": "Try the Tools", "hero.ctaLabs": "Enter the Labs",
      "hero.ctaQuiz": "Start the Quiz", "hero.ctaSubjects": "Browse Subjects",
      "hero.tagline": "An Arabic-first learning platform for Information Security diploma students — learn, test yourself and practise hands-on in your browser, even offline.",
      "hero.ctaSemester": "Explore the Current Semester",
      "hero.credit": "Designed &amp; developed by <em class=\"grad\">Ahmed Motmi</em>",
      "hero.statq": "practice questions", "hero.stats": "courses",
      "hero.statTools": "interactive tools",
      "hero.continueLabel": "Continue learning", "hero.continueBtn": "Resume quiz",
      "hero.continueAt": "At question {i} of {total}",
      "hero.continueResults": "You have saved results — keep up the review", "hero.continueReviewBtn": "View my progress",
      /* ---------- MODULE 47/49 · Start-Here strip + HeroDash (Phase 6) ---------- */
      "starthere.title": "New here? Start here",
      "starthere.desc": "The «Fundamentals» path is built for beginners — five short steps from zero to your first quiz.",
      "starthere.cta": "Start the Fundamentals path",
      "starthere.wizard": "Intro tour",
      "starthere.tour": "Sections tour",
      "dash.progressLabel": "Your progress",
      "dash.lastLesson": "Last lesson",
      "dash.nextQuiz": "Next quiz",
      "dash.continue": "Continue learning",
      "dash.continueFresh": "Start now",
      "dash.noLesson": "No lesson opened yet",
      "dash.resumeQuiz": "Resume: {sub}",
      "dash.newQuiz": "New quiz: {sub}",
      "dash.allDone": "All quizzes completed 🎉",
      /* Phase 1 · student command-center dashboard */
      "dash.kicker": "Student dashboard",
      "dash.welcomeNew": "Welcome to your learning dashboard",
      "dash.welcomeBack": "Welcome back — your learning hub is ready",
      "dash.welcomeEmpty": "Start a path or quiz and your progress will appear here — saved only on this device.",
      "dash.welcomeActive": "You have saved learning activity. Pick up where you left off or review your remaining quizzes and labs.",
      "dash.overall": "Overall quiz progress",
      "dash.overallAria": "Overall quiz progress percentage",
      "dash.currentPath": "Current path",
      "dash.pathAria": "Current path completion percentage",
      "dash.pathProgress": "{done} of {total} topics",
      "dash.pathNext": "Next: {topic}",
      "dash.pathComplete": "Path complete",
      "dash.noPath": "No path selected yet",
      "dash.noPathBody": "Open a learning path to start tracking topics.",
      "dash.nextLesson": "Next lesson",
      "dash.lessonSoon": "A real path topic; authored lesson content is coming soon.",
      "dash.lessonReady": "An authored lesson is available now in this path.",
      "dash.pending": "Unfinished work",
      "dash.pendingCounts": "{quizzes} quizzes · {labs} labs remaining",
      "dash.readyCounts": "{quizzes} quizzes · {labs} labs ready to start",
      "dash.pendingQuiz": "Quiz: {name}",
      "dash.pendingLab": "Lab: {name}",
      "dash.allCaughtUp": "All quizzes and labs are complete",
      "dash.emptyBody": "No progress has been saved yet. Start the recommended path or first quiz — your next step will appear here automatically.",
      "dash.emptyCta": "Explore learning paths",
      "dash.openPath": "Open path",
      "dash.lastOpened": "Last lesson: {title}",
      "dash.continueLabel": "Continue learning",
      /* Phase 2 · local motivation system */
      "motivation.kicker": "Local motivation",
      "motivation.level": "Level",
      "motivation.levelTitle.1": "Explorer",
      "motivation.levelTitle.2": "Learner",
      "motivation.levelTitle.3": "Practitioner",
      "motivation.levelTitle.4": "Defender",
      "motivation.levelTitle.5": "Specialist",
      "motivation.levelTitle.6": "Expert",
      "motivation.xp": "{xp} XP",
      "motivation.xpNext": "{remaining} XP to level {next}",
      "motivation.levelAria": "Progress toward the next level",
      "motivation.dailyGoal": "Daily study goal",
      "motivation.weeklyGoal": "Weekly study goal",
      "motivation.goalValue": "{xp} / {goal} XP",
      "motivation.dailyAria": "Progress toward the daily study goal",
      "motivation.weeklyAria": "Progress toward the weekly study goal",
      "motivation.streak": "Study streak",
      "motivation.streakHint": "Consecutive days of genuine activity",
      "motivation.streakDays": "{days} days",
      "motivation.achievements": "Achievements",
      "motivation.achievementsCount": "{done} of {total}",
      "motivation.locked": "Locked",
      "motivation.unlocked": "Unlocked",
      "motivation.reset": "Reset motivation",
      "motivation.resetNote": "Motivation data is stored on this device only. Resetting it never deletes quiz results or learning-path progress.",
      "motivation.resetConfirm": "Reset XP, achievements and streak? Quiz results and learning-path progress will not be deleted.",
      "motivation.badge.firstLesson": "First Lesson",
      "motivation.badge.firstLessonDesc": "Complete your first real lesson.",
      "motivation.badge.firstQuiz": "First Quiz",
      "motivation.badge.firstQuizDesc": "Complete your first practice quiz.",
      "motivation.badge.quizMaster": "Quiz Master",
      "motivation.badge.quizMasterDesc": "Score at least 80% in every available question bank.",
      "motivation.badge.labExplorer": "Lab Explorer",
      "motivation.badge.labExplorerDesc": "Complete your first hands-on lab.",
      "motivation.badge.cryptoApprentice": "Cryptography Apprentice",
      "motivation.badge.cryptoApprenticeDesc": "Complete the design-principles quiz or the crypto lab.",
      "motivation.badge.networkNavigator": "Network Navigator",
      "motivation.badge.networkNavigatorDesc": "Complete half of the networking path or the offensive lab.",
      "motivation.badge.incidentResponder": "Incident Responder",
      "motivation.badge.incidentResponderDesc": "Complete the incident-response lab or half of the incident path.",
      "motivation.badge.streak7": "Seven-Day Streak",
      "motivation.badge.streak7Desc": "Study on seven consecutive days.",
      "motivation.badge.semesterFinisher": "Semester Finisher",
      "motivation.badge.semesterFinisherDesc": "Complete the quizzes for all five semester subjects.",
      "features.materials": "Study materials", "features.quizzes": "Practice quizzes",
      "features.summaries": "Summaries", "features.flashcards": "Flashcards",
      "features.tools": "Interactive security tools", "features.labs": "Practical labs",
      "subjects.eyebrow": "Course Materials & Bundles",
      "subjects.title": "Current Semester <em class=\"grad\">Courses</em> & Files",
      "subjects.sub": "The current semester's official study-plan courses — course code, credit hours and schedule — each with a full practice question bank and an explanation for every answer.",
      "tools.eyebrow": "Cybersecurity Tools",
      "tools.title": "Try the <em class=\"grad\">Tools</em> Live",
      "tools.sub": "Twelve interactive tools running entirely in your browser — from Caesar cipher to JWT decoding and subnet math.",
      "quiz.eyebrow": "Practice Exams", "quiz.title": "Test yourself in every course",
      "quiz.sub": "Questions per course with instant explanations, an optional timer and automatic progress saving.",
      "quiz.hint": "💡 Pick a course to begin — you can resume a previous attempt or retake it from scratch.",
      "flash.eyebrow": "Flashcards",
      "flash.title": "Review Terms with <em class=\"grad\">Flashcards</em>",
      "flash.sub": "Tap any card to flip it — a security term in English with its Arabic meaning and a short explanation.",
      "flash.shuffle": "Shuffle cards", "flash.tap": "Tap to flip",
      "collapsible.showQuizzes": "Show question banks", "collapsible.showCards": "Show all cards (18)",
      "games.eyebrow": "Incident Lab + CTF",
      "games.title": "Incident <em class=\"grad\">Response</em> Commander",
      "games.sub": "A real simulation: receive attack alerts (SQLi, port scans, DDoS, crypto) and respond through a command console — analyse, mitigate, then capture the flag.",
      "about.eyebrow": "About the platform", "about.title": "Why this <em class=\"grad\">platform?</em>",
      "contact.eyebrow": "Contact us", "contact.title": "A question or a <em class=\"grad\">suggestion?</em>",
      "contact.sub": "We'd love your feedback and contributions — send your message and we'll get back to you shortly.",
      "contact.name": "Your name", "contact.email": "Your email", "contact.type": "Message type",
            "contact.message": "Your message", "contact.submit": "Send contribution ✦",
      "contact.sending": "Sending your message…", "contact.sent": "✓ Message sent successfully. Thank you for reaching out!",
      "contact.error": "✗ Send failed. Try emailing motmi757@gmail.com", "contact.invalid": "⚠️ Please fix the required fields.",
      "contact.fallback": "Open email app",
      "footer.copy": "© 2026 Information Security Platform — Designed & developed by Ahmed Motmi.",
      "footer.local": "Information Security Diploma (Professional Bridging) • Current Semester",
      "paths.eyebrow": "Learning Paths",
      "paths.title": "Where do you start? <em class=\"grad\">Your paths</em>",
      "paths.sub": "Ten structured paths cover your whole information-security journey — from fundamentals to penetration testing and incident response: each with ordered topics, quizzes and hands-on tools.",
      "paths.level.beginner": "Beginner", "paths.level.intermediate": "Intermediate", "paths.level.advanced": "Advanced",
      "paths.badge.soon": "Coming soon", "paths.badge.recommended": "Best starting point",
      "paths.stat.topics": "Topics: {n}", "paths.stat.quizzes": "Quizzes: {n}",
      "paths.progressLabel": "Path progress", "paths.progressOf": "{done} of {total}",
      "paths.next": "Up next: {topic}", "paths.nextCard": "Next: {topic}",
      "paths.open": "View path",
      "paths.topicsTitle": "Path topics — in order",
      "paths.relatedQuiz": "Related quizzes", "paths.relatedTools": "Related tools & labs",
      "paths.markDone": "Mark as done", "paths.markUndone": "Mark as not done",
      "paths.doneByQuiz": "Done via the subject quiz",
      "paths.complete": "You completed this path — great job! 🎉",
      "paths.soonTitle": "This path is in preparation",
      "paths.soonBody": "This path's content isn't published yet — we'd rather say that openly than show half-ready material. Explore the other paths meanwhile.",
      "paths.soonMeanwhile": "Meanwhile — the closest live content:",
      "paths.back": "Back to paths",
      "paths.emptyPick": "Pick a path to see its details here.",
      "paths.unknownTitle": "Path not found",
      "paths.unknownBody": "We couldn't find this path — its link may have changed. Pick one from the list.",
      "paths.viewAll": "View all paths",
      "paths.lesson": "Lesson",
      /* Phase 3 · cybersecurity skill tree */
      "skills.eyebrow": "Skill Tree",
      "skills.title": "Your <em class=\"grad\">skill map</em>",
      "skills.sub": "Your current paths shown as a skill tree: completion, prerequisites, related lessons/quizzes/labs and the next action — without duplicating path data.",
      "skills.listAlt": "Skill list (accessible alternative)",
      "skills.listIntro": "Each item is a real learning path.",
      "skills.completion": "Completion",
      "skills.prerequisites": "Prerequisites",
      "skills.prerequisitesNone": "No prerequisites.",
      "skills.relatedLessons": "Related lessons",
      "skills.relatedQuizzes": "Related quizzes",
      "skills.relatedLabs": "Related labs",
      "skills.noLessons": "No authored lessons yet.",
      "skills.noQuizzes": "No linked quiz yet.",
      "skills.noLabs": "No linked lab yet.",
      "skills.nextAction": "Recommended next action",
      "skills.comingSoon": "Coming soon — no published content yet.",
      "skills.reviewPath": "Review path",
      "skills.startQuiz": "Start quiz",
      "skills.openLab": "Open lab",
      "skills.reviewFlashcards": "Review flashcards",
      "skills.openPath": "Open path",
      "skills.nextTopic": "Next: {topic}",
      "skills.recommended": "Best starting point",
      "skills.soon": "Coming soon",
      "lesson.back": "Back to paths",
      "lesson.soonTitle": "This lesson is in preparation",
      "lesson.soonBody": "This lesson's content isn't published yet — we'd rather say that openly.",
      "lesson.backToQuiz": "Back to quizzes",
      "lesson.keyConcepts": "Key concepts",
      "lesson.practicalExample": "Practical example",
      "lesson.commonMistakes": "Common mistakes to avoid",
      "lesson.terminology": "Terminology (Arabic/English)",
      "lesson.relatedPractice": "Related practice",
      "lesson.takeQuiz": "Quiz yourself on this topic",
      "lesson.nextLesson": "Next lesson",
      /* Phase 4 · lesson experience + local revision */
      "lesson.objectives": "Learning objectives",
      "lesson.noObjectives": "Objectives will appear with authored lesson content.",
      "lesson.time": "Estimated time",
      "lesson.minutes": "{minutes} min",
      "lesson.timeNote": "Estimate from the visible content length only.",
      "lesson.difficulty": "Difficulty",
      "lesson.difficultyUnknown": "Difficulty appears with authored content.",
      "lesson.difficultyEasy": "Easy",
      "lesson.difficultyMedium": "Medium",
      "lesson.difficultyHard": "Advanced",
      "lesson.fromQuizMix": "Estimate from the available question mix.",
      "lesson.fromPath": "From the path level.",
      "lesson.prerequisites": "Prerequisites",
      "lesson.prerequisitesNone": "No extra prerequisites in this path.",
      "lesson.checks": "Quick checks",
      "lesson.noChecks": "No linked check questions yet.",
      "lesson.showAnswer": "Show answer",
      "lesson.hideAnswer": "Hide answer",
      "lesson.checkCorrect": "Correct answer.",
      "lesson.checkWrong": "Not correct — review the explanation.",
      "lesson.markComplete": "Mark as complete",
      "lesson.completed": "Complete ✓",
      "lesson.markUndone": "Mark as not complete",
      "lesson.bookmark": "Bookmark for later",
      "lesson.bookmarked": "Bookmarked ✓",
      "lesson.unbookmark": "Remove bookmark",
      "lesson.notes": "My local notes",
      "lesson.notePlaceholder": "Write a short note here — stored on this device only.",
      "lesson.saveNote": "Save note",
      "lesson.noteSaved": "Note saved locally.",
      "lesson.clearNote": "Clear note",
      "lesson.noteTooLong": "Note is long; the first 2000 characters were kept.",
      "lesson.relatedQuiz": "Related quiz",
      "lesson.relatedLab": "Related lab",
      "lesson.noRelated": "No extra links yet.",
      "review.title": "Transparent local review",
      "review.sub": "A list of mistakes, unfinished lessons, bookmarked topics and previous review dates — all from your device.",
      "review.empty": "No review items yet. Your mistakes, unfinished lessons and bookmarked topics will appear here.",
      "review.reasonMissed": "Question you missed",
      "review.reasonUnfinished": "Unfinished lesson",
      "review.reasonBookmark": "Bookmarked topic",
      "review.reasonStale": "Due for review",
      "review.lastReview": "Last review: {date}",
      "review.neverReviewed": "Not reviewed yet",
      "review.showing": "Showing {shown} of {total}",
      "review.startMistakes": "Review mistakes",
      "review.startFive": "Five-minute practice",
      "review.close": "Close review",
      "review.next": "Next",
      "review.finish": "Finish",
      "review.gotIt": "Answered correctly — remove from mistakes",
      "review.markWrong": "Record as wrong",
      "review.reveal": "Reveal explanation",
      "review.timeLeft": "Remaining {time}",
      "review.timeUp": "Five minutes are up — only answered questions were saved.",
      "review.summary": "Result: {correct} correct of {answered} — remaining {remaining}",
      "review.noMistakes": "No saved mistakes yet.",
      "review.backToQuiz": "Back to quizzes",
      "review.openLesson": "Open lesson",
      "exam.title": "Exam preparation",
      "exam.sub": "Plan calmly — steady daily progress beats last-minute cramming.",
      "exam.datePrompt": "Set your exam date (optional) to get a countdown and daily recommendations based on your real progress.",
      "exam.dateLabel": "Exam date",
      "exam.save": "Save date",
      "exam.skip": "Maybe later",
      "exam.edit": "Edit date",
      "exam.remove": "Remove date",
      "exam.dateSaved": "Date saved — good luck, one step at a time.",
      "exam.dateRemoved": "Date removed — you can set it again any time.",
      "exam.invalidDate": "Could not read the date — please pick one from the date field.",
      "exam.daysLeft": "{days} days left — a small step every day adds up.",
      "exam.dayLeft": "One day left — review calmly and trust what you have learned.",
      "exam.today": "Exam day — take a deep breath, you are more ready than you think.",
      "exam.passed": "This date has passed — update it if another exam is coming.",
      "exam.dailyTitle": "Today's focus",
      "exam.dailyEmpty": "No recommendations right now — keep your calm pace.",
      "exam.recReview": "Review {count} questions you missed — fixing them is the fastest way to improve.",
      "exam.recWeak": "Revisit «{topic}» ({subject}) — it showed up in your mistakes.",
      "exam.recLesson": "Finish the lesson: {lesson}",
      "exam.recSubject": "Give {subject} some time today (readiness {pct}%).",
      "exam.recPractice": "Try a practice exam when you feel ready.",
      "exam.readinessTitle": "Subject readiness",
      "exam.readinessSub": "Real percentages from your data: quiz 50% · lessons 30% · mistake-free 20%",
      "exam.breakdown": "Quiz {quiz}% · lessons {lessons}% · mistake-free {mistakes}%",
      "exam.notTested": "Not tested yet",
      "exam.noLessons": "No linked lessons — weight moved to quiz and mistakes.",
      "exam.weakTitle": "Topics that deserve a gentle review",
      "exam.weakEmpty": "No weak topics recorded — great work!",
      "exam.missedCount": "{count} missed",
      "exam.practiceTitle": "Practice exam",
      "exam.practiceSub": "Real questions from every subject — no timer, no pressure.",
      "exam.start": "Start practice exam",
      "exam.progress": "Question {i} of {total}",
      "exam.from": "From: {subject}",
      "exam.next": "Next",
      "exam.finish": "Finish",
      "exam.correct": "Correct ✓",
      "exam.wrong": "Not quite — read the explanation calmly.",
      "exam.summaryTitle": "Practice exam result",
      "exam.summaryLine": "{correct} correct out of {total} ({pct}%)",
      "exam.encHigh": "Excellent! Keep this level with light review.",
      "exam.encMid": "Very good — focus on the topics you missed.",
      "exam.encLow": "A good start — every mistake today is a point tomorrow.",
      "exam.lastRun": "Last practice run: {pct}% on {date}",
      "exam.finalTitle": "Readiness summary",
      "exam.finalLine": "Overall readiness {pct}% — {note}",
      "exam.finalNoteHigh": "Strong readiness — just review your remaining mistakes.",
      "exam.finalNoteMid": "On the right track — keep focusing on weak topics.",
      "exam.finalNoteLow": "Every review day brings you closer — start with your least-ready subject.",
      "exam.finalNoData": "Start with one quiz or lesson and your real readiness will appear here.",
      "exam.openQuiz": "Open quizzes",
      "exam.openLessons": "Open lessons",
      "beginner.title": "New here? Start with these four steps",
      "beginner.s1": "Pick a subject from «Subjects» and read its description.", "beginner.s2": "Memorize the terms with quick flashcards.", "beginner.s3": "Quiz yourself on the subject and read each explanation.", "beginner.s4": "Apply with one interactive tool, then try a simulation lab.",
      "beginner.cta": "Take the first step", "beginner.pathCta": "Start the recommended path",
      "toolsEdu.notice": "⚠️ Educational tools that run locally in your browser — never enter real passwords, API keys, private tokens or any confidential data.",
      "toolsEdu.name": "Name", "toolsEdu.purpose": "Learning objective", "toolsEdu.safety": "Safety & limitations",
      "toolsEdu.tryExample": "Safe example", "toolsEdu.reset": "Reset", "toolsEdu.copy": "Copy output", "toolsEdu.copied": "✓ Copied",
      "toolsEdu.related": "Related", "toolsEdu.lessonChip": "Lesson", "toolsEdu.pathChip": "Path", "toolsEdu.quizChip": "Quiz",
      "labs.objective": "Objective", "labs.skills": "Skills practiced", "labs.hints": "Hints",
      "labs.markDone": "Mark lab as completed", "labs.markUndone": "Mark as not completed", "labs.completed": "Completed ✓",
      "labs.explainTitle": "What you learned",
      "labs.responsibleUse": "⚠️ Responsible use: this is an in-browser educational simulation — never try these techniques on systems or networks you do not own or lack written permission to test.",
      "labs.eyebrow": "Practical Labs",
      "labs.title": "Hands-on <em class=\"grad\">Labs</em> & Training",
      "labs.sub": "Four simulation labs that run entirely in your browser — from simulating attacks to incident response and real cipher work.",
      "labs.enter": "Enter the lab",
      "labs.redteam": "Offensive Lab", "labs.redteam.sub": "A Bash terminal, an injectable database and network packet building — see how attacks are executed and how they are blocked.",
      "labs.ir": "Incident Response", "labs.ir.sub": "Real-time simulation with a simplified SIEM dashboard, kill-chain timeline analysis and root-cause challenges.",
      "labs.crypto": "Crypto Lab", "labs.crypto.sub": "Vigenère, Enigma, step-by-step RSA and frequency analysis — watch encryption algorithms work live.",
      "labs.games": "CTF Challenges", "labs.games.sub": "Mini hacking scenarios (SQLi, port scans, DDoS) through a command console — solve and learn.",
      "progress.eyebrow": "Learning Progress",
      "progress.title": "Your progress <em class=\"grad\">on the platform</em>",
      "progress.sub": "Your quiz results and best scores are saved on this device only — pick up right where you left off.",
      "progress.resumeTitle": "Continue where you left off",
      "progress.atQuestion": "You are at question {i} of {total}",
      "progress.resumeBtn": "Resume quiz",
      "progress.restartBtn": "Restart quiz",
      "progress.bestTitle": "Your best results",
      "progress.best": "Latest result: {score} of {total}",
      "progress.retakeBtn": "Retake",
      "progress.emptyTitle": "You haven't started yet! 🎯",
      "progress.emptySub": "Take your first quiz in any subject and your results, best scores and progress will appear here — all saved on this device only.",
      "progress.emptyCta": "Start your first quiz",
      "about.sub": "An Arabic-first platform for Information Security diploma students that combines education with practical training — study the theory, then practice it with tools and labs.",
      "about.lead": "An Arabic-first, all-in-one platform for Information Security students: subject theory, practical tools, simulation labs, and a smart assistant that answers from the platform's own content — all running locally and offline.",
      "about.p1": "Organized content", "about.p1d": "For every subject: compilations, summaries, and a print-ready question bank.",
      "about.p2": "Smart quizzes", "about.p2d": "Instant explanation for every answer, best-score tracking, and resuming a previous attempt.",
      "about.p3": "Works offline", "about.p3d": "PWA technology — install the platform on your phone and use it offline.",
      "about.p4": "Full privacy", "about.p4d": "No accounts and no tracking — your results are saved on your device only.",
      "about.p5": "Practical training", "about.p5d": "Simulation labs for attacks, incident response and CTF challenges — right in the browser.",
      "about.p6": "Smart assistant", "about.p6d": "Answers your questions from the platform's own content — any time, even offline.",
      "onboarding.title": "Welcome to Information Security 👋",
      "onboarding.subtitle": "A few quick questions — we'll recommend a learning path. No registration needed.",
      "onboarding.skip": "Skip", "onboarding.next": "Next",
      "onboarding.back": "Back", "onboarding.finish": "Start learning",
      "onboarding.step1Title": "What's your current level?",
      "onboarding.step1Desc": "This helps us tailor your learning experience.",
      "onboarding.level.beginner": "Beginner — start from scratch",
      "onboarding.level.intermediate": "Intermediate — I have some background",
      "onboarding.level.advanced": "Advanced — I want depth",
      "onboarding.step2Title": "What interests you? (optional)",
      "onboarding.step2Desc": "Choose subjects you'd like to focus on.",
      "onboarding.subj.algorithms": "Algorithms", "onboarding.subj.osconcepts": "Operating Systems Concepts",
      "onboarding.subj.policy": "Policies, Legislation and Ethics",
      "onboarding.subj.components": "IT Systems Components", "onboarding.subj.design": "Cybersecurity Design Principles",
      "onboarding.step3Title": "Preferred learning style?",
      "onboarding.step3Desc": "You can combine multiple styles.",
      "onboarding.style.theory": "Theory",
      "onboarding.style.quizzes": "Quizzes",
      "onboarding.style.practical": "Practical training",
      "onboarding.recommendedTitle": "Recommended starting point",
      "onboarding.recommendedDesc": "Based on your choices, we recommend starting here:",
      "onboarding.summaryLevel": "Level: {level}",
      "onboarding.summarySubjects": "Subjects: {subjects}",
      "onboarding.summaryStyle": "Style: {style}",
      /* ---------- MODULE 54 · OnboardingTour — first-visit walkthrough (8 steps) ---------- */
      "tour.next": "Next",
      "tour.finish": "Finish tour",
      "tour.back": "Back",
      "tour.skip": "Skip tour",
      "tour.counter": "Step {i} of {n}",
      "tour.areaLabel": "Highlighted area:",
      "tour.hint": "Use Tab to move between the buttons · Esc to skip the tour.",
      "tour.s1Title": "Welcome to the Information Security platform 👋",
      "tour.s1Text": "An Arabic-first platform for learning information security: study the basics, test yourself and practise hands-on — all inside your browser.",
      "tour.s1Area": "the platform home screen",
      "tour.s2Title": "Your dashboard — progress",
      "tour.s2Text": "This is your progress summary: overall percentage, last lesson and the next step. Everything is saved on your device only.",
      "tour.s2Area": "the student dashboard",
      "tour.s3Title": "Paths, subjects and lessons",
      "tour.s3Text": "Structured paths that take you from the fundamentals to an advanced level. Pick a path and follow its lessons one by one.",
      "tour.s3Area": "learning paths and lessons",
      "tour.s4Title": "Quizzes and saved progress",
      "tour.s4Text": "Test yourself in every subject — your answers and score are saved automatically, and you can resume where you stopped.",
      "tour.s4Area": "quizzes",
      "tour.s5Title": "Labs and security tools",
      "tour.s5Text": "Practise what you learned: simulation labs and safe security tools that run inside the browser and offline.",
      "tour.s5Area": "practical labs and tools",
      "tour.s6Title": "Study materials and resources",
      "tour.s6Text": "Review terminology with flashcards, and open each subject's files, summaries and question banks from the Subjects section.",
      "tour.s6Area": "flashcards and study materials",
      "tour.s7Title": "The platform AI assistant",
      "tour.s7Text": "Ask it about any topic on the platform: it explains and recommends lessons and quizzes, and works locally inside your browser.",
      "tour.s7Area": "the platform assistant",
      "tour.s8Title": "Navigation and search",
      "tour.s8Text": "Use the top bar to move between sections, and open quick search with / or Ctrl+K.",
      "tour.s8Area": "the top navigation bar and search",
      "progress.lessons": "Lessons completed",
      "progress.labs": "Labs completed",
      "progress.flashcards": "Flashcards reviewed",
      "progress.paths": "Path progress",
      "progress.attempts": "Quiz attempts",
      "progress.reviewWrong": "Review incorrect answers",
      "progress.overall": "Overall progress",
      /* ---------- MODULE 48 · GlobalSearch (Phase 6) ---------- */
      "search.title": "Search the platform",
      "search.placeholder": "Search: lesson, path, tool, quiz, term…",
      "search.hint": "or Ctrl+K to open · Esc to close · ↑↓ to navigate",
      "search.empty": "No matching results — try another word.",
      "search.start": "Start typing to search lessons, learning paths, tools, quizzes and glossary terms.",
      "search.group.lesson": "Lessons",
      "search.group.path": "Learning paths",
      "search.group.tool": "Tools",
      "search.group.quiz": "Quizzes",
      "search.group.flash": "Flashcards",
      "search.group.term": "Glossary terms"
    },
  };

  /* ---------- quiz / shared chrome keys -------------------------------- */
  const QKEYS = {
    ar: {
      pickPrompt: "اختر المادة لبدء الاختبار التجريبي.",
      best: "أفضل: {pct}%", resume: "متابعة", clear: "مسح بياناتي",
      timed: "وضع الاختبار الموقوت ({sec} ثانية للسؤال)",
      score: "النتيجة: {n}", count: "السؤال {i} من {total}",
      restartSubject: "إعادة المادة", dataError: "تعذر تحميل البيانات حاليًا. يرجى تحديث الصفحة والمحاولة مرة أخرى.",
      retry: "إعادة المحاولة",
      next: "السؤال التالي", showResult: "عرض النتيجة",
      retake: "إعادة الاختبار", pickOther: "اختيار مادة أخرى",
      resBreakdown: "تفصيل الإجابات", resGood: " صحيحة", resBad: " خاطئة",
      resTimeout: " انتهى وقتها", resUnknown: " غير محسوبة",
      correct: "إجابة صحيحة ✓",
      wrong: "إجابة غير صحيحة ✗ — الصحيح: {ans}",
      timeout: "انتهى الوقت ⏱ — الصحيح: {ans}",
      explain: "💡 شرح الإجابة",
      resumed: "تم استئناف جلستك السابقة عند السؤال {i} من {total}.",
      resultIn: "درجتك في {sub}", timedSuffix: " (وضع موقوت)",
      bestSaved: "أفضل نتيجة محفوظة: {pct}%", newRec: " 🎉 رقم جديد!",
      noteHi: "ممتاز! أنت جاهز للاختبار.", noteMid: "جيد — راجع الملاحظات ثم أعد المحاولة.",
      noteLo: "تحتاج إلى مراجعة المادة ثم أعد الاختبار.",
      reviewTitle: "مراجعة الأخطاء — اقرأ شرح كل إجابة",
      catBreakdown: "تفصيل حسب الموضوع", catItem: "{cat}: {ok}/{n}",
      retryWrong: "إعادة الأسئلة الخاطئة", retryWrongNone: "لا شيء لإعادته — كل الإجابات صحيحة!",
      modePractice: "وضع التدريب", modeExam: "اختبار موقوت", modeBadgePractice: "تدريب", modeBadgeExam: "موقوت",
      continueLearn: "متابعة التعلم", continueLearnTo: "العودة إلى {path}"
    },
    en: {
      pickPrompt: "Pick a subject to start the practice exam.",
      best: "Best: {pct}%", resume: "Resume", clear: "Clear my data",
      timed: "Timed mode ({sec}s per question)",
      score: "Score: {n}", count: "Question {i} of {total}",
      restartSubject: "Restart subject", dataError: "Couldn't load the data right now. Please refresh and try again.",
      retry: "Try again",
      next: "Next question", showResult: "Show result",
      retake: "Retake exam", pickOther: "Choose another subject",
      resBreakdown: "Answer breakdown", resGood: " correct", resBad: " wrong",
      resTimeout: " timed out", resUnknown: " not counted",
      correct: "Correct ✓",
      wrong: "Wrong ✗ — correct: {ans}",
      timeout: "Time up ⏱ — correct: {ans}",
      explain: "💡 Explanation",
      resumed: "Resumed your saved session at question {i} of {total}.",
      resultIn: "Your score in {sub}", timedSuffix: " (timed)",
      bestSaved: "Best saved score: {pct}%", newRec: " 🎉 New record!",
      noteHi: "Excellent! You're ready for the exam.", noteMid: "Good — review the notes and try again.",
      noteLo: "You need to review the material, then retake the exam.",
      reviewTitle: "Review your mistakes — read each explanation",
      catBreakdown: "Category breakdown", catItem: "{cat}: {ok}/{n}",
      retryWrong: "Retry incorrect questions", retryWrongNone: "Nothing to retry — all correct!",
      modePractice: "Practice mode", modeExam: "Timed exam", modeBadgePractice: "Practice", modeBadgeExam: "Timed",
      continueLearn: "Continue learning", continueLearnTo: "Back to {path}"
    }
  };

let cur = "ar";
  try {
    const saved = Store.get("lang", null);
    if (saved === "ar" || saved === "en") cur = saved;
    else if (typeof navigator !== "undefined" && navigator.language && !/^ar/i.test(navigator.language)) cur = "en";
  } catch {}

  const listeners = [];

  /**
   * Translate a dictionary key with {placeholder} substitution.
   * @param {string} key Dictionary key.
   * @param {Object<string,string|number>=} params Values for {slots}.
   * @returns {string} Localized string (Arabic fallback, then the key).
   */
  function t(key, params) {
    const d = DICT[cur] || DICT.ar;
    let s = (key in d) ? d[key] : ((DICT.ar[key] != null) ? DICT.ar[key] : key);
    if (params) Object.keys(params).forEach((k) => { s = s.split("{" + k + "}").join(String(params[k])); });
    return s;
  }

  /** Quiz-chrome lookup (q.* keys). @param {string} key @param {Object=} p @returns {string} */
  function qt(key, p) {
    const d = QKEYS[cur] || QKEYS.ar;
    let s = (key in d) ? d[key] : QKEYS.ar[key];
    if (p) Object.keys(p).forEach((k) => { s = s.split("{" + k + "}").join(String(p[k])); });
    return s;
  }

  /** Apply the active locale to document chrome. @returns {void} */
  function apply() {
    const root = document.documentElement;
    root.lang = cur;
    root.dir = cur === "ar" ? "rtl" : "ltr";
    document.title = t("meta.title");
    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    $$("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    /* Placeholder text (e.g. the search box) — same t() contract. */
    $$("[data-i18n-placeholder]").forEach((el) => { el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder"))); });
    /* Localized SEO description — kept in sync with the interface language. */
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", t("meta.description"));
    const btn = $id("langToggle");
    if (btn) {
      const label = btn.querySelector(".lang-current");
      if (label) label.textContent = cur === "ar" ? "EN" : "ع";
      const tip = cur === "ar" ? "Switch to English" : "التبديل إلى العربية";
      btn.title = tip;
      btn.setAttribute("aria-label", tip);
      btn.setAttribute("aria-pressed", String(cur === "ar"));
    }
    listeners.forEach((fn) => { try { fn(cur); } catch {} });
  }

  /** Flip AR↔EN, persist, re-apply chrome, notify subscribers. @returns {void} */
  function toggle() {
    cur = cur === "ar" ? "en" : "ar";
    try { Store.set("lang", cur); } catch {}
    apply();
  }

  /**
   * Subscribe to locale changes (dynamic views re-render on switch).
   * @param {function(string): void} fn Callback receiving the new locale.
   * @returns {void}
   */
  function onSwitch(fn) { if (typeof fn === "function") listeners.push(fn); }

  const langBtn = $id("langToggle");
  if (langBtn) langBtn.addEventListener("click", toggle);
  apply();

  return { t, qt, apply, toggle, onSwitch, get current() { return cur; } };
})();
  /* MODULE 43 · SemesterDashboard — وي hijack safety note:
     The module sits OUTSIDE the main IIFE (which closes around the line
     where MODULE 22 returns). When it runs as a classic sibling script it
     sees the top-level Lang, QUIZZES, Store, escHtml, etc. by scope
     chaining. When any of those are undefined it falls back safely and
     never emits raw dot-notation keys into the DOM. */



/* Expose Lang globally: the top-level modules that follow the main IIFE
   (MODULE 43 · SemesterDashboard, MODULE 47 · HeroDash, MODULE 48 ·
   GlobalSearch) sit OUTSIDE the IIFE scope and cannot see the module-level
   `const Lang`. Without this exposure they would fall back to a raw-key
   stub and render dot-notation keys ("semester.program") instead of
   translated text. */
window.Lang = Lang;

/* ============================================================
   MODULE 23 · PWA — service worker registration
   Silently skipped on file:// or unsupported browsers.
   ============================================================ */
(function initPwa() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
})();

/* ============================================================
   MODULE 24 · CyberGames — Incident Response Simulator & CTF
   Serious-mode lab: a terminal ("IR console") where the student
   reacts to live alerts (SQLi, port scan, DDoS, Caesar cipher),
   issues mitigation commands, and extracts a CTF flag.
   - Vanilla JS only · own state machine · localStorage under
     "motmi-portal:games" · one managed clock interval, always
     cleared on quit/win · every dynamic string through escG().
   ============================================================ */
(() => {
  "use strict";

  const GNS = "motmi-portal:games";

  /** Shorthand getElementById (module-local). @param {string} id @returns {HTMLElement|null} */
  const $g = (id) => document.getElementById(id);
  /** Escape HTML-significant characters (module-local). @param {string} s @returns {string} */
  const escG = (s) => String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  /** @type {{best:Object<string,number>,done:Object<string,boolean>}} */
  let save = { best: {}, done: {} };

  /** Load persisted game save. @returns {void} */
  function loadSave() {
    try {
      const raw = localStorage.getItem(GNS);
      if (raw) save = Object.assign(save, JSON.parse(raw));
    } catch {}
  }
  /** Persist current save. @returns {void} */
  function persist() {
    try { localStorage.setItem(GNS, JSON.stringify(save)); } catch {}
  }

  const SCENARIOS = {

    sqli: {
      key: "sqli", title: "SQL Injection — orders", domain: "قواعد البيانات", cost: 200,
      brief: "وصلك تنبيه أداة فحص تطبيقات: يُدخل المهاجم شيفرات حقن على نموذج تسجيل الدخول (/orders/login). اثبت الثغرة، أغلقها بجعل الاستعلامات معاملية (parameterized)، أكّد المنع، ثم استخرج العَلَم.",
      hint: "جرّب query مع ' OR 1=1 -- ثم patch param، وأعد نفس الحمولة للتأكيد أنها أصبحت BLOCKED.",
      boot(ctx) {
        ctx.S.patched = false; ctx.S.verified = false;
        ctx.lines.push(
          ["SYS: IDS alert #9917 — ' OR 1=1 -- signature on /orders/login", "cmd-sys"],
          ["INFO: web service up (80/tcp) · db=orders · auth.php", "cmd-neutral"],
          ["INFO: use: query <payload> | patch param | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "query") {
          const payload = args.join(" ").toLowerCase();
          if (!payload) return [["usage: query <payload>", "cmd-warn"]];
          const evil = payload.includes("or 1=1") || payload.includes("'") ||
            payload.includes("union") || payload.includes("--") || payload.includes(";");
          if (evil && S.patched) {
            S.verified = true;
            return [["[db] BLOCKED by WAF → 0 rows · parameterized query rejected payload", "cmd-ok"]];
          }
          if (evil) return [["[db] AUTH OK: 1 row ← الحقل يُدمج في SQL مباشرة!", "cmd-bad"]];
          return [["[db] 0 rows — payload لم يُحدث تغييرًا", "cmd-neutral"]];
        }
        if (cmd === "patch") {
          const mode = (args[0] || "").toLowerCase();
          if (mode === "param" || mode === "parameterized") {
            S.patched = true;
            return [["[db] تحويل الاستعلامات إلى Prepared Statements — مكتمل.", "cmd-ok"]];
          }
          return [["usage: patch param   (تفعيل الاستعلامات المعاملية)", "cmd-warn"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["WAF/param", S.patched ? "ON" : "OFF", S.patched ? "sv-up" : "sv-down"],
          ["injection blocked", S.verified ? "VERIFIED" : "—", S.verified ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{SQLi_param}",
      solved(ctx) { return Boolean(ctx.S.patched && ctx.S.verified); }
    },

    portscan: {
      key: "portscan", title: "فحص منافذ — 10.0.7.14", domain: "الشبكات", cost: 200,
      brief: "يُظهر التقاط الشبكة موجات TCP SYN من 192.0.2.66 صوب الخادم 10.0.7.14. حدّد المنفذ المكشوف الذي يخدم قاعدة البيانات واحجبه بقاعدة جدار نار، ثم استخرج العَلَم.",
      hint: "افحص المنافذ المفتوحة (scan) — أي منفذ قاعدة بيانات مكشوف؟ احجبه بـ block <port>.",
      boot(ctx) {
        ctx.S.blocked = null;
        ctx.lines.push(
          ["SYS: IDS alert #9920 — port scan from 192.0.2.66", "cmd-sys"],
          ["INFO: use: scan | block <port> | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "scan") {
          return [
            ["[scan] 10.0.7.14 open ports:", "cmd-neutral"],
            ["       22/tcp    ssh      OPEN", "cmd-neutral"],
            ["       80/tcp    http     OPEN", "cmd-neutral"],
            ["       443/tcp   https    OPEN", "cmd-neutral"],
            ["       3306/tcp  mysql    OPEN   ← خدمة قاعدة بيانات!", "cmd-bad"],
            ["       5900/tcp  vnc      CLOSED", "cmd-neutral"],
            ["       8080/tcp  proxy    FILTERED", "cmd-neutral"]
          ];
        }
        if (cmd === "block") {
          const port = (args[0] || "").trim();
          if (port === "3306") {
            S.blocked = port;
            return [[`[fw] rule added: DROP 192.0.2.66 → 10.0.7.14:${port}`, "cmd-ok"]];
          }
          if (/^\d+$/.test(port)) return [[`[fw] تم قبول القاعدة (${port}) لكن المهاجم يواصل فحص منافذ أخرى.`, "cmd-warn"]];
          return [["usage: block <port>", "cmd-warn"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["mysql 3306 exposure", S.blocked === "3306" ? "BLOCKED" : "EXPOSED", S.blocked === "3306" ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{NET_firewall}",
      solved(ctx) { return ctx.S.blocked === "3306"; }
    },

    ddos: {
      key: "ddos", title: "DDoS SYN Flood — gateway", domain: "الشبكات", cost: 250,
      brief: "هجوم حجب خدمة (DDoS) يُغرق البوابة بحزم SYN من مصدرين. طبّق حدًا للطلبات (rate limit) ثم احجب العنوانين الخبيثين، ثم استخرج العَلَم.",
      hint: "ضع ratelimit ثم احجب المصدرين 192.0.2.66 و 198.51.100.23 (راجع status للتأكد).",
      boot(ctx) {
        ctx.S.limit = null; ctx.S.blocked = [];
        ctx.lines.push(
          ["SYS: IDS alert #9933 — SYN flood @ gateway 10.0.7.1", "cmd-sys"],
          ["INFO: sources: 192.0.2.66 · 198.51.100.23", "cmd-neutral"],
          ["INFO: use: ratelimit <n> | block <ip> | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "ratelimit") {
          const n = Number(args[0]);
          if (Number.isFinite(n) && n >= 1 && n <= 100) {
            S.limit = n;
            return [[`[fw] rate-limit: ${n} req/s لكل مصدر — مطبق.`, "cmd-ok"]];
          }
          return [["usage: ratelimit <1-100>", "cmd-warn"]];
        }
        if (cmd === "block") {
          const ip = (args[0] || "").trim();
          if (ip === "192.0.2.66" || ip === "198.51.100.23") {
            if (!S.blocked.includes(ip)) S.blocked.push(ip);
            return [[`[fw] rule added: DROP ${ip} (syncookie مفعّل).`, "cmd-ok"]];
          }
          return [["[fw] عنوان غير موجود في سجلات التدفق — تحقق بـ status", "cmd-warn"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["rate-limit", S.limit ? S.limit + " req/s" : "—", S.limit ? "sv-up" : "sv-down"],
          ["blocked sources", S.blocked.length + "/2", S.blocked.length === 2 ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{DDoS_mitigated}",
      solved(ctx) { return Boolean(ctx.S.limit !== null && ctx.S.blocked.length === 2); }
    },

    caesar: {
      key: "caesar", title: "فك رسالة Caesar", domain: "التشفير", cost: 150,
      brief: "اعترضت أجهزة الرصد رسالة مشفّرة بتعويض أحرف (Caesar) في حزمة UDP على منفذ غير معهود. حدّد الإزاحة، فكّ الرسالة، ثم سلّم العَلَم.",
      hint: "جرّب brute للرسالة (ZLZZPVU PK SLHRLK) أو decrypt مع إزاحة 1..25 حتى تظهر عبارة واضحة.",
      boot(ctx) {
        ctx.S.decrypted = false; ctx.S.CIPHER = "ZLZZPVU PK SLHRLK";
        ctx.lines.push(
          ["SYS: packet capture — suspicious UDP payload", "cmd-sys"],
          ["INFO: ciphertext: ZLZZPVU PK SLHRLK", "cmd-neutral"],
          ["INFO: use: decrypt <text> <shift> | brute <text> | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "decrypt") {
          if (args.length < 2) return [["usage: decrypt <text> <shift>", "cmd-warn"]];
          const shift = Number(args.pop());
          if (!Number.isFinite(shift) || shift < 0 || shift > 25) return [["الإزاحة يجب أن تكون بين 0 و 25", "cmd-warn"]];
          const text = args.join(" ");
          /* User supplies the ENCRYPTION key; we invert to decrypt. */
          const plain = caesarShift(text, -shift);
          if (plain.toUpperCase() === "SESSION ID LEAKED") {
            S.decrypted = true;
            return [[`[crypto] ${plain}   ← الرسالة واضحة! سلّم العَلَم الآن.`, "cmd-ok"]];
          }
          return [[`[crypto] ${plain}`, "cmd-neutral"]];
        }
        if (cmd === "brute") {
          const text = args.join(" ") || S.CIPHER;
          const rows = [];
          for (let s = 1; s <= 25; s++) {
            const p = caesarShift(text, -s);
            rows.push([`  key ${String(s).padStart(2, "0")}: ${p}`,
              p.toUpperCase() === "SESSION ID LEAKED" ? "cmd-ok" : "cmd-neutral"]);
          }
          if (rows.some((r) => r[1] === "cmd-ok")) S.decrypted = true;
          return [["[crypto] brute-force (reverse 25 keys):", "cmd-neutral"]].concat(rows);
        }
        if (cmd === "status") return statusView(ctx, [
          ["ciphertext", S.CIPHER, "sv-up"],
          ["decrypted", S.decrypted ? "YES" : "—", S.decrypted ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{CAESAR_session}",
      solved(ctx) { return ctx.S.decrypted; }
    },

    /* OWASP Top 10 labs (Red Team) — same boot/cmd/flag/solved contract. */

    idor: {
      key: "idor", title: "A01 Broken Access Control — IDOR", domain: "أمن التطبيقات", cost: 250,
      brief: "واجهة /api/users بدون تحقق من الصلاحية (IDOR). اثبت أنك عدّلت حسابًا لا تملكه ثم عالج الثغرة بتحقق صريح.",
      hint: "whoami ثم remove 7 (حساب ضحية) ثم fix acl ثم أعد نفس الأمر لترى المنع.",
      boot(ctx) {
        ctx.S.pwn = false; ctx.S.fixed = false;
        ctx.lines.push(
          ["SYS: مراجعة واجهات API — غياب فحص الصلاحية في /api/users", "cmd-sys"],
          ["INFO: whoami | remove <id> | fix acl | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "whoami") return [["[api] id=42 · دور=user — لا تملك صلاحية الإدارة.", "cmd-neutral"]];
        if (cmd === "remove") {
          const id = (args[0] || "").trim();
          if (!id) return [["usage: remove <id>", "cmd-warn"]];
          if (S.fixed) return [["[api] 403 — رُفض: التحقق من ملكية المورد مفعّل.", "cmd-fail"]];
          if (id === "7") {
            S.pwn = true;
            return [["[api] ✅ حُذف حساب المستخدم 7 وأنت id=42! ثغرة IDOR مثبتة.", "cmd-bad"], ["[api] عالجها: fix acl", "cmd-warn"]];
          }
          return [["[api] تمت العملية — لكن جرّب remove 7 لإثبات الثغرة.", "cmd-neutral"]];
        }
        if (cmd === "fix") {
          if (args[0] !== "acl") return [["usage: fix acl", "cmd-warn"]];
          S.fixed = true;
          return [["[api] ✅ فحص ملكية صريح (ownership check) على كل عمليات التعديل.", "cmd-ok"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["id", "42 (user)", "sv-up"],
          ["IDOR proven", S.pwn ? "YES" : "—", S.pwn ? "sv-up" : "sv-down"],
          ["ACL fixed", S.fixed ? "YES" : "—", S.fixed ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{IDOR_fixed}",
      solved(ctx) { return ctx.S.pwn && ctx.S.fixed; }
    },

    cmdi: {
      key: "cmdi", title: "A03 Command Injection — pinger", domain: "أمن التطبيقات", cost: 250,
      brief: "أداة ping تمزج المدخلات في أمر النظام (command injection). اثبت التنفيذ ثم عالجها بفحص صارم للمدخلات.",
      hint: "جرّب ping 127.0.0.1; whoami ثم fix input-validation ثم أعد الحقن.",
      boot(ctx) {
        ctx.S.injected = false; ctx.S.fixed = false;
        ctx.lines.push(
          ["SYS: IDS alert — حمولة ';' في طلبات أداة ping", "cmd-sys"],
          ["INFO: ping <target> | fix input-validation | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "ping") {
          const target = args.join(" ");
          if (!target) return [["usage: ping <target>", "cmd-warn"]];
          if (S.fixed) return [["[app] تمرير آمن كمُعامَل — لا تنفيذ أوامر إضافية.", "cmd-fail"]];
          if (/[;&|`]/.test(target)) {
            S.injected = true;
            return [
              ["[sh] PING OK — 3 received, 0% loss", "cmd-neutral"],
              ["[sh] uid=0(root) ← نُفّذ أمرك داخل الخادم! ثغرة حقن أوامر.", "cmd-bad"],
              ["[app] عالجها: fix input-validation", "cmd-warn"]
            ];
          }
          return [["[sh] PING " + target + " — 3 received, 0% loss", "cmd-neutral"]];
        }
        if (cmd === "fix") {
          if (args[0] !== "input-validation") return [["usage: fix input-validation", "cmd-warn"]];
          S.fixed = true;
          return [["[app] ✅ المدخلات تُمرَّر كمُعامَل/قائمة بيضاء — لا سلسلة أوامر.", "cmd-ok"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["injection shown", S.injected ? "PROVEN" : "—", S.injected ? "sv-up" : "sv-down"],
          ["fixed", S.fixed ? "YES" : "—", S.fixed ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{CMDI_contained}",
      solved(ctx) { return ctx.S.injected && ctx.S.fixed; }
    },
    xss: {
      key: "xss", title: "A03 Stored XSS — comment board", domain: "أمن التطبيقات", cost: 250,
      brief: "لوحة تعليقات تخزّن المدخلات وتعيد عرضها دون ترميز. حقن سكربت ثم عالج العرض بترميز المخرجات.",
      hint: "post <script>alert(1)</script> ثم view ثم fix output-encoding",
      boot(ctx) {
        ctx.S.posted = []; ctx.S.injected = false; ctx.S.fixed = false;
        ctx.lines.push(
          ["SYS: نمط '<script' ملاحظ في تعليقات الموقع", "cmd-sys"],
          ["INFO: post <نص> | view | fix output-encoding | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "post") {
          const text = args.join(" ") || "";
          if (!text) return [["usage: post <text>", "cmd-warn"]];
          S.posted.push(text);
          if (/<script/i.test(text)) S.injected = true;
          return [
            ["[board] ◉ نُشرت التعليقات.", S.fixed ? "cmd-neutral" : "cmd-bad"],
            ...(S.injected && !S.fixed
              ? [["[board] ⚠️ ستنفَّذ سكربتاتك لمتصفحات الزوار! ثغرة XSS مخزنة.", "cmd-bad"], ["[app] عالجها: fix output-encoding", "cmd-warn"]]
              : [])
          ];
        }
        if (cmd === "view") {
          if (!S.posted.length) return [["[board] لا تعليقات بعد.", "cmd-neutral"]];
          const rows = S.posted.map((t) => {
            const shown = S.fixed ? t.replace(/</g, "&lt;") : t;
            return ["  " + shown, (S.injected && !S.fixed) ? "cmd-bad" : "cmd-neutral"];
          });
          return [[S.fixed ? "[board] العرض مُرمَّز (آمن):" : "[board] العرض الخام (دون ترميز):", "cmd-neutral"]].concat(rows);
        }
        if (cmd === "fix") {
          if (args[0] !== "output-encoding") return [["usage: fix output-encoding", "cmd-warn"]];
          S.fixed = true;
          return [["[app] ✅ ترميز المخرجات (HTML-escape) مفعّل — التعليقات آمنة.", "cmd-ok"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["XSS injected", S.injected ? "YES" : "—", S.injected ? "sv-up" : "sv-down"],
          ["output encoding", S.fixed ? "ON" : "OFF", S.fixed ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{XSS_encoded}",
      solved(ctx) { return ctx.S.injected && ctx.S.fixed; }
    },

    misconfig: {
      key: "misconfig", title: "A05 Security Misconfiguration", domain: "إدارة التكوين", cost: 200,
      brief: "خادم ويب تُفعَّل فيه فهرسة المجلدات ويُترك التصحيح ممكّنًا. اكتشف النسخ الاحتياطية المكشوفة ثم عالج التهيئة.",
      hint: "ls /admin ثم fetch backup.zip ثم fix headers",
      boot(ctx) {
        ctx.S.leaked = false; ctx.S.fixed = false;
        ctx.lines.push(
          ["SYS: scan — فهرسة مجلدات مكشوفة في /admin", "cmd-sys"],
          ["INFO: ls <dir> | fetch <file> | fix headers | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "ls") {
          const dir = (args[0] || "").trim() || "/admin";
          if (dir === "/admin") {
            return S.fixed
              ? [["[web] /admin → 403 · فهرسة معطّلة · رؤوس آمنة", "cmd-fail"], ["[web] البوابة الحالية آمنة.", "cmd-neutral"]]
              : [["[web] Index of /admin:", "cmd-bad"], ["  backup.zip", "cmd-neutral"], ["  config.old", "cmd-neutral"], ["  ← فهرسة مفعّلة! ملفات حساسة مكشوفة.", "cmd-warn"]];
          }
          return [["[web] 404 — لا شيء هنا.", "cmd-neutral"]];
        }
        if (cmd === "fetch") {
          const f = (args[0] || "").trim();
          if (f === "backup.zip" || f === "config.old") {
            S.leaked = true;
            return [["[web] محتوى " + f + ":", "cmd-bad"], ["  env: DB_PASS=admin123 · DEBUG=true · server_tokens=full", "cmd-bad"], ["  ← تسريب إعدادات إنتاجية! عالجها: fix headers", "cmd-warn"]];
          }
          return [["[web] 404", "cmd-neutral"]];
        }
        if (cmd === "fix") {
          if (args[0] !== "headers") return [["usage: fix headers", "cmd-warn"]];
          S.fixed = true;
          return [["[web] ✅ إيقاف الفهرسة · server_tokens=off · DEBUG=false · رؤوس صارمة.", "cmd-ok"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["leak shown", S.leaked ? "YES" : "—", S.leaked ? "sv-up" : "sv-down"],
          ["fixed", S.fixed ? "YES" : "—", S.fixed ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{misconfig_hardened}",
      solved(ctx) { return ctx.S.leaked && ctx.S.fixed; }
    },
    authfail: {
      key: "authfail", title: "A07 Auth Failures — login", domain: "أمن التطبيقات", cost: 200,
      brief: "بوابة دخول ببيانات افتراضية وبدون قفل/حدّ محاولات أو MFA. جرّب بيانات معروفة ثم فعّل الحماية.",
      hint: "login admin 12345 ثم fix lockout ثم أعد login لترى المنع.",
      boot(ctx) {
        ctx.S.weak = false; ctx.S.fixed = false;
        ctx.lines.push(
          ["INFO: بوابة الدخول — الدعم الفني ترك بيانات افتراضية!", "cmd-sys"],
          ["INFO: login <user> <pass> | fix lockout | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "login") {
          const user = (args[0] || "").trim(), pass = (args[1] || "").trim();
          if (!user || !pass) return [["usage: login <user> <pass>", "cmd-warn"]];
          if (S.fixed) return [["[auth] 403 — الحساب مُقفل (5 محاولات) + MFA مطلوبة.", "cmd-fail"]];
          if (user === "admin" && (pass === "12345" || pass === "admin")) {
            S.weak = true;
            return [["[auth] ✅ دخول ناجح ببيانات افتراضية! لا قفل ولا حد محاولات — ثغرة A07.", "cmd-bad"], ["[auth] عالجها: fix lockout", "cmd-warn"]];
          }
          return [["[auth] فشل — لكن لاحظ: لا حدّ لعدد المحاولات (∞).", "cmd-neutral"]];
        }
        if (cmd === "fix") {
          if (args[0] !== "lockout") return [["usage: fix lockout", "cmd-warn"]];
          S.fixed = true;
          return [["[auth] ✅ قفل بعد 5 محاولات + MFA + إجبار تغيير البيانات الافتراضية.", "cmd-ok"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["weak login shown", S.weak ? "YES" : "—", S.weak ? "sv-up" : "sv-down"],
          ["hardened", S.fixed ? "YES" : "—", S.fixed ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{auth_hardened}",
      solved(ctx) { return ctx.S.weak && ctx.S.fixed; }
    },

    ssrf: {
      key: "ssrf", title: "A08 SSRF — image proxy", domain: "أمن التطبيقات", cost: 250,
      brief: "خدمة جلب صور تجلب أي URL دون قائمة بيضاء. اثبت الوصول إلى البيانات الوصفية الداخلية ثم عالجها.",
      hint: "fetch http://169.254.169.254/latest/meta-data ثم fix allowlist",
      boot(ctx) {
        ctx.S.ssrf = false; ctx.S.fixed = false;
        ctx.lines.push(
          ["INFO: خدمة تحميل الصور — fetch <url>", "cmd-sys"],
          ["INFO: fetch <url> | fix allowlist | status | flag <v>", "cmd-neutral"]
        );
      },
      cmd(ctx, cmd, args) {
        const S = ctx.S;
        if (cmd === "fetch") {
          const url = (args[0] || "").trim();
          if (!url) return [["usage: fetch <url>", "cmd-warn"]];
          if (S.fixed) return [["[proxy] 403 — خارج القائمة البيضاء.", "cmd-fail"]];
          if (/169\.254\.169\.254/.test(url) || /metadata/i.test(url)) {
            S.ssrf = true;
            return [["[proxy] ❗ وصَلت إلى البيانات الوصفية الداخلية:", "cmd-bad"], ["  role: ir-admin · secret: sk-ir-7f3… (جزئي)", "cmd-bad"], ["  ← ثغرة SSRF! عالجها: fix allowlist", "cmd-warn"]];
          }
          return [["[proxy] جُلبت " + url + " (صورة) بنجاح.", "cmd-neutral"]];
        }
        if (cmd === "fix") {
          if (args[0] !== "allowlist") return [["usage: fix allowlist", "cmd-warn"]];
          S.fixed = true;
          return [["[proxy] ✅ قائمة بيضاء (https فقط) + منع العناوين الداخلية وميتاداتا السحابة.", "cmd-ok"]];
        }
        if (cmd === "status") return statusView(ctx, [
          ["SSRF shown", S.ssrf ? "YES" : "—", S.ssrf ? "sv-up" : "sv-down"],
          ["allowlist", S.fixed ? "ON" : "OFF", S.fixed ? "sv-up" : "sv-down"]
        ]);
        return null;
      },
      flag: "MOTMI{SSRF_allowlisted}",
      solved(ctx) { return ctx.S.ssrf && ctx.S.fixed; }
    }
  };

  /** Shift Latin letters in a string (Caesar, signed). @param {string} text @param {number} k @returns {string} */
  function caesarShift(text, k) {
    return text.replace(/[a-zA-Z]/g, (ch) => {
      const base = ch <= "Z" ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + k) % 26 + 26) % 26 + base);
    });
  }

  /** Build a status listing; syncs the side panel. @param {object} ctx @param {Array<Array<string>>} rows @returns {Array<Array<string>>} */
  function statusView(ctx, rows) {
    renderSide(rows);
    return [["[status]", "cmd-neutral"]]
      .concat(rows.map((r) => [r[0] + ": " + r[1], r[2] || "cmd-neutral"]));
  }

  /* ---------- live game context & engine ------------------------------ */
  /** @type {object|null} Active context (null when in menu). */
  let ctx = null;
  /** @type {number|null} Managed clock interval id. */
  let clockId = null;
  let startedAt = 0;

  /** Print one or more lines to the console log. @param {Array<Array<string>>} items @returns {void} */
  function print(items) {
    const log = $g("gameConsoleLog");
    if (!log) return;
    (Array.isArray(items[0]) ? items : [items]).forEach((pair) => {
      const line = document.createElement("p");
      line.className = "cmd-line " + (pair[1] || "cmd-neutral");
      line.textContent = pair[0];
      log.appendChild(line);
    });
    log.scrollTop = log.scrollHeight;
  }

  /** Boot a scenario into the play screen. @param {string} key @returns {void} */
  function boot(key) {
    const sc = SCENARIOS[key];
    if (!sc) return;
    stopClock();
    ctx = { key, S: {}, bad: 0, hints: 0, solved: false, lines: [] };
    startedAt = Date.now();
    sc.boot(ctx);
    renderPlay(key);
    const log = $g("gameConsoleLog");
    if (log) log.innerHTML = "";
    ctx.lines.forEach((l) => print(l));
    print([["— type help for commands —", "cmd-neutral"]]);
    renderSide([]);
    startClock();
  }

  /** Start the mm:ss clock (one managed interval). @returns {void} */
  function startClock() {
    stopClock();
    clockId = setInterval(() => {
      const el = $g("gameTimer");
      if (!el || !ctx) return;
      const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      el.textContent = String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
      el.classList.toggle("is-low", s > 180);
    }, 1000);
  }

  /** Clear the managed clock interval. @returns {void} */
  function stopClock() {
    if (clockId !== null) { clearInterval(clockId); clockId = null; }
  }

  /** Win path: save best, mark done, announce verdict on screen. @param {object} sc @returns {void} */
  function win(sc) {
    stopClock();
    ctx.solved = true;
    const secs = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const timeBonus = Math.max(0, 50 - Math.floor(secs / 6));
    let pts = Math.max(20, sc.cost - ctx.bad * 5 - ctx.hints * 10 + timeBonus);
    save.done[sc.key] = true;
    save.best[sc.key] = Math.max(save.best[sc.key] || 0, pts);
    persist();
    print([
      [`[+] FLAG ACCEPTED: ${sc.flag}`, "cmd-flag"],
      [`[+] solved in ${secs}s · نقاط: ${pts} (أفضل محفوظ: ${save.best[sc.key]})`, "cmd-ok"],
      ["[+] اضغط quit للعودة إلى قائمة السيناريوهات.", "cmd-neutral"]
    ]);
    renderSide([["status", "SOLVED", "sv-up"]]);
  }

  /** Parse & run one command line. @param {string} raw @returns {void} */
  function handle(raw) {
    if (!ctx) return;
    const t = raw.trim();
    print([["> " + t, "cmd-neutral"]]);
    if (!t) return;
    const parts = t.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd === "help") { print([[helpText(), "cmd-neutral"]]); return; }
    if (cmd === "hint") {
      if (ctx.hints >= 1) { print([["hint: لا تلميحات إضافية — راجع brief و status.", "cmd-warn"]]); return; }
      ctx.hints++;
      print([[`hint: ${SCENARIOS[ctx.key].hint}`, "cmd-warn"]]);
      return;
    }
    if (cmd === "clear") { const log = $g("gameConsoleLog"); if (log) log.innerHTML = ""; return; }
    if (cmd === "quit") { stopClock(); renderMenu(); return; }

    const sc = SCENARIOS[ctx.key];

    /* CTF flag submission: must match the scenario flag exactly. */
    if (cmd === "flag") {
      const val = args.join(" ").trim();
      if (!val) { print([["usage: flag <value>", "cmd-warn"]]); return; }
      if (ctx.solved) { print([["الحالة محسومة والعَلَم مقبول قبلاً — اضغط quit للعودة.", "cmd-warn"]]); return; }
      if (val.toUpperCase() === sc.flag.toUpperCase()) { win(sc); return; }
      ctx.bad++;
      print([["FLAG_REJECTED — قيمة غير صحيحة. أكمل التخفيف أولًا.", "cmd-bad"]]);
      return;
    }

    let out = null;
    try { out = sc.cmd(ctx, cmd, args); } catch (e) { out = null; }
    if (out) print(out);
    else {
      ctx.bad++;
      print([["unknown command: " + cmd + "  (try help)", "cmd-bad"]]);
    }

    /* Mitigation complete → reveal the flag so the student submits it. */
    if (!ctx.solved && !ctx.revealed && sc.solved(ctx)) {
      ctx.revealed = true;
      print([[`[+] تم تحييد التهديد! العَلَم: ${sc.flag}`, "cmd-flag"]]);
      print([[`[+] سلّمه الآن عبر: flag ${sc.flag}`, "cmd-ok"]]);
    }
  }

  /** Static help text. @returns {string} */
  function helpText() {
    return "أوامر متاحة:\n" +
      "  help / hint / status / clear / quit\n" +
      "سيناريو SQLi :   query <payload> · patch param · flag <v>\n" +
      "فحص منافذ    :   scan · block <port> · flag <v>\n" +
      "DDoS          :   ratelimit <n> · block <ip> · flag <v>\n" +
      "Caesar        :   decrypt <text> <shift> · brute <text> · flag <v>\n" +
      "OWASP labs    :   كل مخبر يكشف أوامره عبر help أثناء السيناريو · flag <v>";
  }

  /*  ---------- render & wiring ------------------------------------------ */
  /** Render the menu panel. @returns {void} */
  function renderMenu() {
    ctx = null; stopClock();
    const menu = $g("gameMenu"), play = $g("gamePlay");
    if (menu) menu.classList.remove("is-hidden");
    if (play) play.classList.add("is-hidden");

    const list = $g("gamesScenarios");
    if (list) {
      list.innerHTML = "";
      Object.keys(SCENARIOS).forEach((key) => {
        const sc = SCENARIOS[key];
        const done = Boolean(save.done[key]);
        const best = save.best[key];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "games-sc" + (done ? " s-done" : "");
        btn.setAttribute("role", "listitem");
        btn.innerHTML =
          '<div class="games-sc-head"><span class="games-sc-title">' + escG(sc.title) +
          '</span><span class="games-sc-domain">' + escG(sc.domain) + "</span></div>" +
          '<p class="games-sc-desc">' + escG(sc.brief) + "</p>" +
          (best != null
            ? '<p class="games-sc-best' + (done ? " s-done" : "") + '">🏆 أفضل نتيجة: ' + best + " نقطة</p>"
            : "");
        btn.addEventListener("click", () => boot(key));
        list.appendChild(btn);
      });
    }

    const pt = $g("gamesProgressTitle");
    if (pt) {
      const doneCount = Object.keys(SCENARIOS).filter((k) => save.done[k]).length;
      pt.textContent = "تقدمك: " + doneCount + " من " + Object.keys(SCENARIOS).length + " سيناريوهات";
    }
    const prog = $g("gamesProgress");
    if (prog) {
      prog.innerHTML = "";
      Object.keys(SCENARIOS).forEach((key) => {
        const done = Boolean(save.done[key]);
        const tag = document.createElement("span");
        tag.className = "tag" + (done ? " s-done" : "");
        tag.textContent = (done ? "✓ " : "○ ") + SCENARIOS[key].domain;
        prog.appendChild(tag);
      });
    }
  }

  /** Fill the play screen header (title, brief). @param {string} key @returns {void} */
  function renderPlay(key) {
    const sc = SCENARIOS[key];
    const menu = $g("gameMenu"), play = $g("gamePlay");
    if (menu) menu.classList.add("is-hidden");
    if (play) play.classList.remove("is-hidden");
    const t = $g("gameTitle"); if (t) t.textContent = sc.title;
    const d = $g("gameDomain"); if (d) d.textContent = sc.domain;
    const b = $g("gameBrief"); if (b) b.textContent = sc.brief;
  }

  /** Render the side "server status" panel (escaped). @param {Array<Array<string>>} rows @returns {void} */
  function renderSide(rows) {
    const side = $g("gameSide");
    if (!side) return;
    const data = rows.length ? rows : [["system", "idle", "sv-up"]];
    side.innerHTML = "<h3>حالة الخادم</h3><ul>" +
      data.map((r) => '<li><span class="k">' + escG(r[0]) + '</span><span class="' +
        escG(r[2] || "sv-up") + '">' + escG(r[1]) + "</span></li>").join("") +
      "</ul>";
  }

  loadSave();
  if ($g("gamesApp")) {
    const form = $g("gameConsoleForm");
    if (form) form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $g("gameConsoleInput");
      if (!input) return;
      handle(input.value);
      input.value = "";
    });
    const quitBtn = $g("gameQuit");
    if (quitBtn) quitBtn.addEventListener("click", renderMenu);
    renderMenu();
  }
})();

/* ============================================================
   MODULE 25 · TerminalFX — interactive CTF console driver
   ------------------------------------------------------------
   Runs `#gameConsoleForm` with a typewriter effect and a short
   SQL-injection scenario (scan then block-ip 192.168.1.50 → Flag).
   Reuses platform helpers ($id, escHtml) and existing .cmd-line /
   cmd-* styles — zero libraries, no new CSS classes. Uses ONE
   managed typewriter interval (auto-stopped/cleared). While a
   full CyberGames (MODULE 24) session is active it defers.
   ============================================================ */
(() => {
  "use strict";

  /** Flag awarded after neutralizing the SQL-injection source. @const {string} */
  const GAME_FLAG = "MOTMI{SQLi_192168150_blocked}";

  const formEl = $id("gameConsoleForm");
  const inputEl = $id("gameConsoleInput");
  const logEl = $id("gameConsoleLog");
  const menuEl = $id("gameMenu");
  const playEl = $id("gamePlay");

  /** @type {{scanned:boolean, solved:boolean}} In-memory lab state. */
  const STATE = { scanned: false, solved: false };

  /* ---------- typewriter engine ---------------------------------- */
  const TW_STEP_MS = 14; /** ms per typing step */
  const TW_PER_STEP = 2; /** chars advanced per step */
  let twTimer = null;    /** {number|null} single managed interval id */
  let twQueue = [];      /** {Array<{text:string,cls:string}>} pending lines */
  let twCursor = null;   /** {span,text,i}|null active typing line */

  /** Keep the active line visible. @returns {void} */
  function autoScroll() { if (logEl) logEl.scrollTop = logEl.scrollHeight; }

  /** Cancel any in-flight typing. @returns {void} */
  function twStop() { if (twTimer !== null) { clearInterval(twTimer); twTimer = null; } twCursor = null; }

  /** Queue lines and start the pump if idle. @param {Array<Array<string>>} lines @returns {void} */
  function typeLines(lines) {
    if (!logEl) return;
    lines.forEach(([t, c]) => twQueue.push({ text: String(t), cls: c || "cmd-neutral" }));
    if (twTimer !== null) return;
    twTimer = setInterval(typeTick, TW_STEP_MS);
  }

  /** Advance the typewriter one step; escHtml on completion. @returns {void} */
  function typeTick() {
    if (!twCursor) {
      const item = twQueue.shift();
      if (!item) { clearInterval(twTimer); twTimer = null; return; }
      const p = document.createElement("p");
      p.className = "cmd-line " + item.cls;
      const span = document.createElement("span");
      p.appendChild(span);
      logEl.appendChild(p);
      twCursor = { span, text: item.text, i: 0 };
      return;
    }
    const { span, text, i } = twCursor;
    const end = Math.min(text.length, i + TW_PER_STEP);
    span.textContent = text.slice(0, end);
    twCursor.i = end;
    autoScroll();
    if (end >= text.length) {
      span.innerHTML = escHtml(text);   /* sanitised final render */
      twCursor = null;
      if (twQueue.length === 0) { clearInterval(twTimer); twTimer = null; }
    }
  }

  /** Wipe the console immediately. @returns {void} */
  function clearLog() { twStop(); twQueue = []; if (logEl) logEl.innerHTML = ""; }

  /* ---------- command dispatcher (pure: returns printed lines) --------- */
  /** Help text. @returns {Array<Array<string>>} */
  function cmdHelp() {
    return [
      ["الأوامر المتاحة:", "cmd-neutral"],
      ["  help              — عرض هذه التعليمات", "cmd-neutral"],
      ["  scan              — فحص منافذ 192.168.1.50", "cmd-neutral"],
      ["  block-ip <عنوان>  - حجب مصدر مشبوه (يربح العَلم)", "cmd-neutral"],
      ["  status            - حالة الخادم والمستشعرات", "cmd-neutral"],
      ["  clear             - مسح الطرفية", "cmd-neutral"]
    ];
  }

  /** Fake port-scan that reveals the SQL-injection source. @returns {Array<Array<string>>} */
  function cmdScan() {
    STATE.scanned = true;
    return [
      ["[+] بدء فحص منافذ TCP على 192.168.1.50 ...", "cmd-sys"],
      ["    22/tcp     ssh     open", "cmd-neutral"],
      ["    80/tcp     http    open", "cmd-neutral"],
      ["    443/tcp    https   open", "cmd-neutral"],
      ["    3306/tcp   mysql   open", "cmd-neutral"],
      ["[!] نمط حقن SQL مكتشف عند 192.168.1.50:3306", "cmd-bad"],
      ["[i] نفّذ: block-ip 192.168.1.50 لقطع اتصال المصدر", "cmd-warn"]
    ];
  }

  /** SQLi containment: blocking the source prints the Flag. @param {string} ipArg @returns {Array<Array<string>>} */
  function cmdBlockIp(ipArg) {
    const ip = String(ipArg).trim().toLowerCase();
    if (STATE.solved) return [["تم تحييد الهجوم مسبقًا - العَلَم: " + GAME_FLAG, "cmd-flag"]];
    if (ip !== "192.168.1.50") return [[`[fw] قُبلت قاعدة حجب لـ ${ip}، لكن المصدر الحقيقي هو 192.168.1.50`, "cmd-warn"]];
    STATE.solved = true;
    return [
      ["[fw] قاعدة DROP مطبقة: 192.168.1.50 ← (الكل)", "cmd-ok"],
      ["[+] تم تحييد هجوم SQL Injection بنجاح!", "cmd-ok"],
      ["[+] العَلَم: " + GAME_FLAG, "cmd-flag"]
    ];
  }

  /** Status readout of the lab. @returns {Array<Array<string>>} */
  function cmdStatus() {
    return [
      ["[i] حالة النظام:", "cmd-neutral"],
      ["    IDS       : " + (STATE.scanned ? "كشف نمط حقن SQL (192.168.1.50)" : "مراقبة فقط"), STATE.scanned ? "cmd-bad" : "cmd-neutral"],
      ["    Firewall  : " + (STATE.solved ? "قاعدة DROP مفعّلة" : "لا قواعد إضافية"), STATE.solved ? "cmd-ok" : "cmd-neutral"],
      ["    العَلَم    : " + (STATE.solved ? GAME_FLAG : "—"), STATE.solved ? "cmd-flag" : "cmd-neutral"]
    ];
  }

  /**
   * Evaluate one command into ordered output lines.
   * @param {string} raw Raw input (kept for parity). @param {string} echo Trimmed command.
   * @returns {Array<Array<string>>} Lines to type.
   */
  function dispatch(raw, echo) {
    void raw;
    const parts = echo.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");
    if (cmd === "clear" || cmd === "cls") { clearLog(); return []; }
    switch (cmd) {
      case "help": return cmdHelp();
      case "scan": return cmdScan();
      case "status": return cmdStatus();
      case "block-ip": return cmdBlockIp(arg);
      default: return [["أمر غير معروف: «" + cmd + "» — اكتب help للتعليمات", "cmd-bad"]];
    }
  }

  /* ---------- submit handler & init ------------------------------------ */
  /** True while a page-level session was just ended (menu restored). */
  let wasSession = false;

  /** True while a CyberGames (MODULE 24) scenario owns the console. @returns {boolean} */
  function isSessionActive() {
    return Boolean(menuEl && menuEl.classList.contains("is-hidden"));
  }

  /** Handle one submission: echo the command, then type its output. @param {Event} e @returns {void} */
  function onSubmit(e) {
    e.preventDefault();
    if (!inputEl) return;
    const raw = inputEl.value;
    inputEl.value = "";
    /* A full CTF session owns the console — defer to MODULE 24. */
    if (isSessionActive()) return;
    const cmd = raw.trim();
    if (!cmd) return;
    twStop();
    typeLines([["\u203A " + cmd, "cmd-neutral"]]);
    typeLines(dispatch(raw, cmd));
  }

  /** Reveal + refresh the console when back at the scenario menu. @returns {void} */
  function syncMenuMode() {
    if (!menuEl || !playEl) return;
    const menuHidden = menuEl.classList.contains("is-hidden");
    if (!menuHidden && playEl.classList.contains("is-hidden")) playEl.classList.remove("is-hidden");
    if (!menuHidden && wasSession) {
      wasSession = false;
      clearLog();
      typeLines([["[secure-lab] Terminal جاهز — اكتب help لبدء السيناريو.", "cmd-sys"]]);
    }
    if (menuHidden) wasSession = true;
  }

  /** Do a first load pass. @returns {void} */
  function init() {
    if (!formEl || !inputEl || !logEl) return;
    formEl.addEventListener("submit", onSubmit);
    syncMenuMode();
    if ("MutationObserver" in window) {
      const obs = new MutationObserver(syncMenuMode);
      if (menuEl) obs.observe(menuEl, { attributes: true, attributeFilter: ["class"] });
      if (playEl) obs.observe(playEl, { attributes: true, attributeFilter: ["class"] });
    }
    if (!isSessionActive() && logEl.children.length === 0) {
      typeLines([["[secure-lab] Terminal جاهز — اكتب help أو scan للبدء.", "cmd-sys"]]);
    }
  }
  init();

})();

/* ============================================================
   MODULE 28 · Salawat top banner
   Slim reminder strip pinned to the top of the viewport. Slides in
   after a short delay once the page is open, auto-hides on its own,
   and optionally repeats at a generous interval (4h) for visitors who
   keep the page open. Dismissing persists a 24h suppression stamp in
   localStorage. Non-intrusive: no autoplay audio, no focus stealing,
   no forced interaction; honors prefers-reduced-motion via CSS.
   ============================================================ */
(function initSalawatBanner() {
  "use strict";
  const el = document.getElementById("salawatBanner");
  const btn = document.getElementById("salawatBannerClose");
  if (!el || !btn) return;

  const KEY = "salawat_banner_dismissed";
  const SUPPRESS_MS = 24 * 60 * 60 * 1000;
  const FIRST_DELAY_MS = 2200;
  const AUTO_HIDE_MS = 20000;
  const REPEAT_MS = 4 * 60 * 60 * 1000;

  let shown = false;

  function recentlyDismissed() {
    try {
      const at = parseInt(localStorage.getItem(KEY), 10);
      if (!isFinite(at) || at <= 0) return false;
      return (Date.now() - at) < SUPPRESS_MS;
    } catch (err) { return false; }
  }

  function setNavOffset(px) {
    document.documentElement.style.setProperty("--salawat-offset", px + "px");
  }

  function show() {
    if (shown || recentlyDismissed()) return;
    shown = true;
    setNavOffset(el.offsetHeight || 44);
    requestAnimationFrame(() => el.classList.add("is-visible"));
    clearTimeout(show._hide);
    show._hide = setTimeout(hide, AUTO_HIDE_MS);
  }

  function hide() {
    shown = false;
    el.classList.remove("is-visible");
    setNavOffset(0);
  }

  function dismiss() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (err) {}
    hide();
  }

  btn.addEventListener("click", dismiss);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" || ev.key === "Esc") hide();
  });

  function start() {
    if (document.readyState === "complete") setTimeout(show, FIRST_DELAY_MS);
    else window.addEventListener("load", () => setTimeout(show, FIRST_DELAY_MS));
    setInterval(() => { if (!recentlyDismissed()) show(); }, REPEAT_MS);
  }
  start();
})();

/* ============================================================
   MODULE 29 · Tools.Flash — flashcards (18 bilingual terms)
   ============================================================ */
(function () {
  const grid = $id("flashGrid");
  if (!grid) return;
  const search = $id("flashSearch");
  const shuffleBtn = $id("flashShuffle");
  const emptyMsg = $id("flashEmpty");
  const escF = (v) => escHtml(String(v));

  /* Every term now carries a line-art icon in images/flashcards/ (18/18).
     `img` stays OPTIONAL by design: an empty/missing value renders the
     classic text-only card, and a missing FILE degrades gracefully via
     the delegated error listener below. */
  const TERMS = [
    { ar: "السرية", en: "Confidentiality", img: "images/flashcards/confidentiality.svg", ex: "منع الكشف غير المصرّح به عن المعلومات — وصولها لمن يُسمح لهم فقط." },
    { ar: "السلامة", en: "Integrity", img: "images/flashcards/integrity.svg", ex: "ضمان عدم تغيير البيانات أو التلاعب بها إلا بشكل مصرّح به." },
    { ar: "التوافر", en: "Availability", img: "images/flashcards/availability.svg", ex: "إتاحة الأنظمة والبيانات عند الحاجة دون انقطاع." },
    { ar: "الجدار الناري", en: "Firewall", img: "images/flashcards/firewall.svg", ex: "يراقب حركة الشبكة ويسمح أو يمنع الاتصالات وفق قواعد محددة." },
    { ar: "الشبكة الافتراضية الخاصة", en: "VPN", img: "images/flashcards/vpn.svg", ex: "نفق مشفّر ينقل بياناتك بأمان عبر الشبكات العامة." },
    { ar: "التشفير المتماثل", en: "Symmetric Encryption", img: "images/flashcards/symmetric-encryption.svg", ex: "مفتاح واحد للتشفير وفك التشفير — سريع لكن توزيع المفتاح تحدٍّ (AES)." },
    { ar: "التشفير غير المتماثل", en: "Asymmetric Encryption", img: "images/flashcards/asymmetric-encryption.svg", ex: "مفتاح عام للتشفير وآخر خاص لفكه — أساس التوقيع الرقمي (RSA)." },
    { ar: "دالة التجزئة", en: "Hash Function", img: "images/flashcards/hash.svg", ex: "بصمة ثابتة الطول لأي مدخل ولا يمكن عكسها — مثل SHA-256." },
    { ar: "التصيّد الاحتيالي", en: "Phishing", img: "images/flashcards/phishing.svg", ex: "خداع المستخدم برسائل أو مواقع مزيفة للحصول على بياناته." },
    { ar: "برمجيات الفدية", en: "Ransomware", img: "images/flashcards/ransomware.svg", ex: "تشفير ملفات الضحية وطلب فدية مقابل إعادتها." },
    { ar: "حقن SQL", en: "SQL Injection", img: "images/flashcards/sql-injection.svg", ex: "إدخال استعلامات خبيثة عبر حقول الإدخال للوصول إلى قاعدة البيانات." },
    { ar: "حجب الخدمة الموزّع", en: "DDoS", img: "images/flashcards/ddos.svg", ex: "إغراق الخادم بطلبات هائلة من مصادر متعددة حتى يتوقف عن الخدمة." },
    { ar: "الرجل في المنتصف", en: "Man-in-the-Middle", img: "images/flashcards/man-in-the-middle.svg", ex: "اعتراض الاتصال بين طرفين للتنصت أو التلاعب بالبيانات." },
    { ar: "الهندسة الاجتماعية", en: "Social Engineering", img: "images/flashcards/social-engineering.svg", ex: "استغلال العامل البشري — الثقة أو الخوف — للحصول على معلومات أو وصول." },
    { ar: "المصادقة الثنائية", en: "Two-Factor Authentication", img: "images/flashcards/two-factor.svg", ex: "عاملان مختلفان للتحقق — حتى لو سُرّبت كلمة المرور." },
    { ar: "الثغرة الأمنية", en: "Vulnerability", img: "images/flashcards/vulnerability.svg", ex: "ضعف قابل للاستغلال في نظام أو تطبيق يهدد أمنه." },
    { ar: "الاستطلاع", en: "Reconnaissance", img: "images/flashcards/reconnaissance.svg", ex: "جمع معلومات عن الهدف قبل أي هجوم — خطوة أساسية في الاختراق الأخلاقي." },
    { ar: "برمجية خبيثة", en: "Malware", img: "images/flashcards/malware.svg", ex: "أي برنامج مصمم لإلحاق الضرر: فيروسات، أحصنة طروادة، تجسس، وفدية." }
  ];

  /* Expose the flashcard glossary (term + explanation + icon) so
     MODULE 48 · GlobalSearch can index flashcards and glossary terms from
     the real data instead of a duplicated list. */
  window.PLATFORM_FLASH_TERMS = TERMS;

  let query = "";

  function cardHtml(t, i) {
    /* Optional illustration on the front face. Cards without `img`
       (or with an empty value) render the classic text-only layout. */
    const media = (typeof t.img === "string" && t.img)
      ? '<span class="flash-media"><img class="flash-img" src="' + escF(t.img) + '" alt="" loading="lazy" decoding="async"></span>'
      : "";
    return (
      '<button type="button" class="flash-card" data-i="' + i + '" aria-pressed="false" aria-label="' + escF(t.ar) + " — " + escF(t.en) + '">' +
      '<span class="flash-inner" aria-hidden="true">' +
      '<span class="flash-face flash-face-front' + (media ? " has-media" : "") + '">' + media + '<span class="flash-term">' + escF(t.ar) + '</span><span class="flash-hint" data-i18n="flash.tap">اضغط للقلب</span></span>' +
      '<span class="flash-face flash-face-back"><span class="flash-term-en" dir="ltr">' + escF(t.en) + '</span><span class="flash-ex">' + escF(t.ex) + "</span></span>" +
      "</span></button>"
    );
  }

  function render() {
    const q = query.trim().toLowerCase();
    const list = TERMS.filter((t) =>
      !q || t.ar.indexOf(query.trim()) !== -1 ||
      t.en.toLowerCase().indexOf(q) !== -1 ||
      t.ex.indexOf(query.trim()) !== -1
    );
    grid.innerHTML = list.map(cardHtml).join("");
    if (emptyMsg) emptyMsg.hidden = list.length > 0;
    /* Keep the features-strip counter in sync with the real term count. */
    $$("[data-flash-count]").forEach((el) => { el.textContent = String(TERMS.length); });
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".flash-card");
    if (!card) return;
    const flipped = card.classList.toggle("is-flipped");
    card.setAttribute("aria-pressed", flipped ? "true" : "false");
    /* Lightweight review tracking for the Progress hub: when a card is
       flipped to reveal the answer, mark its term as reviewed locally
       (motmi-portal:flash). Additive — card behavior is unchanged. */
    if (flipped && card.dataset && card.dataset.i !== undefined) {
      try {
        const i = parseInt(card.dataset.i, 10);
        if (Number.isInteger(i) && i >= 0 && i < TERMS.length) {
          const curF = Store.get("flash", null);
          const st = (curF && typeof curF === "object" && curF.reviewed && typeof curF.reviewed === "object")
            ? curF : { v: 1, reviewed: {} };
          const k = String(i);
          if (!st.reviewed[k]) {
            st.reviewed[k] = true;
            Store.set("flash", st);
            /* First real review of this card — later flips never re-award. */
            awardMotivation("flash", i);
            if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("nova:progress-changed"));
          }
        }
      } catch {}
    }
  });

  /* Graceful degradation: a missing/renamed image must never break a
     card. Capture-phase "error" from any <img> hides only that media
     panel; the card keeps its text content and fixed height, so the
     grid never shifts. */
  grid.addEventListener("error", (e) => {
    const img = e.target && e.target.closest ? e.target.closest(".flash-img") : null;
    if (!img) return;
    const media = img.closest(".flash-media");
    if (media) media.classList.add("is-broken");
  }, true);

  if (search) search.addEventListener("input", () => { query = search.value; render(); });

  if (shuffleBtn) shuffleBtn.addEventListener("click", () => {
    const cards = Array.prototype.slice.call(grid.children);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }
    cards.forEach((n) => grid.appendChild(n));
  });

  render();
  Lang.onSwitch(render);
})();

/* ============================================================
   MODULE 30 · Stats.Live — real counts from data + jump links
   ============================================================ */
(function () {
  function counts() {
    const keys = Object.keys(QUIZZES);
    let questions = 0;
    keys.forEach((k) => {
      const arr = QUIZZES[k] && QUIZZES[k].questions;
      if (Array.isArray(arr)) questions += arr.length;
    });
    return { questions: questions, subjects: getCurrentSubjectCount(), tools: $$(".tool-card").length };
  }

  function paint(failed) {
    const c = counts();
    const wrap = document.querySelector(".hero-meta");
    const err = wrap && wrap.querySelector(".stats-error");
    if (failed) {
      /* Data truly unavailable (retries exhausted) — an honest Arabic
         message instead of misleading zeros. Never shown while loading. */
      if (wrap && !err) {
        const p = document.createElement("p");
        p.className = "stats-error";
        p.setAttribute("role", "status");
        p.textContent = "تعذر تحميل البيانات حاليًا. يرجى تحديث الصفحة والمحاولة مرة أخرى.";
        wrap.appendChild(p);
      }
      $$(".hero-stat").forEach((el) => { el.hidden = true; });
      return;
    }
    if (err) err.remove();
    $$(".hero-stat").forEach((el) => { el.hidden = false; });
    const map = { questions: c.questions, subjects: c.subjects, tools: c.tools };
    $$( "[data-count]").forEach((el) => {
      const key = el.getAttribute("data-count");
      if (key in map) el.textContent = String(map[key]);
    });
    /* Per-card "بنك الأسئلة" counters follow the live data. */
    $$(".res-count[data-res]").forEach((el) => {
      const k = el.getAttribute("data-res");
      const arr = QUIZZES[k] && QUIZZES[k].questions;
      if (Array.isArray(arr)) el.textContent = String(arr.length);
    });
  }

  /* Poll until the bank resolves (fetch, cache or embedded fallback):
     30 × 500 ms ≈ 15 s covers the retry backoff; the error only paints
     once the window exhausts. Afterwards a slow 5 s self-heal keeps
     checking so late-arriving data replaces the message with numbers. */
  let tries = 0;
  (function tick() {
    const c = counts();
    /* Keep polling until the question bank resolves (fetch/cache/fallback)
       — the subjects counter paints immediately from the official registry. */
    const done = !(c.questions === 0);
    paint(!done && tries >= 30);
    if (done) return;
    tries++;
    setTimeout(tick, tries <= 30 ? 500 : 5000);
  })();

  /* "بنك الأسئلة" links: the #quiz anchor scrolls, then the quiz starts. */
  document.addEventListener("click", (ev) => {
    const link = ev.target.closest("[data-quiz-jump]");
    if (!link) return;
    const key = link.getAttribute("data-quiz-jump");
    if (!key || !QUIZZES[key] || !app) return;
    setTimeout(() => {
      if (quizView === "question") return; /* never hijack a run in progress */
      startQuiz(key, false);
    }, prefersReducedMotion ? 250 : 700);
  });
})();

/* ============================================================
   MODULE 31 · Nav.ToTop — back-to-top button
   ============================================================ */
(function () {
  const btn = $id("toTop");
  if (!btn) return;
  const toggle = () => { btn.disabled = window.scrollY <= 600; };
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });
  window.addEventListener("scroll", toggle, { passive: true });
  toggle();
})();

/* ============================================================
   MODULE 33 · ViewSwitcher — instant tabbed view navigation
   Replaces scroll-based anchor navigation with instant view
   switching. Only one view (hero / section) is visible at a time.
   Supports deep-linking via URL hash + HTML5 History API so
   Back/Forward buttons navigate through previously visited tabs.
   ============================================================ */
(function initViewSwitcher() {
  const main = document.querySelector("main");
  if (!main) return;

  /** All switchable views: hero header + section elements. @type {HTMLElement[]} */
  const VIEWS = [
    $id("hero"), $id("semester"), $id("paths"), $id("skills"), $id("path"), $id("subjects"), $id("tools"),
    $id("labs"), $id("flash"), $id("quiz"), $id("progress"),
    $id("games"), $id("redteam"), $id("ir"), $id("cryptolab"),
    $id("about"), $id("contact"), $id("lesson"),
  ].filter(Boolean);

  /** Set of valid view IDs for hash validation. @type {Set<string>} */
  const VIEW_IDS = new Set(VIEWS.map((v) => v.id));

  /**
   * Hash aliases → real view ids. Empty today: the #semester nav link
   * used to alias to #subjects, but #semester is now a REAL view (the
   * Current Semester dashboard, rendered by MODULE 43 from
   * window.PLATFORM_CURRENT_SEMESTER), so it resolves directly as a
   * member of VIEW_IDS and needs no alias.
   * @type {Object<string,string>}
   */
  const VIEW_ALIASES = {};

  /** Currently active view ID. @type {string|null} */
  let activeView = null;

  /** Unknown-route ids already announced (one notice per hash). @type {Set<string>} */
  const unknownRoutesNotified = new Set();

  /* Enable JS-only view-switching CSS (progressive enhancement:
     without JS the class is absent → all views visible, normal scroll). */
  document.body.classList.add("js-view-switcher");

  /**
   * Announce — once per hash — that a hash route does not exist. Static
   * hosting has no 404 page for fragments, so the router silently falls
   * back to the home view; this makes the fallback explicit instead.
   * @param {string} rawId Unknown id without the leading "#".
   * @returns {void}
   */
  function notifyUnknownRoute(rawId) {
    if (!rawId || unknownRoutesNotified.has(rawId)) return;
    unknownRoutesNotified.add(rawId);
    const msg = Lang.current === "en"
      ? "The page \"" + rawId + "#\" does not exist — you were taken back to the home view."
      : "الصفحة «#" + rawId + "» غير موجودة — تم الرجوع إلى الصفحة الرئيسية.";
    if (typeof labToast === "function") labToast(msg, "warn");
  }

  /**
   * Resolve a hash fragment to a valid view ID.
   * @param {string} hash Raw hash (e.g. "#quiz" or "quiz" or "").
   * @returns {string} Validated view ID (defaults to "hero").
   */
  function resolveViewId(hash) {
    const id = String(hash || "").replace(/^#/, "").trim();
    /* Deep links like "#path/networks" resolve to the shared path-detail
       view; the concrete path id stays in the URL (preserved in activate)
       and is read from the hash by MODULE 39 (LearningPaths). */
    if (/^path\//.test(id)) return "path";
     if (/^lesson\//.test(id)) return "lesson";
    if (VIEW_ALIASES[id]) return VIEW_ALIASES[id];
    return VIEW_IDS.has(id) ? id : "hero";
  }

  /** Move focus to the heading of the newly activated view. @returns {void} */
  function focusActiveView() {
    const view = activeView ? $id(activeView) : null;
    if (!view || anotherOverlayOpen()) return;
    const target = view.querySelector("h1, h2, [data-view-heading]") || view;
    const hasTabindex = typeof target.hasAttribute === "function"
      ? target.hasAttribute("tabindex")
      : target.getAttribute("tabindex") !== null;
    if (!hasTabindex) target.setAttribute("tabindex", "-1");
    const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
    schedule(() => {
      if (!activeView || activeView !== view.id || anotherOverlayOpen()) return;
      try { target.focus({ preventScroll: true }); }
      catch { target.focus(); }
    });
  }

  /**
   * Activate exactly one view: add .is-active to target, remove
   * from the rest. Updates nav aria-current, navbar frosted state,
   * URL hash (History API), and resets scroll to top.
   * @param {string} viewId Target view ID.
   * @param {Object=} opts
   * @param {boolean=} opts.replace Use replaceState instead of push
   * @param {boolean=} opts.silent  Skip history/hash update (popstate)
   * @returns {boolean} True if the active view changed.
   */
  function activate(viewId, opts) {
    opts = opts || {};
    const requestedId = String(viewId == null ? "" : viewId).replace(/^#/, "").trim();
    viewId = resolveViewId(viewId);
    /* Unknown hash route? Say so (the fallback view still renders). */
    if (requestedId && !VIEW_IDS.has(requestedId) && !VIEW_ALIASES[requestedId] &&
        !/^(?:path|lesson)\//.test(requestedId)) {
      notifyUnknownRoute(requestedId);
    }
    const previousView = activeView;
    if (activeView === viewId && !opts.force) return false;

    /* Show target, hide the rest */
    VIEWS.forEach((v) => {
      v.classList.toggle("is-active", v.id === viewId);
    });
    activeView = viewId;

    /* Sync aria-current on every nav link group (top nav,
       mobile drawer, footer) — replaces ScrollSpy. */
    $$(
      ".nav-links a[href^='#'], .mobile-menu a[href^='#'], .footer-links a[href^='#']"
    ).forEach((a) => {
      const targetId = (a.getAttribute("href") || "").replace(/^#/, "");
      if (!VIEW_IDS.has(targetId)) return;
      if (a.getAttribute("href") === "#" + viewId) {
        a.setAttribute("aria-current", "true");
      } else {
        a.removeAttribute("aria-current");
      }
    });

    /* Navbar: transparent over the dark hero, frosted on light views. */
    const nav = $id("nav");
    if (nav) {
      if (viewId === "hero") {
        nav.classList.toggle("is-scrolled", window.scrollY > 40);
      } else {
        nav.classList.add("is-scrolled");
      }
    }

    /* Reset scroll on every tab switch */
    window.scrollTo(0, 0);

    /* Update URL via History API (unless driven by popstate/hashchange) */
    if (!opts.silent) {
      /* Keep "#path/<id>" and "#lesson/<sub>/<topic>" deep links intact
         when re-activating those views — otherwise the rewrite to the
         bare view hash would race MODULE 40's hashchange handler and
         render the lesson placeholder instead of the lesson. */
      const deepLink = (viewId === "path" && /^#path\//.test(location.hash)) ||
        (viewId === "lesson" && /^#lesson\//.test(location.hash));
      const newHash = deepLink ? location.hash : "#" + viewId;
      if (location.hash !== newHash) {
        if (opts.replace) {
          history.replaceState({ view: viewId }, "", newHash);
        } else if (history.pushState) {
          history.pushState({ view: viewId }, "", newHash);
        }
      }
    }

    /* Notify other modules (e.g. ProgressHub) so they can refresh
       when their view is activated. Additive — no behavior change. */
    document.dispatchEvent(new CustomEvent("nova:view-changed", { detail: { viewId } }));

    /* Programmatic focus lands on the new view only after a real switch; the
       initial boot keeps native hash/first-visit behavior unchanged. */
    if (previousView !== null) focusActiveView();

    return true;
  }

  /**
   * Intercept internal anchor clicks pointing at view IDs and
   * switch views instead of the default scroll-to-anchor behavior.
   * @param {MouseEvent} e
   * @returns {void}
   */
  function onNavClick(e) {
    const link = e.target.closest("a[href^='#']:not([href='#'])");
    if (!link) return;
    /* Membership test on the RAW id (not resolveViewId, which defaults
       unknown hashes to "hero" and would hijack non-view anchors).
       Aliases (e.g. "#semester") count as view links too. */
    const rawId = (link.getAttribute("href") || "").replace(/^#/, "").trim();
    if (!VIEW_IDS.has(rawId) && !VIEW_ALIASES[rawId]) return; /* not a view link — allow default */

    e.preventDefault();
    activate(VIEW_ALIASES[rawId] || rawId);

    /* Close the mobile menu drawer if it's currently open */
    const menu = $id("mobileMenu");
    if (menu && menu.classList.contains("is-open")) {
      const burger = $id("navBurger");
      if (burger) burger.click();
    }
  }

  /**
   * Browser Back/Forward handler — activates the view matching
   * the URL hash without pushing another history entry.
   * @returns {void}
   */
  function onPopState() {
    activate(location.hash, { silent: true });
  }

  /* --- Bind --- */
  document.addEventListener("click", onNavClick);
  window.addEventListener("popstate", onPopState);
  window.addEventListener("hashchange", onPopState);

  /* --- Initialize: activate view from URL hash or default to hero ---
     The RAW hash is passed so an unknown deep link is detected and
     announced (activate() resolves it to the fallback view). */
  activate(location.hash, { replace: true });

  /* Public API so other modules (e.g. ProgressHub) can switch views
     programmatically and read the current view. Additive, no behavior change. */
  window.NovaViews = { activate, resolveViewId, current: () => activeView };
})();

/* ============================================================
   MODULE 36 · ThemeSwitch — dark default · light persisted
   Resolution order: explicit stored choice ("motmi-portal:theme"
   in localStorage via Store) → system preference
   (prefers-color-scheme) → dark. The pre-paint inline <head>
   script mirrors this logic so there is no flash of the wrong
   theme. While no explicit choice is stored, live OS switches
   (light↔dark) update the page immediately; once the user taps
   the toggle their choice wins and OS changes are ignored.
   ============================================================ */
(function () {
  const root = document.documentElement;
  const btn = $id("themeToggle");
  const LBL_LIGHT = "الوضع الداكن / Dark mode";   /* shown while light is ON */
  const LBL_DARK = "الوضع الفاتح / Light mode";   /* shown while dark is ON  */
  const mq = (typeof window.matchMedia === "function")
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null;

  /**
   * Apply a theme mode to <html>, the toggle state and the theme-color meta.
   * @param {"dark"|"light"} mode Target mode.
   * @returns {void}
   */
  function apply(mode) {
    const isLight = mode === "light";
    if (isLight) root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    if (btn) {
      btn.setAttribute("aria-pressed", String(isLight));
      btn.title = isLight ? LBL_LIGHT : LBL_DARK;
      btn.setAttribute("aria-label", isLight ? LBL_LIGHT : LBL_DARK);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isLight ? "#f4f5f7" : "#0b0f19");
  }

  /** Stored user choice, or null when the user never picked manually.
      @returns {"dark"|"light"|null} */
  function storedChoice() {
    const v = Store.get("theme");
    return v === "light" || v === "dark" ? v : null;
  }

  /* Restore: stored choice → system preference → dark (default). */
  apply(storedChoice() || (mq && mq.matches ? "light" : "dark"));

  if (btn) {
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      Store.set("theme", next); /* explicit choice — overrides the OS */
    });
  }

  /* Follow live OS theme changes until the user makes an explicit choice. */
  if (mq) {
    const onSystemChange = (e) => {
      if (storedChoice() === null) apply(e.matches ? "light" : "dark");
    };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onSystemChange);
    else if (typeof mq.addListener === "function") mq.addListener(onSystemChange); /* legacy Safari */
  }
})();

/* ============================================================
   MODULE 32 · Nav.ScrollSpy — highlight the section in view
   Observes the main sections and mirrors the active one onto the
   desktop nav links via aria-current="true" (also styled in CSS).
   Improves orientation: users always know where they are.
   NOTE: When MODULE 33 (ViewSwitcher) is active, aria-current is
   managed by the switcher and this observer is a no-op.
   ============================================================ */
(function () {
  if (!("IntersectionObserver" in window)) return;
  /* View-Switcher owns active states — skip scrollspy to avoid conflicts */
  if (document.body.classList.contains("js-view-switcher")) return;
  const links = $$(".nav-links a[href^='#']");
  if (!links.length) return;
  const map = new Map();
  links.forEach((a) => {
    const id = (a.getAttribute("href") || "").slice(1);
    const sec = id && document.getElementById(id);
    if (sec) map.set(sec, a);
  });

  /** Paint one link as current and clear the rest. @param {HTMLAnchorElement|null} active @returns {void} */
  function setActive(active) {
    links.forEach((a) => {
      if (a === active) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActive(map.get(entry.target));
    });
  }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });

  map.forEach((_, sec) => io.observe(sec));
  /* At the very top, no section is "current". */
  window.addEventListener("scroll", () => {
    if (window.scrollY < 200) setActive(null);
  }, { passive: true });
})();

/* ============================================================
   M45 · Red Team Lab — shared helpers (available to all labs)
   ============================================================ */
function labToast(msg, variant) {
  let stack = document.getElementById("labToastStack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "labToastStack";
    stack.className = "lab-toast-stack";
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  const div = document.createElement("div");
  div.className = "lab-toast" + (variant ? " is-" + variant : "");
  div.textContent = msg;
  stack.appendChild(div);
  requestAnimationFrame(() => div.classList.add("is-in"));
  setTimeout(() => { div.classList.remove("is-in"); setTimeout(() => div.remove(), 500); }, 3400);
}
function labRm() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function labEsc(s) {
  return String(s).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
function labHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}
function utf8Bytes(str) {
  return Array.from(new TextEncoder().encode(str));
}
function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
function labDownload(name, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/* ============================================================
   M45 · BashLab — local bash + SQL query simulator
   Mini-filesystem (pwd/ls/cd/cat/grep) plus a real SELECT
   interpreter; classic injection (' OR 1=1 --) dumps rows.
   ============================================================ */
(() => {
  "use strict";
  const logEl = $id("bashLog"), formEl = $id("bashForm"), inputEl = $id("bashInput");
  if (!logEl || !formEl || !inputEl) return;

  const FS = {
    "/": { kind: "dir", kids: ["home", "etc", "var"] },
    "/home": { kind: "dir", kids: ["student"] },
    "/home/student": { kind: "dir", kids: ["notes.txt"] },
    "/home/student/notes.txt": { kind: "file", text: "HTTPS = HTTP + TLS — راجع الفصل الثاني" },
    "/etc": { kind: "dir", kids: ["passwd", "hosts"] },
    "/etc/passwd": { kind: "file", text: "root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:Student:/home/student:/bin/bash" },
    "/etc/hosts": { kind: "file", text: "127.0.0.1 localhost\n10.0.0.5 db.internal" },
    "/var": { kind: "dir", kids: ["log"] },
    "/var/log": { kind: "dir", kids: ["auth.log"] },
    "/var/log/auth.log": { kind: "file", text: "May 12 sshd: Failed password for root from 45.33.2.5" }
  };
  const STUDENTS = [
    [1, "Ahmad", "networks", 88], [2, "Sara", "crypto", 92], [3, "Lina", "db", 74],
    [4, "Omar", "networks", 61], [5, "Noor", "secure-code", 96]
  ];
  let cwd = "/home/student";

  function out(text, cls) {
    const p = document.createElement("p");
    p.className = "cmd-line " + (cls || "cmd-neutral");
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function resolve(p) {
    if (!p) return cwd;
    if (p[0] !== "/") p = cwd + "/" + p;
    const parts = [];
    for (const seg of p.split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") { parts.pop(); continue; }
      parts.push(seg);
    }
    return "/" + parts.join("/");
  }

  function runSql(raw) {
    const q = raw.trim().replace(/;+$/, "");
    if (!q) { out("usage: sql <select ...>", "cmd-warn"); return; }
    if (!/^select\b/i.test(q)) { out("تتيح هذه المحاكاة SELECT فقط.", "cmd-warn"); return; }
    const m = q.match(/^select\s+(.+?)\s+from\s+(\w+)/i);
    if (!m) { out("الصيغة: select <أعمدة> from students [where <شرط>]", "cmd-warn"); return; }
    const table = m[2].toLowerCase();
    if (table !== "students") { out("لا يوجد جدول باسم " + table, "cmd-bad"); return; }
    const wi = q.toLowerCase().indexOf("where ");
    const cond = wi >= 0 ? q.slice(wi + 6).trim() : "";
    const injected = /or\s+1\s*=\s*1|--/i.test(cond) || (cond.includes("'") && /or\b/i.test(cond));

    let rows = [];
    if (!cond) rows = STUDENTS;
    else if (injected) rows = STUDENTS;
    else {
      const cm = cond.match(/^(\w+)\s*(=|!=|>|<|>=|<=|like)\s*'?([^']*)'?/i);
      if (!cm) { out("لا أفهم الشرط — أدعم = , != , > , < , like", "cmd-warn"); rows = []; }
      else {
        const ci = ["id", "name", "course", "grade"].indexOf(cm[1].toLowerCase());
        const op = cm[2].trim(), val = String(cm[3]).toLowerCase();
        rows = STUDENTS.filter((r) => {
          const a = String(ci >= 0 ? r[ci] : "").toLowerCase();
          switch (op) {
            case "=": return a === val;
            case "!=": return a !== val;
            case ">": return Number(a) > Number(val);
            case "<": return Number(a) < Number(val);
            case ">=": return Number(a) >= Number(val);
            case "<=": return Number(a) <= Number(val);
            case "like": return a.includes(val.replace(/%/g, ""));
            default: return false;
          }
        });
      }
    }

    out("── نتيجة: " + q, "cmd-sys");
    if (injected) out("⚠️ حمولة حقن في WHERE — عادت كل الصفوف!", "cmd-bad");
    out("id | name | course | grade", "cmd-neutral");
    rows.forEach((r) => out(r.join("  |  "), "cmd-neutral"));
    if (!rows.length) out("(لا صفوف مطابقة) — الحل الآمن: معاملات parameterized", "cmd-neutral");
  }
function dispatch(line) {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    switch (cmd) {
      case "help": out("pwd · ls [dir] · cd <dir> · cat <file> · grep <كلمة> <file> · echo · whoami · clear · sql <select ...>", "cmd-neutral"); break;
      case "pwd": out(cwd, "cmd-neutral"); break;
      case "clear": logEl.innerHTML = ""; break;
      case "whoami": out("student", "cmd-neutral"); break;
      case "ls": {
        const p = resolve(args[0] || ".");
        const e = FS[p];
        if (!e || e.kind !== "dir") { out("ls: " + p + ": ليس مجلدًا", "cmd-bad"); break; }
        out(e.kids.join("   "), "cmd-neutral");
        break;
      }
      case "cd": {
        const p = resolve(args[0] || "/");
        if (FS[p] && FS[p].kind === "dir") cwd = p;
        else out("cd: " + p + ": مسار غير صالح", "cmd-bad");
        break;
      }
      case "cat": {
        const p = resolve(args[0] || "");
        const e = FS[p];
        if (!e || e.kind !== "file") { out("cat: " + p + ": ملف غير موجود", "cmd-bad"); break; }
        out(e.text, "cmd-neutral");
        break;
      }
      case "grep": {
        const needle = args[0] || "", file = args[1] || "";
        const e = FS[resolve(file)];
        if (!e || e.kind !== "file") { out("grep: استخدم grep <كلمة> <ملف>", "cmd-bad"); break; }
        e.text.split("\n").filter((l) => l.includes(needle)).forEach((l) => out(l, "cmd-neutral"));
        break;
      }
      case "echo": out(args.join(" "), "cmd-neutral"); break;
      case "sql": runSql(args.join(" ")); break;
      default: out("أمر غير معروف: " + cmd + " — اكتب help", "cmd-bad");
    }
  }

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const line = inputEl.value;
    inputEl.value = "";
    if (!line.trim()) return;
    out("$ " + line, "cmd-sys");
    dispatch(line);
  });
  out("مرحبًا! اكتب help أو جرّب: sql select * from students", "cmd-neutral");
})();
/* ============================================================
   M45 · NetLab — build Ethernet/IPv4/TCP|UDP frames
   Real IPv4 header checksum + transport pseudo-header checksum,
   animated hop-by-hop TTL transmission.
   ============================================================ */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const srcIpEl = $("netSrcIp"), dstIpEl = $("netDstIp"), srcPortEl = $("netSrcPort"),
    dstPortEl = $("netDstPort"), ttlEl = $("netTtl"), protoEl = $("netProto"),
    payloadEl = $("netPayload"), btn = $("netBuild"), svgEl = $("netSvg"),
    checkEl = $("netCheck"), hexEl = $("netHex");
  if (!btn || !svgEl || !hexEl) return;

  function ipToInt(ip) {
    const o = ip.split(".").map(Number);
    return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
  }
  function isValidIp(ip) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && ip.split(".").every((x) => Number(x) <= 255);
  }
  function words16(bytes) {
    const out = [];
    for (let i = 0; i < bytes.length; i += 2) out.push(((bytes[i] || 0) << 8) | (bytes[i + 1] || 0));
    return out;
  }
  function csum(words) {
    let s = 0;
    for (const w of words) s += w >>> 0;
    while (s >>> 16) s = (s & 0xFFFF) + (s >>> 16);
    return (~s) & 0xFFFF;
  }
  function hexWord(w) { return w.toString(16).padStart(4, "0"); }

  function readCtx() {
    const src = srcIpEl.value.trim(), dst = dstIpEl.value.trim();
    const sp = parseInt(srcPortEl.value, 10), dp = parseInt(dstPortEl.value, 10);
    const ttl = Math.min(255, Math.max(1, parseInt(ttlEl.value, 10) || 64));
    const proto = protoEl.value;
    const payload = payloadEl.value || "HELLO";
    if (!isValidIp(src) || !isValidIp(dst)) return null;
    if (!sp || !dp || sp > 65535 || dp > 65535 || sp < 0 || dp < 0) return null;
    return { src, dst, sp, dp, ttl, proto, payload: utf8Bytes(payload) };
  }

  function buildFrame(c) {
    const eth = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x08, 0x00];
    const pt = c.proto === "tcp" ? 6 : 17;
    const totLen = 20 + (c.proto === "tcp" ? 20 : 8) + c.payload.length;

    const iph = [
      0x45, 0x00, (totLen >> 8) & 255, totLen & 255,
      0x12, 0x34, 0x40, 0x00,
      c.ttl, pt, 0x00, 0x00,
      (ipToInt(c.src) >>> 24) & 255, (ipToInt(c.src) >>> 16) & 255, (ipToInt(c.src) >>> 8) & 255, ipToInt(c.src) & 255,
      (ipToInt(c.dst) >>> 24) & 255, (ipToInt(c.dst) >>> 16) & 255, (ipToInt(c.dst) >>> 8) & 255, ipToInt(c.dst) & 255
    ];
    iph[10] = (csum(words16(iph)) >> 8) & 255;
    iph[11] = csum(words16(iph)) & 255;

    let tport = null;
    const S = ipToInt(c.src), D = ipToInt(c.dst);
    if (c.proto === "tcp") {
      tport = [c.sp >> 8, c.sp & 255, c.dp >> 8, c.dp & 255, 0, 0, 0, 1, 0, 0, 0, 0, 0x50, 0x18, 0x20, 0x00, 0, 0, 0, 0];
      const len = tport.length + c.payload.length;
      const pseudo = words16([S >>> 24 & 255, S >>> 16 & 255, S >>> 8 & 255, S & 255,
        D >>> 24 & 255, D >>> 16 & 255, D >>> 8 & 255, D & 255, 0, pt, len >> 8, len & 255]);
      const ck = csum(pseudo.concat(words16(tport)).concat(words16(c.payload)));
      tport[16] = (ck >> 8) & 255; tport[17] = ck & 255;
    } else {
      const len = 8 + c.payload.length;
      tport = [c.sp >> 8, c.sp & 255, c.dp >> 8, c.dp & 255, len >> 8, len & 255, 0, 0];
      const pseudo = words16([S >>> 24 & 255, S >>> 16 & 255, S >>> 8 & 255, S & 255,
        D >>> 24 & 255, D >>> 16 & 255, D >>> 8 & 255, D & 255, 0, pt, len >> 8, len & 255]);
      const ck = csum(pseudo.concat(words16(tport)).concat(words16(c.payload)));
      tport[6] = (ck >> 8) & 255; tport[7] = ck & 255;
    }
    return { eth, iph, tport, payload: c.payload, proto: c.proto, ttl: c.ttl };
  }
function draw(f) {
    const NS = "http://www.w3.org/2000/svg";
    svgEl.innerHTML = "";
    const xs = [50, 160, 270, 380, 510];
    const labels = [f.srcIp || "SRC", "R1", "R2", "R3", f.dstIp || "DST"];
    const nodes = xs.map((x, i) => {
      const g = document.createElementNS(NS, "g");
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", 60);
      c.setAttribute("r", i === 0 || i === 4 ? 16 : 11);
      c.setAttribute("fill", i === 0 || i === 4 ? "var(--accent-2, #22d3ee)" : "var(--surface-2, #1e293b)");
      c.setAttribute("stroke", "var(--accent, #a78bfa)");
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("y", 96); t.setAttribute("text-anchor", "middle");
      t.setAttribute("font-size", "11"); t.setAttribute("fill", "var(--muted, #94a3b8)");
      t.textContent = labels[i];
      g.appendChild(c); g.appendChild(t);
      svgEl.appendChild(g);
      return { x, c };
    });
    for (let i = 0; i < 4; i++) {
      const l = document.createElementNS(NS, "line");
      l.setAttribute("x1", nodes[i].x + 12); l.setAttribute("y1", 60);
      l.setAttribute("x2", nodes[i + 1].x - 12); l.setAttribute("y2", 60);
      l.setAttribute("stroke", "var(--line, rgba(148,163,184,.3))");
      l.setAttribute("stroke-width", "2"); l.setAttribute("stroke-dasharray", "4 4");
      svgEl.appendChild(l);
    }
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("r", 6); dot.setAttribute("fill", "var(--accent-3, #f472b6)");
    svgEl.appendChild(dot);
    const ttlTxt = document.createElementNS(NS, "text");
    ttlTxt.setAttribute("x", 380); ttlTxt.setAttribute("y", 36);
    ttlTxt.setAttribute("text-anchor", "middle"); ttlTxt.setAttribute("font-size", "11");
    ttlTxt.setAttribute("fill", "var(--warn, #fbbf24)");
    svgEl.appendChild(ttlTxt);

    const dur = labRm() ? 1 : 1200;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const x = 56 + p * (504);
      dot.setAttribute("cx", x); dot.setAttribute("cy", 60);
      const hop = Math.floor(p * 4);
      ttlTxt.textContent = "TTL: " + Math.max(0, f.ttl - hop);
      if (p < 1) requestAnimationFrame(step);
      else ttlTxt.textContent = "وصلت الوجهة — TTL: " + (f.ttl - 4);
    }
    requestAnimationFrame(step);
  }

  btn.addEventListener("click", () => {
    const c = readCtx();
    if (!c) { checkEl.textContent = "مدخلات غير صالحة — تحقق من العناوين والمنافذ."; return; }
    const f = buildFrame(c);
    f.srcIp = c.src; f.dstIp = c.dst;
    const total = f.eth.length + f.iph.length + f.tport.length + f.payload.length;
    checkEl.textContent = "✓ حزمة " + c.proto.toUpperCase() + " (" + total + " بايت) — المجاميع الاختبارية محسوبة.";
    hexEl.textContent =
      "Ethernet [" + labHex(f.eth) + "]\nIP      [" + labHex(f.iph) + "]  ← checksum 0x" + hexWord(csum(words16(f.iph))) + "\n" +
      (c.proto === "tcp" ? "TCP     [" : "UDP     [") + labHex(f.tport) + "]\nPayload [" + labHex(f.payload) + "]";
    draw(f);
  });
})();
/* ============================================================
   M46 · Incident Response Training — SIEM + timeline + live
   ============================================================ */
(() => {
  "use strict";
  const IR_EVENTS = [
    { t: "08:12:01", src: "198.51.100.3",  dst: "10.0.0.5",  user: "-",     type: "scan",   sev: "med",   phase: "recon",   act: "alert", cam: "c2" },
    { t: "08:14:22", src: "198.51.100.3",  dst: "10.0.0.5",  user: "-",     type: "scan",   sev: "low",   phase: "recon",   act: "alert", cam: "c2" },
    { t: "09:02:11", src: "203.0.113.77",  dst: "10.0.0.12", user: "admin", type: "login",  sev: "med",   phase: "deliver", act: "allow", cam: "c1" },
    { t: "09:03:45", src: "203.0.113.77",  dst: "10.0.0.12", user: "admin", type: "brute",   sev: "high",  phase: "deliver", act: "alert", cam: "c1" },
    { t: "09:04:19", src: "203.0.113.77",  dst: "10.0.0.12", user: "admin", type: "login",  sev: "crit",  phase: "exploit",  act: "allow", cam: "c1" },
    { t: "09:05:33", src: "10.0.0.12",     dst: "10.0.0.20", user: "admin", type: "inject",  sev: "high",  phase: "exploit",  act: "alert", cam: "c1" },
    { t: "09:06:58", src: "10.0.0.12",     dst: "198.51.100.9", user: "admin", type: "exfil", sev: "crit", phase: "action",  act: "alert", cam: "c1" },
    { t: "09:01:00", src: "192.0.2.88",    dst: "mail.school.org", user: "-", type: "phish", sev: "high", phase: "deliver", act: "alert", cam: "c3" },
    { t: "09:07:12", src: "192.0.2.88",    dst: "10.0.0.30", user: "hr",     type: "phish",  sev: "crit",  phase: "deliver", act: "alert", cam: "c3" },
    { t: "09:10:44", src: "10.0.0.30",     dst: "10.0.0.40", user: "hr",     type: "ransom", sev: "crit",  phase: "action",  act: "alert", cam: "c3" },
    { t: "10:01:03", src: "45.33.12.1",    dst: "10.0.0.5",  user: "-",     type: "brute",  sev: "high",  phase: "deliver", act: "alert", cam: "c2" },
    { t: "10:02:30", src: "45.33.12.1",    dst: "10.0.0.5",  user: "root",  type: "login",  sev: "crit",  phase: "exploit",  act: "allow", cam: "c2" },
    { t: "10:04:17", src: "10.0.0.5",      dst: "10.0.0.5",  user: "root",  type: "backdoor", sev: "crit", phase: "action",  act: "alert", cam: "c2" },
    { t: "11:20:05", src: "198.51.100.3",  dst: "10.0.0.5",  user: "-",     type: "dos",    sev: "med",   phase: "action",  act: "alert", cam: "c2" },
    { t: "11:31:47", src: "203.0.113.77",  dst: "10.0.0.12", user: "admin", type: "scan",   sev: "low",   phase: "recon",   act: "alert", cam: "c1" }
  ];
  const TYPE_LABEL = { scan: "فحص", login: "دخول", brute: "قوة تخمين", inject: "حقن", exfil: "تسريب",
    phish: "تصيّد", ransom: "فدية", backdoor: "باب خلفي", dos: "حجب خدمة" };
  const SEV_RANK = { low: 0, med: 1, high: 2, crit: 3 };
  const PHASES = ["recon", "weapon", "deliver", "exploit", "action"];
  const PHASE_AR = { recon: "استطلاع", weapon: "تسليح", deliver: "إيصال", exploit: "استغلال", action: "تأثير" };

  const tabs = Array.from(document.querySelectorAll("[data-ir-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-ir-panel]"));
  const typeSel = $id("siemType"), sevSel = $id("siemSev"), queryEl = $id("siemQuery"),
    runBtn = $id("siemRun"), resetBtn = $id("siemReset"), bodyEl = $id("siemBody");
  if (!tabs.length) return;

  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    panels.forEach((p) => { p.hidden = p.getAttribute("data-ir-panel") !== tab.getAttribute("data-ir-tab"); });
  }));
function sevCls(sev) { return "sev-" + sev; }
  function rowHtml(e) {
    return "<tr><td>" + e.t + "</td><td>" + e.src + "</td><td>" + e.dst + "</td><td>" + e.user +
      "</td><td>" + (TYPE_LABEL[e.type] || e.type) + "</td><td><span class=\"" + sevCls(e.sev) + "\">" +
      e.sev + "</span></td><td>" + e.phase + "</td></tr>";
  }
  function evalQuery(e, q) {
    const toks = q.trim().split(/\s+/);
    for (const tk of toks) {
      const m = tk.match(/^(\w+)\s*(>=|<=|=)\s*(.+)$/);
      if (m) {
        const k = m[1].toLowerCase(), op = m[2], v = m[3];
        const val = k === "type" ? (TYPE_LABEL[e.type] || e.type) : e[k];
        if (op === "=") { if (val !== v) return false; continue; }
        if (k === "sev" || k === "severity") {
          const r = SEV_RANK[v], cur = SEV_RANK[e.sev];
          if (op === ">=" && cur < r) return false;
          if (op === "<=" && cur > r) return false;
          continue;
        }
        return false;
      }
      const hay = (e.src + " " + e.dst + " " + e.user + " " + (TYPE_LABEL[e.type] || e.type) + " " + e.phase).toLowerCase();
      if (!hay.includes(tk.toLowerCase())) return false;
    }
    return true;
  }
  function renderSiem() {
    const t = typeSel.value, s = sevSel.value, q = queryEl.value;
    const rows = IR_EVENTS.filter((e) =>
      (t === "all" || e.type === t) &&
      (s === "all" || e.sev === s) &&
      (!q || evalQuery(e, q)));
    bodyEl.innerHTML = rows.map(rowHtml).join("") || "<tr><td colspan='7'>لا نتائج مطابقة.</td></tr>";

    const bar = $id("siemBar"); if (bar) {
      bar.innerHTML = "";
      const counts = {};
      IR_EVENTS.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1; });
      const max = Math.max(1, ...Object.values(counts));
      Object.keys(counts).sort().forEach((k) => {
        const row = document.createElement("div");
        row.className = "sbar-row";
        row.innerHTML = "<span class='sbar-label'>" + (TYPE_LABEL[k] || k) + "</span><span class='sbar-track'><i style='width:" +
          Math.round(counts[k] / max * 100) + "%'></i></span><span class='sbar-n'>" + counts[k] + "</span>";
        bar.appendChild(row);
      });
    }
    const donut = $id("siemDonut"); if (donut) {
      donut.innerHTML = "";
      const sevCounts = { crit: 0, high: 0, med: 0, low: 0 };
      IR_EVENTS.forEach((e) => { sevCounts[e.sev]++; });
      const colors = { crit: "#f87171", high: "#fb923c", med: "#fbbf24", low: "#4ade80" };
      let acc = 0; const segs = [];
      Object.keys(sevCounts).forEach((k) => {
        const pct = sevCounts[k] / IR_EVENTS.length * 100;
        segs.push(colors[k] + " " + acc + "% " + (acc + pct) + "%");
        acc += pct;
      });
      donut.style.background = "conic-gradient(" + segs.join(",") + ")";
    }
  }
  if (typeSel) Object.keys(TYPE_LABEL).forEach((k) => { const o = document.createElement("option"); o.value = k; o.textContent = TYPE_LABEL[k]; typeSel.appendChild(o); });
  if (runBtn) { runBtn.addEventListener("click", renderSiem); queryEl.addEventListener("keydown", (e) => { if (e.key === "Enter") renderSiem(); }); }
  if (resetBtn) resetBtn.addEventListener("click", () => { typeSel.value = "all"; sevSel.value = "all"; queryEl.value = ""; renderSiem(); });
  renderSiem();
/* ---------- timeline (kill-chain) ---------- */
  const bucketsEl = $id("tlBuckets"), linkBtn = $id("tlLink"), tlNote = $id("tlNote"),
    tlDetail = $id("tlDetail");
  function renderTimeline() {
    if (!bucketsEl) return;
    bucketsEl.innerHTML = "";
    let total = 0;
    PHASES.forEach((ph) => {
      const evs = IR_EVENTS.filter((e) => e.phase === ph);
      if (!evs.length) return;
      total += evs.length;
      const card = document.createElement("div");
      card.className = "bucket";
      card.innerHTML = "<h4>" + (PHASE_AR[ph] || ph) + " <span>(" + evs.length + ")</span></h4>" +
        evs.map((e) => "<button type='button' class='tl-ev' data-idx='" + (IR_EVENTS.indexOf(e)) + "'>" +
          e.t + " · " + (TYPE_LABEL[e.type] || e.type) + " · " + e.src + " → " + e.dst + "</button>").join("");
      bucketsEl.appendChild(card);
    });
    bucketsEl.insertAdjacentHTML("afterbegin", "<p class='tl-total'>إجمالي الأحداث المعروضة: " + total + "</p>");
  }
  function showDetail(e) {
    if (!tlDetail) return;
    tlDetail.hidden = false;
    tlDetail.innerHTML = "<h4>تفاصيل الحدث " + e.t + "</h4><p>المصدر <b>" + e.src + "</b> → الوجهة <b>" + e.dst +
      "</b> · المستخدم <b>" + e.user + "</b></p><p>النوع: " + (TYPE_LABEL[e.type] || e.type) + " · الخطورة: " +
      e.sev + " · المرحلة: " + (PHASE_AR[e.phase] || e.phase) + "</p><p class='tl-cam'>الحملة: " +
      (e.cam || "—") + " · الإجراء: " + e.act + "</p>";
  }
  if (bucketsEl) bucketsEl.addEventListener("click", (ev) => {
    const b = ev.target.closest(".tl-ev");
    if (b) showDetail(IR_EVENTS[+b.getAttribute("data-idx")]);
  });
  if (linkBtn) linkBtn.addEventListener("click", () => {
    const cams = [...new Set(IR_EVENTS.map((e) => e.cam).filter(Boolean))];
    tlNote.textContent = "الحملات المكتشفة: " + cams.join("، ") + " — الأحداث نفسها مرتبطة تلقائيًا في الجدول عبر نفس المصدر/الوجهة.";
    renderTimeline();
  });
  renderTimeline();

  /* ---------- RCA challenges ---------- */
  const RCA_SCEN = [
    {
      title: "RCA #1 — تسريب قاعدة بيانات",
      snippet: "22:10 — بلاغ عن ملف students.csv معروض للعموم على خادم الويب.\n21:58 — فشل دخول متكرر ثم نجاح من 203.0.113.9.\n21:40 — فحص منافذ TCP من نفس المصدر.",
      options: [
        "كلمة مرور ضعيفة + غياب قفل حساب (تسلسل فعلًا إلى تسريب بيانات)",
        "خلل في الشبكة فقط ولا علاقة له بالتسريب",
        "الخادم المتضرر يقع خارج نطاق المسؤولية تمامًا"
      ],
      correct: 0,
      why: "الترتيب (فحص ← قوة تخمين ← دخول ← تسريب) يشير إلى سلسلة تخمين بيانات الدخول ثم استغلال الوصول، لا مشكلة عشوائية."
    },
    {
      title: "RCA #2 — باب خلفي على خادم FTP",
      snippet: "09:00 — توقف خدمة FTP مؤقتًا ثم عادت مع ملف جديد (x.sh).\n08:30 — تنبيه تسجيل دخول ناجح من عنوان خارجي.\n07:50 — رفض حزم SYN كثيرة من نفس العنوان.",
      options: [
        "الحدث طبيعي ولا يحتاج تدخلًا",
        "حمولة TCP مشبوهة أُنزلت بعد تسجيل دخول غير مصرح — استدلال على اختراق مباشر",
        "توقف الخدمة سببه ببساطة نقص الذاكرة"
      ],
      correct: 1,
      why: "تزامن تسجيل الدخول الخارجي مع ظهور ملف جديد بعد إعادة تشغيل الخدمة هو نمط نموذجي للباب الخلفي (persistence)."
    }
  ];
  const rcaList = $id("rcaList");
  function renderRca() {
    if (!rcaList) return;
    rcaList.innerHTML = "";
    RCA_SCEN.forEach((sc, i) => {
      const card = document.createElement("div");
      card.className = "rca-card";
      card.innerHTML = "<h4>" + sc.title + "</h4><pre class='rca-snippet'>" + labEsc(sc.snippet) + "</pre><div class='rca-opts'></div><p class='rca-fb' role='status'></p>";
      const opts = card.querySelector(".rca-opts");
      sc.options.forEach((o, oi) => {
        const lab = document.createElement("label");
        lab.innerHTML = "<input type='radio' name='rca" + i + "' value='" + oi + "' /> " + labEsc(o);
        opts.appendChild(lab);
      });
      const fb = card.querySelector(".rca-fb");
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "btn btn-sm btn-primary";
      btn.textContent = "تحقق من السبب الجذري";
      btn.addEventListener("click", () => {
        const sel = card.querySelector("input:checked");
        if (!sel) { fb.textContent = "اختر أحد الخيارات أولًا."; fb.className = "rca-fb is-warn"; return; }
        const ok = +sel.value === sc.correct;
        fb.textContent = (ok ? "✅ صحيح: " : "❌ راجع: ") + sc.why;
        fb.className = "rca-fb" + (ok ? " is-ok" : " is-bad");
      });
      card.appendChild(btn);
      rcaList.appendChild(card);
    });
  }
  renderRca();
/* ---------- live incident simulator + team chat ---------- */
  const irLog = $id("irLog"), irForm = $id("irForm"), irInput = $id("irInput"),
    teamLog = $id("teamLog"), teamForm = $id("teamForm"), teamInput = $id("teamInput"),
    teamPhase = $id("teamPhase");
  const CAMPAIGN = {
    name: "تخمين بيانات الدخول → تسريب بيانات",
    alerts: [
      { id: "b1", delay: 1200, sev: "high", text: "40 محاولة دخول فاشلة من 203.0.113.77 على حساب admin (10.0.0.12)" },
      { id: "b2", delay: 6000, sev: "crit", text: "دخول ناجح من 203.0.113.77 بحساب admin — بيانات اعتماد مسربة" },
      { id: "b3", delay: 11000, sev: "crit", text: "تصدير CSV ضخم من /api/students عبر نفس الجلسة" }
    ]
  };
  const MITIGATE = { b1: "block src 203.0.113.77", b2: "disable admin", b3: "stop export" };
  const TEAM_HINTS = {
    b1: ["أحلام (تحليل): فحص المصدر 203.0.113.77 — أوقف المحاولات عبر قاعدة جدار ناري.",
      "بدر (شبكات): أضف حدًا للمحاولات (rate limit) على واجهة الدخول."],
    b2: ["نور (تأمين): الدخول الناجح يعني بيانات اعتماد مكشوفة — عطّل الحساب وأعد تعيين كلمة المرور فورًا.",
      "بدر (شبكات): راجع الجلسات النشطة وأغلقها من العنوان الخارجي."],
    b3: ["أحلام (تحليل): البيانات غادرت — أوقف نقطة التصدير ثم وثّق كل الملفات المصدّرة.",
      "نور (تأمين): بعد الإيقاف، التقط عيّنة للتحليل وحفظ الأدلة."]
  };
  const LIVE = { contained: {}, timers: [], started: false, done: false, startAt: 0 };

  function irOut(text, cls) {
    if (!irLog) return;
    const p = document.createElement("p");
    p.className = "cmd-line " + (cls || "cmd-neutral");
    p.textContent = text;
    irLog.appendChild(p);
    irLog.scrollTop = irLog.scrollHeight;
  }
  function teamOut(who, text, cls) {
    if (!teamLog) return;
    const p = document.createElement("p");
    p.className = "team-line " + (cls || "");
    p.innerHTML = "<b>" + labEsc(who) + ":</b> <span>" + labEsc(text) + "</span>";
    teamLog.appendChild(p);
    teamLog.scrollTop = teamLog.scrollHeight;
  }
  function startCampaign() {
    Object.keys(MITIGATE).forEach((k) => { LIVE.contained[k] = false; });
    LIVE.done = false; LIVE.startAt = Date.now();
    irOut("بدء محاكاة: " + CAMPAIGN.name, "cmd-sys");
    CAMPAIGN.alerts.forEach((a) => {
      const id = setTimeout(() => {
        irOut("🔔 [" + a.sev.toUpperCase() + "] " + a.text, a.sev === "crit" ? "cmd-bad" : "cmd-warn");
        teamOut("أحلام", "تنبيه جديد! إليك التلميح: " + TEAM_HINTS[a.id][0], "is-info");
      }, a.delay);
      LIVE.timers.push(id);
    });
  }
  function clearTimers() { LIVE.timers.forEach(clearTimeout); LIVE.timers = []; }

  function irDispatch(line) {
    const parts = line.trim().toLowerCase().split(/\s+/);
    const cmd = parts[0];
    if (cmd === "help") { irOut("alerts · detail <id> · contain <id> · status · restart · clear", "cmd-neutral"); return; }
    if (cmd === "clear") { if (irLog) irLog.innerHTML = ""; return; }
    if (cmd === "restart") { clearTimers(); startCampaign(); return; }
    if (cmd === "alerts") {
      CAMPAIGN.alerts.forEach((a) => irOut((LIVE.contained[a.id] ? "✓ [محتوى] " : "○ ") + a.id + " [" + a.sev + "] " + a.text,
        LIVE.contained[a.id] ? "cmd-ok" : "cmd-neutral"));
      return;
    }
    if (cmd === "detail") {
      const a = CAMPAIGN.alerts.find((x) => x.id === parts[1]);
      if (!a) { irOut("حدث غير معروف — جرّب alerts للقائمة.", "cmd-warn"); return; }
      irOut("[" + a.id + "] " + a.text + " — الحل: " + MITIGATE[a.id], "cmd-neutral");
      return;
    }
    if (cmd === "contain") {
      const id = parts[1];
      const a = CAMPAIGN.alerts.find((x) => x.id === id);
      if (!a) { irOut("استخدم contain <id> (من قائمة alerts).", "cmd-warn"); return; }
      if (LIVE.contained[id]) { irOut("محتوى مسبقًا.", "cmd-ok"); return; }
      const expect = MITIGATE[id].split(" ")[0];
      const ok = parts[2] === expect ||
        (expect === "block" && parts[2] === "src" && parts[3] === "203.0.113.77");
      if (ok) {
        LIVE.contained[id] = true;
        irOut("✅ تمت احتواء " + id + " (" + MITIGATE[id] + ")", "cmd-ok");
        if (teamPhase) teamPhase.textContent = CAMPAIGN.alerts.filter((x) => !LIVE.contained[x.id]).length + " حوادث مفتوحة";
        if (CAMPAIGN.alerts.every((x) => LIVE.contained[x.id])) {
          LIVE.done = true;
          irOut("🎉 كل الحوادث محتواة خلال " + Math.round((Date.now() - LIVE.startAt) / 1000) + "ث.", "cmd-flag");
          labToast("احتواء كامل للحادثة! 🧯", "ok");
        }
      } else {
        irOut("⚠️ إجراء غير مناسب — تابع التحليل (detail <id>).", "cmd-bad");
        teamOut("أحلام", "أنظر ماذا يتطلب هذا الحدث: " + MITIGATE[id], "is-warn");
      }
      return;
    }
    if (cmd === "status") {
      const cont = CAMPAIGN.alerts.filter((a) => LIVE.contained[a.id]).length;
      irOut("الحالة: " + cont + "/" + CAMPAIGN.alerts.length + " حوادث محتواة · " +
        (LIVE.done ? "انتهت 🎉" : CAMPAIGN.alerts.find((a) => !LIVE.contained[a.id]) ? "التالي: " + CAMPAIGN.alerts.find((a) => !LIVE.contained[a.id]).id : "لا أحداث قادمة"), "cmd-neutral");
      return;
    }
    irOut("أمر غير معروف — اكتب help", "cmd-bad");
  }
if (irForm) irForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const line = irInput.value;
    irInput.value = "";
    if (!/^(help|clear|restart)$/.test(line.trim().toLowerCase())) irOut("$ " + line, "cmd-sys");
    irDispatch(line);
  });
  const HINT_TRIGGER = /ساعد|كيف|تلميح|brute|فشل|فحص|دخول|تسريب|ماذا|أعمل/;
  if (teamForm) teamForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = teamInput.value.trim();
    teamInput.value = "";
    if (!msg) return;
    teamOut("أنت", msg, "is-me");
    const active = CAMPAIGN.alerts.filter((a) => !LIVE.contained[a.id])[0];
    if (active && HINT_TRIGGER.test(msg)) {
      const used = LIVE[active.id + "_hint"] || 0;
      const hint = TEAM_HINTS[active.id][used];
      setTimeout(() => teamOut("المحلل الآلي", hint || "راجع detail <id> لأقرب حل معتمد.", "is-info"), 700);
      LIVE[active.id + "_hint"] = used + 1;
    } else if (active) {
      setTimeout(() => teamOut("المحلل الآلي", "الوضع الحالي: " + active.text + " — اطلب تلميحًا بـ «ساعدني».", "is-info"), 700);
    } else {
      setTimeout(() => teamOut("المحلل الآلي", "الحادثة محتواة بالكامل. وثّق ما فعلته.", "is-ok"), 700);
    }
  });
  if (teamPhase) teamPhase.textContent = "0 حوادث";
  if (teamForm) teamOut("نور", "مرحبًا! أنا محلل الأمن. اكتب «ساعدني» في أي وقت.", "is-ok");
  if (irForm) startCampaign();
})();
/* ============================================================
   M47 · Cryptography Learning Center
   Vigenère + Enigma + RSA + DES single round + freq + collision
   ============================================================ */
(() => {
  "use strict";
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  /* ---------- Vigenère ---------- */
  function vigUnit(text, key) {
    const k = (key || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (!k) return text;
    let ki = 0;
    return text.toUpperCase().replace(/[A-Z]/g, (ch) => {
      const i = ALPHA.indexOf(ch);
      if (i < 0) return ch;
      const j = ALPHA.indexOf(k[ki % k.length]);
      ki++;
      return ALPHA[(i + j) % 26];
    });
  }
  function vigDec(text, key) {
    const k = (key || "").toUpperCase().replace(/[^A-Z]/g, "");
    if (!k) return text;
    let ki = 0;
    return text.toUpperCase().replace(/[A-Z]/g, (ch) => {
      const i = ALPHA.indexOf(ch);
      if (i < 0) return ch;
      const j = ALPHA.indexOf(k[ki % k.length]);
      ki++;
      return ALPHA[(i - j + 26) % 26];
    });
  }
  const vigEncBtn = $id("vigEnc"), vigDecBtn = $id("vigDec"), vigOut = $id("vigOut");
  if (vigEncBtn) {
    const run = (fn) => { vigOut.textContent = fn($id("vigText").value, $id("vigKey").value); };
    vigEncBtn.addEventListener("click", () => run(vigUnit));
    vigDecBtn.addEventListener("click", () => run(vigDec));
  }

  /* ---------- Enigma ---------- */
  const ROTORS = {
    I:   { w: "EKMFLGDQVZNTOWYHXUSPAIBRCJ", notch: "Q" },
    II:  { w: "AJDKSIRUXBLHWTMCQGZNPYFVOE", notch: "E" },
    III: { w: "BDFHJLCPRTXVZNYEIWGAKMUSQO", notch: "V" },
    IV:  { w: "ESOVPZJAYQUIRHXLNFTGKDCMWB", notch: "J" },
    V:   { w: "VZBRGITYUPSDNHLXAWMJQOFECK", notch: "Z" }
  };
  const REF_B = "YRUHQSLDPXNGOKMIEBFZCWVJAT";

  function enigmaStep(rotors, pos) {
    pos[0] = (pos[0] + 1) % 26;
    for (let i = 1; i < rotors.length; i++) {
      if (pos[i - 1] === ROTORS[rotors[i - 1]].notch.charCodeAt(0) - 65) pos[i] = (pos[i] + 1) % 26;
    }
  }
  function enigmaChar(ch, rotors, pos, plug) {
    let x = ch.charCodeAt(0) - 65;
    if (plug[x] !== undefined) x = plug[x];
    for (let i = 0; i < rotors.length; i++) {
      const r = ROTORS[rotors[i]];
      const rel = (x + pos[i]) % 26;
      x = ((r.w.charCodeAt(rel) - 65 - pos[i]) % 26 + 26) % 26;
    }
    x = REF_B.charCodeAt(x) - 65;
    for (let i = rotors.length - 1; i >= 0; i--) {
      const r = ROTORS[rotors[i]];
      const rel = (x + pos[i]) % 26;
      x = ((r.w.indexOf(ALPHA[rel]) - pos[i]) % 26 + 26) % 26;
    }
    if (plug[x] !== undefined) x = plug[x];
    return ALPHA[x];
  }
  function enigmaRun(text, rotors, posLetters, plugPairs) {
    const disp = (rotors || "I III II").trim().split(/\s+/).filter((r) => ROTORS[r]);
    if (!disp.length) return text;
    const rotors_ = disp.slice().reverse();
    const posRaw = (posLetters || "AAA").toUpperCase().replace(/[^A-Z]/g, "");
    const pos = posRaw.padEnd(disp.length, "A").slice(0, disp.length)
      .split("").reverse().map((c) => c.charCodeAt(0) - 65);
    const plug = {};
    (plugPairs || "").toUpperCase().split(/\s+/).forEach((p) => {
      if (p.length >= 2) {
        const a = p[0].charCodeAt(0) - 65, b = p[1].charCodeAt(0) - 65;
        if (a >= 0 && a < 26 && b >= 0 && b < 26) { plug[a] = b; plug[b] = a; }
      }
    });
    return text.toUpperCase().replace(/[A-Z]/g, (ch) => {
      enigmaStep(rotors_, pos);
      return enigmaChar(ch, rotors_, pos, plug);
    });
  }
  const enigmaBtn = $id("enigmaRun"), enigmaOut = $id("enigmaOut");
  if (enigmaBtn) enigmaBtn.addEventListener("click", () => {
    enigmaOut.textContent = enigmaRun($id("enigmaIn").value, $id("enigmaRotors").value, $id("enigmaPos").value, $id("enigmaPlug").value);
  });
/* ---------- RSA step-by-step / live editor ---------- */
  function isPrime(n) {
    if (n < 2) return false;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
    return true;
  }
  function egcd(a, b) {
    if (b === 0) return [a, 1, 0];
    const [g, x, y] = egcd(b, a % b);
    return [g, y, x - Math.floor(a / b) * y];
  }
  function modpow(b, e, m) {
    b %= m; let r = 1;
    while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; }
    return r;
  }
  const rsaPEl = $id("rsaP"), rsaQEl = $id("rsaQ"), rsaMsgEl = $id("rsaMsg"),
    rsaBtn = $id("rsaRun"), rsaOut = $id("rsaOut");
  if (rsaBtn) rsaBtn.addEventListener("click", () => {
    const p = parseInt(rsaPEl.value, 10), q = parseInt(rsaQEl.value, 10);
    if (!isPrime(p) || !isPrime(q) || p * q < 260) { rsaOut.textContent = "أدخل عددين أوليين كبيرين بما يكفي (n > 255، مثال: 61 و 53)."; return; }
    const n = p * q, phi = (p - 1) * (q - 1);
    let e = 65537;
    if (e >= phi || egcd(e, phi)[0] !== 1) { e = 3; while (egcd(e, phi)[0] !== 1) e += 2; }
    const [, d0] = egcd(e, phi);
    const d = ((d0 % phi) + phi) % phi;
    const msg = rsaMsgEl.value || "SEC";
    const enc = [...msg].map((c) => modpow(c.charCodeAt(0), e, n));
    const dec = enc.map((c) => modpow(c, d, n)).map((c) => String.fromCharCode(c)).join("");
    rsaOut.textContent =
      "p=" + p + "  q=" + q + "\nn=" + n + "  φ(n)=" + phi +
      "\ne=" + e + "  d=" + d + "  (e·d ≡ 1 mod φ(n))" +
      "\nتشفير (c = m^e mod n): " + enc.join(" ") +
      "\nفك (m = c^d mod n): " + dec;
  });

  /* ---------- frequency analysis + Caesar solver ---------- */
  const freqInEl = $id("freqIn"), freqBtn = $id("freqRun"), freqSvgEl = $id("freqSvg"), freqOutEl = $id("freqOut");
  const EN_FREQ = [0.0817, 0.0149, 0.0278, 0.0425, 0.1270, 0.0223, 0.0202, 0.0609, 0.0697, 0.0015, 0.0077, 0.0403, 0.0241,
    0.0675, 0.0751, 0.0193, 0.0010, 0.0599, 0.0633, 0.0906, 0.0276, 0.0098, 0.0236, 0.0015, 0.0197, 0.0007];
  function shiftLetters(text, s) {
    return text.replace(/[a-zA-Z]/g, (ch) => {
      const base = ch <= "Z" ? 65 : 97;
      return String.fromCharCode(((ch.charCodeAt(0) - base + s) % 26 + 26) % 26 + base);
    });
  }
  if (freqBtn) freqBtn.addEventListener("click", () => {
    const text = freqInEl.value.toUpperCase();
    const latin = {}; let n = 0;
    for (const ch of text) if (/[A-Z]/.test(ch)) { latin[ch] = (latin[ch] || 0) + 1; n++; }
    freqSvgEl.innerHTML = "";
    const max = Math.max(1, ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => latin[c] || 0));
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((c) => {
      const b = document.createElement("div");
      b.className = "freq-bar";
      b.style.height = Math.round(((latin[c] || 0) / max) * 100) + "%";
      b.title = c + ": " + (latin[c] || 0) + " (" + b.style.height + ")";
      freqSvgEl.appendChild(b);
    });
    let ioc = 0;
    if (n > 1) {
      let s = 0;
      for (const c in latin) s += latin[c] * (latin[c] - 1);
      ioc = s / (n * (n - 1));
    }
    const scores = [];
    for (let shift = 0; shift < 26; shift++) {
      let chi = 0;
      for (let c = 0; c < 26; c++) {
        const exp = n * EN_FREQ[(c - shift + 26) % 26];
        const obs = latin[String.fromCharCode(65 + c)] || 0;
        chi += exp > 0 ? ((obs - exp) * (obs - exp)) / exp : 0;
      }
      scores.push(shift);
    }
    scores.sort((a, b) =>
      (function chi(s) {
        let v = 0;
        for (let c = 0; c < 26; c++) {
          const exp = n * EN_FREQ[(c - s + 26) % 26];
          const obs = latin[String.fromCharCode(65 + c)] || 0;
          v += exp > 0 ? ((obs - exp) * (obs - exp)) / exp : 0;
        }
        return v;
      })(a) - (function chi(s) {
        let v = 0;
        for (let c = 0; c < 26; c++) {
          const exp = n * EN_FREQ[(c - s + 26) % 26];
          const obs = latin[String.fromCharCode(65 + c)] || 0;
          v += exp > 0 ? ((obs - exp) * (obs - exp)) / exp : 0;
        }
        return v;
      })(b));
    const top3 = scores.slice(0, 3).map((s) => "إزاحة " + s + " → " + shiftLetters(text, s).slice(0, 60)).join(" ||\n");
    freqOutEl.textContent = "أحرف لاتينية: " + n + " · مؤشر التوافق IoC: " + ioc.toFixed(3) +
      " (إنجليزية عادية ≈ 0.066)\nأفضل مرشحات Caesar (chi² الأصغر):\n" + top3;
  });

  /* ---------- hash collision demo ---------- */
  const colBtn = $id("colRun"), colFill = $id("colFill"), colOut = $id("colOut");
  if (colBtn) colBtn.addEventListener("click", () => {
    const map = new Map();
    let tries = 0; const limit = 120000;
    const step = () => {
      for (let k = 0; k < 4000 && tries < limit; k++) {
        tries++;
        let s = "";
        for (let i = 0; i < 6; i++) s += "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
        const h = fnv1a32(s);
        if (map.has(h) && map.get(h) !== s) {
          colFill.style.width = "100%";
          colOut.textContent = "🎯 تصادم بعد " + tries + " محاولة (بحث عيد الميلاد):\nأ1 = \"" + map.get(h) +
            "\" → 0x" + h.toString(16).padStart(8, "0") + "\nأ2 = \"" + s + "\" → 0x" + h.toString(16).padStart(8, "0");
          return;
        }
        map.set(h, s);
      }
      colFill.style.width = Math.min(100, (tries / limit) * 100) + "%";
      if (tries < limit) setTimeout(step, 0);
      else colOut.textContent = "لم يُعثر على تصادم خلال " + limit + " محاولة — أعد المحاولة.";
    };
    colOut.textContent = "جارٍ البحث…";
    step();
  });
/* ---------- DES single-round viewer (real FIPS-46 tables) ---------- */
  const DES_IP = [58, 50, 42, 34, 26, 18, 10, 2, 60, 52, 44, 36, 28, 20, 12, 4, 62, 54, 46, 38, 30, 22, 14, 6, 64, 56, 48, 40, 32, 24, 16, 8,
    57, 49, 41, 33, 25, 17, 9, 1, 59, 51, 43, 35, 27, 19, 11, 3, 61, 53, 45, 37, 29, 21, 13, 5, 63, 55, 47, 39, 31, 23, 15, 7];
  const DES_E = [32, 1, 2, 3, 4, 5, 4, 5, 6, 7, 8, 9, 8, 9, 10, 11, 12, 13, 12, 13, 14, 15, 16, 17,
    16, 17, 18, 19, 20, 21, 20, 21, 22, 23, 24, 25, 24, 25, 26, 27, 28, 29, 28, 29, 30, 31, 32, 1];
  const DES_P = [16, 7, 20, 21, 29, 12, 28, 17, 1, 15, 23, 26, 5, 18, 31, 10, 2, 8, 24, 14, 32, 27, 3, 9, 19, 13, 30, 6, 22, 11, 4, 25];
  const DES_PC1 = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36,
    63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
  const DES_PC2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2,
    41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
  const DES_S = [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7, 0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8,
      4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0, 15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10, 3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5,
      0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15, 13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8, 13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1,
      13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7, 1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15, 13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9,
      10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4, 3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9, 14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6,
      4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14, 11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11, 10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8,
      9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6, 4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1, 13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6,
      1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2, 6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7, 1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2,
      7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8, 2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11]
  ];
function hexToBits(h) {
    const bits = [];
    for (const ch of String(h).trim()) {
      const v = parseInt(ch, 16);
      if (isNaN(v)) continue;
      bits.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1);
    }
    return bits;
  }
  function bitsToHex(bits) {
    let s = "";
    for (let i = 0; i + 4 <= bits.length; i += 4) {
      let v = 0;
      for (let k = 0; k < 4; k++) v = v * 2 + bits[i + k];
      s += v.toString(16).toUpperCase();
    }
    return s;
  }
  function permute(bits, T) { return T.map((i) => bits[i - 1]); }
  function xorBits(a, b) { return a.map((x, i) => x ^ (b[i] || 0)); }
  function sbox(grp, i) {
    const row = (grp[0] << 1) | grp[5];
    const col = (grp[1] << 3) | (grp[2] << 2) | (grp[3] << 1) | grp[4];
    const v = DES_S[i][row * 16 + col];
    return [(v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1];
  }
  function desRound(blockHex, keyHex) {
    const block = hexToBits(blockHex), key = hexToBits(keyHex);
    const ip = permute(block, DES_IP);
    let L = ip.slice(0, 32), R = ip.slice(32);
    const CD = permute(key, DES_PC1);
    let C = CD.slice(0, 28), D = CD.slice(28);
    C = C.slice(1).concat(C[0]); D = D.slice(1).concat(D[0]);
    const K1 = permute(C.concat(D), DES_PC2);
    const ER = permute(R, DES_E);
    const X = xorBits(ER, K1);
    const groups = [];
    for (let i = 0; i < 48; i += 6) groups.push(X.slice(i, i + 6));
    const sOuts = groups.map((g, i) => sbox(g, i));
    const fOut = permute([].concat(...sOuts), DES_P);
    const L1 = R;
    const R1 = xorBits(L, fOut);
    return [
      "بلوك: " + blockHex + "  |  مفتاح: " + keyHex,
      "بعد IP: " + bitsToHex(ip) + "  →  L0 = " + bitsToHex(L) + "  R0 = " + bitsToHex(R),
      "K1 (PC1 → إزاحة يسار 1 → PC2) = " + bitsToHex(K1),
      "E(R0) ⊕ K1 = " + bitsToHex(X),
      "S1..S8(" + groups.map((g) => g.join("")).join(" ") + ") ثم P = " + bitsToHex(fOut),
      "L1 = R0 = " + bitsToHex(L1),
      "R1 = L0 ⊕ f(R0,K1) = " + bitsToHex(R1)
    ].join("\n");
  }
  const desBtn = $id("desRun"), desKey = $id("desKey"), desBlock = $id("desBlock"), desOut = $id("desOut");
  if (desBtn) desBtn.addEventListener("click", () => {
    const k = (desKey.value || "").trim().replace(/\s+/g, "");
    const b = (desBlock.value || "").trim().replace(/\s+/g, "");
    if (!/^[0-9a-fA-F]{16}$/.test(k) || !/^[0-9a-fA-F]{16}$/.test(b)) {
      desOut.textContent = "أدخل 16 رمزًا سداسيًا لكلٍّ من المفتاح والبلوك (مثال: 133457799BBCDFF1 / 0123456789ABCDEF).";
      return;
    }
    desOut.textContent = desRound(b, k);
  });
})();
/* ============================================================
   M48 · New Cyber Tools — regex · firewall · vuln · sniff · port
   ============================================================ */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const regexPatt = $("regexPatt"), regexText = $("regexText"), regexRun = $("regexRun"),
    regexRes = $("regexRes"), regexSvg = $("regexSvg");
  let RX_STEPS = 0;

  /* ------- minimal regex parser (subset) ------- */
  function rxParse(src) {
    let pos = 0;
    function peek() { return src[pos]; }
    function err(m) { throw new Error(m + " @" + pos); }
    function parseAlt() {
      const alts = [parseSeq()];
      while (peek() === "|") { pos++; alts.push(parseSeq()); }
      return alts.length === 1 ? alts[0] : { t: "alt", alts };
    }
    function parseSeq() {
      const items = [];
      while (pos < src.length && "|)".indexOf(peek()) < 0) items.push(parseRep());
      return items.length === 0 ? { t: "empty" } : items.length === 1 ? items[0] : { t: "seq", items };
    }
    function parseRep() {
      let atom = parseAtom();
      if ("?*+{".indexOf(peek()) >= 0) {
        const op = peek();
        if (op === "{") {
          pos++; let mn = "", mx = "";
          while (/[0-9]/.test(peek())) { mn += peek(); pos++; }
          if (peek() === ",") { pos++; while (/[0-9]/.test(peek())) { mx += peek(); pos++; } }
          if (peek() !== "}") err("range");
          pos++;
          atom = { t: "rep", atom, min: +mn || 0, max: mx === "" ? null : +mx };
        } else {
          pos++;
          atom = { t: "rep", atom, min: op === "?" ? 0 : op === "*" ? 0 : 1, max: op === "+" ? null : (op === "?" ? 1 : null) };
        }
      }
      return atom;
    }
    function parseAtom() {
      const c = peek();
      if (c === "(") { pos++; const e = parseAlt(); if (peek() !== ")") err("unclosed ("); pos++; return { t: "group", node: e }; }
      if (c === "[") {
        pos++; let neg = false, set = [];
        if (peek() === "^") { neg = true; pos++; }
        while (pos < src.length && peek() !== "]") {
          if (src[pos + 1] === "-" && src[pos + 2] && src[pos + 2] !== "]") { set.push([src[pos], src[pos + 2]]); pos += 3; }
          else { set.push(src[pos]); pos++; }
        }
        if (peek() !== "]") err("unclosed [");
        pos++;
        return { t: "class", neg, set };
      }
      if (c === ".") { pos++; return { t: "dot" }; }
      if (c === "\\") {
        pos++; const e = peek(); if (!e) err("dangling \\"); pos++;
        return { t: "clse", sym: e };
      }
      if (c === "^") { pos++; return { t: "anch", which: "s" }; }
      if (c === "$") { pos++; return { t: "anch", which: "e" }; }
      if (!c || c === ")" || c === "|") err("unexpected '" + (c || "EOF") + "'");
      pos++;
      return { t: "char", ch: c };
    }
    const ast = parseAlt();
    if (pos < src.length) err("trailing");
    return ast;
  }
function rxMatch(node, s, i) {
    RX_STEPS++;
    switch (node.t) {
      case "empty": return [i];
      case "char": return s[i] === node.ch ? [i + 1] : [];
      case "dot": return i < s.length && s[i] !== "\n" ? [i + 1] : [];
      case "anch": return node.which === "s" ? (i === 0 ? [0] : []) : (i === s.length ? [i] : []);
      case "clse": {
        const ch = s[i]; if (i >= s.length) return [];
        const d = /\d/.test(ch), w = /\w/.test(ch), sp = /\s/.test(ch);
        const ok = node.sym === "d" ? d : node.sym === "w" ? w : node.sym === "s" ? sp :
          node.sym === "b" ? (i === 0 ? w : !w ? /[\w]/.test(s[i - 1] || "") : !/[\w]/.test(s[i + 1] || "")) : false;
        if (node.sym === "b") return ok ? [i] : [];
        const hit = node.sym === "D" ? !d : node.sym === "W" ? !w : node.sym === "S" ? !sp : ok;
        return hit ? [i + 1] : [];
      }
      case "class": {
        const ch = s[i]; if (i >= s.length) return [];
        let hit = false;
        for (const e of node.set) {
          if (Array.isArray(e)) { if (ch >= e[0] && ch <= e[1]) hit = true; }
          else if (ch === e) hit = true;
        }
        return hit !== node.neg ? [i + 1] : [];
      }
      case "seq": {
        let ends = [i];
        for (const it of node.items) {
          const nx = [];
          for (const e of ends) nx.push(...rxMatch(it, s, e));
          ends = nx;
          if (!ends.length) break;
        }
        return ends;
      }
      case "alt": {
        const out = [];
        for (const a of node.alts) out.push(...rxMatch(a, s, i));
        return out;
      }
      case "group": return rxMatch(node.node, s, i);
      case "rep": {
        const res = [];
        (function rec(ci, cnt) {
          const cap = node.max === null ? 60 : node.max;
          if (cnt >= cap) return;
          for (const e of rxMatch(node.atom, s, ci)) {
            if (cnt + 1 >= node.min) res.push(e);
            if (cnt + 1 < cap) rec(e, cnt + 1);
          }
        })(i, 0);
        if (node.min === 0) res.push(i);
        return res;
      }
      default: return [];
    }
  }
  function rxAll(ast, s) {
    const found = [];
    RX_STEPS = 0;
    let seen = 0;
    for (let st = 0; st <= s.length; st++) {
      const ends = rxMatch(ast, s, st);
      for (const e of ends) if (e > st) { found.push([st, e]); seen += e - st; if (seen > 6000) return found; }
    }
    return found;
  }
  function rxPaint(pat, text, found, plain) {
    const NS = "http://www.w3.org/2000/svg";
    regexSvg.innerHTML = "";
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", 14); t.setAttribute("y", 30);
    t.setAttribute("fill", "var(--muted, #94a3b8)"); t.setAttribute("font-size", "13");
    t.textContent = "نمط: " + pat + (plain ? "  — النص المميز: " + text.slice(0, 90) : " (رسم مبسط)");
    regexSvg.appendChild(t);
  }
  if (regexRun) regexRun.addEventListener("click", () => {
    const pat = regexPatt.value, text = regexText.value;
    try {
      const ast = rxParse(pat);
      const found = rxAll(ast, text);
      const hl = text.split("").map((c) => c);
      found.forEach(([a, b]) => { for (let i = a; i < b; i++) hl[i] = "«" + hl[i] + "»"; });
      regexRes.textContent = "خطوات: " + RX_STEPS +
        (found.length ? " · تطابقات: " + found.slice(0, 12).map(([a, b]) => text.slice(a, b)).join(" | ") : " · لا تطابق");
      regexRes.textContent += "   النص: " + hl.join("").slice(0, 120);
      rxPaint(pat, text, found, true);
    } catch (err) {
      regexRes.textContent = "خطأ في النمط: " + err.message;
    }
  });
/* ---------- firewall rules simulator ---------- */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const actSel = $("fwAct"), protoSel = $("fwProto"), dstEl = $("fwDst"), portEl = $("fwPort"),
    addBtn = $("fwAdd"), bodyEl = $("fwBody"), probeIp = $("fwProbeIp"), probePort = $("fwProbePort"),
    probeProto = $("fwProbeProto"), testBtn = $("fwTest"), traceEl = $("fwTrace"), countEl = $("fwCount");
  if (!addBtn) return;
  let rules = [];
  function render() {
    bodyEl.innerHTML = rules.map((r, i) =>
      "<tr><td>" + (i + 1) + "</td><td>" + r.act + "</td><td>" + r.proto + "</td><td>" + r.dst + "</td><td>" + r.port + "</td>" +
      "<td><button type='button' class='btn btn-sm btn-ghost' data-del='" + i + "'>حذف</button></td></tr>").join("") ||
      "<tr><td colspan='6'>لا قواعد بعد.</td></tr>";
    countEl.textContent = "قواعد: " + rules.length +
      (rules.length ? " · " + rules.filter((r) => r.act === "allow").length + " allow / " + rules.filter((r) => r.act === "deny").length + " deny" : "");
  }
  addBtn.addEventListener("click", () => {
    const dst = dstEl.value.trim() || "*", port = (portEl.value || "").trim() || "*";
    rules.push({ act: actSel.value, proto: protoSel.value, dst, port });
    render();
  });
  bodyEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-del]");
    if (b) { rules.splice(+b.getAttribute("data-del"), 1); render(); }
  });
  /* MODULE 42 reset support: clear the in-memory rules too, so the
     educational Reset button restores the simulator honestly (not just
     the visible table). */
  document.addEventListener("nova:tool-reset", (e) => {
    if (e && e.detail && e.detail.id === "tool-fw") { rules = []; render(); traceEl.textContent = ""; }
  });
  testBtn.addEventListener("click", () => {
    const ip = probeIp.value.trim(), port = probePort.value.trim(), proto = probeProto.value;
    const trace = [];
    let verdict = "allow";
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const match = (r.proto === "*" || r.proto === proto) && (r.dst === "*" || r.dst === ip) && (r.port === "*" || r.port === port);
      trace.push("قاعدة " + (i + 1) + ": " + r.act + " " + r.proto + " → " + r.dst + ":" + r.port + (match ? "  ← تطابق!" : ""));
      if (match) { verdict = r.act; break; }
    }
    if (!rules.length) trace.push("(لا قواعد — السياسة الافتراضية: allow)");
    traceEl.textContent = "حزمة: " + proto + " " + ip + ":" + port + "\n" + trace.join("\n") +
      "\nالنتيجة النهائية: " + verdict.toUpperCase();
  });
  rules.push({ act: "deny", proto: "*", dst: "*", port: "23" },
    { act: "deny", proto: "udp", dst: "*", port: "69" },
    { act: "allow", proto: "tcp", dst: "10.0.0.5", port: "443" });
  render();
})();

/* ---------- vulnerability scanner (simulated) ---------- */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const targetSel = $("vulnTarget"), runBtn = $("vulnRun"), fillEl = $("vulnFill"), findings = $("vulnFindings");
  if (!runBtn) return;
  const TARGETS = {
    "10.0.0.5 — web-prod": [
      { sev: "crit", title: "CVE-2021-44228 (Log4Shell) في عارض السجلات", fix: "ترقية Log4j إلى 2.17.1" },
      { sev: "high", title: "رأس HSTS مفقود + إعادة توجيه HTTPS غير مفروضة", fix: "تفعيل HSTS وإجبار HTTPS" },
      { sev: "med", title: "نسخة Apache قديمة (2.4.29)", fix: "الترقية إلى 2.4.54" },
      { sev: "low", title: "منفذ 8080 أداري مكشوف داخليًا", fix: "تقييد الوصول بالجدار الناري" }
    ],
    "10.0.0.12 — mail": [
      { sev: "high", title: "SMTP open relay", fix: "تعطيل الإعادة المفتوحة" },
      { sev: "med", title: "شهادة TLS منتهية الصلاحية", fix: "تجديد الشهادة" }
    ],
    "10.0.0.30 — hr-app": [
      { sev: "crit", title: "تسجيل دخول بدون MFA (OWASP A07)", fix: "تفعيل MFA" },
      { sev: "high", title: "كلمات مرور افتراضية شائعة", fix: "فرض تغيير كلمة المرور" }
    ]
  };
  Object.keys(TARGETS).forEach((k) => { const o = document.createElement("option"); o.value = k; o.textContent = k; targetSel.appendChild(o); });
  runBtn.addEventListener("click", () => {
    const list = TARGETS[targetSel.value] || [];
    findings.innerHTML = "";
    const tick = (s) => {
      fillEl.style.width = Math.round((s / list.length) * 100) + "%";
      if (s >= list.length) {
        list.forEach((f) => {
          const d = document.createElement("div");
          d.className = "vuln-f is-" + f.sev;
          d.textContent = "[" + f.sev.toUpperCase() + "] " + f.title + " → " + f.fix;
          findings.appendChild(d);
        });
        fillEl.style.width = "100%";
      } else setTimeout(() => tick(s + 1), 220);
    };
    tick(0);
  });
})();
/* ---------- packet sniffer (decode hex → layers) ---------- */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const hexEl = $("sniffHex"), decBtn = $("sniffDecode"), sampleBtn = $("sniffSample"),
    octEl = $("sniffOctets"), outEl = $("sniffOut");
  if (!decBtn) return;
  const SAMPLE = "aa bb cc dd ee ff 11 22 33 44 55 66 08 00 45 00 00 28 12 34 40 00 40 06 00 00 c0 a8 01 0a 08 08 08 08 04 01 01 bb 00 00 00 01 00 00 00 00 50 18 20 00 00 00 00 00 48 49";
  function parseHex(s) { return s.trim().split(/[\s,]+/).filter(Boolean).map((h) => parseInt(h, 16)).filter((b) => !isNaN(b) && b >= 0 && b <= 255); }
  const hx = (b) => b.toString(16).padStart(2, "0").toUpperCase();
  const mac = (b, off) => b.slice(off, off + 6).map(hx).join(":");
  const ip = (b, off) => b[off] + "." + b[off + 1] + "." + b[off + 2] + "." + b[off + 3];
  function decode(raw) {
    const b = parseHex(raw);
    if (b.length < 34) { outEl.textContent = "تحتاج ≥ 34 بايت لفك Ethernet/IPv4/نقل."; return; }
    octEl.innerHTML = "";
    b.forEach((byte, i) => {
      const span = document.createElement("span");
      span.textContent = hx(byte);
      span.className = "oct " + (i < 14 ? "o-eth" : i < 34 ? "o-ip" : "o-tr");
      span.title = "بايت " + i + " (0x" + hx(byte) + ")";
      octEl.appendChild(span);
    });
    const ether = (b[12] << 8) | b[13];
    const ttl = b[22], proto = b[23];
    const sport = (b[34] << 8) | b[35], dport = (b[36] << 8) | b[37];
    const protoName = proto === 6 ? "TCP" : proto === 17 ? "UDP" : "IP#" + proto;
    let seg = "—";
    if (proto === 6 && b.length >= 54) {
      seg = "TCP seq=0x" + b.slice(38, 42).map(hx).join("") + " · flags=0x" + hx(b[46]) + " · win=" + ((b[48] << 8) | b[49]);
    }
    if (proto === 17 && b.length >= 42) { const len = (b[38] << 8) | b[39]; seg = "UDP length=" + len + " بايت"; }
    outEl.textContent =
      "Ethernet: → " + mac(b, 0) + "  ← " + mac(b, 6) + "  ethertype 0x" + ether.toString(16).padStart(4, "0") +
      "\nIPv4: " + ip(b, 26) + " → " + ip(b, 30) + "  TTL=" + ttl + "  proto=" + protoName +
      "\nنقل: srcPort=" + sport + "  dstPort=" + dport + "  " + seg +
      "\nحمولة: " + Math.max(0, b.length - 54) + " بايت — " + b.slice(54, 64).map(hx).join(" ") + (b.length > 64 ? " …" : "");
  }
  decBtn.addEventListener("click", () => decode(hexEl.value));
  sampleBtn.addEventListener("click", () => { hexEl.value = SAMPLE; decode(SAMPLE); });
})();

/* ---------- port scanner (visual sweep) ---------- */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const hostEl = $("portHost"), runBtn = $("portRun"), vizEl = $("portViz"), outEl = $("portOut");
  if (!runBtn) return;
  const PORTS = [22, 23, 80, 443, 3306, 3389, 8080];
  const NAMES = { 22: "ssh", 23: "telnet", 80: "http", 443: "https", 3306: "mysql", 3389: "rdp", 8080: "proxy" };
  function stateFor(host, port) {
    const r = (fnv1a32(host + ":" + port) % 1000) / 1000;
    return r < 0.45 ? "open" : r < 0.78 ? "closed" : "filtered";
  }
  runBtn.addEventListener("click", () => {
    const host = hostEl.value.trim() || "10.0.0.5";
    vizEl.innerHTML = "";
    outEl.textContent = "جارٍ فحص " + host + "…";
    PORTS.forEach((p, i) => {
      setTimeout(() => {
        const st = stateFor(host, p);
        const cell = document.createElement("div");
        cell.className = "port-cell is-" + st;
        cell.innerHTML = "<b>" + p + "</b><span>" + (NAMES[p] || "") + "</span><em>" + st + "</em>";
        cell.style.transitionDelay = (i * 30) + "ms";
        vizEl.appendChild(cell);
        if (i === PORTS.length - 1) {
          const opens = PORTS.filter((q) => stateFor(host, q) === "open");
          outEl.textContent = "اكتمل الفحص: " + host + " — مفتوحة: " + (opens.join(", ") || "لا شيء") +
            " · الحالة: " + (opens.length ? "مُعرض ⚠️" : "آمن ✅");
        }
      }, 250 + i * 260);
    });
  });
})();
/* ---------- crypto playground (educational) ---------- */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const algoEl = $("cpAlgo"), keyEl = $("cpKey"), inEl = $("cpIn"), outEl = $("cpOut"),
    encBtn = $("cpEnc"), decBtn = $("cpDec");
  if (!encBtn) return;
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  function caesar(s, k) {
    return s.replace(/[a-zA-Z]/g, (c) => {
      const b = c <= "Z" ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - b + k) % 26 + 26) % 26 + b);
    });
  }
  function vigenere(s, key, dec) {
    const k = key.toUpperCase().replace(/[^A-Z]/g, "");
    if (!k) return s;
    let i = 0;
    return s.toUpperCase().replace(/[A-Z]/g, (c) => {
      const j = A.indexOf(k[i % k.length]); i++;
      return A[(A.indexOf(c) + (dec ? -j : j) + 26) % 26];
    });
  }
  function xorBytes(bytes, key) {
    const k = utf8Bytes(key);
    return new TextDecoder().decode(Uint8Array.from(bytes.map((b, i) => b ^ k[i % k.length])));
  }
  function rc4Crypt(bytes, key) {
    const K = utf8Bytes(key);
    const S = Array.from({ length: 256 }, (_, i) => i);
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + K[i % K.length]) % 256;
      const t = S[i]; S[i] = S[j]; S[j] = t;
    }
    let a = 0; let b = 0;
    return Uint8Array.from(bytes.map((x) => {
      a = (a + 1) % 256; b = (b + S[a]) % 256;
      const t = S[a]; S[a] = S[b]; S[b] = t;
      return x ^ S[(S[a] + S[b]) % 256];
    }));
  }
  const a1z26 = (s) => s.toUpperCase().replace(/[A-Z]/g, (c) => c.charCodeAt(0) - 64 + " ").trim();
  const a1z26d = (s) => s.split(/\s+/).filter(Boolean).map((x) => String.fromCharCode(+x + 64)).join("");
  const b64e = (s) => btoa(unescape(encodeURIComponent(s)));
  const b64d = (s) => { try { return decodeURIComponent(escape(atob(s))); } catch { return atob(s); } };
  function run(crypt) {
    const algo = algoEl.value, key = keyEl.value || "KEY", text = inEl.value;
    try {
      let res = "";
      if (algo === "caesar") res = caesar(text, crypt * ((+key || 0) % 26));
      else if (algo === "vigenere") res = vigenere(text, key, crypt === -1);
      else if (algo === "xor") res = xorBytes(utf8Bytes(text), key);
      else if (algo === "rc4") res = new TextDecoder().decode(rc4Crypt(utf8Bytes(text), key));
      else if (algo === "a1z26") res = crypt === 1 ? a1z26(text) : a1z26d(text);
      else res = crypt === 1 ? b64e(text) : b64d(text);
      const h = utf8Bytes(res);
      outEl.textContent = res + (h.length < 120 ? "\nHex: " + labHex(h) : "\nHex: " + labHex(h.slice(0, 60)) + " …");
    } catch (err) { outEl.textContent = "خطأ (راجع المفتاح/الصيغة): " + err.message; }
  }
  encBtn.addEventListener("click", () => run(1));
  decBtn.addEventListener("click", () => run(-1));
})();
/* ============================================================
   MODULE 37 · ProgressHub — متابعة التعلم (استكمال + نتائج)
   Reads the quiz engine store (same closure) and renders the
   #progress view: a "تابع من حيث توقفت" resume card when a quiz
   session is saved, best-score cards from saved results, and an
   honest empty state when nothing is saved yet. Additive layer.
   ============================================================ */
(function initProgressHub() {
  const mount = $id("progressApp");
  if (!mount) return;
  const escP = (v) => escHtml(String(v));

  /** @returns {string} Saved display name for a quiz subject. */
  function subjectName(key) {
    return (QUIZZES[key] && QUIZZES[key].name) || key;
  }

  /** Resume card for a mid-quiz session. @returns {string} */
  function resumeCard(key, p) {
    const qs = QUIZZES[key] && QUIZZES[key].questions ? QUIZZES[key].questions.length : 0;
    const total = Math.max(p.total || qs, 0);
    const at = Math.min((p.idx || 0) + 1, total);
    const pct = total ? Math.round(((p.idx || 0) / total) * 100) : 0;
    return (
      '<article class="progress-card progress-resume">' +
      '<div class="progress-card-head"><span class="progress-ico" aria-hidden="true">▶️</span><h3>' + escP(Lang.t("progress.resumeTitle")) + '</h3></div>' +
      '<p class="progress-subject">' + escP(subjectName(key)) + '</p>' +
      '<p class="progress-meta">' + escP(Lang.t("progress.atQuestion", { i: at, total: total })) + '</p>' +
      '<div class="progress-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      '<div class="progress-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-progress-resume="' + escP(key) + '">' + escP(Lang.t("progress.resumeBtn")) + '</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-progress-restart="' + escP(key) + '">' + escP(Lang.t("progress.restartBtn")) + '</button>' +
      '</div></article>'
    );
  }

  /** Best-score cards built from saved results. @returns {string} */
  function resultsHtml(results) {
    const keys = Object.keys(results).filter((k) => QUIZZES[k]);
    if (!keys.length) return "";
    const rows = keys.map((k) => {
      const r = results[k] || {};
      const qs = QUIZZES[k] && QUIZZES[k].questions ? QUIZZES[k].questions.length : 0;
      const total = Math.max(r.total || qs, 1);
      const pct = typeof r.pct === "number" ? r.pct : Math.round(((r.score || 0) / total) * 100);
      const cls = pct >= 80 ? "is-high" : pct >= 60 ? "is-mid" : "is-low";
      return (
        '<article class="progress-card progress-result">' +
        '<div class="progress-result-head"><h3>' + escP(subjectName(k)) + '</h3><span class="progress-pct ' + cls + '">' + escP(pct) + '%</span></div>' +
        '<p class="progress-meta">' + escP(Lang.t("progress.best", { score: r.score || 0, total: total })) + '</p>' +
        '<div class="progress-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-progress-restart="' + escP(k) + '">' + escP(Lang.t("progress.retakeBtn")) + '</button>' +
        '</div></article>'
      );
    }).join("");
    return (
      '<div class="progress-results">' +
      '<h3 class="progress-subhead">' + escP(Lang.t("progress.bestTitle")) + '</h3>' +
      '<div class="progress-results-grid">' + rows + '</div></div>'
    );
  }

  /** Honest empty state when the student hasn't saved anything yet. */
  function emptyHtml() {
    return (
      '<div class="progress-empty">' +
      '<span class="progress-empty-ico" aria-hidden="true">🎯</span>' +
      '<h3>' + escP(Lang.t("progress.emptyTitle")) + '</h3>' +
      '<p>' + escP(Lang.t("progress.emptySub")) + '</p>' +
      '<div class="progress-actions"><a href="#quiz" class="btn btn-primary">' + escP(Lang.t("progress.emptyCta")) + '</a></div>' +
      '</div>'
    );
  }

  /** Safely read a namespaced Store object. @param {string} key @returns {Object} */
  function readStored(key) {
    try {
      const v = Store.get(key, null);
      return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
    } catch { return {}; }
  }

  /** Aggregate statistics strip (lessons / attempts / labs / flashcards / paths). @returns {string} */
  function statsHtml() {
    const countMap = (m) => Object.keys(m).length;
    const lessons = readStored("lessons");
    const flash = readStored("flash");
    const labs = readStored("labs");
    const store = readStore();
    const results = store.results || {};
    const quizAttempts = Object.keys(results).filter((k) => QUIZZES[k]).length;
    const lessonsDone = lessons.done && typeof lessons.done === "object" ? countMap(lessons.done) : 0;
    const flashDone = flash.reviewed && typeof flash.reviewed === "object" ? countMap(flash.reviewed) : 0;
    const labsDone = labs.done && typeof labs.done === "object" ? countMap(labs.done) : 0;

    /* Overall = average of the latest quiz results across subjects. */
    const pctVals = Object.keys(results).filter((k) => QUIZZES[k]).map((k) => {
      const r = results[k] || {};
      const qs = QUIZZES[k] && QUIZZES[k].questions ? QUIZZES[k].questions.length : 0;
      return typeof r.pct === "number" ? r.pct : (qs ? Math.round(((r.score || 0) / qs) * 100) : 0);
    });
    const overall = pctVals.length ? Math.round(pctVals.reduce((a, b) => a + b, 0) / pctVals.length) : 0;

    /* Path progress — manual checkmarks only. Tolerant: MODULE 39 may not be
       initialized when this first renders, so guard the lookup. */
    const getLP = window.getLearningPaths;
    const paths = (typeof getLP === "function") ? (getLP() || []) : [];
    let pathPct = null;
    if (paths.length) {
      const st = readStored("paths");
      const done = (st.done && typeof st.done === "object") ? st.done : {};
      let total = 0, d = 0;
      paths.forEach((p) => {
        if (!Array.isArray(p.topics) || !p.topics.length) return;
        const row = done[p.id];
        p.topics.forEach((t) => { if (t && t.id) { total++; if (row && row[t.id]) d++; } });
      });
      pathPct = total ? Math.round((d / total) * 100) : null;
    }

    const cells = [
      '<span class="progress-stat"><b>' + quizAttempts + '</b><span>' + escP(Lang.t("progress.attempts")) + '</span></span>',
      '<span class="progress-stat"><b>' + lessonsDone + '</b><span>' + escP(Lang.t("progress.lessons")) + '</span></span>',
      '<span class="progress-stat"><b>' + labsDone + '</b><span>' + escP(Lang.t("progress.labs")) + '</span></span>',
      '<span class="progress-stat"><b>' + flashDone + '</b><span>' + escP(Lang.t("progress.flashcards")) + '</span></span>',
      (pathPct !== null
        ? '<span class="progress-stat"><b>' + pathPct + '%</b><span>' + escP(Lang.t("progress.paths")) + '</span></span>'
        : ''),
      '<span class="progress-stat is-overall"><b>' + overall + '%</b><span>' + escP(Lang.t("progress.overall")) + '</span></span>'
    ].filter(Boolean).join("");

    return '<div class="progress-stats" role="list" aria-label="' + escP(Lang.t("progress.overall")) + '">' + cells + '</div>';
  }

  /** "Review incorrect answers" — subjects with saved missed questions. @returns {string} */
  function reviewWrongHtml() {
    const store = readStore();
    const results = store.results || {};
    const keys = Object.keys(results).filter((k) => QUIZZES[k]);
    const rows = [];
    keys.forEach((k) => {
      const n = MissedBank.countForSubject(k);
      if (n > 0) {
        rows.push(
          '<div class="progress-review-row">' +
          '<span class="progress-review-subject">' + escP(subjectName(k)) + ' (<b>' + n + '</b>)</span>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-progress-retry-wrong="' + escP(k) + '">' + escP(Lang.t("progress.reviewWrong")) + '</button>' +
          '</div>'
        );
      }
    });
    if (!rows.length) return "";
    return (
      '<div class="progress-review">' +
      '<h3 class="progress-subhead">' + escP(Lang.t("progress.reviewWrong")) + '</h3>' +
      '<div class="progress-review-rows">' + rows.join("") + '</div></div>'
    );
  }

  /** Paint the whole panel from the current stores. @returns {void} */
  function render() {
    if (!mount) return;
    const store = readStore();
    const results = store.results || {};
    const progress = store.progress || {};

    const lessons = readStored("lessons");
    const flash = readStored("flash");
    const labs = readStored("labs");
    const paths = readStored("paths");
    const anyPathDone = Object.keys((paths.done && typeof paths.done === "object") ? paths.done : {}).length > 0;
    const anyActivity =
      Object.keys(results).length > 0 || Object.keys(progress).length > 0 ||
      (lessons.done && Object.keys(lessons.done).length > 0) ||
      (flash.reviewed && Object.keys(flash.reviewed).length > 0) ||
      (labs.done && Object.keys(labs.done).length > 0) || anyPathDone;

    const resumeKeys = Object.keys(progress).filter((k) => {
      const p = progress[k];
      return QUIZZES[k] && p && typeof p.idx === "number" && p.idx > 0 &&
        p.idx < (QUIZZES[k].questions || []).length;
    });

    let html = statsHtml() + reviewWrongHtml();
    if (resumeKeys.length) html += resumeCard(resumeKeys[0], progress[resumeKeys[0]]);
    html += resultsHtml(results);
    if (!anyActivity) html += emptyHtml();
    mount.innerHTML = html;
  }

  /* Delegate clicks: resume/restart/retry-wrong switch to the quiz view first. */
  mount.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const resume = t.closest("[data-progress-resume]");
    if (resume) {
      const key = resume.dataset.progressResume;
      if (window.NovaViews && window.NovaViews.activate) window.NovaViews.activate("quiz");
      startQuiz(key, true);
      return;
    }
    const retryWrong = t.closest("[data-progress-retry-wrong]");
    if (retryWrong) {
      const key = retryWrong.dataset.progressRetryWrong;
      const missed = MissedBank.forSubject(key);
      if (window.NovaViews && window.NovaViews.activate) window.NovaViews.activate("quiz");
      clearProgress(key);
      startQuiz(key, false, missed.length ? missed : null);
      return;
    }
    const restart = t.closest("[data-progress-restart]");
    if (restart) {
      const key = restart.dataset.progressRestart;
      clearProgress(key);
      if (window.NovaViews && window.NovaViews.activate) window.NovaViews.activate("quiz");
      startQuiz(key, false);
    }
  });

  /* Re-render whenever the progress view is (re)opened, on any store write,
     and on locale switches. */
  document.addEventListener("nova:view-changed", (e) => {
    if (e.detail && e.detail.viewId === "progress") render();
  });
  document.addEventListener("nova:progress-changed", render);
  Lang.onSwitch(render);

  render();
})();

/* ============================================================
   MODULE 37b · HeroContinue — homepage "تابع من حيث توقفت" card
   Shows a returning-student shortcut in the hero only when the
   quiz store holds a resumable session or saved results. Links
   straight into the quiz view (resume) or the progress view.
   Additive layer; no-ops when #heroContinue is absent.
   ============================================================ */
(function initHeroContinue() {
  const box = $id("heroContinue");
  const metaEl = $id("heroContinueMeta");
  const btn = $id("heroContinueBtn");
  if (!box || !metaEl || !btn) return;

  /** Resumable subject key, else "" — mirrors ProgressHub logic. @returns {string} */
  function resumeKey(progress) {
    const keys = Object.keys(progress || {}).filter((k) => {
      const p = progress[k];
      return QUIZZES[k] && p && typeof p.idx === "number" && p.idx > 0 &&
        p.idx < (QUIZZES[k].questions || []).length;
    });
    return keys[0] || "";
  }

  /** Paint the card from the current quiz store. @returns {void} */
  function render() {
    const store = readStore();
    const progress = store.progress || {};
    const results = store.results || {};
    const key = resumeKey(progress);

    if (key) {
      const p = progress[key];
      const total = Math.max(p.total || (QUIZZES[key].questions || []).length, 0);
      const at = Math.min((p.idx || 0) + 1, total);
      const subject = (QUIZZES[key] && QUIZZES[key].name) || key;
      metaEl.textContent = subject + " · " + Lang.t("hero.continueAt", { i: at, total });
      btn.textContent = Lang.t("hero.continueBtn");
      box.dataset.action = "resume";
      box.dataset.subject = key;
      box.hidden = false;
      return;
    }

    if (Object.keys(results).some((k) => QUIZZES[k])) {
      metaEl.textContent = Lang.t("hero.continueResults");
      btn.textContent = Lang.t("hero.continueReviewBtn");
      box.dataset.action = "progress";
      box.dataset.subject = "";
      box.hidden = false;
      return;
    }

    /* First visit or nothing saved yet — hide, let the hero CTAs guide. */
    box.hidden = true;
    box.dataset.action = "";
  }

  btn.addEventListener("click", () => {
    const action = box.dataset.action;
    if (action === "resume") {
      if (window.NovaViews && window.NovaViews.activate) window.NovaViews.activate("quiz");
      startQuiz(box.dataset.subject, true);
    } else if (action === "progress") {
      if (window.NovaViews && window.NovaViews.activate) window.NovaViews.activate("progress");
    }
  });

  /* Refresh on every store write and whenever any view is (re)opened. */
  document.addEventListener("nova:progress-changed", render);
  document.addEventListener("nova:view-changed", render);
  Lang.onSwitch(render);

  render();
})();

/* ============================================================
   MODULE 39 · LearningPaths — مسارات التعلم المنظمة (Phase 2)
   Organizes the platform into structured information-security
   learning paths. Every path carries: AR/EN title, short
   description, difficulty level, ordered topics, a progress
   indicator, related quizzes/tools/labs (derived from the topic
   links — content is never duplicated), a recommended next
   topic, and an honest coming-soon state for unimplemented
   paths (no fake content).
   - Data is embedded (same approach as the flashcards) so the
     app stays dependency-free and works offline / on file://.
     To add a path: append one object to LEARNING_PATHS — no
     rendering changes needed.
   - Topic progress: manual checkmarks persisted via Store
     ("motmi-portal:paths"), plus auto-done for topics linked to
     a quiz subject that already has a saved result.
   - Deep links: "#path/<id>" — ViewSwitcher resolves the shared
     #path view; this module reads the id from the hash.
   ============================================================ */
(function initLearningPaths() {
  const grid = $id("pathsGrid");
  const detailBody = $id("pathDetailBody");
  if (!grid || !detailBody) return;

  const escL = (v) => escHtml(String(v));
  const STORE_KEY = "paths";

  /* ---------- Path data (extend here) ----------
     Shape: { id, ico, level: beginner|intermediate|advanced,
              status: "live"|"soon", recommended?: true,
              title: {ar,en}, desc: {ar,en},
              topics: [{ id, t: {ar,en}, res?: {
                k: "quiz" (key=subject) | "tool" (id=tool card id)
                   | "lab" (view=section id) | "flash" } }],
              related?: [res…] (soon paths: honest "meanwhile" links) } */
  const LEARNING_PATHS = [
    {
      id: "fundamentals",
      ico: "🛡️",
      level: "beginner",
      status: "live",
      recommended: true,
      title: { ar: "أساسيات أمن المعلومات", en: "Information Security Fundamentals" },
      desc: {
        ar: "نقطة البداية المثالية: مثلث الأمان CIA، المصطلحات الأساسية، وكلمات مرور وحسابات مؤمّنة — ثم اختبر نفسك.",
        en: "The ideal starting point: the CIA triad, core terminology, secured passwords and accounts — then test yourself."
      },
      topics: [
        { id: "f-cia", t: { ar: "مثلث الأمان: السرية والتكامل والتوافر (CIA)", en: "The security triad: Confidentiality, Integrity, Availability" }, res: { k: "flash" } },
        { id: "f-terms", t: { ar: "المصطلحات الأمنية الأساسية", en: "Core security terminology" }, res: { k: "flash" } },
        { id: "f-pass", t: { ar: "كلمات المرور القوية والإنتروبيا", en: "Strong passwords and entropy" }, res: { k: "tool", id: "tool-password", ar: "محلل كلمة المرور", en: "Password analyzer" } },
        { id: "f-accounts", t: { ar: "حسابات المستخدمين والصلاحيات", en: "User accounts and privileges" }, res: { k: "quiz", key: "260210030802" } },
        { id: "f-secure", t: { ar: "مبادئ التصميم الآمن", en: "Secure design principles" }, res: { k: "quiz", key: "260210031102" } }
      ]
    },
    {
      id: "networking",
      ico: "🌐",
      level: "beginner",
      status: "live",
      title: { ar: "الشبكات الحاسوبية", en: "Computer Networks" },
      desc: {
        ar: "من طبقات OSI إلى جدران الحماية والشبكات الفرعية — افهم كيف تتنقّل البيانات وكيف تُؤمَّن، نظريًا وفي المختبر.",
        en: "From OSI layers to firewalls and subnets — understand how data travels and how it is secured, in theory and in the lab."
      },
      topics: [
        { id: "n-osi", t: { ar: "أساسيات الشبكات وطبقات OSI", en: "Network basics and OSI layers" }, res: { k: "flash" } },
        { id: "n-tls", t: { ar: "تأمين الاتصال: HTTPS وTLS", en: "Securing connections: HTTPS and TLS" }, res: { k: "flash" } },
        { id: "n-fw", t: { ar: "جدران الحماية وقواعد السماح والمنع", en: "Firewalls and allow/deny rules" }, res: { k: "tool", id: "tool-fw", ar: "محاكي الجدار الناري", en: "Firewall simulator" } },
        { id: "n-cidr", t: { ar: "تقسيم الشبكات (Subnetting) وCIDR", en: "Subnetting and CIDR" }, res: { k: "tool", id: "tool-cidr", ar: "حاسبة CIDR", en: "CIDR calculator" } },
        { id: "n-sniff", t: { ar: "فك إطارات الشبكة والتنصت", en: "Decoding network frames and sniffing" }, res: { k: "tool", id: "tool-sniffer", ar: "مستنشق الحزم", en: "Packet sniffer" } },
        { id: "n-netlab", t: { ar: "بناء حزمة TCP/UDP عبر راوترات", en: "Building a TCP/UDP packet across router hops" }, res: { k: "lab", view: "redteam" } }
      ]
    },
    {
      id: "operating-systems",
      ico: "💻",
      level: "beginner",
      status: "live",
      title: { ar: "أنظمة التشغيل ولينكس", en: "Operating Systems and Linux" },
      desc: {
        ar: "تأمين النظام وإدارة الصلاحيات، ثم طبّق ذلك بيدك على طرفية لينكس داخل المختبر الهجومي.",
        en: "Harden the system and manage privileges, then practice on a Linux terminal inside the offensive lab."
      },
      topics: [
        { id: "o-harden", t: { ar: "تأمين نظام التشغيل والتحديثات", en: "OS hardening and updates" }, res: { k: "quiz", key: "260210030802" } },
        { id: "o-uac", t: { ar: "الحسابات والتحكم بالصلاحيات (UAC)", en: "Accounts and privilege control (UAC)" }, res: { k: "quiz", key: "260210030802" } },
        { id: "o-bash", t: { ar: "أساسيات طرفية لينكس وأوامر Bash", en: "Linux terminal basics and Bash commands" }, res: { k: "lab", view: "redteam" } },
        { id: "o-malware", t: { ar: "البرمجيات الخبيثة وكيف تتخفّى", en: "Malware and how it hides" }, res: { k: "flash" } }
      ]
    },
    {
      id: "cryptography",
      ico: "🔐",
      level: "intermediate",
      status: "live",
      title: { ar: "التشفير", en: "Cryptography" },
      desc: {
        ar: "من الشفرات الكلاسيكية إلى RSA وSHA-256 — شاهد الخوارزميات تعمل خطوة بخطوة في مختبر التشفير والأدوات.",
        en: "From classical ciphers to RSA and SHA-256 — watch the algorithms work step by step in the crypto lab and tools."
      },
      topics: [
        { id: "c-sym", t: { ar: "التشفير المتماثل وغير المتماثل", en: "Symmetric vs. asymmetric encryption" }, res: { k: "flash" } },
        { id: "c-hash", t: { ar: "دوال التجزئة وبصمة SHA-256", en: "Hash functions and the SHA-256 fingerprint" }, res: { k: "tool", id: "tool-hash", ar: "مولّد SHA-256", en: "SHA-256 generator" } },
        { id: "c-caesar", t: { ar: "الشفرات الكلاسيكية: Caesar", en: "Classical ciphers: Caesar" }, res: { k: "tool", id: "tool-caesar", ar: "تشفير Caesar", en: "Caesar cipher" } },
        { id: "c-classic", t: { ar: "Vigenère وإنجما وتحليل التردد", en: "Vigenère, Enigma and frequency analysis" }, res: { k: "lab", view: "cryptolab" } },
        { id: "c-rsa", t: { ar: "RSA خطوة بخطوة والتوقيع الرقمي", en: "RSA step by step and digital signatures" }, res: { k: "lab", view: "cryptolab" } },
        { id: "c-cert", t: { ar: "الشهادات الرقمية وSSL/TLS", en: "Digital certificates and SSL/TLS" }, res: { k: "quiz", key: "260210031102" } },
        { id: "c-enc", t: { ar: "Base64 وHex وتفك الترميز", en: "Base64, Hex and decoding" }, res: { k: "tool", id: "tool-encoders", ar: "المشفّرات", en: "Encoders" } }
      ]
    },
    {
      id: "websec",
      ico: "🌍",
      level: "intermediate",
      status: "live",
      title: { ar: "أمن الويب والتطبيقات", en: "Web and Application Security" },
      desc: {
        ar: "حقن SQL ورموز JWT وفحص الثغرات — تعلّم كيف تُهاجم التطبيقات وكيف تُحصَّن، مع تدريب مباشر في المختبر.",
        en: "SQL injection, JWT tokens and vulnerability scanning — learn how applications are attacked and hardened, with hands-on lab training."
      },
      topics: [
        { id: "w-secure", t: { ar: "البرمجة الآمنة والتحقق من المدخلات", en: "Secure coding and input validation" }, res: { k: "flash" } },
        { id: "w-sqli", t: { ar: "حقن SQL وقواعد البيانات", en: "SQL injection and databases" }, res: { k: "flash" } },
        { id: "w-lab", t: { ar: "حقن SQL عمليًا على قاعدة قابلة للحقن", en: "SQL injection hands-on on an injectable DB" }, res: { k: "lab", view: "redteam" } },
        { id: "w-jwt", t: { ar: "رموز JWT وإدارة الجلسات", en: "JWT tokens and session management" }, res: { k: "tool", id: "tool-jwt", ar: "محلّل JWT", en: "JWT debugger" } },
        { id: "w-vuln", t: { ar: "فحص الثغرات وترتيب الخطورة", en: "Vulnerability scanning and severity triage" }, res: { k: "tool", id: "tool-vuln", ar: "ماسح الثغرات", en: "Vulnerability scanner" } }
      ]
    },
    {
      id: "pentest",
      ico: "🕵️",
      level: "advanced",
      status: "live",
      title: { ar: "الاختبار الأخلاقي والمحاكاة الهجومية", en: "Ethical Hacking and Offensive Simulation" },
      desc: {
        ar: "من جمع المعلومات إلى فحص المنافذ والثغرات داخل سيناريوهات CTF — كل ذلك بإذن قانوني وبأخلاقيات مهنية.",
        en: "From reconnaissance to port and vulnerability scanning inside CTF scenarios — all with legal permission and professional ethics."
      },
      topics: [
        { id: "p-ethics", t: { ar: "الأخلاقيات والإذن القانوني", en: "Ethics and legal authorization" }, res: { k: "quiz", key: "260210030902" } },
        { id: "p-recon", t: { ar: "جمع المعلومات (Reconnaissance)", en: "Reconnaissance" }, res: { k: "flash" } },
        { id: "p-ports", t: { ar: "فحص المنافذ", en: "Port scanning" }, res: { k: "tool", id: "tool-portscan", ar: "ماسح المنافذ", en: "Port scanner" } },
        { id: "p-vuln", t: { ar: "فحص الثغرات الآلي", en: "Automated vulnerability scanning" }, res: { k: "tool", id: "tool-vuln", ar: "ماسح الثغرات", en: "Vulnerability scanner" } },
        { id: "p-redteam", t: { ar: "المختبر الهجومي: scan وblock-ip", en: "Offensive lab: scan and block-ip" }, res: { k: "lab", view: "redteam" } },
        { id: "p-ctf", t: { ar: "تطبيق المهارات في تحديات CTF", en: "Apply the skills in CTF challenges" }, res: { k: "lab", view: "games" } }
      ]
    },
    {
      id: "forensics",
      ico: "🔍",
      level: "intermediate",
      status: "soon",
      title: { ar: "التحليل الجنائي الرقمي", en: "Digital Forensics" },
      desc: {
        ar: "جمع الأدلة الرقمية، تحليل السجلات، واسترجاع البيانات — مسار جديد قيد الإعداد على المنصة.",
        en: "Digital evidence collection, log analysis and data recovery — a new path currently in preparation."
      },
      topics: [],
      related: [{ k: "lab", view: "ir" }]
    },
    {
      id: "riskgov",
      ico: "📋",
      level: "advanced",
      status: "soon",
      title: { ar: "إدارة المخاطر والحوكمة", en: "Risk Management and Governance" },
      desc: {
        ar: "تقييم المخاطر، السياسات الأمنية، والامتثال (ISO 27001 وNIST) — سيُنشر محتواه لاحقًا.",
        en: "Risk assessment, security policies and compliance (ISO 27001, NIST) — content will be published later."
      },
      topics: []
    },
    {
      id: "incident",
      ico: "🚨",
      level: "intermediate",
      status: "live",
      title: { ar: "الاستجابة للحوادث", en: "Incident Response" },
      desc: {
        ar: "من تنبيه SIEM إلى احتواء الحادث: خط زمني لسلسلة الهجوم، محاكاة حية، وتحديد السبب الجذري — كل ذلك في مركز الاستجابة.",
        en: "From a SIEM alert to containment: kill-chain timeline, live simulation and root-cause analysis — all in the IR center."
      },
      topics: [
        { id: "i-siem", t: { ar: "لوحة SIEM وقراءة الأحداث", en: "The SIEM dashboard and reading events" }, res: { k: "lab", view: "ir" } },
        { id: "i-kill", t: { ar: "بناء الخط الزمني لسلسلة الهجوم (Kill Chain)", en: "Building the kill-chain timeline" }, res: { k: "lab", view: "ir" } },
        { id: "i-live", t: { ar: "محاكاة حادث حية مع فريق الاستجابة", en: "Live incident simulation with a response team" }, res: { k: "lab", view: "ir" } },
        { id: "i-rca", t: { ar: "تحديات تحديد السبب الجذري (RCA)", en: "Root-cause analysis (RCA) challenges" }, res: { k: "lab", view: "ir" } },
        { id: "i-console", t: { ar: "طرفية الاستجابة: تحليل وتخفيف الهجمات", en: "Response console: analyze and mitigate attacks" }, res: { k: "lab", view: "games" } }
      ]
    },
    {
      id: "ctf",
      ico: "🚩",
      level: "intermediate",
      status: "live",
      title: { ar: "تحديات CTF والمعامل العملية", en: "CTF and Practical Labs" },
      desc: {
        ar: "طبّق كل ما تعلمته: طرفية هجومية، سيناريوهات SQLi وفحص المنافذ وDDoS، واستخراج العلم — تعلّم بالممارسة.",
        en: "Apply everything you learned: an offensive console, SQLi / port-scan / DDoS scenarios and flag extraction — learn by doing."
      },
      topics: [
        { id: "ctf-start", t: { ar: "الانطلاق: طرفية CTF والأمر help", en: "Getting started: the CTF console and help" }, res: { k: "lab", view: "games" } },
        { id: "ctf-sqli", t: { ar: "سيناريو حقن SQL", en: "SQL injection scenario" }, res: { k: "lab", view: "games" } },
        { id: "ctf-scan", t: { ar: "سيناريو فحص المنافذ", en: "Port scan scenario" }, res: { k: "lab", view: "games" } },
        { id: "ctf-ddos", t: { ar: "سيناريو DDoS والتخفيف", en: "DDoS scenario and mitigation" }, res: { k: "lab", view: "games" } },
        { id: "ctf-flag", t: { ar: "فك الشفرة واستخراج العلم", en: "Crack the cipher and extract the flag" }, res: { k: "lab", view: "games" } },
        { id: "ctf-red", t: { ar: "تدريب إضافي: المختبر الهجومي", en: "Extra practice: the offensive lab" }, res: { k: "lab", view: "redteam" } }
      ]
    }
  ];

  /* ---------- Helpers ---------- */

  /** Path lookup by id. @param {string} id @returns {Object|null} */
  const lpById = (id) => LEARNING_PATHS.find((p) => p.id === id) || null;

  /** Pick the current-locale side of a bilingual object. @param {Object=} o @returns {string} */
  const lpTT = (o) => (o ? (Lang.current === "en" ? (o.en || o.ar) : (o.ar || o.en)) : "");

  /** Current manual topic-done map: { pathId: { topicId: true } }. @returns {Object} */
  function lpDoneMap() {
    const v = Store.get(STORE_KEY, null);
    return (v && typeof v === "object" && v.done && typeof v.done === "object") ? v.done : {};
  }

  /** Persist the manual topic-done map. @param {Object} done @returns {void} */
  function lpSaveDone(done) { try { Store.set(STORE_KEY, { v: 1, done: done }); } catch {} }

  /** Does the quiz engine hold a saved result for this subject? @param {string} key @returns {boolean} */
  function lpHasQuizResult(key) {
    try { const r = readStore().results || {}; return Boolean(r[key]); } catch { return false; }
  }

  /**
   * A topic is done when manually checked OR automatically completed
   * through a saved quiz result for its linked subject.
   * @param {Object} path Parent path.
   * @param {Object} topic Topic row.
   * @param {Object} doneMap Manual completion map.
   * @returns {boolean}
   */
  function lpTopicDone(path, topic, doneMap) {
    if (topic.res && topic.res.k === "quiz" && lpHasQuizResult(topic.res.key)) return true;
    const m = doneMap[path.id] || {};
    return m[topic.id] === true;
  }

  /** Progress snapshot for a path: done/total/pct + first undone topic ("up next"). */
  function lpProgress(path) {
    const doneMap = lpDoneMap();
    let done = 0, next = null;
    path.topics.forEach((t) => {
      if (lpTopicDone(path, t, doneMap)) done++;
      else if (!next) next = t;
    });
    const total = path.topics.length;
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0, next: next };
  }

  /** Unique quiz subject keys referenced by a path's topics. @returns {string[]} */
  const lpQuizKeys = (p) => [...new Set(p.topics.filter((t) => t.res && t.res.k === "quiz").map((t) => t.res.key))];

  /** Unique lab view ids referenced by a path's topics (or related list). @returns {string[]} */
  function lpLabs(p) {
    const src = p.topics.length ? p.topics : (p.related || []);
    return [...new Set(src.filter((t) => t && (t.res || t).k === "lab").map((t) => (t.res || t).view))];
  }

  /* Lab view id → existing i18n label key (the cryptolab section uses
     the pre-existing "labs.crypto" key — no duplicated dict entries). */
  const LP_LAB_KEYS = { redteam: "labs.redteam", ir: "labs.ir", cryptolab: "labs.crypto", games: "labs.games" };
  const lpLabKey = (view) => LP_LAB_KEYS[view] || ("labs." + view);

  /* ---------- Chip builders (resource links out of topics) ---------- */

  /**
   * Chip for a topic resource / related entry: quiz (starts the subject
   * quiz via the existing data-quiz-jump flow), tool (jumps to the tool
   * card), lab (view link) or flashcards.
   * @param {Object} r Resource descriptor.
   * @returns {string} HTML anchor or "" when unknown.
   */
  function lpChip(r) {
    if (!r) return "";
    if (r.k === "quiz") {
      const name = (QUIZZES[r.key] && QUIZZES[r.key].name) || r.key;
      const n = (QUIZZES[r.key] && QUIZZES[r.key].questions) ? QUIZZES[r.key].questions.length : 0;
      return '<a class="path-chip is-quiz" href="#quiz" data-quiz-jump="' + escL(r.key) + '">' +
        escL(name) + (n ? ' <b class="path-chip-n">' + n + "</b>" : "") + "</a>";
    }
    if (r.k === "tool") {
      return '<a class="path-chip is-tool" href="#tools" data-tool-jump="' + escL(r.id) + '">' + escL(lpTT(r)) + "</a>";
    }
    if (r.k === "lab") {
      return '<a class="path-chip is-lab" href="#' + escL(r.view) + '">' + escL(Lang.t(lpLabKey(r.view))) + "</a>";
    }
    if (r.k === "flash") {
      return '<a class="path-chip is-flash" href="#flash">' + escL(Lang.t("nav.flashcards")) + "</a>";
    }
    return "";
  }

  /** Chip for a topic's authored lesson (#lesson/<subject>/<lessonKey>). */
  function lpLessonChip(lsn) {
    if (!lsn || !lsn.sub || !lsn.key) return "";
    return '<a class="path-chip is-lesson" href="#lesson/' + escL(lsn.sub) + '/' + escL(lsn.key) + '">' + escL(Lang.t("paths.lesson")) + "</a>";
  }

  /* ---------- Paths grid ---------- */

  /** Card for one path in the #pathsGrid grid. @param {Object} p @returns {string} */
  function lpCardHtml(p) {
    const isSoon = p.status === "soon";
    const prog = isSoon ? null : lpProgress(p);
    const badges = [];
    if (p.recommended) badges.push('<span class="path-badge is-rec">★ ' + escL(Lang.t("paths.badge.recommended")) + "</span>");
    if (isSoon) badges.push('<span class="path-badge is-soon">' + escL(Lang.t("paths.badge.soon")) + "</span>");

    const meta = [];
    if (!isSoon) {
      meta.push(escL(Lang.t("paths.stat.topics", { n: p.topics.length })));
      const qn = lpQuizKeys(p).length;
      if (qn) meta.push(escL(Lang.t("paths.stat.quizzes", { n: qn })));
    }

    const progressHtml = prog
      ? '<div class="path-card-progress">' +
        '<div class="progress-bar" role="img" aria-label="' + escL(Lang.t("paths.progressLabel")) + " " + prog.pct + '%"><i style="width:' + prog.pct + '%"></i></div>' +
        '<span class="path-card-progress-n">' + escL(Lang.t("paths.progressOf", { done: prog.done, total: prog.total })) + "</span>" +
        "</div>"
      : "";

    const nextHtml = (prog && prog.done > 0 && prog.done < prog.total && prog.next)
      ? '<p class="path-card-next">' + escL(Lang.t("paths.nextCard", { topic: lpTT(prog.next.t) })) + "</p>"
      : "";

    return (
      '<a class="path-card' + (isSoon ? " is-soon" : "") + (p.recommended ? " is-recommended" : "") +
        '" href="#path/' + escL(p.id) + '" data-path-id="' + escL(p.id) + '">' +
        '<div class="path-card-top">' +
          '<span class="path-ico" aria-hidden="true">' + p.ico + "</span>" +
          '<span class="path-level is-' + escL(p.level) + '">' + escL(Lang.t("paths.level." + p.level)) + "</span>" +
        "</div>" +
        '<h3 class="path-card-title">' + escL(lpTT(p.title)) + "</h3>" +
        '<p class="path-card-desc">' + escL(lpTT(p.desc)) + "</p>" +
        (badges.length ? '<div class="path-badges">' + badges.join("") + "</div>" : "") +
        (meta.length ? '<p class="path-card-meta">' + meta.join('<span class="path-meta-dot" aria-hidden="true">·</span>') + "</p>" : "") +
        progressHtml + nextHtml +
        '<span class="path-card-cta">' + escL(Lang.t("paths.open")) + "</span>" +
      "</a>"
    );
  }

  /** Paint the whole #pathsGrid grid. @returns {void} */
  function lpRenderGrid() {
    grid.innerHTML = LEARNING_PATHS.map(lpCardHtml).join("");
  }

  /* ---------- Path detail view ---------- */

  /** Parse the current deep-link: "#path/<id>" → id, else "". @returns {string} */
  function lpHashId() {
    const m = /^#path\/([\w-]+)/.exec(location.hash || "");
    return m ? m[1] : "";
  }

  /**
   * Paint the shared #path detail view for the deep-linked path id.
   * Handles: live path (progress + ordered topics + related resources),
   * coming-soon placeholder, unknown id, and bare "#path" (no id).
   * @returns {void}
   */
  function lpRenderDetail() {
    const id = lpHashId();
    const p = id ? lpById(id) : null;

    /* Bare hash or unknown id → honest state, straight back to the list */
    if (!p) {
      const isUnknown = Boolean(id);
      detailBody.innerHTML =
        '<div class="path-detail-empty">' +
        '<span class="path-detail-ico" aria-hidden="true">🧭</span>' +
        '<h2 class="path-detail-title" id="pathDetailTitle">' +
          escL(isUnknown ? Lang.t("paths.unknownTitle") : Lang.t("paths.emptyPick")) + "</h2>" +
        (isUnknown ? '<p class="path-detail-desc">' + escL(Lang.t("paths.unknownBody")) + "</p>" : "") +
        '<a class="btn btn-primary" href="#paths">' + escL(Lang.t("paths.viewAll")) + "</a>" +
        "</div>";
      return;
    }

    const isSoon = p.status === "soon";
    const badges =
      '<span class="path-level is-' + escL(p.level) + '">' + escL(Lang.t("paths.level." + p.level)) + "</span>" +
      (p.recommended ? '<span class="path-badge is-rec">★ ' + escL(Lang.t("paths.badge.recommended")) + "</span>" : "") +
      (isSoon ? '<span class="path-badge is-soon">' + escL(Lang.t("paths.badge.soon")) + "</span>" : "");

    let html =
      '<div class="path-detail-head">' +
        '<span class="path-detail-ico" aria-hidden="true">' + p.ico + "</span>" +
        '<div class="path-detail-head-txt">' +
          '<div class="path-detail-badges">' + badges + "</div>" +
          '<h2 class="path-detail-title" id="pathDetailTitle">' + escL(lpTT(p.title)) + "</h2>" +
          '<p class="path-detail-desc">' + escL(lpTT(p.desc)) + "</p>" +
        "</div>" +
      "</div>";

    /* Coming-soon placeholder — clean and honest, no fake content.
       Optionally points at the closest live content that already exists. */
    if (isSoon) {
      const labs = lpLabs(p);
      html +=
        '<div class="path-soon-box">' +
          "<h3>" + escL(Lang.t("paths.soonTitle")) + "</h3>" +
          "<p>" + escL(Lang.t("paths.soonBody")) + "</p>" +
          (labs.length
            ? '<p class="path-soon-while">' + escL(Lang.t("paths.soonMeanwhile")) + "</p>" +
              '<div class="path-related-chips">' + labs.map((v) => lpChip({ k: "lab", view: v })).join("") + "</div>"
            : "") +
        "</div>";
      detailBody.innerHTML = html;
      return;
    }

    /* Live path — progress indicator + recommended next topic */
    const doneMap = lpDoneMap();
    const prog = lpProgress(p);
    let progressHtml =
      '<div class="path-detail-progress">' +
        '<div class="path-detail-progress-txt">' +
          "<strong>" + escL(Lang.t("paths.progressLabel")) + "</strong>" +
          "<span>" + escL(Lang.t("paths.progressOf", { done: prog.done, total: prog.total })) + " · " + prog.pct + "%</span>" +
        "</div>" +
        '<div class="progress-bar path-detail-bar" role="img" aria-label="' + escL(Lang.t("paths.progressLabel")) + " " + prog.pct + '%"><i style="width:' + prog.pct + '%"></i></div>';

    if (prog.total > 0 && prog.done === prog.total) {
      progressHtml += '<p class="path-detail-done">' + escL(Lang.t("paths.complete")) + "</p>";
    } else if (prog.next) {
      progressHtml += '<p class="path-next-chip">' + escL(Lang.t("paths.next", { topic: lpTT(prog.next.t) })) + "</p>";
    }
    progressHtml += "</div>";
    html += progressHtml;

    /* Ordered topics with completion checkmarks */
    html += '<h3 class="path-detail-subhead">' + escL(Lang.t("paths.topicsTitle")) + "</h3>";
    html += '<ol class="path-topics">' + p.topics.map((t, i) => {
      const done = lpTopicDone(p, t, doneMap);
      const auto = Boolean(t.res && t.res.k === "quiz" && lpHasQuizResult(t.res.key));
      const stateLabel = done
        ? (auto ? Lang.t("paths.doneByQuiz") : Lang.t("paths.markUndone"))
        : Lang.t("paths.markDone");
      return (
        '<li class="path-topic' + (done ? " is-done" : "") + '" id="topic-' + escL(t.id) + '">' +
          '<span class="path-topic-num" aria-hidden="true">' + (i + 1) + "</span>" +
          '<span class="path-topic-txt">' +
            '<span class="path-topic-title">' + escL(lpTT(t.t)) + "</span>" +
            (t.res || t.lsn ? '<span class="path-topic-res">' + lpChip(t.res) + lpLessonChip(t.lsn) + "</span>" : "") +
          "</span>" +
          '<button type="button" class="path-topic-check"' +
            ' aria-pressed="' + (done ? "true" : "false") + '"' +
            (auto ? " disabled" : "") +
            ' data-path-toggle="' + escL(t.id) + '"' +
            ' title="' + escL(stateLabel) + '"' +
            ' aria-label="' + escL(lpTT(t.t)) + " — " + escL(stateLabel) + '">✓</button>' +
        "</li>"
      );
    }).join("") + "</ol>";

    /* Related resources — derived from the topic links (never duplicated) */
    const quizKeys = lpQuizKeys(p);
    const labs = lpLabs(p);
    const toolChips = p.topics.filter((t) => t.res && t.res.k === "tool").map((t) => lpChip(t.res));
    const relGroups = [];
    if (quizKeys.length) {
      relGroups.push(
        '<div class="path-related-group"><h4>' + escL(Lang.t("paths.relatedQuiz")) + "</h4>" +
        '<div class="path-related-chips">' + quizKeys.map((k) => lpChip({ k: "quiz", key: k })).join("") + "</div></div>"
      );
    }
    const toolLabChips = toolChips.concat(labs.map((v) => lpChip({ k: "lab", view: v })));
    if (toolLabChips.length) {
      relGroups.push(
        '<div class="path-related-group"><h4>' + escL(Lang.t("paths.relatedTools")) + "</h4>" +
        '<div class="path-related-chips">' + toolLabChips.join("") + "</div></div>"
      );
    }
    if (relGroups.length) html += '<div class="path-related">' + relGroups.join("") + "</div>";

    detailBody.innerHTML = html;
  }

  /* ---------- Events ---------- */

  /* Topic checkmarks — toggle manual completion, then refresh both views.
     Focus is restored onto the same toggle for keyboard users. */
  detailBody.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("[data-path-toggle]") : null;
    if (!btn || btn.disabled) return;
    const p = lpById(lpHashId());
    if (!p) return;
    const topicId = btn.getAttribute("data-path-toggle");
    const doneMap = lpDoneMap();
    const m = doneMap[p.id] || (doneMap[p.id] = {});
    if (m[topicId] === true) delete m[topicId];
    else m[topicId] = true;
    lpSaveDone(doneMap);
    lpRenderDetail();
    lpRenderGrid();
    const again = detailBody.querySelector('[data-path-toggle="' + topicId + '"]');
    if (again) again.focus();
  });

  /* Tool chips — after the ViewSwitcher lands on #tools, scroll to the
     exact tool card and flash it (12 cards live in that view). */
  document.addEventListener("click", (e) => {
    const link = e.target && e.target.closest ? e.target.closest("[data-tool-jump]") : null;
    if (!link) return;
    const target = document.getElementById(link.getAttribute("data-tool-jump"));
    if (!target) return;
    const rm = (typeof prefersReducedMotion !== "undefined") && prefersReducedMotion;
    setTimeout(() => {
      target.scrollIntoView({ behavior: rm ? "auto" : "smooth", block: "start" });
      target.classList.add("is-flashed");
      setTimeout(() => target.classList.remove("is-flashed"), 1600);
    }, rm ? 30 : 120);
  });

  /* Card click — re-render immediately and move focus to the detail
     heading (screen-reader page context). Modifier clicks (new tab)
     keep the default browser behavior. */
  document.addEventListener("click", (e) => {
    const card = e.target && e.target.closest ? e.target.closest("[data-path-id]") : null;
    if (!card || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    setTimeout(() => {
      lpRenderDetail();
      const h = detailBody.querySelector("#pathDetailTitle");
      if (h) {
        h.setAttribute("tabindex", "-1");
        h.focus({ preventScroll: true });
      }
    }, 0);
  });

  /* ---------- Lifecycle ---------- */

  /* Re-render on view switches (grid + detail read fresh progress) */
  document.addEventListener("nova:view-changed", (e) => {
    const v = e.detail && e.detail.viewId;
    if (v === "paths") lpRenderGrid();
    else if (v === "path") lpRenderDetail();
  });

  /* Back/forward between two "#path/<id>" deep links: the view stays
     "path" so no view-changed fires — watch the hash directly. */
  window.addEventListener("hashchange", () => {
    if (window.NovaViews && window.NovaViews.current && window.NovaViews.current() === "path") {
      lpRenderDetail();
    }
  });

  /* Quiz results landed/changed → auto-done topics + progress refresh */
  document.addEventListener("nova:progress-changed", () => {
    lpRenderGrid();
    if (window.NovaViews && window.NovaViews.current && window.NovaViews.current() === "path") {
      lpRenderDetail();
    }
  });

  /* Locale switch → repaint both views in the new language */
  Lang.onSwitch(() => {
    lpRenderGrid();
    if (window.NovaViews && window.NovaViews.current && window.NovaViews.current() === "path") {
      lpRenderDetail();
    }
  });

  lpRenderGrid();
  lpRenderDetail();

  /* Expose path data so MODULE 40 (Lessons) can resolve
     next-lesson links. No-op: data stays inside this IIFE
     for encapsulation; only the lookup function is exposed. */
  window.getLearningPaths = () => LEARNING_PATHS;
})();

/* MODULE 40 · Lessons + Quiz upgrades */
/* Bilingual labels for EXPLICIT question `cat` keys. Current-semester banks
   carry no `cat` — they are categorised by their authored Arabic `topic`
   (see computeCategoryBreakdown), which falls back to the raw key label. */
const QUIZ_CATS = {
  firewall:{ar:"جدار الحماية",en:"Firewall"},tls:{ar:"HTTPS وTLS",en:"HTTPS & TLS"},
  dos:{ar:"حجب الخدمة",en:"Denial of Service"},osi:{ar:"الشبكات وOSI",en:"Networks & OSI"},
  accounts:{ar:"الحسابات",en:"Accounts"},hardening:{ar:"تأمين النظام",en:"System Hardening"},
  uac:{ar:"التحكم بالصلاحيات",en:"UAC"},symmetric:{ar:"التشفير المتماثل",en:"Symmetric Encryption"},
  hashing:{ar:"التجزئة",en:"Hashing"},asymmetric:{ar:"التشفير غير المتماثل",en:"Asymmetric Encryption"},
  certs:{ar:"الشهادات",en:"Certificates"},sqli:{ar:"حقن SQL",en:"SQL Injection"},
  encryption:{ar:"تشفير البيانات",en:"Data Encryption"},privilege:{ar:"أقل الصلاحيات",en:"Least Privilege"},
  input:{ar:"التحقق من المدخلات",en:"Input Validation"},secrets:{ar:"الأسرار في الكود",en:"Secrets in Code"},
  securecode:{ar:"البرمجة الآمنة",en:"Secure Coding"},recon:{ar:"جمع المعلومات",en:"Reconnaissance"},
  ethics:{ar:"الأخلاقيات",en:"Ethics"},tools:{ar:"أدوات الفحص",en:"Scanning Tools"},general:{ar:"عام",en:"General"}
};
const SUBJECT_TO_PATH = {
  /* Current-semester subjects — official course codes → an EXISTING path id.
     Only path ids declared in LEARNING_PATHS may be used here. */
  "260210030702": "fundamentals",      // الخوارزميات
  "260210030802": "operating-systems", // مفاهيم نظم التشغيل
  "260210030902": "pentest",           // السياسات والتشريعات والأخلاقيات
  "260210031002": "fundamentals",      // مكونات أنظمة تقنية المعلومات
  "260210031102": "fundamentals"       // مبادئ التصميم في الأمن السيبراني
};

/* Expose the shared lookup maps on `window` so `renderResult` (declared in
   the outer scope, before this IIFE) can resolve category labels and the
   owning learning path for the result screen. Same encapsulation pattern
   as `window.getLearningPaths` above. Without this, the "Show Result"
   click throws a ReferenceError inside renderResult (its catch swallows
   the error) and the result screen never appears. */
window.QUIZ_CATS = QUIZ_CATS;
window.SUBJECT_TO_PATH = SUBJECT_TO_PATH;
function computeCategoryBreakdown(state){
  if(!state||!state.order||!state.answers)return [];
  const b={};
  /* Category per question: an explicit `cat` (legacy banks) or the bank's
     authored Arabic `topic` (current-semester banks carry `topic`, no `cat`).
     Unknown keys fall back to the raw key as the label — so topics from the
     current question banks are reported gracefully instead of collapsing
     into a single "general" row. */
  state.order.forEach((qi,i)=>{const q=state.questions[qi];if(!q)return;const c=q.cat||q.topic||'general';if(!b[c])b[c]={correct:0,total:0};b[c].total++;const a=state.answers[i];if(a&&a.correct)b[c].correct++;});
  return Object.keys(b).map(k=>{const x=b[k];return {cat:k,label:(QUIZ_CATS[k]&&QUIZ_CATS[k][Lang.current])||k,correct:x.correct,total:x.total,pct:Math.round(x.correct/x.total*100)};});
}
function retryIndices(state){
  if(!state||!state.order||!state.answers)return null;
  const bad=[];
  state.order.forEach((qi,i)=>{const a=state.answers[i];if(!a||!a.correct)bad.push(qi);});
  return bad.length?bad:null;
}

/* ---------- Lesson view (MODULE 40) ---------- */
function lessonEl(){return $id("lessonView");}
function lessonBody(){return $id("lessonBody");}

function nextLessonLink(subjectKey,topicKey){
  // Find the next lesson-bearing topic in the same subject's path
  const pathId=SUBJECT_TO_PATH[subjectKey];if(!pathId)return null;
  const path=getLearningPaths().find(p=>p.id===pathId);if(!path)return null;
  let found=false;
  for(const t of path.topics){
    if(found && t.lsn){return {id:t.id,title:t.t,key:t.lsn.key};}
    if(t.lsn && t.lsn.sub===subjectKey && t.lsn.key===topicKey)found=true;
  }
  return null;
}

function lessonResChips(subjectKey,topicKey){
  const pathId=SUBJECT_TO_PATH[subjectKey];if(!pathId)return "";
  const path=getLearningPaths().find(p=>p.id===pathId);if(!path)return "";
  const row=path.topics.find((t)=>t.lsn&&t.lsn.sub===subjectKey&&t.lsn.key===topicKey);
  if(!row||!row.res)return "";
  const r=row.res;
  if(r.k==="tool")return `<a href="#tools" class="btn btn-sm btn-ghost" data-tool-jump="${escHtml(r.id)}">${escHtml(r.ar||r.en||"Tool")}</a>`;
  if(r.k==="lab")return `<a href="#${escHtml(r.view)}" class="btn btn-sm btn-ghost">${escHtml(r.view)}</a>`;
  if(r.k==="flash")return `<a href="#flash" class="btn btn-sm btn-ghost">${escHtml(Lang.t("nav.flashcards"))}</a>`;
  return "";
}

/* ---------- Phase 4 helpers: derived lesson metadata + local stores ---------- */
/* Everything here is DERIVED from existing data (LESSONS, LEARNING_PATHS,
   QUIZZES, SUBJECT_TO_PATH) or stored locally on the device. No invented
   content; every helper degrades to null/[] so callers can show the honest
   "appears with authored content" notes instead of fake metadata. */

/** Find the learning-path row that owns this lesson topic. */
function lessonPathRow(subjectKey,topicKey){
  try{
    const paths=(typeof getLearningPaths==="function")?(getLearningPaths()||[]):[];
    for(const p of paths){
      const ts=Array.isArray(p.topics)?p.topics:[];
      for(let i=0;i<ts.length;i++){
        const t=ts[i];if(!t)continue;
        if(t.lsn&&t.lsn.sub===subjectKey&&t.lsn.key===topicKey)return {path:p,index:i,topic:t};
        if(t.res&&t.res.k==="quiz"&&t.res.key===subjectKey&&(t.id===topicKey||(t.t&&t.t.ar===topicKey)))return {path:p,index:i,topic:t};
      }
    }
  }catch(e){}
  return null;
}

/** All bilingual text of a lesson flattened (for the time estimate). */
function lessonTopicText(L){
  if(!L||typeof L!=="object")return "";
  const bi=v=>(v&&typeof v==="object")?((v.ar||"")+" "+(v.en||"")):(typeof v==="string"?v:"");
  let s=bi(L.title)+" "+bi(L.explanation);
  (Array.isArray(L.concepts)?L.concepts:[]).forEach(c=>{s+=" "+bi(c&&c.term)+" "+bi(c&&c.def);});
  if(L.example)s+=" "+bi(L.example);
  (Array.isArray(L.mistakes)?L.mistakes:[]).forEach(m=>{s+=" "+bi(m);});
  (Array.isArray(L.terminology)?L.terminology:[]).forEach(t2=>{s+=" "+bi(t2);});
  return s;
}

/** Rough word count across both locales of the lesson. */
function lessonWords(L){
  const m=lessonTopicText(L).trim().match(/\S+/g);
  return m?m.length:0;
}

/** Estimated reading minutes from word count; null when nothing authored. */
function lessonMinutes(L){
  const w=lessonWords(L);
  if(!w)return null;
  return Math.max(3,Math.ceil(w/160));
}

/**
 * Difficulty: explicit authored level wins; else derived from the quiz mix
 * (explicit q.level / q.difficulty fields when a bank carries them), else the
 * owning path level; null when nothing can be derived.
 * @returns {{level:string,source:string}|null}
 */
function lessonDifficulty(subjectKey,topicKey,L){
  const norm=v=>{const s=String(v||"").toLowerCase();if(/easy|beginner|سهل/.test(s))return "easy";if(/hard|advanced|متقد/.test(s))return "hard";if(/med|interm|متوسط/.test(s))return "medium";return null;};
  const lv=L&&norm(L.level||L.difficulty);
  if(lv)return {level:lv,source:"authored"};
  try{
    const bank=(typeof QUIZZES!=="undefined"&&QUIZZES)?QUIZZES[subjectKey]:null;
    const qs=bank&&Array.isArray(bank.questions)?bank.questions:[];
    const levels=qs.map(q=>norm(q&&(q.level||q.difficulty))).filter(Boolean);
    if(levels.length){
      const hard=levels.filter(x=>x==="hard").length,med=levels.filter(x=>x==="medium").length;
      const level=hard*2>=levels.length?"hard":(hard+med)*2>=levels.length?"medium":"easy";
      return {level:level,source:"quiz-mix"};
    }
  }catch(e){}
  const row=lessonPathRow(subjectKey,topicKey);
  if(row&&row.path&&row.path.level){
    const lv2=norm(row.path.level);
    if(lv2)return {level:lv2,source:"path"};
  }
  return null;
}

/** Prerequisite topics = earlier topics of the owning path (max 3). */
function lessonPrereqs(subjectKey,topicKey){
  const row=lessonPathRow(subjectKey,topicKey);
  if(!row||row.index<=0)return [];
  const out=[];
  for(let i=Math.max(0,row.index-3);i<row.index;i++){
    const t=row.path.topics[i];if(!t)continue;
    out.push({title:t.t,lesson:(t.lsn&&t.lsn.sub&&t.lsn.key)?{sub:t.lsn.sub,key:t.lsn.key}:null});
  }
  return out;
}

/** Quick checks: real questions from the subject bank whose topic matches. */
function lessonChecks(subjectKey,topicKey,limit){
  const max=typeof limit==="number"?limit:3;
  try{
    const bank=(typeof QUIZZES!=="undefined"&&QUIZZES)?QUIZZES[subjectKey]:null;
    const qs=bank&&Array.isArray(bank.questions)?bank.questions:[];
    if(!qs.length)return [];
    const match=qs.map((q,i)=>({q:q,i:i})).filter(x=>x.q&&typeof x.q.topic==="string"&&x.q.topic.trim()===topicKey);
    const pool=match.length?match:qs.map((q,i)=>({q:q,i:i}));
    return pool.slice(0,max);
  }catch(e){}
  return [];
}

/** Related quiz key: the topic's quiz resource, else the subject bank itself. */
function lessonRelatedQuiz(subjectKey,topicKey){
  try{
    const row=lessonPathRow(subjectKey,topicKey);
    if(row&&row.topic&&row.topic.res&&row.topic.res.k==="quiz"&&row.topic.res.key)return row.topic.res.key;
    const has=(typeof QUIZZES!=="undefined"&&QUIZZES&&QUIZZES[subjectKey]&&QUIZZES[subjectKey].questions&&QUIZZES[subjectKey].questions.length);
    if(has)return subjectKey;
  }catch(e){}
  return null;
}

/** Related lab hash: topic's lab resource, else the first lab of the owning path.
    Lab resources point at an app view ({ k:"lab", view:"redteam" }). */
function lessonRelatedLab(subjectKey,topicKey){
  try{
    const row=lessonPathRow(subjectKey,topicKey);
    if(!row)return null;
    if(row.topic.res&&row.topic.res.k==="lab"&&row.topic.res.view)return "#"+row.topic.res.view;
    const labs=(Array.isArray(row.path.topics)?row.path.topics:[]).map(t=>t&&t.res)
      .concat(Array.isArray(row.path.related)?row.path.related:[])
      .filter(r=>r&&r.k==="lab"&&r.view);
    return labs.length?("#"+labs[0].view):null;
  }catch(e){}
  return null;
}

/** Defensive Store read — never throws inside the lesson view. */
function lessonStore(key,fallback){
  try{ return Store.get(key,fallback); }catch(e){ return fallback; }
}

/** Lesson completion map (shared "lessons" store used by Progress). */
function lessonDoneMap(){
  const v=lessonStore("lessons",null);
  return (v&&typeof v==="object"&&v.done&&typeof v.done==="object")?v.done:{};
}

/** Bookmarks: { v:1, items: { "sub/topic": true } } */
function lessonBookmarks(){
  const v=lessonStore("bookmarks",null);
  return (v&&typeof v==="object"&&v.items&&typeof v.items==="object")?v.items:{};
}

/** Local note text for a lesson key ("" when none). */
function lessonNotesText(lkey){
  const v=lessonStore("lesson-notes",null);
  const notes=(v&&typeof v==="object"&&v.notes&&typeof v.notes==="object")?v.notes:{};
  return typeof notes[lkey]==="string"?notes[lkey]:"";
}

/** Review timestamps for the transparent revision engine. */
function lessonReviewedMap(){
  const v=lessonStore("revision",null);
  return (v&&typeof v==="object"&&v.last&&typeof v.last==="object")?v.last:{};
}

/** Persist bookmarks; fires the shared progress-changed event. */
function saveLessonBookmarks(items){
  try{
    Store.set("bookmarks",{v:1,items:items});
    if(typeof CustomEvent==="function"&&document&&typeof document.dispatchEvent==="function"){
      document.dispatchEvent(new CustomEvent("nova:progress-changed"));
    }
  }catch(e){}
}

/** Persist one local note (capped at 2000 chars). */
function saveLessonNote(lkey,text){
  try{
    const cur=lessonStore("lesson-notes",null);
    const st=(cur&&typeof cur==="object"&&cur.notes&&typeof cur.notes==="object")?cur:{v:1,notes:{}};
    const s=String(text==null?"":text).slice(0,2000);
    if(s.trim())st.notes[lkey]=s;else delete st.notes[lkey];
    Store.set("lesson-notes",st);
    if(typeof CustomEvent==="function"&&document&&typeof document.dispatchEvent==="function"){
      document.dispatchEvent(new CustomEvent("nova:progress-changed"));
    }
  }catch(e){}
}

/** Record a review timestamp for a revision-queue item. */
function saveLessonReview(id){
  try{
    const cur=lessonStore("revision",null);
    const st=(cur&&typeof cur==="object"&&cur.last&&typeof cur.last==="object")?cur:{v:1,last:{}};
    st.last[id]=Date.now();
    Store.set("revision",st);
  }catch(e){}
}


function showLesson(subjectKey,topicKey){
  const root=lessonBody();if(!root)return;
  const lesson=(LESSONS[subjectKey]&&LESSONS[subjectKey][topicKey])||null;
  const cur=Lang.current;
  window.NovaViews.activate("lesson");

  const lkey=subjectKey+"/"+topicKey;

  /* Phase 4 shared sections — every block derives from REAL data (question
     bank, learning path, local stores) and degrades to an honest note when
     nothing exists yet. No invented content. */
  const relatedQuiz=lessonRelatedQuiz(subjectKey,topicKey);
  const relatedLab=lessonRelatedLab(subjectKey,topicKey);
  const isBm=!!lessonBookmarks()[lkey];
  const isDone=!!lessonDoneMap()[lkey];
  const checks=lessonChecks(subjectKey,topicKey,3);
  const prereqs=lessonPrereqs(subjectKey,topicKey);

  const actionsHtml=`<div class="lesson-actions">`+
    `<button type="button" class="btn btn-sm ${isDone?"btn-ghost":"btn-primary"}" data-lsn-complete="1" aria-pressed="${isDone}">${escHtml(Lang.t(isDone?"lesson.markUndone":"lesson.markComplete"))}</button>`+
    `<button type="button" class="btn btn-sm btn-ghost" data-lsn-bookmark="1" aria-pressed="${isBm}">${escHtml(Lang.t(isBm?"lesson.unbookmark":"lesson.bookmark"))}</button>`+
    `</div>`;

  const prereqHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.prerequisites"))}</h3>`+
    (prereqs.length
      ?`<div class="lesson-prereqs">`+prereqs.map(p2=>{
          const t2=(p2.title&&(p2.title[cur]||p2.title.ar))||"";
          return p2.lesson
            ?`<a class="lesson-prereq" href="#lesson/${escHtml(p2.lesson.sub)}/${escHtml(p2.lesson.key)}">${escHtml(t2)}</a>`
            :`<span class="lesson-prereq is-plain">${escHtml(t2)}</span>`;
        }).join("")+`</div>`
      :`<p class="lesson-muted">${escHtml(Lang.t("lesson.prerequisitesNone"))}</p>`)+
    `</div>`;

  let checksHtml="";
  if(checks.length){
    checksHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.checks"))}</h3><div class="lesson-checks">`+
      checks.map(c=>{
        const q=c.q||{};
        const opts=Array.isArray(q.opts)?q.opts:(Array.isArray(q.options)?q.options:[]);
        const correct=(typeof q.a==="number")?q.a:((typeof q.correct==="number")?q.correct:0);
        return `<div class="lesson-check">`+
          `<p class="lesson-check-q">${escHtml(q.q||"")}</p>`+
          `<div class="lesson-check-opts">`+opts.map((o,oi)=>`<button type="button" class="lesson-check-opt" data-lsn-opt="${oi===correct?1:0}">${escHtml((o&&typeof o==="object")?(o[cur]||o.ar||""):o)}</button>`).join("")+`</div>`+
          `<p class="lesson-check-fb" role="status" aria-live="polite"></p>`+
        `</div>`;
      }).join("")+`</div></div>`;
  }

  const relLinks=[];
  if(relatedQuiz)relLinks.push(`<a href="#quiz" class="btn btn-sm btn-primary" data-quiz-jump="${escHtml(relatedQuiz)}">${escHtml(Lang.t("lesson.relatedQuiz"))}</a>`);
  if(relatedLab)relLinks.push(`<a href="${escHtml(relatedLab)}" class="btn btn-sm btn-ghost">${escHtml(Lang.t("lesson.relatedLab"))}</a>`);
  const relHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.relatedQuiz"))} · ${escHtml(Lang.t("lesson.relatedLab"))}</h3>`+
    (relLinks.length?`<div class="lesson-practice-links">${relLinks.join("")}</div>`:`<p class="lesson-muted">${escHtml(Lang.t("lesson.noRelated"))}</p>`)+
    `</div>`;

  const notesHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.notes"))}</h3>`+
    `<textarea class="lesson-note-input" maxlength="2000" rows="3" data-lsn-note="1" placeholder="${escHtml(Lang.t("lesson.notePlaceholder"))}">${escHtml(lessonNotesText(lkey))}</textarea>`+
    `<div class="lesson-note-actions">`+
    `<button type="button" class="btn btn-sm btn-primary" data-lsn-save-note="1">${escHtml(Lang.t("lesson.saveNote"))}</button>`+
    `<button type="button" class="btn btn-sm btn-ghost" data-lsn-clear-note="1">${escHtml(Lang.t("lesson.clearNote"))}</button>`+
    `<span class="lesson-note-status" role="status" aria-live="polite"></span></div></div>`;

  const reviewHtml=`<div class="lesson-block lesson-review-row">`+
    `<a href="#progress" class="btn btn-sm btn-ghost" data-review-start="mistakes">${escHtml(Lang.t("review.startMistakes"))}</a>`+
    `<a href="#progress" class="btn btn-sm btn-ghost" data-review-start="five">${escHtml(Lang.t("review.startFive"))}</a>`+
    `</div>`;

  if(!lesson){
    /* Honest placeholder for topics without authored lessons — plus the
       derived sections that work from real data without authored content. */
    root.innerHTML=`<div class="lesson-shell" data-lsn-sub="${escHtml(subjectKey)}" data-lsn-topic="${escHtml(topicKey)}">`+
      `<div class="lesson-placeholder"><span class="lesson-ico" aria-hidden="true">📝</span><h2>${escHtml(Lang.t("lesson.soonTitle"))}</h2><p>${escHtml(Lang.t("lesson.soonBody"))}</p><a href="#quiz" class="btn btn-primary">${escHtml(Lang.t("lesson.backToQuiz"))}</a></div>`+
      `<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.objectives"))}</h3><p class="lesson-muted">${escHtml(Lang.t("lesson.noObjectives"))}</p></div>`+
      `<div class="lesson-meta"><span class="lesson-meta-chip">${escHtml(Lang.t("lesson.difficulty"))}: ${escHtml(Lang.t("lesson.difficultyUnknown"))}</span></div>`+
      prereqHtml+checksHtml+relHtml+actionsHtml+notesHtml+reviewHtml+
      `</div>`;
    return;
  }

  /* Lightweight completion tracking for the Progress hub: opening an
     authored lesson marks it as reviewed locally (motmi-portal:lessons).
     Additive; never touches the lesson rendering. The same record carries
     a `last` pointer so MODULE 47 · HeroDash can show the last opened
     lesson (read back through window.PLATFORM_STORE). */
  try {
    const lkey = subjectKey + "/" + topicKey;
    const curL = Store.get("lessons", null);
    const st = (curL && typeof curL === "object" && curL.done && typeof curL.done === "object") ? curL : { v: 1, done: {} };
    const st2ok = st;
    st2ok.last = { key: lkey, sub: subjectKey, topic: topicKey, ts: Date.now() };
    const isNew = !st.done[lkey] && !(st.undone && st.undone[lkey]);
    if (isNew) st.done[lkey] = true;
    Store.set("lessons", st2ok);
    /* Reuse the existing "lesson reviewed" semantic as completion. */
    if (isNew) awardMotivation("lesson", lkey);
    if (isNew && typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("nova:progress-changed"));
  } catch {}

  const B=lesson;
  const title=B.title[cur]||B.title.ar||"";
  const expl=B.explanation[cur]||B.explanation.ar||"";

  /* Phase 4 · derived meta row: estimated time (word count) + difficulty
     (authored → quiz mix → path level). Chips carry an honest source note. */
  const mins=lessonMinutes(B);
  const diff=lessonDifficulty(subjectKey,topicKey,B);
  const metaChips=[];
  if(mins)metaChips.push(`<span class="lesson-meta-chip" title="${escHtml(Lang.t("lesson.timeNote"))}">⏱ ${escHtml(Lang.t("lesson.minutes",{minutes:mins}))}</span>`);
  if(diff){
    const dk="lesson.difficulty"+diff.level.charAt(0).toUpperCase()+diff.level.slice(1);
    const ds=diff.source==="quiz-mix"?"lesson.fromQuizMix":(diff.source==="path"?"lesson.fromPath":dk);
    metaChips.push(`<span class="lesson-meta-chip" title="${escHtml(Lang.t(ds))}">◈ ${escHtml(Lang.t("lesson.difficulty"))}: ${escHtml(Lang.t(dk))}</span>`);
  }
  const metaHtml=metaChips.length?`<div class="lesson-meta">${metaChips.join("")}</div>`:"";

  /* Objectives: rendered only when authored — never invented. */
  let objectivesHtml="";
  if(Array.isArray(B.objectives)&&B.objectives.length){
    objectivesHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.objectives"))}</h3><ul class="lesson-objectives">`+
      B.objectives.map(o=>`<li>${escHtml((o&&typeof o==="object")?(o[cur]||o.ar||""):o)}</li>`).join("")+
      `</ul></div>`;
  }

  // Concepts
  let conceptsHtml="";
  if(B.concepts&&B.concepts.length){
    conceptsHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.keyConcepts"))}</h3><div class="lesson-concepts">`+
      B.concepts.map(c=>`<div class="lesson-concept"><strong>${escHtml(c.term[cur]||c.term.ar)}</strong><span>${escHtml(c.def[cur]||c.def.ar)}</span></div>`).join("")+
      `</div></div>`;
  }

  // Example
  let exampleHtml="";
  if(B.example){
    exampleHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.practicalExample"))}</h3><div class="lesson-example">${escHtml(B.example[cur]||B.example.ar)}</div></div>`;
  }

  // Mistakes
  let mistakesHtml="";
  if(B.mistakes&&B.mistakes.length){
    mistakesHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.commonMistakes"))}</h3><ul class="lesson-mistakes">`+
      B.mistakes.map(m=>`<li>${escHtml(m[cur]||m.ar)}</li>`).join("")+
      `</ul></div>`;
  }

  // Terminology
  let termHtml="";
  if(B.terminology&&B.terminology.length){
    termHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.terminology"))}</h3><div class="lesson-term-grid">`+
      B.terminology.map(t2=>`<div class="lesson-term"><span class="lesson-term-ar">${escHtml(t2.ar)}</span><span class="lesson-term-en">${escHtml(t2.en)}</span></div>`).join("")+
      `</div></div>`;
  }

  // Related practice + tool/lab links derived from the path topic res
  let practiceHtml=`<div class="lesson-block"><h3>${escHtml(Lang.t("lesson.relatedPractice"))}</h3><div class="lesson-practice-links">`+
    `<a href="#quiz" class="btn btn-sm btn-primary" data-quiz-jump="${escHtml(subjectKey)}">${escHtml(Lang.t("lesson.takeQuiz"))}</a>`+
    lessonResChips(subjectKey,topicKey)+
    `</div></div>`;

  // Next lesson
  const nextL=nextLessonLink(subjectKey,topicKey);
  let nextHtml="";
  if(nextL){
    nextHtml=`<a href="#lesson/${escHtml(subjectKey)}/${escHtml(nextL.key)}" class="lesson-next">${escHtml(Lang.t("lesson.nextLesson"))}: ${escHtml(nextL.title[cur]||nextL.title.ar)} →</a>`;
  }

  root.innerHTML=`<div class="lesson-shell" data-lsn-sub="${escHtml(subjectKey)}" data-lsn-topic="${escHtml(topicKey)}">
    <div class="lesson-header"><h2>${escHtml(title)}</h2></div>
    ${metaHtml}${actionsHtml}
    ${objectivesHtml}
    <div class="lesson-block"><p class="lesson-explain">${escHtml(expl)}</p></div>
    ${conceptsHtml}${exampleHtml}${mistakesHtml}${termHtml}
    ${prereqHtml}${checksHtml}
    ${practiceHtml}
    ${notesHtml}${reviewHtml}
    ${nextHtml}
  </div>`;
}

/* Phase 4 · ONE delegated click listener for the lesson view actions
   (bookmark / completion / quick checks / notes). #lessonBody itself is
   never replaced — only its innerHTML — so this binding survives every
   re-render, same pattern as bindQuizDelegation(). */
function bindLessonDelegation(){
  const root=lessonBody();if(!root)return;
  try{ if(window.__lsnDelegated)return; window.__lsnDelegated=1; }catch(e){ return; }
  root.addEventListener("click",(e)=>{
    const t=e.target;if(!t||!t.closest)return;
    const shell=t.closest("[data-lsn-sub]");
    if(!shell)return;
    const sub=shell.getAttribute("data-lsn-sub"),topic=shell.getAttribute("data-lsn-topic");
    if(!sub||!topic)return;
    const lkey=sub+"/"+topic;
    const rerender=()=>showLesson(sub,topic);

    if(t.closest("[data-lsn-bookmark]")){
      const items=lessonBookmarks();
      if(items[lkey])delete items[lkey];else items[lkey]=true;
      saveLessonBookmarks(items);
      rerender();return;
    }
    if(t.closest("[data-lsn-complete]")){
      try{
        const curL=lessonStore("lessons",null);
        const st=(curL&&typeof curL==="object"&&curL.done&&typeof curL.done==="object")?curL:{v:1,done:{}};
        if(st.done[lkey]){delete st.done[lkey];if(!st.undone||typeof st.undone!=="object")st.undone={};st.undone[lkey]=true;}
        else{st.done[lkey]=true;if(st.undone&&typeof st.undone==="object")delete st.undone[lkey];}
        Store.set("lessons",st);
        if(typeof CustomEvent==="function"&&document&&typeof document.dispatchEvent==="function"){
          document.dispatchEvent(new CustomEvent("nova:progress-changed"));
        }
      }catch(e2){}
      rerender();return;
    }
    const opt=t.closest("[data-lsn-opt]");
    if(opt){
      const card=opt.closest(".lesson-check");if(!card)return;
      const ok=opt.getAttribute("data-lsn-opt")==="1";
      card.classList.add(ok?"is-correct":"is-wrong");
      card.querySelectorAll(".lesson-check-opt").forEach(b=>{b.disabled=true;});
      opt.classList.add(ok?"is-correct":"is-wrong");
      const fb=card.querySelector(".lesson-check-fb");
      if(fb)fb.textContent=Lang.t(ok?"lesson.checkCorrect":"lesson.checkWrong");
      try{ Sfx.play("tick"); }catch(e2){}
      return;
    }
    if(t.closest("[data-lsn-save-note]")||t.closest("[data-lsn-clear-note]")){
      const block=t.closest(".lesson-block");if(!block)return;
      const ta=block.querySelector("[data-lsn-note]");if(!ta)return;
      const status=block.querySelector(".lesson-note-status");
      if(t.closest("[data-lsn-clear-note]"))ta.value="";
      const truncated=String(ta.value||"").length>2000;
      saveLessonNote(lkey,ta.value);
      if(status)status.textContent=Lang.t(truncated?"lesson.noteTooLong":"lesson.noteSaved");
      return;
    }
  });
}

function initLessons(){
  /* Resolve #lesson/<subject>/<topic> deep links via hashchange —
     no registerPrefix API needed (ViewSwitcher handles prefix routing). */
  function handleLessonHash(){
    /* Only react to genuine lesson routes: without this guard any
       two-segment hash (e.g. #path/networks) parsed as subject/topic
       and hijacked the initial view to #lesson on page load. */
    var raw = location.hash || "";
    if (raw.indexOf("#lesson/") !== 0 && raw !== "#lesson") return;
    var h = raw.replace(/^#lesson\/?/, "").trim();
    var parts = h ? h.split("/") : [];
    if (parts.length >= 2 && parts[0] && parts[1]) {
      showLesson(parts[0], parts[1]);
    } else {
      var b = lessonBody();
      if(b) b.innerHTML = '<div class="lesson-shell"><p>' + escHtml(Lang.t("lesson.backToQuiz")) + '</p></div>';
    }
  }
  window.addEventListener('hashchange', function(){
    if(/^#lesson/.test(location.hash)) handleLessonHash();
  });
  bindLessonDelegation();
  handleLessonHash();
}
initLessons();

/* @@LESSONS_D@@ */


/* ============================================================
   MODULE 42 · ToolsEdu — assembled from Phase 4 fragments
   ============================================================ */
/* ============================================================
   MODULE 42 · ToolsEdu — educational layer for tools & labs
   ------------------------------------------------------------
   Phase 4: every tool presents itself as an educational component
   connected to a learning path: AR/EN name, purpose/learning
   objective, difficulty level, short explanation, safety note and
   limitations, a safe example input (clearly fake data), reset,
   copy (where appropriate), validation-friendly wiring, and links
   to the owning path / authored lesson / subject quiz. Labs get an
   objective/skills/hints/completion panel with a responsible-use
   warning. All data is embedded (offline + file://), all strings
   bilingual, all rendering additive — no tool behavior is rewritten.
   Labs are listed as complete only where they really are; the
   structure supports a "soon" status for future additions.
   ============================================================ */
const TOOLS_META = {
  "tool-hash": {
    name: { ar: "مولّد بصمة SHA-256", en: "SHA-256 Hash Generator" },
    level: "beginner", path: "cryptography", lesson: null, quiz: "260210031102",
    purpose: {
      ar: "افهم دالة التجزئة أحادية الاتجاه: نص مختلف قليلًا ينتج بصمة مختلفة تمامًا.",
      en: "Understand one-way hashing: a tiny text change produces a completely different digest."
    },
    safety: {
      ar: "التجزئة ليست تشفيرًا — لا يمكن عكس البصمة ولا تُستخدم لإخفاء البيانات؛ MD5/SHA-1 القديمة لم تعد آمنة.",
      en: "Hashing is not encryption — the digest cannot be reversed or hide data; legacy MD5/SHA-1 are no longer secure."
    },
    example: { fill: [{ id: "hashInput", value: "hello world" }] },
    copy: "hashOut"
  },
  "tool-caesar": {
    name: { ar: "تشفير Caesar", en: "Caesar Cipher" },
    level: "beginner", path: "cryptography", lesson: null, quiz: "260210031102",
    purpose: {
      ar: "انظر كيف تعمل شفرة الإزاحة ولماذا تنكسر بتجربة 26 احتمالًا فقط.",
      en: "See how a shift cipher works — and why it breaks by trying just 26 shifts."
    },
    safety: {
      ar: "⚠️ تعليمي فقط وليس تشفيرًا آمنًا — لا تستخدمه لحماية أي بيانات حقيقية.",
      en: "⚠️ Educational only and NOT secure encryption — never protect real data with it."
    },
    example: { fill: [{ id: "cipherIn", value: "meet me at noon" }] },
    copy: null
  },
  "tool-jwt": {
    name: { ar: "محلّل JWT", en: "JWT Decoder" },
    level: "intermediate", path: "websec", lesson: null, quiz: null,
    purpose: {
      ar: "افكك بنية الرمز: الترويسة، الحمولة، وتاريخ الانتهاء — وأدرك أن الوسيط يستطيع قراءته.",
      en: "Break down the token structure — header, payload, expiry — and realise any intermediary can read it."
    },
    safety: {
      ar: "⚠️ فك الترميز ليس تحققًا من التوقيع: الأداة لا تتحقق من صحة التوقيع إطلاقًا. لا تلصق رموزًا حقيقية أو خاصة أبدًا.",
      en: "⚠️ Decoding is NOT signature verification: this tool never validates the signature. Never paste real tokens."
    },
    example: {
      fill: [{ id: "jwtIn", value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c" }]
    },
    copy: "jwtPayload"
  },
  "tool-cidr": {
    name: { ar: "حاسبة الشبكات CIDR", en: "IPv4 Subnet Calculator" },
    level: "beginner", path: "networking", lesson: null, quiz: "260210031002",
    purpose: {
      ar: "أتقن عنونة IPv4: القناع، نطاق المضيفين، عنوان البث، وعدد العناوين المتاحة.",
      en: "Master IPv4 addressing: the mask, host range, broadcast address and usable host count."
    },
    safety: {
      ar: "IPv4 فقط — لا يدعم IPv6. استخدم عناوين التوثيق مثل 192.168.x.x أو 203.0.113.x في التمارين.",
      en: "IPv4 only — no IPv6 support. Practise with documentation ranges like 192.168.x.x or 203.0.113.x."
    },
    example: { fill: [{ id: "cidrIp", value: "192.168.10.7" }] },
    copy: null
  },
  "tool-password": {
    name: { ar: "تحليل قوة كلمة المرور", en: "Password Strength Analyzer" },
    level: "beginner", path: "fundamentals", lesson: null, quiz: null,
    purpose: {
      ar: "افهم الإنتروبيا وزمن الكسر التقديري وما يجعل كلمة المرور قوية فعلًا.",
      en: "Understand entropy, estimated crack time, and what actually makes a password strong."
    },
    safety: {
      ar: "يعمل محليًا 100% ولا يُرسل أي شيء للخارج. ومع ذلك: لا تكتب كلمة مرور حقيقية — استخدم مثالًا تجريبيًا فقط.",
      en: "Runs 100% locally and sends nothing anywhere. Even so, never type a real password — use a demo one only."
    },
    example: { fill: [{ id: "pwInput", value: "Demo-Only-2026!" }] },
    copy: null
  },
  "tool-encoders": {
    name: { ar: "مشفّرات Base64 / Hex / URL", en: "Base64 / Hex / URL Encoders" },
    level: "beginner", path: "websec", lesson: null, quiz: null,
    purpose: {
      ar: "الفرق بين الترميز والتشفير: صيغ الترميز تُفك فورًا ودون مفتاح.",
      en: "Encoding vs. encryption: encoding schemes reverse instantly and need no key."
    },
    safety: {
      ar: "الترميز ليس تشفيرًا — Base64 يُفك لحظيًا؛ لا تخفِ به أي أسرار.",
      en: "Encoding is not encryption — Base64 reverses instantly; never treat it as protection."
    },
    example: { fill: [{ id: "encIn", value: "Hello, security!" }], click: "encEncode" },
    copy: null
  },

  "tool-regex": {
    name: { ar: "محلل Regex + مرئي", en: "Regex Analyzer + Visualizer" },
    level: "intermediate", path: "websec", lesson: null, quiz: "260210031102",
    purpose: {
      ar: "افهم بنية الأنماط واستخدمها للتحقق من المدخلات — أساس البرمجة الآمنة.",
      en: "Understand pattern structure and use it for input validation — a secure-coding foundation."
    },
    safety: {
      ar: "الأنماط المتداخلة قد تسبب تتبعًا كارثيًا (ReDoS) في الأنظمة الحقيقية — الأداة تحدّ من خطوات المطابقة.",
      en: "Nested patterns can cause catastrophic backtracking (ReDoS) in real systems — this tool caps match steps."
    },
    example: { fill: [{ id: "regexPatt", value: "(ab|cd)+[0-9]?" }, { id: "regexText", value: "abab cd7" }], click: "regexRun" },
    copy: null
  },
  "tool-fw": {
    name: { ar: "محاكي قواعد الجدار الناري", en: "Firewall Rule Simulator" },
    level: "intermediate", path: "networking", lesson: null, quiz: null,
    purpose: {
      ar: "افهم ترتيب القواعد (أول قاعدة مطابقة تفوز) وتفكير المنع الافتراضي.",
      en: "Understand rule ordering — first match wins — and default-deny thinking."
    },
    safety: {
      ar: "محاكاة تعليمية داخل المتصفح — ليست جدار حماية حقيقيًا ولا تفحص حركة مرور فعلية.",
      en: "An in-browser educational simulation — not a real firewall and it inspects no actual traffic."
    },
    example: { fill: [{ id: "fwDst", value: "10.0.0.5" }, { id: "fwPort", value: "22" }], click: "fwAdd" },
    copy: null
  },
  "tool-vuln": {
    name: { ar: "ماسح ثغرات (محاكاة)", en: "Vulnerability Scanner (Simulated)" },
    level: "intermediate", path: "pentest", lesson: null, quiz: "260210030902",
    purpose: {
      ar: "تعلّم قراءة تقرير فحص: الخطورة، الوصف، والحل المقترح لكل ثغرة.",
      en: "Learn to read a scan report: severity, the finding itself, and the suggested remediation."
    },
    safety: {
      ar: "أهداف وهمية معرفة محليًا فقط — لا تفحص أبدًا أنظمة لا تملكها أو لا تملك إذنًا باختبارها.",
      en: "Predefined local dummy targets only — never scan systems you do not own or lack permission to test."
    },
    example: { fill: [{ id: "vulnTarget", value: "10.0.0.5 — web-prod" }], click: "vulnRun" },
    copy: null
  },
  "tool-sniffer": {
    name: { ar: "مستنشق حزم (فك ترميز)", en: "Packet Sniffer (Decoder)" },
    level: "advanced", path: "networking", lesson: null, quiz: "260210031002",
    purpose: {
      ar: "افهم بنية الحزمة بايتًا بايت: ترويسات Ethernet وIPv4 وTCP/UDP.",
      en: "Understand packet structure byte-by-byte: Ethernet, IPv4 and TCP/UDP headers."
    },
    safety: {
      ar: "يفك إطارات من سداسي عشري تلصقه بنفسك — لا يلتقط شيئًا من أي شبكة حقيقية.",
      en: "Decodes hex frames you paste yourself — captures nothing from any real network."
    },
    example: { click: "sniffSample" },
    copy: "sniffOut"
  },
  "tool-portscan": {
    name: { ar: "ماسح منافذ (مرئي)", en: "Port Scanner (Visual)" },
    level: "advanced", path: "pentest", lesson: null, quiz: "260210030902",
    purpose: {
      ar: "افهم حالات المنافذ open/closed/filtered وماذا تكشف عن الخدمات.",
      en: "Understand port states — open/closed/filtered — and what they reveal about services."
    },
    safety: {
      ar: "يفحص مضيفًا وهميًا داخل المتصفح. فحص المنافذ على أنظمة حقيقية بدون إذن خطي غير قانوني.",
      en: "Scans a simulated in-browser host. Port-scanning real systems without written permission is illegal."
    },
    example: { fill: [{ id: "portHost", value: "10.0.0.5" }], click: "portRun" },
    copy: null
  },
  "tool-playground": {
    name: { ar: "ملعب التشفير/فك التشفير", en: "Crypto Playground" },
    level: "intermediate", path: "cryptography", lesson: null, quiz: "260210031102",
    purpose: {
      ar: "قارن الشفرات الكلاسيكية (Caesar، Vigenère، XOR، RC4) والترميزات جنبًا إلى جنب.",
      en: "Compare classical ciphers (Caesar, Vigenère, XOR, RC4) and encodings side by side."
    },
    safety: {
      ar: "⚠️ كل الخوارزميات هنا كلاسيكية/تعليمية — لا تستخدم أيًا منها لحماية بيانات حقيقية.",
      en: "⚠️ Every cipher here is classical/educational — never protect real data with them."
    },
    example: { fill: [{ id: "cpIn", value: "attack at dawn" }, { id: "cpKey", value: "key" }], click: "cpEnc" },
    copy: "cpOut"
  }
};

/* Expose the tool metadata (bilingual names + owning path/lesson) so
   MODULE 48 · GlobalSearch can index the 12 real tools without scraping.
   Guarded: isolated module slices run without a `window` object. */
if (typeof window !== "undefined") window.PLATFORM_TOOLS_META = TOOLS_META;

const LABS_META = {
  games: {
    status: "live", level: "intermediate",
    name: { ar: "تحديات CTF — الاستجابة للحوادث", en: "CTF Scenarios — Incident Response" },
    objective: {
      ar: "رتّب استجابة الهجوم داخل طرفية الأوامر: حلّل التنبيه، خفّف الهجوم، ثم استخرج العَلَم.",
      en: "Drive the response inside the console: analyse the alert, mitigate the attack, then extract the flag."
    },
    skills: [
      { ar: "قراءة تنبيهات الهجمات وتصنيفها", en: "Reading and classifying attack alerts" },
      { ar: "أوامر التحليل والتخفيف في الطرفية", en: "Analysis and mitigation commands in a console" },
      { ar: "استخراج الأدلة والعَلَم من النظام", en: "Extracting evidence and the flag from the system" }
    ],
    hints: [
      { ar: "ابدأ بالأمر help لعرض الأوامر — و hint عند التعطّل (يكلف نقاطًا).", en: "Start with help to list commands — and hint when stuck (it costs points)." },
      { ar: "في سيناريو حقن SQL جرّب ' OR 1=1 -- ولاحظ كيف يتغيّر الاستعلام.", en: "In the SQLi scenario try ' OR 1=1 -- and watch how the query changes." }
    ],
    explanation: {
      ar: "تدرّبت على دورة حياة الحادث كاملة: الكشف → التحليل → الاحتواء → استخراج الأدلة — داخل بيئة آمنة بالكامل.",
      en: "You practised the full incident lifecycle: detect → analyse → contain → extract evidence — all inside a completely safe environment."
    }
  },
  redteam: {
    status: "live", level: "advanced",
    name: { ar: "المختبر الهجومي (Bash + SQL + NetLab)", en: "Offensive Lab (Bash + SQL + NetLab)" },
    objective: {
      ar: "نفّذ الهجمات في بيئة آمنة لتفهم كيف تعمل وكيف تُمنع: طرفية Bash، قاعدة بيانات قابلة للحقن، وبناء حزم TCP/UDP.",
      en: "Run attacks in a safe environment to understand how they work and how they are prevented: a Bash terminal, an injectable database, and TCP/UDP packet building."
    },
    skills: [
      { ar: "أوامر Bash واستكشاف نظام ملفات افتراضي", en: "Bash commands and virtual filesystem exploration" },
      { ar: "حقن SQL مقابل الاستعلامات المُعلَّمة", en: "SQL injection vs. parameterized queries" },
      { ar: "حساب المجاميع الاختبارية وبناء الحزم", en: "Checksum computation and packet crafting" }
    ],
    hints: [
      { ar: "استعلم عن الجدول أولًا: SELECT * FROM students;", en: "Query the table first: SELECT * FROM students;" },
      { ar: "جرّب ' OR 1=1 -- ثم قارن سلوكه مع الاستعلام المُعلَّم الآمن.", en: "Try ' OR 1=1 -- then compare it with the safe parameterized query." }
    ],
    explanation: {
      ar: "فهمت كيف يحوّل الحقنُ استعلامًا إلى أمر، ولماذا يمنعه الربطُ بالمعاملات — ومعرفة الهجوم هي أساس الدفاع.",
      en: "You saw how injection turns a query into a command and why parameterization prevents it — knowing the attack is the basis of defence."
    }
  },
  ir: {
    status: "live", level: "advanced",
    name: { ar: "مركز الاستجابة للحوادث", en: "Incident Response Center" },
    objective: {
      ar: "قُد الاستجابة كاملة: اقرأ لوحة SIEM، ابنِ الخط الزمني (kill-chain)، وأجرِ محاكاة حية، وحلّل السبب الجذري.",
      en: "Lead the full response: read the SIEM dashboard, build the kill-chain timeline, run the live simulation and analyse root cause."
    },
    skills: [
      { ar: "الاستعلام عن أحداث SIEM وترشيحها", en: "Querying and filtering SIEM events" },
      { ar: "ربط الأحداث بمراحل سلسلة الهجوم", en: "Mapping events to kill-chain stages" },
      { ar: "قرار الاحتواء وتحليل السبب الجذري", en: "Containment decisions and root-cause analysis" }
    ],
    hints: [
      { ar: "ابدأ بأعلى خطورة في لوحة SIEM ثم وسّع النطاق زمنيًا.", en: "Start with the highest severity in the SIEM, then widen the time window." },
      { ar: "اربط كل حدث بمرحلة من مراحل الهجوم قبل أن تحكم على الحملة.", en: "Map each event to an attack stage before judging the campaign." }
    ],
    explanation: {
      ar: "تدرّبت على ترتيب الأدلة زمنيًا، وربط الأحداث المتفرقة بحملة واحدة، واختيار إجراء الاحتواء الصحيح.",
      en: "You practised ordering evidence in time, linking scattered events into one campaign, and choosing the right containment action."
    }
  },
  cryptolab: {
    status: "live", level: "intermediate",
    name: { ar: "مختبر التشفير التفاعلي", en: "Interactive Cryptography Lab" },
    objective: {
      ar: "شاهد خوارزميات التشفير تعمل خطوة بخطوة: Vigenère، Enigma، RSA، دورة DES، تحليل التردد، وتصادم التجزئة.",
      en: "Watch cryptographic algorithms work step-by-step: Vigenère, Enigma, RSA, the first DES round, frequency analysis and a hash-collision demo."
    },
    skills: [
      { ar: "تحليل الترددات على النصوص الكلاسيكية", en: "Frequency analysis on classical texts" },
      { ar: "توسيع مفاتيح RSA (p·q → φ → e → d)", en: "RSA key derivation (p·q → φ → e → d)" },
      { ar: "لماذا تفشل الشفرات الكلاسيكية", en: "Why classical ciphers fail" }
    ],
    hints: [
      { ar: "ابدأ بتحليل التردد على نص إنجليزي طويل — الحروف الشائعة تكشف الشفرة.", en: "Start frequency analysis on a long English text — common letters expose the cipher." },
      { ar: "في RSA اتبع الخطوات بالترتيب: اختر p و q، احسب φ، ثم e، ثم d.", en: "In RSA follow the order: pick p and q, compute φ, then e, then d." }
    ],
    explanation: {
      ar: "اربطت بين الضعف الرياضي وسلوك الشفرة عمليًا — وهكذا تُقيَّم الخوارزميات الحديثة قبل الاعتماد عليها.",
      en: "You connected the mathematical weakness to the cipher's real behaviour — exactly how modern algorithms are evaluated before being trusted."
    }
  }
};

(function initToolsEdu() {
  "use strict";

  var escT = function (s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m];
    });
  };
  var cur = function () { return (typeof Lang !== "undefined" && Lang.current) || "ar"; };
  var tx = function (o) { if (!o) return ""; var l = cur(); return (o[l] != null) ? o[l] : (o.ar || ""); };

  /* ---------- snapshots so Reset restores tools honestly ---------- */
  var snaps = {};
  function snapCard(card) {
    var s = [];
    var els = card.querySelectorAll("[id]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], rec = { el: el };
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") { rec.k = "v"; rec.v = el.value; }
      else if (el.tagName === "SELECT") { rec.k = "s"; rec.v = el.selectedIndex; }
      else if (el.classList.contains("pw-meter-fill")) { rec.k = "st"; rec.v = el.style.cssText; }
      else { rec.k = "h"; rec.v = el.innerHTML; rec.hid = el.hidden; }
      s.push(rec);
    }
    return s;
  }
  function fireEvents(el) {
    try {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (e) { /* older engines */ }
  }
  function restoreCard(id) {
    var s = snaps[id];
    if (!s) return;
    s.forEach(function (r) {
      if (r.k === "v") { r.el.value = r.v; fireEvents(r.el); }
      else if (r.k === "s") { r.el.selectedIndex = r.v; fireEvents(r.el); }
      else if (r.k === "st") { r.el.style.cssText = r.v; }
      else { r.el.innerHTML = r.v; if (r.hid) r.el.hidden = true; }
    });
  }
  function applyExample(id) {
    var meta = TOOLS_META[id];
    if (!meta || !meta.example) return;
    (meta.example.fill || []).forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el) return;
      el.value = f.value;
      fireEvents(el);
    });
    if (meta.example.click) {
      var b = document.getElementById(meta.example.click);
      if (b) b.click();
    }
  }
  function copyOut(targetId, btn) {
    var el = document.getElementById(targetId);
    var text = el ? (el.textContent || "") : "";
    if (!text || text === "\u2014") return;
    var done = function () {
      var old = btn.textContent;
      btn.textContent = Lang.t("toolsEdu.copied");
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {});
    } else {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (e) { /* clipboard unavailable */ }
    }
  }


  /* ---------- builders ---------- */
  function toolEduHtml(id) {
    var meta = TOOLS_META[id];
    if (!meta) return "";
    var l = cur();
    var complement = (l === "ar") ? meta.name.en : meta.name.ar;
    var complementDir = (l === "ar") ? ' dir="ltr"' : "";
    var chips =
      '<a class="path-chip" href="#path/' + escT(meta.path) + '">' + escT(Lang.t("toolsEdu.pathChip")) + ": " + escT(meta.path) + "</a>" +
      (meta.lesson ? '<a class="path-chip is-lesson" href="#lesson/' + escT(meta.lesson) + '">' + escT(Lang.t("toolsEdu.lessonChip")) + "</a>" : "") +
      (meta.quiz ? '<a class="path-chip" href="#quiz" data-quiz-jump="' + escT(meta.quiz) + '">' + escT(Lang.t("toolsEdu.quizChip")) + "</a>" : "");
    var btns =
      '<button type="button" class="btn btn-sm btn-ghost" data-tool-example="' + escT(id) + '">' + escT(Lang.t("toolsEdu.tryExample")) + "</button>" +
      '<button type="button" class="btn btn-sm btn-ghost" data-tool-reset="' + escT(id) + '">' + escT(Lang.t("toolsEdu.reset")) + "</button>" +
      (meta.copy ? '<button type="button" class="btn btn-sm btn-ghost copy-btn" data-tool-copy="' + escT(meta.copy) + '">' + escT(Lang.t("toolsEdu.copy")) + "</button>" : "");
    return '<div class="tool-edu">' +
      '<div class="tool-edu-row"><span class="tool-edu-name"><b>' + escT(Lang.t("toolsEdu.name")) + ':</b><span' + complementDir + ' class="tool-en-name">' + escT(complement) + "</span></span>" +
      '<span class="path-level is-' + escT(meta.level) + '">' + escT(Lang.t("paths.level." + meta.level)) + "</span></div>" +
      '<p class="tool-edu-purpose"><b>' + escT(Lang.t("toolsEdu.purpose")) + ":</b> " + escT(tx(meta.purpose)) + "</p>" +
      '<p class="tool-edu-safety"><b>' + escT(Lang.t("toolsEdu.safety")) + ":</b> " + escT(tx(meta.safety)) + "</p>" +
      '<div class="tool-edu-actions">' + btns + "</div>" +
      '<div class="tool-edu-chips"><span class="tool-edu-related">' + escT(Lang.t("toolsEdu.related")) + ":</span>" + chips + "</div>" +
      "</div>";
  }
  function labPanelHtml(view) {
    var meta = LABS_META[view];
    if (!meta) return "";
    var done = !!labsStore().done[view];
    var skills = meta.skills.map(function (s) { return "<li>" + escT(tx(s)) + "</li>"; }).join("");
    var hints = meta.hints.map(function (h) { return "<li>" + escT(tx(h)) + "</li>"; }).join("");
    return '<div class="lab-meta' + (done ? " is-done" : "") + '">' +
      '<div class="tool-edu-row"><span class="tool-edu-name"><b>' + escT(meta.name[cur()]) + "</b></span>" +
      '<span class="path-level is-' + escT(meta.level) + '">' + escT(Lang.t("paths.level." + meta.level)) + "</span>" +
      (done ? '<span class="lab-done-badge">' + escT(Lang.t("labs.completed")) + "</span>" : "") +
      "</div>" +
      '<p class="tool-edu-purpose"><b>' + escT(Lang.t("labs.objective")) + ":</b> " + escT(tx(meta.objective)) + "</p>" +
      '<div class="lab-meta-skills"><b>' + escT(Lang.t("labs.skills")) + ":</b><ul>" + skills + "</ul></div>" +
      '<details class="lab-meta-hints"><summary>' + escT(Lang.t("labs.hints")) + "</summary><ul>" + hints + "</ul></details>" +
      (done ? '<div class="lab-meta-explain"><b>' + escT(Lang.t("labs.explainTitle")) + ":</b> " + escT(tx(meta.explanation)) + "</div>" : "") +
      '<div class="lab-meta-actions"><button type="button" class="btn btn-sm ' + (done ? "btn-ghost" : "btn-primary") + '" data-lab-done="' + escT(view) + '" aria-pressed="' + done + '">' +
      escT(Lang.t(done ? "labs.markUndone" : "labs.markDone")) + "</button></div>" +
      '<p class="lab-responsible">' + escT(Lang.t("labs.responsibleUse")) + "</p>" +
      "</div>";
  }


  /* ---------- labs completion store (honest manual tracking) ---------- */
  function labsStore() {
    var v = Store.get("labs", null);
    if (v && typeof v === "object" && v.done && typeof v.done === "object") return v;
    return { v: 1, done: {} };
  }
  function renderLabPanels() {
    Object.keys(LABS_META).forEach(function (view) {
      var m = $id("labMeta-" + view);
      if (m) m.innerHTML = labPanelHtml(view);
    });
  }
  function renderToolEdu() {
    if (!document.querySelectorAll) return;
    var cards = document.querySelectorAll(".tool-card");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var id = card.id;
      if (!id || !TOOLS_META[id]) continue;
      var old = card.querySelector(".tool-edu");
      if (old) old.parentNode.removeChild(old);
      if (!snaps[id]) snaps[id] = snapCard(card);
      var title = card.querySelector(".tool-title");
      var html = toolEduHtml(id);
      if (title) title.insertAdjacentHTML("afterend", html);
      else card.insertAdjacentHTML("afterbegin", html);
    }
    var notice = document.querySelector(".tool-safety-notice");
    if (notice) notice.textContent = Lang.t("toolsEdu.notice");
  }
  function renderNotice() {
    var toolsSec = $id("tools");
    if (!toolsSec) return;
    var grid = toolsSec.querySelector(".tools-grid");
    if (!grid || grid.parentNode.querySelector(".tool-safety-notice")) return;
    var notice = document.createElement("p");
    notice.className = "tool-safety-notice reveal";
    notice.setAttribute("role", "note");
    notice.textContent = Lang.t("toolsEdu.notice");
    grid.parentNode.insertBefore(notice, grid);
  }

  /* ---------- events (delegated — works for re-rendered content) ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var ex = t.closest("[data-tool-example]");
    if (ex) { applyExample(ex.getAttribute("data-tool-example")); return; }
    var rs = t.closest("[data-tool-reset]");
    if (rs) {
      var id = rs.getAttribute("data-tool-reset");
      restoreCard(id);
      var card = document.getElementById(id);
      if (card && typeof CustomEvent === "function") {
        card.dispatchEvent(new CustomEvent("nova:tool-reset", { bubbles: true, detail: { id: id } }));
      }
      return;
    }
    var cp = t.closest("[data-tool-copy]");
    if (cp) copyOut(cp.getAttribute("data-tool-copy"), cp);
    var lab = t.closest("[data-lab-done]");
    if (lab) {
      var view = lab.getAttribute("data-lab-done");
      var st = labsStore();
      if (st.done[view]) {
        delete st.done[view];
      } else {
        st.done[view] = true;
        /* Award only on the genuine "mark complete" transition. */
        awardMotivation("lab", view);
      }
      Store.set("labs", st);
      renderLabPanels();
    }
  });

  /* ---------- lifecycle ---------- */
  renderNotice();
  renderToolEdu();
  renderLabPanels();
  if (typeof Lang !== "undefined" && Lang.onSwitch) {
    Lang.onSwitch(function () {
      renderToolEdu();
      renderLabPanels();
    });
  }
})();

/* @@TOOLS_D@@ */
})();
})();

/* ============================================================
   MODULE 43 · SemesterDashboard — لوحة الترم الحالي (#semester)
   ------------------------------------------------------------
   Renders the real Current Semester dashboard view from
   window.PLATFORM_CURRENT_SEMESTER (current-semester.js) — the
   single source of curriculum truth. No data duplicated here.
   - Summary: semester title, program name, description, subject
     count and total credit hours (computed from the data).
   - One card per official subject: name, course code, credit
     hours, day/time schedule, difficulty, estimated study hours,
     short description, prerequisites, learning outcomes, common
     mistakes, key terms, and links to EXISTING platform assets
     only (quiz banks via the data-quiz-jump flow, tool cards via
     data-tool-jump, lab views) — no fake links.
   - Honest empty states: no lessons → «سيتم إضافة الدروس
     قريبًا» (never invented); empty prerequisites → explicit
     empty note; missing quiz/tool/lab entries are simply not
     rendered. Missing data object → honest status message.
   - Re-renders on locale switch (Lang.onSwitch). Arabic and
     English text each render from their own field — never mixed.
   ============================================================ */
(function initSemesterDashboard() {
  "use strict";
  const grid = document.getElementById("semesterGrid");
  const metaMount = document.getElementById("semesterMeta");
  if (!grid || !metaMount) return;

  /* --- Locale helper resolution (MODULE 43) ---
     This module sits OUTSIDE the main IIFE (which closes around line 7477),
     so it cannot see the IIFE-internal `const Lang` or `escHtml`. Resolution
     order — in-scope identifier → window bridge (window.Lang, set by
     MODULE 22) → honest no-op fallback that never emits dot-notation keys.
     NOTE: the fallback `t()` below deliberately avoids returning the raw
     key: it renders an empty string instead so a missing translation can
     never leak "semester.program"-style text into the UI. */

  /**
   * Resolve the real Lang helper when reachable.
   * @returns {{current:string,t:function,qt:function,onSwitch:function}|null}
   */
  function resolveLang() {
    try {
      if (typeof Lang !== "undefined" && Lang) return Lang; // classic same-scope load
    } catch (e) { /* TDZ/unreachable — fall through to the bridge */ }
    try {
      if (typeof window !== "undefined" && window.Lang) return window.Lang;
    } catch (e2) { /* unreachable — fall through to the fallback */ }
    return null;
  }

  const L10N = resolveLang();
  const cur = (L10N && L10N.current) || "ar";

  /**
   * Translation lookup with proper fallbacks (never returns the raw key).
   * @param {string} key Dictionary key.
   * @param {Object=} params {slot} substitutions.
   * @returns {string} Translated text (or "" when truly unknown).
   */
  function T10(key, params) {
    let s = "";
    try { s = L10N ? L10N.t(key, params) : ""; } catch (e) { s = ""; }
    /* L10N.t() itself falls back to the key when the dictionary misses —
       swallow that case too so raw keys never reach the DOM. */
    if (!s || s === key) return "";
    return s;
  }

  /* Local escHtml — this module cannot see the IIFE-internal helper either. */
  const escHtmlL = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  const DATA = window.PLATFORM_CURRENT_SEMESTER;
  if (!DATA || !Array.isArray(DATA.subjects)) {
    /* Data source absent — say so instead of rendering nothing. */
    metaMount.innerHTML = '<p class="sem-empty" role="status">' +
      escHtmlL(T10("semester.missingData", null, "…")) + "</p>";
    return;
  }

  /** Escape HTML-significant characters. @param {unknown} v @returns {string} */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  /**
   * Pick the active-locale string from a bilingual { ar, en } field.
   * Arabic and English never mix: each language renders its own text.
   * @param {{ar?:string, en?:string}|string} field @returns {string}
   */
  function T(field) {
    if (field == null) return "";
    if (typeof field !== "object") return String(field);
    const v = (field[cur] != null) ? field[cur] : (field.ar != null ? field.ar : field.en);
    return v == null ? "" : String(v);
  }

  /** Bilingual item label (t/title/name/term or plain field). @param {object} item @returns {string} */
  function TT(item) {
    if (!item || typeof item !== "object") return "";
    return T(item.t || item.title || item.name || item.term || item);
  }

  /**
   * Human label for a related tool card. Uses TOOLS_META names when
   * reachable (same-file registry), otherwise the live tool-card title
   * in the DOM. Never invents a tool that does not exist.
   * @param {string} id Tool-card id (e.g. "tool-hash"). @returns {string}
   */
  function toolLabel(id) {
    try {
      if (typeof TOOLS_META !== "undefined" && TOOLS_META[id] && TOOLS_META[id].t) {
        const n = T(TOOLS_META[id].t);
        if (n) return n;
      }
    } catch (e) { /* different scope — fall through to the DOM */ }
    const card = document.getElementById(id);
    const h3 = card && card.querySelector(".tool-title");
    return h3 ? h3.textContent.trim() : id;
  }

  /** Guard so unknown tool ids never render a dead chip. @param {string} id @returns {boolean} */
  function toolLabelIsKnown(id) {
    try {
      if (typeof TOOLS_META !== "undefined" && TOOLS_META[id]) return true;
    } catch (e) { /* scope guard */ }
    const card = document.getElementById(id);
    return !!(card && card.querySelector(".tool-title"));
  }

  /** Question-bank count for a quiz key (0 when unknown). @param {string} k @returns {number} */
  function quizCount(k) {
    try {
      const BANK = WL.QUIZZES || {};
      if (BANK[k] && BANK[k].questions) return BANK[k].questions.length;
    } catch (e) { /* ignore — count is cosmetic */ }
    return 0;
  }

  /* ---------- summary ---------- */

  function renderSummary() {
    const credits = DATA.subjects.reduce((sum, s) => {
      const c = s.meta && s.meta.creditHours;
      return sum + (typeof c === "number" ? c : 0);
    }, 0);
    metaMount.innerHTML =
      '<div class="sem-sum">' +
      '<div class="sem-sum-main">' +
      '<h3 class="sem-sum-title">' + esc(T(DATA.title)) + "</h3>" +
      '<p class="sem-sum-program"><span>' + escHtmlL(T10("semester.program")) +
      "</span> — " + esc(T(DATA.meta && DATA.meta.program)) + "</p>" +
      '<p class="sem-sum-desc">' + esc(T(DATA.description)) + "</p>" +
      "</div>" +
      '<dl class="sem-sum-stats">' +
      "<div class=\"sem-stat\"><dt>" + escHtmlL(T10("semester.subjectsCount")) + "</dt><dd>" +
      DATA.subjects.length + "</dd></div>" +
      "<div class=\"sem-stat\"><dt>" + escHtmlL(T10("semester.credits")) + "</dt><dd>" +
      credits + "</dd></div>" +
      "</dl></div>";
  }

  /* ---------- subject cards ---------- */

  /** <details> block for a labeled list. @param {string} i18nKey @param {string[]} items @returns {string} */
  function detailsList(i18nKey, items) {
    const lis = items.map((x) => "<li>" + x + "</li>").join("");
    return (
      '<details class="sem-details"><summary>' + escHtmlL(T10(i18nKey)) +
      ' <span class="sem-count">' + items.length + "</span></summary>" +
      '<ul class="sem-list">' + lis + "</ul></details>"
    );
  }

  /** Prerequisites — empty state is explicit, never hidden silently. @param {object} s @returns {string} */
  function prereqHtml(s) {
    const items = (Array.isArray(s.prerequisites) ? s.prerequisites : [])
      .map((p) => esc(TT(p) || String(p))).filter(Boolean);
    if (!items.length) {
      return '<div class="sem-lessons"><p class="sem-empty">' +
        escHtmlL(T10("semester.prerequisitesNone")) + "</p></div>";
    }
    return detailsList("semester.prerequisites", items);
  }

  /** Lesson items — rendered only if the data really has them. @param {object} s @returns {string} */
  function lessonsHtml(s) {
    const lessons = Array.isArray(s.lessons) ? s.lessons : [];
    if (!lessons.length) {
      return '<div class="sem-lessons"><p class="sem-empty">' +
        escHtmlL(T10("semester.lessonsSoon")) + "</p></div>";
    }
    return detailsList("semester.lessons", lessons.map((l) => esc(TT(l))).filter(Boolean));
  }

  /** Links to EXISTING quiz banks / tool cards / lab views (or ""). @param {object} s @returns {string} */
  function linksHtml(s) {
    let html = "";
    (Array.isArray(s.quizzes) ? s.quizzes : []).forEach((k) => {
      const n = quizCount(k);
      html += '<a class="path-chip is-quiz" href="#quiz" data-quiz-jump="' + esc(k) + '">' +
        escHtmlL(T10("semester.quizChip")) +
        (n ? ' <b class="path-chip-n">' + n + "</b>" : "") + "</a>";
    });
    (Array.isArray(s.relatedTools) ? s.relatedTools : []).forEach((id) => {
      if (!toolLabelIsKnown(id)) return; /* no fake links */
      html += '<a class="path-chip is-tool" href="#tools" data-tool-jump="' + esc(id) + '"' +
        ' aria-label="' + escHtmlL(T10("semester.tools")) + ": " + esc(toolLabel(id)) + '">' +
        esc(toolLabel(id)) + "</a>";
    });
    (Array.isArray(s.relatedLabs) ? s.relatedLabs : []).forEach((view) => {
      if (!document.getElementById(view)) return; /* no fake links */
      html += '<a class="path-chip is-lab" href="#' + esc(view) + '">' +
        escHtmlL(T10("nav." + view)) + "</a>";
    });
    return html;
  }

  function scheduleHtml(s) {
    const sch = s.meta && s.meta.schedule;
    if (!sch) return "";
    const day = T(sch.day);
    return day ? day + " · " + esc(sch.startTime) + " – " + esc(sch.endTime) : "";
  }

  function cardHtml(s) {
    const meta = s.meta || {};
    const hue = meta.hue || 260;
    const diffKey = "paths.level." + (s.difficulty || "");
    const diffRaw = T10(diffKey);
    const diffLabel = diffRaw ? esc(diffRaw) : esc(s.difficulty || "");
    const icon = meta.icon || "images/icon-maskable.svg";
    const schedule = scheduleHtml(s);

    return (
      '<article class="work-card sem-card" style="--hue: ' + hue + '">' +
      '<div class="work-card-inner">' +
      '<div class="work-thumb" style="--hue: ' + hue + '">' +
      '<img class="thumb-img" src="' + esc(icon) + '" alt="' + esc(T(s.name)) + '"' +
      ' onerror="this.onerror=null;this.src=\'images/icon-maskable.svg\'" width="800" height="600" loading="lazy" decoding="async" /></div>' +
      '<div class="sem-body">' +
      '<header class="sem-head">' +
      "<h3>" + esc(T(s.name)) + "</h3>" +
      '<p class="sem-code" dir="ltr">' + escHtmlL(T10("semester.code")) + ": " + esc(s.code || s.id) + "</p>" +
      "</header>" +
      '<ul class="sem-meta">' +
      '<li class="sem-chip is-credit"><b>' + (meta.creditHours == null ? "—" : meta.creditHours) + "</b> " + escHtmlL(T10("semester.creditHours")) + "</li>" +
      (s.difficulty ? '<li class="sem-chip is-diff is-' + esc(s.difficulty) + '">' + diffLabel + "</li>" : "") +
      (s.estimatedHours ? '<li class="sem-chip is-hours"><b>' + s.estimatedHours + "</b> " + escHtmlL(T10("semester.estHours")) + "</li>" : "") +
      (schedule ? '<li class="sem-chip is-sched">🗓 ' + schedule + "</li>" : "") +
      "</ul>" +
      '<p class="sem-desc">' + esc(T(s.shortDescription)) + "</p>" +
      '<div class="sem-blocks">' + prereqHtml(s) +
      (Array.isArray(s.learningOutcomes) && s.learningOutcomes.length
        ? detailsList("semester.outcomes", s.learningOutcomes.map((o) => esc(T(o))))
        : "") +
      (Array.isArray(s.commonMistakes) && s.commonMistakes.length
        ? detailsList("semester.mistakes", s.commonMistakes.map((m) => esc(T(m))))
        : "") +
      (Array.isArray(s.keyTerms) && s.keyTerms.length
        ? detailsList("semester.terms", s.keyTerms.map((t) => esc(TT(t))))
        : "") +
      lessonsHtml(s) +
      "</div>" +
      '<nav class="sem-links" aria-label="' + esc(T(s.name)) + '">' + linksHtml(s) + "</nav>" +
      "</div></div></article>"
    );
  }

  function render() {
    renderSummary();
    grid.innerHTML = DATA.subjects.map(cardHtml).join("");
  }

  render();
  /* Live locale switching — resolved via the bridge so both the classic
     same-scope load and the isolated/eval load re-render correctly. */
  try {
    const LS = resolveLang();
    if (LS && typeof LS.onSwitch === "function") LS.onSwitch(render);
  } catch (e) { /* locale switching is enhancement, never fatal */ }

  /* Question-bank counts paint asynchronously (fetch/cache/fallback).
     MODULE 13's loadQuizData dispatches "nova:progress-changed" when the
     bank arrives — re-render only if a visible count actually changed,
     so user-opened <details> blocks are not reset needlessly. */
  let lastQuizCounts = "";
  document.addEventListener("nova:progress-changed", () => {
    const counts = (Array.isArray(DATA.subjects) ? DATA.subjects : [])
      .map((s) => (Array.isArray(s.quizzes) ? s.quizzes : []).map(quizCount).join(",")).join("|");
    if (counts !== lastQuizCounts) {
      lastQuizCounts = counts;
      render();
    }
  });
})();

/* ============================================================
   MODULE 47 · HeroDash — لوحة الطالب (#heroDash · Phase 1)
   ------------------------------------------------------------
   Personal, strictly READ-ONLY student command center: welcome
   state, overall progress, current learning path, next learning
   step, unfinished quizzes/labs and a Continue-Learning shortcut.
   Every value is derived from data the platform already owns —
   nothing is duplicated or invented:
   - overall %  → the SAME formula as the Progress hub (mean of
     the saved best scores), so the two views can never disagree.
   - path progress → manual checks plus quiz-linked completion,
     matching MODULE 39's rule.
   - next learning step → the next real topic in the current path;
     if no authored lesson exists, the UI says so honestly.
   - unfinished work → real question banks without results plus
     path-referenced labs not marked complete.
   - last lesson → "motmi-portal:lessons.last", resolved through
     real learning-path data (never a fake title).
   - next quiz  → the first subject bank with no saved result,
     otherwise the lowest-scoring one (name from the registry).
   This module lives OUTSIDE the main IIFE, so every access goes
   through the window bridges published there (Lang, QUIZZES,
   readStore, startQuiz, getLearningPaths, SUBJECT_TO_PATH,
   PLATFORM_STORE, PLATFORM_SUBJECTS, NovaViews) — the same
   pattern as MODULE 43.
   ============================================================ */
(function initHeroDash() {
  "use strict";
  const pctEl = document.getElementById("heroDashPct");
  const barEl = document.getElementById("heroDashBar");
  const meterEl = document.getElementById("heroDashOverallMeter");
  const lessonEl = document.getElementById("heroDashLesson");
  const quizEl = document.getElementById("heroDashQuiz");
  const ctaEl = document.getElementById("heroDashContinue");
  const titleEl = document.getElementById("heroDashTitle");
  const welcomeEl = document.getElementById("heroDashWelcome");
  const pathEl = document.getElementById("heroDashPath");
  const pathMetaEl = document.getElementById("heroDashPathMeta");
  const pathBarEl = document.getElementById("heroDashPathBar");
  const pathMeterEl = document.getElementById("heroDashPathMeter");
  const pathLinkEl = document.getElementById("heroDashPathLink");
  const lessonMetaEl = document.getElementById("heroDashLessonMeta");
  const tasksEl = document.getElementById("heroDashTasks");
  const tasksMetaEl = document.getElementById("heroDashTasksMeta");
  const lastEl = document.getElementById("heroDashLast");
  const emptyEl = document.getElementById("heroDashEmpty");
  if (!pctEl || !lessonEl || !quizEl) return;

  /* ---------- locale + storage helpers (outside the IIFE) ---------- */

  /** Current locale code. @returns {"ar"|"en"|string} */
  function locale() { return (L10N && L10N.current) || "ar"; }
  /** Localized side of a bilingual field. @param {*} v Field. @returns {string} */
  function bi(v) {
    if (!v) return "";
    if (typeof v !== "object") return String(v);
    return v[locale()] || v.ar || v.en || "";
  }
  /** Safe text paint. @param {HTMLElement|null} el Target. @param {string} text Text. @returns {void} */
  function setText(el, text) { if (el) el.textContent = text || "—"; }

  /** Live learning paths exposed by MODULE 39. @returns {Array} */
  function pathData() {
    try { return (typeof window.getLearningPaths === "function") ? (window.getLearningPaths() || []) : []; }
    catch (e) { return []; }
  }

  /**
   * Progress for one path using the same rule as MODULE 39: a quiz-linked
   * topic is complete after a saved result; other topics use manual checks.
   * @param {Object} p Path record.
   * @param {Object} results Quiz results.
   * @param {Object} doneMap Manual topic map.
   * @returns {{path:Object,total:number,done:number,pct:number,next:Object|null}}
   */
  function pathSnapshot(p, results, doneMap) {
    const topics = Array.isArray(p.topics) ? p.topics.filter((t) => t && t.id) : [];
    let done = 0, next = null;
    topics.forEach((t) => {
      const auto = !!(t.res && t.res.k === "quiz" && results && results[t.res.key]);
      const manual = !!(doneMap && doneMap[p.id] && doneMap[p.id][t.id] === true);
      if (auto || manual) done++;
      else if (!next) next = t;
    });
    const pct = topics.length ? Math.round((done / topics.length) * 100) : 0;
    return { path: p, total: topics.length, done, pct, next };
  }

  /** Snapshots of live paths in authored order. @param {Object} results @returns {Array} */
  function pathSnapshots(results) {
    const stored = storeGet("paths");
    const doneMap = stored && typeof stored.done === "object" && stored.done ? stored.done : {};
    return pathData()
      .filter((p) => p && p.id && p.status !== "soon")
      .map((p) => pathSnapshot(p, results, doneMap));
  }

  /**
   * Pick the current path: owning path of the last opened lesson first,
   * then the first started/incomplete path, then the recommended starter.
   * @param {Array} snaps Path snapshots.
   * @returns {Object|null} Current snapshot.
   */
  function currentPathSnapshot(snaps) {
    if (!snaps.length) return null;
    const st = storeGet("lessons");
    const last = st && st.last ? st.last : null;
    if (last && last.sub) {
      const owner = (window.SUBJECT_TO_PATH || {})[last.sub];
      const owned = snaps.filter((s) => s.path.id === owner)[0];
      if (owned) return owned;
    }
    return snaps.filter((s) => s.done > 0 && s.done < s.total)[0] ||
      snaps.filter((s) => s.path.recommended)[0] || snaps[0];
  }

  /** Lab IDs referenced by real path resources. @returns {string[]} */
  function pathLabIds() {
    const ids = [];
    pathData().forEach((p) => {
      if (!p || p.status === "soon") return;
      const rows = (Array.isArray(p.topics) ? p.topics.map((t) => t && t.res) : [])
        .concat(Array.isArray(p.related) ? p.related : []);
      rows.forEach((r) => { if (r && r.k === "lab" && r.view && ids.indexOf(r.view) < 0) ids.push(r.view); });
    });
    return ids;
  }

  /** Localized lab name from the existing dictionary. @param {string} id @returns {string} */
  function labLabel(id) {
    const key = id === "cryptolab" ? "labs.crypto" : "labs." + id;
    return T(key) || id;
  }

  /** Any real local learning activity? Used only to choose welcome/empty copy. */
  function hasActivity(store, snaps) {
    const qb = banks();
    const lessons = storeGet("lessons");
    const labs = storeGet("labs");
    const flash = storeGet("flash");
    return Object.keys(store.results || {}).some((k) => qb[k]) ||
      Object.keys(store.progress || {}).some((k) => qb[k]) ||
      snaps.some((s) => s.done > 0) ||
      !!(lessons && lessons.done && Object.keys(lessons.done).length) ||
      !!(labs && labs.done && Object.keys(labs.done).length) ||
      !!(flash && flash.reviewed && Object.keys(flash.reviewed).length);
  }


  function resolveLang() {
    try { if (typeof Lang !== "undefined" && Lang) return Lang; } catch (e) { /* TDZ */ }
    try { if (typeof window !== "undefined" && window.Lang) return window.Lang; } catch (e2) { /* unreachable */ }
    return null;
  }
  const L10N = resolveLang();

  /**
   * Translation that never leaks a raw key into the dashboard.
   * @param {string} key Dictionary key.
   * @param {Object=} params Slot values.
   * @returns {string} Localized text, or "" when unknown.
   */
  function T(key, params) {
    let s = "";
    try { s = L10N ? L10N.t(key, params) : ""; } catch (e) { s = ""; }
    return (!s || s === key) ? "" : s;
  }

  /**
   * Read a namespaced value (Store bridge, then a direct localStorage read).
   * @param {string} key Store key.
   * @returns {*} Value or null.
   */
  function storeGet(key) {
    try {
      const S = window.PLATFORM_STORE;
      if (S && typeof S.get === "function") return S.get(key, null);
    } catch (e) { /* fall through to localStorage */ }
    try { const raw = localStorage.getItem("motmi-portal:" + key); return raw ? JSON.parse(raw) : null; } catch (e2) { return null; }
  }

  /** @returns {Object} The subject question banks (possibly still empty). */
  function banks() {
    try { return (window.QUIZZES && typeof window.QUIZZES === "object") ? window.QUIZZES : {}; } catch (e) { return {}; }
  }

  /** @returns {{results:Object,progress:Object}} Saved quiz store snapshot. */
  function saved() {
    try { return (typeof window.readStore === "function") ? (window.readStore() || {}) : {}; } catch (e) { return {}; }
  }

  /**
   * Mean of the saved best scores — identical to the Progress hub's
   * "Overall" figure so both views always agree.
   * @param {Object} results Saved results map.
   * @param {Object} qb Question banks.
   * @returns {number} Overall percentage (integer).
   */
  function overallPct(results, qb) {
    const keys = Object.keys(results || {}).filter((k) => qb[k]);
    if (!keys.length) return 0;
    const vals = keys.map((k) => {
      const r = results[k] || {};
      const qs = (qb[k] && qb[k].questions) ? qb[k].questions.length : 0;
      return typeof r.pct === "number" ? r.pct : (qs ? Math.round(((r.score || 0) / qs) * 100) : 0);
    });
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  /**
   * Resumable subject key (mid-quiz session), else "".
   * @param {Object} progress Saved progress map.
   * @param {Object} qb Question banks.
   * @returns {string} Subject key or "".
   */
  function resumeKey(progress, qb) {
    const keys = Object.keys(progress || {}).filter((k) => {
      const p = progress[k];
      return qb[k] && p && typeof p.idx === "number" && p.idx > 0 &&
        p.idx < (qb[k].questions || []).length;
    });
    return keys[0] || "";
  }

  /**
   * Next recommended quiz: an un-attempted bank first, otherwise the
   * lowest saved score.
   * @param {Object} results Saved results map.
   * @param {Object} qb Question banks.
   * @returns {string} Subject key or "" when no bank is available.
   */
  function nextQuizKey(results, qb) {
    const keys = Object.keys(qb).filter((k) => qb[k] && Array.isArray(qb[k].questions) && qb[k].questions.length);
    if (!keys.length) return "";
    const fresh = keys.filter((k) => !results[k]);
    if (fresh.length) return fresh[0];
    let worst = "", worstPct = 101;
    keys.forEach((k) => {
      const qs = qb[k].questions.length;
      const r = results[k] || {};
      const pct = typeof r.pct === "number" ? r.pct : (qs ? Math.round(((r.score || 0) / qs) * 100) : 0);
      if (pct < worstPct) { worstPct = pct; worst = k; }
    });
    return worst;
  }

  /**
   * Display name for a bank: the official subject name when the registry
   * knows it (EN when one is authored, else Arabic), else the bank name.
   * @param {string} key Subject key / course code.
   * @returns {string} Human-readable subject label.
   */
  function bankLabel(key) {
    try {
      const reg = window.PLATFORM_SUBJECTS;
      if (Array.isArray(reg)) {
        const s = reg.filter((x) => x && (x.quizKey === key || x.id === key))[0];
        if (s) {
          const en = (s.nameEn && L10N && L10N.current === "en") ? s.nameEn : "";
          return en || s.nameAr || key;
        }
      }
    } catch (e) { /* registry unavailable — fall back to the bank name */ }
    const b = banks()[key];
    return (b && b.name) || key;
  }

  /**
   * Title of the last opened lesson, resolved from the real learning-path
   * topic that links to it (never invented).
   * @returns {string} Localized lesson title or "" when unresolvable.
   */
  function lastLessonLabel() {
    const st = storeGet("lessons");
    const last = st && st.last ? st.last : null;
    if (!last || !last.sub || !last.topic) return "";
    try {
      const paths = (typeof window.getLearningPaths === "function") ? (window.getLearningPaths() || []) : [];
      const map = window.SUBJECT_TO_PATH || {};
      const pathId = map[last.sub];
      const path = pathId ? paths.filter((p) => p && p.id === pathId)[0] : null;
      const topic = (path && Array.isArray(path.topics))
        ? path.topics.filter((t) => t && t.lsn && t.lsn.sub === last.sub && t.lsn.key === last.topic)[0]
        : null;
      if (topic && topic.t) return topic.t[(L10N && L10N.current) || "ar"] || topic.t.ar || "";
    } catch (e) { /* unresolvable → honest empty state */ }
    return "";
  }

  /**
   * Next recommended lesson/topic from the current path. A topic title is
   * shown only with an explicit "content coming soon" note until the real
   * lesson exists in PLATFORM_LESSONS — nothing is invented.
   * @param {Object|null} snap Current path snapshot.
   * @returns {{title:string,meta:string}}
   */
  function nextLessonInfo(snap) {
    if (!snap) return { title: T("dash.noPath"), meta: T("dash.noPathBody") };
    const topic = snap.next;
    if (!topic) return { title: T("dash.pathComplete"), meta: bi(snap.path.title) };
    let authored = false;
    try {
      const lsn = topic.lsn;
      const lessons = window.PLATFORM_LESSONS || {};
      authored = !!(lsn && lessons[lsn.sub] && lessons[lsn.sub][lsn.key]);
    } catch (e) { authored = false; }
    return {
      title: bi(topic.t) || T("dash.noLesson"),
      meta: authored ? T("dash.lessonReady") : T("dash.lessonSoon")
    };
  }


  /** Paint the command center from saved local data. Read-only. @returns {void} */
  function render() {
    const qb = banks();
    const store = saved();
    const results = store.results || {};
    const progress = store.progress || {};
    const snaps = pathSnapshots(results);
    const current = currentPathSnapshot(snaps);
    const active = hasActivity(store, snaps);

    /* Welcome area: new students get orientation, returning students get a
       concise status message. No identity or engagement metric is invented. */
    setText(titleEl, active ? T("dash.welcomeBack") : T("dash.welcomeNew"));
    setText(welcomeEl, active ? T("dash.welcomeActive") : T("dash.welcomeEmpty"));
    if (emptyEl) emptyEl.hidden = active;

    /* Overall progress deliberately keeps the existing ProgressHub formula:
       the mean of saved best quiz percentages across known banks. */
    const pct = overallPct(results, qb);
    pctEl.textContent = String(pct);
    if (barEl && barEl.style) barEl.style.width = pct + "%";
    if (meterEl) {
      meterEl.setAttribute("aria-valuenow", String(pct));
      meterEl.setAttribute("aria-label", T("dash.overallAria") || T("dash.overall") || "Overall progress");
    }

    /* Current/recommended path progress. */
    if (current) {
      setText(pathEl, bi(current.path.title));
      const state = current.next
        ? T("dash.pathNext", { topic: bi(current.next.t) })
        : T("dash.pathComplete");
      setText(pathMetaEl, (T("dash.pathProgress", { done: current.done, total: current.total }) || "") +
        (state ? " · " + state : ""));
      if (pathBarEl && pathBarEl.style) pathBarEl.style.width = current.pct + "%";
      if (pathMeterEl) {
        pathMeterEl.setAttribute("aria-valuenow", String(current.pct));
        pathMeterEl.setAttribute("aria-label", T("dash.pathAria") || "Path progress");
      }
      if (pathLinkEl) pathLinkEl.setAttribute("href", "#path/" + current.path.id);
    } else {
      setText(pathEl, T("dash.noPath"));
      setText(pathMetaEl, T("dash.noPathBody"));
      if (pathBarEl && pathBarEl.style) pathBarEl.style.width = "0%";
      if (pathMeterEl) pathMeterEl.setAttribute("aria-valuenow", "0");
      if (pathLinkEl) pathLinkEl.setAttribute("href", "#paths");
    }

    /* Next recommended lesson: a real path topic, with an explicit coming-soon
       note until authored lesson content exists. */
    const nextLesson = nextLessonInfo(current);
    setText(lessonEl, nextLesson.title);
    setText(lessonMetaEl, nextLesson.meta);

    /* Unfinished real work: un-attempted quizzes plus path-referenced labs
       that have not been manually marked complete. */
    const quizKeys = Object.keys(qb).filter((k) => qb[k] && Array.isArray(qb[k].questions) && qb[k].questions.length);
    const pendingQuizzes = quizKeys.filter((k) => !results[k]);
    const labsStore = storeGet("labs");
    const labDone = labsStore && typeof labsStore.done === "object" && labsStore.done ? labsStore.done : {};
    const pendingLabs = pathLabIds().filter((id) => !labDone[id]);
    if (pendingQuizzes.length || pendingLabs.length) {
      setText(tasksEl, T(active ? "dash.pendingCounts" : "dash.readyCounts", {
        quizzes: pendingQuizzes.length,
        labs: pendingLabs.length
      }));
      const examples = [];
      if (pendingQuizzes[0]) examples.push(T("dash.pendingQuiz", { name: bankLabel(pendingQuizzes[0]) }));
      if (pendingLabs[0]) examples.push(T("dash.pendingLab", { name: labLabel(pendingLabs[0]) }));
      setText(tasksMetaEl, examples.filter(Boolean).join(" · "));
    } else if (quizKeys.length || pathLabIds().length) {
      setText(tasksEl, T("dash.allCaughtUp"));
      setText(tasksMetaEl, "");
    } else {
      setText(tasksEl, "—");
      setText(tasksMetaEl, "");
    }

    /* Continue learning: preserve the existing resume → recommended-quiz →
       paths behavior, while also retaining the last real lesson context. */
    const resume = resumeKey(progress, qb);
    const next = nextQuizKey(results, qb);
    const attempted = Object.keys(results).some((k) => qb[k]);
    const lastLesson = lastLessonLabel();
    setText(lastEl, lastLesson
      ? T("dash.lastOpened", { title: lastLesson })
      : T("dash.noLesson"));

    if (resume) {
      setText(quizEl, T("dash.resumeQuiz", { sub: bankLabel(resume) }) || bankLabel(resume));
    } else if (next) {
      setText(quizEl, attempted
        ? (T("dash.newQuiz", { sub: bankLabel(next) }) || bankLabel(next))
        : bankLabel(next));
    } else {
      setText(quizEl, T("dash.allDone"));
    }

    if (ctaEl) {
      if (resume) {
        ctaEl.setAttribute("href", "#quiz");
        ctaEl.setAttribute("data-action", "resume");
        ctaEl.setAttribute("data-subject", resume);
        ctaEl.removeAttribute("data-quiz");
        ctaEl.textContent = T("dash.continue") || ctaEl.textContent;
      } else if (next) {
        ctaEl.setAttribute("href", "#quiz");
        ctaEl.setAttribute("data-action", "quiz");
        ctaEl.setAttribute("data-quiz", next);
        ctaEl.removeAttribute("data-subject");
        ctaEl.textContent = (attempted ? T("dash.continue") : T("dash.continueFresh")) || ctaEl.textContent;
      } else {
        ctaEl.setAttribute("href", "#paths");
        ctaEl.setAttribute("data-action", "paths");
        ctaEl.removeAttribute("data-quiz");
        ctaEl.removeAttribute("data-subject");
        ctaEl.textContent = T("dash.continueFresh") || ctaEl.textContent;
      }
    }
  }

  /* Continue-Learning shortcut: resume the saved session, deep-start the
     recommended bank (data-quiz) or fall back to the plain anchor hop. */
  if (ctaEl && ctaEl.addEventListener) {
    ctaEl.addEventListener("click", (ev) => {
      const d = ctaEl.dataset || {};
      const key = d.action === "resume" ? (d.subject || "") : (d.action === "quiz" ? (d.quiz || "") : "");
      if (!key) return; /* data-action="paths" → let the anchor navigate */
      ev.preventDefault();
      if (window.NovaViews && typeof window.NovaViews.activate === "function") window.NovaViews.activate("quiz");
      const start = (typeof window.startQuiz === "function") ? window.startQuiz : null;
      if (typeof start === "function" && banks()[key]) start(key, true);
    });
  }

  document.addEventListener("nova:progress-changed", render);
  document.addEventListener("nova:view-changed", render);
  try { if (L10N && typeof L10N.onSwitch === "function") L10N.onSwitch(render); } catch (e) { /* locale hook optional */ }

  render();
})();

/* ============================================================
   MODULE 48 · GlobalSearch — بحث شامل (لوحة أوامر)
   ------------------------------------------------------------
   Command-palette style search over the platform's REAL data —
   no duplicated index files:
   - lessons            → window.PLATFORM_LESSONS (empty today)
   - learning paths/topics → window.getLearningPaths()
   - the 12 tools       → window.PLATFORM_TOOLS_META
   - subject banks      → window.QUIZZES (+ PLATFORM_SUBJECTS names)
   - flashcards + glossary explanations → PLATFORM_FLASH_TERMS
   Keyboard: "/" or Ctrl/⌘+K opens, Esc closes, ↑↓ move, Enter
   picks; combobox + listbox ARIA stay in sync. Picking a result
   activates the owning view, keeps the platform's own deep-link
   flow (#path/<id>, #lesson/<sub>/<key>), deep-starts a bank
   (data-quiz) and flashes the landed-on card (.search-flash).
   Honest states: groups without real entries are never rendered,
   and an unmatched query says so instead of showing filler.
   ============================================================ */
(function initGlobalSearch() {
  "use strict";
  const openBtn = document.getElementById("searchOpenBtn");
  const overlay = document.getElementById("searchOverlay");
  const dialog = document.getElementById("searchDialog");
  const input = document.getElementById("searchInput");
  const list = document.getElementById("searchResults");
  const closeBtn = document.getElementById("searchClose");
  if (!dialog || !input || !list) return; /* no markup → honest no-op */

  /* ---------- locale + helpers (outside the main IIFE) ---------- */
  /** @returns {{current:string,t:function,onSwitch:function}|null} */
  function resolveLang() {
    try { if (typeof Lang !== "undefined" && Lang) return Lang; } catch (e) { /* TDZ */ }
    try { if (typeof window !== "undefined" && window.Lang) return window.Lang; } catch (e2) { /* unreachable */ }
    return null;
  }
  const L10N = resolveLang();
  const loc = () => (L10N && L10N.current) || "ar";

  /** Translation that never returns a raw key. @param {string} k @param {Object=} p @returns {string} */
  function T(k, p) {
    let s = "";
    try { s = L10N ? L10N.t(k, p) : ""; } catch (e) { s = ""; }
    return (!s || s === k) ? "" : s;
  }

  /** Escape HTML-significant characters. @param {unknown} v @returns {string} */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  /**
   * Fold a string for matching: lowercase, strip Arabic diacritics/tatweel and
   * unify alef/ya/ta-marbuta variants so «التشفير» and «التشفير» both match.
   * @param {unknown} s Raw text.
   * @returns {string} Comparable text.
   */
  function norm(s) {
    return String(s == null ? "" : s).toLowerCase()
      .replace(/[\u064b-\u0652\u0640]/g, "")
      .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627")
      .replace(/\u0649/g, "\u064a").replace(/\u0626/g, "\u064a")
      .replace(/\u0624/g, "\u0648").replace(/\u0629/g, "\u0647")
      .replace(/\s+/g, " ").trim();
  }

  /** Display name of a quiz subject (registry first). @param {string} key @returns {string} */
  function subjectLabel(key) {
    try {
      const reg = window.PLATFORM_SUBJECTS;
      if (Array.isArray(reg)) {
        const s = reg.filter((x) => x && (x.quizKey === key || x.id === key))[0];
        if (s) {
          const en = (s.nameEn && loc() === "en") ? s.nameEn : "";
          return en || s.nameAr || key;
        }
      }
    } catch (e) { /* registry unavailable */ }
    const b = (window.QUIZZES || {})[key];
    return (b && b.name) || key;
  }

  /* ---------- index (built from real data on every open) ---------- */
  const GROUPS = ["lesson", "path", "tool", "quiz", "flash", "term"];
  const MAX_HITS = 40;

  /** Group label from the dictionary. @param {string} kind @returns {string} */
  function groupLabel(kind) {
    return T("search.group." + kind) || kind;
  }

  /**
   * Build the searchable index from the platform's live data.
   * @returns {Array<{kind:string,title:string,sub:string,view:string,data:Object}>} Entries.
   */
  function buildIndex() {
    const out = [];
    /** @param {string} kind @param {string} title @param {string} sub @param {string} view @param {Object=} data */
    const push = (kind, title, sub, view, data) => {
      const t = String(title == null ? "" : title).trim();
      if (!t) return;
      out.push({ kind: kind, title: t, sub: sub ? String(sub).trim() : "", view: view || "", data: data || {} });
    };

    /* 1 · authored lessons (registry is empty until content ships) */
    try {
      const lessons = window.PLATFORM_LESSONS || {};
      Object.keys(lessons).forEach((sub) => {
        const byKey = lessons[sub] || {};
        Object.keys(byKey).forEach((k) => {
          const b = byKey[k] || {};
          const t = (b.title && (b.title[loc()] || b.title.ar)) || k;
          push("lesson", t, sub + " / " + k, "lesson", { hash: "#lesson/" + sub + "/" + k });
        });
      });
    } catch (e) { /* registry unavailable → no lesson results */ }

    /* 2 · learning paths and their ordered topics */
    try {
      const paths = (typeof window.getLearningPaths === "function") ? (window.getLearningPaths() || []) : [];
      paths.forEach((p) => {
        if (!p || !p.id) return;
        const pathTitle = (p.title && (p.title[loc()] || p.title.ar)) || p.id;
        const pathDesc = (p.desc && (p.desc[loc()] || p.desc.ar)) || "";
        push("path", pathTitle, pathDesc, "path", { hash: "#path/" + p.id });
        (Array.isArray(p.topics) ? p.topics : []).forEach((tp) => {
          if (!tp || !tp.t) return;
          const tt = tp.t[loc()] || tp.t.ar || tp.t.en || "";
          if (!tt) return;
          if (tp.lsn && tp.lsn.sub && tp.lsn.key) {
            push("lesson", tt, pathTitle, "lesson", { hash: "#lesson/" + tp.lsn.sub + "/" + tp.lsn.key });
          } else {
            push("path", tt, pathTitle, "path", { hash: "#path/" + p.id });
          }
        });
      });
    } catch (e) { /* path data unavailable */ }

    /* 3 · the 12 interactive tools */
    try {
      const meta = window.PLATFORM_TOOLS_META || {};
      Object.keys(meta).forEach((id) => {
        const m = meta[id] || {};
        const n = m.name ? (m.name[loc()] || m.name.ar || m.name.en) : "";
        const purpose = m.purpose ? (m.purpose[loc()] || m.purpose.ar || m.purpose.en) : "";
        push("tool", n, purpose, "tools", { tool: id });
      });
    } catch (e) { /* tool metadata unavailable */ }

    /* 4 · subject question banks (real names, course code as the subtitle) */
    const quizEntries = [];
    try {
      const qb = (window.QUIZZES && typeof window.QUIZZES === "object") ? window.QUIZZES : {};
      Object.keys(qb).forEach((key) => {
        quizEntries.push({ key: key, name: subjectLabel(key), count: (qb[key] && qb[key].questions) ? qb[key].questions.length : 0 });
      });
    } catch (e) { /* bank unavailable */ }
    quizEntries.forEach((q) => {
      push("quiz", q.name, q.key, "quiz", { quiz: q.key, extra: String(q.count) + " " + (q.key || "") });
    });

    /* 5 · flashcards (term) + 6 · glossary explanations (term text) */
    try {
      const terms = Array.isArray(window.PLATFORM_FLASH_TERMS) ? window.PLATFORM_FLASH_TERMS : [];
      terms.forEach((tm, i) => {
        if (!tm) return;
        const ar = tm.ar || "", en = tm.en || "";
        const title = (loc() === "en") ? (en || ar) : (ar || en);
        const other = (loc() === "en") ? ar : en;
        push("flash", title, other, "flash", { flash: i, extra: tm.ex || "" });
        if (tm.ex) push("term", tm.ex, title, "flash", { flash: i });
      });
    } catch (e) { /* glossary unavailable */ }

    return out;
  }

  /* ---------- matching + rendering ---------- */
  let entries = [];
  let hits = [];
  let sel = -1;

  /**
   * Rank indexed entries for a query (prefix title hits first).
   * @param {string} q Raw query.
   * @returns {Array<Object>} Matching entries (max MAX_HITS).
   */
  function find(q) {
    const nq = norm(q);
    if (!nq) return [];
    const scored = [];
    entries.forEach((e) => {
      const hay = norm(e.title + " " + e.sub + " " + ((e.data && e.data.extra) || ""));
      if (hay.indexOf(nq) < 0) return;
      scored.push({ e: e, rank: norm(e.title).indexOf(nq) === 0 ? 0 : 1 });
    });
    scored.sort((a, b) => a.rank - b.rank);
    return scored.map((s) => s.e).slice(0, MAX_HITS);
  }

  /**
   * Mark the active option (aria-selected + aria-activedescendant).
   * @param {number} i Option index (wraps).
   * @returns {void}
   */
  function setSel(i) {
    if (!list.querySelectorAll) return;
    const opts = list.querySelectorAll(".search-option");
    if (!opts || !opts.length) {
      sel = -1;
      if (input.setAttribute) input.setAttribute("aria-activedescendant", "");
      return;
    }
    if (i < 0) i = opts.length - 1;
    if (i >= opts.length) i = 0;
    sel = i;
    for (let k = 0; k < opts.length; k++) opts[k].setAttribute("aria-selected", k === i ? "true" : "false");
    const cur = opts[i];
    if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: "nearest" }); } catch (e) { /* no-op */ } }
    if (input.setAttribute) input.setAttribute("aria-activedescendant", (cur && cur.id) ? cur.id : "");
  }

  /**
   * Paint the grouped listbox or the honest empty state.
   * @param {string} q Raw query.
   * @returns {void}
   */
  function renderResults(q) {
    hits = [];
    sel = -1;
    if (!q || !norm(q)) {
      list.innerHTML = '<li class="search-empty-msg">' + esc(T("search.start")) + "</li>";
      if (input.setAttribute) input.setAttribute("aria-activedescendant", "");
      return;
    }
    const found = find(q);
    if (!found.length) {
      list.innerHTML = '<li class="search-empty-msg">' + esc(T("search.empty")) + "</li>";
      if (input.setAttribute) input.setAttribute("aria-activedescendant", "");
      return;
    }
    let html = "";
    GROUPS.forEach((kind) => {
      const rows = found.filter((e) => e.kind === kind);
      if (!rows.length) return;
      html += '<li class="search-group" role="presentation">' + esc(groupLabel(kind)) + "</li>";
      rows.forEach((e) => {
        const idx = hits.length;
        hits.push(e);
        html += '<li class="search-option" role="option" id="searchOpt' + idx + '" aria-selected="false" data-i="' + idx + '">' +
          '<span class="search-option-title">' + esc(e.title) + "</span>" +
          (e.sub ? '<span class="search-option-sub">' + esc(e.sub) + "</span>" : "") +
          "</li>";
      });
    });
    list.innerHTML = html;
    setSel(0);
  }

  /**
   * Briefly highlight the card a result points at (a missing target is simply
   * not highlighted — nothing is invented).
   * @param {Object} e Picked entry.
   * @returns {void}
   */
  function flashTarget(e) {
    try {
      const d = e.data || {};
      let node = null;
      if (d.tool) node = document.getElementById(d.tool);
      else if (typeof d.flash === "number") {
        const grid = document.getElementById("flashGrid");
        node = (grid && grid.querySelector) ? grid.querySelector('[data-i="' + d.flash + '"]') : null;
      } else if (e.view) node = document.getElementById(e.view);
      if (!node) return;
      if (node.scrollIntoView) { try { node.scrollIntoView({ block: "center" }); } catch (err) { /* no-op */ } }
      if (node.classList) {
        node.classList.add("search-flash");
        setTimeout(() => { try { node.classList.remove("search-flash"); } catch (err2) { /* no-op */ } }, 1900);
      }
    } catch (err) { /* highlight is an enhancement, never fatal */ }
  }

  /**
   * Activate the owning view, keep the platform's deep-link flow, deep-start a
   * quiz bank and highlight the landed-on card.
   * @param {number} i Index inside the current hits.
   * @returns {void}
   */
  function pick(i) {
    const e = hits[i];
    if (!e) return;
    close();
    const d = e.data || {};
    const NV = window.NovaViews;
    if (e.view && NV && typeof NV.activate === "function") { try { NV.activate(e.view); } catch (err) { /* no-op */ } }
    if (d.hash) { try { if (location.hash !== d.hash) location.hash = d.hash; } catch (err2) { /* no-op */ } }
    if (d.quiz) {
      const qb = (window.QUIZZES && typeof window.QUIZZES === "object") ? window.QUIZZES : {};
      if (qb[d.quiz] && typeof window.startQuiz === "function") { try { window.startQuiz(d.quiz, true); } catch (err3) { /* no-op */ } }
    }
    flashTarget(e);
  }

  /* ---------- open / close ---------- */
  let isOpen = false;
  /* Focus containment + the modal guard come from the shared helpers through
     the A11Y bridge, because this module lives outside the main IIFE. The
     inert fallback keeps the dialog usable if that bridge is ever absent. */
  const A11Y = (typeof window !== "undefined" && window.PLATFORM_A11Y) || {};
  const trap = (typeof A11Y.createFocusTrap === "function")
    ? A11Y.createFocusTrap(dialog)
    : { activate() {}, deactivate() {}, focusFirst() { return null; }, isActive() { return false; } };
  /** @param {HTMLElement=} except Overlay to ignore. @returns {boolean} */
  const overlayOpen = (except) => (typeof A11Y.anotherOverlayOpen === "function")
    ? !!A11Y.anotherOverlayOpen(except) : false;

  /** Open the dialog, rebuild the index and show the start hint. @returns {void} */
  function open() {
    if (isOpen) { if (input.focus) input.focus(); return; }
    if (overlayOpen(dialog)) return;
    isOpen = true;
    try { entries = buildIndex(); } catch (e) { entries = []; }
    try { dialog.inert = false; } catch (e1) { /* inert is progressive */ }
    if (dialog.removeAttribute) dialog.removeAttribute("inert");
    if (dialog.classList) dialog.classList.add("is-open");
    dialog.setAttribute("aria-hidden", "false");
    if (overlay) overlay.hidden = false;
    try { if (document.body && document.body.classList) document.body.classList.add("search-open"); } catch (e2) { /* no-op */ }
    if (input.setAttribute) input.setAttribute("aria-expanded", "true");
    try { if ("value" in input) input.value = ""; } catch (e3) { /* read-only input in tests */ }
    renderResults("");
    trap.activate();
    if (input.focus) input.focus();
  }

  /** Close the dialog and hand focus back to the navbar button. @returns {void} */
  function close() {
    if (!isOpen) return;
    isOpen = false;
    trap.deactivate({ restoreFocus: false });
    if (dialog.classList) dialog.classList.remove("is-open");
    dialog.setAttribute("aria-hidden", "true");
    try { dialog.inert = true; } catch (e0) { /* inert is progressive */ }
    dialog.setAttribute("inert", "");
    if (overlay) overlay.hidden = true;
    try { if (document.body && document.body.classList) document.body.classList.remove("search-open"); } catch (e) { /* no-op */ }
    if (input.setAttribute) {
      input.setAttribute("aria-expanded", "false");
      input.setAttribute("aria-activedescendant", "");
    }
    if (openBtn && openBtn.focus) openBtn.focus();
  }

  /* ---------- wiring ---------- */
  if (openBtn && openBtn.addEventListener) openBtn.addEventListener("click", (ev) => { ev.preventDefault(); open(); });
  if (closeBtn && closeBtn.addEventListener) closeBtn.addEventListener("click", close);
  if (overlay && overlay.addEventListener) overlay.addEventListener("click", close);

  if (input.addEventListener) {
    input.addEventListener("input", () => renderResults(input.value || ""));
    input.addEventListener("keydown", (ev) => {
      const k = ev.key;
      if (k === "ArrowDown") { ev.preventDefault(); setSel(sel + 1); }
      else if (k === "ArrowUp") { ev.preventDefault(); setSel(sel - 1); }
      else if (k === "Home") { ev.preventDefault(); setSel(0); }
      else if (k === "End") { ev.preventDefault(); setSel(hits.length - 1); }
      else if (k === "Enter") { if (sel >= 0 && hits.length) { ev.preventDefault(); pick(sel); } }
      else if (k === "Escape") { ev.preventDefault(); close(); }
    });
  }

  if (list.addEventListener) {
    list.addEventListener("click", (ev) => {
      const li = (ev.target && ev.target.closest) ? ev.target.closest(".search-option") : null;
      if (!li || !li.getAttribute) return;
      pick(parseInt(li.getAttribute("data-i"), 10));
    });
  }

  /* Global shortcuts: "/" (never while typing in a field) and Ctrl/⌘+K. */
  document.addEventListener("keydown", (ev) => {
    if (isOpen) { if (ev.key === "Escape") close(); return; }
    const combined = (ev.ctrlKey || ev.metaKey) && String(ev.key).toLowerCase() === "k";
    if (combined) { ev.preventDefault(); open(); return; }
    const el = ev.target;
    const tag = (el && el.tagName) ? String(el.tagName).toLowerCase() : "";
    const typing = tag === "input" || tag === "textarea" || tag === "select" || (el && el.isContentEditable === true);
    if (!typing && ev.key === "/") { ev.preventDefault(); open(); }
  });

  /* Re-index on locale switch so titles and group labels follow the UI. */
  try {
    if (L10N && typeof L10N.onSwitch === "function") {
      L10N.onSwitch(() => {
        if (!isOpen) return;
        try { entries = buildIndex(); } catch (e) { /* keep the previous index */ }
        renderResults(input.value || "");
      });
    }
  } catch (e) { /* locale hook optional */ }
})();

/* ============================================================
   MODULE 49 · ReopenOnboarding — إعادة تشغيل جولة التعريف
   ------------------------------------------------------------
   The Start-Here strip's «جولة التعريف» button replays the
   onboarding wizard at any time (not just on a first visit).
   It talks to MODULE 38 exclusively through the window bridge
   `window.NovaOnboarding`, so the wizard stays encapsulated:
   - bridge present → reopen the wizard from step 1 (state reset,
     option highlights cleared by MODULE 38).
   - bridge missing (e.g. overlay absent) → the trigger stays an
     honest no-op instead of throwing.
   ============================================================ */
(function initReopenOnboarding() {
  "use strict";
  document.addEventListener("click", (ev) => {
    const trigger = (ev.target && ev.target.closest) ? ev.target.closest("[data-onboarding-reopen]") : null;
    if (!trigger) return;
    const api = window.NovaOnboarding;
    if (!api || typeof api.open !== "function") return;
    ev.preventDefault();
    api.open();
  });
})();

/* @@MOTIVATION_START@@ */
/* ============================================================
   MODULE 50 · Motivation — local XP, levels, goals, streak, badges
   ------------------------------------------------------------
   Purely local, non-competitive motivation layer built ONLY from
   genuine completed actions:
   - lesson completion (MODULE 40 first-time review)
   - quiz completion (once per real question bank)
   - flashcard first review (once per real card)
   - lab completion (once per real lab, only on mark-complete)
   State: namespaced localStorage key "motmi-portal:motivation".
   Corrupt/missing data is sanitized to safe defaults. Existing
   progress is backfilled idempotently so no genuine past action
   is lost and no action can be awarded twice.
   ============================================================ */
(function initMotivation() {
  "use strict";

  var STORE_KEY = "motivation";
  var VERSION = 1;
  var LEVEL_STEP = 100;
  var XP_VALUES = { lesson: 25, quiz: 40, flash: 5, lab: 60 };
  var DAILY_GOAL = 40;
  var WEEKLY_GOAL = 200;
  var SEMESTER_CODES = ["260210030702", "260210030802", "260210030902", "260210031002", "260210031102"];

  /** @returns {Object|null} Namespaced Store bridge when available. */
  function store() {
    try {
      var s = window.PLATFORM_STORE;
      if (s && typeof s.get === "function" && typeof s.set === "function") return s;
    } catch (e) { /* fall through to localStorage */ }
    return null;
  }

  /** @returns {*} Raw persisted value or null. */
  function readRaw() {
    try {
      var s = store();
      if (s) return s.get(STORE_KEY, null);
    } catch (e) { /* fall through */ }
    try {
      var raw = localStorage.getItem("motmi-portal:" + STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e2) { return null; }
  }

  /** @param {Object} st State to persist. @returns {void} */
  function writeRaw(st) {
    try {
      var s = store();
      if (s) { s.set(STORE_KEY, st); return; }
    } catch (e) { /* fall through */ }
    try { localStorage.setItem("motmi-portal:" + STORE_KEY, JSON.stringify(st)); } catch (e2) { /* private mode */ }
  }

  /** Remove the motivation key only. @returns {void} */
  function removeRaw() {
    try {
      var s = store();
      if (s && typeof s.remove === "function") { s.remove(STORE_KEY); return; }
    } catch (e) { /* fall through */ }
    try { localStorage.removeItem("motmi-portal:" + STORE_KEY); } catch (e2) { /* private mode */ }
  }

  /** @param {*} v Candidate. @returns {boolean} Plain object? */
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  /** @param {*} v Candidate. @returns {boolean} Finite number >= 0? */
  function num(v) { return typeof v === "number" && isFinite(v) && v >= 0; }
  /** @param {number} n Number. @returns {string} 2-digit pad. */
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  /** @returns {Object} Safe empty state. */
  function defaults() {
    return { v: VERSION, events: {}, days: {}, badges: {}, bestStreak: 0, updatedAt: 0 };
  }

  /**
   * Sanitize persisted data. Invalid events/days/badges are dropped rather
   * than throwing, so corrupted localStorage can never break the app.
   * @param {*} raw Persisted value.
   * @returns {Object} Safe state.
   */
  function sanitize(raw) {
    var out = defaults();
    if (!isObj(raw)) return out;
    if (isObj(raw.events)) {
      var keys = Object.keys(raw.events);
      if (keys.length > 500) keys = keys.slice(-500);
      keys.forEach(function (k) {
        var e = raw.events[k];
        if (!k || !isObj(e) || !num(e.xp) || e.xp <= 0 || e.xp > 500) return;
        out.events[k] = { xp: Math.round(e.xp), ts: num(e.ts) ? e.ts : 0 };
      });
    }
    if (isObj(raw.days)) {
      Object.keys(raw.days).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !num(raw.days[k]) || raw.days[k] <= 0 || raw.days[k] > 10000) return;
        out.days[k] = Math.round(raw.days[k]);
      });
    }
    if (isObj(raw.badges)) {
      Object.keys(raw.badges).forEach(function (k) {
        if (!k || !num(raw.badges[k])) return;
        out.badges[k] = Math.round(raw.badges[k]);
      });
    }
    if (num(raw.bestStreak)) out.bestStreak = Math.floor(raw.bestStreak);
    if (num(raw.updatedAt)) out.updatedAt = Math.round(raw.updatedAt);
    return out;
  }

  var state = sanitize(readRaw());

  /** Persist the current state with a fresh timestamp. @returns {void} */
  function save() {
    state.updatedAt = Date.now();
    writeRaw(state);
  }

  /** @returns {number} Total XP derived from awarded events only. */
  function totalXp() {
    var sum = 0;
    Object.keys(state.events).forEach(function (k) { sum += state.events[k].xp || 0; });
    return sum;
  }

  /** @param {Date=} d Date. @returns {string} Local YYYY-MM-DD key. */
  function dateKey(d) {
    var x = d || new Date();
    return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate());
  }

  /** @returns {string} Today's local date key. */
  function todayKey() { return dateKey(new Date()); }

  /** @param {string} key Date key. @param {number} delta Days. @returns {string} Shifted key. */
  function shiftDay(key, delta) {
    var p = String(key).split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + delta);
    return dateKey(d);
  }

  /**
   * Current streak: consecutive genuine activity days ending today or
   * yesterday (a student who has not studied yet today keeps the streak).
   * @returns {number} Streak length.
   */
  function computeStreak() {
    var today = todayKey();
    var yesterday = shiftDay(today, -1);
    var start = state.days[today] ? today : (state.days[yesterday] ? yesterday : "");
    if (!start) return 0;
    var count = 0, cur = start, guard = 0;
    while (state.days[cur] > 0 && guard < 10000) { count++; cur = shiftDay(cur, -1); guard++; }
    return count;
  }

  /** @returns {number} XP earned today. */
  function dailyXp() { return state.days[todayKey()] || 0; }

  /** @returns {number} XP earned today plus the previous six days. */
  function weeklyXp() {
    var sum = 0, key = todayKey();
    for (var i = 0; i < 7; i++) sum += state.days[shiftDay(key, -i)] || 0;
    return sum;
  }

  /**
   * Level calculation: 100 XP per level, six localized titles; the level
   * number keeps growing after the last title.
   * @param {number=} xp Optional XP override.
   * @returns {{level:number,titleLevel:number,into:number,next:number,remaining:number,pct:number}}
   */
  function getLevelInfo(xp) {
    var value = num(xp) ? xp : totalXp();
    var level = Math.floor(value / LEVEL_STEP) + 1;
    var into = value % LEVEL_STEP;
    return {
      level: level,
      titleLevel: Math.min(level, 6),
      into: into,
      next: level + 1,
      remaining: LEVEL_STEP - into,
      pct: Math.round((into / LEVEL_STEP) * 100)
    };
  }

  /** @param {string} key Store key. @returns {*} Raw object value. */
  function rawStoreValue(key) {
    try {
      var s = store();
      if (s) return s.get(key, null);
    } catch (e) { /* fall through */ }
    try {
      var raw = localStorage.getItem("motmi-portal:" + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e2) { return null; }
  }

  /** @returns {Object} Saved quiz results. */
  function savedResults() {
    try {
      var r = (typeof window.readStore === "function") ? window.readStore() : null;
      return (r && isObj(r.results)) ? r.results : {};
    } catch (e) { return {}; }
  }

  /** @returns {Object} Available question banks. */
  function banks() {
    try { return isObj(window.QUIZZES) ? window.QUIZZES : {}; } catch (e) { return {}; }
  }

  /** @returns {Object} Completed lab map. */
  function labsDone() {
    var st = rawStoreValue("labs");
    return (st && isObj(st.done)) ? st.done : {};
  }

  /**
   * Progress for one real learning path, matching MODULE 39's rule.
   * @param {string} id Path id.
   * @returns {number} Completion percentage (0 when unknown).
   */
  function pathPct(id) {
    try {
      var paths = (typeof window.getLearningPaths === "function") ? (window.getLearningPaths() || []) : [];
      var path = paths.filter(function (p) { return p && p.id === id; })[0];
      if (!path || !Array.isArray(path.topics) || !path.topics.length) return 0;
      var stored = rawStoreValue("paths");
      var done = (stored && isObj(stored.done)) ? stored.done : {};
      var results = savedResults();
      var total = 0, completed = 0;
      path.topics.forEach(function (t) {
        if (!t || !t.id) return;
        total++;
        var auto = !!(t.res && t.res.k === "quiz" && results[t.res.key]);
        var manual = !!(done[path.id] && done[path.id][t.id] === true);
        if (auto || manual) completed++;
      });
      return total ? Math.round((completed / total) * 100) : 0;
    } catch (e) { return 0; }
  }

  /** @returns {Object} Real-data context used by achievement checks. */
  function context() {
    var results = savedResults();
    var qb = banks();
    var keys = Object.keys(qb).filter(function (k) {
      return qb[k] && Array.isArray(qb[k].questions) && qb[k].questions.length;
    });
    var allAttempted = keys.length > 0 && keys.every(function (k) { return !!results[k]; });
    var allMastered = allAttempted && keys.every(function (k) {
      var r = results[k] || {};
      var total = qb[k].questions.length;
      var pct = num(r.pct) ? r.pct : (total ? Math.round(((r.score || 0) / total) * 100) : 0);
      return pct >= 80;
    });
    var labs = labsDone();
    return {
      results: results,
      hasQuiz: Object.keys(results).some(function (k) { return !!qb[k]; }),
      quizMaster: allMastered,
      semesterFinisher: SEMESTER_CODES.every(function (code) { return !!results[code]; }),
      hasLab: Object.keys(labs).length > 0,
      crypto: !!results["260210031102"] || !!labs.cryptolab,
      network: pathPct("networking") >= 50 || !!labs.redteam,
      incident: !!labs.ir || pathPct("incident") >= 50,
      streak: computeStreak()
    };
  }

  /** Achievement registry — each rule reads only real platform data. */
  var BADGES = [
    { id: "firstLesson", ico: "🌱", check: function () { return Object.keys(state.events).some(function (k) { return k.indexOf("lesson:") === 0; }); } },
    { id: "firstQuiz", ico: "🎯", check: function (c) { return c.hasQuiz; } },
    { id: "quizMaster", ico: "🏆", check: function (c) { return c.quizMaster; } },
    { id: "labExplorer", ico: "🧪", check: function (c) { return c.hasLab; } },
    { id: "cryptoApprentice", ico: "🔐", check: function (c) { return c.crypto; } },
    { id: "networkNavigator", ico: "🌐", check: function (c) { return c.network; } },
    { id: "incidentResponder", ico: "🚨", check: function (c) { return c.incident; } },
    { id: "streak7", ico: "🔥", check: function (c) { return c.streak >= 7; } },
    { id: "semesterFinisher", ico: "🎓", check: function (c) { return c.semesterFinisher; } }
  ];

  /**
   * Unlock every achievement whose real-data rule now passes.
   * @returns {boolean} True when at least one badge was newly unlocked.
   */
  function unlockBadges() {
    var c = context();
    var changed = false;
    BADGES.forEach(function (b) {
      if (state.badges[b.id]) return;
      try {
        if (b.check(c)) { state.badges[b.id] = Date.now(); changed = true; }
      } catch (e) { /* a failing rule never breaks the dashboard */ }
    });
    return changed;
  }

  /**
   * Add one genuine action event. Idempotent by event id, so the same real
   * action can never grant XP twice.
   * @param {string} id Stable event id.
   * @param {number} xp XP value.
   * @param {string|null} dayKey Local activity day to credit.
   * @param {number} ts Event timestamp.
   * @returns {boolean} True when the event was newly added.
   */
  function addEvent(id, xp, dayKey, ts) {
    if (!id || state.events[id] || !num(xp) || xp <= 0) return false;
    state.events[id] = { xp: Math.round(xp), ts: num(ts) && ts > 0 ? Math.round(ts) : 0 };
    if (dayKey && /^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
      state.days[dayKey] = (state.days[dayKey] || 0) + Math.round(xp);
    }
    state.bestStreak = Math.max(state.bestStreak, computeStreak());
    return true;
  }

  /**
   * Backfill XP for genuine actions that already exist in the platform's
   * own stores (existing-progress compatibility). Idempotent: event ids
   * prevent duplicates. Only quiz results carry a real date, so only those
   * can credit a recent activity day; undated actions grant XP/badges only.
   * @returns {boolean} True when anything was added.
   */
  function backfill() {
    var changed = false;
    var qb = banks();
    var results = savedResults();
    Object.keys(results).forEach(function (k) {
      if (!qb[k]) return;
      var r = results[k] || {};
      var ts = 0, day = null;
      if (typeof r.date === "string" && r.date) {
        var parsed = Date.parse(r.date + "T00:00:00");
        if (isFinite(parsed) && parsed > 0) {
          ts = parsed;
          var diff = Date.now() - parsed;
          if (diff >= 0 && diff < 7 * 86400000) day = dateKey(new Date(parsed));
        }
      }
      if (addEvent("quiz:" + k, XP_VALUES.quiz, day, ts)) changed = true;
    });
    var labs = labsDone();
    Object.keys(labs).forEach(function (view) {
      if (addEvent("lab:" + view, XP_VALUES.lab, null, 0)) changed = true;
    });
    var lessons = rawStoreValue("lessons");
    if (lessons && isObj(lessons.done)) {
      Object.keys(lessons.done).forEach(function (key) {
        if (addEvent("lesson:" + key, XP_VALUES.lesson, null, 0)) changed = true;
      });
    }
    var flash = rawStoreValue("flash");
    if (flash && isObj(flash.reviewed)) {
      Object.keys(flash.reviewed).forEach(function (key) {
        if (addEvent("flash:" + key, XP_VALUES.flash, null, 0)) changed = true;
      });
    }
    return changed;
  }

  /** Re-read real progress, backfill once, refresh badges and repaint. @returns {void} */
  function sync() {
    var before = state.bestStreak;
    var changed = backfill();
    var current = computeStreak();
    if (current > state.bestStreak) { state.bestStreak = current; changed = true; }
    if (state.bestStreak > before) changed = true;
    if (unlockBadges()) changed = true;
    if (changed) save();
    render();
  }

  /**
   * Award XP for one genuine completed action.
   * @param {"lesson"|"quiz"|"flash"|"lab"} kind Action kind.
   * @param {string|number} id Stable action id.
   * @returns {boolean} True when XP was granted.
   */
  function award(kind, id) {
    var value = XP_VALUES[kind];
    if (!value) return false;
    var clean = (id === null || id === undefined) ? "" : String(id).trim();
    if (!clean) return false;
    var added = addEvent(kind + ":" + clean, value, todayKey(), Date.now());
    if (added) {
      unlockBadges();
      save();
      render();
    }
    return added;
  }

  /** @returns {Object} Deep-cloned state for tests/diagnostics. */
  function getState() {
    try { return JSON.parse(JSON.stringify(state)); } catch (e) { return defaults(); }
  }

  /** Remove only the motivation key; learning progress is untouched. @returns {void} */
  function resetMotivation() {
    removeRaw();
    state = defaults();
    render();
  }

  /* Public bridge used by the lesson/quiz/flashcard/lab hooks. */
  window.PlatformMotivation = {
    award: award,
    sync: sync,
    getState: getState,
    reset: resetMotivation,
    getLevelInfo: getLevelInfo,
    XP_VALUES: XP_VALUES,
    LEVEL_STEP: LEVEL_STEP,
    DAILY_GOAL: DAILY_GOAL,
    WEEKLY_GOAL: WEEKLY_GOAL
  };

  /* ---------- bilingual helpers ---------- */
  /** @returns {Object|null} Lang bridge when available. */
  function resolveLang() {
    try { if (typeof Lang !== "undefined" && Lang) return Lang; } catch (e) { /* TDZ */ }
    try { if (typeof window !== "undefined" && window.Lang) return window.Lang; } catch (e2) { /* unreachable */ }
    return null;
  }
  var L10N = resolveLang();
  /**
   * @param {string} key Dictionary key.
   * @param {Object=} params Slot values.
   * @returns {string} Localized text or "".
   */
  function tx(key, params) {
    var s = "";
    try { s = L10N ? L10N.t(key, params) : ""; } catch (e) { s = ""; }
    return (!s || s === key) ? "" : s;
  }
  /** @param {*} v Raw. @returns {string} Escaped HTML. */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (m) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]);
    });
  }
  /** @param {number} level Level number. @returns {string} Localized title. */
  function levelTitle(level) { return tx("motivation.levelTitle." + Math.min(Math.max(level, 1), 6)) || "—"; }
  /** @param {Object} b Badge definition. @returns {string} Localized name. */
  function badgeName(b) { return tx("motivation.badge." + b.id) || b.id; }
  /** @param {Object} b Badge definition. @returns {string} Localized description. */
  function badgeDesc(b) { return tx("motivation.badge." + b.id + "Desc") || ""; }

  /* ---------- dashboard UI (optional mount) ---------- */
  var levelEl = document.getElementById("heroDashLevel");
  var levelTitleEl = document.getElementById("heroDashLevelTitle");
  var xpEl = document.getElementById("heroDashXp");
  var xpBarEl = document.getElementById("heroDashXpBar");
  var xpMeterEl = document.getElementById("heroDashXpMeter");
  var xpNextEl = document.getElementById("heroDashXpNext");
  var dailyEl = document.getElementById("heroDashDaily");
  var dailyBarEl = document.getElementById("heroDashDailyBar");
  var dailyMeterEl = document.getElementById("heroDashDailyMeter");
  var weeklyEl = document.getElementById("heroDashWeekly");
  var weeklyBarEl = document.getElementById("heroDashWeeklyBar");
  var weeklyMeterEl = document.getElementById("heroDashWeeklyMeter");
  var streakEl = document.getElementById("heroDashStreak");
  var badgesEl = document.getElementById("heroDashBadges");
  var badgeCountEl = document.getElementById("heroDashBadgeCount");
  var resetBtn = document.getElementById("heroDashReset");
  var hasUI = !!(badgesEl && levelEl && xpEl && dailyEl && weeklyEl && streakEl);

  /** @param {HTMLElement|null} el Target. @param {string} text Value. @returns {void} */
  function setText(el, text) { if (el) el.textContent = text || "—"; }
  /**
   * @param {HTMLElement|null} bar Fill element.
   * @param {HTMLElement|null} meter Progressbar element.
   * @param {number} value Current value.
   * @param {number} max Maximum value.
   * @param {string} label Accessible label.
   * @returns {void}
   */
  function setBar(bar, meter, value, max, label) {
    var pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
    if (bar && bar.style) bar.style.width = pct + "%";
    if (meter) {
      meter.setAttribute("aria-valuenow", String(Math.max(0, Math.min(value, max))));
      if (label) meter.setAttribute("aria-label", label);
    }
  }

  /** Repaint the motivation UI from real state/data only. @returns {void} */
  function render() {
    if (!hasUI) return;
    var xp = totalXp();
    var info = getLevelInfo(xp);
    var daily = dailyXp();
    var weekly = weeklyXp();
    var streak = computeStreak();

    setText(levelEl, String(info.level));
    setText(levelTitleEl, levelTitle(info.titleLevel));
    setText(xpEl, tx("motivation.xp", { xp: xp }) || (xp + " XP"));
    setText(xpNextEl, tx("motivation.xpNext", { remaining: info.remaining, next: info.next }));
    setBar(xpBarEl, xpMeterEl, info.into, LEVEL_STEP, tx("motivation.levelAria"));

    setText(dailyEl, tx("motivation.goalValue", { xp: daily, goal: DAILY_GOAL }) || (daily + " / " + DAILY_GOAL));
    setBar(dailyBarEl, dailyMeterEl, daily, DAILY_GOAL, tx("motivation.dailyAria"));
    setText(weeklyEl, tx("motivation.goalValue", { xp: weekly, goal: WEEKLY_GOAL }) || (weekly + " / " + WEEKLY_GOAL));
    setBar(weeklyBarEl, weeklyMeterEl, weekly, WEEKLY_GOAL, tx("motivation.weeklyAria"));
    setText(streakEl, tx("motivation.streakDays", { days: streak }) || String(streak));

    var unlocked = 0;
    var html = BADGES.map(function (b) {
      var isOn = !!state.badges[b.id];
      if (isOn) unlocked++;
      var name = badgeName(b);
      var desc = badgeDesc(b);
      var stateLabel = tx(isOn ? "motivation.unlocked" : "motivation.locked");
      return '<div class="motivation-badge ' + (isOn ? "is-unlocked" : "is-locked") + '" role="listitem"' +
        ' aria-label="' + esc(name + " — " + desc + " (" + stateLabel + ")") + '">' +
        '<span class="motivation-badge-ico" aria-hidden="true">' + (isOn ? b.ico : "🔒") + "</span>" +
        '<span class="motivation-badge-text"><b>' + esc(name) + "</b><span>" + esc(desc) + "</span></span></div>";
    }).join("");
    badgesEl.innerHTML = html;
    if (badgeCountEl) {
      setText(badgeCountEl, tx("motivation.achievementsCount", { done: unlocked, total: BADGES.length }) ||
        (unlocked + " / " + BADGES.length));
    }
  }

  /* Reset only the motivation key, after an explicit confirmation. */
  if (resetBtn && resetBtn.addEventListener) {
    resetBtn.addEventListener("click", function () {
      var ok = false;
      try { ok = typeof window.confirm === "function" && window.confirm(tx("motivation.resetConfirm")); }
      catch (e) { ok = false; }
      if (ok) resetMotivation();
    });
  }

  /* Refresh from genuine progress events and locale switches. */
  if (document.addEventListener) {
    document.addEventListener("nova:progress-changed", sync);
    document.addEventListener("nova:view-changed", sync);
  }
  try { if (L10N && typeof L10N.onSwitch === "function") L10N.onSwitch(render); } catch (e) { /* optional */ }
  try {
    if (window.addEventListener) {
      window.addEventListener("storage", function (ev) {
        if (!ev || ev.key !== "motmi-portal:" + STORE_KEY) return;
        state = sanitize(readRaw());
        sync();
      });
    }
  } catch (e2) { /* cross-tab sync is optional */ }

  sync();
})();
/* @@MOTIVATION_END@@ */

/* @@SKILL_TREE_START@@ */
/* ============================================================
   MODULE 51 · SkillTree — cybersecurity skill map
   One node per existing learning path. Titles, topics, resources
   and completion come from LEARNING_PATHS and platform stores.
   PREREQS is only an edge map (path-id → prerequisite path-ids).
   ============================================================ */
(function initSkillTree() {
  "use strict";

  const treeEl = document.getElementById("skillsTree");
  const listEl = document.getElementById("skillsList");
  if (!treeEl || !listEl) return;

  /** Prerequisite edges only; every value must resolve to a real path id. */
  const PREREQS = {
    fundamentals: [],
    networking: ["fundamentals"],
    "operating-systems": ["fundamentals"],
    cryptography: ["fundamentals"],
    websec: ["fundamentals", "operating-systems"],
    pentest: ["networking", "operating-systems", "websec"],
    incident: ["networking", "websec"],
    forensics: ["incident", "operating-systems"],
    riskgov: ["fundamentals", "incident"],
    ctf: ["pentest", "incident"]
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (m) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
    ));
  }

  function resolveLang() {
    try { if (typeof Lang !== "undefined" && Lang) return Lang; } catch (e) { /* TDZ */ }
    try { if (typeof window !== "undefined" && window.Lang) return window.Lang; } catch (e2) { /* unreachable */ }
    return null;
  }
  const L10N = resolveLang();

  function T(key, params) {
    let s = "";
    try { s = L10N ? L10N.t(key, params) : ""; } catch (e) { s = ""; }
    return (!s || s === key) ? "" : s;
  }

  function bi(field) {
    if (!field) return "";
    if (typeof field !== "object") return String(field);
    const cur = (L10N && L10N.current) || "ar";
    return field[cur] || field.ar || field.en || "";
  }

  function paths() {
    try { return (typeof window.getLearningPaths === "function") ? (window.getLearningPaths() || []) : []; }
    catch (e) { return []; }
  }

  function pathById(id) { return paths().filter((p) => p && p.id === id)[0] || null; }

  function pathName(id) {
    const p = pathById(id);
    return p ? bi(p.title) : id;
  }

  function prereqMap() {
    const all = new Set(paths().map((p) => p.id));
    const out = {};
    Object.keys(PREREQS).forEach((id) => {
      if (!all.has(id)) return;
      out[id] = (PREREQS[id] || []).filter((pre) => all.has(pre) && pre !== id);
    });
    return out;
  }

  function results() {
    try {
      const store = (typeof window.readStore === "function") ? window.readStore() : null;
      return (store && typeof store.results === "object" && store.results) ? store.results : {};
    } catch (e) { return {}; }
  }

  function doneMap() {
    try {
      const s = window.PLATFORM_STORE;
      const v = (s && typeof s.get === "function") ? s.get("paths", null) : null;
      return (v && typeof v.done === "object" && v.done) ? v.done : {};
    } catch (e) { return {}; }
  }

  function banks() {
    try { return (window.QUIZZES && typeof window.QUIZZES === "object") ? window.QUIZZES : {}; }
    catch (e) { return {}; }
  }

  function resourcesFor(p) {
    return (Array.isArray(p.topics) ? p.topics.map((t) => t && t.res) : [])
      .concat(Array.isArray(p.related) ? p.related : [])
      .filter(Boolean);
  }

  function lessonsFor(p) {
    return (Array.isArray(p.topics) ? p.topics : [])
      .filter((t) => t && t.lsn && t.lsn.sub && t.lsn.key && t.t)
      .map((t) => ({
        title: bi(t.t),
        href: "#lesson/" + encodeURIComponent(t.lsn.sub) + "/" + encodeURIComponent(t.lsn.key)
      }));
  }

  function quizzesFor(p) {
    const qb = banks();
    const seen = new Set();
    return resourcesFor(p)
      .filter((r) => r.k === "quiz" && r.key && !seen.has(r.key) && (seen.add(r.key), true))
      .map((r) => ({
        key: r.key,
        name: (qb[r.key] && qb[r.key].name) || r.key,
        href: "#quiz"
      }));
  }

  function labsFor(p) {
    const seen = new Set();
    return resourcesFor(p)
      .filter((r) => r.k === "lab" && r.view && !seen.has(r.view) && (seen.add(r.view), true))
      .map((r) => ({
        view: r.view,
        name: T("labs." + (r.view === "cryptolab" ? "crypto" : r.view)) || r.view,
        href: "#" + encodeURIComponent(r.view)
      }));
  }

  function progressFor(p) {
    const topics = (Array.isArray(p.topics) ? p.topics : []).filter((t) => t && t.id);
    const done = doneMap();
    const saved = results();
    let count = 0, next = null;
    topics.forEach((t) => {
      const auto = !!(t.res && t.res.k === "quiz" && saved[t.res.key]);
      const manual = !!(done[p.id] && done[p.id][t.id] === true);
      if (auto || manual) count++;
      else if (!next) next = t;
    });
    return {
      done: count,
      total: topics.length,
      pct: topics.length ? Math.round((count / topics.length) * 100) : 0,
      next: next
    };
  }

  function depthFor(id, seen) {
    const guard = seen || new Set();
    if (guard.has(id)) return 0;
    guard.add(id);
    const pres = (prereqMap()[id] || []);
    return pres.reduce((max, pre) => Math.max(max, depthFor(pre, guard) + 1), 0);
  }

  function nextActionFor(p) {
    if (p.status === "soon") {
      return { label: T("skills.comingSoon"), href: "#paths", attrs: ' class="skill-next is-soon" aria-disabled="true"' };
    }
    const prog = progressFor(p);
    if (prog.total && !prog.next) {
      return { label: T("skills.reviewPath"), href: "#path/" + encodeURIComponent(p.id), attrs: "" };
    }
    const topic = prog.next;
    const res = topic && topic.res;
    if (res && res.k === "quiz" && res.key) {
      return {
        label: T("skills.startQuiz"),
        href: "#quiz",
        attrs: ' data-quiz-jump="' + esc(res.key) + '"'
      };
    }
    if (res && res.k === "lab" && res.view) {
      return { label: T("skills.openLab"), href: "#" + encodeURIComponent(res.view), attrs: "" };
    }
    if (res && res.k === "flash") {
      return { label: T("skills.reviewFlashcards"), href: "#flash", attrs: "" };
    }
    if (res && res.k === "tool" && res.id) {
      return {
        label: T("skills.openPath"),
        href: "#tools",
        attrs: ' data-tool-jump="' + esc(res.id) + '"'
      };
    }
    return { label: T("skills.openPath"), href: "#path/" + encodeURIComponent(p.id), attrs: "" };
  }

  function build() {
    return paths().map((p, index) => {
      const pres = (prereqMap()[p.id] || []).map((id) => ({ id, name: pathName(id) }));
      return {
        path: p,
        index: index,
        depth: depthFor(p.id),
        prerequisites: pres,
        progress: progressFor(p),
        lessons: lessonsFor(p),
        quizzes: quizzesFor(p),
        labs: labsFor(p),
        next: nextActionFor(p)
      };
    }).sort((a, b) => a.depth - b.depth || a.index - b.index);
  }

  function cardHtml(node, i) {
    const p = node.path;
    const id = "skillTitle-" + encodeURIComponent(p.id);
    const isSoon = p.status === "soon";
    const pres = node.prerequisites.length
      ? node.prerequisites.map((pre) => (
        '<a class="skill-chip" href="#path/' + encodeURIComponent(pre.id) + '">' + esc(pre.name) + "</a>"
      )).join("")
      : '<span class="skill-empty">' + esc(T("skills.prerequisitesNone")) + "</span>";
    const lessons = node.lessons.length
      ? node.lessons.map((l) => '<a href="' + esc(l.href) + '">' + esc(l.title) + "</a>").join("")
      : '<span class="skill-empty">' + esc(T("skills.noLessons")) + "</span>";
    const quizzes = node.quizzes.length
      ? node.quizzes.map((q) => (
        '<a href="' + esc(q.href) + '" data-quiz-jump="' + esc(q.key) + '">' + esc(q.name) + "</a>"
      )).join("")
      : '<span class="skill-empty">' + esc(T("skills.noQuizzes")) + "</span>";
    const labs = node.labs.length
      ? node.labs.map((l) => '<a href="' + esc(l.href) + '">' + esc(l.name) + "</a>").join("")
      : '<span class="skill-empty">' + esc(T("skills.noLabs")) + "</span>";
    const nextTopic = (node.progress.next && node.progress.next.t)
      ? esc(T("skills.nextTopic", { topic: bi(node.progress.next.t) }))
      : "";

    return (
      '<article class="skill-card' + (isSoon ? " is-soon" : "") + (p.recommended ? " is-recommended" : "") +
        '" role="listitem" tabindex="-1" data-skill-id="' + esc(p.id) + '" aria-labelledby="' + esc(id) + '">' +
        '<div class="skill-card-top">' +
          '<span class="skill-ico" aria-hidden="true">' + esc(p.ico || "🛡️") + "</span>" +
          '<h3 class="skill-title" id="' + esc(id) + '">' + esc(bi(p.title)) + "</h3>" +
          (p.recommended ? '<span class="skill-badge is-recommended">' + esc(T("skills.recommended")) + "</span>" : "") +
          (isSoon ? '<span class="skill-badge is-soon">' + esc(T("skills.soon")) + "</span>" : "") +
        "</div>" +
        '<p class="skill-desc">' + esc(bi(p.desc)) + "</p>" +
        '<div class="skill-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + node.progress.pct +
          '" aria-label="' + esc(T("skills.completion") + " — " + bi(p.title)) + '">' +
          '<i style="width:' + node.progress.pct + '%"></i>' +
        "</div>" +
        '<p class="skill-pct"><b>' + node.progress.pct + "%</b> · " + esc(T("skills.completion")) + "</p>" +
        '<dl class="skill-details">' +
          "<dt>" + esc(T("skills.prerequisites")) + "</dt><dd>" + pres + "</dd>" +
          "<dt>" + esc(T("skills.relatedLessons")) + "</dt><dd>" + lessons + "</dd>" +
          "<dt>" + esc(T("skills.relatedQuizzes")) + "</dt><dd>" + quizzes + "</dd>" +
          "<dt>" + esc(T("skills.relatedLabs")) + "</dt><dd>" + labs + "</dd>" +
        "</dl>" +
        '<div class="skill-next-row">' +
          "<span><b>" + esc(T("skills.nextAction")) + "</b>" + (nextTopic ? " · " + nextTopic : "") + "</span>" +
          '<a class="btn btn-sm btn-primary skill-next"' + node.next.attrs + ' href="' + esc(node.next.href) + '">' +
            esc(node.next.label) + "</a>" +
        "</div>" +
      "</article>"
    );
  }

  function listItemHtml(node) {
    const p = node.path;
    const pres = node.prerequisites.length
      ? node.prerequisites.map((pre) => pre.name).join(", ")
      : T("skills.prerequisitesNone");
    const lessons = node.lessons.length
      ? node.lessons.map((l) => l.title).join(", ")
      : T("skills.noLessons");
    const quizzes = node.quizzes.length
      ? node.quizzes.map((q) => q.name).join(", ")
      : T("skills.noQuizzes");
    const labs = node.labs.length
      ? node.labs.map((l) => l.name).join(", ")
      : T("skills.noLabs");

    return (
      '<li role="listitem">' +
        "<article>" +
          "<h3>" + esc(bi(p.title)) + "</h3>" +
          "<p><b>" + esc(T("skills.completion")) + ":</b> " + node.progress.pct + "%</p>" +
          "<p><b>" + esc(T("skills.prerequisites")) + ":</b> " + esc(pres) + "</p>" +
          "<p><b>" + esc(T("skills.relatedLessons")) + ":</b> " + esc(lessons) + "</p>" +
          "<p><b>" + esc(T("skills.relatedQuizzes")) + ":</b> " + esc(quizzes) + "</p>" +
          "<p><b>" + esc(T("skills.relatedLabs")) + ":</b> " + esc(labs) + "</p>" +
          "<p><b>" + esc(T("skills.nextAction")) + ":</b> " + esc(node.next.label) + "</p>" +
        "</article>" +
      "</li>"
    );
  }

  function render() {
    const nodes = build();
    treeEl.innerHTML = nodes.map(cardHtml).join("");
    listEl.innerHTML = nodes.map(listItemHtml).join("");
    if (!nodes.length) {
      treeEl.innerHTML = '<p class="skill-empty-state">' + esc(T("skills.comingSoon")) + "</p>";
    }
  }

  treeEl.addEventListener("keydown", (ev) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(ev.key)) return;
    const cards = Array.prototype.slice.call(treeEl.querySelectorAll(".skill-card"));
    if (!cards.length) return;
    const active = ev.target && ev.target.closest ? ev.target.closest(".skill-card") : null;
    const index = active ? cards.indexOf(active) : -1;
    let target = null;
    if (ev.key === "ArrowDown") target = cards[Math.min(index + 1, cards.length - 1)];
    else if (ev.key === "ArrowUp") target = cards[Math.max(index - 1, 0)];
    else if (ev.key === "Home") target = cards[0];
    else target = cards[cards.length - 1];
    if (target && target !== active) { ev.preventDefault(); target.focus(); }
  });

  document.addEventListener("nova:view-changed", (ev) => {
    if (ev.detail && ev.detail.viewId === "skills") render();
  });
  document.addEventListener("nova:progress-changed", render);
  try { if (L10N && typeof L10N.onSwitch === "function") L10N.onSwitch(render); } catch (e) { /* optional */ }

  render();

  window.PlatformSkillTree = { build: build, render: render, PREREQS: PREREQS };
})();
/* @@SKILL_TREE_END@@ */

/* @@REVISION_START@@ */
/* ============================================================
   MODULE 52 · Revision — transparent local review queue
   ------------------------------------------------------------
   Builds a review queue ONLY from the learner's own local data:
     · missed quiz questions      → "motmi-portal:missed"
     · unfinished lessons         → "motmi-portal:lessons" (last/undone)
     · bookmarked topics          → "motmi-portal:bookmarks"
     · stale review dates         → "motmi-portal:revision"
   Every item shows WHY it is queued and when it was last reviewed.
   Two modes: mistakes review (untimed) and five-minute practice.
   All state lives on the device; nothing is sent anywhere.
   ============================================================ */
(function initRevision() {
  "use strict";

  const mount = document.getElementById("revisionApp");
  if (!mount) return;

  const DAY_MS = 86400000;
  const STALE_AFTER = 7 * DAY_MS;
  const FIVE_MIN_MS = 5 * 60000;
  const QUEUE_CAP = 24;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (m) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
    ));
  }

  function resolveLang() {
    try { if (typeof Lang !== "undefined" && Lang) return Lang; } catch (e) { /* TDZ */ }
    try { if (typeof window !== "undefined" && window.Lang) return window.Lang; } catch (e2) { /* unreachable */ }
    return null;
  }
  const L10N = resolveLang();

  function T(key, params) {
    let s = "";
    try { s = L10N ? L10N.t(key, params) : ""; } catch (e) { s = ""; }
    return (!s || s === key) ? "" : s;
  }

  function store() {
    try { return (window.PLATFORM_STORE && typeof window.PLATFORM_STORE.get === "function") ? window.PLATFORM_STORE : null; }
    catch (e) { return null; }
  }
  function sget(key, fallback) {
    const s = store();
    if (!s) return fallback;
    try { return s.get(key, fallback); } catch (e) { return fallback; }
  }
  function sset(key, value) {
    const s = store();
    if (!s) return;
    try { s.set(key, value); } catch (e) { /* best effort */ }
  }

  function banks() {
    try { return (window.QUIZZES && typeof window.QUIZZES === "object") ? window.QUIZZES : {}; }
    catch (e) { return {}; }
  }
  function lessons() {
    try { return (window.PLATFORM_LESSONS && typeof window.PLATFORM_LESSONS === "object") ? window.PLATFORM_LESSONS : {}; }
    catch (e) { return {}; }
  }

  function notify() {
    try {
      if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("nova:progress-changed"));
    } catch (e) { /* optional */ }
  }

  /** Missed-question map, same shape as MODULE 13a MissedBank ("sub:index" → ts). */
  function missedMap() {
    const v = sget("missed", null);
    return (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
  }
  function missedRemove(sub, idx) {
    const m = missedMap();
    const id = sub + ":" + idx;
    if (id in m) { delete m[id]; sset("missed", m); notify(); }
  }

  function reviewedMap() {
    const v = sget("revision", null);
    return (v && typeof v === "object" && v.last && typeof v.last === "object") ? v.last : {};
  }
  function saveReview(id) {
    const v = sget("revision", null);
    const st = (v && typeof v === "object" && v.last && typeof v.last === "object") ? v : { v: 1, last: {} };
    st.last[id] = Date.now();
    sset("revision", st);
  }

  function lessonTitle(sub, topic) {
    const L = lessons();
    const l = L[sub] && L[sub][topic];
    if (l && l.title) {
      const cur = (L10N && L10N.current) || "ar";
      return l.title[cur] || l.title.ar || l.title.en || topic;
    }
    return topic;
  }


  /**
   * Build the transparent review queue from local data only.
   * Reason priority: missed → unfinished → bookmark → stale (deduped by id).
   * @returns {Array<{id:string,kind:string,subject:string,title:string,qIndex:number,lastReviewed:number}>}
   */
  function buildQueue() {
    const out = [];
    const seen = new Set();
    const last = reviewedMap();
    const now = Date.now();

    /* 1 · Missed questions (only ones still valid against live banks). */
    const m = missedMap();
    Object.keys(m).forEach((id) => {
      const ps = id.split(":");
      const idx = parseInt(ps[ps.length - 1], 10);
      const sub = ps.slice(0, -1).join(":");
      const bank = banks()[sub];
      if (!bank || !Array.isArray(bank.questions) || !Number.isInteger(idx) || idx < 0 || idx >= bank.questions.length) return;
      const rid = "missed:" + sub + ":" + idx;
      if (seen.has(rid)) return;
      seen.add(rid);
      out.push({ id: rid, kind: "missed", subject: sub, qIndex: idx, title: bank.name || sub, lastReviewed: last[rid] || 0 });
    });

    /* 2 · Unfinished lessons: explicitly un-completed, or the last-opened
       lesson that is not marked complete. */
    const ls = sget("lessons", null);
    if (ls && typeof ls === "object") {
      const done = (ls.done && typeof ls.done === "object") ? ls.done : {};
      const undone = (ls.undone && typeof ls.undone === "object") ? ls.undone : {};
      const keys = Object.keys(undone);
      if (ls.last && ls.last.key && !done[ls.last.key]) keys.push(ls.last.key);
      keys.forEach((k) => {
        const rid = "unfinished:" + k;
        if (seen.has(rid) || done[k]) return;
        const ps = String(k).split("/");
        seen.add(rid);
        out.push({ id: rid, kind: "unfinished", subject: ps[0] || "", topic: ps.slice(1).join("/"), title: lessonTitle(ps[0], ps.slice(1).join("/")), qIndex: -1, lastReviewed: last[rid] || 0 });
      });
    }

    /* 3 · Bookmarked topics. */
    const bm = sget("bookmarks", null);
    const items = (bm && typeof bm === "object" && bm.items && typeof bm.items === "object") ? bm.items : {};
    Object.keys(items).forEach((k) => {
      const rid = "bookmark:" + k;
      if (seen.has(rid)) return;
      const ps = String(k).split("/");
      seen.add(rid);
      out.push({ id: rid, kind: "bookmark", subject: ps[0] || "", topic: ps.slice(1).join("/"), title: lessonTitle(ps[0], ps.slice(1).join("/")), qIndex: -1, lastReviewed: last[rid] || 0 });
    });

    /* 4 · Stale reviews: reviewed before but not within the last 7 days,
       and not already surfaced by a stronger reason. */
    Object.keys(last).forEach((rid) => {
      if (seen.has(rid)) return;
      const ts = last[rid];
      if (typeof ts !== "number" || (now - ts) < STALE_AFTER) return;
      seen.add(rid);
      out.push({ id: rid, kind: "stale", subject: rid.split(":")[1] || "", qIndex: -1, title: rid, lastReviewed: ts });
    });

    return out;
  }

  const REASON_KEY = {
    missed: "review.reasonMissed",
    unfinished: "review.reasonUnfinished",
    bookmark: "review.reasonBookmark",
    stale: "review.reasonStale"
  };

  function fmtDate(ts) {
    try { return new Date(ts).toLocaleDateString(); } catch (e) { return ""; }
  }


  /* ---------- render: queue ---------- */

  function itemHtml(it) {
    const reason = T(REASON_KEY[it.kind]) || it.kind;
    const reviewed = it.lastReviewed ? T("review.lastReview", { date: fmtDate(it.lastReviewed) }) : T("review.neverReviewed");
    const openLesson = (it.kind === "unfinished" || it.kind === "bookmark") && it.subject && it.topic
      ? '<a class="btn btn-sm btn-ghost" href="#lesson/' + esc(it.subject) + '/' + esc(it.topic) + '">' + esc(T("review.openLesson")) + "</a>"
      : "";
    return '<li class="rev-item" data-rev-id="' + esc(it.id) + '">' +
      '<span class="rev-reason is-' + esc(it.kind) + '">' + esc(reason) + "</span>" +
      '<span class="rev-title">' + esc(it.title) + "</span>" +
      '<span class="rev-last">' + esc(reviewed) + "</span>" +
      openLesson +
      "</li>";
  }

  function render() {
    const queue = buildQueue();
    const shown = queue.slice(0, QUEUE_CAP);
    const missedCount = queue.filter((q) => q.kind === "missed").length;

    let html = '<div class="rev-shell">' +
      '<div class="rev-head"><h3>' + esc(T("review.title")) + "</h3>" +
      "<p>" + esc(T("review.sub")) + "</p></div>";

    if (!queue.length) {
      html += '<p class="rev-empty">' + esc(T("review.empty")) + "</p>";
    } else {
      html += '<p class="rev-showing">' + esc(T("review.showing", { shown: shown.length, total: queue.length })) + "</p>" +
        '<ul class="rev-list" role="list">' + shown.map(itemHtml).join("") + "</ul>" +
        '<div class="rev-actions">' +
        (missedCount
          ? '<button type="button" class="btn btn-sm btn-primary" data-rev-start="mistakes">' + esc(T("review.startMistakes")) + "</button>" +
            '<button type="button" class="btn btn-sm btn-ghost" data-rev-start="five">' + esc(T("review.startFive")) + "</button>"
          : '<p class="rev-empty">' + esc(T("review.noMistakes")) + "</p>") +
        "</div>";
    }
    mount.innerHTML = html + "</div>";
  }

  /* ---------- render: review session (mistakes / five-minute) ---------- */

  let session = null;   /* { mode, items, i, correct, answered, timerId, endAt } */
  let pendingStart = null;

  function missedItems() {
    return buildQueue().filter((q) => q.kind === "missed");
  }

  function fmtTime(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function stopTimer() {
    if (session && session.timerId) { try { clearInterval(session.timerId); } catch (e) { /* noop */ } }
  }

  function qField(q, key) {
    const v = q ? q[key] : "";
    if (v && typeof v === "object") { const cur = (L10N && L10N.current) || "ar"; return v[cur] || v.ar || v.en || ""; }
    return typeof v === "string" ? v : "";
  }

  function questionHtml(it) {
    const bank = banks()[it.subject];
    const q = bank && bank.questions ? bank.questions[it.qIndex] : null;
    if (!q) return "";
    const opts = Array.isArray(q.opts) ? q.opts : (Array.isArray(q.options) ? q.options : []);
    const correct = (typeof q.a === "number") ? q.a : ((typeof q.correct === "number") ? q.correct : 0);
    const ex = qField(q, "ex") || qField(q, "why");
    return '<div class="rev-card" data-rev-card="1">' +
      '<p class="rev-q">' + esc(qField(q, "q")) + "</p>" +
      '<div class="rev-opts">' + opts.map((o, oi) =>
        '<button type="button" class="rev-opt" data-rev-opt="' + (oi === correct ? 1 : 0) + '">' + esc((o && typeof o === "object") ? qField({ v: o }, "v") : o) + "</button>").join("") + "</div>" +
      '<p class="rev-ex is-hidden" data-rev-ex="1">' + esc(ex) + "</p>" +
      '<div class="rev-card-actions">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-rev-reveal="1">' + esc(T("review.reveal")) + "</button>" +
      '<button type="button" class="btn btn-sm btn-primary" data-rev-next="1" disabled>' + esc(T("review.next")) + "</button>" +
      "</div></div>";
  }


  function sessionShell(inner) {
    mount.innerHTML = '<div class="rev-shell is-session">' +
      '<div class="rev-topbar">' +
      '<strong>' + esc(session.mode === "five" ? T("review.startFive") : T("review.startMistakes")) + "</strong>" +
      (session.mode === "five" ? '<span class="rev-timer" role="timer" data-rev-timer="1">' + esc(T("review.timeLeft", { time: fmtTime(session.endAt - Date.now()) })) + "</span>" : "") +
      '<button type="button" class="btn btn-sm btn-ghost" data-rev-close="1">' + esc(T("review.close")) + "</button>" +
      "</div>" + inner + "</div>";
  }

  function showCard() {
    const it = session.items[session.i];
    if (!it) { finishSession(false); return; }
    sessionShell(questionHtml(it));
  }

  function startReview(mode) {
    stopTimer();
    const items = missedItems();
    if (!items.length) { session = null; render(); return; }
    session = { mode: mode, items: items, i: 0, correct: 0, answered: 0, timerId: 0, endAt: 0 };
    if (mode === "five") {
      session.endAt = Date.now() + FIVE_MIN_MS;
      session.timerId = setInterval(() => {
        if (!session) return;
        const left = session.endAt - Date.now();
        const el = mount.querySelector("[data-rev-timer]");
        if (el) el.textContent = T("review.timeLeft", { time: fmtTime(left) });
        if (left <= 0) finishSession(true);
      }, 1000);
    }
    showCard();
  }

  function finishSession(timeUp) {
    stopTimer();
    const s = session;
    if (!s) { render(); return; }
    /* Notify OTHER modules first: our own progress-changed listener skips
       re-rendering while a session is active, so the summary survives. */
    notify();
    session = null;
    const remaining = missedItems().length;
    mount.innerHTML = '<div class="rev-shell is-session">' +
      '<div class="rev-summary" role="status">' +
      (timeUp ? '<p class="rev-timeup">' + esc(T("review.timeUp")) + "</p>" : "") +
      "<p>" + esc(T("review.summary", { correct: s.correct, answered: s.answered, remaining: remaining })) + "</p>" +
      '<div class="rev-actions">' +
      '<button type="button" class="btn btn-sm btn-ghost" data-rev-close="1">' + esc(T("review.close")) + "</button>" +
      '<a href="#quiz" class="btn btn-sm btn-primary">' + esc(T("review.backToQuiz")) + "</a>" +
      "</div></div></div>";
  }

  /* Delegated interactions on the revision mount (survive re-renders). */
  mount.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;

    const start = t.closest("[data-rev-start]");
    if (start) { startReview(start.getAttribute("data-rev-start") === "five" ? "five" : "mistakes"); return; }

    if (t.closest("[data-rev-close]")) { stopTimer(); session = null; render(); return; }
    if (!session) return;

    const opt = t.closest("[data-rev-opt]");
    if (opt) {
      const card = opt.closest("[data-rev-card]");
      if (!card) return;
      const ok = opt.getAttribute("data-rev-opt") === "1";
      const it = session.items[session.i];
      session.answered++;
      if (ok) {
        session.correct++;
        /* Correct answer retires the mistake and stamps the review date. */
        missedRemove(it.subject, it.qIndex);
        saveReview(it.id);
        opt.classList.add("is-correct");
        card.classList.add("is-correct");
      } else {
        opt.classList.add("is-wrong");
        card.classList.add("is-wrong");
      }
      card.querySelectorAll(".rev-opt").forEach((b) => { b.disabled = true; });
      const ex = card.querySelector("[data-rev-ex]");
      if (ex && ex.textContent) ex.classList.remove("is-hidden");
      const next = card.querySelector("[data-rev-next]");
      if (next) next.disabled = false;
      return;
    }

    if (t.closest("[data-rev-reveal]")) {
      const card = t.closest("[data-rev-card]");
      const ex = card && card.querySelector("[data-rev-ex]");
      if (ex) ex.classList.toggle("is-hidden");
      return;
    }

    if (t.closest("[data-rev-next]")) {
      session.i++;
      showCard();
      return;
    }
  });

  /* "Review mistakes / five-minute practice" links from the lesson view:
     they jump to #progress; the session starts once the view is shown. */
  document.addEventListener("click", (e) => {
    const a = e.target && e.target.closest && e.target.closest("[data-review-start]");
    if (!a) return;
    pendingStart = a.getAttribute("data-review-start") === "five" ? "five" : "mistakes";
    setTimeout(() => {
      if (!pendingStart) return;
      const mode = pendingStart;
      pendingStart = null;
      startReview(mode);
    }, 400);
  });

  document.addEventListener("nova:view-changed", (ev) => {
    if (ev.detail && ev.detail.viewId === "progress") render();
  });
  document.addEventListener("nova:progress-changed", () => { if (!session) render(); });
  try { if (L10N && typeof L10N.onSwitch === "function") L10N.onSwitch(() => { if (!session) render(); }); } catch (e) { /* optional */ }

  render();

  window.PlatformRevision = { buildQueue: buildQueue, render: render, startReview: startReview };
})();
/* @@REVISION_END@@ */


/* ============================================================
   MODULE 53 · ExamPrep — exam preparation mode @@EXAM_PREP_START@@
   ------------------------------------------------------------
   Optional exam date + countdown, daily study recommendations,
   per-subject readiness percentages, weak-topic recommendations,
   a calm practice-exam mode, and a final readiness summary.

   Honesty rules (enforced by tests):
     · Every percentage derives from REAL local data only:
       readiness = 0.5·quizBest + 0.3·lessonCoverage + 0.2·mistakeFree
       (subjects with no linked lessons → weight redistributed and
       the UI says so). Nothing is invented.
     · All state lives in the local store key "exam-prep":
       { v:1, date:"YYYY-MM-DD"|null, runs:[{ts,total,correct,pct}] }
     · Read-only access to quiz results / lessons / missed stores.
     · No notifications, no network, no dependencies.
   ============================================================ */
(function initExamPrep() {
  "use strict";

  const mount = document.getElementById("examApp");
  if (!mount) return;

  const DAY_MS = 86400000;
  const W_QUIZ = 0.5, W_LESSONS = 0.3, W_MISTAKES = 0.2;
  const RUN_CAP = 10;
  const EXAM_PER_SUBJECT = 4;
  const REC_CAP = 4;
  const STORE_KEY = "exam-prep";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (m) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
    ));
  }
  function resolveLang() {
    try { if (typeof Lang !== "undefined" && Lang) return Lang; } catch (e) { /* TDZ */ }
    try { if (typeof window !== "undefined" && window.Lang) return window.Lang; } catch (e2) { /* unreachable */ }
    return null;
  }
  const L10N = resolveLang();
  function T(key, params) {
    let s = "";
    try { s = L10N ? L10N.t(key, params) : ""; } catch (e) { s = ""; }
    return (!s || s === key) ? "" : s;
  }
  function store() {
    try { return (window.PLATFORM_STORE && typeof window.PLATFORM_STORE.get === "function") ? window.PLATFORM_STORE : null; }
    catch (e) { return null; }
  }
  function sget(key, fallback) {
    const s = store();
    if (!s) return fallback;
    try { return s.get(key, fallback); } catch (e) { return fallback; }
  }
  function sset(key, value) {
    const s = store();
    if (!s) return;
    try { s.set(key, value); } catch (e) { /* best effort */ }
  }
  function notify() {
    try { if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("nova:progress-changed")); }
    catch (e) { /* best effort */ }
  }
  function banks() {
    try { return (window.QUIZZES && typeof window.QUIZZES === "object") ? window.QUIZZES : {}; }
    catch (e) { return {}; }
  }

  /* ---------- own store ---------- */
  function epGet() {
    const v = sget(STORE_KEY, null);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return { v: 1, date: typeof v.date === "string" ? v.date : null, runs: Array.isArray(v.runs) ? v.runs : [] };
    }
    return { v: 1, date: null, runs: [] };
  }
  function epSet(v) { sset(STORE_KEY, v); }


  /* ---------- real-data readers (read-only) ---------- */
  function subjects() {
    const reg = Array.isArray(window.PLATFORM_SUBJECTS) ? window.PLATFORM_SUBJECTS : [];
    const b = banks();
    const list = reg.filter((s) => s && b[s.quizKey || s.id]).map((s) => ({ key: s.quizKey || s.id }));
    return list.length ? list : Object.keys(b).map((k) => ({ key: k }));
  }
  function subjectName(key) {
    const b = banks();
    return (b[key] && b[key].name) || key;
  }
  function resultsMap() {
    try {
      const d = (typeof window.readStore === "function") ? window.readStore() : null;
      return (d && d.results && typeof d.results === "object" && !Array.isArray(d.results)) ? d.results : {};
    } catch (e) { return {}; }
  }
  function lessonsState() {
    const v = sget("lessons", null);
    const o = (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
    return {
      done: (o.done && typeof o.done === "object") ? o.done : {},
      undone: (o.undone && typeof o.undone === "object") ? o.undone : {},
      last: (o.last && typeof o.last === "object") ? o.last : null,
    };
  }
  function missedMap() {
    const m = sget("missed", {});
    return (m && typeof m === "object" && !Array.isArray(m)) ? m : {};
  }
  /* Total real lessons per subject, from the learning-path topics' lsn.sub. */
  function lessonTotals() {
    const out = {};
    try {
      const paths = (typeof window.getLearningPaths === "function") ? (window.getLearningPaths() || []) : [];
      paths.forEach((p) => (Array.isArray(p.topics) ? p.topics : []).forEach((t) => {
        if (t && t.lsn && t.lsn.sub) out[t.lsn.sub] = (out[t.lsn.sub] || 0) + 1;
      }));
    } catch (e) { /* paths module optional */ }
    return out;
  }

  /* ---------- honest readiness math ---------- */
  function readinessFor(key, totals) {
    const bank = banks()[key];
    const size = bank && Array.isArray(bank.questions) ? bank.questions.length : 0;
    const res = resultsMap()[key];
    const tested = !!(res && (typeof res.pct === "number" || typeof res.score === "number"));
    const quiz = tested
      ? (typeof res.pct === "number" ? res.pct : Math.round(((res.score || 0) / Math.max(res.total || size, 1)) * 100))
      : 0;
    const ls = lessonsState();
    const total = (totals && totals[key]) || 0;
    let done = 0;
    Object.keys(ls.done).forEach((k) => { if (k.indexOf(key + "/") === 0) done++; });
    const coverage = total ? Math.round((done / total) * 100) : 0;
    let missed = 0;
    Object.keys(missedMap()).forEach((k) => { if (k.indexOf(key + ":") === 0) missed++; });
    const mistakeFree = size ? Math.max(0, Math.round(100 * (1 - missed / size))) : 100;
    let wq = W_QUIZ, wl = W_LESSONS, wm = W_MISTAKES;
    if (!total) { const s = W_QUIZ + W_MISTAKES; wq = W_QUIZ / s; wl = 0; wm = W_MISTAKES / s; }
    const pct = Math.max(0, Math.min(100, Math.round(wq * quiz + wl * coverage + wm * mistakeFree)));
    return { key: key, pct: pct, quiz: quiz, coverage: coverage, mistakeFree: mistakeFree,
             tested: tested, lessonsTotal: total, lessonsDone: done, missed: missed, bankSize: size };
  }
  function buildReadiness() {
    const totals = lessonTotals();
    return subjects().map((s) => readinessFor(s.key, totals));
  }
  function overallReadiness(list) {
    return list.length ? Math.round(list.reduce((a, x) => a + x.pct, 0) / list.length) : 0;
  }
  function anyRealData() {
    const ls = lessonsState();
    return Object.keys(resultsMap()).length > 0 || Object.keys(ls.done).length > 0 || Object.keys(missedMap()).length > 0;
  }


  /* ---------- weak topics from the real missed store ---------- */
  function weakTopics() {
    const b = banks();
    const counts = {};
    Object.keys(missedMap()).forEach((id) => {
      const i = id.lastIndexOf(":");
      if (i < 0) return;
      const sub = id.slice(0, i), idx = +id.slice(i + 1);
      const q = b[sub] && Array.isArray(b[sub].questions) ? b[sub].questions[idx] : null;
      if (!q) return; /* prune entries that no longer resolve */
      const topic = (typeof q.topic === "string" && q.topic.trim()) ? q.topic.trim() : "—";
      const k = sub + "|" + topic;
      if (!counts[k]) counts[k] = { subject: sub, topic: topic, count: 0 };
      counts[k].count++;
    });
    return Object.keys(counts).map((k) => counts[k]).sort((a, z) => z.count - a.count).slice(0, 5);
  }

  /* ---------- daily recommendations (real data, calm tone) ---------- */
  function validMissedCount() {
    const b = banks();
    let n = 0;
    Object.keys(missedMap()).forEach((id) => {
      const i = id.lastIndexOf(":");
      if (i < 0) return;
      const sub = id.slice(0, i), idx = +id.slice(i + 1);
      if (b[sub] && Array.isArray(b[sub].questions) && b[sub].questions[idx]) n++;
    });
    return n;
  }
  function recommendations(readiness, weak, daysLeft) {
    const recs = [];
    const missed = validMissedCount();
    const urgent = (typeof daysLeft === "number") && daysLeft >= 0 && daysLeft <= 3;
    /* Close to the exam → fixing known mistakes first. */
    if (missed > 0) recs.push({ kind: "review", text: T("exam.recReview", { count: missed }), href: "#progress" });
    weak.slice(0, urgent ? 1 : 2).forEach((w) => {
      recs.push({ kind: "weak", text: T("exam.recWeak", { topic: w.topic, subject: subjectName(w.subject) }),
                  href: "#lesson/" + w.subject + "/" + w.topic });
    });
    const ls = lessonsState();
    const undoneKeys = Object.keys(ls.undone);
    if (undoneKeys.length) {
      const k = undoneKeys[0];
      recs.push({ kind: "lesson", text: T("exam.recLesson", { lesson: k.split("/").pop() }), href: "#lesson/" + k });
    }
    if (!urgent) recs.push({ kind: "practice", text: T("exam.recPractice"), href: "#progress" });
    readiness.slice().sort((a, z) => a.pct - z.pct).slice(0, 2).forEach((r) => {
      recs.push({ kind: "subject", text: T("exam.recSubject", { subject: subjectName(r.key), pct: r.pct }), href: "#quiz" });
    });
    return recs.slice(0, REC_CAP);
  }

  /* ---------- exam date + countdown ---------- */
  function parseDate(str) {
    if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const d = new Date(str + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  function daysUntil(dateStr) {
    const d = parseDate(dateStr);
    if (!d) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d.getTime() - today.getTime()) / DAY_MS);
  }

  /* ---------- practice exam deck (real questions, no timer) ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }
  function buildDeck() {
    const b = banks();
    const deck = [];
    subjects().forEach((s) => {
      const qs = (b[s.key] && Array.isArray(b[s.key].questions) ? b[s.key].questions : [])
        .map((q, i) => ({ q: q, idx: i }));
      shuffle(qs).slice(0, EXAM_PER_SUBJECT).forEach((it) => {
        deck.push({ subject: s.key, idx: it.idx, q: it.q });
      });
    });
    return shuffle(deck);
  }


  /* ---------- rendering ---------- */
  let session = null;      /* {deck, idx, correct, answered, picked} */
  let summary = null;      /* {total, correct, pct} */
  let statusMsg = "";      /* one-shot calm feedback line */
  let showForm = false;    /* date form visible */
  let promptDismissed = false;

  function dateCardHtml(ep) {
    const days = ep.date ? daysUntil(ep.date) : null;
    if (ep.date && days !== null && !showForm) {
      let line;
      if (days > 1) line = T("exam.daysLeft", { days: days });
      else if (days === 1) line = T("exam.dayLeft");
      else if (days === 0) line = T("exam.today");
      else line = T("exam.passed");
      const cls = days < 0 ? "is-passed" : days <= 3 ? "is-soon" : "";
      return (
        '<div class="exam-date-card">' +
        '<p class="exam-countdown ' + cls + '" role="status"><span class="exam-days" aria-hidden="true">' + esc(Math.max(days, 0)) + '</span> ' + esc(line) + '</p>' +
        '<p class="exam-date-value">' + esc(ep.date) + '</p>' +
        '<div class="exam-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-exam-edit="1">' + esc(T("exam.edit")) + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-exam-remove="1">' + esc(T("exam.remove")) + '</button>' +
        '</div></div>'
      );
    }
    return (
      '<div class="exam-date-card">' +
      '<p class="exam-muted">' + esc(T("exam.datePrompt")) + '</p>' +
      '<div class="exam-date-form">' +
      '<label class="sr-only" for="examDate">' + esc(T("exam.dateLabel")) + '</label>' +
      '<input type="date" id="examDate" class="exam-date-input" value="' + esc(ep.date || "") + '">' +
      '<button type="button" class="btn btn-primary btn-sm" data-exam-save="1">' + esc(T("exam.save")) + '</button>' +
      (!ep.date && !showForm ? '<button type="button" class="btn btn-ghost btn-sm" data-exam-skip="1">' + esc(T("exam.skip")) + '</button>' : '') +
      '</div></div>'
    );
  }

  function dailyHtml(recs) {
    const items = recs.length
      ? recs.map((r) => '<li class="exam-rec is-' + esc(r.kind) + '"><a href="' + esc(r.href) + '">' + esc(r.text) + '</a></li>').join("")
      : '<li class="exam-rec is-empty">' + esc(T("exam.dailyEmpty")) + '</li>';
    return '<section class="exam-block"><h4>' + esc(T("exam.dailyTitle")) + '</h4><ul class="exam-recs">' + items + '</ul></section>';
  }

  function readinessHtml(list) {
    const rows = list.map((r) => {
      const cls = r.pct >= 75 ? "is-high" : r.pct >= 50 ? "is-mid" : "is-low";
      const notes = [];
      if (!r.tested) notes.push(T("exam.notTested"));
      if (!r.lessonsTotal) notes.push(T("exam.noLessons"));
      return (
        '<li class="exam-subj">' +
        '<div class="exam-subj-head"><span class="exam-subj-name">' + esc(subjectName(r.key)) + '</span>' +
        '<span class="exam-pct ' + cls + '">' + esc(r.pct) + '%</span></div>' +
        '<div class="exam-bar" aria-hidden="true"><i style="width:' + r.pct + '%"></i></div>' +
        '<p class="exam-breakdown">' + esc(T("exam.breakdown", { quiz: r.quiz, lessons: r.coverage, mistakes: r.mistakeFree })) + '</p>' +
        (notes.length ? '<p class="exam-muted">' + esc(notes.join(" · ")) + '</p>' : '') +
        '</li>'
      );
    }).join("");
    return '<section class="exam-block"><h4>' + esc(T("exam.readinessTitle")) + '</h4>' +
      '<p class="exam-muted">' + esc(T("exam.readinessSub")) + '</p>' +
      '<ul class="exam-subjects">' + rows + '</ul></section>';
  }

  function weakHtml(weak) {
    const rows = weak.length
      ? weak.map((w) =>
          '<li class="exam-weak"><a href="#lesson/' + esc(w.subject) + '/' + esc(w.topic) + '">' + esc(w.topic) +
          '</a> <span class="exam-muted">' + esc(subjectName(w.subject)) + ' · ' + esc(T("exam.missedCount", { count: w.count })) + '</span></li>').join("")
      : '<li class="exam-weak is-empty">' + esc(T("exam.weakEmpty")) + '</li>';
    return '<section class="exam-block"><h4>' + esc(T("exam.weakTitle")) + '</h4><ul class="exam-weaks">' + rows + '</ul></section>';
  }


  function practiceHtml(ep) {
    const last = ep.runs.length ? ep.runs[ep.runs.length - 1] : null;
    const lastLine = last
      ? '<p class="exam-muted">' + esc(T("exam.lastRun", { pct: last.pct, date: new Date(last.ts).toLocaleDateString() })) + '</p>'
      : "";
    return (
      '<section class="exam-block exam-practice">' +
      '<h4>' + esc(T("exam.practiceTitle")) + '</h4>' +
      '<p class="exam-muted">' + esc(T("exam.practiceSub")) + '</p>' + lastLine +
      '<div class="exam-actions"><button type="button" class="btn btn-primary" data-exam-start="1">' + esc(T("exam.start")) + '</button></div>' +
      '</section>'
    );
  }

  function finalHtml(list) {
    if (!anyRealData()) {
      return (
        '<section class="exam-block exam-final"><h4>' + esc(T("exam.finalTitle")) + '</h4>' +
        '<p class="exam-muted">' + esc(T("exam.finalNoData")) + '</p>' +
        '<div class="exam-actions">' +
        '<a class="btn btn-primary btn-sm" href="#quiz">' + esc(T("exam.openQuiz")) + '</a>' +
        '<a class="btn btn-ghost btn-sm" href="#lessons">' + esc(T("exam.openLessons")) + '</a>' +
        '</div></section>'
      );
    }
    const overall = overallReadiness(list);
    const note = overall >= 75 ? T("exam.finalNoteHigh") : overall >= 50 ? T("exam.finalNoteMid") : T("exam.finalNoteLow");
    const cls = overall >= 75 ? "is-high" : overall >= 50 ? "is-mid" : "is-low";
    return (
      '<section class="exam-block exam-final"><h4>' + esc(T("exam.finalTitle")) + '</h4>' +
      '<div class="exam-overall ' + cls + '"><div class="exam-bar" aria-hidden="true"><i style="width:' + overall + '%"></i></div>' +
      '<p>' + esc(T("exam.finalLine", { pct: overall, note: note })) + '</p></div></section>'
    );
  }

  function renderMain() {
    const ep = epGet();
    const list = buildReadiness();
    const weak = weakTopics();
    const days = ep.date ? daysUntil(ep.date) : null;
    const recs = recommendations(list, weak, days);
    mount.innerHTML =
      '<div class="exam-shell">' +
      '<div class="exam-head"><h3>' + esc(T("exam.title")) + '</h3><p>' + esc(T("exam.sub")) + '</p></div>' +
      (statusMsg ? '<p class="exam-status" role="status">' + esc(statusMsg) + '</p>' : '') +
      (promptDismissed && !ep.date ? "" : dateCardHtml(ep)) +
      dailyHtml(recs) +
      readinessHtml(list) +
      weakHtml(weak) +
      practiceHtml(ep) +
      finalHtml(list) +
      '</div>';
    statusMsg = "";
  }

  function renderSession() {
    const item = session.deck[session.idx];
    const q = item.q;
    const opts = q.opts || q.options || [];
    const correct = typeof q.a === "number" ? q.a : q.correct;
    const last = session.idx === session.deck.length - 1;
    const optHtml = opts.map((o, i) => {
      let cls = "exam-opt";
      if (session.picked !== null) {
        if (i === correct) cls += " is-correct";
        else if (i === session.picked) cls += " is-wrong";
      }
      return '<button type="button" class="' + cls + '" data-exam-opt="' + i + '"' + (session.picked !== null ? " disabled" : "") + '>' + esc(o) + '</button>';
    }).join("");
    mount.innerHTML =
      '<div class="exam-shell">' +
      '<div class="exam-topbar"><span class="exam-progress-label">' + esc(T("exam.progress", { i: session.idx + 1, total: session.deck.length })) + '</span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-exam-finish="1">' + esc(T("exam.finish")) + '</button></div>' +
      '<div class="exam-card' + (session.picked !== null ? (session.picked === correct ? " is-correct" : " is-wrong") : "") + '">' +
      '<p class="exam-from">' + esc(T("exam.from", { subject: subjectName(item.subject) })) + '</p>' +
      '<p class="exam-q">' + esc(q.q) + '</p>' +
      '<div class="exam-opts">' + optHtml + '</div>' +
      (session.picked !== null
        ? '<p class="exam-fb" role="status">' + esc(session.picked === correct ? T("exam.correct") : T("exam.wrong")) + '</p>' +
          (q.ex ? '<p class="exam-ex">' + esc(q.ex) + '</p>' : "") +
          '<div class="exam-actions"><button type="button" class="btn btn-primary btn-sm" data-exam-next="1">' + esc(last ? T("exam.finish") : T("exam.next")) + '</button></div>'
        : "") +
      '</div></div>';
  }


  function renderSummary() {
    const enc = summary.pct >= 75 ? T("exam.encHigh") : summary.pct >= 50 ? T("exam.encMid") : T("exam.encLow");
    const cls = summary.pct >= 75 ? "is-high" : summary.pct >= 50 ? "is-mid" : "is-low";
    mount.innerHTML =
      '<div class="exam-shell"><div class="exam-summary ' + cls + '">' +
      '<h4>' + esc(T("exam.summaryTitle")) + '</h4>' +
      '<p class="exam-score">' + esc(T("exam.summaryLine", { correct: summary.correct, total: summary.total, pct: summary.pct })) + '</p>' +
      '<p class="exam-muted">' + esc(enc) + '</p>' +
      '<div class="exam-actions"><button type="button" class="btn btn-primary btn-sm" data-exam-close="1">' + esc(T("exam.finalTitle")) + '</button></div>' +
      '</div></div>';
  }

  function finishSession() {
    const total = session.deck.length;
    const pct = total ? Math.round((session.correct / total) * 100) : 0;
    const run = { ts: Date.now(), total: total, correct: session.correct, pct: pct };
    const ep = epGet();
    ep.runs = (ep.runs.concat([run])).slice(-RUN_CAP);
    epSet(ep);
    notify(); /* notify BEFORE clearing so the listener below re-renders the main view */
    summary = { total: total, correct: session.correct, pct: pct };
    session = null;
    renderSummary();
  }

  function render() {
    if (session) { renderSession(); return; }
    if (summary) { renderSummary(); return; }
    renderMain();
  }

  /* ---------- one delegated listener (survives innerHTML re-renders) ---------- */
  if (!window.__examDelegated) {
    window.__examDelegated = true;
    mount.addEventListener("click", (e) => {
      const t = e.target.closest ? e.target.closest("[data-exam-save],[data-exam-edit],[data-exam-remove],[data-exam-skip],[data-exam-start],[data-exam-opt],[data-exam-next],[data-exam-finish],[data-exam-close]") : null;
      if (!t) return;

      if (t.hasAttribute("data-exam-save")) {
        const input = mount.querySelector("#examDate");
        const val = input && input.value ? String(input.value) : "";
        if (!parseDate(val)) { statusMsg = T("exam.invalidDate"); renderMain(); return; }
        const ep = epGet();
        ep.date = val;
        epSet(ep);
        statusMsg = T("exam.dateSaved");
        showForm = false;
        promptDismissed = false;
        notify(); renderMain(); return;
      }
      if (t.hasAttribute("data-exam-edit")) { showForm = true; renderMain(); return; }
      if (t.hasAttribute("data-exam-remove")) {
        const ep = epGet();
        ep.date = null;
        epSet(ep);
        statusMsg = T("exam.dateRemoved");
        showForm = false;
        notify(); renderMain(); return;
      }
      if (t.hasAttribute("data-exam-skip")) { promptDismissed = true; renderMain(); return; }

      if (t.hasAttribute("data-exam-start")) {
        const deck = buildDeck();
        if (!deck.length) return;
        summary = null;
        session = { deck: deck, idx: 0, correct: 0, answered: 0, picked: null };
        renderSession(); return;
      }
      if (t.hasAttribute("data-exam-opt") && session && session.picked === null) {
        const item = session.deck[session.idx];
        const q = item.q;
        const correct = typeof q.a === "number" ? q.a : q.correct;
        session.picked = +t.getAttribute("data-exam-opt");
        session.answered++;
        if (session.picked === correct) session.correct++;
        renderSession(); return;
      }
      if (t.hasAttribute("data-exam-next") && session) {
        if (session.idx >= session.deck.length - 1) { finishSession(); return; }
        session.idx++;
        session.picked = null;
        renderSession(); return;
      }
      if (t.hasAttribute("data-exam-finish") && session) { finishSession(); return; }
      if (t.hasAttribute("data-exam-close")) { summary = null; renderMain(); return; }
    });
  }

  /* Live refresh: language switch + progress changes (unless mid-session). */
  try { if (L10N && typeof L10N.onSwitch === "function") L10N.onSwitch(() => { if (!session && !summary) renderMain(); }); } catch (e) { /* optional */ }
  document.addEventListener("nova:progress-changed", () => { if (!session && !summary) renderMain(); });

  /* Diagnostics / tests */
  window.PlatformExamPrep = {
    buildReadiness: buildReadiness,
    readinessFor: readinessFor,
    weakTopics: weakTopics,
    recommendations: recommendations,
    daysUntil: daysUntil,
    parseDate: parseDate,
    buildDeck: buildDeck,
    overallReadiness: overallReadiness,
  };

  renderMain();
})();
/* @@EXAM_PREP_END@@ */

