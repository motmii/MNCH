"use strict";
/**
 * MODULE 54c · CanvaStudio + the online-only conversion.
 *
 * Static checks: script.js module slice, index.html mounts + CSP +
 * unregister snippet, style.css layer, i18n parity, version triple.
 * Runtime: boots the module in a VM with a stub DOM and drives the
 * ten Canva features (deck theatre, gallery + lightbox, explainers,
 * flip cards, templates, whiteboard, daily card, ambient background,
 * sharing, flyer), plus the online-only teardown expectations.
 * Run: node tests/canva.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

/* ============================================================
   static: script.js — MODULE 54c
   ============================================================ */
console.log("— script.js: MODULE 54c —");
const modStart = js.indexOf("(function initCanvaStudio()");
const modEnd = js.indexOf("/* @@CANVA_END@@ */", modStart);
const mod = modStart >= 0 && modEnd > modStart ? js.slice(modStart, modEnd) : "";
check("module marker + entry point", js.includes("MODULE 54c · CanvaStudio") && modStart > -1);
check("module closes with END marker", modEnd > modStart);
check("no fetch / network primitives in the module", !/fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(mod));
check("module avoids innerHTML entirely", mod.indexOf("innerHTML") === -1);
check("defensive boot for missing nodes", mod.includes("if (!fab || !panel || !closeBtn || !tablist) return;"));
check("exposes window.PlatformCanvaStudio", mod.includes("window.PlatformCanvaStudio"));
check("embeds resolve to canva.com designs", mod.includes('"https://www.canva.com/design/"') && mod.includes('"/view?embed"'));
check("design link parser targets canva.com/design/<id>", mod.includes("canva\\.com\\/design\\/"));
check("empty slots render the honest note, never a fake embed",
  mod.includes("canva.unconfigured") && mod.includes("function emptyState("));
check("daily rotation is a deterministic day index", mod.includes("function dailyIndex(") && mod.includes("86400000"));
check("ambient choice persists via the shared store", mod.includes('"canva-ambient"'));
check("Escape closes the lightbox before the studio", mod.includes("lightboxOpen()") && mod.includes('e.key !== "Escape"'));
check("view change closes the studio", mod.includes('"nova:view-changed"'));
check("re-renders on language switch", mod.includes("L10N.onSwitch("));

/* ============================================================
   static: index.html — mounts, CSP, online-only
   ============================================================ */
console.log("\n— index.html: studio mounts —");
check("fab is a real button (auto-voiced by the sound layer)", /<button[^>]*id="canvaFab"/.test(html));
check("fab wires the dialog (haspopup + controls + collapsed)",
  /id="canvaFab"[^>]*aria-haspopup="dialog"/.test(html) &&
  /id="canvaFab"[^>]*aria-controls="canvaStudio"/.test(html) &&
  /id="canvaFab"[^>]*aria-expanded="false"/.test(html));
check("studio is a labelled modal dialog, hidden + inert by default",
  /id="canvaStudio"[^>]*role="dialog"/.test(html) &&
  /id="canvaStudio"[^>]*aria-modal="true"/.test(html) &&
  /id="canvaStudio"[^>]*aria-hidden="true"/.test(html) &&
  /id="canvaStudio"[^>]*inert/.test(html) &&
  /id="canvaStudio"[^>]*hidden/.test(html));
