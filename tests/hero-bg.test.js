"use strict";
/**
 * Animated hero background — MODULE 59 (HeroMedia).
 *
 * The hero background is two stacked layers: a still photo drifting with
 * pure CSS (.hero-bg) plus an optional local video loop (.hero-media) that
 * fades in only when the device allows it. These checks cover:
 *   1. markup: the .hero-bg layer and the whole <video> contract
 *      (muted/loop/playsinline/preload=none/poster, and NO autoplay),
 *   2. styles: the heroDrift keyframes, the layer order inside .hero, the
 *      playing state, the phone rule and the reduced-motion guard,
 *   3. the service worker: cache version, the precached loop, and the
 *      range-request rule (a 206 response is never cached),
 *   4. runtime: MODULE 59 executed in a vm with a stubbed DOM, proving every
 *      veto (reduced motion, Save-Data, slow link, narrow screen, low
 *      battery) and every pause rule (hidden tab, hero off-screen, view
 *      switch, media error).
 * Run: node tests/hero-bg.test.js
 */
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
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

const modStart = js.indexOf("(function initHeroMedia()");
const mod = modStart > -1 ? js.slice(modStart) : "";
const videoTag = (html.match(/<video[\s\S]*?<\/video>/) || [""])[0];
const loopPath = path.join(root, "images", "hero-bg.mp4");

/* ---------- static: index.html ---------- */
console.log("— index.html: hero background layers —");
check("drifting photo layer present", html.includes('<div class="hero-bg" aria-hidden="true"></div>'));
check("video layer present", html.includes('class="hero-media" id="heroMedia"'));
check("video markup: muted + loop + playsinline", /muted/.test(videoTag) && /loop/.test(videoTag) && /playsinline/.test(videoTag));
check("video markup: NO autoplay attribute", videoTag.length > 0 && !/autoplay/.test(videoTag));
check("video markup: preload=\"none\" (vetoed devices download 0 bytes)", /preload="none"/.test(videoTag));
check("video markup: poster = the still hero photo", /poster="images\/backweb\.jpg"/.test(videoTag));
check("video markup: local mp4 source", /<source src="images\/hero-bg\.mp4" type="video\/mp4"/.test(videoTag));
check("video layer is inert + hidden from AT", /aria-hidden="true"/.test(videoTag) && /tabindex="-1"/.test(videoTag));
check("video sits before the glows", html.indexOf('id="heroMedia"') < html.indexOf("hero-glow-a"));
check("stylesheet stays cache-busted", /style\.css\?v=\d+\.\d+\.\d+/.test(html));
check("hero photo still preloaded as an image (untouched contract)",
  html.includes('rel="preload" as="image" href="images/backweb.jpg"'));

