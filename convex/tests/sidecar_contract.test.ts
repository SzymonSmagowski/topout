/**
 * Contract test: verify that the JSON fixtures built by the Convex action
 * files are valid according to the Python sidecar's Pydantic schemas.
 *
 * Approach: build minimal JSON fixtures in TypeScript that mirror what
 * summarizeActions.ts and reportsActions.ts construct, write them to a
 * temp file, then validate with Python:
 *
 *   python3 -c "from src.schemas import X; X.model_validate_json(open('fixture').read())"
 *
 * A zero exit code means the schema accepted the fixture.
 *
 * DOES NOT require convex/_generated/ — all types here are hand-rolled
 * mirrors of the TypeScript interfaces in the action files.
 *
 * Requires:
 *   - Python + the sidecar Poetry venv installed in apps/topout/sidecar/
 *   - Run from any working directory; paths are resolved from __dirname.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const topoutRoot = path.resolve(__dirname, '..', '..');
const sidecarRoot = path.join(topoutRoot, 'sidecar');

// ---------------------------------------------------------------------------
// Helper: validate a JSON fixture against a Pydantic model in the sidecar.
// Throws if validation fails (non-zero exit from Python).
// ---------------------------------------------------------------------------
function validateWithPydantic(modelName: string, fixture: unknown): void {
  const tmpFile = path.join(os.tmpdir(), `topout-contract-${modelName}-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(fixture), 'utf-8');
  try {
    execFileSync(
      'poetry',
      [
        'run',
        'python3',
        '-c',
        `import sys; sys.path.insert(0, 'src'); from src.schemas import ${modelName}; ` +
          `${modelName}.model_validate_json(open(${JSON.stringify(tmpFile)}).read()); ` +
          `print('${modelName} validated ok')`,
      ],
      {
        cwd: sidecarRoot,
        stdio: ['ignore', 'inherit', 'inherit'],
        encoding: 'utf-8',
      },
    );
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
}

// ---------------------------------------------------------------------------
// SummarizeSessionRequest fixture — mirrors summarizeActions.ts SidecarRequest
// ---------------------------------------------------------------------------
const summarizeFixture = {
  session_id: 'sess_test_001',
  user_id: 'user_test_xyz',
  session: {
    date: 1_700_000_000_000,
    perceived_effort: 7,
    duration_minutes: 60,
    notes: null,
  },
  attempts: [
    {
      grade: 'V4',
      outcome: 'send',
      attempt_count: 2,
      notes: null,
    },
    {
      grade: 'V5',
      outcome: 'project',
      attempt_count: 5,
      notes: 'close!',
    },
  ],
  baseline: {
    window_days: 30,
    sessions_count: 10,
    send_rate: 0.55,
    top_grade: 'V4',
    total_attempts: 100,
  },
  max_output_chars: 240,
};

// ---------------------------------------------------------------------------
// WeeklyReportRequest fixture — mirrors reportsActions.ts SidecarRequest
// ---------------------------------------------------------------------------
const weekStart = 1_700_000_000_000;
const weekEnd = weekStart + 7 * 86_400_000 - 1;

const weeklyReportFixture = {
  week_start: weekStart,
  week_end: weekEnd,
  user: {
    display_name: 'Alex Climber',
    user_id: 'user_test_xyz',
  },
  baseline: {
    window_days: 30,
    sessions_count: 8,
    send_rate: 0.5,
    top_grade: 'V3',
    total_attempts: 80,
  },
  sessions: [
    {
      session_id: 'sess_test_001',
      date: weekStart + 86_400_000,
      gym: { name: 'The Cave' },
      perceived_effort: 8,
      duration_minutes: 90,
      notes: null,
      attempts: [
        {
          grade: 'V5',
          outcome: 'send',
          attempt_count: 3,
          notes: null,
        },
        {
          grade: 'V6',
          outcome: 'fall',
          attempt_count: 4,
          notes: null,
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Run validations
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function runTest(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`[PASS] ${label}`);
    passed += 1;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[FAIL] ${label}\n  ${msg}`);
    failed += 1;
  }
}

runTest(
  'SummarizeSessionRequest — summarizeActions.ts fixture validates against Pydantic schema',
  () => validateWithPydantic('SummarizeSessionRequest', summarizeFixture),
);

runTest(
  'WeeklyReportRequest — reportsActions.ts fixture validates against Pydantic schema',
  () => validateWithPydantic('WeeklyReportRequest', weeklyReportFixture),
);

// Negative: reject a bad grade value not in VGradeLiteral.
runTest(
  'SummarizeSessionRequest — rejects unknown grade value (contract boundary)',
  () => {
    let threw = false;
    try {
      validateWithPydantic('SummarizeSessionRequest', {
        ...summarizeFixture,
        attempts: [{ grade: 'V99', outcome: 'send', attempt_count: 1, notes: null }],
      });
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error('Expected validation error for unknown grade V99 but Pydantic accepted it');
    }
  },
);

// Negative: reject missing required field session_id.
runTest(
  'SummarizeSessionRequest — rejects missing session_id',
  () => {
    let threw = false;
    const { session_id: _, ...withoutId } = summarizeFixture;
    try {
      validateWithPydantic('SummarizeSessionRequest', withoutId);
    } catch {
      threw = true;
    }
    if (!threw) {
      throw new Error('Expected validation error for missing session_id but Pydantic accepted it');
    }
  },
);

console.log(`\n${passed} passed, ${failed} failed.`);

if (failed > 0) {
  process.exit(1);
}
