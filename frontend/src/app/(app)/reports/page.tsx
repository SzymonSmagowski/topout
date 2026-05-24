'use client';

import { useAction, useQuery } from 'convex/react';
import { ChevronRight, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@convex/_generated/api';

import { SidecarHealthBanner } from '@/components/SidecarHealthBanner';

function weekStartMondayMs(now: number = Date.now()): number {
  const d = new Date(now);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utc).getUTCDay(); // 0 = Sun
  const diff = (day + 6) % 7; // days since Monday
  return utc - diff * 86_400_000;
}

function formatRange(weekStart: number, weekEnd: number): string {
  const start = new Date(weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const end = new Date(weekEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${start} – ${end}`;
}

function snippet(md: string | null): string {
  if (!md) return '';
  const lines = md.split('\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('-'));
  return (lines[0] ?? '').replace(/\*\*/g, '').slice(0, 160);
}

export default function ReportsPage() {
  const router = useRouter();
  const reports = useQuery(api.reports.listReports, {});
  const generate = useAction(api.reportsActions.generateReport);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const result = await generate({ weekStart: weekStartMondayMs() });
      router.push(`/reports/${result.reportId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't start generation: ${err.message}`
          : "Couldn't start generation.",
      );
      setGenerating(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <div className="section-eyebrow">topout · reports</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Weekly coaching reports</h1>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
          Python sidecar runs the 3-node LangGraph topology. Markdown narrative + stats.
        </p>
      </header>

      <SidecarHealthBanner
        action={
          <button
            type="button"
            className="btn btn-primary h-9 text-xs"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Generate this week&rsquo;s report
              </>
            )}
          </button>
        }
      />

      {generating && (
        <div className="card p-5 text-sm text-[color:var(--color-text-muted)]">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
          The Python sidecar is analysing your week. This usually takes 10–30 seconds.
        </div>
      )}

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

      <section>
        <h2 className="mb-3 text-sm font-semibold">Past reports</h2>
        {reports === undefined ? (
          <ul className="space-y-3">
            {[0, 1].map((i) => (
              <li key={i} className="card p-4">
                <div className="skeleton h-3 w-32" />
                <div className="mt-3 skeleton h-12 w-full" />
              </li>
            ))}
          </ul>
        ) : reports.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-[color:var(--color-text-muted)]">
              No reports yet. Generate one for this week to start.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r._id}>
                <Link
                  href={`/reports/${r._id}`}
                  className="card block p-4 transition hover:shadow-[var(--shadow-card-hover)]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      {formatRange(r.weekStart, r.weekEnd)}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-[color:var(--color-text)]">
                    {r.status === 'pending'
                      ? 'Generating coaching narrative…'
                      : r.status === 'err'
                        ? `Error: ${r.error ?? 'unknown'}`
                        : snippet(r.narrativeMd)}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
                    <ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}

function StatusBadge({ status }: { readonly status: 'pending' | 'ok' | 'err' }) {
  const color =
    status === 'ok'
      ? 'var(--color-success)'
      : status === 'pending'
        ? 'var(--color-warn)'
        : 'var(--color-danger)';
  return (
    <span className="chip">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {status}
    </span>
  );
}