/* ---------- static: style.css ---------- */
console.log("\n— style.css: MODULE 59 layer —");
check("layer markers", css.includes("MODULE 59 · HeroMedia") && css.includes("END MODULE 59 · HeroMedia"));
check("style for .hero-bg", /\.hero-bg\s*\{/.test(css));
check("drift keyframes defined and applied", css.includes("@keyframes heroDrift") && css.includes("animation: heroDrift"));
check("photo layer keeps its own image source", /\.hero-bg\s*\{[\s\S]{0,400}url\("images\/backweb\.jpg"\)/.test(css));
check("photo layer is pointer-inert", /\.hero-bg\s*\{[\s\S]{0,700}pointer-events: none;/.test(css));
check("style for .hero-media", /\.hero-media\s*\{/.test(css));
check("loop covers the hero box", /\.hero-media\s*\{[\s\S]{0,400}object-fit: cover;/.test(css));
check("loop hidden until a frame rendered", css.includes(".hero-media.is-playing { opacity: 1; }"));
check(".hero-media[hidden] respected", css.includes(".hero-media[hidden] { display: none; }"));
check("drift stops while the loop plays", css.includes(".hero.is-media-playing .hero-bg { animation-play-state: paused; }"));
check("contrast overlay keeps text readable under the loop", css.includes(".hero.is-media-playing::before"));
check("light theme deepens the scrim", css.includes('[data-theme="light"] .hero.is-media-playing::before'));
check("layer order inside .hero is explicit", (() => {
  const at = css.indexOf("\n.hero {");
  const heroBlock = at > -1 ? css.slice(at, at + 800) : "";
  return heroBlock.includes("isolation: isolate");
})());
check(".hero::before sits above both background layers", /\.hero::before\s*\{[\s\S]{0,500}z-index: 1;/.test(css));
check(".hero-glow sits above the overlay", /\.hero-glow\s*\{[\s\S]{0,200}z-index: 2;/.test(css));
check(".hero-content sits above everything", /\.hero-content\s*\{\s*position: relative;\s*z-index: 3;/.test(css));
check("phone rule slows the drift", /@media \(max-width: 700px\)[\s\S]{0,200}\.hero-bg\s*\{[^}]*animation-duration: 48s/.test(css));
check("reduced-motion guard: still background", /prefers-reduced-motion[\s\S]{0,400}\.hero-bg\s*\{\s*animation: none/.test(css));
check("reduced-motion guard: no video layer", /prefers-reduced-motion[\s\S]{0,500}\.hero-media\s*\{[^}]*display: none/.test(css));

/* ---------- static: sw.js ---------- */
console.log("\n— sw.js: cache & media —");
check("cache version >= v1.22.18 (hero-background bump)", (() => {
  const m = /CACHE_VERSION\s*=\s*"v(\d+)\.(\d+)\.(\d+)"/.exec(sw);
  if (!m) return false;
  const [maj, min, pat] = [+m[1], +m[2], +m[3]];
  return maj > 1 || (maj === 1 && (min > 22 || (min === 22 && pat >= 18)));
})());
check("hero loop precached (animated hero works offline)", sw.includes('"./images/hero-bg.mp4"'));
check("range requests routed explicitly", sw.includes("handleRangeRequest") && /request\.headers\.has\("range"\)/.test(sw));
check("range path answers from the cached FULL copy", (() => {
  const at = sw.indexOf("async function handleRangeRequest");
  if (at < 0) return false;
  const body = sw.slice(at, sw.indexOf("\n}", at) + 2);
  return body.includes("cache.match(request.url)") && !body.includes("cache.put");
})());
check("loop file exists on disk (CI precache guard)", fs.existsSync(loopPath));
check("loop stays small (< 3 MB)", fs.existsSync(loopPath) && fs.statSync(loopPath).size < 3 * 1024 * 1024);
check("every precached asset exists on disk (CI guard mirrored)", (() => {
  const m = /PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\]/.exec(sw);
  if (!m) return false;
  const assets = [...m[1].matchAll(/"\.\/([^"]*)"/g)].map((x) => x[1]).filter(Boolean);
  return assets.length > 0 && assets.every((a) => fs.existsSync(path.join(root, a)));
})());

/* ---------- static: script.js ---------- */
console.log("\n— script.js: MODULE 59 —");
let parses = true;
try { new vm.Script(js); } catch (e) { parses = false; }
check("script.js parses", parses);
check("MODULE 59 marker + entry point", js.includes("MODULE 59 · HeroMedia") && modStart > -1);
check("module never uses innerHTML", mod.length > 0 && !mod.includes("innerHTML"));
check("module makes no network calls", mod.length > 0 && !/fetch\s*\(|XMLHttpRequest/.test(mod));
check("all four gates implemented",
  ["prefersReducedMotion", "dataSaver", "smallScreen", "getBattery"].every((k) => mod.includes(k)));
check("slow link detection covers Save-Data + 2g",
  mod.includes("c.saveData === true") && mod.includes("effectiveType"));
check("pauses on hidden tab, off-screen hero and view switches",
  mod.includes('"visibilitychange"') && mod.includes("IntersectionObserver") && mod.includes('"nova:view-changed"'));
check("starts only after the load event", mod.includes('window.addEventListener("load", boot)'));
check("a rejected play() promise is swallowed", mod.includes("attempt.catch"));
check("publishes window.PlatformHeroMedia", mod.includes("window.PlatformHeroMedia"));


/* ---------- runtime harness: MODULE 59 executed in a vm ---------- */
console.log("\n— runtime: stubbed browser —");

/** Minimal element stub: class list + event listeners. */
function makeBox(id) {
  const listeners = {};
  const classes = new Set();
  const box = {
    id,
    hidden: false,
    classList: {
      add(c) { classes.add(c); },
      remove(c) { classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    dispatch(t, ev) { (listeners[t] || []).forEach((fn) => fn(ev || {})); },
  };
  return box;
}

/** Video stub that records every play/pause attempt. */
function makeVideo() {
  const v = makeBox("heroMedia");
  v.paused = true;
  v.plays = 0;
  v.pauses = 0;
  v.play = function () { v.plays++; v.paused = false; return { catch() {} }; };
  v.pause = function () { v.pauses++; v.paused = true; };
  return v;
}

/** Media-query stub the test can flip mid-session. */
function makeMq(query, matches) {
  return {
    media: query,
    matches: !!matches,
    _subs: [],
    addEventListener(t, fn) { if (t === "change") this._subs.push(fn); },
    flip(next) { this.matches = !!next; this._subs.forEach((fn) => fn(this)); },
  };
}

function boot(opts) {
  opts = opts || {};
  const reduced = makeMq("(prefers-reduced-motion: reduce)", opts.reducedMotion === true);
  const narrow = makeMq("(max-width: 700px)", (opts.width || 1440) < 700);
  const hero = makeBox("hero");
  const video = makeVideo();
  const byId = { hero: hero, heroMedia: video };

  const docListeners = {};
  const documentStub = {
    readyState: "complete",
    visibilityState: opts.hiddenTab ? "hidden" : "visible",
    getElementById(id) { return byId[id] || null; },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    dispatch(t, ev) { (docListeners[t] || []).forEach((fn) => fn(ev || {})); },
    setVisibility(next) { this.visibilityState = next; this.dispatch("visibilitychange"); },
  };

  const ios = [];
  function IOStub(cb, cfg) { this.cb = cb; this.cfg = cfg; this.target = null; ios.push(this); }
  IOStub.prototype.observe = function (el) { this.target = el; };
  IOStub.prototype.emit = function (isIntersecting) {
    this.cb([{ isIntersecting: isIntersecting, target: this.target }]);
  };

  const winListeners = {};
  const win = {
    innerWidth: opts.width || 1440,
    matchMedia(query) { return query.indexOf("reduced-motion") > -1 ? reduced : narrow; },
    addEventListener(t, fn) { (winListeners[t] = winListeners[t] || []).push(fn); },
  };

  const navigatorStub = {
    connection: opts.connection || undefined,
    getBattery: opts.battery
      ? function () { return { then(cb) { cb(opts.battery); return { catch() {} }; } }; }
      : undefined,
  };

  const ctx = {
    window: win,
    document: documentStub,
    navigator: navigatorStub,
    IntersectionObserver: IOStub,
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(mod, ctx, { filename: "hero-media.js" });
  return { win, ctx, hero, video, documentStub, ios, reduced, narrow };
}

/* ---------- runtime: allowed device, pause rules, API ---------- */
{
  const app = boot();
  check("baseline: an allowed device starts the loop once", app.video.plays === 1);
  app.video.dispatch("playing");
  check("playing → both state classes applied",
    app.video.classList.contains("is-playing") && app.hero.classList.contains("is-media-playing"));
  check("public API exposed",
    typeof app.win.PlatformHeroMedia.allowed === "function" &&
    app.win.PlatformHeroMedia.started() === true &&
    app.win.PlatformHeroMedia.isPlaying() === true);

  app.documentStub.setVisibility("hidden");
  check("hidden tab pauses the loop", app.video.pauses === 1 && app.video.paused === true);
  app.documentStub.setVisibility("visible");
  check("visible tab resumes it", app.video.plays === 2);

  app.ios[0].emit(false);
  check("hero off-screen (view switch / scroll) pauses", app.video.pauses === 2);
  app.ios[0].emit(true);
  check("hero back on screen resumes", app.video.plays === 3);

  app.documentStub.dispatch("nova:view-changed");
  check("view switch re-evaluates immediately", app.video.plays === 4);

  app.video.dispatch("error");
  check("media error hides the loop and keeps the photo layer",
    app.video.hidden === true && !app.video.classList.contains("is-playing") &&
    !app.hero.classList.contains("is-media-playing"));
}
{
  const app = boot();
  app.reduced.flip(true);
  check("turning reduced motion on mid-session pauses the loop",
    app.video.plays === 1 && app.video.pauses === 1);
  app.reduced.flip(false);
  check("turning it back off resumes playback", app.video.plays === 2);
}

/* ---------- runtime: every veto ---------- */
check("reduced motion vetoes playback", boot({ reducedMotion: true }).video.plays === 0);
check("Save-Data vetoes playback", boot({ connection: { saveData: true, effectiveType: "4g" } }).video.plays === 0);
check("2g connection vetoes playback", boot({ connection: { effectiveType: "2g" } }).video.plays === 0);
check("a fast connection is not vetoed", boot({ connection: { effectiveType: "4g" } }).video.plays === 1);
check("phone-width viewport vetoes playback", boot({ width: 420 }).video.plays === 0);
check("low battery while unplugged vetoes playback",
  boot({ battery: { level: 0.12, charging: false } }).video.plays === 0);
check("low battery while charging is fine", (() => {
  /* The stubbed battery resolves synchronously, so evaluate() runs twice
     (battery callback + post-load boot): what matters is that the loop is
     allowed AND actually running. */
  const app = boot({ battery: { level: 0.12, charging: true } });
  return app.video.plays >= 1 && app.video.paused === false;
})());
check("healthy battery is not vetoed", (() => {
  const app = boot({ battery: { level: 0.8, charging: false } });
  return app.video.plays >= 1 && app.video.paused === false;
})());
check("a tab hidden at boot never starts the loop", boot({ hiddenTab: true }).video.plays === 0);

/* ---------- runtime: defensive no-ops (missing markup / weak stubs) ---------- */
check("missing markup is a clean no-op", (() => {
  const ctx = { window: {}, document: { getElementById() { return null; } }, navigator: {}, console };
  vm.createContext(ctx);
  vm.runInContext(mod, ctx, { filename: "hero-media.js" });
  return true;
})());
check("a video without play() is a clean no-op", (() => {
  const ctx = {
    window: { matchMedia: null },
    document: { getElementById(id) { return id === "hero" ? makeBox("hero") : { id: "heroMedia" }; } },
    navigator: {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(mod, ctx, { filename: "hero-media.js" });
  return true;
})());

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) failed" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);


