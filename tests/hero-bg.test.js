"use strict";
/**
 * v3.0.0 Cyber OS hero — MODULE 92 (PlatformCommandDeck).
 *
 * The hero was rebuilt from scratch: the photo/video background layers and
 * MODULE 59 (HeroMedia) are gone, replaced by the .hero-fx visual shell, the
 * .hero-split layout, the 3D Command Deck (radar / terminal / telemetry tabs)
 * and the Cyber Bento Matrix. These checks cover:
 *   1. markup: the new hero shell, the deck chrome, the three tabpanels, the
 *      radial HUD gauges, the terminal contract, the bento matrix — and the
 *      FULL retirement of every legacy hero-media / marquee / scroll-hint node,
 *   2. styles: the MODULE 92 layer (tokens, orbs, split grid, deck chrome,
 *      radar list, terminal, gauges, bento) + the purge of the legacy layers,
 *   3. the service worker: cache version, the media files and the range
 *      handler are gone, precache still mirrors the files on disk,
 *   4. script.js: MODULE 59 removed, MODULE 92 present, both dictionaries
 *      carry every new key, and the module never uses innerHTML / network,
 *   5. runtime: MODULE 92 executed in a vm with a stubbed DOM — radar rows,
 *      live flags, the terminal commands, the gauge mirror and the wiring.
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
const cs = require(path.join(root, "current-semester.js"));

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

const m92Start = js.indexOf("(function initCommandDeck()");
const m92 = m92Start > -1 ? js.slice(m92Start) : "";

/* ---------- static: index.html — the v3 shell ---------- */
console.log("— index.html: v3 Cyber OS shell —");
check(".hero-fx visual shell present", html.includes('class="hero-fx"'));
check("dot-matrix plane + exactly 3 orbs",
  html.includes('class="hero-grid"') && (html.match(/class="hero-orb hero-orb-[abc]"/g) || []).length === 3);
check("decorative layers hidden from AT",
  /class="hero-fx"[^>]*aria-hidden="true"/.test(html));
check(".hero-split asymmetric layout", html.includes('class="hero-split"') && html.includes('class="hero-main"') && html.includes('class="hero-side"'));
check("Command Deck keeps the #heroDash mount", /class="[^"]*cmd-deck[^"]*"[^>]*id="heroDash"|id="heroDash"[^>]*class="[^"]*cmd-deck/.test(html) ||
  (html.includes('id="heroDash"') && html.indexOf('cmd-deck') < html.indexOf('id="heroDash"')));
check("deck chrome bar with dots + led", html.includes('class="deck-chrome"') &&
  (html.match(/class="deck-dot"/g) || []).length === 3 && html.includes('class="deck-chrome-led"'));

/* ---------- static: index.html — legacy hero fully retired ---------- */
console.log("\n— index.html: legacy media retired —");
check("no .hero-bg photo layer", !html.includes('class="hero-bg"'));
check("no legacy hero video mount (#heroMedia gone)", !html.includes('id="heroMedia"'));
check("no backweb.jpg reference anywhere", !html.includes("backweb.jpg"));
check("no hero-bg.mp4 reference anywhere", !html.includes("hero-bg.mp4"));
check("no preload of the old photo", !html.includes('rel="preload" as="image"'));
check("no marquee block", !html.includes('class="marquee"'));
check("no scroll-hint", !html.includes("scroll-hint"));
check("no legacy hero credit line", !html.includes("hero-credit"));

/* ---------- static: index.html — deck tabs & panels ---------- */
console.log("\n— index.html: Command Deck contract —");
check("tablist keeps its mount id", html.includes('id="heroDashTabs" role="tablist"'));
check("radar tab is the default", html.includes('id="heroTabRadar" role="tab" aria-selected="true" aria-controls="heroPanelRadar"'));
check("terminal + console tabs start inactive",
  html.includes('id="heroTabTerminal" role="tab" aria-selected="false" aria-controls="heroPanelTerminal" tabindex="-1"') &&
  html.includes('id="heroTabConsole" role="tab" aria-selected="false" aria-controls="heroPanelConsole" tabindex="-1"'));
