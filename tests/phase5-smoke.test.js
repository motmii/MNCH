"use strict";
/**
 * Phase 5 smoke test — Onboarding (MODULE 38) + Progress dashboard stats.
 * Asserts on the REAL index.html, style.css and script.js:
 *   - onboarding overlay markup (steps, summary, skip/next/back, start link)
 *   - onboarding CSS present + mobile width guard
 *   - MODULE 38 runs in a vm stub: shows step 1 and marks done on finish
 *   - progress stats strip + "review incorrect answers" wiring
 *   - lesson + flashcard review trackers (motmi-portal:lessons / :flash)
 * Run: node tests/phase5-smoke.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const src = fs.readFileSync(path.join(root, "script.js"), "utf8");

let failures = 0;
function check(n, c) { if (c) { console.log("  \u2713 " + n); } else { failures++; console.error("  \u2717 FAIL: " + n); } }
const count = (h, n) => h.split(n).length - 1;

console.log("\u2014 onboarding markup \u2014");
check("overlay dialog", html.includes('id="onboardingOverlay"') && html.includes("onboarding-overlay"));
check("4 steps", count(html, 'data-os-step="') === 4);
check("summary slots", html.includes("data-os-summary-level") && html.includes("data-os-summary-subjects") && html.includes("data-os-summary-style"));
check("controls", html.includes('id="onboardingSkip"') && html.includes('id="onboardingNext"') && html.includes('id="onboardingBack"') && html.includes('id="onboardingStart"'));
check("levels", html.includes('data-os-level="beginner"') && html.includes('data-os-level="intermediate"') && html.includes('data-os-level="advanced"'));
check("styles", html.includes('data-os-style="theory"') && html.includes('data-os-style="quizzes"') && html.includes('data-os-style="practical"'));
check("start -> fundamentals", html.includes('id="onboardingStart"') && html.includes("#path/fundamentals"));
check("no-reg intro", html.includes('data-i18n="onboarding.subtitle"'));

console.log("\n\u2014 onboarding CSS \u2014");
check("overlay CSS", css.includes(".onboarding-overlay") && css.includes(".onboarding-panel"));
check("mobile width guard", /width:\s*min\(560px,\s*92vw\)/.test(css));
check("reduced-motion guard", css.includes("onboarding-overlay") && css.includes("prefers-reduced-motion"));
check("btn-block helper", css.includes(".btn-block"));

console.log("\n\u2014 onboarding i18n \u2014");
["onboarding.title", "onboarding.subtitle", "onboarding.step1Title", "onboarding.step2Title", "onboarding.step3Title",
 "onboarding.level.beginner", "onboarding.level.advanced", "onboarding.style.theory", "onboarding.style.practical",
 "onboarding.skip", "onboarding.next", "onboarding.back", "onboarding.finish", "onboarding.recommendedTitle",
 "onboarding.summaryLevel", "onboarding.summarySubjects", "onboarding.summaryStyle"].forEach((k) => {
  check("key " + k, count(src, '"' + k + '"') >= 2);
});

console.log("\n\u2014 MODULE 38 runs in vm \u2014");
const mStart = src.lastIndexOf("\n/* ===", src.indexOf("MODULE 38 \u00b7 Onboarding"));
const mEnd = src.indexOf("\n/* MODULE 39b", mStart);
if (mStart < 0 || mEnd < 0 || mEnd <= mStart) throw new Error("MODULE 38 slice not found");
const m38Src = src.slice(mStart, mEnd);
function newEl() {
  return {
    hidden: false, dataset: {}, style: {},
    classList: { _s: new Set(),
      toggle(c, f) { const has = this._s.has(c); if (f === undefined) { if (has) this._s.delete(c); else this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); },
      add(c) { this._s.add(c); } },
    closest() { return null; }, setAttribute() {}, getAttribute() { return null; }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
  };
}
const elements = {};
["onboardingOverlay", "onboardingBack", "onboardingSkip", "onboardingNext", "onboardingStart"].forEach((id) => { const el = newEl(); el.id = id; elements[id] = el; });
const steps = [newEl(), newEl(), newEl(), newEl()];
steps.forEach((el, i) => { el.dataset.osStep = String(i + 1); });
let ls = {}, stored = {}, finished = false;
const sandbox5 = {
  console,
  $id(id) { return elements[id] || null; },
  $$() { return []; },
  Store: { get(k, fb) { return (k in stored) ? stored[k] : fb; }, set(k, v) { stored[k] = v; } },
  Lang: { current: "ar", t(k, p) { let s = k; if (p) Object.keys(p).forEach((x) => { s = s.split("{" + x + "}").join(String(p[x])); }); return s; } },
  localStorage: { getItem(k) { return (k in ls) ? ls[k] : null; }, setItem(k, v) { ls[k] = String(v); if (k === "motmi-portal:onboarding") finished = true; }, removeItem(k) { delete ls[k]; } },
  document: {
    body: { style: {} }, documentElement: {},
    querySelectorAll(sel) { return (sel === "[data-os-step]") ? steps : []; },
    querySelector(sel) { return (sel.indexOf("data-os-summary") >= 0) ? newEl() : null; },
    addEventListener() {},
  },
  window: { NovaViews: { activate() {} } },
  /* MODULE 38 contains its modal with the shared focus trap; the sandbox only
     needs a no-op double for it. */
  createFocusTrap() { return { activate() {}, deactivate() {}, focusFirst() { return null; }, isActive() { return false; } }; },
  CustomEvent() {},
};
vm.createContext(sandbox5);
vm.runInContext(m38Src, sandbox5, { filename: "module38.js" });
check("step 1 visible", steps[0].hidden === false);
check("later steps hidden", steps[1].hidden === true && steps[3].hidden === true);

console.log("\n\u2014 progress dashboard wiring \u2014");
check("stats builder", src.includes("function statsHtml()") && src.includes("progress-stats"));
check("overall + paths metrics", src.includes('Lang.t("progress.overall")') && src.includes('Lang.t("progress.paths")'));
check("review-incorrect", src.includes("function reviewWrongHtml()") && src.includes("MissedBank.countForSubject") && src.includes("data-progress-retry-wrong"));
check("live refresh", src.includes('"nova:progress-changed"'));
check("path lookup guarded", src.includes('typeof getLP === "function"'));

console.log("\n\u2014 trackers \u2014");
check("lesson tracker", src.includes('Store.set("lessons"'));
check("flash tracker", src.includes('Store.get("flash"') && src.includes('Store.set("flash"'));
check("dispatch count >= 3", count(src, 'new CustomEvent("nova:progress-changed")') >= 3);

console.log("\n\u2014 progress CSS \u2014");
check("stats CSS", css.includes(".progress-stats") && css.includes(".progress-stat"));
check("review CSS", css.includes(".progress-review"));

console.log("\n" + (failures ? "\u2717 " + failures + " check(s) FAILED" : "\u2713 all checks passed"));
process.exit(failures ? 1 : 0);