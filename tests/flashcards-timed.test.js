"use strict";
/**
 * tests/flashcards-timed.test.js — Timed Flashcard Review (T01–T06)
 *
 * Static contract checks plus live vm runs of data/flashcards.js and
 * the real MODULE 34 source:
 *   - T01: card-bank shape, duplicate-term rejection, empty-definition
 *          rejection, bundling + service-worker precache.
 *   - T04: #flashcards/timed registered through ViewSwitcher, discovery
 *          entries (nav / mobile menu / footer / flash band), MODULE 34
 *          listening on `document` for nova:view-changed, i18n keys.
 *   - T02: per-question countdown, expiry auto-advance, reveal rules.
 *   - T03: result panel (score/%/elapsed), infosec:flash:timed writes,
 *          best-score monotonicity, needs-review subset + priority.
 *   - T05: RTL/keyboard contract — arrow + digit navigation, the SR
 *          live region (term → definition), the focus state machine,
 *          and the narrow-screen overflow guards in MODULE 34 CSS.
 *   - T06: offline contract (zero network APIs + precached shell +
 *          SW navigation fallback), the empty-bank state, MODULE 34
 *          CSS layer integrity (top-level brace balance — the block
 *          must never nest inside another rule), the long-content
 *          overflow guard, and an end-to-end smoke run of a full
 *          scored session inside a network-free sandbox.
 *
 * Run: node tests/flashcards-timed.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const bankSrc = fs.readFileSync(path.join(root, "data", "flashcards.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

let failures = 0;
/** @param {string} name @param {boolean} cond */
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

/* ============================================================
   T01 · card bank — live vm execution of the real data file
   ============================================================ */
console.log("\n— data/flashcards.js: card bank (vm) —");
/** Load the bank file in an isolated context. @param {string} src @returns {object} the sandbox `window` */
function loadBank(src) {
  const sandbox = { console: console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: "flashcards.js" });
  return sandbox.window;
}

const win = loadBank(bankSrc);
check("exposes window.FLASHCARDS (keyed authoring catalog)",
  !!win.FLASHCARDS && typeof win.FLASHCARDS === "object");
check("exposes window.FLASHCARDS_TERMS (flat terms list)",
  Array.isArray(win.FLASHCARDS_TERMS));
check("bank is substantial (>= 25 term/definition pairs)",
  win.FLASHCARDS_TERMS.length >= 25);
check("every entry has a non-empty, trimmed term + definition",
  win.FLASHCARDS_TERMS.every((t) => t &&
    typeof t.term === "string" && t.term.length > 0 && t.term === t.term.trim() &&
    typeof t.definition === "string" && t.definition.length > 0 && t.definition === t.definition.trim()));
check("terms are unique (no duplicate leaked through load)",
  new Set(win.FLASHCARDS_TERMS.map((t) => t.term)).size === win.FLASHCARDS_TERMS.length);
check("entries carry id/topic/category for the review engine",
  win.FLASHCARDS_TERMS.every((t) => t.id && t.topic && t.category));

/* Rejection at load: run the SAME validator against a catalog that
   contains a duplicate term and a whitespace-only definition. */
const win2 = loadBank(bankSrc + [
  'window.FLASHCARDS["__dupTest"] = { "name": "اختبار", "cards": [',
  '  { "id": "dup-001", "term": "AES", "topic": "اختبار", "definition": "نسخة مكررة" },',
  '  { "id": "dup-002", "term": "BGP", "topic": "اختبار", "definition": "   " }',
  "] };",
  "window.FLASHCARDS_TERMS = window.FLASHCARDS_BUILD_TERMS(window.FLASHCARDS);"
].join("\n"));
check("duplicate term rejected at load (AES still appears exactly once)",
  Array.isArray(win2.FLASHCARDS_TERMS) &&
  win2.FLASHCARDS_TERMS.filter((t) => t.term === "AES").length === 1);
check("empty / whitespace-only definition rejected at load (BGP absent)",
  Array.isArray(win2.FLASHCARDS_TERMS) &&
  !win2.FLASHCARDS_TERMS.some((t) => t.term === "BGP"));

/* ============================================================
   T01 · bundling + offline precache
   ============================================================ */
console.log("\n— bundling + service worker —");
check("index.html loads the card bank before script.js (defer order)",
  html.indexOf("data/flashcards.js") > -1 &&
  html.indexOf("data/flashcards.js") < html.indexOf('script.js" defer'));
check("sw.js precaches the card bank (offline, zero network)",
  sw.includes('"./data/flashcards.js"'));
