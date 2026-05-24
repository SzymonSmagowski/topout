'use client';

import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { OUTCOME_LABEL, OUTCOMES, V_GRADES, type Outcome, type VGrade } from '@/lib/grades';

import { GradePill } from '@/components/GradePill';

import { GYMS } from '../_data/mock';
import { SectionHeader } from './SectionHeader';

interface DraftAttempt {
  readonly key: string;
  readonly grade: VGrade;
  readonly outcome: Outcome;
  readonly attemptCount: number;
  readonly note: string;
}

const INITIAL_ATTEMPTS: readonly DraftAttempt[] = [
  { key: 'a1', grade: 'V1', outcome: 'flash', attemptCount: 1, note: '' },
  { key: 'a2', grade: 'V3', outcome: 'send', attemptCount: 2, note: '' },
  { key: 'a3', grade: 'V4', outcome: 'send', attemptCount: 3, note: 'felt locked in on the heel hook' },
  { key: 'a4', grade: 'V5', outcome: 'project', attemptCount: 5, note: 'stuck at the crux move' },
];

export function LogSessionSection() {
  const [attempts, setAttempts] = useState<readonly DraftAttempt[]>(INITIAL_ATTEMPTS);
  const [effort, setEffort] = useState(8);
  const effortId = useId();

  const addAttempt = () => {
    setAttempts((prev) => [
      ...prev,
      {
        key: `a${prev.length + 1}-${Math.random().toString(36).slice(2, 6)}`,
        grade: 'V3',
        outcome: 'send',
        attemptCount: 1,
        note: '',
      },
    ]);
  };

  const removeAttempt = (key: string) => {
    setAttempts((prev) => (prev.length <= 1 ? prev : prev.filter((a) => a.key !== key)));
  };

  const updateAttempt = (key: string, patch: Partial<Omit<DraftAttempt, 'key'>>) => {
    setAttempts((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  };

  return (
    <section className="space-y-6">
      <SectionHeader
        id="log-session"
        eyebrow="02a · sessions — log form"
        title="One screen, every attempt"
        description={
          <>
            The log form is the highest-friction surface in the app, so it has to feel guidebook-fast:
            metadata up top, then a dense attempts list with grade pills and outcome buttons that are
            tappable at the gym. Submit writes the session + attempts in one atomic Convex mutation
            and schedules the AI summary action.
          </>
        }
      />

      <form
        className="card grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_minmax(0,360px)]"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="session-date" className="label">
                Date
              </label>
              <input
                id="session-date"
                type="date"
                className="input font-mono"
                defaultValue="2026-05-24"
                max="2026-05-24"
              />
            </div>
            <div>
              <label htmlFor="session-gym" className="label">
                Gym
              </label>
              <input
                id="session-gym"
                type="text"
                className="input"
                list="gym-list"
                defaultValue="The Climbing Hangar"
                placeholder="Type to search or create..."
              />
              <datalist id="gym-list">
                {GYMS.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.city}
                  </option>
                ))}
              </datalist>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
                12 sessions here · prefix-matched. Type a new name to create.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor={effortId} className="label !mb-0">
                Perceived effort
              </label>
              <span className="font-mono text-sm tabular-nums text-[color:var(--color-text)]">
                {effort}<span className="text-[color:var(--color-text-muted)]">/10</span>
              </span>
            </div>
            <input
              id={effortId}
              type="range"
              min={1}
              max={10}
              step={1}
              value={effort}
              onChange={(e) => setEffort(Number(e.target.value))}
              className="mt-2 w-full accent-[color:var(--color-accent)]"
            />
            <div className="mt-1 flex justify-between text-[0.6875rem] text-[color:var(--color-text-muted)]">
              <span>recovery</span>
              <span>steady</span>
              <span>at limit</span>
            </div>
          </div>

          <div>
            <label htmlFor="session-notes" className="label">
              Notes (optional)
            </label>
            <textarea
              id="session-notes"
              className="input h-20 resize-none py-2"
              placeholder="How did the session feel? Anything you want the coach to see?"
              defaultValue="Felt fresh after rest day. Skin held up."
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Attempts</h3>
              <span className="text-xs text-[color:var(--color-text-muted)]">
                {attempts.length} attempts · at least 1 required
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {attempts.map((a) => (
                <li key={a.key} className="card-inset flex flex-wrap items-center gap-2 p-2 sm:p-3">
                  <label className="sr-only" htmlFor={`grade-${a.key}`}>
                    Grade
                  </label>
                  <select
                    id={`grade-${a.key}`}
                    className="input h-9 w-[5.5rem] !px-2 font-mono"
                    value={a.grade}
                    onChange={(e) => updateAttempt(a.key, { grade: e.target.value as VGrade })}
                  >
                    {V_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>

                  <div role="radiogroup" aria-label="Outcome" className="pill-group">
                    {OUTCOMES.map((o) => (
                      <button
                        key={o}
                        type="button"
                        role="radio"
                        aria-checked={a.outcome === o}
                        data-active={a.outcome === o}
                        onClick={() => updateAttempt(a.key, { outcome: o })}
                      >
                        {OUTCOME_LABEL[o]}
                      </button>
                    ))}
                  </div>

                  <label className="sr-only" htmlFor={`count-${a.key}`}>
                    Attempt count
                  </label>
                  <div className="inline-flex items-center gap-1 rounded-md border bg-[color:var(--color-surface)] px-1">
                    <button
                      type="button"
                      aria-label="Decrease attempt count"
                      className="h-7 w-7 rounded text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]"
                      onClick={() =>
                        updateAttempt(a.key, { attemptCount: Math.max(1, a.attemptCount - 1) })
                      }
                    >
                      −
                    </button>
                    <input
                      id={`count-${a.key}`}
                      type="number"
                      className="h-7 w-10 bg-transparent text-center font-mono text-sm tabular-nums focus:outline-none"
                      value={a.attemptCount}
                      min={1}
                      onChange={(e) =>
                        updateAttempt(a.key, {
                          attemptCount: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Increase attempt count"
                      className="h-7 w-7 rounded text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-2)]"
                      onClick={() => updateAttempt(a.key, { attemptCount: a.attemptCount + 1 })}
                    >
                      +
                    </button>
                  </div>

                  <input
                    type="text"
                    className="input h-9 flex-1 min-w-[12rem] text-sm"
                    placeholder="Note (optional)"
                    value={a.note}
                    onChange={(e) => updateAttempt(a.key, { note: e.target.value })}
                  />

                  <button
                    type="button"
                    aria-label="Remove attempt"
                    className="btn btn-ghost h-9 w-9 !px-0 text-[color:var(--color-text-muted)] hover:!text-[color:var(--color-danger)]"
                    onClick={() => removeAttempt(a.key)}
                    disabled={attempts.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>

            <button type="button" onClick={addAttempt} className="btn btn-secondary mt-3">
              <Plus className="h-4 w-4" aria-hidden />
              Add attempt
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline pt-4">
            <button type="button" className="btn btn-ghost">
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-secondary">
                Save draft
              </button>
              <button type="submit" className="btn btn-primary">
                <Check className="h-4 w-4" aria-hidden />
                Log session
              </button>
            </div>
          </div>
        </div>

        <aside className="card-inset space-y-4 p-5">
          <div>
            <div className="section-eyebrow">live preview</div>
            <h4 className="mt-1 text-sm font-semibold">This session at a glance</h4>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Attempts" value={attempts.length.toString()} />
            <Stat
              label="Sends"
              value={attempts.filter((a) => a.outcome === 'flash' || a.outcome === 'send' || a.outcome === 'repeat').length.toString()}
            />
            <Stat
              label="Top grade"
              value={
                attempts
                  .filter((a) => a.outcome === 'flash' || a.outcome === 'send' || a.outcome === 'repeat')
                  .map((a) => a.grade)
                  .sort((a, b) => V_GRADES.indexOf(b) - V_GRADES.indexOf(a))[0] ?? '—'
              }
            />
          </dl>
          <div>
            <div className="section-eyebrow mb-2">grades touched</div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set(attempts.map((a) => a.grade))).map((g) => (
                <GradePill key={g} grade={g} size="sm" />
              ))}
            </div>
          </div>
          <div className="rounded-md border border-dashed border-[color:var(--color-border)] p-3 text-xs text-[color:var(--color-text-muted)]">
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden />
            On submit, Convex schedules <code className="font-mono">summarize.run</code> — the AI banner on the detail page will fill in within ~2s.
          </div>
        </aside>
      </form>
    </section>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border bg-[color:var(--color-surface)] py-3">
      <div className="font-mono text-lg font-medium tabular-nums">{value}</div>
      <div className="mt-1 text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </div>
    </div>
  );
}