check("tablist with exactly 5 canva tabs",
  html.includes('id="canvaTabs" role="tablist"') &&
  (html.match(/class="canva-tab[^"]*"[^>]*role="tab"/g) || []).length === 5);
check("5 panels with role=tabpanel + aria-labelledby",
  (html.match(/role="tabpanel" aria-labelledby="canvaTab\w+"/g) || []).length === 5);
check("inactive panels start hidden",
  (html.match(/aria-labelledby="canvaTab\w+" tabindex="0" hidden/g) || []).length === 4);
check("lightbox is a nested labelled dialog", /id="canvaLightbox"[^>]*role="dialog"/.test(html));
check("ambient video layer: muted + loop + playsinline + hidden",
  /id="canvaAmbient"[^>]*muted loop playsinline[^>]*hidden/.test(html));
["canvaFlyerMount", "canvaDaily", "canvaAmbientBtn", "canvaShareBtn", "canvaPosterLink",
  "canvaDeckSelect", "canvaDeckHost", "canvaGalleryGrid", "canvaExplainMount",
  "canvaCardsMount", "canvaTemplatesMount", "canvaWhiteboardMount", "canvaLightboxHost",
].forEach((id) => check("mounts #" + id, html.includes('id="' + id + '"')));

console.log("\n— index.html: CSP for Canva —");
const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html);
check("CSP meta present", !!csp);
if (csp) {
  const c = csp[1];
  check("default-src 'self'", c.includes("default-src 'self'"));
  check("frame-src allows canva embeds", /frame-src [^;]*https:\/\/\*\.canva\.com/.test(c));
  check("img-src allows canva media", /img-src [^;]*https:\/\/\*\.canva\.com/.test(c));
  check("media-src allows canva video", /media-src [^;]*https:\/\/\*\.canva\.com/.test(c));
  check("connect-src allows canva", /connect-src [^;]*https:\/\/\*\.canva\.com/.test(c));
  check("object-src stays 'self' (local chapter PDFs keep working)",
    c.includes("object-src 'self'"));
  check("no stale third-party origins", !/googleapis|gstatic|jsdelivr|unpkg/.test(c));
}

console.log("\n— index.html: online-only conversion —");
check("no service-worker registration remains", !html.includes("serviceWorker.register"));
check("script.js never re-registers the retired worker", !js.includes("serviceWorker.register"));
check("old registrations are unregistered on load",
  html.includes("getRegistrations") && html.includes(".unregister()"));
check("Cache Storage is wiped automatically",
  html.includes("caches.keys") && html.includes("caches.delete"));
check("teardown is guarded (works on file:// and ancient browsers)",
  html.includes('if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations)') &&
  html.includes("catch (e)"));
check("retired sw.js file survives as a historical record",
  sw.includes("CACHE_VERSION") && sw.includes("PRECACHE_ASSETS"));

/* ============================================================
   static: i18n parity + style layer + version
   ============================================================ */
console.log("\n— i18n (ar + en) —");
const dictStart = js.indexOf("const DICT");
const qkeysAt = js.indexOf("const QKEYS", dictStart);
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, qkeysAt > -1 ? qkeysAt : undefined);
const canvaKeys = [];
const keyRe = /data-i18n="(canva\.[^"]+)"/g;
let m;
while ((m = keyRe.exec(html)) !== null) canvaKeys.push(m[1]);
check("html exposes a rich canva.* key set", canvaKeys.length >= 18);
canvaKeys.forEach((k) => {
  check('dict key "' + k + '" in ar + en', arSrc.includes('"' + k + '"') && enSrc.includes('"' + k + '"'));
});

console.log("\n— style.css: MODULE 54c layer —");
const cssAt = css.indexOf("MODULE 54c · CanvaStudio");
const layer = cssAt > -1 ? css.slice(cssAt) : "";
[".canva-fab", ".canva-studio", ".canva-tab", ".canva-frame", ".canva-lightbox",
  ".canva-daily-card", ".canva-daily-card.is-flipped", ".canva-gal-card", ".canva-explain",
  ".canva-card.is-flipped", ".canva-template", ".canva-ambient", ".canva-empty"].forEach((sel) => {
  check("style for " + sel, layer.includes(sel));
});
check("hidden states respected",
  layer.includes(".canva-studio[hidden]") && layer.includes(".canva-lightbox[hidden]") &&
  layer.includes(".canva-ambient[hidden]"));
check("mobile sheet rule", /@media \(max-width: 700px\)[\s\S]*\.canva-studio/.test(layer));
check("reduced-motion guard", layer.includes("prefers-reduced-motion: reduce"));
check("layer closed with END marker", layer.includes("END MODULE 54c"));

