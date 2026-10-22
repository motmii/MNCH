"use strict";
/**
 * v3.1.4 · «ملاحظاتي / My notes» hub — regression guard.
 *
 * The Progress view gained a notes hub over the existing local notes store
 * ("motmi-portal:lesson-notes"):
 *   - bilingual strings for the hub, search, edit, actions and export
 *   - every non-empty note is listed with lesson + subject labels
 *   - BOTH lesson and subject titles are resolved from real data
 *     (LESSONS registry / official semester plan), never invented
 *   - instant search normalized for Arabic diacritics/variants
 *   - inline editing (save/cancel, Ctrl+Enter/Esc) writing the real store
 *   - mixed Arabic/English notes pick their reading direction from the
 *     dominant script (excerpt + editor), never from the first character
 *   - per-note open (#lesson/<sub>/<topic>) and confirmed delete
 *   - Markdown export built from local data only (no network)
 *   - notes count joins the stats strip and the "any activity" gate
 *   - dynamic exam labels are bidi-isolated in mixed-direction sentences
 *   - subject chips filter by course, carry per-subject counts, combine
 *     with search, and keep aria-pressed in sync
 *   - quick review walks only the currently visible notes, reveals the
 *     full card, wraps prev/next, honours RTL/LTR arrows, Esc and focus
 *
 * Run: node tests/lesson-notes-hub.test.js
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "style.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

let failures = 0;
function check(name, cond) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.error("  ✗ FAIL: " + name); }
}
function sliceFrom(marker, length) {
  const i = script.indexOf(marker);
  return i === -1 ? "" : script.slice(i, i + (length || 4000));
}

console.log("— release wiring —");
check("package release is 3.1.4", pkg.version === "3.1.4");
check("index.html style.css?v matches the release", html.includes("style.css?v=" + pkg.version));
check("sw.js CACHE_VERSION matches the release", sw.includes('CACHE_VERSION = "v' + pkg.version + '"'));

console.log("— bilingual strings —");
const strings = [
  "progress.notes", "progress.notesTitle", "progress.notesSub",
  "progress.notesEmpty", "progress.notesEmptyCta", "progress.notesCount",
  "progress.noteOpen", "progress.noteDelete", "progress.noteDeleteConfirm",
  "progress.notesExport", "progress.notesExportName", "progress.notesSearch",
  "progress.notesShowing", "progress.notesSearchNone", "progress.noteEdit",
  "progress.noteSave", "progress.noteCancel", "progress.noteField",
  "progress.notesFilter", "progress.notesAll", "progress.notesReview",
  "progress.notesReviewTitle", "progress.notesReviewHint", "progress.notesReviewShow",
  "progress.notesReviewHide", "progress.notesReviewProgress", "progress.notesReviewPrev",
  "progress.notesReviewNext", "progress.notesReviewClose"
];
strings.forEach((k) => {
  const hits = (script.match(new RegExp('"' + k.replace(/\./g, "\\.") + '"', "g")) || []).length;
  check('"' + k + '" exists in both dictionaries', hits >= 2);
});

console.log("— notes hub rendering —");
const hub = sliceFrom("function notesHubHtml(", 8000);
check("notesHubHtml() exists", hub.length > 0);
check("hub reads the real notes store", sliceFrom("function localNotes(", 900).includes('readStored("lesson-notes")'));
check("localNotes keeps only non-empty string notes",
  /typeof text === "string" && text\.trim\(\)/.test(sliceFrom("function localNotes(", 900)));
const titleFn = sliceFrom("function noteTitle(", 1200);
check("lesson title comes from the LESSONS registry",
  titleFn.includes("PLATFORM_LESSONS") && titleFn.includes("title[Lang.current] || title.ar"));
check("subject label comes from the official semester plan",
  sliceFrom("function noteSubjectLabel(", 800).includes("PLATFORM_CURRENT_SEMESTER"));
check("empty state links to the lessons/paths flow", hub.includes('href="#paths"'));
check("hub is mounted in the Progress render()", script.includes("html += notesHubHtml();"));
check("notes count joins the stats strip", /value:\s*Object\.keys\(notes\)\.length,\s*label:\s*"progress\.notes"/.test(script));
check("notes count also counts as activity", script.includes("notesCount > 0 || anyPathDone"));
check("note text is escaped, never raw-interpolated for the excerpt",
  /escP\(snippet\)/.test(hub) && hub.includes("slice(0, 240)"));
check("hub renders a live search input", hub.includes("data-progress-notes-search") && hub.includes('type="search"'));
check("search input keeps the active query", hub.includes('value="\' + escP(notesQuery)'));
check("each note carries a normalized search haystack",
  hub.includes("data-note-search=") && hub.includes("noteSearchText(noteTitle(k)"));
check("no-results message exists", hub.includes("data-progress-notes-none") && hub.includes("progress.notesSearchNone"));
check("inline edit button is rendered per note", hub.includes("data-progress-note-edit="));
check("filter hides non-matching rows", /row\.hidden = !hit/.test(sliceFrom("function applyNoteFilter(", 1300)));
check("filter reports shown vs total", sliceFrom("function applyNoteFilter(", 1600).includes("progress.notesShowing"));
check("search normalization drops Arabic diacritics/variants",
  sliceFrom("function noteSearchText(", 700).includes("u064B") && sliceFrom("function noteSearchText(", 700).includes("u0629"));
const dirFn = sliceFrom("function noteDir(", 600);
check("note direction follows the dominant script",
  dirFn.includes("\\u0600-\\u06FF") && dirFn.includes("A-Za-z") && dirFn.includes("ar >= lat"));
check("excerpt direction is chosen per note", hub.includes('dir="\' + noteDir(text)'));
check("render applies the active filter after painting", script.includes("applyNoteFilter();"));

console.log("— subject filters —");
const filterFn = sliceFrom("function applyNoteFilter(", 2400);
check("active subject is remembered", script.includes('let notesSubject = "";'));
check("each note carries its subject code", hub.includes("data-note-subject="));
check("subject chips include an all-subjects option with counts",
  hub.includes("data-progress-notes-subject") && hub.includes("progress.notesAll") && hub.includes("progress-filter-count"));
check("subject chips are built per saved subject",
  hub.includes("subjectCounts") && hub.includes("noteSubjectLabel(code)"));
check("filter combines subject and search", filterFn.includes("data-note-subject") && filterFn.includes("subjectOk"));
check("filter keeps chips' aria-pressed in sync", filterFn.includes("aria-pressed"));
check("filter disables review when nothing is visible", filterFn.includes("reviewBtn.disabled = shown === 0"));
check("invalid subject resets after deletes", hub.includes("!subjectCounts[notesSubject]"));

console.log("— quick review —");
const openFn = sliceFrom("function openNotesReview(", 4200);
const showFn = sliceFrom("function showReviewNote(", 1800);
check("review button is rendered next to export",
  hub.includes("data-progress-notes-review-open") && hub.includes("progress.notesReview"));
check("review panel is mounted inside the hub", hub.includes("data-progress-notes-review"));
check("review deck comes from the visible rows",
  sliceFrom("function visibleNoteKeys(", 500).includes("if (row.hidden) return") && openFn.includes("visibleNoteKeys()"));
check("review card is built safely with createElement/textContent",
  openFn.includes('createElement("button")') && !openFn.includes("innerHTML"));
check("review reveals the full note with its direction",
  showFn.includes("body.textContent = text") && showFn.includes("noteDir(text)"));
check("review deck wraps in both directions",
  sliceFrom("function stepReview(", 400).includes("+ reviewDeck.length) % reviewDeck.length"));
check("review reports its position in the deck", showFn.includes("progress.notesReviewProgress"));
check("review position is announced to screen readers",
  openFn.includes('setAttribute("aria-live", "polite")') && openFn.includes('setAttribute("aria-atomic", "true")'));
check("review closes with focus returned to its trigger",
  sliceFrom("function closeNotesReview(", 800).includes("trigger.focus()"));
check("clicking the review card toggles the reveal",
  sliceFrom('t.closest("[data-progress-review-card]")', 400).includes("toggleReviewCard("));
check("prev/next and close are wired",
  script.includes('t.closest("[data-progress-review-prev]")') &&
  script.includes('t.closest("[data-progress-review-next]")') &&
  script.includes('t.closest("[data-progress-review-close]")'));
const reviewKeys = sliceFrom('mount.querySelector(".progress-notes.is-reviewing")', 800);
check("Esc closes review and arrows follow the reading direction",
  reviewKeys.includes('e.key === "Escape"') && reviewKeys.includes("rtl ? 1 : -1") && reviewKeys.includes('e.key === "ArrowLeft"'));

console.log("— actions —");
check("per-note open deep-links to the lesson route", hub.includes('href="#lesson/\' + escP(k) + \'"'));
check("per-note delete button carries the key", hub.includes('data-progress-note-delete="\' + escP(k) + \'"'));
const click = sliceFrom('t.closest("[data-progress-note-delete]")', 700);
check("delete asks for confirmation first",
  click.includes('Lang.t("progress.noteDeleteConfirm")') && click.includes("window.confirm"));
check("delete writes through saveLessonNote(key, \"\")", /saveLessonNote\(key,\s*""\)/.test(click));
check("export button is wired", script.includes('t.closest("[data-progress-notes-export]")') && script.includes("exportNotes();"));
const editClick = sliceFrom('t.closest("[data-progress-note-edit]")', 500);
check("edit opens the inline editor", editClick.includes("openNoteEditor(") && editClick.includes('closest(".progress-note")'));
const editor = sliceFrom("function openNoteEditor(", 2600);
check("editor is built safely with createElement/textContent",
  editor.includes("createElement(\"textarea\")") && editor.includes("ta.value = text") && !editor.includes("innerHTML"));
check("editor caps notes at 2000 chars", editor.includes("ta.maxLength = 2000"));
check("editor direction is chosen per note", editor.includes('ta.setAttribute("dir", noteDir(text))'));
check("editor re-evaluates direction while typing",
  editor.includes('ta.addEventListener("input"') && editor.includes("noteDir(ta.value)"));
check("editor provides save and cancel actions",
  editor.includes("data-progress-note-save") && editor.includes("data-progress-note-cancel"));
const save = sliceFrom("function saveNoteEditor(", 800);
check("save persists through saveLessonNote", save.includes("saveLessonNote(key, input.value)"));
check("empty edits are not saved", save.includes('String(input.value || "").trim()'));
const inputHandler = sliceFrom('mount.addEventListener("input"', 700);
check("typing filters notes without re-rendering", inputHandler.includes("notesQuery = input.value") && inputHandler.includes("applyNoteFilter()"));
const keys = sliceFrom('e.target.closest("[data-progress-note-editor]")', 800);
check("Esc cancels and Ctrl/Cmd+Enter saves", keys.includes('e.key === "Escape"') && keys.includes("e.ctrlKey || e.metaKey"));

console.log("— bidi isolation —");
const iso = sliceFrom("function isolate(", 300);
check("isolate() wraps labels in FSI/PDI", iso.includes('"\\u2068"') && iso.includes('"\\u2069"'));
const recs = sliceFrom("function recommendations(", 1800);
check("weak-topic labels are isolated", recs.includes("isolate(w.topic)") && recs.includes("isolate(subjectName(w.subject))"));
check("lesson and subject recommendation labels are isolated",
  recs.includes("isolate(k.split(\"/\").pop())") && recs.includes("isolate(subjectName(r.key))"));

console.log("— Markdown export —");
const exp = sliceFrom("function exportNotes(", 2000);
check("export builds one Markdown document", exp.includes('"# " + Lang.t("progress.notesTitle")') && exp.includes('"## " + noteTitle(k)'));
check("export downloads locally (Blob + anchor)", exp.includes("new Blob(") && exp.includes("a.download ="));
check("export revokes the object URL", exp.includes("revokeObjectURL"));
check("export performs no network I/O", !/fetch\(|XMLHttpRequest|navigator\.sendBeacon/.test(exp));

console.log("— styling & docs —");
["progress-notes", "progress-notes-head", "progress-notes-list", "progress-note", "progress-note-text", "progress-note-actions",
  "progress-notes-search", "progress-note-editor", "progress-note-input", "progress-note-edit-actions",
  "progress-notes-filters", "progress-filter-chip", "progress-filter-count",
  "progress-notes-review", "progress-notes-review-card", "progress-notes-review-text", "progress-notes-review-nav"]
  .forEach((cls) => check("." + cls + " style exists", css.includes("." + cls)));
check("README documents the notes hub", readme.includes("My notes"));
check("changelog ships a v3.1.4 entry", script.includes("الإصدار 3.1.4") && script.includes("v3.1.4"));

console.log("\n" + (failures ? "✗ " + failures + " check(s) FAILED" : "✓ all checks passed"));
process.exit(failures ? 1 : 0);
