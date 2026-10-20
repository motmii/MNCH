"use strict";
/* ============================================================
   ANNOUNCEMENTS — centralized, dated student reminders
   (اختبارات قصيرة، مواعيد نهائية، تنبيهات المواد)
   ------------------------------------------------------------
   Single source of truth for time-bound reminders shown in the
   AnnouncementsBar banner (script.js MODULE 74) and mirrored as
   a red chip on the hero "Now" strip (MODULE 55).

   Rules honored by this file:
   - Only subjects that ALREADY exist in the official plan
     (current-semester.js → subjects[].code) are referenced, by
     their real course code — nothing is invented here.
   - Every text field is bilingual: { ar: "...", en: "..." }.
   - `date` is an ISO calendar day (YYYY-MM-DD); `startTime` /
     `endTime` are 12-hour clock strings ("2:40 PM") so they can
     be parsed by the same helper the timetable uses.
   - `link` points at an EXISTING platform view only (e.g. #quiz),
     following the authored navigation — no fake destinations.
   - `durationMin`, `questions`, `kind`, `weight` are honest facts
     taken from the department announcement; `notes` is the
     bilingual preparation note.

   Timing is computed in the browser from the visitor's own clock
   (no network, no timezone database — calendar output uses
   floating local time, exactly like MODULE 69). A reminder shows
   from `leadDays` before the date until the end of its day.

   Exposed on `window` as PLATFORM_ANNOUNCEMENTS; also exported
   for CommonJS so tests can load it without a DOM.
   ============================================================ */

const ANNOUNCEMENTS = {
  id: "announcements",

  title: {
    ar: "تنبيهات المواد",
    en: "Course announcements"
  },

  /* How many days ahead a reminder becomes visible (0 = only on the day). */
  leadDays: 7,

  /* No active reminders right now. Add dated items here (honouring the
     rules above) when a quiz/deadline is announced by the department. */
  items: []
};

/* Expose as a plain data registry (window.PLATFORM_ANNOUNCEMENTS).
   CONSUMED by MODULE 74 (AnnouncementsBar — the #announceBar banner)
   and MODULE 55 (HeroNow — the red "quiz near" chip). index.html
   loads this file before script.js. */
if (typeof window !== "undefined") {
  window.PLATFORM_ANNOUNCEMENTS = ANNOUNCEMENTS;
}

/* Lightweight CommonJS export used by the smoke tests (Node without DOM).
   In the browser `module` is undefined so this is a harmless no-op. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = ANNOUNCEMENTS;
}
