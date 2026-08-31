/* ============================================================
   منصة أمن المعلومات — الترم الثاني
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

  /**
   * Open/close the drawer and lock body scrolling.
   * @param {boolean} open Desired state.
   * @returns {void}
   */
  function setMenu(open) {
    if (!menu || !burger) return;
    menu.classList.toggle("is-open", open);
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "إغلاق القائمة" : "فتح القائمة");
    document.body.style.overflow = open ? "hidden" : "";
    if (open) {
      /* Move focus into the drawer so keyboard users are not stranded. */
      const first = menu.querySelector("a, button");
      if (first) first.focus({ preventScroll: true });
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

    /* Honeypot: silently accept but discard bot submissions. */
    const honeypot = form.querySelector('[name="_gotcha"]');
    if (honeypot && honeypot.value.trim()) return;

    fields.forEach((f) => {
      const g = f.closest(".form-field");
      const bad = !f.checkValidity();
      if (g) g.classList.toggle("has-error", bad);
      f.setAttribute("aria-invalid", bad ? "true" : "false");
    });
    if (!form.checkValidity()) {
      showStatus(Lang.t("contact.invalid"), true);
      return;
    }

    setLoading(true);
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
   MODULE 13 · QuizEngine — question bank (6 subjects)
   Question shape: { q, ex, opts[4], a, t? (per-question seconds) }
   ============================================================ */
/* ============================================================
   Embedded fallback bank — mirrors data/quizzes.json schema.
   Question shape: { q, ex, opts[4], a, t? (seconds override) }
   Used whenever the external file fails or validates empty.
   ============================================================ */
const MOCK_QUIZZES = {
  networks: { name: "الشبكات وأمنها", questions: [
    { q: "ما الوظيفة الأساسية لجدار الحماية (Firewall)؟", ex: "يفحص الجدار حزم الشبكة الواردة والصادرة ويطبّق قواعد سماح/منع معرّفة مسبقًا.", opts: ["منع تشفير البيانات", "فلترة حركة الشبكة وفق سياسات الأمان", "تسريع الاتصال بالإنترنت", "تخزين كلمات المرور"], a: 1, t: 45 },
    { q: "أي بروتوكول يؤمّن الاتصال بين المتصفح والخادم؟", ex: "HTTPS هو HTTP فوق طبقة TLS: يشفّر القناة ويؤكد هوية الخادم عبر شهادة رقمية.", opts: ["FTP", "HTTPS / TLS", "SMTP", "SNMP"], a: 1 },
    { q: "ما المقصود بهجوم حجب الخدمة (DoS)؟", ex: "يُغرق المهاجم الخادم بحجم هائل من الطلبات حتى يعجز عن خدمة المستخدمين الشرعيين.", opts: ["إغراق الخادم بطلبات حتى تعطّل الخدمة", "سرقة بيانات المستخدمين", "حقن أوامر في قاعدة البيانات", "التنصت على حزم الشبكة"], a: 0 }
  ]},
  os: { name: "أمن أنظمة التشغيل", questions: [
    { q: "أي نوع حساب يُنصح به للمستخدمين العاديين؟", ex: "الحساب محدود الصلاحيات يقلّل أثر الأخطاء والبرمجيات الخبيثة على ملفات النظام.", opts: ["حساب بصلاحيات كاملة", "حساب بصلاحيات محدودة", "حساب ضيف بكلمة مرور فارغة", "حساب مشترك بين الجميع"], a: 1 },
    { q: "من أفضل ممارسات تأمين نظام التشغيل؟", ex: "التحديثات الدورية ترقّع ثغرات معروفة قبل استغلالها من قبل المهاجمين.", opts: ["تعطيل التحديثات نهائيًا", "تفعيل التحديثات دوريًا", "إلغاء كلمات المرور", "حساب واحد للجميع"], a: 1, t: 20 },
    { q: "ما غرض التحكم في حساب المستخدم (UAC)؟", ex: "يطلب UAC موافقتك قبل أي تغيير يحتاج صلاحيات مرتفعة، فيمنع تنفيذ الكود الخبيث بصمت.", opts: ["طلب الموافقة للعمليات ذات الصلاحيات المرتفعة", "تشفير القرص بالكامل", "حظر الإنترنت تمامًا", "مراقبة سرعة الجهاز"], a: 0 }
  ]},
  crypto: { name: "التشفير وتطبيقاته", questions: [
    { q: "في التشفير المتماثل، مفتاح التشفير وفك التشفير:", ex: "AES مثال شهير: نفس المفتاح للعمليتين — سريع لكن تأمين تبادل المفتاح تحدٍّ أساسي.", opts: ["نفس المفتاح", "مفتاحان مختلفان تمامًا", "لا يوجد مفتاح", "مفتاح عام واحد"], a: 0 },
    { q: "ما الوظيفة الرئيسية لدالة التجزئة (Hash)؟", ex: "بصمة أحادية الاتجاه ثابتة الطول للتحقق من تكامل البيانات — لا يمكن استرجاع الأصل منها.", opts: ["تشفير البيانات كاملةً", "إنتاج بصمة للتحقق من التكامل", "ضغط الملفات", "إدارة المفاتيح"], a: 1 },
    { q: "التشفير غير المتماثل يعتمد على:", ex: "في RSA: العام يشفّر والخاص يفك — يحل مشكلة توزيع المفاتيح ويمكّن التوقيع الرقمي.", opts: ["زوج مفاتيح عام/خاص", "مفتاح واحد مشترك", "عدم استخدام مفاتيح", "كلمة مرور نصية"], a: 0 }
  ]},
  db: { name: "قواعد البيانات وأمنها", questions: [
    { q: "كيف يحدث هجوم حقن SQL؟", ex: "بدمج مدخلات المستخدم داخل الاستعلام دون تنقية، فيغيّر المهاجم منطق الاستعلام.", opts: ["بإدراج استعلامات ضارة عبر المدخلات", "بتخمين كلمات المرور", "بقراءة ملفات النظام", "بتعطيل الشبكة"], a: 0 },
    { q: "أفضل حماية للبيانات المخزّنة في قاعدة البيانات؟", ex: "التشفير عند التخزين يحمي البيانات حتى لو وقعت ملفات القرص بأيدي المهاجم.", opts: ["تشفير البيانات عند التخزين", "كلمة مرور قوية فقط", "حذف النسخ الاحتياطية", "منع القراءة تمامًا"], a: 0 },
    { q: "مبدأ أقل الصلاحيات (Least Privilege) يعني:", ex: "كل حساب يحصل على أدنى صلاحيات ضرورية لعمله — فيقلّ سطح الهجوم وحدود الضرر.", opts: ["منح أدنى صلاحيات تؤدي العمل", "صلاحيات كاملة للجميع", "منع كل الصلاحيات", "توزيع عشوائي"], a: 0 }
  ]},
  secureCode: { name: "البرمجة الآمنة", questions: [
    { q: "أي ممارسة تقلّل خطر ثغرات الحقن؟", ex: "التحقق من المدخلات وتنقيتها خط الدفاع الأول ضد الحقن وXSS وأغلب ثغرات الويب.", opts: ["التحقق من المدخلات وتنقيتها", "تجاهل المدخلات", "تشفير كود المصدر", "حظر المستخدمين"], a: 0 },
    { q: "لماذا لا توضع الأسرار والمفاتيح داخل كود المصدر؟", ex: "المستودعات قد تتسرب؛ تُوضع الأسرار في متغيرات بيئة أو خزائن أسرار مخصصة.", opts: ["لأنها قد تتسرب لأي مطّلع على الكود", "لتحسين الأداء", "لتقليل حجم الملف", "لتسهيل الدعم الفني"], a: 0 },
    { q: "ما أساس تقنية البرمجة الآمنة؟", ex: "القاعدة الذهبية: لا تثق بأي مدخل خارجي دون تحقق صارم — داخليًا كان أم خارجيًا.", opts: ["التحقق الصارم من المدخلات والمخرجات", "الكتابة السريعة دون مراجعة", "تعطيل كلمات المرور", "تجاهل سجلات الدخول"], a: 0 }
  ]},
  ethical: { name: "الاختراق الأخلاقي والفحص", questions: [
    { q: "ما أول مرحلة في اختبار الاختراق؟", ex: "جمع المعلومات (نشط/سلبي) يحدد نطاق الهدف وسطح الهجوم قبل أي خطوة فعلية.", opts: ["جمع المعلومات عن الهدف", "تنفيذ الهجوم فورًا", "كتابة التقرير النهائي", "إصلاح الثغرات"], a: 0, t: 25 },
    { q: "ما الذي يميز المخترق الأخلاقي عن المهاجم؟", ex: "الإذن الخطي المسبق والالتزام بالنطاق المتفق عليه هما الفاصل القانوني والأخلاقي.", opts: ["الإذن الرسمي والالتزام بالأخلاقيات", "استخدام أدوات أسرع", "جهل تقنيات الاختراق", "جمع بيانات غير قانونية"], a: 0 },
    { q: "أي مجموعة أدوات تُستخدم في فحص الثغرات؟", ex: "Nmap لاستكشاف المنافذ، Nessus لفحص الثغرات، وBurp Suite لتطبيقات الويب.", opts: ["Nmap و Nessus و Burp Suite", "Word و Excel", "برامج التصميم", "مشغلات الفيديو"], a: 0 }
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

/** Which view the quiz surface shows ("pick" | "question" | "result"). */
var quizView = "pick";
/** Last computed result payload, kept for locale re-renders. */
var lastResult = null;

/** @type {number|null} */ var timerId = null;
/** @type {number} */ var deadline = 0;

/**
 * Read a deep clone of the quiz store from the in-memory cache.
 * @returns {{results:Object,progress:Object}} Store snapshot.
 */
function readStore() {
  return JSON.parse(JSON.stringify(quizCache));
}

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
  curKey = null;
  curIndex = 0;
  score = 0;
  total = 0;
  answered = false;
  outcomes = [];
}

/** Start per-question countdown in timed mode. @returns {void} */
function startTimer() {
  stopTimer();
  if (!timedMode) return;
  /* Per-question override (q.t seconds), falling back to TIME_PER_Q. */
  var qSecs = Number(current().t) > 0 ? Number(current().t) : TIME_PER_Q;
  deadline = Date.now() + qSecs * 1000;
  const tick = () => {
    var remain = Math.max(0, deadline - Date.now());
    var frac = remain / (qSecs * 1000);
    var fill = app.querySelector(".q-timer-fill");
    if (fill) fill.style.width = (frac * 100).toFixed(1) + "%";
    var bar = app.querySelector(".q-timer");
    if (bar) bar.classList.toggle("is-low", frac <= 0.25);
    var tEl = app.querySelector("#qTimerText");
    if (tEl) tEl.textContent = "\u23F1 " + Math.ceil(remain / 1000) + " \u062B";
    if (remain <= 0) timeoutAnswer();
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
    return (
      `<button type="button" class="q-pick" data-sub="${esc(k)}"${res ? ' data-resume="1"' : ""}>` +
      `${esc(QUIZZES[k].name)}` +
      (best ? `<span class="q-best">${esc(Lang.qt("best", { pct: best.pct }))}</span>` : "") +
      (res ? `<span class="q-resume">${esc(Lang.qt("resume"))}</span>` : "") +
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
      '<label class="q-switch">' +
      `<input type="checkbox" id="timedToggle"${timedMode ? " checked" : ""} />` +
      '<span class="track" aria-hidden="true"></span>' +
      `<span class="switch-label">${esc(Lang.qt("timed", { sec: TIME_PER_Q }))}</span>` +
      "</label>" +
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
function startQuiz(key, resume = false) {
  /* Guard: reject unknown keys (tampered DOM/data) instead of crashing. */
  const bank = QUIZZES[key];
  if (!bank || !Array.isArray(bank.questions) || bank.questions.length === 0) return;
  curKey = key;
  total = bank.questions.length;
  const p = resume ? (readStore().progress || {})[key] : null;

  if (p && p.idx > 0 && p.idx < total && p.total === total) {
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
  return QUIZZES[curKey].questions[curIndex];
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

  app.innerHTML =
    '<div class="q-top-bar">' +
    `<span class="q-subject-title">${esc(QUIZZES[curKey].name)}</span>` +
    `<span class="q-count">${esc(Lang.qt("count", { i: curIndex + 1, total }))}</span>` +
    `<span class="q-score">${esc(Lang.qt("score", { n: score }))}</span>` +
    timerText +
    "</div>" +
    timerBar +
    `<div class="q-progress"><div class="q-progress-fill" style="width:${pct}%"></div></div>` +
    (resumeNote ? `<p class="q-note">${esc(resumeNote)}</p>` : "") +
    `<div class="q-question" id="qQ">${esc(q.q)}</div>` +
    `<div class="q-options" role="group" aria-labelledby="qQ">${optsHtml}</div>` +
    '<p class="q-feedback" id="qFeedback" role="status"></p>' +
    `<div class="q-actions"><button type="button" class="btn btn-ghost" id="qRestart">${esc(Lang.qt("restartSubject"))}</button></div>`;

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
  opts[q.a].classList.add("is-correct");
  if (!correct) opts[i].classList.add("is-wrong");

  finishQuestion(correct, i);
}

/** Time expired: reveal the correct answer without scoring. @returns {void} */
function timeoutAnswer() {
  stopTimer();
  if (answered) return;
  answered = true;
  Sfx.play("timeout");
  const q = current();
  const opts = $$(".q-option", app);
  opts.forEach((b) => b.setAttribute("disabled", ""));
  opts[q.a].classList.add("is-correct");
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

  if (correct === null) {
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

  /* Explanation drawer — auto-open on wrong/timeout answers */
  if (q.ex) {
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
}

/**
 * Render the final score, persist the attempt (best kept), clear progress.
 * @returns {void}
 */
function showResult() {
  stopTimer();
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

  /* Keep the payload so a locale switch can re-render this view. */
  lastResult = { key: curKey, score, total, pct, prevBest, outcomes: outcomes.slice() };
  renderResult();
}

/**
 * Render the result screen from the stored payload (pure DOM work,
 * no persistence side effects — safe to call on locale switches).
 * @returns {void}
 */
function renderResult() {
  quizView = "result";
  const { key, score: s, total: tt, pct, prevBest, outcomes: oc } = lastResult;
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

  app.innerHTML =
    '<div class="q-result">' +
    `<div class="q-result-score" role="status">${s}/${tt}</div>` +
    `<p class="q-result-label">${esc(Lang.qt("resultIn", { sub: QUIZZES[key].name }))}${timedMode ? esc(Lang.qt("timedSuffix")) : ""}</p>` +
    `<p class="q-result-note">${esc(note)}</p>` +
    breakdownHtml +
    `<p class="q-result-label">${esc(Lang.qt("bestSaved", { pct: Math.max(prevBest, pct) }))}${newRecord ? esc(Lang.qt("newRec")) : ""}</p>` +
    "</div>" +
    '<div class="q-actions">' +
    `<button type="button" class="btn btn-ghost" id="qAgain">${esc(Lang.qt("retake"))}</button>` +
    `<button type="button" class="btn btn-primary" id="qPick">${esc(Lang.qt("pickOther"))}</button>` +
    "</div>";
  /* #qAgain / #qPick clicks are handled by the delegated listeners. */
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

  app.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;

    const pick = t.closest(".q-pick");
    if (pick) { startQuiz(pick.dataset.sub, pick.dataset.resume === "1"); return; }

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

    const opt = t.closest(".q-option");
    if (opt && !opt.hasAttribute("disabled")) {
      Sfx.play("tick");
      handleAnswer(parseInt(opt.dataset.i, 10));
    }
  });

  app.addEventListener("change", (e) => {
    if (e.target && e.target.id === "timedToggle") {
      timedMode = e.target.checked;
      Store.set("timed", timedMode);
      renderPicks();
    }
  });
}

/** Wipe saved quiz data and repaint the picker. @returns {Promise<void>} */
async function clearQuizData() {
  try { await IdbStore.del("quiz"); } catch {}
  quizCache = { results: {}, progress: {} };
  renderPicks();
}

/* Bootstrap the quiz UI only if its mount point exists. */
(async function bootQuiz() {
  if (!app) return;
  bindQuizDelegation();
  try { await IdbStore.migrateFromLocalStorage(); } catch {}
  try {
    const saved = await IdbStore.get("quiz");
    if (saved && typeof saved === "object") {
      quizCache = { results: saved.results || {}, progress: saved.progress || {} };
    }
  } catch {}
  cacheReady = true;
  renderPicks();
  loadQuizData();

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
   * fallback so the demo works on non-secure contexts too.
   * @param {string} text Input text.
   * @returns {Promise<string>} Hex digest (64 chars).
   */
  async function sha256Hex(text) {
    if (window.crypto && window.crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
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
      visualize(hex);
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
  function analyze(pw) {
    const rules = {
      len12: pw.length >= 12,
      case: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
      digit: /\d/.test(pw),
      symbol: /[^A-Za-z0-9\s]/.test(pw),
      common: pw.length > 0 && !COMMON.some((c) => pw.toLowerCase().includes(c))
    };
    let pool = 0;
    if (/[a-z]/.test(pw)) pool += 26;
    if (/[A-Z]/.test(pw)) pool += 26;
    if (/\d/.test(pw)) pool += 10;
    if (/[^A-Za-z0-9\s]/.test(pw)) pool += 33;
    if (/[\u0600-\u06FF]/.test(pw)) pool += 36; // Arabic letters
    const bits = pool > 0 ? Math.log2(pool) : 0; // guard: zero-pool input
    const entropy = pw.length ? +(pw.length * bits).toFixed(1) : 0;
    return { rules, entropy };
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
    verdict.textContent = pw
      ? `${label} — الإنتروبيا: ${entropy} بت · زمن الكسر التقديري: ${crackLabel}`
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
      "meta.title": "منصة أمن المعلومات — الترم الثاني",
      "nav.home": "الرئيسية", "nav.subjects": "المواد الدراسية", "nav.tools": "الأدوات",
      "nav.quiz": "الاختبارات", "nav.flashcards": "البطاقات التعليمية", "nav.games": "اللعبة", "nav.contact": "التواصل",
      "nav.cta": "ابدأ الاختبار",
      "hero.eyebrow": "✦ دبلوم أمن المعلومات — الترم الثاني",
      "hero.title1": "منصة أمن", "hero.title2": "المعلومات ", "hero.titleAccent": "الترم الثاني",
      "hero.sub": "مصدرك المتكامل لطلاب دبلوم أمن المعلومات: اختبارات تجريبية بنتائج فورية، ملخصات جاهزة، وبنوك أسئلة لكل مادة — راجع، اختبر، وثبّت درجتك.",
      "hero.ctaQuiz": "ابدأ الاختبار", "hero.ctaSubjects": "تصفح المواد",
      "hero.credit": "صُمّم وطُوّر بواسطة <em class=\"grad\">أحمد مطمي</em>",
      "hero.statq": "سؤال تدريبي", "hero.stats": "مواد دراسية",
      "hero.statTools": "أدوات تفاعلية",
      "features.materials": "مواد دراسية", "features.quizzes": "اختبارات تدريبية",
      "features.summaries": "ملخصات", "features.flashcards": "بطاقات تعليمية",
      "features.tools": "أدوات أمنية تفاعلية",
      "subjects.eyebrow": "المواد الدراسية والتجميعات",
      "subjects.title": "مواد <em class=\"grad\">الترم الثاني</em> وملفاتها",
      "subjects.sub": "اختر مادتك لتحميل التجميعات، بنوك الأسئلة، والملخصات الجاهزة للمراجعة والطباعة.",
      "tools.eyebrow": "أدوات الأمن السيبراني",
      "tools.title": "جرّب <em class=\"grad\">الأدوات</em> مباشرة",
      "tools.sub": "ستّ أدوات تفاعلية تعمل بالكامل في متصفحك — من تشفير Caesar إلى تحليل JWT وحساب الشبكات.",
      "quiz.eyebrow": "الاختبارات التجريبية", "quiz.title": "اختبر نفسك في كل مادة",
      "quiz.sub": "أسئلة لكل مادة مع شرح فوري لكل إجابة، وضع مؤقّت اختياري، وحفظ تلقائي للنتائج.",
      "quiz.hint": "💡 اختر مادة للبدء — يمكنك استكمال محاولة سابقة أو إعادة الاختبار من الصفر.",
      "flash.eyebrow": "البطاقات التعليمية",
      "flash.title": "راجع المصطلحات <em class=\"grad\">بالبطاقات</em>",
      "flash.sub": "اضغط على أي بطاقة لقلبها — مصطلح أمني بالعربية مقابل معناه بالإنجليزية مع شرح موجز.",
      "flash.shuffle": "خلط البطاقات", "flash.tap": "اضغط للقلب",
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
      "footer.local": "دبلوم أمن المعلومات • الترم الثاني"
    },
    en: {
      "meta.title": "Information Security Platform — Semester 2",
      "nav.home": "Home", "nav.subjects": "Subjects", "nav.tools": "Tools",
      "nav.quiz": "Quizzes", "nav.flashcards": "Flashcards", "nav.games": "CTF Lab", "nav.contact": "Contact",
      "nav.cta": "Start a quiz",
      "hero.eyebrow": "✦ Information Security Diploma — Semester 2",
      "hero.title1": "Information Security", "hero.title2": "Platform ", "hero.titleAccent": "Semester 2",
      "hero.sub": "Your all-in-one hub for the Information Security diploma: instant-feedback practice exams, ready summaries and question banks for every course — review, test yourself and lock in your grade.",
      "hero.ctaQuiz": "Start the Quiz", "hero.ctaSubjects": "Browse Subjects",
      "hero.credit": "Designed &amp; developed by <em class=\"grad\">Ahmed Motmi</em>",
      "hero.statq": "practice questions", "hero.stats": "courses",
      "hero.statTools": "interactive tools",
      "features.materials": "Study materials", "features.quizzes": "Practice quizzes",
      "features.summaries": "Summaries", "features.flashcards": "Flashcards",
      "features.tools": "Interactive security tools",
      "subjects.eyebrow": "Course Materials & Bundles",
      "subjects.title": "Semester 2 <em class=\"grad\">Courses</em> & Files",
      "subjects.sub": "Pick your course to download bundles, question banks and print-ready summaries.",
      "tools.eyebrow": "Cybersecurity Tools",
      "tools.title": "Try the <em class=\"grad\">Tools</em> Live",
      "tools.sub": "Six interactive tools running entirely in your browser — from Caesar cipher to JWT decoding and subnet math.",
      "quiz.eyebrow": "Practice Exams", "quiz.title": "Test yourself in every course",
      "quiz.sub": "Questions per course with instant explanations, an optional timer and automatic progress saving.",
      "quiz.hint": "💡 Pick a course to begin — you can resume a previous attempt or retake it from scratch.",
      "flash.eyebrow": "Flashcards",
      "flash.title": "Review Terms with <em class=\"grad\">Flashcards</em>",
      "flash.sub": "Tap any card to flip it — a security term in English with its Arabic meaning and a short explanation.",
      "flash.shuffle": "Shuffle cards", "flash.tap": "Tap to flip",
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
      "footer.local": "Information Security Diploma • Semester 2"
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
      noteLo: "تحتاج إلى مراجعة المادة ثم أعد الاختبار."
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
      noteLo: "You need to review the material, then retake the exam."
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
      "Caesar        :   decrypt <text> <shift> · brute <text> · flag <v>";
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
   MODULE 27 · Salawat reminder toast
   A small "Salat ala Al-Nabi" reminder shown once per 24h. The
   dismissal timestamp is persisted in localStorage; once closed
   the toast does not reappear for 24 hours. No audio playback.
   Self-contained (no dependency on other modules/helpers) so it
   is easy to copy into another project, and non-intrusive: it
   never steals focus and supports Escape to dismiss.
   ============================================================ */
(function initSalawatToast() {
  "use strict";
  const el = document.getElementById("salawatToast");
  const btn = document.getElementById("salawatClose");
  if (!el || !btn) return;                    // markup absent → no-op

  const STORE_KEY = "salawat_dismissed_at";
  const HIDE_MS = 24 * 60 * 60 * 1000;         // 24 hours
  const SHOW_DELAY_MS = 1800;                   // let the preloader settle

  let started = false;

  /* True when the reminder may be shown (no key yet, or past the 24h window).
     Falls back to showing (rather than permanently hiding) if storage is
     unavailable. */
  function shouldShow() {
    try {
      const at = parseInt(localStorage.getItem(STORE_KEY), 10);
      if (!isFinite(at) || at <= 0) return true;
      return (Date.now() - at) >= HIDE_MS;
    } catch (err) { return true; }
  }

  function dismiss() {
    try { localStorage.setItem(STORE_KEY, String(Date.now())); } catch (err) {}
    el.classList.remove("is-visible");
    el.setAttribute("aria-hidden", "true");
  }

  function reveal() {
    if (started) return;
    started = true;
    if (shouldShow()) {
      el.classList.add("is-visible");
      el.removeAttribute("aria-hidden");
    }
  }

  btn.addEventListener("click", dismiss);
  // Accessibility: dismiss via Escape from anywhere on the page.
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" || ev.key === "Esc") dismiss();
  });

  // Everything is in the DOM (script sits just before </body>); wait for
  // the full window load so the toast slides in after the preloader fades.
  if (document.readyState === "complete") {
    setTimeout(reveal, SHOW_DELAY_MS);
  } else {
    window.addEventListener("load", function () {
      setTimeout(reveal, SHOW_DELAY_MS);
    });
  }

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

  const TERMS = [
    { ar: "السرية", en: "Confidentiality", ex: "منع الكشف غير المصرّح به عن المعلومات — وصولها لمن يُسمح لهم فقط." },
    { ar: "السلامة", en: "Integrity", ex: "ضمان عدم تغيير البيانات أو التلاعب بها إلا بشكل مصرّح به." },
    { ar: "التوافر", en: "Availability", ex: "إتاحة الأنظمة والبيانات عند الحاجة دون انقطاع." },
    { ar: "الجدار الناري", en: "Firewall", ex: "يراقب حركة الشبكة ويسمح أو يمنع الاتصالات وفق قواعد محددة." },
    { ar: "الشبكة الافتراضية الخاصة", en: "VPN", ex: "نفق مشفّر ينقل بياناتك بأمان عبر الشبكات العامة." },
    { ar: "التشفير المتماثل", en: "Symmetric Encryption", ex: "مفتاح واحد للتشفير وفك التشفير — سريع لكن توزيع المفتاح تحدٍّ (AES)." },
    { ar: "التشفير غير المتماثل", en: "Asymmetric Encryption", ex: "مفتاح عام للتشفير وآخر خاص لفكه — أساس التوقيع الرقمي (RSA)." },
    { ar: "دالة التجزئة", en: "Hash Function", ex: "بصمة ثابتة الطول لأي مدخل ولا يمكن عكسها — مثل SHA-256." },
    { ar: "التصيّد الاحتيالي", en: "Phishing", ex: "خداع المستخدم برسائل أو مواقع مزيفة للحصول على بياناته." },
    { ar: "برمجيات الفدية", en: "Ransomware", ex: "تشفير ملفات الضحية وطلب فدية مقابل إعادتها." },
    { ar: "حقن SQL", en: "SQL Injection", ex: "إدخال استعلامات خبيثة عبر حقول الإدخال للوصول إلى قاعدة البيانات." },
    { ar: "حجب الخدمة الموزّع", en: "DDoS", ex: "إغراق الخادم بطلبات هائلة من مصادر متعددة حتى يتوقف عن الخدمة." },
    { ar: "الرجل في المنتصف", en: "Man-in-the-Middle", ex: "اعتراض الاتصال بين طرفين للتنصت أو التلاعب بالبيانات." },
    { ar: "الهندسة الاجتماعية", en: "Social Engineering", ex: "استغلال العامل البشري — الثقة أو الخوف — للحصول على معلومات أو وصول." },
    { ar: "المصادقة الثنائية", en: "Two-Factor Authentication", ex: "عاملان مختلفان للتحقق — حتى لو سُرّبت كلمة المرور." },
    { ar: "الثغرة الأمنية", en: "Vulnerability", ex: "ضعف قابل للاستغلال في نظام أو تطبيق يهدد أمنه." },
    { ar: "الاستطلاع", en: "Reconnaissance", ex: "جمع معلومات عن الهدف قبل أي هجوم — خطوة أساسية في الاختراق الأخلاقي." },
    { ar: "برمجية خبيثة", en: "Malware", ex: "أي برنامج مصمم لإلحاق الضرر: فيروسات، أحصنة طروادة، تجسس، وفدية." }
  ];

  let query = "";

  function cardHtml(t, i) {
    return (
      '<button type="button" class="flash-card" data-i="' + i + '" aria-pressed="false" aria-label="' + escF(t.ar) + " — " + escF(t.en) + '">' +
      '<span class="flash-inner" aria-hidden="true">' +
      '<span class="flash-face flash-face-front"><span class="flash-term">' + escF(t.ar) + '</span><span class="flash-hint" data-i18n="flash.tap">اضغط للقلب</span></span>' +
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
  });

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
    return { questions: questions, subjects: keys.length, tools: $$(".tool-card").length };
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
    const done = !(c.questions === 0 && c.subjects === 0);
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
    $id("hero"), $id("subjects"), $id("tools"),
    $id("flash"), $id("quiz"), $id("games"),
    $id("about"), $id("contact"),
  ].filter(Boolean);

  /** Set of valid view IDs for hash validation. @type {Set<string>} */
  const VIEW_IDS = new Set(VIEWS.map((v) => v.id));

  /** Currently active view ID. @type {string|null} */
  let activeView = null;

  /* Enable JS-only view-switching CSS (progressive enhancement:
     without JS the class is absent → all views visible, normal scroll). */
  document.body.classList.add("js-view-switcher");

  /**
   * Resolve a hash fragment to a valid view ID.
   * @param {string} hash Raw hash (e.g. "#quiz" or "quiz" or "").
   * @returns {string} Validated view ID (defaults to "hero").
   */
  function resolveViewId(hash) {
    const id = String(hash || "").replace(/^#/, "").trim();
    return VIEW_IDS.has(id) ? id : "hero";
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
    viewId = resolveViewId(viewId);
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
      const newHash = "#" + viewId;
      if (location.hash !== newHash) {
        if (opts.replace) {
          history.replaceState({ view: viewId }, "", newHash);
        } else if (history.pushState) {
          history.pushState({ view: viewId }, "", newHash);
        }
      }
    }

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
    const viewId = resolveViewId(link.getAttribute("href"));
    if (!VIEW_IDS.has(viewId)) return; /* not a view link — allow default */

    e.preventDefault();
    activate(viewId);

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

  /* --- Initialize: activate view from URL hash or default to hero --- */
  activate(resolveViewId(location.hash), { replace: true });
})();

/* ============================================================
   MODULE 36 · ThemeSwitch — eye-friendly dark mode by default
   Dark (#0b0f19 slate) ships as the default theme; the navbar
   toggle switches to the light palette. Preference persists in
   localStorage via Store ("motmi-portal:theme"), and is restored
   pre-paint by the inline <head> script (no flash of wrong theme).
   ============================================================ */
(function () {
  const root = document.documentElement;
  const btn = $id("themeToggle");
  const LBL_LIGHT = "الوضع الداكن / Dark mode";   /* shown while light is ON */
  const LBL_DARK = "الوضع الفاتح / Light mode";   /* shown while dark is ON  */

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

  /* Restore stored preference (dark is the default). */
  apply(Store.get("theme") === "light" ? "light" : "dark");

  if (btn) {
    btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      Store.set("theme", next);
    });
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

})();