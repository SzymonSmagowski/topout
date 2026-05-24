/**
 * Single-source-of-truth grade color scale.
 *
 * The dashboard, session list, log form, and weekly report all read from this
 * file. NEVER inline a `bg-sienna-500` for a grade pill — always go through
 * `gradeStyle(grade)` or `gradeColor(grade, theme)` so the scale stays coherent.
 *
 * The scale walks the `--color-sienna-*` ramp in globals.css.
 * Light theme uses light-tinted backgrounds with deep text;
 * dark theme uses deep backgrounds with light text — both keep WCAG AA contrast.
 */
import type { VGrade } from './grades';
import { gradeOrdinal, V_GRADES } from './grades';

/** Tailwind utility tuples per grade band — works in both themes. */
export interface GradeStyle {
  /** Background + text + border classes for a grade chip / bar. */
  readonly chip: string;
  /** Just the fill color (used inline for chart bars). */
  readonly fill: string;
  /** Just the stroke color (used for line charts). */
  readonly stroke: string;
}

/**
 * The 19 V-grades (VB..V17) are bucketed into 9 color stops along the sienna
 * ramp. Lower grades = lighter sienna, higher grades = deeper sienna.
 * Buckets are: VB, V0–V1, V2, V3, V4, V5, V6, V7, V8+ (V8..V17 share the deepest stop).
 */
const STOPS: readonly { readonly fill: string; readonly stroke: string; readonly chip: string }[] = [
  // VB
  {
    fill: 'var(--color-sienna-100)',
    stroke: 'var(--color-sienna-400)',
    chip: 'bg-[color:var(--color-sienna-100)] text-[color:var(--color-sienna-900)] border-[color:var(--color-sienna-200)] dark:bg-[color:var(--color-sienna-900)]/40 dark:text-[color:var(--color-sienna-100)] dark:border-[color:var(--color-sienna-800)]',
  },
  // V0..V1
  {
    fill: 'var(--color-sienna-200)',
    stroke: 'var(--color-sienna-500)',
    chip: 'bg-[color:var(--color-sienna-200)] text-[color:var(--color-sienna-900)] border-[color:var(--color-sienna-300)] dark:bg-[color:var(--color-sienna-900)]/55 dark:text-[color:var(--color-sienna-100)] dark:border-[color:var(--color-sienna-800)]',
  },
  // V2
  {
    fill: 'var(--color-sienna-300)',
    stroke: 'var(--color-sienna-600)',
    chip: 'bg-[color:var(--color-sienna-300)] text-[color:var(--color-sienna-950)] border-[color:var(--color-sienna-400)] dark:bg-[color:var(--color-sienna-800)]/70 dark:text-[color:var(--color-sienna-50)] dark:border-[color:var(--color-sienna-700)]',
  },
  // V3
  {
    fill: 'var(--color-sienna-400)',
    stroke: 'var(--color-sienna-600)',
    chip: 'bg-[color:var(--color-sienna-400)] text-[color:var(--color-sienna-950)] border-[color:var(--color-sienna-500)] dark:bg-[color:var(--color-sienna-700)]/80 dark:text-[color:var(--color-sienna-50)] dark:border-[color:var(--color-sienna-600)]',
  },
  // V4
  {
    fill: 'var(--color-sienna-500)',
    stroke: 'var(--color-sienna-700)',
    chip: 'bg-[color:var(--color-sienna-500)] text-[color:var(--color-sienna-50)] border-[color:var(--color-sienna-600)] dark:bg-[color:var(--color-sienna-600)] dark:text-[color:var(--color-sienna-50)] dark:border-[color:var(--color-sienna-500)]',
  },
  // V5
  {
    fill: 'var(--color-sienna-600)',
    stroke: 'var(--color-sienna-800)',
    chip: 'bg-[color:var(--color-sienna-600)] text-[color:var(--color-sienna-50)] border-[color:var(--color-sienna-700)] dark:bg-[color:var(--color-sienna-500)] dark:text-[color:var(--color-sienna-50)] dark:border-[color:var(--color-sienna-400)]',
  },
  // V6
  {
    fill: 'var(--color-sienna-700)',
    stroke: 'var(--color-sienna-900)',
    chip: 'bg-[color:var(--color-sienna-700)] text-[color:var(--color-sienna-50)] border-[color:var(--color-sienna-800)] dark:bg-[color:var(--color-sienna-400)] dark:text-[color:var(--color-sienna-950)] dark:border-[color:var(--color-sienna-300)]',
  },
  // V7
  {
    fill: 'var(--color-sienna-800)',
    stroke: 'var(--color-sienna-950)',
    chip: 'bg-[color:var(--color-sienna-800)] text-[color:var(--color-sienna-50)] border-[color:var(--color-sienna-900)] dark:bg-[color:var(--color-sienna-300)] dark:text-[color:var(--color-sienna-950)] dark:border-[color:var(--color-sienna-200)]',
  },
  // V8+
  {
    fill: 'var(--color-sienna-900)',
    stroke: 'var(--color-sienna-950)',
    chip: 'bg-[color:var(--color-sienna-900)] text-[color:var(--color-sienna-50)] border-[color:var(--color-sienna-950)] dark:bg-[color:var(--color-sienna-200)] dark:text-[color:var(--color-sienna-950)] dark:border-[color:var(--color-sienna-100)]',
  },
];

function bucketIndex(grade: VGrade): number {
  const ord = gradeOrdinal(grade); // VB=0, V0=1, V1=2, V2=3, V3=4, V4=5, V5=6, V6=7, V7=8, V8+=9..18
  if (ord <= 0) return 0; // VB
  if (ord <= 2) return 1; // V0, V1
  if (ord <= 3) return 2; // V2
  if (ord <= 4) return 3; // V3
  if (ord <= 5) return 4; // V4
  if (ord <= 6) return 5; // V5
  if (ord <= 7) return 6; // V6
  if (ord <= 8) return 7; // V7
  return 8; // V8 and beyond
}

export function gradeStyle(grade: VGrade): GradeStyle {
  const idx = bucketIndex(grade);
  const stop = STOPS[idx];
  // Guard for noUncheckedIndexedAccess. bucketIndex is total over 0..8 and STOPS.length === 9,
  // but we'd rather fail loudly than ship `undefined` styles.
  if (!stop) {
    throw new Error(`gradeStyle: missing stop for grade ${grade} (bucket ${idx})`);
  }
  return stop;
}

/** Inline-style helper for the .grade-pill component class. */
export function gradePillVars(grade: VGrade): React.CSSProperties {
  const s = gradeStyle(grade);
  return {
    ['--grade-bg' as string]: s.fill,
    ['--grade-fg' as string]: bucketIndex(grade) >= 4 ? 'var(--color-sienna-50)' : 'var(--color-sienna-950)',
    ['--grade-border' as string]: s.stroke,
  };
}

/** All grades, useful when you want to render a legend or color swatches. */
export const ALL_GRADES = V_GRADES;
