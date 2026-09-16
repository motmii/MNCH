/* ============================================================
   منصة أمن المعلومات — الترم الحالي | Service Worker
   Strategy (v1.9):
   - Precache the app shell on install (versioned cache).
   - Navigations: network-first with cached-shell fallback.
   - Static assets + JSON: Stale-While-Revalidate.
   - API study data (materials/tools/analytics/decks): network-
     first into a dedicated API cache with offline fallback.
   - Background Sync: failed progress/exam-result POSTs are
     queued in IndexedDB by the page; the "nova-progress-sync"
     sync event replays them to /api/v1/sync/progress.
   Bump CACHE_VERSION whenever shipped assets change.
   ============================================================ */
"use strict";

const CACHE_VERSION = "v1.20.0";
const CACHE_NAME = `motmi-portal-${CACHE_VERSION}`;
const API_CACHE_NAME = `motmi-api-${CACHE_VERSION}`;

/** Static app-shell assets precached at install time. @type {string[]} */
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./assistant.js",
  "./nova-api.js",
  "./nova-ui.css",
  "./manifest.json",
  "./data/quizzes.json",
  "./worker.js",
  "./images/icon-maskable.svg",
  "./images/algorithms.svg",
  "./images/os-concepts.svg",
  "./images/policies-ethics.svg",
  "./images/it-components.svg",
  "./images/security-design.svg",
  "./images/backweb.jpg",
  "./images/flashcards/firewall.svg",
  "./images/flashcards/vpn.svg",
  "./images/flashcards/hash.svg",
  "./images/flashcards/phishing.svg",
  "./images/flashcards/two-factor.svg",
  "./images/flashcards/sql-injection.svg",
  "./images/flashcards/confidentiality.svg",
  "./images/flashcards/integrity.svg",
  "./images/flashcards/availability.svg",
  "./images/flashcards/symmetric-encryption.svg",
  "./images/flashcards/asymmetric-encryption.svg",
  "./images/flashcards/ransomware.svg",
  "./images/flashcards/ddos.svg",
  "./images/flashcards/man-in-the-middle.svg",
  "./images/flashcards/social-engineering.svg",
  "./images/flashcards/vulnerability.svg",
  "./images/flashcards/reconnaissance.svg",
  "./images/flashcards/malware.svg"
];

/**
 * Same-origin API endpoints cached for offline study.
 * @type {RegExp[]}
 */
const OFFLINE_API_PATTERNS = [
  /\/api\/v1\/sync\/manifest$/,
  /\/api\/v1\/tools\/catalog$/,
  /\/api\/v1\/analytics\/(dashboard|streaks)$/,
  /\/api\/v1\/materials(\?|$)/,
  /\/api\/v1\/flashcards\/decks(\?|$)/,
  /\/api\/v1\/achievements$/
];

const SYNC_TAG = "nova-progress-sync";
const OUTBOX_DB = "motmi-outbox";
const OUTBOX_STORE = "pending";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * Is this response safe to persist in the cache?
 * @param {Response} response Fetched response.
 * @returns {boolean} True when cacheable.
 */
function isCacheable(response) {
  return Boolean(response && (response.ok || response.type === "opaque"));
}

/**
 * Navigations: network-first so users get fresh HTML when online,
 * falling back to the cached shell when offline.
 * @param {Request} request The navigation request.
 * @returns {Promise<Response>} Fresh or cached shell.
 */
async function handleNavigation(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put("./index.html", fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match("./index.html")) || Response.error();
  }
}

/**
 * Stale-While-Revalidate: answer immediately from the cache while a
 * network refresh runs in the background (kept alive by waitUntil).
 * When nothing is cached yet, wait for the network instead.
 * @param {Request} request Incoming GET request.
 * @param {FetchEvent} event The fetch event (for waitUntil).
 * @returns {Promise<Response>} Cached copy, else the network response.
 */
