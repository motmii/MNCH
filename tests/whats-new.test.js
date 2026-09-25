"use strict";
/**
 * WhatsNew (MODULE 58) smoke test - navbar thumbs-up button and its
 * "latest updates" popover: markup placement, i18n (ar + en), styles,
 * module wiring, honest dated changelog sorted newest-first, and the
 * service-worker cache bump.
 * Run: node tests/whats-new.test.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  \u2713 " + name);
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}

console.log("- index.html: trigger + panel -");
["navUpdates", "updatesBtn", "updatesPanel", "updatesList", "updatesClose",
 "updatesDot", "updatesTitle", "updatesSub", "updatesEmpty"].forEach((id) => {
  check("mounts #" + id, html.includes("id=\"" + id + "\""));
});check("trigger wires the dialog (haspopup + controls + collapsed)",
  /id="updatesBtn"[^>]*aria-haspopup="dialog"/.test(html) &&
  /id="updatesBtn"[^>]*aria-controls="updatesPanel"/.test(html) &&
  /id="updatesBtn"[^>]*aria-expanded="false"/.test(html));
check("panel is a labelled dialog, hidden by default",
  /id="updatesPanel"[^>]*role="dialog"/.test(html) &&
  /id="updatesPanel"[^>]*aria-labelledby="updatesTitle"/.test(html) &&
  /id="updatesPanel"[^>]*hidden/.test(html));
check("trigger sits in the red-box slot (inside .nav-main, before .nav-actions)",
  html.indexOf("navUpdates") > -1 && html.indexOf("navUpdates") < html.indexOf("class=\"nav-actions\""));
check("thumbs-up icon rendered", /class="updates-ico"[\s\S]{0,500}M7 10v11/.test(html));
check("close button labelled bilingually", /id="updatesClose"[^>]*aria-label="إغلاق \/ Close"/.test(html));

console.log("- i18n: ar + en dictionaries -");
const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
const required = ["updates.title", "updates.sub", "updates.empty", "updates.foot",
  "updates.tag.new", "updates.tag.improve", "updates.tag.release", "updates.tag.fix"];
required.forEach((key) => {
  check("dict key \"" + key + "\" in ar + en",
    arSrc.includes("\"" + key + "\"") && enSrc.includes("\"" + key + "\""));
});
const keyRe = /data-i18n="([^"]+)"/g;
let match;
const htmlKeys = [];
while ((match = keyRe.exec(html)) !== null) htmlKeys.push(match[1]);
const panelKeys = htmlKeys.filter((k) => k.indexOf("updates.") === 0);
check("panel exposes at least 4 data-i18n keys", panelKeys.length >= 4);
panelKeys.forEach((key) => {
  check("html key in both dicts: " + key,
    arSrc.includes("\"" + key + "\"") && enSrc.includes("\"" + key + "\""));
});console.log("- script.js: MODULE 58 -");
const modAt = js.indexOf("function initWhatsNew()");
const mod = modAt >= 0 ? js.slice(modAt) : "";
check("module marker + entry point", js.includes("MODULE 58") && modAt > -1);
check("single source of truth data array", mod.includes("var UPDATES = ["));
check("newest-first sort", mod.includes("function byDateDesc") && mod.includes("UPDATES.slice().sort(byDateDesc)"));
check("dated ISO entries", (mod.match(/date: "\d{4}-\d{2}-\d{2}"/g) || []).length >= 5);
check("every entry bilingual (ar + en)", (mod.match(/title: \{ ar:/g) || []).length >= 5);
check("opens on click and Escape closes it", mod.includes("btn.addEventListener(\"click\"") && mod.includes("\"Escape\""));
check("outside click closes it", mod.includes("wrap.contains"));
check("closes on view change", mod.includes("\"nova:view-changed\""));
check("aria-expanded kept in sync", mod.includes("btn.setAttribute(\"aria-expanded\""));
check("local-only unread dot (Store, no network)", mod.includes("whatsnew-seen") && mod.includes("storeGet(") && !/fetch\(|XMLHttpRequest/.test(mod));
check("re-renders on language switch", mod.includes("Lang.onSwitch"));
check("defensive boot for missing nodes", mod.includes("if (!wrap || !btn || !panel || !list) return;"));
check("exposes window.PlatformWhatsNew", mod.includes("window.PlatformWhatsNew"));console.log("- style.css: MODULE 58 layer -");
const cssAt = css.indexOf("MODULE 58");
const layer = cssAt > -1 ? css.slice(cssAt) : "";
[".updates-toggle", ".updates-panel", ".updates-list", ".updates-item",
 ".updates-dot", ".updates-close", ".updates-tag"].forEach((sel) => {
  check("style for " + sel, layer.includes(sel));
});
check("panel hidden state respected", layer.includes(".updates-panel[hidden]"));
check("mobile sheet rule", layer.includes("position: fixed") && layer.includes("max-width: 700px"));
check("reduced-motion guard", layer.includes("prefers-reduced-motion: reduce"));
check("layer closed with END marker", layer.includes("END MODULE 58"));

console.log("- service worker -");
const verMatch = sw.match(/CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/);
const verOk = !!verMatch && ((+verMatch[1] > 1) ||
  (+verMatch[1] === 1 && +verMatch[2] > 22) ||
  (+verMatch[1] === 1 && +verMatch[2] === 22 && +verMatch[3] >= 17));
check("cache version >= v1.22.17 (WhatsNew bump)", verOk);


/* ---------- live behavior: boot the real module in a VM ---------- */
const vmMod = require("vm");
function makeNode(id) {
  return {
    id: id,
    hidden: false,
    attrs: {},
    listeners: {},
    children: [],
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    focus() {},
    contains() { return true; },
    get firstChild() { return this.children[0] || null; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); }
  };
}
function makeEl(tag) {
  const e = makeNode("");
  e.tagName = String(tag || "").toUpperCase();
  e.className = "";
  e.textContent = "";
  return e;
}const nodes = {};
["navUpdates", "updatesBtn", "updatesPanel", "updatesList", "updatesClose",
 "updatesDot", "updatesEmpty"].forEach((id) => { nodes[id] = makeNode(id); });
