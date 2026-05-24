import { OUTCOME_LABEL, type Outcome } from '@/lib/grades';

interface OutcomePillProps {
  readonly outcome: Outcome;
}

const TINT: Readonly<Record<Outcome, string>> = {
  flash: 'oklch(0.62 0.13 145 / 0.16)',
  send: 'oklch(0.62 0.13 145 / 0.1)',
  repeat: 'oklch(0.78 0.13 80 / 0.12)',
  project: 'oklch(0.55 0.022 60 / 0.12)',
  fall: 'oklch(0.55 0.21 27 / 0.12)',
};

export function OutcomePill({ outcome }: OutcomePillProps) {
  return (
    <span
      className="inline-flex h-5 items-center rounded-full px-2 text-[0.6875rem] font-medium text-[color:var(--color-text)]"
      style={{ backgroundColor: TINT[outcome] }}
    >
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}

export { TINT as outcomeTint };
