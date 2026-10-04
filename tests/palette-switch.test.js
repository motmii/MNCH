"use strict";
/* Palette switch — MODULE 36b (rose <-> classic). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
let failures = 0;
function check(name, cond) {
  if (cond) console.log("  PASS " + name);
  else { failures++; console.error("  FAIL: " + name); }
}
check("mounts #paletteToggle", html.includes('id="paletteToggle"'));
check("pre-paint restores palette", html.includes("motmi-portal:palette"));
check("classic dark tokens", css.includes('[data-palette="classic"]'));
check("classic light tokens", css.includes('[data-palette="classic"][data-theme="light"]'));
check("toggle styled", css.includes(".palette-toggle"));
check("module marker", js.includes("36b"));
check("persists palette", js.includes("palette"));
check("runtime flips ribbon text", js.includes("on-grad"));

console.log("live behaviour");
function makeEl(id) {
  const el = { id: id, _a: {}, _l: {},
    setAttribute: function (k, v) { this._a[k] = String(v); },
    getAttribute: function (k) { return (k in this._a) ? this._a[k] : null; },
    removeAttribute: function (k) { delete this._a[k]; },
    addEventListener: function (t, fn) { (this._l[t] = this._l[t] || []).push(fn); },
    click: function () { (this._l.click || []).forEach(function (fn) { fn(); }); },
    title: "",
    style: { _p: {}, setProperty: function (k, v) { this._p[k] = v; } } };
  return el;
}
const rootEl = makeEl("html");
const btnEl = makeEl("paletteToggle");
const metaEl = makeEl("meta");
const store = {};
const sb = {
  console: console,
  document: {
    documentElement: rootEl,
    getElementById: function (id) { return id === "paletteToggle" ? btnEl : null; },
    querySelector: function (s) { return s === 'meta[name="theme-color"]' ? metaEl : null; },
    querySelectorAll: function () { return []; },
    addEventListener: function () {}
  },
  localStorage: {
    getItem: function (k) { return (k in store) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; }
  },
  matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
  MutationObserver: function () { return { observe: function () {} }; },
  setTimeout: setTimeout, clearTimeout: clearTimeout
};
sb.window = sb;
sb.globalThis = sb;
vm.createContext(sb);
let threw = null;
try {
  /* Extract the MODULE 36b IIFE from the shipped script.js and run it against
     the stub DOM. $id + Store are provided by earlier modules, so define the
     same minimal shims the real page has at that point (Store reads/writes
     localStorage JSON under the "motmi-portal:" prefix). */
  const start = js.indexOf("MODULE 36b");
  if (start === -1) throw new Error("MODULE 36b marker missing");
  const fnStart = js.indexOf("(function () {", start);
  const fnEnd = js.indexOf("})();", start);
  if (fnStart === -1 || fnEnd === -1) throw new Error("MODULE 36b body not found");
  const src = js.slice(fnStart, fnEnd + ")();".length);
  const prelude = "function $id(id){ return document.getElementById(id); }\n"
    + "var Store = { get: function(k){ try { return JSON.parse(localStorage.getItem(\"motmi-portal:\" + k)); } catch (e) { return null; } },"
    + " set: function(k, v){ try { localStorage.setItem(\"motmi-portal:\" + k, JSON.stringify(v)); } catch (e) {} } };\n";
  vm.runInContext(prelude + src, sb, { filename: "module-36b.js" });
  check("default rose", rootEl.getAttribute("data-palette") === null);
  btnEl.click();
  check("click to classic", rootEl.getAttribute("data-palette") === "classic");
  btnEl.click();
  check("click back to rose", rootEl.getAttribute("data-palette") === null);
} catch (e) { threw = e; }
check("runs without throwing", !threw);
if (threw) console.error("  -> " + threw.message);

const m = /CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/.exec(sw);
check("cache bumped", !!m && (+m[1] > 1 || (+m[1] === 1 && (+m[2] > 22 || (+m[2] === 22 && +m[3] >= 24)))));
console.log(failures ? "FAIL " + failures : "ALL PASS");
process.exit(failures ? 1 : 0);