check("version triple in lockstep (package ↔ sw ↔ css?v)",
  sw.includes('CACHE_VERSION = "v' + pkg.version + '"') &&
  html.includes("style.css?v=" + pkg.version));

/* ============================================================
   T04 · route registration through ViewSwitcher
   ============================================================ */
console.log("\n— script.js: ViewSwitcher registration —");
check("view element registered: $id(\"flashcards/timed\")",
  js.includes('$id("flashcards/timed")'));
check("spec route resolves directly through VIEW_IDS (no alias indirection)",
  !js.includes('"flashcards/timed": "'));
check("MODULE 34 listens on document (event dispatches there, non-bubbling)",
  /document\.addEventListener\("nova:view-changed"/.test(js) &&
  !/window\.addEventListener\("nova:view-changed"/.test(js));
check("MODULE 34 keys off the resolved view id",
  js.includes("event.detail.viewId === VIEW_ID"));
check("boot re-check covers a direct load of the route",
  js.includes('location.hash === "#" + VIEW_ID'));
check("section is a hub view: .section class + is-active contract",
  html.includes('class="section flashcards-timed" id="flashcards/timed"'));

/* ============================================================
   T04 · discovery — section, nav, mobile menu, footer, flash band
   ============================================================ */
console.log("\n— index.html: discovery —");
check("section labelled by its heading (aria-labelledby ↔ title id)",
  html.includes('aria-labelledby="flashcardsTimedTitle"') &&
  html.includes('id="flashcardsTimedTitle"'));
check("mount + empty-state nodes present",
  html.includes('id="flashcards-timed-mount"') &&
  html.includes('id="flashcards-timed-empty"'));
check("route linked from >= 2 surfaces (flash band CTA + footer sitemap)",
  (html.match(/href="#flashcards\/timed"/g) || []).length >= 2);
check("every link carries the bilingual i18n key",
  (html.match(/data-i18n="nav\.flashcardsTimed"/g) || []).length ===
  (html.match(/href="#flashcards\/timed"/g) || []).length);

/* ============================================================
   i18n · nav.flashcardsTimed exists in BOTH dictionaries
   ============================================================ */
console.log("\n— i18n dictionaries —");
const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
check("ar dict has \"nav.flashcardsTimed\"", arSrc.includes('"nav.flashcardsTimed"'));
check("en dict has \"nav.flashcardsTimed\"", enSrc.includes('"nav.flashcardsTimed"'));

/* ============================================================
   T02 · review engine — source contract
   ============================================================ */
console.log("\n— T02 · review engine (source) —");
const modStart = js.indexOf("/* @@FLASH_TIMED_START@@ */");
const modEnd = js.indexOf("/* @@FLASH_TIMED_END@@ */");
check("MODULE 34 slicing markers present", modStart >= 0 && modEnd > modStart);
const modSrc = modStart >= 0 ? js.slice(modStart, modEnd + "/* @@FLASH_TIMED_END@@ */".length) : "";

check("per-question base is ~10s", /BASE_SECONDS\s*=\s*10\b/.test(modSrc));
check("countdown ticks via setInterval + hold auto-advance via setTimeout",
  modSrc.includes("setInterval(onTick, TICK_MS)") &&
  modSrc.includes("holdId = setTimeout(() => { holdId = null; advance(); }, REVEAL_HOLD_MS)"));
check("reveal rules: correct/don't-know clear autoNext, only timeUp sets it",
  modSrc.includes('state.outcome = "timeout"') && modSrc.includes("state.autoNext = true"));
check("engine exposed through the FlashTimed seam", modSrc.includes("window.FlashTimed = {"));
check("single delegated listener on the mount", modSrc.includes('closest("[data-ft],[data-ft-choice]")'));
check("route contract intact (document listener + boot hash)",
  js.includes('document.addEventListener("nova:view-changed"') &&
  js.includes('event.detail.viewId === VIEW_ID') &&
  js.includes('location.hash === "#" + VIEW_ID'));

/* Every Lang.t key the engine renders must exist in BOTH dicts.
   (The ternary feedback keys are literals, so register them too.) */
console.log("\n— T02 · engine i18n keys —");
const usedKeys = new Set();
let km;
const engineKeyRe = /Lang\.t\(\s*"([^"]+)"/g;
while ((km = engineKeyRe.exec(modSrc))) usedKeys.add(km[1]);
["flash.correct", "flash.wrong", "flash.timeUp"].forEach((k) => usedKeys.add(k));
check("engine renders every string through Lang.t (>= 12 keys)", usedKeys.size >= 12);
const missKeys = [...usedKeys].filter((k) => !arSrc.includes('"' + k + '"') || !enSrc.includes('"' + k + '"'));
check("all engine keys present in ar + en dicts" + (missKeys.length ? " — missing: " + missKeys.join(", ") : ""), missKeys.length === 0);

/* ============================================================
   T03 · result + persistence — source contract
   ============================================================ */
console.log("\n— T03 · result + persistence (source) —");
check("isolated localStorage namespace", modSrc.includes('STORE_KEY = "infosec:flash:timed"'));
check("store read/write is exception-guarded (private mode safe)",
  /function readStore\(\)[\s\S]{0,60}try/.test(modSrc) && /function writeStore\([\s\S]{0,300}try/.test(modSrc));
check("best score updates only when strictly better", modSrc.includes("state.pct > prevBest"));
check("first run stores the baseline best", modSrc.includes("prevBest === null"));
check("session result records correct/total + pct + elapsed ms",
  modSrc.includes("correct: state.score") &&
  modSrc.includes("ms: Math.max(0, state.finishedAt - state.startedAt)"));
check("needs-review subset written every run", modSrc.includes("review: nextReview"));
check("review subset prioritized at session start",
  modSrc.includes("shuffle(hot).concat(shuffle(rest))"));
check("module never writes the quiz/portal keys",
  !modSrc.includes('setItem("timed"') && !modSrc.includes("motmi-portal"));

/* ============================================================
   T02 · engine behaviour — REAL module source + REAL card bank
   run in a vm with a fake clock and captured timers, so the
   timing mechanic itself is proven end-to-end.
   ============================================================ */
console.log("\n— T02 · engine behaviour (vm, fake clock) —");
const vmMod = require("vm");
const engineBankSrc = fs.readFileSync(path.join(root, "data", "flashcards.js"), "utf8");

/** Minimal localStorage double — seed/inspect through `_data`. @returns {object} */
function makeLS() {
  const data = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _data: data
  };
}

/**
 * Minimal element double for paint()/announce() — the three nodes
 * MODULE 34 touches. `hidden` starts true (index.html ships the
 * empty-state node hidden), so a flip to false proves paint() ran
 * with an empty bank.
 * @returns {object} id → element double
 */
function makeDomStubs() {
  const make = () => ({
    hidden: true,
    innerHTML: "",
    textContent: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    contains() { return false; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    focus() {}
  });
  return {
    "flashcards-timed-mount": make(),
    "flashcards-timed-empty": make(),
    ftLive: make()
  };
}

/**
 * Boot the real MODULE 34 source in a vm.
 * @param {object|null} sharedLs Shared localStorage double (T03 cross-run).
 * @param {object} [opts] `extraSrc` — source injected after the bank;
 *   `hash` — boot route (the module paints when it matches VIEW_ID);
 *   `dom` — expose element doubles for the three MODULE 34 nodes.
 * @returns {object} harness (api · terms · sandbox · els · clock helpers)
 */
function makeEngine(sharedLs, opts) {
  opts = opts || {};
  let now = 1700000000000;
  const intervals = [];
  const timeouts = [];
  const els = opts.dom ? makeDomStubs() : null;
  const node = (id) => (els && els[id]) || null;
  const sb = {
    console,
    localStorage: sharedLs || makeLS(),
    Date: { now: () => now },
    setInterval: (fn, ms) => { intervals.push({ fn, ms, cleared: false }); return intervals.length; },
    clearInterval: (id) => { if (intervals[id - 1]) intervals[id - 1].cleared = true; },
    setTimeout: (fn, ms) => { timeouts.push({ fn, ms, cleared: false, run: false }); return timeouts.length; },
    clearTimeout: (id) => { if (timeouts[id - 1]) timeouts[id - 1].cleared = true; },
    document: { addEventListener() {}, getElementById: node, activeElement: null },
    location: { hash: opts.hash || "" },
    $id: node,
    esc: (s) => String(s),
    Lang: {
      t: (k, p) => {
        let s = "[" + k + "]";
        if (p) Object.keys(p).forEach((x) => { s = s.split("{" + x + "}").join(String(p[x])); });
        return s;
      },
      onSwitch() {}
    }
  };
  sb.window = sb;
  vmMod.createContext(sb);
  vmMod.runInContext(engineBankSrc, sb, { filename: "flashcards.js" });
  if (opts.extraSrc) vmMod.runInContext(opts.extraSrc, sb, { filename: "extra.js" });
  vmMod.runInContext(modSrc, sb, { filename: "module34.js" });
  return {
    api: sb.FlashTimed,
    terms: sb.FLASHCARDS_TERMS,
    sandbox: sb,
    els: els,
    advance: (ms) => { now += ms; },
    flushTick: () => { intervals.filter((i) => !i.cleared && i.ms === 250).forEach((i) => i.fn()); },
    pending: () => timeouts.filter((t) => !t.cleared && !t.run),
    fire: (t) => { t.run = true; t.fn(); },
    timeouts
  };
}

/* ---- idle → start screen → first question ---- */
const eng = makeEngine();
const st = eng.api.state;
check("engine boots idle", st.phase === "idle");
const idleHtml = eng.api.viewHtml();
check("start screen shows session count + start button",
  idleHtml.includes('class="flashcards-timed-meta"') && idleHtml.includes("[flash.count]") &&
  idleHtml.includes('data-ft="start"'));
eng.api.start();
check("start → question phase", st.phase === "question");
check("deck covers the whole bank", st.deck.length === eng.terms.length);
let view = eng.api.viewHtml();
check("renders exactly ONE term prompt", (view.match(/class="ft-term"/g) || []).length === 1);
check("four definition choices", (view.match(/data-ft-choice="/g) || []).length === 4);
check("choices are unique", new Set(st.choices).size === st.choices.length);
check("correct choice is the card's own definition",
  st.choices[st.correctIdx] === eng.terms[st.deck[st.idx]].definition);
check("countdown visible at 10s with role=timer",
  view.includes('id="ftTimerNum">10<') && view.includes('role="timer"'));
check('"I don\'t know" offered while running', view.includes('data-ft="dontknow"'));

/* ---- countdown decrements with the clock ---- */
eng.advance(4000); eng.flushTick();
check("countdown follows the clock (10 → 6s)",
  st.remainingMs === 6000 && eng.api.viewHtml().includes('id="ftTimerNum">6<'));

/* ---- EXPIRY: mark wrong + reveal + auto-advance ---- */
const pos0 = st.idx;
eng.advance(6100); eng.flushTick();
check("expiry marks wrong + reveals", st.phase === "revealed" && st.outcome === "timeout" && st.remainingMs === 0);
check("expiry does not score, records the miss", st.score === 0 && st.missed.indexOf(pos0) >= 0);
const hold = eng.pending();
check("expiry schedules the auto-advance hold", hold.length === 1 && hold[0].ms === eng.api.REVEAL_HOLD_MS);
view = eng.api.viewHtml();
check("time-up reveals the definition",
  view.includes("[flash.timeUp]") && view.includes('class="ft-reveal"') &&
  view.includes(eng.terms[st.deck[pos0]].definition));
check("auto-next notice visible", view.includes("[flash.autoNext]"));
eng.fire(hold[0]);
check("hold expiry auto-advanced to the next card", st.idx === pos0 + 1 && st.phase === "question");
check("fresh countdown for the next question", st.remainingMs === 10000);

/* ---- CORRECT: reveal but NEVER auto-advance ---- */
const tBefore = eng.timeouts.length;
const pos1 = st.idx;
const ok = eng.api.answer(st.correctIdx);
check("correct pick returns true + scores", ok === true && st.score === 1);
check("correct reveals in place (no advance)", st.phase === "revealed" && st.idx === pos1);
check("correct schedules NO auto-advance", eng.timeouts.length === tBefore && st.autoNext === false);
view = eng.api.viewHtml();
check("correct feedback + choice highlighted + definition revealed",
  view.includes("[flash.correct]") && view.includes('class="ft-choice is-correct"') &&
  view.includes(eng.terms[st.deck[pos1]].definition));
check("Next button offered after reveal", view.includes('data-ft="next"'));
eng.api.advance();
check("manual Next advances", st.idx === pos1 + 1 && st.phase === "question");

/* ---- "I DON'T KNOW": reveal + wrong, student-paced ---- */
const tBefore2 = eng.timeouts.length;
const scoreBefore = st.score;
const pos2 = st.idx;
eng.api.dontKnow();
check('"I don\'t know" counts as wrong (no score)', st.score === scoreBefore && st.outcome === "wrong");
check('"I don\'t know" records the miss', st.missed.indexOf(pos2) >= 0);
check('"I don\'t know" does NOT auto-advance',
  st.phase === "revealed" && st.idx === pos2 && eng.timeouts.length === tBefore2);
check('"I don\'t know" reveals the definition', eng.api.viewHtml().includes('class="ft-reveal"'));
check("wrong feedback shown", eng.api.viewHtml().includes("[flash.wrong]"));

/* ---- deck exhausted → result panel + persistence (T03) ---- */
st.idx = st.deck.length - 1;
eng.api.advance();
check("deck exhausted → done phase with score line",
  st.phase === "done" && eng.api.viewHtml().includes("[flash.score]"));
check("only correct answers ever score", st.score === 1 && st.missed.length >= 2);

/* ============================================================
   T03 · result panel + persistence — REAL module, SHARED store
   four sequential runs drive one localStorage double, so the
   best score, the session log and the needs-review subset are
   all proven across runs (and the seeded quiz/portal keys must
   survive every one of them untouched).
   ============================================================ */
console.log("\n— T03 · result + persistence (vm, shared store) —");

/** Play a whole run to `done`: answer every card one way, then advance. */
function playRun(eng, mode) {
  const s = eng.api.state;
  let guard = 0;
  while (s.phase !== "done" && guard++ < 2000) {
    if (s.phase === "question") {
      if (mode === "correct") eng.api.answer(s.correctIdx);
      else eng.api.dontKnow();
    } else if (s.phase === "revealed") {
      eng.api.advance();
    }
  }
  return s;
}

const lsT03 = makeLS();
lsT03.setItem("timed", JSON.stringify({ quiz: "legacy-timed" }));
lsT03.setItem("motmi-portal:timed", JSON.stringify({ best: 70 }));
lsT03.setItem("motmi-portal:counters", JSON.stringify({ flashes: 3 }));
const seedKeys = Object.keys(lsT03._data).sort().join("|");

/* ---- run 1: one correct, everything else missed ---- */
const eng1 = makeEngine(lsT03);
const st1 = eng1.api.state;
check("seam exposes the isolated namespace + duration formatter",
  eng1.api.STORE_KEY === "infosec:flash:timed" && eng1.api.fmtDur(125000) === "2:05");
eng1.api.start();
const total1 = st1.deck.length;
eng1.api.answer(st1.correctIdx);      /* card 1 — correct */
eng1.api.advance();
eng1.advance(125000);                 /* session clock: +2m05s */
const wrongCount = total1 - 1;
for (let i = 0; i < wrongCount; i++) { /* everything else — missed */
  eng1.api.dontKnow();
  eng1.api.advance();
}
check("run reaches done with correct/total", st1.phase === "done" && st1.score === 1);
check("percentage computed from correct/total",
  st1.pct === Math.round((1 / total1) * 100));
check("elapsed time frozen from the session clock",
  st1.finishedAt - st1.startedAt === 125000);
const view1 = eng1.api.viewHtml();
check("result panel renders score, %, elapsed and best lines",
  view1.includes("[flash.score]") && view1.includes("[flash.pct]") &&
  view1.includes("[flash.elapsed]") && view1.includes("[flash.best]"));
check("review panel lists every missed card with its definition",
  (view1.match(/class="ft-review-item"/g) || []).length === wrongCount &&
  view1.includes(eng1.terms[st1.deck[st1.deck.length - 1]].term) &&
  view1.includes(eng1.terms[st1.deck[st1.deck.length - 1]].definition));
check("review panel explains next-run priority", view1.includes("[flash.reviewHint]"));
check("first run shows NO new-best badge", !view1.includes("[flash.newBest]"));
const store1 = JSON.parse(lsT03.getItem("infosec:flash:timed"));
check("session written to infosec:flash:timed (correct/total/pct/ms)",
  store1 && store1.last && store1.last.correct === 1 && store1.last.total === total1 &&
  store1.last.pct === st1.pct && store1.last.ms === 125000);
check("first run stores the baseline best", store1.best === st1.pct);
check("session log started (history array)", Array.isArray(store1.history) && store1.history.length === 1);
check("needs-review subset = the missed terms",
  Array.isArray(store1.review) && store1.review.length === wrongCount);
check("only the flash key was written (quiz + portal keys intact)",
  Object.keys(lsT03._data).sort().join("|") === "infosec:flash:timed|" + seedKeys);

/* ---- run 2: PERFECT — beats the baseline, clears the subset ---- */
const eng2 = makeEngine(lsT03);
const st2 = eng2.api.state;
eng2.api.start();
const hotTerms = st2.deck.slice(0, store1.review.length)
  .map((p) => eng2.terms[p].term);
check("needs-review subset occupies the FRONT of the next deck",
  hotTerms.length === store1.review.length &&
  hotTerms.slice().sort().join("||") === store1.review.slice().sort().join("||"));
playRun(eng2, "correct");
const store2 = JSON.parse(lsT03.getItem("infosec:flash:timed"));
check("better run updates the best", store2.best === 100 && st2.pct === 100);
check("review subset shrinks when old misses are answered correctly",
  store2.review.length === 0);
check("session log grows", store2.history.length === 2);
const view2 = eng2.api.viewHtml();
check("new-best badge shown when strictly better", view2.includes("[flash.newBest]"));
check("empty-state review panel on a clean run", view2.includes("[flash.reviewEmpty]"));

/* ---- run 3: total miss — the best must NOT drop ---- */
const eng3 = makeEngine(lsT03);
const st3 = eng3.api.state;
eng3.api.start();
playRun(eng3, "wrong");
const store3 = JSON.parse(lsT03.getItem("infosec:flash:timed"));
check("worse run leaves the best untouched", store3.best === 100 && st3.pct === 0);
check("no new-best badge on a worse run", !eng3.api.viewHtml().includes("[flash.newBest]"));
check("missed cards return to the needs-review subset",
  store3.review.length === st3.deck.length);
check("latest session still recorded", store3.last.pct === 0 && store3.history.length === 3);

/* ---- run 4: a TIE is not «better» ---- */
const eng4 = makeEngine(lsT03);
const st4 = eng4.api.state;
eng4.api.start();
playRun(eng4, "correct");
const store4 = JSON.parse(lsT03.getItem("infosec:flash:timed"));
check("tie keeps the best and shows no new-best badge",
  store4.best === 100 && !eng4.api.viewHtml().includes("[flash.newBest]"));
check("perfect run still clears the subset + logs the session",
  store4.review.length === 0 && store4.history.length === 4 && st4.pct === 100);

check("quiz `timed` + motmi-portal:* counters byte-identical after every run",
  lsT03.getItem("timed") === JSON.stringify({ quiz: "legacy-timed" }) &&
  lsT03.getItem("motmi-portal:timed") === JSON.stringify({ best: 70 }) &&
  lsT03.getItem("motmi-portal:counters") === JSON.stringify({ flashes: 3 }));

/* ============================================================
   T05 · RTL + keyboard + accessibility — source contract
   ============================================================ */
console.log("\n— T05 · RTL + keyboard + a11y (source) —");
check("delegated keydown listener on the mount (survives repaint)",
  modSrc.includes('$mount.addEventListener("keydown"'));
check("arrow navigation covers all four keys and flips with direction",
  modSrc.includes('"ArrowDown"') && modSrc.includes('"ArrowUp"') &&
  modSrc.includes('"ArrowLeft"') && modSrc.includes('"ArrowRight"') &&
  /return rtl \? -1 : 1;/.test(modSrc) && /return rtl \? 1 : -1;/.test(modSrc));
check("digit hotkeys 1..4 answer directly (spec: arrows, Enter, 1-4)",
  modSrc.includes("hotIdx(event.key)") && modSrc.includes('"123456789".indexOf(key)'));
check("choices are native <button>s — Enter/Space activate them for free",
  modSrc.includes('<button type="button" class="\' + cls + \'" data-ft-choice'));
check("persistent SR live region (index.html node + module writer)",
  html.includes('class="sr-only" id="ftLive"') && html.includes('aria-live="polite"') &&
  modSrc.includes('$id("ftLive")') && modSrc.includes("$live.textContent"));
check("announces the term on question, the definition only after reveal",
  modSrc.includes('Lang.t("flash.srTerm"') && modSrc.includes('Lang.t("flash.srReveal"') &&
  /state\.phase === "revealed" && card/.test(modSrc));
check("flash.srTerm + flash.srReveal present in ar + en dicts",
  arSrc.includes('"flash.srTerm"') && enSrc.includes('"flash.srTerm"') &&
  arSrc.includes('"flash.srReveal"') && enSrc.includes('"flash.srReveal"'));
check("focus state machine: term → next → result (preventScroll)",
  modSrc.includes('"#ftTerm"') && modSrc.includes('[data-ft="next"]') &&
  modSrc.includes('".ft-done h3"') && modSrc.includes("focus({ preventScroll: true })"));
check("focus moves only when the student was inside the mount",
  modSrc.includes("$mount.contains(document.activeElement)") && modSrc.includes("hadFocusIn"));
check("result heading focusable (tabindex -1)", modSrc.includes('<h3 tabindex="-1">'));

/* ---- CSS layer: explicit RTL, overflow guards, focus rings ---- */
const ftCssStart = css.indexOf("MODULE 34 · Timed flashcard review");
const ftCssEnd = css.indexOf("/* END MODULE 34 */");
const ftCss = ftCssStart >= 0 && ftCssEnd > ftCssStart ? css.slice(ftCssStart, ftCssEnd) : "";
check("MODULE 34 CSS layer found", ftCss.length > 0);
check("card + options state RTL explicitly",
  ftCss.includes("direction: rtl;") && ftCss.includes(".ft-choices"));
check("term stays isolated LTR inside the RTL flow",
  ftCss.includes("direction: ltr") && ftCss.includes("unicode-bidi: isolate"));
check("narrow-screen overflow guards (min-width + overflow-wrap)",
  ftCss.includes("min-width: 0") && (ftCss.match(/overflow-wrap: anywhere/g) || []).length >= 3);
check("focus rings on the managed targets (:focus-visible)",
  ftCss.includes(".ft-term:focus-visible") && ftCss.includes(".ft-done h3:focus-visible"));
check("logical text alignment keeps the flow RTL-safe",
  ftCss.includes("text-align: start"));

/* ============================================================
   T05 · keyboard helpers — pure functions through the seam
   ============================================================ */
console.log("\n— T05 · keyboard helpers (vm) —");
const engK = makeEngine();
const kn = engK.api.keyNav;
check("keyNav exposed on the seam (arrowStep/cycleIdx/hotIdx)",
  !!kn && typeof kn.arrowStep === "function" &&
  typeof kn.cycleIdx === "function" && typeof kn.hotIdx === "function");
check("vertical arrows are direction-neutral",
  kn.arrowStep("ArrowDown", true) === 1 && kn.arrowStep("ArrowDown", false) === 1 &&
  kn.arrowStep("ArrowUp", true) === -1 && kn.arrowStep("ArrowUp", false) === -1);
check("horizontal arrows follow the reading direction (RTL flips)",
  kn.arrowStep("ArrowLeft", true) === 1 && kn.arrowStep("ArrowLeft", false) === -1 &&
  kn.arrowStep("ArrowRight", true) === -1 && kn.arrowStep("ArrowRight", false) === 1);
check("non-arrow keys produce no step (Enter/Space stay native)",
  kn.arrowStep("Enter", true) === 0 && kn.arrowStep(" ", false) === 0 &&
  kn.arrowStep(undefined, true) === 0);
check("arrow navigation cycles with wrap-around",
  kn.cycleIdx(0, -1, 4) === 3 && kn.cycleIdx(3, 1, 4) === 0 &&
  kn.cycleIdx(1, 1, 4) === 2 && kn.cycleIdx(2, -1, 4) === 1);
check("empty option list yields no target", kn.cycleIdx(0, 1, 0) === -1);
check("digit hotkeys 1-4 map to choices, everything else rejected",
  kn.hotIdx("1") === 0 && kn.hotIdx("4") === 3 &&
  kn.hotIdx("5") === -1 && kn.hotIdx("0") === -1 &&
  kn.hotIdx("Enter") === -1 && kn.hotIdx("") === -1 && kn.hotIdx(null) === -1);
check("seam additions did not disturb the engine (start → question)",
  (engK.api.start(), engK.api.state.phase === "question"));

/* ============================================================
   T06 · offline + edge cases + end-to-end smoke
   ============================================================ */
console.log("\n— T06 · offline contract (source) —");
const netRe = /\bfetch\s*\(|XMLHttpRequest|EventSource|sendBeacon|new WebSocket/;
check("MODULE 34 makes zero network calls (offline-first)", !netRe.test(modSrc));
check("card bank file itself never touches the network", !netRe.test(bankSrc));
check("precache covers the whole offline shell (html/css/js + bank)",
  ["./index.html", "./style.css", "./script.js", "./data/flashcards.js"]
    .every((a) => sw.includes('"' + a + '"')));
check("offline navigation falls back to the cached app shell",
  sw.includes('return (await cache.match("./index.html")) || Response.error();'));
check("online-only: the page no longer registers a service worker",
  !html.includes("serviceWorker.register"));
check("online-only: old registrations are unregistered on load",
  html.includes("getRegistrations") && html.includes(".unregister()"));
check("online-only: Cache Storage is wiped automatically",
  html.includes("caches.keys") && html.includes("caches.delete"));

/* ---- CSS layer integrity: the MODULE 34 block must be TOP-LEVEL.
   Regression: it was once spliced INSIDE the .timer-clock rule,
   which silently nested every .ft-* selector under .timer-clock —
   present in the source, dead in the browser. Brace balance over
   comment-stripped CSS catches the whole class of mistakes. */
console.log("\n— T06 · CSS layer integrity (brace balance) —");
const stripCssComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
const braceBal = (s) => {
  const bare = stripCssComments(s);
  return (bare.match(/\{/g) || []).length - (bare.match(/\}/g) || []).length;
};
const cssPre = css.slice(0, css.lastIndexOf("/*", ftCssStart));
check("MODULE 34 CSS block sits at top level (all prior rules closed)",
  ftCssStart > -1 && braceBal(cssPre) === 0);
check("MODULE 34 CSS block is itself balanced", braceBal(ftCss) === 0);
check("style.css is balanced end-to-end", braceBal(css) === 0);
check(".timer-clock (MODULE 70) closes before the block, keeps its own background",
  /\.timer-clock\s*\{[^}]*background: var\(--surface-2\)/.test(stripCssComments(css)));
check("long-content guard: mount caps width + inherits overflow-wrap",
  ftCss.includes(".flashcards-timed-mount { max-width: 100%; overflow-wrap: anywhere; }"));
check("every long-text surface breaks long tokens (>= 4 overflow-wrap guards)",
  (ftCss.match(/overflow-wrap: anywhere/g) || []).length >= 4);

/* ---- Empty bank: the shipped bank is never empty, but an author
   can empty it — paint() must reveal the bilingual empty-state node
   and the engine must refuse to start a ghost session. */
console.log("\n— T06 · empty bank (vm) —");
check("empty-state node ships hidden + bilingual key",
  /id="flashcards-timed-empty"[^>]*hidden/.test(html) &&
  html.includes('data-i18n="flash.empty"'));
check("flash.empty present in ar + en dicts",
  arSrc.includes('"flash.empty"') && enSrc.includes('"flash.empty"'));
const engZ = makeEngine(null, {
  hash: "#flashcards/timed",
  dom: true,
  extraSrc: "window.FLASHCARDS_TERMS = [];"
});
check("empty bank: boot paint reveals the empty-state message",
  engZ.els["flashcards-timed-empty"].hidden === false);
check("empty bank: mount stays blank (no start button, no ghost session)",
  engZ.els["flashcards-timed-mount"].innerHTML === "" && engZ.api.viewHtml() === "");
engZ.api.start();
check("empty bank: Start refuses to build a deck (stays idle, message stays)",
  engZ.api.state.phase === "idle" &&
  engZ.els["flashcards-timed-empty"].hidden === false);

/* ---- End-to-end smoke: a complete scored run, fully offline.
   The sandbox exposes NO network APIs at all (no fetch / XHR /
   EventSource), so reaching the result panel here proves the whole
   feature runs on the precache alone, per spec user story 9. */
console.log("\n— T06 · end-to-end scored run (vm, offline sandbox) —");
const engT = makeEngine(null, { hash: "#flashcards/timed", dom: true });
check("offline sandbox: no network APIs exist in the runtime",
  typeof engT.sandbox.fetch === "undefined" &&
  typeof engT.sandbox.XMLHttpRequest === "undefined" &&
  typeof engT.sandbox.EventSource === "undefined");
check("smoke boots to the start screen (route paint ran)",
  engT.els["flashcards-timed-empty"].hidden === true &&
  engT.els["flashcards-timed-mount"].innerHTML.includes('data-ft="start"'));
engT.api.start();
const stT = engT.api.state;
let guardT = 0;
while (stT.phase !== "done" && guardT++ < 1000) {
  if (stT.phase === "question") engT.api.answer(stT.correctIdx);
  else if (stT.phase === "revealed") engT.api.advance();
}
const totalT = engT.terms.length;
check("complete run reaches the result panel",
  stT.phase === "done" && guardT > 0 && guardT <= totalT * 2 + 2);
check("perfect run scores every card", stT.score === totalT && stT.deck.length === totalT);
check("score math: 100% at correct === total", stT.pct === 100);
const doneHtmlT = engT.els["flashcards-timed-mount"].innerHTML;
check("result panel painted (score + % + clean review)",
  doneHtmlT.includes('class="ft-done"') && doneHtmlT.includes("[flash.pct]") &&
  doneHtmlT.includes("[flash.reviewEmpty]"));
check("SR live region carries the final score",
  engT.els.ftLive.textContent === "[flash.score]");
const storeT = JSON.parse(engT.sandbox.localStorage.getItem("infosec:flash:timed"));
check("persistence: best/last/history/review written by the run",
  !!storeT && storeT.best === 100 && !!storeT.last &&
  storeT.last.correct === totalT && storeT.last.total === totalT &&
  storeT.last.pct === stT.pct &&
  Array.isArray(storeT.history) && storeT.history.length === 1 &&
  Array.isArray(storeT.review) && storeT.review.length === 0);
check("elapsed time recorded (non-negative ms)",
  typeof storeT.last.ms === "number" && storeT.last.ms >= 0);

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);
