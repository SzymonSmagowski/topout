'use client';

import { AlertOctagon, ChevronRight, RefreshCw, Server, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useState } from 'react';

import { GradePill } from './GradePill';
import { REPORTS, type MockReport } from '../_data/mock';
import { SectionHeader } from './SectionHeader';

export function ReportsSection() {
  const initial = REPORTS[0];
  if (!initial) throw new Error('Mock data missing: REPORTS[0]');

  const [selected, setSelected] = useState<MockReport>(initial);
  const [sidecarUp] = useState(true);

  return (
    <section className="space-y-6">
      <SectionHeader
        id="reports"
        eyebrow="05 · weekly-report"
        title="Python sidecar writes the coaching narrative. Convex stores it."
        description={
          <>
            Each report row is keyed by <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">(userId, weekStart)</code>; regenerating overwrites. The narrative is rendered markdown, computed by a 3-node LangGraph topology: <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">load_payload → analyze_stats → synthesize_narrative</code>. The stats card to the right pulls from <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">statsJson</code> on the same row.
          </>
        }
      />

      {/* Sidecar status banner */}
      <div
        className={`card flex flex-wrap items-center gap-3 p-3 ${sidecarUp ? '' : ''}`}
        style={
          sidecarUp
            ? undefined
            : {
                backgroundColor: 'oklch(from var(--color-warn) l c h / 0.1)',
                borderColor: 'oklch(from var(--color-warn) l c h / 0.4)',
              }
        }
      >
        <Server className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />
        <span className="text-xs text-[color:var(--color-text)]">
          Python sidecar{' '}
          <code className="rounded bg-[color:var(--color-surface-2)] px-1 font-mono">localhost:8002</code> —{' '}
          {sidecarUp ? (
            <>
              <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-success)]" aria-hidden />{' '}
              healthy · gpt-5.4-nano
            </>
          ) : (
            <>
              <AlertOctagon className="inline h-3 w-3 text-[color:var(--color-warn)]" aria-hidden /> not detected — run <code className="font-mono">./apps/topout/dev.sh</code>
            </>
          )}
        </span>
        <button type="button" className="ml-auto btn btn-primary h-8 text-xs">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Generate this week’s report
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* Reports list */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Past reports</h3>
          <ul className="space-y-3">
            {REPORTS.map((r) => {
              const isActive = r.id === selected.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className={`card w-full p-4 text-left transition hover:shadow-[var(--shadow-card-hover)] ${
                      isActive ? '' : ''
                    }`}
                    style={
                      isActive
                        ? {
                            borderColor: 'var(--color-accent)',
                            boxShadow:
                              '0 0 0 3px oklch(from var(--color-accent) l c h / 0.18), var(--shadow-card)',
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        {formatRange(r.weekStart, r.weekEnd)}
                      </span>
                      <span className="chip">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: 'var(--color-success)' }}
                          aria-hidden
                        />
                        ok
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-[color:var(--color-text)]">
                      {snippet(r.narrativeMd)}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
                      <GradePill grade={r.stats.topGrade} size="sm" />
                      <span className="font-mono tabular-nums">{r.stats.sends} sends</span>
                      <span aria-hidden>·</span>
                      <span className="font-mono tabular-nums">{Math.round(r.stats.sendRate * 100)}%</span>
                      <ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Selected report detail */}
        <div id="report-detail" className="space-y-4 scroll-mt-24">
          <div className="card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <div className="section-eyebrow">weekly report</div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight">
                  {formatRange(selected.weekStart, selected.weekEnd)}
                </h3>
              </div>
              <button type="button" className="btn btn-secondary h-9 text-xs">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Regenerate
              </button>
            </div>

            {/* Stats card */}
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBlock label="Sends" value={selected.stats.sends.toString()} />
              <StatBlock label="Top grade" value={selected.stats.topGrade} mono />
              <StatBlock
                label="Send rate"
                value={`${Math.round(selected.stats.sendRate * 100)}%`}
                delta={selected.stats.sendRateDelta}
              />
              <StatBlock label="Attempts" value={selected.stats.attempts.toString()} />
            </dl>

            <hr className="my-6 hairline" />

            <article className="prose-report">
              <ReactMarkdown>{selected.narrativeMd}</ReactMarkdown>
            </article>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t hairline pt-4 text-xs text-[color:var(--color-text-muted)]">
              <span>
                Generated by <code className="font-mono">gpt-5.4-nano</code> via LangGraph · 12s · 2,914 input · 482 output tokens
              </span>
              <span>Markdown only · PDF export not in v1</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function snippet(md: string): string {
  // Strip headings + first paragraph
  const lines = md.split('\n').filter((l) => l && !l.startsWith('#') && !l.startsWith('-'));
  return lines[0]?.replace(/\*\*/g, '').slice(0, 160) ?? '';
}

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T12:00:00Z`);
  const end = new Date(`${endIso}T12:00:00Z`);
  const startStr = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${startStr} – ${endStr}`;
}

interface StatBlockProps {
  readonly label: string;
  readonly value: string;
  readonly delta?: number;
  readonly mono?: boolean;
}

function StatBlock({ label, value, delta, mono }: StatBlockProps) {
  const up = (delta ?? 0) > 0;
  const down = (delta ?? 0) < 0;
  return (
    <div className="card-inset px-3 py-3">
      <div className="text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </div>
      <div className={`mt-1 font-mono text-xl tabular-nums ${mono ? '' : ''}`}>{value}</div>
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
