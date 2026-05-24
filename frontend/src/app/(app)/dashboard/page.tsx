'use client';

import { useQuery } from 'convex/react';
import { Sparkles } from 'lucide-react';
import Link from 'next/link';

import { api } from '@convex/_generated/api';

import { Dashboard } from '@/components/Dashboard';

export default function DashboardPage() {
  const viewer = useQuery(api.users.viewer, {});

  if (viewer === undefined) {
    return <DashboardSkeleton />;
  }

  if (viewer === null) {
    // Middleware should redirect, but defend anyway.
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-[color:var(--color-text-muted)]">Not signed in.</p>
      </div>
    );
  }

  if (viewer.sessionsCount === 0) {
    return (
      <section className="space-y-6">
        <header>
          <div className="section-eyebrow">topout · dashboard</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Welcome, {viewer.displayName}
          </h1>
        </header>
        <div className="card flex flex-col items-center justify-center gap-4 p-12 text-center">
          <Sparkles className="h-6 w-6 text-[color:var(--color-accent)]" aria-hidden />
          <div>
            <div className="text-base font-semibold">Log your first session</div>
            <p className="mt-1 max-w-[40ch] text-sm text-[color:var(--color-text-muted)]">
              The dashboard fills in once you have a session. Charts, send pyramid, coach summary — all reactive.
            </p>
          </div>
          <Link href="/sessions/new" className="btn btn-primary h-10">
            Log session
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div className="section-eyebrow">topout · dashboard</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {viewer.displayName}
          </h1>
        </div>
        <Link href="/sessions/new" className="btn btn-primary h-9">
          Log session
        </Link>
      </header>
      <Dashboard userId={viewer._id} />
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <section className="space-y-6">
      <div className="skeleton h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-3 w-24" />
            <div className="mt-3 skeleton h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5">
            <div className="skeleton h-4 w-40" />
            <div className="mt-4 skeleton h-[260px] w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