console.log("\n— version triple —");
const swVer = (/CACHE_VERSION\s*=\s*"v([\d.]+)"/.exec(sw) || [])[1];
const htmlVer = (/style\.css\?v=([\d.]+)/.exec(html) || [])[1];
check("sw.js, index.html and package.json agree", swVer === pkg.version && htmlVer === pkg.version);
check("version >= 2.0.4 (Canva + online-only bump)", (() => {
  const [maj, min, pat] = pkg.version.split(".").map(Number);
  return maj > 2 || (maj === 2 && (min > 0 || (min === 0 && pat >= 4)));
})());

/* ============================================================
   runtime: boot MODULE 54c in a vm with a stub DOM
   ============================================================ */
console.log("\n— runtime: stubbed browser —");

function matches(el, sel) {
  return String(sel).split(",").map((s) => s.trim()).some((s) => {
    if (!s) return false;
    if (s.charAt(0) === ".") return (el.className || "").split(/\s+/).indexOf(s.slice(1)) > -1;
    const mm = /^\[([^\]="]+)(?:="([^"]*)")?\]$/.exec(s);
    if (mm) {
      const v = el.attrs[mm[1]];
      return mm[2] !== undefined ? v === mm[2] : v !== undefined;
    }
    return false;
  });
}

function makeEl(tag) {
  const el = {
    tagName: String(tag || "").toUpperCase(),
    id: "", className: "", hidden: false, disabled: false, value: "",
    attrs: {}, listeners: {}, children: [], _text: "", _parent: null,
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { c._parent = this; this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); c._parent = null; return c; },
    select() {}, focus() { this._focused = true; },
    closest(sel) { let n = this; while (n) { if (matches(n, sel)) return n; n = n._parent; } return null; },
    querySelector(sel) {
      const cls = String(sel).replace(/^\./, "");
      const find = (n) => {
        for (const c of n.children) {
          if ((c.className || "").split(/\s+/).indexOf(cls) > -1) return c;
          const r = find(c);
          if (r) return r;
        }
        return null;
      };
      return find(this);
    },
    get firstChild() { return this.children[0] || null; },
  };
  Object.defineProperty(el, "textContent", {
    get() { return el._text; },
    set(v) { el._text = String(v); },
  });
  el.classList = {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); },
    remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, force) {
      if (force === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
      else if (force) this._s.add(c); else this._s.delete(c);
      return this._s.has(c);
    },
    contains(c) { return this._s.has(c); },
  };
  return el;
}

const body = makeEl("body");
body.appendChild = body.appendChild || function () {};
body.removeChild = body.removeChild || function () {};

const IDS = ["canvaFab", "canvaStudio", "canvaClose", "canvaTabs",
  "canvaTabHome", "canvaTabMedia", "canvaTabExplain", "canvaTabCards", "canvaTabWork",
  "canvaPanelHome", "canvaPanelMedia", "canvaPanelExplain", "canvaPanelCards", "canvaPanelWork",
  "canvaLightbox", "canvaLightboxTitle", "canvaLightboxHost", "canvaLightboxPrev", "canvaLightboxNext", "canvaLightboxClose",
  "canvaFlyerMount", "canvaDaily", "canvaAmbientBtn", "canvaAmbientNote",
  "canvaShareBtn", "canvaShareNote", "canvaPosterLink", "canvaDeckSelect", "canvaDeckHost",
  "canvaGalleryGrid", "canvaExplainMount", "canvaCardsMount", "canvaTemplatesMount",
  "canvaWhiteboardMount", "canvaAmbient"];

