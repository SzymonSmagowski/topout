/**
 * Static mock data for the design preview only.
 *
 * This file is deliberately verbose: the preview is the design handoff, and
 * realistic numbers (V3-V5 arc, plausible send rates, real-sounding session
 * notes) are what make the visual decisions defensible. Production code reads
 * from Convex, not from here.
 */
import type { Outcome, VGrade } from '@/lib/grades';
import { asId, type GymId, type SessionId, type UserId } from '@/lib/ids';

export interface MockUser {
  readonly id: UserId;
  readonly displayName: string;
  readonly email: string;
  readonly initials: string;
  readonly gradeRange: readonly [VGrade, VGrade];
}

export interface MockGym {
  readonly id: GymId;
  readonly name: string;
  readonly city: string;
}

export interface MockAttempt {
  readonly grade: VGrade;
  readonly outcome: Outcome;
  readonly attemptCount: number;
  readonly note?: string;
}

export type SummaryState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'ok'; readonly text: string }
  | { readonly kind: 'err'; readonly message: string };

export interface MockSession {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly dateIso: string;
  readonly gymId: GymId;
  readonly perceivedEffort: number;
  readonly durationMinutes?: number;
  readonly notes?: string;
  readonly attempts: readonly MockAttempt[];
  readonly summary: SummaryState;
}

/* ----------------------------------------------------------------------------
   Users + gyms
   ---------------------------------------------------------------------------- */

export const USER_ME: MockUser = {
  id: asId('users', 'u_me'),
  displayName: 'Szymon S.',
  email: 'szymon@topout.local',
  initials: 'SS',
  gradeRange: ['V3', 'V5'],
};

export const USER_ALEX: MockUser = {
  id: asId('users', 'u_alex'),
  displayName: 'Alex Climber',
  email: 'seed-alex@topout.local',
  initials: 'AC',
  gradeRange: ['V3', 'V5'],
};

export const USER_SAM: MockUser = {
  id: asId('users', 'u_sam'),
  displayName: 'Sam Crusher',
  email: 'seed-sam@topout.local',
  initials: 'SC',
  gradeRange: ['V4', 'V6'],
};

export const ALL_USERS: readonly MockUser[] = [USER_ME, USER_ALEX, USER_SAM];

export const GYMS: readonly MockGym[] = [
  { id: asId('gyms', 'g_hangar'), name: 'The Climbing Hangar', city: 'London' },
  { id: asId('gyms', 'g_mile_end'), name: 'Mile End Climbing Wall', city: 'London' },
  { id: asId('gyms', 'g_rope_hold'), name: 'Rope & Hold', city: 'Manchester' },
  { id: asId('gyms', 'g_brighton'), name: 'Boulder Brighton', city: 'Brighton' },
];

const gymById = (id: GymId): MockGym => {
  const found = GYMS.find((g) => g.id === id);
  if (!found) throw new Error(`Unknown gym: ${id}`);
  return found;
};

export function gymName(id: GymId): string {
  return gymById(id).name;
}

/* ----------------------------------------------------------------------------
   Sessions — last 5 for "me", a few for the partner Sam.
   ---------------------------------------------------------------------------- */

function s(
  id: string,
  userId: UserId,
  dateIso: string,
  gym: GymId,
  effort: number,
  attempts: readonly MockAttempt[],
  summary: SummaryState,
  notes?: string,
  durationMinutes?: number,
): MockSession {
  return {
    id: asId('sessions', id),
    userId,
    dateIso,
    gymId: gym,
    perceivedEffort: effort,
    durationMinutes,
    notes,
    attempts,
    summary,
  };
}