async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  let networkResponse = null;
  const refresh = fetch(request)
    .then((response) => {
      networkResponse = response;
      if (!isCacheable(response)) return undefined;
      /* Clone before caching: the original body goes to the page. */
      return cache.put(request, response.clone()).catch(() => {});
    })
    .catch(() => {});

  /* Let the background refresh outlive this fetch handler. */
  if (event && typeof event.waitUntil === "function") event.waitUntil(refresh);

  if (cached) return cached;

  /* First visit / evicted entry: block on the network. */
  await refresh;
  return networkResponse || Response.error();
}
/* ============================================================
   Background Sync — replay the page-queued outbox.
   The page queues failed progress/exam-result writes in the
   "motmi-outbox/pending" store and mirrors its JWTs into the
   "auth" store of the same DB (localStorage is unreachable
   from a SW). When the browser regains connectivity the
   "nova-progress-sync" event fires — even with every tab
   closed — and we replay the queue to /api/v1/sync/progress.
   ============================================================ */

const SYNC_API_URL = "/api/v1/sync/progress";

/** @returns {Promise<IDBDatabase>} current-version handle (no upgrade) */
function openSharedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OUTBOX_DB); /* no version → open as-is */
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Mirrored credentials written by nova-api.js on every login/refresh. */
async function readAuthTokens() {
  try {
    const db = await openSharedDB();
    if (!db.objectStoreNames.contains("auth")) { db.close(); return null; }
    const rec = await idbReq(
      db.transaction("auth", "readonly").objectStore("auth").get("current")
    );
    db.close();
    return rec ? rec.tokens : null;
  } catch { return null; }
}

/** Refresh the access token directly from the SW (single attempt). */
async function refreshAccessToken(refreshToken) {
  const res = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error("refresh failed: " + res.status);
  const json = await res.json();
  const tokens = json && json.data;
  if (!tokens || !tokens.accessToken) throw new Error("malformed refresh response");
  /* Persist the rotated tokens so the page picks them up next run. */
  try {
    const db = await openSharedDB();
    if (db.objectStoreNames.contains("auth")) {
      db.transaction("auth", "readwrite")
        .objectStore("auth")
        .put({ id: "current", tokens });
    }
    db.close();
  } catch { /* best-effort */ }
  return tokens.accessToken;
}

/**
 * Replay every queued event batch. Throws on transient failures so the
 * browser reschedules the sync; deletes only server-acked events.
 * @returns {Promise<number>} acknowledged event count
 */
async function replayOutbox() {
  const db = await openSharedDB();
  if (!db.objectStoreNames.contains(OUTBOX_STORE)) { db.close(); return 0; }
  const events = await idbReq(
    db.transaction(OUTBOX_STORE, "readonly").objectStore(OUTBOX_STORE).getAll()
  );
  db.close();
  if (!events.length) return 0;

  let creds = await readAuthTokens();
  if (!creds || !creds.accessToken) throw new Error("no credentials for sync replay");

  let acked = 0;
  for (let i = 0; i < events.length; i += 100) {
    const batch = events.slice(i, i + 100);
    const res = await fetch(SYNC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + creds.accessToken,
      },
      body: JSON.stringify({ events: batch }),
    });

    if (res.status === 401 && creds.refreshToken) {
      /* Rotate once per replay; the retry below uses the fresh token. */
      creds.accessToken = await refreshAccessToken(creds.refreshToken);
      const retry = await fetch(SYNC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + creds.accessToken,
        },
        body: JSON.stringify({ events: batch }),
      });
      if (!retry.ok) throw new Error("sync replay failed: " + retry.status);
    } else if (res.status >= 400 && res.status < 500) {
      /* Poison batch (bad payload): drop it so it can't wedge the queue. */
    } else if (!res.ok) {
      /* Network / 5xx → throw so Background Sync retries later. */
      throw new Error("sync replay failed: " + res.status);
    }

    acked += batch.length;
    const db2 = await openSharedDB();
    const store = db2.transaction(OUTBOX_STORE, "readwrite").objectStore(OUTBOX_STORE);
    await Promise.all(batch.map((ev) => idbReq(store.delete(ev.eventId))));
    db2.close();
  }
  return acked;
}

self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(
    replayOutbox().catch((err) => {
      console.warn("[SW] background sync replay failed:", err.message);
      throw err; /* rethrow → browser reschedules the sync */
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  /* Everything else (statics, JSON data, cross-origin fonts): SWR. */
  event.respondWith(staleWhileRevalidate(request, event));
});