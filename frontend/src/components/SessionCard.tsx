'use client';

import { MapPin } from 'lucide-react';
import Link from 'next/link';

import type { VGrade } from '@/lib/grades';

import { GradePill } from './GradePill';

interface SessionCardProps {
  readonly href: string;
  readonly date: number;
  readonly gymName: string;
  readonly topGrade: VGrade | null;
  readonly sendCount: number;
  readonly attemptTotal: number;
  readonly perceivedEffort: number;
  readonly summarySnippet: string | null;
}

export function SessionCard({
  href,
  date,
  gymName,
  topGrade,
  sendCount,
  attemptTotal,
  perceivedEffort,
  summarySnippet,
}: SessionCardProps) {
  return (
    <li className="card transition hover:shadow-[var(--shadow-card-hover)]">
      <Link href={href} className="block">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-start gap-1.5">
            <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              {formatSessionDate(date)}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-text-muted)]">
              <MapPin className="h-3 w-3" aria-hidden />
              {gymName}
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {topGrade ? <GradePill grade={topGrade} /> : <span className="chip">no send</span>}
              <span className="text-xs text-[color:var(--color-text-muted)]">top</span>
            </div>
            <Sep />
            <Stat n={sendCount} unit="sends" />
            <Sep />
            <Stat n={attemptTotal} unit="attempts" />
            <Sep />
            <Stat n={perceivedEffort} unit="/10 effort" />
          </div>

          <span className="btn btn-ghost h-8 shrink-0 text-xs" aria-hidden>
            View
          </span>
        </div>
      </Link>
      {summarySnippet && (
        <p className="border-t hairline px-4 py-2 text-xs italic text-[color:var(--color-text-muted)]">
          “{summarySnippet}”
        </p>
      )}
    </li>
  );
}

function Stat({ n, unit }: { readonly n: number; readonly unit: string }) {
  return (
    <span className="text-sm">
      <span className="font-mono font-medium tabular-nums">{n}</span>{' '}
      <span className="text-xs text-[color:var(--color-text-muted)]">{unit}</span>
    </span>
  );
}

function Sep() {
  return <span aria-hidden className="h-3 w-px bg-[color:var(--color-hairline)]" />;
}

export function formatSessionDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function firstSentence(text: string): string {
  const parts = text.split(/(?<=[.!?])\s/);
  return parts[0] ?? text;
}
