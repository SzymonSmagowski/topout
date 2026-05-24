'use client';

import { ConvexError } from 'convex/values';
import { useMutation } from 'convex/react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { isSent, OUTCOME_LABEL, OUTCOMES, V_GRADES, type Outcome, type VGrade } from '@/lib/grades';

import { GradePill } from './GradePill';
import { GymCombobox } from './GymCombobox';

interface AttemptDraft {
  readonly key: string;
  readonly grade: VGrade;
  readonly outcome: Outcome;
  readonly attemptCount: number;
  readonly notes: string;
}

export interface LogSessionInitial {
  readonly sessionId?: Id<'sessions'>;
  readonly date: number;
  readonly gymId: Id<'gyms'>;
  readonly gymName: string;
  readonly perceivedEffort: number;
  readonly notes: string;
  readonly durationMinutes: number | null;
  readonly attempts: readonly {
    readonly grade: VGrade;
    readonly outcome: Outcome;
    readonly attemptCount: number;
    readonly notes?: string;
  }[];
}

interface LogSessionFormProps {
  readonly initial?: LogSessionInitial;
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear().toString().padStart(4, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isoDateFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function epochMsFromIsoDate(iso: string): number {
  return Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
}

let attemptCounter = 0;
const nextKey = () => `a-${++attemptCounter}`;

export function LogSessionForm({ initial }: LogSessionFormProps) {
  const router = useRouter();

  const [dateIso, setDateIso] = useState(initial ? isoDateFromMs(initial.date) : todayIsoDate());
  const [gym, setGym] = useState<{ gymId: Id<'gyms'> | null; name: string }>(
    initial
      ? { gymId: initial.gymId, name: initial.gymName }
      : { gymId: null, name: '' },
  );
  const [effort, setEffort] = useState(initial?.perceivedEffort ?? 7);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [durationMinutes, setDurationMinutes] = useState<string>(
    initial?.durationMinutes != null ? String(initial.durationMinutes) : '',
  );
  const [attempts, setAttempts] = useState<readonly AttemptDraft[]>(() =>
    initial
      ? initial.attempts.map((a) => ({
          key: nextKey(),
          grade: a.grade,
          outcome: a.outcome,
          attemptCount: a.attemptCount,
          notes: a.notes ?? '',
        }))
      : [{ key: nextKey(), grade: 'V3', outcome: 'send', attemptCount: 1, notes: '' }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effortId = useId();
  const durationId = useId();

  const ensureGym = useMutation(api.gyms.ensureByName);
  const createSession = useMutation(api.sessions.createSession);
  const updateSession = useMutation(api.sessions.updateSession);

  const addAttempt = () => {
    setAttempts((prev) => [
      ...prev,
      { key: nextKey(), grade: 'V3', outcome: 'send', attemptCount: 1, notes: '' },
    ]);
  };

  const removeAttempt = (key: string) => {
    setAttempts((prev) => (prev.length <= 1 ? prev : prev.filter((a) => a.key !== key)));
  };

  const updateAttempt = (key: string, patch: Partial<Omit<AttemptDraft, 'key'>>) => {
    setAttempts((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!gym.name.trim()) {
      setError('Pick or type a gym.');
      return;
    }
    if (attempts.length < 1) {
      setError('Add at least one attempt.');
      return;
    }
    if (epochMsFromIsoDate(dateIso) > Date.now()) {
      setError('Date cannot be in the future.');
      return;
    }
    if (effort < 1 || effort > 10) {
      setError('Perceived effort must be between 1 and 10.');
      return;
    }

    setSubmitting(true);
    try {
      // Resolve gymId — ensure-by-name covers both the "selected existing" and
      // "typed new" paths atomically server-side.
      const gymResult = gym.gymId
        ? { gymId: gym.gymId }
        : await ensureGym({ name: gym.name.trim() });

      const durationParsed = durationMinutes.trim() ? Number(durationMinutes) : NaN;
      const payload = {
        date: epochMsFromIsoDate(dateIso),
        gymId: gymResult.gymId,
        perceivedEffort: effort,
        notes: notes.trim() ? notes.trim() : undefined,
        durationMinutes: Number.isFinite(durationParsed) ? durationParsed : undefined,
        attempts: attempts.map((a) => ({
          grade: a.grade,
          outcome: a.outcome,
          attemptCount: a.attemptCount,
          notes: a.notes.trim() ? a.notes.trim() : undefined,
        })),
      };

      const result = initial?.sessionId
        ? await updateSession({ sessionId: initial.sessionId, ...payload })
        : await createSession(payload);

      router.push(`/sessions/${result.sessionId}`);
    } catch (err) {
      const message = err instanceof ConvexError
        ? messageForKind(err.data) ?? 'Could not save session.'
        : err instanceof Error
          ? err.message
          : 'Could not save session.';
      setError(message);
      setSubmitting(false);
    }
  };

  const sendCount = attempts.filter((a) => isSent(a.outcome)).length;
  const topGrade =
    attempts
      .filter((a) => isSent(a.outcome))
      .map((a) => a.grade)
      .sort((a, b) => V_GRADES.indexOf(b) - V_GRADES.indexOf(a))[0] ?? null;

  return (
    <form
      className="card grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_minmax(0,360px)]"
      onSubmit={onSubmit}
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
              value={dateIso}
              max={todayIsoDate()}
              onChange={(e) => setDateIso(e.target.value)}
              required
            />
          </div>
          <GymCombobox value={gym} onChange={setGym} />
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

        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <div>
            <label htmlFor="session-notes" className="label">
              Notes (optional)
            </label>
            <textarea
              id="session-notes"
              className="input h-20 resize-none py-2"
              placeholder="How did the session feel? Anything you want the coach to see?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={durationId} className="label">
              Duration (min)
            </label>
            <input
              id={durationId}
              type="number"
              min={1}
              step={1}
              className="input font-mono"
              placeholder="—"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
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
                    <option key={g} value={g}>{g}</option>
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

                <label className="sr-only" htmlFor={`count-${a.key}`}>Attempt count</label>
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
                  value={a.notes}
                  onChange={(e) => updateAttempt(a.key, { notes: e.target.value })}
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline pt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || attempts.length === 0}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            {initial?.sessionId ? 'Save changes' : 'Log session'}
          </button>
        </div>
      </div>

      <aside className="card-inset space-y-4 p-5">
        <div>
          <div className="section-eyebrow">live preview</div>
          <h4 className="mt-1 text-sm font-semibold">This session at a glance</h4>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Attempts" value={attempts.length.toString()} />
          <Stat label="Sends" value={sendCount.toString()} />
          <Stat label="Top grade" value={topGrade ?? '—'} />
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
          On submit, Convex schedules <code className="font-mono">summarize.run</code> — the coach banner will fill in within ~2s.
        </div>
      </aside>
    </form>
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

function messageForKind(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('kind' in data)) return null;
  const kind = (data as { kind: string }).kind;
  switch (kind) {
    case 'session_not_found':
      return 'Session not found.';
    case 'not_session_owner':
      return 'You can only edit your own sessions.';
    case 'not_authenticated':
      return 'You need to sign in to log a session.';
    default:
      return null;
  }
}