export const MY_SESSIONS: readonly MockSession[] = [
  s(
    's_me_5',
    USER_ME.id,
    '2026-05-23',
    asId('gyms', 'g_hangar'),
    8,
    [
      { grade: 'V1', outcome: 'flash', attemptCount: 1 },
      { grade: 'V1', outcome: 'flash', attemptCount: 1 },
      { grade: 'V2', outcome: 'flash', attemptCount: 1 },
      { grade: 'V3', outcome: 'send', attemptCount: 2, note: 'felt locked in on the heel hook' },
      { grade: 'V4', outcome: 'send', attemptCount: 3 },
      { grade: 'V4', outcome: 'repeat', attemptCount: 1 },
      { grade: 'V5', outcome: 'send', attemptCount: 4, note: 'first V5 of the year — campussed the top' },
      { grade: 'V5', outcome: 'project', attemptCount: 5, note: 'stuck at the crux move' },
    ],
    { kind: 'ok', text: 'Strong V4–V5 evening — your first V5 of the year is right on trend with the past month’s send rate climb. Save the projecting for next session and rest tomorrow.' },
    'Felt fresh after rest day. Skin held up.',
    95,
  ),
  s(
    's_me_4',
    USER_ME.id,
    '2026-05-21',
    asId('gyms', 'g_mile_end'),
    7,
    [
      { grade: 'V1', outcome: 'flash', attemptCount: 1 },
      { grade: 'V2', outcome: 'flash', attemptCount: 1 },
      { grade: 'V3', outcome: 'flash', attemptCount: 1 },
      { grade: 'V3', outcome: 'send', attemptCount: 2 },
      { grade: 'V4', outcome: 'send', attemptCount: 3 },
      { grade: 'V4', outcome: 'project', attemptCount: 4, note: 'feet kept popping on the slab' },
      { grade: 'V5', outcome: 'fall', attemptCount: 4 },
    ],
    {
      kind: 'ok',
      text: 'Solid volume night — three flashes through V3 and a clean V4 send. The V5 still wants one more focused session; try cleaner foot sequencing first try.',
    },
    undefined,
    80,
  ),
  s(
    's_me_3',
    USER_ME.id,
    '2026-05-19',
    asId('gyms', 'g_hangar'),
    6,
    [
      { grade: 'V0', outcome: 'flash', attemptCount: 1 },
      { grade: 'V1', outcome: 'flash', attemptCount: 1 },
      { grade: 'V2', outcome: 'flash', attemptCount: 1 },
      { grade: 'V3', outcome: 'send', attemptCount: 2 },
      { grade: 'V3', outcome: 'repeat', attemptCount: 1 },
      { grade: 'V4', outcome: 'repeat', attemptCount: 1 },
      { grade: 'V4', outcome: 'send', attemptCount: 2 },
    ],
    { kind: 'pending' },
    'Easy mileage day.',
  ),
  s(
    's_me_2',
    USER_ME.id,
    '2026-05-17',
    asId('gyms', 'g_brighton'),
    9,
    [
      { grade: 'V2', outcome: 'flash', attemptCount: 1 },
      { grade: 'V3', outcome: 'send', attemptCount: 3 },
      { grade: 'V4', outcome: 'project', attemptCount: 6, note: 'unlocked the crux beta but ran out of skin' },
      { grade: 'V5', outcome: 'fall', attemptCount: 3 },
    ],
    {
      kind: 'err',
      message: 'Connection to OpenAI timed out after 8s',
    },
  ),
  s(
    's_me_1',
    USER_ME.id,
    '2026-05-14',
    asId('gyms', 'g_hangar'),
    7,
    [
      { grade: 'V1', outcome: 'flash', attemptCount: 1 },
      { grade: 'V2', outcome: 'flash', attemptCount: 1 },
      { grade: 'V3', outcome: 'send', attemptCount: 1 },
      { grade: 'V4', outcome: 'send', attemptCount: 4 },
      { grade: 'V4', outcome: 'repeat', attemptCount: 1 },
      { grade: 'V5', outcome: 'project', attemptCount: 5 },
    ],
    {
      kind: 'ok',
      text: 'Good intensity night — V4 sends are now your steady ceiling. The V5 projecting is paying off; expect a send within two sessions if you stay rested.',
    },
  ),
];

