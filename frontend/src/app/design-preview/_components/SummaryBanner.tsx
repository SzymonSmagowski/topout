import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';

import type { SummaryState } from '../_data/mock';

interface SummaryBannerProps {
  readonly state: SummaryState;
  readonly compact?: boolean;
}

/**
 * The discriminated-union state from `summarize-session` rendered three ways.
 * Pending = shimmering skeleton. Ok = coach blurb in an accent-tinted card.
 * Err = error card with retry button.
 */
export function SummaryBanner({ state, compact = false }: SummaryBannerProps) {
  if (state.kind === 'pending') {
    return (
      <div
        className="card flex items-center gap-4 p-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-2)]">
          <Sparkles className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />
        </div>
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton h-3 w-11/12" />
          {!compact && <div className="skeleton h-3 w-3/4" />}
        </div>
        <span className="hidden sm:inline text-xs text-[color:var(--color-text-muted)]">
          Generating coach summary…
        </span>
      </div>
    );
  }

  if (state.kind === 'err') {
    return (
      <div
        className="card flex items-start gap-3 p-4"
        role="alert"
        style={{
          backgroundColor: 'oklch(from var(--color-danger) l c h / 0.05)',
          borderColor: 'oklch(from var(--color-danger) l c h / 0.35)',
        }}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-danger)]" aria-hidden />
        <div className="flex-1">
          <div className="text-sm font-medium text-[color:var(--color-text)]">Couldn’t generate summary</div>
          <div className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">{state.message}</div>
        </div>
        <button type="button" className="btn btn-secondary h-8 text-xs">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="card flex items-start gap-3 p-4"
      style={{
        backgroundImage:
          'linear-gradient(135deg, oklch(from var(--color-accent) l c h / 0.06), transparent 70%)',
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'oklch(from var(--color-accent) l c h / 0.16)' }}
      >
        <Sparkles className="h-4 w-4 text-[color:var(--color-accent)]" aria-hidden />
      </div>
      <div className="flex-1">
        <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[color:var(--color-accent)]">
          Coach summary
        </div>
        <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-text)]">{state.text}</p>
      </div>
    </div>
  );
}