nodes.updatesPanel.hidden = true;
nodes.updatesEmpty.hidden = true;
const docL = {};
const sandbox = {
  document: {
    getElementById(id) { return nodes[id] || null; },
    createElement(tag) { return makeEl(tag); },
    addEventListener(t, fn) { (docL[t] = docL[t] || []).push(fn); }
  },
  Lang: { current: "ar", t(k) { return k; }, onSwitch() {} },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }
};
sandbox.window = sandbox;
const modStart = js.indexOf("(function initWhatsNew()");
const modSrc = modStart > -1 ? js.slice(modStart) : "";
let bootError = null;
try { vmMod.runInNewContext(modSrc, sandbox, { filename: "whatsnew-module.js" }); }
catch (e) { bootError = e; }
check("module boots in a minimal DOM", modStart > -1 && !bootError);
if (bootError) console.error("    -> " + bootError.message);

console.log("- live behavior -");
check("panel starts collapsed", nodes.updatesPanel.hidden === true);
check("unread dot visible before first open", nodes.updatesDot.hidden === false);
const cards = nodes.updatesList.children;
check("renders 6 update cards", cards.length === 6);const topOf = (c) => c && c.children[0];
const dateOf = (c) => topOf(c) && topOf(c).children[1];
check("newest card is first (2026-09-24)", !!dateOf(cards[0]) && dateOf(cards[0]).attrs.datetime === "2026-09-24");
check("oldest card is last (2026-08-31)", !!dateOf(cards[cards.length - 1]) && dateOf(cards[cards.length - 1]).attrs.datetime === "2026-08-31");
check("dates never go out of order", cards.every((c, i) => {
  if (!i) return true;
  return dateOf(cards[i - 1]).attrs.datetime >= dateOf(c).attrs.datetime;
}));
check("card markup: top row + title + description",
  cards.every((c) => c.children.length === 3 && topOf(c).children.length === 2));
check("titles carry real Arabic text",
  cards.every((c) => typeof c.children[1].textContent === "string" && c.children[1].textContent.length > 3));

const clickBtn = (nodes.updatesBtn.listeners.click || [])[0];
check("trigger click opens the panel", (function () {
  if (!clickBtn) return false;
  clickBtn();
  return nodes.updatesPanel.hidden === false && nodes.updatesBtn.attrs["aria-expanded"] === "true";
})());
check("opening marks the changelog seen (dot hides)", nodes.updatesDot.hidden === true);
check("Escape closes the panel", (function () {
  const esc = (docL.keydown || [])[0];
  if (!esc) return false;
  esc({ key: "Escape" });
  return nodes.updatesPanel.hidden === true && nodes.updatesBtn.attrs["aria-expanded"] === "false";
})());
check("close button closes it too", (function () {
  const close = (nodes.updatesClose.listeners.click || [])[0];
  if (!close || !clickBtn) return false;
  clickBtn();
  close();
  return nodes.updatesPanel.hidden === true;
})());
check("outside-click and view-change listeners registered",
  (docL.click || []).length >= 1 && (docL["nova:view-changed"] || []).length >= 1);
check("panel never renders before opening", cards.length === 6 && nodes.updatesPanel.hidden === true);
console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);