export const SAM_SESSIONS: readonly MockSession[] = [
  s(
    's_sam_3',
    USER_SAM.id,
    '2026-05-23',
    asId('gyms', 'g_mile_end'),
    8,
    [
      { grade: 'V2', outcome: 'flash', attemptCount: 1 },
      { grade: 'V3', outcome: 'flash', attemptCount: 1 },
      { grade: 'V4', outcome: 'flash', attemptCount: 1 },
      { grade: 'V5', outcome: 'send', attemptCount: 2 },
      { grade: 'V5', outcome: 'send', attemptCount: 3 },
      { grade: 'V6', outcome: 'send', attemptCount: 5, note: 'first V6 — committed to the dyno' },
      { grade: 'V6', outcome: 'project', attemptCount: 4 },
    ],
    {
      kind: 'ok',
      text: 'Breakthrough session — your first V6 send lands at the top of a strong V5 baseline. Next: another V6 attempt within 5 days while the beta is fresh.',
    },
  ),
  s(
    's_sam_2',
    USER_SAM.id,
    '2026-05-21',
    asId('gyms', 'g_mile_end'),
    7,
    [
      { grade: 'V3', outcome: 'flash', attemptCount: 1 },
      { grade: 'V4', outcome: 'flash', attemptCount: 1 },
      { grade: 'V5', outcome: 'send', attemptCount: 2 },
      { grade: 'V5', outcome: 'repeat', attemptCount: 1 },
      { grade: 'V6', outcome: 'fall', attemptCount: 4 },
    ],
    {
      kind: 'ok',
      text: 'Steady V5 volume with focused V6 attempts. Send rate this week sits at 64% — well above your 30-day baseline.',
    },
  ),
  s(
    's_sam_1',
    USER_SAM.id,
    '2026-05-18',
    asId('gyms', 'g_hangar'),
    6,
    [
      { grade: 'V2', outcome: 'flash', attemptCount: 1 },
      { grade: 'V3', outcome: 'send', attemptCount: 2 },
      { grade: 'V4', outcome: 'send', attemptCount: 3 },
      { grade: 'V5', outcome: 'project', attemptCount: 5 },
    ],
    {
      kind: 'ok',
      text: 'Volume day. Projecting V5 paid off later in the week.',
    },
  ),
];

/* ----------------------------------------------------------------------------
   Aggregated chart data — derived once, statically, to keep preview deterministic.
   ---------------------------------------------------------------------------- */

export interface SendPyramidRow {
  readonly grade: VGrade;
  readonly sends: number;
}

export const SEND_PYRAMID_30D: readonly SendPyramidRow[] = [
  { grade: 'V5', sends: 3 },
  { grade: 'V4', sends: 11 },
  { grade: 'V3', sends: 14 },
  { grade: 'V2', sends: 9 },
  { grade: 'V1', sends: 7 },
  { grade: 'V0', sends: 4 },
];

export interface WeeklyVolumeRow {
  readonly week: string;
  readonly sessions: number;
  readonly attempts: number;
}

export const WEEKLY_VOLUME_30D: readonly WeeklyVolumeRow[] = [
  { week: 'Apr 28', sessions: 3, attempts: 28 },
  { week: 'May 05', sessions: 4, attempts: 36 },
  { week: 'May 12', sessions: 2, attempts: 19 },
  { week: 'May 19', sessions: 3, attempts: 31 },
];

export interface GradeDistRow {
  readonly grade: VGrade;
  readonly attempts: number;
}

export const GRADE_DIST_30D: readonly GradeDistRow[] = [
  { grade: 'V0', attempts: 5 },
  { grade: 'V1', attempts: 9 },
  { grade: 'V2', attempts: 13 },
  { grade: 'V3', attempts: 22 },
  { grade: 'V4', attempts: 31 },
  { grade: 'V5', attempts: 24 },
];

export interface SendRateRow {
  readonly week: string;
  readonly rate: number; // 0..1
}

export const SEND_RATE_TREND: readonly SendRateRow[] = [
  { week: 'Mar 03', rate: 0.41 },
  { week: 'Mar 10', rate: 0.38 },
  { week: 'Mar 17', rate: 0.44 },
  { week: 'Mar 24', rate: 0.46 },
  { week: 'Mar 31', rate: 0.51 },
  { week: 'Apr 07', rate: 0.49 },
  { week: 'Apr 14', rate: 0.55 },
  { week: 'Apr 21', rate: 0.58 },
  { week: 'Apr 28', rate: 0.6 },
  { week: 'May 05', rate: 0.63 },
  { week: 'May 12', rate: 0.59 },
  { week: 'May 19', rate: 0.67 },
];

/* Sam's parallel data — used by partner detail to prove the same component
   renders different users. */

export const SAM_SEND_PYRAMID: readonly SendPyramidRow[] = [
  { grade: 'V6', sends: 1 },
  { grade: 'V5', sends: 9 },
  { grade: 'V4', sends: 16 },
  { grade: 'V3', sends: 11 },
  { grade: 'V2', sends: 6 },
];