check("radar panel visible, other two start hidden",
  /id="heroPanelRadar"[^>]*role="tabpanel"/.test(html) &&
  !/id="heroPanelRadar"[^>]*hidden/.test(html) &&
  /id="heroPanelTerminal"[^>]*hidden/.test(html) &&
  /id="heroPanelConsole"[^>]*hidden/.test(html));
check("terminal: log + form + ltr input",
  html.includes('id="heroTermLog"') && html.includes('id="heroTermForm"') &&
  /id="heroTermInput"[^>]*dir="ltr"/.test(html));
check("terminal log opts out of Lenis + announces politely",
  /id="heroTermLog"[^>]*aria-live="polite"/.test(html) && /id="heroTermLog"[^>]*data-lenis-prevent/.test(html));
check("three radial gauges with pathLength=100 loops",
  (html.match(/class="hud-ring is-value" id="heroGauge\w+Arc"/g) || []).length === 3 &&
  (html.match(/id="heroGauge\w+Arc"[^>]*pathLength="100"/g) || []).length === 3);
check("completion gauge owns the legacy #heroDashPct value", /id="heroGaugeDoneArc"[\s\S]{0,600}?id="heroDashPct"/.test(html));
check("telemetry keeps the legacy meter mounts inside the console panel",
  /id="heroPanelConsole"[\s\S]*?id="heroDashOverallMeter"[\s\S]*?id="heroDashBar"/.test(html) &&
  /id="heroPanelConsole"[\s\S]*?id="heroDashXpBar"/.test(html) &&
  /id="heroPanelConsole"[\s\S]*?id="heroDashDailyBar"/.test(html));
check("all adaptive/continue mounts live inside the console panel",
  /id="heroPanelConsole"[\s\S]*?id="heroNextAction"/.test(html) &&
  /id="heroPanelConsole"[\s\S]*?id="heroContinue"/.test(html));

/* ---------- static: index.html — bento + search ---------- */
console.log("\n— index.html: bento matrix & search —");
check("#bentoMatrix with 3 cards (sem/soc/arsenal)",
  html.includes('id="bentoMatrix"') &&
  ["bento-sem", "bento-soc", "bento-arsenal"].every((c) => html.includes("bento-card " + c)));
check("each bento card carries its glow layer",
  (html.match(/class="bento-glow" aria-hidden="true"/g) || []).length === 3);
check("bento mounts: schedule list + arsenal strip",
  html.includes('id="bentoSemList"') && html.includes('id="arsenalStrip"'));
check("4 SOC lab links route to real views",
  ["#redteam", "#cryptolab", "#ir", "#games"].every((h) => html.includes('class="soc-lab" href="' + h + '"')));
check("search trigger wired to the palette dialog",
  /id="heroSearchTrigger"[^>]*aria-controls="searchDialog"/.test(html));
check("stylesheet stays cache-busted", /style\.css\?v=\d+\.\d+\.\d+/.test(html));

/* ---------- static: style.css — MODULE 92 layer ---------- */
console.log("\n— style.css: MODULE 92 layer —");
check("layer markers present",
  css.includes("MODULE 92 · Cyber OS & Command Deck") && css.includes("END MODULE 92 · Cyber OS & Command Deck (v3.0.0)"));
const L92 = css.indexOf("MODULE 92 · Cyber OS & Command Deck");
const L92END = css.indexOf("END MODULE 92 · Cyber OS & Command Deck");
const layer = L92 > -1 && L92END > L92 ? css.slice(L92, L92END) : "";
check(".hero-fx shell + orbs + drift keyframes",
  layer.includes(".hero-fx {") && layer.includes(".hero-orb {") &&
  layer.includes("@keyframes orbDriftA") && layer.includes("@keyframes orbDriftB"));
