'use client';

import { useQuery } from 'convex/react';
import { use } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { LogSessionForm, type LogSessionInitial } from '@/components/LogSessionForm';

interface EditSessionPageProps {
  readonly params: Promise<{ readonly sessionId: string }>;
}

export default function EditSessionPage({ params }: EditSessionPageProps) {
  const { sessionId } = use(params);
  const typedId = sessionId as Id<'sessions'>;
  const session = useQuery(api.sessions.getById, { sessionId: typedId });

  if (session === undefined) {
    return (
      <div className="card p-6">
        <div className="skeleton h-6 w-1/2" />
        <div className="mt-6 skeleton h-40 w-full" />
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Session not found.
        </p>
      </div>
    );
  }

  const initial: LogSessionInitial = {
    sessionId: session._id,
    date: session.date,
    gymId: session.gymId,
    gymName: session.gymName,
    perceivedEffort: session.perceivedEffort,
    notes: session.notes ?? '',
    durationMinutes: session.durationMinutes ?? null,
    attempts: session.attempts.map((a) => ({
      grade: a.grade,
      outcome: a.outcome,
      attemptCount: a.attemptCount,
      notes: a.notes ?? undefined,
    })),
  };

  return (
    <section className="space-y-6">
      <header>
        <div className="section-eyebrow">topout · edit session</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Edit session</h1>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
          Saving regenerates the coach summary.
        </p>
      </header>
      <LogSessionForm initial={initial} />
    </section>
  );
}
