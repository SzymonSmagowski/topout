/**
 * Runtime + compile-time vocabularies. Mirrors
 * `apps/topout/frontend/src/lib/grades.ts` exactly. Both sides import their
 * own copy because Convex and Next live in different TS projects;
 * a contract test (in BackendTester) asserts the two arrays are identical.
 *
 * Never extend one side without the other.
 */
import { v } from 'convex/values';

// ---------------------------------------------------------------------------
// V-grade vocabulary — bouldering V-scale, VB..V17. Mirrors the frontend.
// ---------------------------------------------------------------------------
export const V_GRADES = [
  'VB',
  'V0',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
  'V11',
  'V12',
  'V13',
  'V14',
  'V15',
  'V16',
  'V17',
] as const;

export type VGrade = (typeof V_GRADES)[number];

export const vGrade = v.union(
  v.literal('VB'),
  v.literal('V0'),
  v.literal('V1'),
  v.literal('V2'),
  v.literal('V3'),
  v.literal('V4'),
  v.literal('V5'),
  v.literal('V6'),
  v.literal('V7'),
  v.literal('V8'),
  v.literal('V9'),
  v.literal('V10'),
  v.literal('V11'),
  v.literal('V12'),
  v.literal('V13'),
  v.literal('V14'),
  v.literal('V15'),
  v.literal('V16'),
  v.literal('V17'),
);

// ---------------------------------------------------------------------------
// Outcome vocabulary.
// ---------------------------------------------------------------------------
export const OUTCOMES = ['flash', 'send', 'repeat', 'project', 'fall'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const vOutcome = v.union(
  v.literal('flash'),
  v.literal('send'),
  v.literal('repeat'),
  v.literal('project'),
  v.literal('fall'),
);

/** Outcomes that count as a successful ascent on the send pyramid. */
export const SENT_OUTCOMES = ['flash', 'send', 'repeat'] as const satisfies readonly Outcome[];
export type SentOutcome = (typeof SENT_OUTCOMES)[number];

export function isSent(outcome: Outcome): outcome is SentOutcome {
  return (SENT_OUTCOMES as readonly Outcome[]).includes(outcome);
}

// ---------------------------------------------------------------------------
// Discriminated status vocabularies.
// ---------------------------------------------------------------------------
export const SUMMARY_STATUSES = ['pending', 'ok', 'err'] as const;
export type SummaryStatus = (typeof SUMMARY_STATUSES)[number];

export const vSummaryStatus = v.union(
  v.literal('pending'),
  v.literal('ok'),
  v.literal('err'),
);

export const REPORT_STATUSES = ['pending', 'ok', 'err'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const vReportStatus = v.union(
  v.literal('pending'),
  v.literal('ok'),
  v.literal('err'),
);

// ---------------------------------------------------------------------------
// Dashboard time-window vocabulary. The pill control in the UI sends one of
// these strings; queries narrow on it to compute the window-start timestamp.
// ---------------------------------------------------------------------------
export const TIME_WINDOWS = ['7d', '30d', '90d', 'all'] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const vTimeWindow = v.union(
  v.literal('7d'),
  v.literal('30d'),
  v.literal('90d'),
  v.literal('all'),
);

// ---------------------------------------------------------------------------
// ConvexError payload kinds. Centralized so every thrower / catcher
// references the same union. Add a new kind here before throwing it.
// ---------------------------------------------------------------------------
export const ERROR_KINDS = [
  // auth
  'not_authenticated',
  'email_taken',
  'email_not_allowlisted',
  // sessions
  'session_not_found',
  'not_session_owner',
  'gym_not_found',
  'invalid_effort',
  'invalid_attempts_empty',
  'invalid_attempt_count',
  'invalid_grade',
  'invalid_outcome',
  'future_date',
  // follows
  'self_follow',
  'already_following',
  'not_following',
  // summarize
  'summary_retry_rate_limited',
  // reports
  'sidecar_unreachable',
  'sidecar_bad_response',
  'sidecar_unauthorized',
  // seed
  'production_deployment_blocked',
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];
