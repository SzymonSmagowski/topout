import { CalendarDays, Clock, MapPin, Pencil, Trash2 } from 'lucide-react';

import { isSent, type Outcome, V_GRADES, type VGrade } from '@/lib/grades';

import { GradePill } from '@/components/GradePill';
import { SummaryBanner } from '@/components/SummaryBanner';

import { gymName, MY_SESSIONS, type MockSession } from '../_data/mock';
import { SectionHeader } from './SectionHeader';

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function topGrade(session: MockSession): VGrade | null {
  const sends = session.attempts.filter((a) => isSent(a.outcome)).map((a) => a.grade);
  if (sends.length === 0) return null;
  return sends.sort((a, b) => V_GRADES.indexOf(b) - V_GRADES.indexOf(a))[0] ?? null;
}

function sendCount(session: MockSession): number {
  return session.attempts.filter((a) => isSent(a.outcome)).length;
}

function attemptTotal(session: MockSession): number {
  return session.attempts.reduce((acc, a) => acc + a.attemptCount, 0);
}

const OUTCOME_TINT: Readonly<Record<Outcome, string>> = {
  flash: 'oklch(0.62 0.13 145 / 0.16)',
  send: 'oklch(0.62 0.13 145 / 0.1)',
  repeat: 'oklch(0.78 0.13 80 / 0.12)',
  project: 'oklch(0.55 0.022 60 / 0.12)',
  fall: 'oklch(0.55 0.21 27 / 0.12)',
};

export function SessionsSection() {
  const detail = MY_SESSIONS[0];
  if (!detail) throw new Error('Mock data missing: MY_SESSIONS[0]');

  return (
    <section className="space-y-6">
      <SectionHeader
        id="sessions"
        eyebrow="02b · sessions — list + detail"
        title="Every session as a glanceable card. One click for full detail."
        description={
          <>
            Reverse-chronological list reads at a glance: date, gym, top grade, send count, total
            attempts, perceived effort, plus the first sentence of the coach summary (italicized).
            The detail panel shows the full summary banner with all three states (
            <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">ok</code>,{' '}
            <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">pending</code>
            ,{' '}
            <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">err</code>) so
            you can sanity-check the discriminated-union UI in one screen.
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent sessions</h3>
            <span className="text-xs text-[color:var(--color-text-muted)]">{MY_SESSIONS.length} shown</span>
          </div>
          <ul className="space-y-3">
            {MY_SESSIONS.map((session) => {
              const top = topGrade(session);
              return (
                <li
                  key={session.id}
                  className="card transition hover:shadow-[var(--shadow-card-hover)]"
                >
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <div className="flex shrink-0 flex-col items-start gap-1.5">
                      <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        {formatDate(session.dateIso)}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-[color:var(--color-text-muted)]">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {gymName(session.gymId)}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {top ? <GradePill grade={top} /> : <span className="chip">no send</span>}
                        <span className="text-xs text-[color:var(--color-text-muted)]">top</span>
                      </div>
                      <Sep />
                      <Stat n={sendCount(session)} unit="sends" />
                      <Sep />
                      <Stat n={attemptTotal(session)} unit="attempts" />
                      <Sep />
                      <Stat n={session.perceivedEffort} unit={`/10 effort`} />
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost h-8 shrink-0 text-xs"
                      aria-label="View detail"
                    >
                      View
                    </button>
                  </div>
                  {session.summary.kind === 'ok' && (
                    <p
                      className="border-t hairline px-4 py-2 text-xs italic text-[color:var(--color-text-muted)]"
                    >
                      “{session.summary.text.split(/(?<=[.!?])\s/)[0]}”
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Detail */}
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b hairline px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="section-eyebrow">session · detail</div>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">
                    {formatDate(detail.dateIso)} · {gymName(detail.gymId)}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="btn btn-ghost h-8 text-xs">
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </button>
                  <button type="button" className="btn btn-danger h-8 text-xs">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Meta icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />} label="Date" value={formatDate(detail.dateIso)} />
                <Meta icon={<Clock className="h-3.5 w-3.5" aria-hidden />} label="Duration" value={detail.durationMinutes ? `${detail.durationMinutes}m` : '—'} />
                <Meta label="Effort" value={`${detail.perceivedEffort}/10`} mono />
                <Meta
                  label="Sends / attempts"
                  value={`${sendCount(detail)} / ${attemptTotal(detail)}`}
                  mono
                />
              </dl>
            </div>

            <div className="p-5">
              <SummaryBanner state={detail.summary} />
            </div>

            {detail.notes && (
              <div className="border-t hairline px-5 py-3">
                <div className="section-eyebrow">your notes</div>
                <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{detail.notes}</p>
              </div>
            )}

            <div className="border-t hairline">
              <div className="flex items-center justify-between px-5 py-3">
                <h4 className="text-sm font-semibold">Attempts</h4>
                <span className="text-xs text-[color:var(--color-text-muted)]">
                  Grouped by grade · {detail.attempts.length} entries
                </span>
              </div>
              <ul>
                {[...detail.attempts]
                  .sort((a, b) => V_GRADES.indexOf(b.grade) - V_GRADES.indexOf(a.grade))
                  .map((a, idx) => (
                    <li
                      key={`${a.grade}-${idx}`}
                      className="flex items-start gap-3 border-t hairline px-5 py-3"
                      style={{ backgroundColor: OUTCOME_TINT[a.outcome] }}
                    >
                      <GradePill grade={a.grade} />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-baseline gap-2 text-sm">
                          <span className="font-medium text-[color:var(--color-text)]">
                            {a.outcome.charAt(0).toUpperCase() + a.outcome.slice(1)}
                          </span>
                          <span className="font-mono text-xs text-[color:var(--color-text-muted)] tabular-nums">
                            ×{a.attemptCount}
                          </span>
                        </div>
                        {a.note && (
                          <p className="mt-0.5 text-xs text-[color:var(--color-text-muted)]">{a.note}</p>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>

          {/* Three summary states demo */}
          <div className="space-y-3">
            <div className="section-eyebrow">summary banner · three states</div>
            <SummaryBanner state={{ kind: 'pending' }} compact />
            <SummaryBanner
              state={{
                kind: 'ok',
                text: 'Strong V4–V5 evening — your first V5 of the year is right on trend with the past month’s send rate climb.',
              }}
              compact
            />
            <SummaryBanner
              state={{ kind: 'err', message: 'Rate limited by OpenAI (429). Retry in a few seconds.' }}
              compact
            />
          </div>
        </div>
      </div>
    </section>
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

function Meta({
  icon,
  label,
  value,
  mono,
}: {
  readonly icon?: React.ReactNode;
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {icon}
        {label}
      </dt>
      <dd className={mono ? 'mt-1 font-mono text-sm tabular-nums' : 'mt-1 text-sm'}>{value}</dd>
    </div>
  );
}
