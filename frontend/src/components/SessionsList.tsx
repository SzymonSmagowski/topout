'use client';

import { ClipboardList } from 'lucide-react';
import Link from 'next/link';

import { isSent, V_GRADES, type VGrade } from '@/lib/grades';

import { firstSentence, SessionCard } from './SessionCard';

type AttemptSummary = {
  readonly grade: VGrade;
  readonly outcome: 'flash' | 'send' | 'repeat' | 'project' | 'fall';
  readonly attemptCount: number;
};

type Session = {
  readonly _id: string;
  readonly date: number;
  readonly gymName: string;
  readonly perceivedEffort: number;
  readonly topGrade: VGrade | null;
  readonly sendCount: number;
  readonly attempts?: readonly AttemptSummary[];
  readonly summary: string | null;
  readonly summaryStatus: 'pending' | 'ok' | 'err';
};

interface SessionsListProps {
  readonly sessions: readonly Session[] | undefined;
  readonly hrefFor: (sessionId: string) => string;
  readonly emptyCtaHref?: string;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly emptyShowsLogCta?: boolean;
}

export function SessionsList({
  sessions,
  hrefFor,
  emptyCtaHref = '/sessions/new',
  emptyTitle = 'No sessions yet',
  emptyDescription = 'Log your first session to start building your training arc.',
  emptyShowsLogCta = true,
}: SessionsListProps) {
  if (sessions === undefined) {
    return (
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="card p-4">
            <div className="skeleton h-4 w-32" />
            <div className="mt-3 skeleton h-3 w-3/4" />
          </li>
        ))}
      </ul>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
        <ClipboardList className="h-5 w-5 text-[color:var(--color-muted)]" aria-hidden />
        <div>
          <div className="text-sm font-semibold">{emptyTitle}</div>
          <p className="mt-1 max-w-[36ch] text-xs text-[color:var(--color-text-muted)]">{emptyDescription}</p>
        </div>
        {emptyShowsLogCta && (
          <Link href={emptyCtaHref} className="btn btn-primary h-9">
            Log session
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sessions.map((session) => {
        const attemptTotal = (session.attempts ?? []).reduce(
          (acc, a) => acc + a.attemptCount,
          0,
        );
        const topGradeFromAttempts =
          session.topGrade ??
          highestSentGrade(session.attempts ?? []);
        const sendCount =
          session.sendCount ??
          (session.attempts ?? []).filter((a) => isSent(a.outcome)).length;

        return (
          <SessionCard
            key={session._id}
            href={hrefFor(session._id)}
            date={session.date}
            gymName={session.gymName}
            topGrade={topGradeFromAttempts}
            sendCount={sendCount}
            attemptTotal={attemptTotal}
            perceivedEffort={session.perceivedEffort}
            summarySnippet={
              session.summaryStatus === 'ok' && session.summary
                ? firstSentence(session.summary)
                : null
            }
          />
        );
      })}
    </ul>
  );
}

function highestSentGrade(attempts: readonly AttemptSummary[]): VGrade | null {
  const sends = attempts.filter((a) => isSent(a.outcome)).map((a) => a.grade);
  if (sends.length === 0) return null;
  return (
    sends
      .slice()
      .sort((a, b) => V_GRADES.indexOf(b) - V_GRADES.indexOf(a))[0] ?? null
  );
}