function boot(opts) {
  opts = opts || {};
  const byId = {};
  IDS.forEach((id) => {
    const n = makeEl(id === "canvaAmbient" ? "video" : "div");
    n.id = id;
    byId[id] = n;
  });
  byId.canvaStudio.hidden = true;
  byId.canvaLightbox.hidden = true;
  byId.canvaAmbient.hidden = true;
  byId.canvaAmbient.play = function () { byId.canvaAmbient._played = true; return { catch() {} }; };
  byId.canvaAmbient.pause = function () { byId.canvaAmbient._paused = true; };
  byId.canvaShareNote.hidden = true;
  byId.canvaPosterLink.hidden = true;
  byId.canvaPanelMedia.hidden = true;
  byId.canvaPanelExplain.hidden = true;
  byId.canvaPanelCards.hidden = true;
  byId.canvaPanelWork.hidden = true;

  const docListeners = {};
  const documentStub = {
    documentElement: { dir: opts.dir || "rtl" },
    title: "منصة أمن المعلومات",
    body: body,
    getElementById(id) { return byId[id] || null; },
    createElement(tag) { return makeEl(tag); },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    execCommand() { return true; },
  };
  const storeData = {};
  const localStorageStub = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storeData, k) ? storeData[k] : null; },
    setItem(k, v) { storeData[k] = String(v); },
    removeItem(k) { delete storeData[k]; },
  };
  const copied = [];
  const switchers = [];
  const LangStub = {
    current: opts.lang || "ar",
    t(key) { return "\u27e6" + key + "\u27e7"; },
    onSwitch(fn) { switchers.push(fn); },
    switchTo(next) { LangStub.current = next; switchers.forEach((fn) => fn(next)); },
  };
  const sandbox = {
    console, document: documentStub, localStorage: localStorageStub, Lang: LangStub,
    navigator: { clipboard: { writeText(s) { copied.push(s); } } },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  let bootError = null;
  try { vm.runInContext(mod, sandbox, { filename: "canva-module.js" }); }
  catch (e) { bootError = e; }
  return { byId, documentStub, docListeners, storeData, copied, LangStub, sandbox, bootError };
}

function fire(el, t, ev) { (el.listeners[t] || []).forEach((fn) => fn(ev || {})); }
function fireDoc(app, t, ev) { (app.docListeners[t] || []).forEach((fn) => fn(ev || {})); }

