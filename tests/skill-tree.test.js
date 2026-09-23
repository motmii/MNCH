"use strict";
/**
 * Phase 3 source tests — MODULE 51 · SkillTree.
 * Verifies that the tree derives from real learning paths, has valid
 * prerequisite edges, exposes required node details, keeps an accessible
 * list alternative, and supports AR/EN/RTL/LTR/mobile.
 * Run: node tests/skill-tree.test.js
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}

const START = js.indexOf("/* @@SKILL_TREE_START@@ */");
const END = js.indexOf("/* @@SKILL_TREE_END@@ */");
const mod = START >= 0 && END > START ? js.slice(START, END) : "";
const dictStart = js.indexOf("const DICT");
const enStart = js.indexOf("en: {", dictStart);
const arSrc = js.slice(dictStart, enStart);
const enSrc = js.slice(enStart, js.indexOf("const QKEYS", enStart));
const keys = [
  "nav.skills", "skills.eyebrow", "skills.title", "skills.sub", "skills.listAlt",
  "skills.listIntro", "skills.completion", "skills.prerequisites", "skills.prerequisitesNone",
  "skills.relatedLessons", "skills.relatedQuizzes", "skills.relatedLabs", "skills.noLessons",
  "skills.noQuizzes", "skills.noLabs", "skills.nextAction", "skills.comingSoon", "skills.reviewPath",
  "skills.startQuiz", "skills.openLab", "skills.reviewFlashcards", "skills.openPath",
  "skills.nextTopic", "skills.recommended", "skills.soon"
];
function hasKey(src, key) {
  return new RegExp('"' + key.replace(/\./g, "\\.") + '":').test(src);
}

console.log("— source of truth & data model —");
check("MODULE 51 exists and is isolated by markers", START >= 0 && END > START);
check("reads real learning paths from getLearningPaths", mod.includes("window.getLearningPaths"));
check("does not embed path titles/descriptions", !/title:\s*\{|desc:\s*\{|topics:\s*\[/.test(mod));
check("uses a simple prerequisite edge map", mod.includes("PREREQS"));
check("completion uses manual path progress", mod.includes('s.get("paths"'));
check("completion uses quiz-result auto-done", mod.includes("saved[t.res.key]"));
check("derives related lessons from real topics", mod.includes("t.lsn"));
check("derives related quizzes from real resources", mod.includes('r.k === "quiz"'));
check("derives related labs from real resources", mod.includes('r.k === "lab"'));
check("builds recommended next action from first incomplete topic", mod.includes("prog.next"));

console.log("\n— prerequisite edges are valid path ids —");
const ids = ["fundamentals", "networking", "operating-systems", "cryptography", "websec",
             "pentest", "incident", "forensics", "riskgov", "ctf"];
const prereqMatch = mod.match(/const PREREQS = \{([\s\S]*?)\};/);
check("prerequisite map is present and parseable", !!prereqMatch);
let prereqIdsOk = false;
let noDuplicateEdges = false;
let noSelfEdges = false;
if (prereqMatch) {
  let parsed;
  try { parsed = (new Function("return {" + prereqMatch[1] + "}"))(); } catch (e) { parsed = null; }
  if (parsed) {
    const all = Object.keys(parsed);
    prereqIdsOk = ids.every((id) => all.includes(id)) &&
      all.every((id) => parsed[id].every((pre) => ids.includes(pre)));
    noDuplicateEdges = all.every((id) => new Set(parsed[id]).size === parsed[id].length);
    noSelfEdges = all.every((id) => !parsed[id].includes(id));
  }
}
check("every prerequisite edge references an existing path id", prereqIdsOk);
check("prerequisite edges have no duplicates", noDuplicateEdges);
check("prerequisite edges have no self references", noSelfEdges);

console.log("\n— view, navigation & accessible alternative —");
check("registers #skills as a routed view", js.includes('$id("hero"), $id("semester"), $id("paths"), $id("skills")'));
check("adds #skills section", html.includes('id="skills"') && html.includes('id="skillsTree"'));
check("adds desktop and mobile navigation links", (html.match(/href="#skills"/g) || []).length >= 2);
check("accessible list alternative is present", html.includes('id="skillsListAlt"') && html.includes('id="skillsList"'));
check("tree and list both have list semantics", html.includes('id="skillsTree" role="list"') && html.includes('id="skillsList" role="list"'));
check("skill cards include focusable article", mod.includes('role="listitem" tabindex="-1"'));
check("arrow/home/end keyboard navigation exists", mod.includes('["ArrowDown", "ArrowUp", "Home", "End"]'));
check("progressbar exposes completion state", mod.includes('role="progressbar"') && mod.includes('aria-valuenow'));
check("soon paths remain honest", mod.includes('p.status === "soon"') && mod.includes("skills.comingSoon"));

console.log("\n— bilingual + responsive/RTL coverage —");
check("all skill-tree keys exist in Arabic", keys.every((k) => hasKey(arSrc, k)));
check("all skill-tree keys exist in English", keys.every((k) => hasKey(enSrc, k)));
check("current-locale text helper exists", mod.includes("field[cur] || field.ar || field.en"));
check("RTL-safe logical borders are used", css.includes("border-inline-start") && css.includes("inset-inline"));
check("visual tree uses responsive auto-fit columns", css.includes(".skill-tree") && css.includes("repeat(auto-fit"));
check("mobile tree collapses to one column", /@media \(max-width: 720px\)[\s\S]*\.skill-tree \{ grid-template-columns: 1fr; \}/.test(css));
check("mobile detail grid collapses", /@media \(max-width: 720px\)[\s\S]*\.skill-details \{ grid-template-columns: 1fr; \}/.test(css));
check("small-screen cards reduce padding", /@media \(max-width: 420px\)[\s\S]*\.skill-card \{ padding: 0\.8rem; \}/.test(css));
check("keyboard focus is visible", css.includes(".skill-card:focus-visible") && css.includes(".skill-next:focus-visible"));
check("subtle reduced-motion support", /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.skill-meter > i \{ transition: none; \}/.test(css));
check("no external dependency introduced", !/require\(|import\s+|from\s+["']|<script[^>]+src=["']https?:/.test(mod));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);