check(".hero-split grid collapses on narrow screens",
  layer.includes(".hero-split {") && /@media \(max-width: 1020px\)[\s\S]{0,200}\.hero-split\s*\{/.test(layer));
check("deck perspective lives on .hero-side", /\.hero-side\s*\{[\s\S]{0,200}perspective:/.test(layer));
check("radar pulse + deck led animations declared",
  layer.includes("@keyframes radarPulse") && layer.includes("@keyframes deckLed"));
check("cmd-deck shell neutralises the legacy ::before",
  layer.includes(".cmd-deck::before { content: none; }") && /\.cmd-deck\s*\{[\s\S]{0,200}transform-style: preserve-3d/.test(layer));
check("terminal styles use the mono stack",
  layer.includes(".deck-term-log") && layer.includes(".term-line") && layer.includes(".term-err"));
check("radar item states styled", layer.includes(".radar-item.is-live") && layer.includes(".radar-item.is-today") && layer.includes(".radar-item.is-next"));
check("gauge arcs map to the deck palette",
  layer.includes("#heroGaugeLevelArc { stroke:") && layer.includes("#heroGaugeXpArc { stroke:") && layer.includes("#heroGaugeDoneArc { stroke:"));
check("bento matrix + glow + arsenal chip styles",
  layer.includes(".bento-matrix {") && layer.includes(".bento-glow {") && layer.includes(".arsenal-chip {"));
check("hero primary CTA carries the deck gradient",
  /\.hero-actions \.btn-primary\s*\{[\s\S]{0,200}var\(--deck-green\)/.test(layer));
check("reduced-motion guard inside the layer",
  /prefers-reduced-motion[\s\S]{0,400}\.hero-orb/.test(layer));

/* ---------- static: style.css — legacy purge ---------- */
console.log("\n— style.css: legacy hero layers purged —");
["\\.hero-bg\\s*\\{", "\\.hero-media\\s*\\{", "\\.hero-glow\\s*\\{", "\\.scroll-hint\\s*\\{", "\\.marquee\\s*\\{",
 "heroDrift", "is-media-playing", "heroPulse", "floatA", "floatB", "\\.hero-credit\\s*\\{"].forEach((re) => {
  check("no legacy rule " + re.replace(/\\/g, ""), !new RegExp(re).test(css));
});

/* ---------- static: sw.js ---------- */
console.log("\n— sw.js: cache & media —");
check("cache version bumped to v3.0.0", /CACHE_VERSION\s*=\s*"v3\.0\.0"/.test(sw));
check("hero loop no longer precached", !sw.includes('"./images/hero-bg.mp4"'));
check("old hero photo no longer precached", !sw.includes('"./images/backweb.jpg"'));
check("range-request handler fully removed", !sw.includes("handleRangeRequest") && !/request\.headers\.has\("range"\)/.test(sw));
check("every precached asset exists on disk (CI guard mirrored)", (() => {
  const m = /PRECACHE_ASSETS\s*=\s*\[([\s\S]*?)\]/.exec(sw);
  if (!m) return false;
  const assets = [...m[1].matchAll(/"\.\/([^"]*)"/g)].map((x) => x[1]).filter(Boolean);
  return assets.length > 0 && assets.every((a) => fs.existsSync(path.join(root, a)));
})());

/* ---------- static: script.js ---------- */
console.log("\n— script.js: MODULE 59 out, MODULE 92 in —");
let parses = true;
try { new vm.Script(js); } catch (e) { parses = false; }
check("script.js parses", parses);
check("MODULE 59 marker + entry point removed",
  !js.includes("MODULE 59 · HeroMedia") && !js.includes("(function initHeroMedia()"));
check("MODULE 92 marker + entry point present",
  js.includes("MODULE 92 · PlatformCommandDeck") && m92Start > -1);
check("module never uses innerHTML", m92.length > 0 && !m92.includes("innerHTML"));
check("module makes no network calls", m92.length > 0 && !/fetch\s*\(|XMLHttpRequest/.test(m92));
check("radar rows derive from the official current-semester data",
  m92.includes("PLATFORM_CURRENT_SEMESTER") && m92.includes("findNextClass"));
check("terminal commands implemented in-browser only",
  m92.includes('"caesar"') && m92.includes('"scan"') && m92.includes("SCAN_PORTS") && m92.includes("caesarShift"));
check("gauges mirror the legacy mounts by reading the DOM",
  m92.includes("heroDashXpBar") && m92.includes("heroDashDailyBar") && m92.includes("strokeDashoffset"));
check("search trigger forwards to the palette button", m92.includes("searchOpenBtn.click()"));
check("wiring is gated on real mounts (stub-safe) ", m92.includes("hasAnyMount"));
check("publishes window.PlatformCommandDeck", m92.includes("window.PlatformCommandDeck"));
check("re-renders on language switch", m92.includes("L10N.onSwitch(refreshAll)"));

/* ---------- static: i18n (AR + EN) ---------- */
console.log("\n— i18n (AR + EN) —");
const dictStart = js.indexOf("const DICT");
const arStart = js.indexOf("ar: {", dictStart);
const enStart = js.indexOf("en: {", arStart);
const arDict = js.slice(arStart, enStart);
const enDict = js.slice(enStart);
const NEW_KEYS = [
  "hero.radarBadge", "hero.searchCta",
  "deck.tabRadar", "deck.tabTerminal", "deck.tabConsole",
  "deck.radarKicker", "deck.radarNext", "deck.radarEmpty", "deck.live", "deck.today",
  "deck.termHint", "deck.termWelcome", "deck.termHelp", "deck.termScanTitle",
  "deck.termScanDone", "deck.termUsage", "deck.termUnknown", "deck.termLab",
  "bento.semKicker", "bento.semTitle", "bento.semCta",
  "bento.socKicker", "bento.socTitle",
  "bento.arsenalKicker", "bento.arsenalTitle", "bento.arsenalCta",
];
function hasKey(src, k) { return src.indexOf('"' + k + '":') > -1; }
check("every v3 hero key exists in Arabic", NEW_KEYS.every((k) => hasKey(arDict, k)));
check("every v3 hero key exists in English", NEW_KEYS.every((k) => hasKey(enDict, k)));

/* ---------- runtime harness: MODULE 92 in a vm ---------- */
console.log("\n— runtime: stubbed browser —");

function makeEl(id) {
  const attrs = {};
  const listeners = {};
  const classes = new Set();
  const el = {
    id, textContent: "", hidden: false, focused: false,
    style: {}, attrs, listeners,
    scrollTop: 0, scrollHeight: 0,
    children: [],
    clicks: 0,
    classNameSet: classes,
    get firstChild() { return this.children[0] || null; },
    get childNodes() { return this.children; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i > -1) this.children.splice(i, 1);
      return c;
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    dispatch(t, ev) { (listeners[t] || []).forEach((fn) => fn(ev || {})); },
    focus() { el.focused = true; },
    click() { el.clicks++; },
  };
  el.classList = {
    add(...c) { c.forEach((x) => classes.add(x)); },
    remove(...c) { c.forEach((x) => classes.delete(x)); },
    contains: (c) => classes.has(c),
  };
  let clsName = "";
  Object.defineProperty(el, "className", {
    get() { return clsName; },
    set(v) {
      clsName = String(v);
      classes.clear();
      clsName.split(/\s+/).forEach((c) => { if (c) classes.add(c); });
    },
    enumerable: true,
  });
  return el;
}

function makeToolCard(name) {
  const card = makeEl("tool-" + name);
  card.className = "tool-card reveal";
  const title = makeEl("title");
  title.textContent = name;
  card.querySelector = (sel) => (sel === ".tool-title" ? title : null);
  return card;
}

function boot(opts) {
  opts = opts || {};
  const byId = {};
  [
    "heroDash", "heroRadarList", "heroRadarNext", "heroRadarEmpty",
    "heroTermLog", "heroTermForm", "heroTermInput",
    "bentoSemList", "arsenalStrip",
    "heroGaugeLevelArc", "heroGaugeLevelValue", "heroGaugeXpArc", "heroGaugeXpValue", "heroGaugeDoneArc",
    "heroSearchTrigger", "searchOpenBtn",
    "heroDashLevel", "heroDashXp", "heroDashXpBar", "heroDashDailyBar", "heroDashBar", "heroDashPct",
  ].forEach((id) => { byId[id] = makeEl(id); });
  byId.heroDash.className = "hero-dash hero-command cmd-deck";
  byId.heroDashLevel.textContent = "3";
  byId.heroDashXp.textContent = "120 XP";
  byId.heroDashXpBar.style.width = "40%";
  byId.heroDashDailyBar.style.width = "25%";
  byId.heroDashBar.style.width = "55%";
  byId.heroDashPct.textContent = "55";

  const tools = [makeToolCard("Hash Toolkit"), makeToolCard("JWT Studio"), makeToolCard("Caesar Lab")];
  const others = [makeEl("not-a-tool")];

  const docListeners = {};
  const documentStub = {
    getElementById(id) { return byId[id] || null; },
    querySelectorAll(sel) {
      if (sel === "[id^='tool-']") return tools.concat(others);
      return [];
    },
    createElement(tag) { return makeEl(tag); },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
  };

  const switchers = [];
  const LangStub = {
    current: opts.lang || "ar",
    t(key, params) {
      return "\u27e6" + key + "\u27e7" + (params
        ? " " + Object.keys(params).map((k) => String(params[k])).join(" \u00b7 ")
        : "");
    },
    onSwitch(fn) { switchers.push(fn); },
  };

  const now = require(path.join(root, "current-semester.js"));
  const nextSubject = opts.nextSubject !== undefined ? opts.nextSubject : now.subjects[2];

  const timeouts = [];
  const intervals = [];
  const win = {
    PLATFORM_CURRENT_SEMESTER: opts.semester || now,
    PlatformHeroNow: {
      findNextClass() { return nextSubject ? { item: { subject: nextSubject }, status: "upcoming", daysAway: 1 } : null; },
      parseTimeMinutes(v) {
        const m = String(v || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!m) return null;
        let h = +m[1];
        if (m[3] && /pm/i.test(m[3]) && h < 12) h += 12;
        if (m[3] && /am/i.test(m[3]) && h === 12) h = 0;
        return h * 60 + +m[2];
      },
    },
    Lang: LangStub,
  };

  const ctx = {
    window: win,
    document: documentStub,
    Lang: LangStub,
    setTimeout(fn, ms) { timeouts.push(ms); return timeouts.length; },
    setInterval(fn, ms) { intervals.push(ms); return intervals.length; },
    console,
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat,
  };
  vm.createContext(ctx);
  vm.runInContext(m92, ctx, { filename: "command-deck.js" });
  return { byId, win, documentStub, docListeners, switchers, timeouts, intervals, tools, ctx };
}

console.log("\n— MODULE 92: radar —");
{
  const app = boot();
  const api = app.win.PlatformCommandDeck;
  check("API published with its callable surface",
    !!api && ["renderRadar", "renderBento", "renderArsenal", "syncGauges", "run"].every((k) => typeof api[k] === "function"));

  const list = app.byId.heroRadarList;
  check("one radar row per official subject", list.children.length === cs.subjects.length);
  const firstA = list.children[0].children[0];
  check("row is a link to #semester", firstA.getAttribute("href") === "#semester" && firstA.classList.contains("radar-item"));
  const dayText = walkText(firstA.children[0]);
  check("day cell shows the schedule day + start time",
    dayText.includes(cs.subjects[0].meta.schedule.day.ar) && dayText.includes(cs.subjects[0].meta.schedule.startTime));
  const nameText = walkText(firstA.children[1]);
  check("name cell uses the Arabic subject name", nameText === cs.subjects[0].name.ar);
  check("next class is flagged",
    list.children[2].children[0].classList.contains("is-next") &&
    !list.children[0].children[0].classList.contains("is-next"));
  check("radar banner announces the next class", app.byId.heroRadarNext.textContent.includes("deck.radarNext"));
  check("empty-state paragraph stays hidden with data present", app.byId.heroRadarEmpty.hidden === true);

  const empty = boot({ semester: { subjects: [] } });
  check("no subjects → honest empty state shown",
    empty.byId.heroRadarList.children.length === 0 && empty.byId.heroRadarEmpty.hidden === false);
}

console.log("\n— MODULE 92: terminal —");
{
  const app = boot();
  const log = app.byId.heroTermLog;
  const api = app.win.PlatformCommandDeck;
  check("boot banner pushed", log.children.length === 1 && log.children[0].textContent.includes("deck.termWelcome"));

  api.run("help");
  check("help echoes the command + prints the command list",
    log.children[1].textContent === "guest@nova:~$ help" &&
    log.children[1].className === "term-line term-cmd" &&
    log.children[2].textContent.includes("deck.termHelp"));

  api.run("caesar Hello");
  const caesarLine = log.children[log.children.length - 1];
  check("caesar shift 3: Hello → Khoor", caesarLine.textContent.includes("Khoor") && caesarLine.className === "term-line term-ok");
  api.run("caesar abc 1");
  check("caesar honours an explicit shift (abc → bcd)", log.children[log.children.length - 1].textContent.includes("bcd"));

  const before = log.children.length;
  api.run("scan 10.0.0.7");
  check("scan prints the host + 5 ports + a summary",
    log.children.length - before === 8 &&
    log.children[before + 1].textContent.includes("10.0.0.7") &&
    log.children[log.children.length - 1].textContent.includes("deck.termScanDone"));

  api.run("rm -rf /");
  check("unknown command is refused honestly",
    log.children[log.children.length - 1].className === "term-line term-err" &&
    log.children[log.children.length - 1].textContent.includes("deck.termUnknown"));

  let prevented = 0;
  app.byId.heroTermInput.textContent = "";
  app.byId.heroTermInput.value = "help";
  app.byId.heroTermForm.dispatch("submit", { preventDefault() { prevented++; } });
  check("form submit runs the command + clears the input",
    prevented === 1 && app.byId.heroTermInput.value === "");

  api.run("clear");
  check("clear empties the log", log.children.length === 0);
}

console.log("\n— MODULE 92: gauges —");
{
  const app = boot();
  const api = app.win.PlatformCommandDeck;
  api.syncGauges();
  check("level arc mirrors the XP meter (40% → offset 60)", app.byId.heroGaugeLevelArc.style.strokeDashoffset === "60");
  check("xp arc mirrors the daily goal (25% → offset 75)", app.byId.heroGaugeXpArc.style.strokeDashoffset === "75");
  check("done arc mirrors the overall meter (55% → offset 45)", app.byId.heroGaugeDoneArc.style.strokeDashoffset === "45");
  check("gauge values mirror the legacy text mounts",
    app.byId.heroGaugeLevelValue.textContent === "3" && app.byId.heroGaugeXpValue.textContent === "120 XP");

  app.byId.heroDashBar.style.width = "";
  app.byId.heroDashPct.textContent = "70";
  api.syncGauges();
  check("empty bar falls back to the % text mount (70 → offset 30)", app.byId.heroGaugeDoneArc.style.strokeDashoffset === "30");
}

console.log("\n— MODULE 92: bento, arsenal & wiring —");
{
  const app = boot();
  const api = app.win.PlatformCommandDeck;
  check("bento schedule lists every subject",
    app.byId.bentoSemList.children.length === cs.subjects.length &&
    walkText(app.byId.bentoSemList.children[0]).includes(cs.subjects[0].meta.schedule.startTime));
  check("arsenal strip only takes real tool cards",
    app.byId.arsenalStrip.children.length === 3 &&
    walkText(app.byId.arsenalStrip.children[0]).includes("Hash Toolkit") &&
    app.byId.arsenalStrip.children[0].getAttribute("href") === "#tools");

  app.byId.heroSearchTrigger.dispatch("click");
  check("search trigger clicks the palette button", app.byId.searchOpenBtn.clicks === 1);

  check("locale switch hook registered exactly once", app.switchers.length === 1);
  app.switchers[0]();
  check("locale re-render keeps the radar intact", app.byId.heroRadarList.children.length === cs.subjects.length);
  check("progress + view listeners registered",
    (app.docListeners["nova:progress-changed"] || []).length === 1 &&
    (app.docListeners["nova:view-changed"] || []).length === 1);
  check("60s radar refresh interval registered", app.intervals.includes(60000));
  check("deck flagged ready for CSS", app.byId.heroDash.classList.contains("is-ready"));
  check("cold-boot gauge resyncs scheduled", app.timeouts.length >= 4);
}

console.log("\n— MODULE 92: defensive boot —");
check("empty DOM → clean no-op, no locale hook", (() => {
  const switchers = [];
  const ctx = {
    window: { Lang: { current: "ar", t: (k) => k, onSwitch: (fn) => switchers.push(fn) } },
    document: { getElementById() { return null; } },
    setTimeout() {}, setInterval() {}, console, String, Number, parseInt, parseFloat, isNaN, Boolean, Date,
  };
  vm.createContext(ctx);
  vm.runInContext(m92, ctx, { filename: "command-deck.js" });
  return switchers.length === 0;
})());

/** Collect textContent of a stub subtree. */
function walkText(node) {
  if (!node) return "";
  let out = String(node.textContent || "");
  (node.children || []).forEach((c) => { out += walkText(c); });
  return out;
}

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) failed" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);