console.log("\n— MODULE 54c: ten features, live —");
{
  const app = boot();
  check("module boots in a stubbed DOM", !app.bootError);
  if (app.bootError) console.error("    -> " + app.bootError.message);
  const api = app.sandbox.window.PlatformCanvaStudio;
  check("exposes window.PlatformCanvaStudio", !!api);
  check("exactly the ten feature ids", !!api && api.FEATURE_IDS.length === 10 &&
    ["presentation", "gallery", "subjectCards", "explainers", "templates",
      "whiteboard", "daily", "ambient", "sharePoster", "flyer"]
      .every((k) => api.FEATURE_IDS.indexOf(k) > -1));
  check("config carries a slot for every feature", !!api &&
    api.FEATURE_IDS.every((k) => Object.prototype.hasOwnProperty.call(api.CANVA_LINKS, k)));

  check("designId extracts the design id from a share link",
    api.designId("https://www.canva.com/design/DAFabc12345/view?utm_source=share") === "DAFabc12345");
  check("viewUrl builds the ?embed address",
    api.viewUrl("DAFabc12345") === "https://www.canva.com/design/DAFabc12345/view?embed");
  check("junk links are rejected honestly", api.designId("https://evil.example/design/x/view") === "" &&
    api.designId("") === "");

  /* 1–2 · embeds */
  const scratch = app.documentStub.createElement("div");
  check("empty slot → honest note, no iframe", (function () {
    const r = api.mountEmbed(scratch, { title: { ar: "x", en: "x" }, url: "" });
    return r === null && scratch.children.length === 1 &&
      scratch.children[0].className.indexOf("canva-empty") === 0;
  })());
  check("real link → sandboxed-friendly iframe + escape hatch", (function () {
    const r = api.mountEmbed(scratch, { title: { ar: "x", en: "x" }, url: "https://www.canva.com/design/DAFabc12345/view" });
    const frame = scratch.children[0];
    const link = scratch.children[1];
    return r === frame && frame.tagName === "IFRAME" &&
      frame.getAttribute("src") === "https://www.canva.com/design/DAFabc12345/view?embed" &&
      frame.getAttribute("loading") === "lazy" && frame.getAttribute("allowfullscreen") !== null &&
      link.tagName === "A" && link.getAttribute("target") === "_blank" &&
      link.getAttribute("rel") === "noopener noreferrer";
  })());

  check("slugs are preserved for the embed viewer", (function () {
    const holder = app.documentStub.createElement("div");
    api.mountEmbed(holder, { title: { ar: "x", en: "x" }, url: "https://www.canva.com/design/DAFabc12345/9zYx8wVtAbCdEf/view?utm_source=share" });
    return holder.children[0].getAttribute("src") === "https://www.canva.com/design/DAFabc12345/9zYx8wVtAbCdEf/view?embed";
  })());

  /* panel */
  fire(app.byId.canvaFab, "click");
  check("fab opens the studio + aria-expanded flips",
    app.byId.canvaStudio.hidden === false &&
    app.byId.canvaFab.getAttribute("aria-expanded") === "true" &&
    app.byId.canvaStudio.getAttribute("aria-hidden") === "false");
  check("tablist aria-label localized", app.byId.canvaTabs.getAttribute("aria-label") === "\u27e6canva.tabsAria\u27e7");

  /* 7 · daily card renders + flips */
  check("daily card rendered with two faces",
    app.byId.canvaDaily.children.length === 1 &&
    app.byId.canvaDaily.children[0].children.length === 2);
  check("dailyIndex rotates deterministically", (function () {
    const n = api.CANVA_LINKS.daily.length;
    return api.dailyIndex(0) === 0 && api.dailyIndex(86400000) === 1 % n &&
      api.dailyIndex(86400000 * 1234567) === (1234567 % n) && api.dailyIndex(0) < n;
  })());
  check("flip-to-back mounts the embeds host lazily", (function () {
    const card = app.byId.canvaDaily.children[0];
    fire(app.byId.canvaStudio, "click", { target: card });
    const back = card.children[1];
    return card.classList.contains("is-flipped") && back.children.length === 1;
  })());

  /* 10 · flyer */
  check("flyer pinned with honest empty state",
    app.byId.canvaFlyerMount.children.length === 1 &&
    app.byId.canvaFlyerMount.children[0].children.length >= 2);

  /* 9 · share */
  check("share text is Arabic by default + carries the canonical URL",
    api.shareText().indexOf("أتابع تعلّمي") === 0 &&
    api.shareText().indexOf("https://motmii.github.io/MNCH/") > -1);
  check("share falls back to clipboard without navigator.share", api.doShare() === "copied" &&
    app.copied.length === 1 && app.copied[0].indexOf("https://motmii.github.io/MNCH/") > -1);
  fire(app.byId.canvaShareBtn, "click");
  check("share button surfaces the copied state",
    app.byId.canvaShareNote.hidden === false &&
    app.byId.canvaShareNote.textContent === "\u27e6canva.shareCopied\u27e7");
  app.LangStub.switchTo("en");
  check("share text follows the language switch", api.shareText().indexOf("I'm learning") === 0);
  app.LangStub.switchTo("ar");

  /* tabs: RTL roving + lazy render */
  fire(app.byId.canvaTabs, "keydown", { key: "ArrowLeft", preventDefault() {} });
  check("RTL ArrowLeft activates the media tab (roving tabindex)",
    app.byId.canvaTabMedia.getAttribute("aria-selected") === "true" &&
    app.byId.canvaTabMedia.getAttribute("tabindex") === "0" &&
    app.byId.canvaTabHome.getAttribute("tabindex") === "-1" &&
    app.byId.canvaPanelMedia.hidden === false && app.byId.canvaPanelHome.hidden === true);
  check("deck select filled from the config",
    app.byId.canvaDeckSelect.children.length === api.CANVA_LINKS.presentation.length);
  const deckDefault = api.CANVA_LINKS.presentation.findIndex((x) => x.url);
  if (deckDefault > -1) {
    check("deck defaults to the first configured slot",
      app.byId.canvaDeckSelect.value === String(deckDefault) &&
      app.byId.canvaDeckHost.children.length === 2 &&
      app.byId.canvaDeckHost.children[0].className === "canva-frame" &&
      app.byId.canvaDeckHost.children[0].tagName === "IFRAME");
    app.byId.canvaDeckSelect.value = "0";
    fire(app.byId.canvaDeckSelect, "change");
    check("switching to an inert deck keeps the honest empty state",
      app.byId.canvaDeckHost.children.length === 1 &&
      app.byId.canvaDeckHost.children[0].className.indexOf("canva-empty") === 0);
  } else {
    check("deck host shows the honest state for unconfigured decks",
      app.byId.canvaDeckHost.children.length === 1 &&
      app.byId.canvaDeckHost.children[0].className.indexOf("canva-empty") === 0);
  }
  check("gallery grid renders every configured slot",
    app.byId.canvaGalleryGrid.children.length === api.CANVA_LINKS.gallery.length);

  /* 2 · lightbox */
  api.openLightbox(0);
  check("lightbox opens with the first design + nav enabled",
    app.byId.canvaLightbox.hidden === false &&
    app.byId.canvaLightboxTitle.textContent === api.CANVA_LINKS.gallery[0].title.ar &&
    app.byId.canvaLightboxNext.disabled === false);
  fire(app.byId.canvaLightboxNext, "click");
  check("next walks the gallery",
    app.byId.canvaLightboxTitle.textContent === api.CANVA_LINKS.gallery[1].title.ar);
  fireDoc(app, "keydown", { key: "Escape" });
  check("Escape closes the lightbox first, studio stays open",
    app.byId.canvaLightbox.hidden === true && app.byId.canvaStudio.hidden === false);

  /* 4 · explainers accordion */
  api.activateTab(2, false);
  check("explainers render as collapsed rows",
    app.byId.canvaExplainMount.children.length === api.CANVA_LINKS.explainers.length &&
    app.byId.canvaExplainMount.children[0].children[1].hidden === true);
  fire(app.byId.canvaStudio, "click", { target: app.byId.canvaExplainMount.children[0].children[0] });
  check("opening an explainer mounts its host + aria-expanded",
    app.byId.canvaExplainMount.children[0].children[0].getAttribute("aria-expanded") === "true" &&
    app.byId.canvaExplainMount.children[0].children[1].hidden === false &&
    app.byId.canvaExplainMount.children[0].children[1].children.length >= 1);
  fire(app.byId.canvaStudio, "click", { target: app.byId.canvaExplainMount.children[1].children[0] });
  check("accordion: opening one closes the other",
    app.byId.canvaExplainMount.children[0].children[1].hidden === true &&
    app.byId.canvaExplainMount.children[1].children[1].hidden === false);

  /* 3 · subject flip cards */
  api.activateTab(3, false);
  check("subject cards rendered", app.byId.canvaCardsMount.children.length === api.CANVA_LINKS.subjectCards.length);
  const card1 = app.byId.canvaCardsMount.children[1];
  fire(app.byId.canvaStudio, "click", { target: card1 });
  check("tap flips a subject card + mounts its poster host",
    card1.classList.contains("is-flipped") && card1.getAttribute("aria-pressed") === "true" &&
    card1.children[1].children.length >= 1);

  /* 5 + 6 · workshop */
  api.activateTab(4, false);
  check("templates render with honest empty states",
    app.byId.canvaTemplatesMount.children.length === api.CANVA_LINKS.templates.length &&
    app.byId.canvaTemplatesMount.children[0].children.length === 2);
  check("whiteboard mounts its host", app.byId.canvaWhiteboardMount.children.length === 1);
  check("copy button copies the link + flips its label", (function () {
    const before = app.copied.length;
    const btn = app.documentStub.createElement("button");
    btn.setAttribute("data-canva-copy", "https://www.canva.com/design/DAFzzz9999/view");
    fire(app.byId.canvaStudio, "click", { target: btn });
    return app.copied.length === before + 1 &&
      app.copied[app.copied.length - 1].indexOf("DAFzzz9999") > -1 &&
      btn.textContent === "\u27e6canva.copied\u27e7";
  })());

  /* 8 · ambient background */
  check("ambient stays off while unconfigured", api.setAmbient(true) === false &&
    app.byId.canvaAmbient.hidden === true &&
    app.byId.canvaAmbientBtn.getAttribute("aria-pressed") === "false" &&
    app.storeData["motmi-portal:canva-ambient"] === "0");
  api.CANVA_LINKS.ambient.url = "https://media.canva.com/example-bg.mp4";
  check("configured ambient plays the video + persists", api.setAmbient(true) === true &&
    app.byId.canvaAmbient.hidden === false &&
    app.byId.canvaAmbient.getAttribute("src") === "https://media.canva.com/example-bg.mp4" &&
    app.storeData["motmi-portal:canva-ambient"] === "1");
  check("ambient off tears the video down", api.setAmbient(false) === false &&
    app.byId.canvaAmbient.hidden === true &&
    app.byId.canvaAmbient.getAttribute("src") === null &&
    app.storeData["motmi-portal:canva-ambient"] === "0");
  api.CANVA_LINKS.ambient.url = "";

  /* close lifecycle */
  fireDoc(app, "doc", {});
  fireDoc(app, "keydown", { key: "Escape" });
  check("Escape closes the studio + aria-expanded resets",
    app.byId.canvaStudio.hidden === true &&
    app.byId.canvaFab.getAttribute("aria-expanded") === "false" &&
    app.byId.canvaStudio.getAttribute("aria-hidden") === "true");
  check("close tears every live embed down (no background playback)", (function () {
    const noIframe = (el) => !el.children.some((c) => c.tagName === "IFRAME") && el.children.every(noIframe);
    return noIframe(app.byId.canvaDeckHost) && noIframe(app.byId.canvaWhiteboardMount) &&
      noIframe(app.byId.canvaCardsMount) && noIframe(app.byId.canvaLightboxHost) &&
      noIframe(app.byId.canvaFlyerMount);
  })());
  fire(app.byId.canvaFab, "click");
  check("reopening re-renders the active tab (cache reset)",
    app.byId.canvaStudio.hidden === false && app.byId.canvaWhiteboardMount.children.length === 1);
  fireDoc(app, "nova:view-changed", { detail: { viewId: "quiz" } });
  check("view change closes the studio", app.byId.canvaStudio.hidden === true);
}
{
  const app = boot({ dir: "ltr" });
  const api = app.sandbox.window.PlatformCanvaStudio;
  fire(app.byId.canvaFab, "click");
  fire(app.byId.canvaTabs, "keydown", { key: "ArrowRight", preventDefault() {} });
  check("LTR ArrowRight moves forward", app.byId.canvaTabMedia.getAttribute("aria-selected") === "true");
  fire(app.byId.canvaTabs, "keydown", { key: "Home", preventDefault() {} });
  check("Home jumps to the first tab", app.byId.canvaTabHome.getAttribute("aria-selected") === "true");
  check("api surface complete", typeof api.open === "function" && typeof api.close === "function" &&
    typeof api.dailyIndex === "function" && typeof api.openLightbox === "function");
}
{
  /* Defensive boot: a bare DOM (no canva nodes) must not throw. */
  const sandbox = {
    console, Lang: { current: "ar", t(k) { return k; }, onSwitch() {} },
    document: { getElementById() { return null; }, createElement() { return null; }, addEventListener() {} },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  let err = null;
  try { vm.runInContext(mod, sandbox, { filename: "canva-min.js" }); } catch (e) { err = e; }
  check("bare-DOM boot is a clean no-op", err === null);
}

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);
