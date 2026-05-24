/**
 * V-scale grade vocabulary — single source of truth.
 *
 * The brief locks bouldering V-scale only (manifest cross-cutting: "V-scale only;
 * no Font or YDS conversion"). The string literal union must match the Convex
 * validator one-for-one; do not derive one from the other at runtime.
 */
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

/** Ordinal position used by charts + color ramp lookup. VB = 0, V0 = 1, V1 = 2, ... */
export function gradeOrdinal(grade: VGrade): number {
  return V_GRADES.indexOf(grade);
}

export const OUTCOMES = ['flash', 'send', 'repeat', 'project', 'fall'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Outcomes that "count as a send" for the send pyramid + send-rate trend. */
export const SENT_OUTCOMES = ['flash', 'send', 'repeat'] as const satisfies readonly Outcome[];
export type SentOutcome = (typeof SENT_OUTCOMES)[number];

export function isSent(outcome: Outcome): outcome is SentOutcome {
  return (SENT_OUTCOMES as readonly Outcome[]).includes(outcome);
}

export const OUTCOME_LABEL: Readonly<Record<Outcome, string>> = {
  flash: 'Flash',
  send: 'Send',
  repeat: 'Repeat',
  project: 'Project',
  fall: 'Fall',
};
