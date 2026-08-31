/* ============================================================
   NovaAPI — عميل REST مركزي للواجهة الأمامية
   Central API client for /api/v1:
   - JWT attach + single-flight refresh on 401
   - Envelope unwrap ({ success, data }) + typed errors
   - IndexedDB outbox (motmi-outbox/pending) for offline writes
     replayed via Background Sync tag "nova-progress-sync"
   Exposed as window.NovaAPI. Loaded before nova-ui.js.
   ============================================================ */
(function initNovaAPI() {
  "use strict";

  const BASE = "/api/v1";
  const AUTH_KEY = "nova.auth.v1";

  /* ---------- token store (localStorage) ----------------- */
  const TokenStore = {
    get() {
      try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; }
      catch { return null; }
    },
    set(tokens) {
      if (tokens) localStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
      else localStorage.removeItem(AUTH_KEY);
      /* Mirror into IndexedDB so sw.js can replay the sync outbox
         with a Bearer token even when no tab is open. */
      mirrorAuth(tokens);
    },
    get accessToken() { return (this.get() || {}).accessToken || null; },
    get refreshToken() { return (this.get() || {}).refreshToken || null; },
    get user() { return (this.get() || {}).user || null; },
    get isLoggedIn() { return !!(this.get() && this.get().accessToken); },
  };

  /* ---------- typed error -------------------------------- */
  class NovaApiError extends Error {
    constructor(message, status, code, details) {
      super(message);
      this.name = "NovaApiError";
      this.status = status || 0;
      this.code = code || null;
      this.details = details || null;
    }
  }

  /** Friendly Arabic messages per HTTP status family. */
  function messageFor(status, fallback) {
    if (status === 401) return "انتهت الجلسة — سجّل الدخول من جديد";
    if (status === 403) return "لا تملك صلاحية لهذا الإجراء";
    if (status === 404) return "العنصر المطلوب غير موجود";
    if (status === 422) return "تحقّق من الحقول المُدخلة";
    if (status === 429) return "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة";
    if (status >= 500) return "خطأ في الخادم — أعد المحاولة لاحقاً";
    return fallback || "تعذّر إكمال الطلب";
  }

  /* ---------- single-flight refresh ----------------------- */
  let refreshPromise = null;
  function refreshTokens() {
    if (refreshPromise) return refreshPromise;
    const rt = TokenStore.refreshToken;
    if (!rt) return Promise.reject(new NovaApiError("لا توجد جلسة", 401));
    refreshPromise = fetch(BASE + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json || json.success === false) {
          TokenStore.set(null);
          throw new NovaApiError("انتهت الجلسة — سجّل الدخول من جديد", 401);
        }
        TokenStore.set(json.data);
        return json.data;
      })
      .finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  /* ---------- request core -------------------------------- */
  /**
   * Perform an API call. Unwraps the { success, data } envelope and
   * transparently refreshes the access token once on 401.
   * @param {string} path  path after /api/v1 (e.g. "/analytics/dashboard")
   * @param {object=} opts { method, body, auth, retry, signal, idempotencyKey }
   * @returns {Promise<any>} the envelope's `data`
   */
  async function request(path, opts) {
    opts = opts || {};
    const method = (opts.method || "GET").toUpperCase();
    const headers = { Accept: "application/json" };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    if (opts.auth !== false && TokenStore.accessToken) {
      headers.Authorization = "Bearer " + TokenStore.accessToken;
    }
    if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });
    } catch (netErr) {
      if (opts.signal && opts.signal.aborted) throw netErr;
      throw new NovaApiError("لا يوجد اتصال — تم الحفظ للإرسال لاحقاً", 0, "OFFLINE");
    }

    /* 401 → refresh once, then retry the original call. */
    if (res.status === 401 && opts.retry !== false && TokenStore.refreshToken) {
      try {
        await refreshTokens();
      } catch {
        document.dispatchEvent(new CustomEvent("nova:auth-expired"));
        throw new NovaApiError(messageFor(401), 401);
      }
      return request(path, { ...opts, retry: false });
    }

    const json = await res.json().catch(() => null);

    if (!res.ok || (json && json.success === false)) {
      const err = (json && json.error) || {};
      document.dispatchEvent(new CustomEvent("nova:api-error", {
        detail: { status: res.status, message: err.message || messageFor(res.status), path },
      }));
      throw new NovaApiError(
        err.message || messageFor(res.status),
        res.status,
        err.code || null,
        err.details || null
      );
    }
    return json ? json.data : null;
  }

  const get = (path, opts) => request(path, { ...opts, method: "GET" });
  const post = (path, body, opts) => request(path, { ...opts, method: "POST", body });
  const patch = (path, body, opts) => request(path, { ...opts, method: "PATCH", body });
  const del = (path, opts) => request(path, { ...opts, method: "DELETE" });

  /* ---------- offline outbox (IndexedDB) ------------------
     Same DB/store names as sw.js ("motmi-outbox" / "pending")
     so the SW sync handler and the page share one queue. */
  const OUTBOX_DB = "motmi-outbox";
  const OUTBOX_STORE = "pending";
  const AUTH_STORE = "auth"; /* JWT mirror so sw.js can replay with Bearer */
  const SYNC_TAG = "nova-progress-sync";

  /** @returns {Promise<IDBDatabase>} */
  function openOutbox() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(OUTBOX_DB, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: "eventId" });
        }
        if (!db.objectStoreNames.contains(AUTH_STORE)) {
          db.createObjectStore(AUTH_STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Mirror the current JWTs into IndexedDB (best-effort). The SW's
   * background-sync replay reads them because localStorage is
   * inaccessible from a service worker.
   */
  async function mirrorAuth(tokens) {
    try {
      const db = await openOutbox();
      if (!db.objectStoreNames.contains(AUTH_STORE)) { db.close(); return; }
      await new Promise((resolve, reject) => {
        const tx = db.transaction(AUTH_STORE, "readwrite");
        const store = tx.objectStore(AUTH_STORE);
        if (tokens) store.put({ id: "current", tokens });
        else store.delete("current");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch { /* mirror is opportunistic — never block the UI */ }
  }

  function outboxTx(db, mode) {
    return db.transaction(OUTBOX_STORE, mode).objectStore(OUTBOX_STORE);
  }

  /** Queue one offline mutation event. @param {{eventId:string,kind:string,payload:object,occurredAt?:string}} ev */
  async function enqueue(ev) {
    ev.occurredAt = ev.occurredAt || new Date().toISOString();
    const db = await openOutbox();
    await new Promise((resolve, reject) => {
      const rq = outboxTx(db, "readwrite").put(ev);
      rq.onsuccess = resolve;
      rq.onerror = () => reject(rq.error);
    });
    db.close();
    const size = await outboxCount();
    document.dispatchEvent(new CustomEvent("nova:outbox-changed", { detail: { size } }));
    registerSync().catch(() => {});
    return ev;
  }

  /** @returns {Promise<number>} queued event count */
  async function outboxCount() {
    const db = await openOutbox();
    const n = await new Promise((resolve, reject) => {
      const rq = outboxTx(db, "readonly").count();
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    db.close();
    return n;
  }

  /**
   * Replay queued events to POST /sync/progress (batches of 100).
   * Events stay queued until the server acks the whole batch, so a
   * mid-flush crash never loses data; server-side dedupe makes the
   * replay idempotent.
   */
  async function flushOutbox() {
    if (!navigator.onLine) return 0;
    const db = await openOutbox();
    const all = await new Promise((resolve, reject) => {
      const rq = outboxTx(db, "readonly").getAll();
      rq.onsuccess = () => resolve(rq.result || []);
      rq.onerror = () => reject(rq.error);
    });
    db.close();
    if (!all.length) return 0;

    let acked = 0;
    for (let i = 0; i < all.length; i += 100) {
      const batch = all.slice(i, i + 100);
      try {
        await post("/sync/progress", { events: batch }, { auth: true, retry: true });
        acked += batch.length;
      } catch (err) {
        /* 4xx (not 401/429) → poison event; drop the batch so it can't
           block the queue forever. Network/5xx → stop and retry later. */
        if (err.status && err.status !== 401 && err.status !== 429 && err.status >= 400 && err.status < 500) {
          acked += batch.length;
        } else {
          break;
        }
      }
    }
    if (acked > 0) {
      const db2 = await openOutbox();
      const first = all.slice(0, acked);
      await new Promise((resolve, reject) => {
        const store = outboxTx(db2, "readwrite");
        first.forEach((ev) => store.delete(ev.eventId));
        store.transaction.oncomplete = resolve;
        store.transaction.onerror = () => reject(store.transaction.error);
      });
      db2.close();
    }
    const size = await outboxCount();
    document.dispatchEvent(new CustomEvent("nova:outbox-changed", { detail: { size } }));
    return acked;
  }

  /** Ask the SW for a background sync when the tab closes. */
  async function registerSync() {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    const reg = await navigator.serviceWorker.ready;
    if (reg.sync && reg.sync.register) await reg.sync.register(SYNC_TAG);
  }

  /* ---------- domain endpoints ---------------------------- */
  const api = {
    TokenStore,
    NovaApiError,
    outboxCount,
    flushOutbox,
    enqueue,

    /* auth */
    auth: {
      register: (body) => post("/auth/register", body, { auth: false }),
      login: async (email, password) => {
        const data = await post("/auth/login", { email, password }, { auth: false });
        TokenStore.set(data);
        document.dispatchEvent(new CustomEvent("nova:auth-login", { detail: data.user }));
        return data;
      },
      me: () => get("/auth/me"),
      logout: async () => {
        const rt = TokenStore.refreshToken;
        try { if (rt) await post("/auth/logout", { refreshToken: rt }, { retry: false }); }
        finally {
          TokenStore.set(null);
          document.dispatchEvent(new CustomEvent("nova:auth-logout"));
        }
      },
    },

    /* analytics — dashboards, streaks, activity, subject comparison */
    analytics: {
      dashboard: (signal) => get("/analytics/dashboard", { signal }),
      activity: (granularity, signal) =>
        get(`/analytics/activity?granularity=${encodeURIComponent(granularity || "day")}`, { signal }),
      subjects: (signal) => get("/analytics/subjects", { signal }),
      streaks: (signal) => get("/analytics/streaks", { signal }),
    },

    /* exams — timed attempts with grading + explanations */
    exams: {
      list: () => get("/exams"),
      get: (id) => get(`/exams/${id}`),
      start: (id) => post(`/exams/${id}/start`),
      attempt: (attemptId) => get(`/exams/attempts/${attemptId}`),
      history: () => get("/exams/attempts"),
      submit: (attemptId, answers) => post(`/exams/attempts/${attemptId}/submit`, { answers }),
    },

    /* practice — timed sessions + "Learn from Mistakes" pools */
    practice: {
      start: (body) => post("/practice/sessions", body || {}),
      list: () => get("/practice/sessions"),
      get: (id) => get(`/practice/sessions/${id}`),
      answer: (id, body) => post(`/practice/sessions/${id}/answer`, body),
      complete: (id) => post(`/practice/sessions/${id}/complete`),
      /** kind:"mistakes" → missed-questions pool (optionally per exam/category). */
      mistakes: (opts) => post("/practice/sessions", { kind: "mistakes", ...(opts || {}) }),
    },

    /* flashcards — SRS decks + due queue + review grading */
    flashcards: {
      due: () => get("/flashcards/due"),
      decks: () => get("/flashcards/decks"),
      deckCards: (deckId) => get(`/flashcards/decks/${deckId}/cards`),
      review: (cardId, grade) => post(`/flashcards/cards/${cardId}/review`, { grade }),
    },

    /* security tools */
    tools: {
      catalog: () => get("/tools/catalog"),
      sha256: (input) => post("/tools/sha256", { input }),
      caesar: (input, shift, mode) => post("/tools/caesar", { input, shift, mode }),
      jwt: (token) => post("/tools/jwt", { token }),
      cidr: (cidr) => post("/tools/cidr", { cidr }),
      encode: (input, mode, op) => post("/tools/encode", { input, mode, op }),
      chain: (input, steps) => post("/tools/chain", { input, steps }),
    },

    /* CTF — scenarios, step hints, leaderboard */
    ctf: {
      challenges: () => get("/ctf/challenges"),
      challenge: (id) => get(`/ctf/challenges/${id}`),
      hints: (id) => get(`/ctf/challenges/${id}/hints`),
      revealHint: (id) => post(`/ctf/challenges/${id}/hints/reveal`),
      scorePreview: (id) => get(`/ctf/challenges/${id}/score-preview`),
      submitFlag: (id, flag) => post(`/ctf/challenges/${id}/submit`, { flag }),
      leaderboard: () => get("/ctf/leaderboard"),
    },

    /* motivation — badges, notifications, PDF report */
    motivation: {
      achievements: () => get("/achievements"),
      evaluate: () => post("/achievements/evaluate"),
      notifications: (unreadOnly) =>
        get(`/notifications${unreadOnly ? "?unreadOnly=true" : ""}`),
      markRead: (id) => post(`/notifications/${id}/read`),
      markAllRead: () => post("/notifications/read-all"),
      reportUrl: "/api/v1/reports/progress.pdf",
    },

    /* offline sync manifest (what the SW should prefetch) */
    syncManifest: () => get("/sync/manifest"),
  };

  /**
   * Record a study/progress event. Online → straight to /sync/progress;
   * offline → IndexedDB outbox + Background Sync registration.
   * @param {{kind:string, payload:object, eventId?:string}} ev
   */
  api.trackProgress = async function trackProgress(ev) {
    const event = {
      eventId: ev.eventId || (crypto.randomUUID ? crypto.randomUUID() : `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      kind: ev.kind,
      payload: ev.payload || {},
    };
    if (navigator.onLine && TokenStore.isLoggedIn) {
      try {
        return await post("/sync/progress", { events: [event] });
      } catch (err) {
        if (err.status && err.status !== 0) throw err; /* real API error */
        /* network drop mid-request → fall through to the outbox */
      }
    }
    return enqueue(event);
  };

  /* ---------- offline lifecycle ---------------------------- */
  window.addEventListener("online", () => { flushOutbox().catch(() => {}); });
  window.addEventListener("offline", () => {
    document.dispatchEvent(new CustomEvent("nova:offline"));
  });
  document.addEventListener("nova:auth-login", () => { flushOutbox().catch(() => {}); });

  window.NovaAPI = api;
  window.NovaTokenStore = TokenStore;
})();
