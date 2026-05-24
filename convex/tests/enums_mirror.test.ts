/**
 * Contract test: assert that V_GRADES and OUTCOMES in convex/lib/enums.ts
 * are byte-identical to the arrays in frontend/src/lib/grades.ts.
 *
 * This enforces the invariant documented in apps/topout/CLAUDE.md:
 *   "frontend/src/lib/grades.ts (V_GRADES, OUTCOMES) and convex/lib/enums.ts
 *    must stay in lockstep."
 *
 * DOES NOT require _generated/ — pure filesystem reads plus array comparison.
 * Run with: node --import tsx/esm convex/tests/enums_mirror.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helper: extract a string[] from a TS const array declaration.
// Handles `export const FOO = ['a', 'b', ...] as const` style.
// ---------------------------------------------------------------------------
function extractArray(source: string, exportName: string): string[] {
  const pattern = new RegExp(
    `export const ${exportName}\\s*=\\s*\\[([^\\]]+)\\]`,
    's',
  );
  const m = pattern.exec(source);
  if (!m) {
    throw new Error(`Could not find export const ${exportName} in source`);
  }
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^['"]/, '').replace(/['"]$/, ''))
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Locate the two source files relative to this test (topout/ root is 2 up).
// ---------------------------------------------------------------------------
const topoutRoot = path.resolve(__dirname, '..', '..');
const convexEnumsFile = path.join(topoutRoot, 'convex', 'lib', 'enums.ts');
const frontendGradesFile = path.join(topoutRoot, 'frontend', 'src', 'lib', 'grades.ts');

if (!fs.existsSync(convexEnumsFile)) {
  throw new Error(`convex/lib/enums.ts not found at: ${convexEnumsFile}`);
}
if (!fs.existsSync(frontendGradesFile)) {
  throw new Error(`frontend/src/lib/grades.ts not found at: ${frontendGradesFile}`);
}

const convexSource = fs.readFileSync(convexEnumsFile, 'utf-8');
const frontendSource = fs.readFileSync(frontendGradesFile, 'utf-8');

const convexGrades = extractArray(convexSource, 'V_GRADES');
const frontendGrades = extractArray(frontendSource, 'V_GRADES');

const convexOutcomes = extractArray(convexSource, 'OUTCOMES');
const frontendOutcomes = extractArray(frontendSource, 'OUTCOMES');

// ---------------------------------------------------------------------------
// Assertions — fail fast with a descriptive message.
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assertEqual<T>(label: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`[FAIL] ${label}\n  actual:   ${a}\n  expected: ${e}`);
    failed += 1;
  } else {
    console.log(`[PASS] ${label}`);
    passed += 1;
  }
}

assertEqual(
  'V_GRADES length matches: convex/lib/enums.ts vs frontend/src/lib/grades.ts',
  convexGrades.length,
  frontendGrades.length,
);

assertEqual(
  'V_GRADES array identical: convex/lib/enums.ts vs frontend/src/lib/grades.ts',
  convexGrades,
  frontendGrades,
);

assertEqual(
  'OUTCOMES length matches: convex/lib/enums.ts vs frontend/src/lib/grades.ts',
  convexOutcomes.length,
  frontendOutcomes.length,
);

assertEqual(
  'OUTCOMES array identical: convex/lib/enums.ts vs frontend/src/lib/grades.ts',
  convexOutcomes,
  frontendOutcomes,
);

// Spot-checks for obvious corruption.
assertEqual('V_GRADES[0] is VB', convexGrades[0], 'VB');
assertEqual('V_GRADES last is V17', convexGrades.at(-1), 'V17');
assertEqual('OUTCOMES[0] is flash', convexOutcomes[0], 'flash');
assertEqual('OUTCOMES last is fall', convexOutcomes.at(-1), 'fall');

console.log(`\n${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
}
