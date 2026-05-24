'use client';

import { useQuery } from 'convex/react';
import { use } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { SessionDetail } from '@/components/SessionDetail';

interface PartnerSessionPageProps {
  readonly params: Promise<{
    readonly userId: string;
    readonly sessionId: string;
  }>;
}

export default function PartnerSessionDetailPage({ params }: PartnerSessionPageProps) {
  const { userId, sessionId } = use(params);
  const typedSessionId = sessionId as Id<'sessions'>;
  const typedUserId = userId as Id<'users'>;

  const session = useQuery(api.sessions.getById, { sessionId: typedSessionId });
  const partner = useQuery(api.users.getPublic, { userId: typedUserId });

  if (session === undefined || partner === undefined) {
    return (
      <div className="card p-6">
        <div className="skeleton h-6 w-2/3" />
        <div className="mt-4 skeleton h-32 w-full" />
      </div>
    );
  }

  if (session === null || partner === null) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Session not found, or you no longer have access.
        </p>
      </div>
    );
  }

  return (
    <SessionDetail
      session={session}
      isOwner={false}
      viewerLabel={`Viewing ${partner.displayName}'s session`}
    />
  );
}
