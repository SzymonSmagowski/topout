'use client';

import { useMutation, useQuery } from 'convex/react';
import { Activity, Lock, UserPlus } from 'lucide-react';
import { use, useState } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { Dashboard } from '@/components/Dashboard';
import { SessionsList } from '@/components/SessionsList';

interface PartnerPageProps {
  readonly params: Promise<{ readonly userId: string }>;
}

export default function PartnerDashboardPage({ params }: PartnerPageProps) {
  const { userId } = use(params);
  const typedId = userId as Id<'users'>;

  const partner = useQuery(api.users.getPublic, { userId: typedId });
  const isFollowing = useQuery(api.follows.isFollowing, { targetUserId: typedId });
  const follow = useMutation(api.follows.follow);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (partner === undefined || isFollowing === undefined) {
    return <PartnerSkeleton />;
  }

  if (partner === null) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-[color:var(--color-text-muted)]">
          Climber not found.
        </p>
      </div>
    );
  }

  if (!isFollowing) {
    const onFollow = async () => {
      setError(null);
      setFollowing(true);
      try {
        await follow({ followeeId: typedId });
      } catch {
        setError('Could not follow this climber.');
      } finally {
        setFollowing(false);
      }
    };

    return (
      <section className="space-y-6">
        <header>
          <div className="section-eyebrow">topout · partner</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{partner.displayName}</h1>
        </header>
        <div className="card flex flex-col items-center justify-center gap-4 p-10 text-center">
          <Lock className="h-5 w-5 text-[color:var(--color-muted)]" aria-hidden />
          <div>
            <div className="text-base font-semibold">Follow to see their training</div>
            <p className="mt-1 max-w-[40ch] text-sm text-[color:var(--color-text-muted)]">
              When you&rsquo;re not following someone, no session data is returned. The frontend doesn&rsquo;t see anything.
            </p>
          </div>
          {error && <div className="text-xs text-[color:var(--color-danger)]">{error}</div>}
          <button
            type="button"
            className="btn btn-primary h-10"
            onClick={onFollow}
            disabled={following}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            {following ? 'Following…' : `Follow ${partner.displayName}`}
          </button>
        </div>
      </section>
    );
  }

  return <PartnerView userId={typedId} partner={partner} />;
}

function PartnerView({
  userId,
  partner,
}: {
  readonly userId: Id<'users'>;
  readonly partner: { readonly displayName: string };
}) {
  const sessions = useQuery(api.sessions.listForUser, { userId });

  const initials = partner.displayName
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="space-y-6">
      <header>
        <div className="section-eyebrow">topout · partner</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{partner.displayName}</h1>
      </header>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
            style={{
              backgroundColor: 'var(--color-sienna-200)',
              color: 'var(--color-sienna-900)',
            }}
          >
            {initials}
          </span>
          <div>
            <div className="text-base font-semibold">{partner.displayName}</div>
            <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
              <Activity className="h-3 w-3" aria-hidden />
              Following — live updates when they log a session
            </div>
          </div>
        </div>
      </div>

      <Dashboard userId={userId} variant="partner" />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Recent sessions</h2>
        <SessionsList
          sessions={sessions}
          hrefFor={(id) => `/partners/${userId}/sessions/${id}`}
          emptyShowsLogCta={false}
          emptyTitle="No sessions yet"
          emptyDescription="They haven't logged anything yet. Check back later."
        />
      </section>
    </section>
  );
}

function PartnerSkeleton() {
  return (
    <section className="space-y-6">
      <div className="skeleton h-8 w-64" />
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div className="skeleton h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-56" />
          </div>
        </div>
      </div>
    </section>
  );
}
