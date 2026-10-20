"use strict";
/**
 * Sound layer test — MODULE 03 Sfx + MODULE 03b Soundscape (slim).
 * Boots the whole script.js in a stubbed browser with a fake Web Audio
 * implementation, then plays every KEPT cue and drives the wiring paths
 * (meaningful feedback only, mute switch) for real.
 *
 * Contract (2026 slim-down): interface chrome — clicks, toggles, overlay
 * open/close, nav, scrolling, view changes, flashcard flips — is silent
 * by design. Only learning feedback speaks: quiz/lesson grades
 * ("good"/"bad"), quiz timeout, and the study-timer "chime".
 * Run: node tests/sound-engine.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const cs = require(path.join(root, "current-semester.js"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  \u2713 " + name);
  else { failures++; console.error("  \u2717 FAIL: " + name); }
}
function busyWait(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { /* spin so the cue de-bounce window passes */ }
}

/* ---------- fake Web Audio that records everything ---------- */
const FA = { osc: 0, buf: 0, starts: 0, gains: 0 };
function snap() { return { osc: FA.osc, buf: FA.buf, starts: FA.starts }; }
function param() {
  const p = { value: 0 };
  p.setValueAtTime = function () { return p; };
  p.linearRampToValueAtTime = function () { return p; };
  p.exponentialRampToValueAtTime = function () { return p; };
  return p;
}
function mkNode(extra) {
  const n = Object.assign({
    connect(t) { return t; },
    disconnect() {},
    start() { FA.starts++; },
    stop() {},
  }, extra || {});
  return n;
}
function FakeAudioContext() {
  this.currentTime = 0;
  this.sampleRate = 44100;
  this.state = "running";
  this.destination = {};
  this.resume = function () { return Promise.resolve(); };
  this.createGain = function () { FA.gains++; return mkNode({ gain: param() }); };
  this.createOscillator = function () { FA.osc++; return mkNode({ type: "sine", frequency: param() }); };
  this.createBufferSource = function () { FA.buf++; return mkNode({ buffer: null, playbackRate: param() }); };
  this.createBiquadFilter = function () { return mkNode({ type: "", frequency: param(), Q: param() }); };
  this.createDelay = function () { return mkNode({ delayTime: param() }); };
  this.createDynamicsCompressor = function () {
    return mkNode({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
  };
  this.createStereoPanner = function () { return mkNode({ pan: param() }); };
  this.createBuffer = function (ch, len, rate) {
    return { length: len, getChannelData: function () { return new Float32Array(len); } };
  };
}

/* ---------- DOM stubs (same pattern as full-boot.test.js) ---------- */
function makeEl(id) {
  const el = {
    id, _html: "", style: {}, dataset: {}, listeners: {}, children: [],
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); return this._s.has(c); },
      contains(c) { return this._s.has(c); },
    },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    addEventListener(t, fn) { (el.listeners[t] = el.listeners[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { el.children.push(c); return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; },
    scrollIntoView() {}, focus() {}, blur() {}, click() {},
    remove() { el._removed = true; },
  };
  Object.defineProperty(el, "innerHTML", { get() { return el._html; }, set(v) { el._html = String(v); } });
  Object.defineProperty(el, "textContent", { get() { return el._text || ""; }, set(v) { el._text = String(v); } });
  return el;
}

const ids = [
  "preloader","nav","navBurger","mobileMenu","langToggle","toTop",
  "quizApp","flashGrid","flashSearch","flashShuffle","flashEmpty","subjectSearch","resultsCount","emptyState","subjectsGrid",
  "progressApp","heroContinue","heroContinueMeta","heroContinueBtn",
  "pathsGrid","pathDetailBody","lessonBody","lessonView",
  "semesterGrid","semesterMeta",
  "hero","semester","paths","path","subjects","tools","labs","flash","quiz","kali",
  "progress","games","redteam","ir","cryptolab","about","contact","lesson","depth",
  "heroDash","heroDashPct","heroDashBar","heroDashLesson","heroDashQuiz","heroDashContinue",
  "searchOpenBtn","searchOverlay","searchDialog","searchInput","searchResults","searchClose",
  "onboardingOverlay","onboardingBack","onboardingSkip","onboardingNext","onboardingStart",
  "assistantRoot","assistantPanel","assistantFab",
];
const byId = {};
ids.forEach((id) => { byId[id] = makeEl(id); });
const TOOL_IDS = ["tool-hash","tool-caesar","tool-jwt","tool-cidr","tool-password","tool-encoders","tool-playground","tool-vuln","tool-portscan","tool-sniffer","tool-fw","tool-b64"];
TOOL_IDS.forEach((id) => {
  byId[id] = Object.assign(makeEl(id), {
    querySelector(sel) { return sel === ".tool-title" ? { textContent: { trim: () => id } } : null; },
  });
});

const docListeners = {};
const mainEl = makeEl("main");
const documentStub = {
  hidden: false,
  getElementById(id) { return byId[id] || null; },
  querySelector(sel) { return sel === "main" ? mainEl : null; },
  querySelectorAll() { return []; },
  addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
  removeEventListener() {},
  dispatchEvent(ev) {
    (docListeners[ev && ev.type] || []).forEach((fn) => { try { fn(ev); } catch (e) { void e; } });
    return true;
  },
  createElement() { return makeEl(""); },
  documentElement: { setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, style: { setProperty() {} }, lang: "ar", dir: "rtl" },
  body: makeEl("body"),
  title: "",
  readyState: "complete",
};

const storage = {};
const localStorageStub = {
  getItem(k) { return storage[k] !== undefined ? storage[k] : null; },
  setItem(k, v) { storage[k] = String(v); },
  removeItem(k) { delete storage[k]; },
};

const winListeners = [];
const windowStub = {
  PLATFORM_CURRENT_SEMESTER: cs,
  AudioContext: FakeAudioContext,
  scrollY: 0,
  addEventListener(t, fn) { winListeners.push([t, fn]); },
  removeEventListener() {},
  dispatchEvent() { return true; },
  matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
  requestAnimationFrame() { return 0; },
  cancelAnimationFrame() {},
  location: { hash: "", href: "http://localhost/" },
  history: { pushState() {}, replaceState() {} },
  scrollTo() {},
  getComputedStyle() { return {}; },
  localStorage: localStorageStub,
  navigator: { language: "ar", serviceWorker: undefined },
  CustomEvent: function (type, opts) { return { type, detail: opts && opts.detail }; },
  IntersectionObserver: function () { return { observe() {}, unobserve() {}, disconnect() {} }; },
  MutationObserver: function () { return { observe() {}, disconnect() {} }; },
  Worker: undefined,
  fetch: () => Promise.reject(new Error("offline-stub")),
  setTimeout, clearTimeout, setInterval, clearInterval,
  innerWidth: 1280, innerHeight: 800,
};

const sandbox = Object.assign(windowStub, {
  console,
  window: windowStub,
  document: documentStub,
  localStorage: localStorageStub,
  navigator: windowStub.navigator,
  location: windowStub.location,
  history: windowStub.history,
  CustomEvent: windowStub.CustomEvent,
  IntersectionObserver: windowStub.IntersectionObserver,
  MutationObserver: windowStub.MutationObserver,
  matchMedia: windowStub.matchMedia,
  requestAnimationFrame: windowStub.requestAnimationFrame,
  fetch: windowStub.fetch,
  setTimeout, clearTimeout, setInterval, clearInterval,
  indexedDB: undefined,
});
vm.createContext(sandbox);

let threw = null;
try {
  vm.runInContext(js, sandbox, { filename: "script.js" });
} catch (e) { threw = e; }
check("full script.js executes without throwing (with Web Audio present)", !threw);
if (threw) console.error("    \u2192 " + threw.message);

/* ---------- engine + surface ---------- */
const NS = sandbox.NovaSound;
check("window.NovaSound is exposed", NS && typeof NS.play === "function");
check("sound is on by default (Store 'sound')", NS && NS.enabled === true);

/* ---------- every KEPT cue plays ---------- */
const KINDS = ["good", "bad", "timeout", "chime"];
for (const kind of KINDS) {
  const before = snap();
  NS.play(kind, { intensity: 0.8, dir: 1 });
  const after = snap();
  check("cue '" + kind + "' schedules sources", after.starts > before.starts);
}

/* ---------- dropped cues are silent no-ops ---------- */
const DROPPED = ["tap", "nav", "open", "close", "toggle", "tick", "flip", "view", "scroll"];
busyWait(90);
for (const kind of DROPPED) {
  const before = snap();
  NS.play(kind, { intensity: 0.8, dir: 1 });
  const after = snap();
  check("dropped cue '" + kind + "' schedules nothing", after.starts === before.starts);
}

/* ---------- same-cue de-bounce ---------- */
busyWait(120);
{
  const before = snap();
  NS.play("good");
  const mid = snap();
  NS.play("good");
  const after = snap();
  check("same cue fires again after the window", mid.starts > before.starts);
  check("same cue de-bounces inside 70ms", after.starts === mid.starts);
}

/* ---------- unknown cue is a silent no-op ---------- */
busyWait(80);
{
  const before = snap();
  NS.play("nope");
  const after = snap();
  check("unknown cue schedules nothing", after.starts === before.starts);
}

/* ---------- mute switch ---------- */
busyWait(120);
{
  check("setEnabled(false) flips the surface", NS.setEnabled(false) === false);
  const before = snap();
  NS.play("good");
  const after = snap();
  check("muted layer schedules nothing", after.starts === before.starts);
  check("mute persists to the shared Store", storage["motmi-portal:sound"] === "false" || Object.keys(storage).some((k) => k.indexOf("sound") !== -1));
  check("setEnabled(true) re-arms", NS.setEnabled(true) === true);
  busyWait(80);
  const b2 = snap();
  NS.play("good");
  const a2 = snap();
  check("re-enabled layer plays again", a2.starts > b2.starts);
}

/* ---------- gesture priming stays wired ---------- */
{
  const pd = docListeners["pointerdown"];
  const kd = docListeners["keydown"];
  check("pointerdown listener registered (capture)", Array.isArray(pd) && pd.length > 0);
  check("keydown listener registered (capture)", Array.isArray(kd) && kd.length > 0);
}

/* ---------- source-level wiring ---------- */
const i0 = js.indexOf("03b \u00b7 Soundscape");
const i1 = js.indexOf("end 03b \u00b7 Soundscape");
const layer = i0 !== -1 && i1 !== -1 ? js.slice(i0, i1) : "";
check("Soundscape module markers present", layer.length > 0);
check("pointerdown primes the audio context", layer.indexOf("pointerdown") !== -1);
check("no network anywhere in the sound layer", !/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(layer));
check("no click classifier in 03b (chrome stays silent)", layer.indexOf("CONTROL_SEL") === -1);
check("no overlay watcher in 03b (chrome stays silent)", layer.indexOf("MutationObserver") === -1);
check("no scroll whisper in 03b (chrome stays silent)", layer.indexOf("intensity") === -1 || layer.indexOf("play(kind, opt)") !== -1);
for (const kind of KINDS) {
  check("engine defines cue '" + kind + "'", js.indexOf('case "' + kind + '"') !== -1);
}
for (const kind of DROPPED) {
  check("engine dropped cue '" + kind + "'", js.indexOf('case "' + kind + '"') === -1);
}
check("voice cap present", js.indexOf("MAX_VOICES") !== -1 && js.indexOf("voiceCount() > MAX_VOICES") !== -1);
check("same-cue de-bounce present", js.indexOf("DUP_MS") !== -1);

check("quiz grades with 'good'/'bad'", /Sfx\.play\(correct \? "good" : "bad"\)/.test(js));
check("lesson checks grade with 'good'/'bad'", /Sfx\.play\(ok\?"good":"bad"\)/.test(js));
check("timer finish rings the 'chime'", /Sfx\.play\("chime"\)/.test(js));
check("flashcard flip stays silent (no Sfx.play('flip') call)", js.indexOf('Sfx.play("flip")') === -1 && js.indexOf('sfx("flip")') === -1);
check("view change stays silent (no whoosh call)", js.indexOf('Sfx.play("view")') === -1);
check("quiz option stays silent (no tick call)", js.indexOf('Sfx.play("tick")') === -1);
check("old nav-only click handler replaced", js.indexOf('closest(".nav-links a[href]")') === -1);
check("Store 'sound' key still gates the engine", js.indexOf('Store.get("sound", true)') !== -1);

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);
