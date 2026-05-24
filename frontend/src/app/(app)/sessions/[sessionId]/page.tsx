'use client';

import { useQuery } from 'convex/react';
import { use } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { SessionDetail } from '@/components/SessionDetail';

interface SessionDetailPageProps {
  readonly params: Promise<{ readonly sessionId: string }>;
}

export default function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { sessionId } = use(params);
  const typedId = sessionId as Id<'sessions'>;
  const viewer = useQuery(api.users.viewer, {});
  const session = useQuery(api.sessions.getById, { sessionId: typedId });

  if (session === undefined || viewer === undefined) {
    return <DetailSkeleton />;
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

  const isOwner = viewer !== null && viewer._id === session.userId;

  return (
    <section className="space-y-4">
      <SessionDetail
        session={session}
        isOwner={isOwner}
        editHref={isOwner ? `/sessions/${sessionId}/edit` : undefined}
      />
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="card p-6">
      <div className="skeleton h-6 w-2/3" />
      <div className="mt-4 grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-12" />
        ))}
      </div>
      <div className="mt-6 skeleton h-20 w-full" />
    </div>
  );
}
