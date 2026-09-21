"use strict";
/**
 * Test runner — executes every tests/*.test.js suite in a child process
 * and reports an aggregate result. Zero dependencies.
 * Run: node tests/run-all.js   (or: npm test)
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = __dirname;
const suites = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".test.js"))
  .sort();

if (!suites.length) {
  console.error("No test suites found in " + dir);
  process.exit(1);
}

let failed = 0;
for (const suite of suites) {
  console.log("\n=== " + suite + " ===");
  const res = spawnSync(process.execPath, [path.join(dir, suite)], {
    stdio: "inherit",
    cwd: path.join(dir, ".."),
  });
  if (res.status !== 0) failed++;
}

console.log("\n────────────────────────────────────");
console.log(
  failed === 0
    ? `✓ all ${suites.length} test suites passed`
    : `✗ ${failed}/${suites.length} test suites FAILED`
);
process.exit(failed === 0 ? 0 : 1);
