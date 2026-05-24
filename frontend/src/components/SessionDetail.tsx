'use client';

import { useMutation } from 'convex/react';
import { CalendarDays, Clock, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { V_GRADES, type Outcome, type VGrade } from '@/lib/grades';

import { AttemptRow } from './AttemptRow';
import { ConfirmModal } from './ConfirmModal';
import { formatSessionDate } from './SessionCard';
import { SummaryBanner, summaryStateFrom } from './SummaryBanner';

export interface SessionDetailData {
  readonly _id: Id<'sessions'>;
  readonly date: number;
  readonly gymName: string;
  readonly perceivedEffort: number;
  // Convex's v.optional(...) round-trips as `number | undefined`; the
  // design preview used `number | null`. Accept both so the same component
  // serves real Convex data and the static preview without a coerce step.
  readonly durationMinutes: number | null | undefined;
  readonly notes: string | null | undefined;
  readonly summary: string | null | undefined;
  readonly summaryStatus: 'pending' | 'ok' | 'err';
  readonly summaryError: string | null | undefined;
  readonly attempts: readonly {
    readonly grade: VGrade;
    readonly outcome: Outcome;
    readonly attemptCount: number;
    readonly notes?: string | null | undefined;
  }[];
}

interface SessionDetailProps {
  readonly session: SessionDetailData;
  readonly isOwner: boolean;
  readonly editHref?: string;
  readonly afterDeleteHref?: string;
  readonly viewerLabel?: string;
}

export function SessionDetail({
  session,
  isOwner,
  editHref,
  afterDeleteHref = '/sessions',
  viewerLabel,
}: SessionDetailProps) {
  const router = useRouter();
  const deleteSession = useMutation(api.sessions.deleteSession);
  const retrySummary = useMutation(api.summarize.retrySummary);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const sendCount = session.attempts.filter(
    (a) => a.outcome === 'flash' || a.outcome === 'send' || a.outcome === 'repeat',
  ).length;
  const attemptTotal = session.attempts.reduce((acc, a) => acc + a.attemptCount, 0);

  const onConfirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteSession({ sessionId: session._id });
      router.push(afterDeleteHref);
    } catch {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const onRetry = async () => {
    setRetrying(true);
    try {
      await retrySummary({ sessionId: session._id });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="border-b hairline px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            {viewerLabel && (
              <div className="section-eyebrow">{viewerLabel}</div>
            )}
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {formatSessionDate(session.date)} · {session.gymName}
            </h2>
          </div>
          {isOwner && editHref && (
            <div className="flex items-center gap-2">
              <Link href={editHref} className="btn btn-ghost h-8 text-xs">
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Edit
              </Link>
              <button
                type="button"
                className="btn btn-danger h-8 text-xs"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </button>
            </div>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Meta icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />} label="Date" value={formatSessionDate(session.date)} />
          <Meta
            icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
            label="Duration"
            value={session.durationMinutes ? `${session.durationMinutes}m` : '—'}
          />
          <Meta label="Effort" value={`${session.perceivedEffort}/10`} mono />
          <Meta label="Sends / attempts" value={`${sendCount} / ${attemptTotal}`} mono />
        </dl>
      </div>

      <div className="p-5">
        <SummaryBanner
          state={summaryStateFrom(session)}
          onRetry={isOwner ? onRetry : undefined}
          retrying={retrying}
        />
      </div>

      {session.notes && (
        <div className="border-t hairline px-5 py-3">
          <div className="section-eyebrow">notes</div>
          <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">{session.notes}</p>
        </div>
      )}

      <div className="border-t hairline">
        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="text-sm font-semibold">Attempts</h3>
          <span className="text-xs text-[color:var(--color-text-muted)]">
            Grouped by grade · {session.attempts.length} entries
          </span>
        </div>
        <ul>
          {[...session.attempts]
            .sort((a, b) => V_GRADES.indexOf(b.grade) - V_GRADES.indexOf(a.grade))
            .map((a, idx) => (
              <AttemptRow
                key={`${a.grade}-${idx}`}
                grade={a.grade}
                outcome={a.outcome}
                attemptCount={a.attemptCount}
                notes={a.notes ?? undefined}
              />
            ))}
        </ul>
      </div>

      <ConfirmModal
        open={showDelete}
        title="Delete this session?"
        description={`This will delete the session and all ${session.attempts.length} attempts. This cannot be undone.`}
        confirmLabel="Delete session"
        destructive
        busy={deleting}
        onConfirm={onConfirmDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
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
