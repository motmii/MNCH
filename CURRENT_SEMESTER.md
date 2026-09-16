# CURRENT_SEMESTER Configuration Analysis

## Goal
Create a clean centralized data structure named `CURRENT_SEMESTER` supporting Arabic and English content, using only subjects that already exist in the project.

## What exists in the project now for "current semester"
- `current-semester.js` already has a registry of the 5 official subjects keyed by course code.
- `script.js` contains the app's i18n, view switching, Store, quiz engine, tools, labs, paths, etc.
- No `CURRENT_SEMESTER` constant exists yet with the requested shape.

## Next steps
1. Read `current-semester.js` to extract the exact 5 subjects and their fields.
2. Read the relevant modules in `script.js` (i18n, view switching, Store, progress) to make sure the structure is compatible.
3. Design the `CURRENT_SEMESTER` object with bilingual content only, no new subjects.
4. Write the file to the project.
5. Validate by importing/requiring it (Node) and optionally by running a smoke check.
