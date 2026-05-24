'use client';

import { useQuery } from 'convex/react';
import Link from 'next/link';

import { api } from '@convex/_generated/api';

import { SessionsList } from '@/components/SessionsList';

export default function SessionsPage() {
  const sessions = useQuery(api.sessions.listOwn, {});

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="section-eyebrow">topout · sessions</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Your sessions</h1>
          <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
            Reverse-chronological. Reactive — new sessions appear without reload.
          </p>
        </div>
        <Link href="/sessions/new" className="btn btn-primary h-9">
          Log session
        </Link>
      </header>

      <SessionsList sessions={sessions} hrefFor={(id) => `/sessions/${id}`} />
    </section>
  );
}
