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

const CACHE_VERSION = "v1.22.11";
const CACHE_NAME = `motmi-portal-${CACHE_VERSION}`;
const API_CACHE_NAME = `motmi-api-${CACHE_VERSION}`;

/**
 * Static app-shell assets precached at install time. Only files actually loaded by the site belong here — CI (`.github/workflows/ci.yml`) fails if any listed asset goes missing. @type {string[]}
 */
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./assistant.js",
  "./current-semester.js",
  "./manifest.json",
  "./data/quizzes.json",
  "./worker.js",
  "./images/icon.svg",
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
  "./images/flashcards/malware.svg"];


/**
 * Same-origin API endpoints cached for offline study.
 * NOTE: These patterns exist only for documentation. There is no backend
 * at /api/v1 on this static GitHub Pages site, so the fetch handler never
 * matches them. If a future deployment adds a static-data endpoint, add the
 * URL here and cache it under API_CACHE_NAME.
 * @type {RegExp[]}
 */
const OFFLINE_API_PATTERNS = [
  // disabled — no /api/v1 backend on this static site
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
    /* Never cache a non-OK page (e.g. a host 404 for a wrong path) as the
       app shell — that would poison offline mode until the next release. */
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put("./index.html", fresh.clone()).catch(() => {});
    }
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
  if (networkResponse) return networkResponse;

  /* Offline fallback: if this is a navigation or a cached-independent
     asset that failed to load, return a friendly offline shell instead of
     a browser error page — but only for same-origin HTML/JS/CSS/JSON/image
     requests the site itself owns. */
  if (request.mode === "navigate") {
    const offline = await makeOfflineFallback(request);
    if (offline) return offline;
  }

  return Response.error();
}

/**
 * Build a same-origin offline fallback response for the requested URL when
 * the network is unavailable and nothing is cached yet.
 * This keeps the main UI, lessons, quizzes, flashcards and tools usable
 * after the precache has installed, without pretending that every asset is
 * available offline.
 * @param {Request} request
 * @returns {Promise<Response|undefined>} A fallback response, or undefined.
 */
async function makeOfflineFallback(request) {
  const url = new URL(request.url);
  const path = (url.pathname.split("/").pop() || "").toLowerCase();

  /* Only serve fallbacks for navigate requests and common static types
     that the site itself controls. */
  const isNavigate = request.mode === "navigate";
  const isStaticType = /\.(html|js|css|json|png|jpg|jpeg|svg|ico|webp)$/i.test(path);

  if (!isNavigate && !isStaticType) return undefined;

  try {
    const cache = await caches.open(CACHE_NAME);
    const fallbackUrl = isNavigate ? "./index.html" : request.url;
    const response = await cache.match(fallbackUrl);
    if (response) return response.clone();
  } catch {}

  return undefined;
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

// disabled on GitHub Pages: const SYNC_API_URL = "/api/v1/sync/progress";

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

/* Disabled on GitHub Pages: this site has no backend for JWT refresh or
   background sync replay, so these helpers cannot do anything useful. */
// disabled on GitHub Pages: async function readAuthTokens() {
// disabled on GitHub Pages: async function refreshAccessToken(refreshToken) {
// disabled on GitHub Pages: async function replayOutbox() {

/** Disabled on GitHub Pages: there is no backend to read auth tokens from. */
async function readAuthTokensDisabled() {
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

/**
 * Refresh the access token directly from the SW (single attempt).
 * DISABLED on GitHub Pages: this site has no /api/v1/auth/refresh endpoint.
 */
// disabled on GitHub Pages: async function refreshAccessToken(refreshToken) {
//   const res = await fetch("/api/v1/auth/refresh", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ refreshToken }),
//   });
//   if (!res.ok) throw new Error("refresh failed: " + res.status);
//   const json = await res.json();
//   const tokens = json && json.data;
//   if (!tokens || !tokens.accessToken) throw new Error("malformed refresh response");
//   /* Persist the rotated tokens so the page picks them up next run. */
//   try {
//     const db = await openSharedDB();
//     if (db.objectStoreNames.contains("auth")) {
//       db.transaction("auth", "readwrite")
//         .objectStore("auth")
//         .put({ id: "current", tokens });
//     }
//     db.close();
//   } catch { /* best-effort */ }
//   return tokens.accessToken;
// }

/**
 * Replay every queued event batch. Throws on transient failures so the
 * browser reschedules the sync; deletes only server-acked events.
 * @returns {Promise<number>} acknowledged event count
 * DISABLED on GitHub Pages: this site has no /api/v1/sync/progress endpoint.
 */
// disabled on GitHub Pages: async function replayOutbox() {
//   const db = await openSharedDB();
//   if (!db.objectStoreNames.contains(OUTBOX_STORE)) { db.close(); return 0; }
//   const events = await idbReq(
//     db.transaction(OUTBOX_STORE, "readonly").objectStore(OUTBOX_STORE).getAll()
//   );
//   db.close();
//   if (!events.length) return 0;
//
//   let creds = await readAuthTokensDisabled();
//   if (!creds || !creds.accessToken) throw new Error("no credentials for sync replay");
//
//   let acked = 0;
//   for (let i = 0; i < events.length; i += 100) {
//     const batch = events.slice(i, i + 100);
//     const res = await fetch(SYNC_API_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: "Bearer " + creds.accessToken,
//       },
//       body: JSON.stringify({ events: batch }),
//     });
//
//     if (res.status === 401 && creds.refreshToken) {
//       /* Rotate once per replay; the retry below uses the fresh token. */
//       creds.accessToken = await refreshAccessToken(creds.refreshToken);
//       const retry = await fetch(SYNC_API_URL, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: "Bearer " + creds.accessToken,
//         },
//         body: JSON.stringify({ events: batch }),
//       });
//       if (!retry.ok) throw new Error("sync replay failed: " + retry.status);
//     } else if (res.status >= 400 && res.status < 500) {
//       /* Poison batch (bad payload): drop it so it can't wedge the queue. */
//     } else if (!res.ok) {
//       /* Network / 5xx → throw so Background Sync retries later. */
//       throw new Error("sync replay failed: " + res.status);
//     }
//
//     acked += batch.length;
//     const db2 = await openSharedDB();
//     const store = db2.transaction(OUTBOX_STORE, "readwrite").objectStore(OUTBOX_STORE);
//     await Promise.all(batch.map((ev) => idbReq(store.delete(ev.eventId))));
//     db2.close();
//   }
//   return acked;
// }

/* Disabled on GitHub Pages: Background Sync would only replay to a backend
   that does not exist here. Keep the listener as a no-op to avoid runtime
   errors if the browser fires a sync event. */
self.addEventListener("sync", (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(Promise.resolve());
  console.log("[SW] background sync tag ignored on static GitHub Pages site");
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