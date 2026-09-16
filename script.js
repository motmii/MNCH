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
  if (done) { overlay.setAttribute("aria-hidden", "true"); return; }

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

  /** Toggle a value in an array state field. @param {string} key @param {string} val @returns {void} */
  function toggleArr(key, val) {
    var arr = state[key];
    var idx = arr.indexOf(val);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
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
    localStorage.setItem(STORE_KEY, JSON.stringify({ done: true }));
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  /** Show step N (1-based). @param {number} n @returns {void} */
  function showStep(n) {
    Object.keys(stepEls).forEach(function (k) {
      var el = stepEls[k];
      if (el) el.hidden = String(+k) !== String(n);
    });
    step = n;
    if (backBtn) backBtn.style.display = n > 1 ? "" : "none";
    if (nextBtn) nextBtn.style.display = n >= OS_STEPS ? "none" : "";
    if (startLink) startLink.style.display = n >= OS_STEPS ? "" : "none";
    if (overlay) overlay.setAttribute("aria-hidden", "false");
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
    if (step === 2) { state.subjects = []; showStep(step + 1); return; }
    finishOnboarding();
  }

  function handleLevel(e) {
    var btn = e.target.closest(".btn-level");
    if (!btn) return;
    state.level = btn.dataset.osLevel;
    var btns = document.querySelectorAll(".btn-level");
    btns.forEach(function (b) { b.classList.toggle("is-active", b === btn); });
    showStep(step + 1);
  }

  function handleSubject(e) {
    var btn = e.target.closest(".btn-subject");
    if (!btn) return;
    toggleArr("subjects", btn.dataset.osSubj);
    btn.classList.toggle("is-active");
  }

  function handleStyle(e) {
    var btn = e.target.closest(".btn-style");
    if (!btn) return;
    toggleArr("styles", btn.dataset.osStyle);
    btn.classList.toggle("is-active");
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
      `<button type="button" class="q-mode-btn${timedMode ? "" : " is-active"}" data-mode="practice">${esc(Lang.qt("modePractice"))}</button>` +
      `<button type="button" class="q-mode-btn${timedMode ? " is-active" : ""}" data-mode="exam">${esc(Lang.qt("modeExam"))}</button>` +
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

  app.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;

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

  app.addEventListener("click", (e) => {
    const modeBtn = e.target && e.target.closest && e.target.closest(".q-mode-btn");
    if (modeBtn) {
      const newMode = modeBtn.dataset.mode === "exam";
      if (newMode !== timedMode) {
        timedMode = newMode;
        Store.set("timed", timedMode);
        renderPicks();
      }
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
      "meta.title": "منصة أمن المعلومات — الترم الحالي",
      "nav.home": "الرئيسية", "nav.paths": "مسارات التعلم", "nav.subjects": "المواد",
      "nav.quiz": "الاختبارات", "nav.tools": "الأدوات", "nav.labs": "المعامل",
      "nav.flashcards": "البطاقات", "nav.progress": "تقدمك", "nav.about": "حول المنصة", "nav.contact": "التواصل",
      "nav.games": "تحديات CTF", "nav.redteam": "المختبر الهجومي", "nav.ir": "الاستجابة للحوادث", "nav.cryptolab": "مختبر التشفير",
      "nav.cta": "ابدأ التعلم",
      "hero.eyebrow": "✦ منصة تعليمية وتدريبية عملية — دبلوم أمن المعلومات (تجسير مهني)",
      "hero.title1": "منصة تعليمية", "hero.title2": "وتدريبية عملية ", "hero.titleAccent": "لطلاب أمن المعلومات",
      "hero.sub": "منصة عربية متكاملة لطلاب أمن المعلومات: تعلّم أساسيات كل مادة، راجِع المصطلحات بالبطاقات، اختبر نفسك بأسئلة عملية، وطبّق ما تعلّمته بأدوات أمنية ومعامل محاكاة حقيقية — كل ذلك يعمل داخل متصفحك وبدون إنترنت.",
      "hero.ctaStart": "ابدأ رحلة التعلم", "hero.ctaTools": "جرّب الأدوات", "hero.ctaLabs": "ادخل المعامل العملية",
      "hero.ctaQuiz": "ابدأ الاختبار", "hero.ctaSubjects": "تصفح المواد",
      "hero.credit": "صُمّم وطُوّر بواسطة <em class=\"grad\">أحمد مطمي</em>",
      "hero.statq": "سؤال تدريبي", "hero.stats": "مواد دراسية",
      "hero.statTools": "أدوات تفاعلية",
      "hero.continueLabel": "متابعة التعلم", "hero.continueBtn": "تابع من حيث توقفت",
      "hero.continueAt": "عند السؤال {i} من {total}",
      "hero.continueResults": "لديك نتائج محفوظة — أكمل مراجعتك", "hero.continueReviewBtn": "اعرض تقدمك",
      "features.materials": "مواد دراسية", "features.quizzes": "اختبارات تدريبية",
      "features.summaries": "ملخصات", "features.flashcards": "بطاقات تعليمية",
      "features.tools": "أدوات أمنية تفاعلية", "features.labs": "معامل عملية",
      "subjects.eyebrow": "المواد الدراسية والتجميعات",
      "subjects.title": "مواد <em class=\"grad\">الترم الحالي</em> وملفاتها",
      "subjects.sub": "مواد الفصل الدراسي الحالي وفق الخطة الرسمية: رمز المقرر والساعات والجدول، ولكل مادة بنك أسئلة تدريبي كامل مع شرح لكل إجابة.",
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
      "progress.lessons": "الدروس المكتملة",
      "progress.labs": "المعامل المكتملة",
      "progress.flashcards": "البطاقات المراجعة",
      "progress.paths": "إنجاز المسارات",
      "progress.attempts": "محاولات الاختبار",
      "progress.reviewWrong": "راجع أخطاءك",
      "progress.overall": "التقدم الكلي"
    },
    en: {
      "meta.title": "Information Security Platform — Current Semester",
      "nav.home": "Home", "nav.paths": "Learning Paths", "nav.subjects": "Subjects",
      "nav.quiz": "Quizzes", "nav.tools": "Tools", "nav.labs": "Labs",
      "nav.flashcards": "Flashcards", "nav.progress": "Your Progress", "nav.about": "About", "nav.contact": "Contact",
      "nav.games": "CTF Lab", "nav.redteam": "Red Team Lab", "nav.ir": "Incident Response", "nav.cryptolab": "Crypto Lab",
      "nav.cta": "Start learning",
      "hero.eyebrow": "✦ An educational & practical training platform — Infosec Diploma (Professional Bridging)",
      "hero.title1": "An educational &", "hero.title2": "practical training platform ", "hero.titleAccent": "for Infosec students",
      "hero.sub": "An Arabic-first platform for Information Security students: learn the fundamentals of every subject, review terms with flashcards, quiz yourself with practical questions, then apply what you learned with security tools and real simulation labs — all in your browser, even offline.",
      "hero.ctaStart": "Start Learning", "hero.ctaTools": "Try the Tools", "hero.ctaLabs": "Enter the Labs",
      "hero.ctaQuiz": "Start the Quiz", "hero.ctaSubjects": "Browse Subjects",
      "hero.credit": "Designed &amp; developed by <em class=\"grad\">Ahmed Motmi</em>",
      "hero.statq": "practice questions", "hero.stats": "courses",
      "hero.statTools": "interactive tools",
      "hero.continueLabel": "Continue learning", "hero.continueBtn": "Resume quiz",
      "hero.continueAt": "At question {i} of {total}",
      "hero.continueResults": "You have saved results — keep up the review", "hero.continueReviewBtn": "View my progress",
      "features.materials": "Study materials", "features.quizzes": "Practice quizzes",
      "features.summaries": "Summaries", "features.flashcards": "Flashcards",
      "features.tools": "Interactive security tools", "features.labs": "Practical labs",
      "subjects.eyebrow": "Course Materials & Bundles",
      "subjects.title": "Current Semester <em class=\"grad\">Courses</em> & Files",
      "subjects.sub": "The current semester's official study-plan courses — course code, credit hours and schedule — each with a full practice question bank and an explanation for every answer.",
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
      "progress.lessons": "Lessons completed",
      "progress.labs": "Labs completed",
      "progress.flashcards": "Flashcards reviewed",
      "progress.paths": "Path progress",
      "progress.attempts": "Quiz attempts",
      "progress.reviewWrong": "Review incorrect answers",
      "progress.overall": "Overall progress"
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
    $id("hero"), $id("paths"), $id("path"), $id("subjects"), $id("tools"),
    $id("labs"), $id("flash"), $id("quiz"), $id("progress"),
    $id("games"), $id("redteam"), $id("ir"), $id("cryptolab"),
    $id("about"), $id("contact"), $id("lesson"),
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
    /* Deep links like "#path/networks" resolve to the shared path-detail
       view; the concrete path id stays in the URL (preserved in activate)
       and is read from the hash by MODULE 39 (LearningPaths). */
    if (/^path\//.test(id)) return "path";
     if (/^lesson\//.test(id)) return "lesson";
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
       unknown hashes to "hero" and would hijack non-view anchors). */
    const rawId = (link.getAttribute("href") || "").replace(/^#/, "").trim();
    if (!VIEW_IDS.has(rawId)) return; /* not a view link — allow default */

    e.preventDefault();
    activate(rawId);

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

function showLesson(subjectKey,topicKey){
  const root=lessonBody();if(!root)return;
  const lesson=(LESSONS[subjectKey]&&LESSONS[subjectKey][topicKey])||null;
  const cur=Lang.current;
  window.NovaViews.activate("lesson");

  if(!lesson){
    // Honest placeholder for topics without authored lessons
    root.innerHTML=`<div class="lesson-shell"><div class="lesson-placeholder"><span class="lesson-ico" aria-hidden="true">📝</span><h2>${escHtml(Lang.t("lesson.soonTitle"))}</h2><p>${escHtml(Lang.t("lesson.soonBody"))}</p><a href="#quiz" class="btn btn-primary">${escHtml(Lang.t("lesson.backToQuiz"))}</a></div></div>`;
    return;
  }

  /* Lightweight completion tracking for the Progress hub: opening an
     authored lesson marks it as reviewed locally (motmi-portal:lessons).
     Additive; never touches the lesson rendering. */
  try {
    const lkey = subjectKey + "/" + topicKey;
    const curL = Store.get("lessons", null);
    const st = (curL && typeof curL === "object" && curL.done && typeof curL.done === "object") ? curL : { v: 1, done: {} };
    if (!st.done[lkey]) {
      st.done[lkey] = true;
      Store.set("lessons", st);
      if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("nova:progress-changed"));
    }
  } catch {}

  const B=lesson;
  const title=B.title[cur]||B.title.ar||"";
  const expl=B.explanation[cur]||B.explanation.ar||"";

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

  root.innerHTML=`<div class="lesson-shell">
    <div class="lesson-header"><h2>${escHtml(title)}</h2></div>
    <div class="lesson-block"><p class="lesson-explain">${escHtml(expl)}</p></div>
    ${conceptsHtml}${exampleHtml}${mistakesHtml}${termHtml}
    ${practiceHtml}
    ${nextHtml}
  </div>`;
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
      if (st.done[view]) delete st.done[view];
      else st.done[view] = true;
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