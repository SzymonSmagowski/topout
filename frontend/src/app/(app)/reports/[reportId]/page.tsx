'use client';

import { useAction, useQuery } from 'convex/react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { use, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';

import { ConfirmModal } from '@/components/ConfirmModal';

interface ReportDetailPageProps {
  readonly params: Promise<{ readonly reportId: string }>;
}

interface ReportStats {
  readonly sends_count: number;
  readonly top_grade: string | null;
  readonly send_rate: number;
  readonly total_attempts: number;
  readonly gyms_visited: number;
  readonly longest_send_streak: number;
  readonly send_rate_delta_prev_week: number;
  readonly send_rate_delta_baseline: number;
  readonly top_grade_delta: number;
}

function parseStats(json: string | null): ReportStats | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as ReportStats;
  } catch {
    return null;
  }
}

function formatRange(weekStart: number, weekEnd: number): string {
  const start = new Date(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const end = new Date(weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${start} – ${end}`;
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { reportId } = use(params);
  const typedId = reportId as Id<'weeklyReports'>;
  const report = useQuery(api.reports.getReport, { reportId: typedId });
  const generate = useAction(api.reportsActions.generateReport);
  const [showRegen, setShowRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (report === undefined) {
    return (
      <div className="card p-6">
        <div className="skeleton h-6 w-2/3" />
        <div className="mt-4 skeleton h-32 w-full" />
      </div>
    );
  }

  if (report === null) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-[color:var(--color-text-muted)]">Report not found.</p>
      </div>
    );
  }

  const onRegenerate = async () => {
    setError(null);
    setRegenerating(true);
    try {
      await generate({ weekStart: report.weekStart });
      setShowRegen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regenerate failed.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <div className="section-eyebrow">topout · weekly report</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {formatRange(report.weekStart, report.weekEnd)}
        </h1>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-md border px-3 py-2 text-xs"
          style={{
            backgroundColor: 'oklch(from var(--color-danger) l c h / 0.08)',
            borderColor: 'oklch(from var(--color-danger) l c h / 0.4)',
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}

      {report.status === 'pending' && <PendingCard />}

      {report.status === 'err' && (
        <ErrorCard
          message={report.error ?? 'Unknown error'}
          onRetry={onRegenerate}
          retrying={regenerating}
        />
      )}

      {report.status === 'ok' && (
        <OkCard
          report={report}
          onRegenerate={() => setShowRegen(true)}
        />
      )}

      <ConfirmModal
        open={showRegen}
        title="Regenerate this report?"
        description="This will overwrite the current narrative with a fresh one."
        confirmLabel="Regenerate"
        busy={regenerating}
        onConfirm={onRegenerate}
        onCancel={() => setShowRegen(false)}
      />
    </section>
  );
}

function PendingCard() {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[color:var(--color-accent)]" aria-hidden />
        <div>
          <div className="text-base font-semibold">Generating coaching narrative…</div>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            The Python sidecar is running the LangGraph pipeline. Usually 10–30s.
          </p>
        </div>
      </div>
      <div className="mt-6 space-y-2">
        <div className="skeleton h-3 w-3/4" />
        <div className="skeleton h-3 w-11/12" />
        <div className="skeleton h-3 w-2/3" />
      </div>
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
  retrying,
}: {
  readonly message: string;
  readonly onRetry: () => void;
  readonly retrying: boolean;
}) {
  return (
    <div
      className="card flex items-start gap-3 p-6"
      role="alert"
      style={{
        backgroundColor: 'oklch(from var(--color-danger) l c h / 0.05)',
        borderColor: 'oklch(from var(--color-danger) l c h / 0.35)',
      }}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--color-danger)]" aria-hidden />
      <div className="flex-1">
        <div className="text-base font-semibold">Couldn&rsquo;t generate report</div>
        <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{message}</p>
        <p className="mt-2 text-xs text-[color:var(--color-text-muted)]">
          The Python sidecar may not be running. Start it with{' '}
          <code className="font-mono">./apps/topout/dev.sh</code>.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-secondary h-9 text-xs"
        onClick={onRetry}
        disabled={retrying}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden />
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  );
}

function OkCard({
  report,
  onRegenerate,
}: {
  readonly report: Doc<'weeklyReports'>;
  readonly onRegenerate: () => void;
}) {
  const stats = parseStats(report.statsJson);

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="text-xs text-[color:var(--color-text-muted)]">
            Generated {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '—'}
          </div>
        </div>
        <button type="button" className="btn btn-secondary h-9 text-xs" onClick={onRegenerate}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Regenerate
        </button>
      </div>

      {stats && (
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBlock label="Sends" value={stats.sends_count.toString()} />
          <StatBlock label="Top grade" value={stats.top_grade ?? '—'} />
          <StatBlock
            label="Send rate"
            value={`${Math.round(stats.send_rate * 100)}%`}
            delta={stats.send_rate_delta_prev_week}
          />
          <StatBlock label="Attempts" value={stats.total_attempts.toString()} />
        </dl>
      )}

      <hr className="my-6 hairline" />

      <article className="prose-report">
        <ReactMarkdown>{report.narrativeMd ?? ''}</ReactMarkdown>
      </article>

      <div className="mt-6 border-t hairline pt-4 text-xs text-[color:var(--color-text-muted)]">
        Generated by <code className="font-mono">{report.model ?? 'unknown'}</code> via LangGraph
      </div>
    </div>
  );
}

interface StatBlockProps {
  readonly label: string;
  readonly value: string;
  readonly delta?: number;
}

function StatBlock({ label, value, delta }: StatBlockProps) {
  const up = (delta ?? 0) > 0;
  const down = (delta ?? 0) < 0;
  return (
    <div className="card-inset px-3 py-3">
      <div className="text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl tabular-nums">{value}</div>
      {delta !== undefined && (
        <div
          className="mt-0.5 text-[0.6875rem] font-medium"
          style={{
            color: up
              ? 'var(--color-success)'
              : down
                ? 'var(--color-danger)'
                : 'var(--color-text-muted)',
          }}
        >
          {up ? '+' : ''}
          {Math.round(delta * 100)} pts vs prev week
        </div>
      )}
    </div>
  );
}
