import { OUTCOME_LABEL, type Outcome, type VGrade } from '@/lib/grades';

import { GradePill } from './GradePill';
import { outcomeTint } from './OutcomePill';

interface AttemptRowProps {
  readonly grade: VGrade;
  readonly outcome: Outcome;
  readonly attemptCount: number;
  readonly notes?: string;
}

export function AttemptRow({ grade, outcome, attemptCount, notes }: AttemptRowProps) {
  return (
    <li
      className="flex items-start gap-3 border-t hairline px-5 py-3"
      style={{ backgroundColor: outcomeTint[outcome] }}
    >
      <GradePill grade={grade} />
      <div className="flex-1">
        <div className="flex flex-wrap items-baseline gap-2 text-sm">
          <span className="font-medium text-[color:var(--color-text)]">{OUTCOME_LABEL[outcome]}</span>
          <span className="font-mono text-xs text-[color:var(--color-text-muted)] tabular-nums">
            ×{attemptCount}
          </span>
        </div>
        {notes && (
          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">{notes}</p>
        )}
      </div>
    </li>
  );
}