export const SAM_GRADE_DIST: readonly GradeDistRow[] = [
  { grade: 'V2', attempts: 8 },
  { grade: 'V3', attempts: 14 },
  { grade: 'V4', attempts: 22 },
  { grade: 'V5', attempts: 28 },
  { grade: 'V6', attempts: 9 },
];

/* ----------------------------------------------------------------------------
   Weekly reports
   ---------------------------------------------------------------------------- */

export interface MockReport {
  readonly id: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly narrativeMd: string;
  readonly stats: {
    readonly sends: number;
    readonly topGrade: VGrade;
    readonly sendRate: number;
    readonly attempts: number;
    readonly gymsVisited: number;
    readonly sendRateDelta: number; // vs prior 7d
    readonly topGradeDelta: number; // grade steps vs prior 30d ceiling
  };
}

export const REPORTS: readonly MockReport[] = [
  {
    id: 'r_2026_05_18',
    weekStart: '2026-05-18',
    weekEnd: '2026-05-24',
    narrativeMd: `## This week — the first V5

Three sessions, **two of them above 8/10 effort**, and you put down your first V5 of the year. The shape of the week tells the story: Monday and Wednesday were focused volume on V3–V4, and Friday was a clean projecting night where the V5 finally went on go four.

### What stood out
- **First V5 send (Fri):** the heel hook that kept slipping in week 18 stayed locked. That's beta consolidation, not power gain.
- **Send rate up to 67%** on the week — a 7-point jump on your 30-day baseline (60%). Most of that came from cleaner V4 attempts, not from grinding V5.
- **3 gyms visited** (Hangar, Mile End, Brighton). Variety in walls is feeding into footwork that travels.

### Trend vs 30-day baseline
You're now sending V4 reliably — 11 V4 sends in the window vs 8 in the prior 30 days. Sessions where stretch-grade attempts (V5) clustered after a clean V4 warmup had the highest send rates. Sessions that opened cold on V5 mostly produced falls.

### Suggestion for next week
**Cap V5 attempts at 5 per session** and stop when skin goes. The data shows your 4th V5 attempt of a session has roughly the same send odds as your 6th — but the 6th costs you Tuesday's session. One more V5 send is the realistic target.`,
    stats: {
      sends: 14,
      topGrade: 'V5',
      sendRate: 0.67,
      attempts: 31,
      gymsVisited: 3,
      sendRateDelta: 0.07,
      topGradeDelta: 1,
    },
  },
  {
    id: 'r_2026_05_11',
    weekStart: '2026-05-11',
    weekEnd: '2026-05-17',
    narrativeMd: `## Week of May 11 — base building paid off

Two sessions, lower intensity, and **a 60% send rate** that holds the 30-day average. Nothing flashy, but Brighton on Sunday was the highest-effort night of the month and unlocked V4 beta you'll cash in next week.

### Highlight
- **V4 projecting at Brighton** — six attempts on one problem, beta fully mapped. Skin gave out before the send did.
- Send rate held steady despite skipping Friday. Recovery showed up Sunday.

### Suggestion for next week
Open every session on V3 (warmup), then move to V4 volume before any V5 attempt. The pattern of "V5 cold → fall → frustration" is now visible across the last 14 days.`,
    stats: {
      sends: 9,
      topGrade: 'V4',
      sendRate: 0.6,
      attempts: 19,
      gymsVisited: 2,
      sendRateDelta: -0.04,
      topGradeDelta: 0,
    },
  },
  {
    id: 'r_2026_05_04',
    weekStart: '2026-05-04',
    weekEnd: '2026-05-10',
    narrativeMd: `## Week of May 04 — biggest volume month-to-date

**Four sessions, 36 attempts, 64% send rate.** The shape of this week is what consistent V4 climbing looks like: every session opened with a V2 flash, moved through V3 sends, and finished with focused V4 attempts.

### Highlight
- **First time sending 4 V4s in a single session** (Wed at the Hangar).
- Effort distribution clean: two 6/10 nights, one 7/10, one 8/10. Recovery between sessions was real.

### Suggestion
The V4 ceiling is now your baseline. Time to start a single V5 project — pick one problem that suits your style and chip at it across 2–3 sessions.`,
    stats: {
      sends: 18,
      topGrade: 'V4',
      sendRate: 0.64,
      attempts: 36,
      gymsVisited: 2,
      sendRateDelta: 0.06,
      topGradeDelta: 0,
    },
  },
];
