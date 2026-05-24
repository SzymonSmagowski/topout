'use client';

import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { UserCheck, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

import { ConfirmModal } from '@/components/ConfirmModal';
import { GradePill } from '@/components/GradePill';

export default function PartnersPage() {
  const partners = useQuery(api.follows.listPartners, {});
  const follow = useMutation(api.follows.follow);
  const unfollow = useMutation(api.follows.unfollow);
  const [pendingId, setPendingId] = useState<Id<'users'> | null>(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState<{
    readonly userId: Id<'users'>;
    readonly displayName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFollow = async (userId: Id<'users'>) => {
    setError(null);
    setPendingId(userId);
    try {
      await follow({ followeeId: userId });
    } catch (err) {
      const message = err instanceof ConvexError
        ? messageForKind(err.data) ?? 'Could not follow this climber.'
        : 'Could not follow this climber.';
      setError(message);
    } finally {
      setPendingId(null);
    }
  };

  const onConfirmUnfollow = async () => {
    if (!confirmUnfollow) return;
    setError(null);
    setPendingId(confirmUnfollow.userId);
    try {
      await unfollow({ followeeId: confirmUnfollow.userId });
      setConfirmUnfollow(null);
    } catch {
      setError('Could not unfollow.');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <div className="section-eyebrow">topout · partners</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Climbing partners</h1>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
          Follow to see their dashboard live. Self-follow rejected server-side.
        </p>
      </header>

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

      {partners === undefined ? (
        <PartnersSkeleton />
      ) : partners.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {partners.map((p) => {
            const initials = p.displayName
              .split(/\s+/)
              .map((part) => part[0] ?? '')
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const isPending = pendingId === p.userId;

            return (
              <li key={p.userId} className="flex items-center gap-3 px-5 py-4">
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--color-sienna-200)',
                    color: 'var(--color-sienna-900)',
                  }}
                >
                  {initials}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <Link
                      href={`/partners/${p.userId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {p.displayName}
                    </Link>
                    {p.gradeRange && (
                      <span className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                        <GradePill grade={p.gradeRange.min} size="sm" />
                        <span>–</span>
                        <GradePill grade={p.gradeRange.max} size="sm" />
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-[color:var(--color-text-muted)]">
                    {p.lastSessionAt
                      ? <span>last session {relativeDate(p.lastSessionAt)}</span>
                      : <span>no sessions yet</span>}
                  </div>
                </div>
                {p.isFollowing ? (
                  <button
                    type="button"
                    className="btn btn-secondary h-8 text-xs"
                    onClick={() =>
                      setConfirmUnfollow({ userId: p.userId, displayName: p.displayName })
                    }
                    disabled={isPending}
                  >
                    <UserCheck className="h-3.5 w-3.5 text-[color:var(--color-success)]" aria-hidden />
                    Following
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary h-8 text-xs"
                    onClick={() => onFollow(p.userId)}
                    disabled={isPending}
                  >
                    <UserPlus className="h-3.5 w-3.5" aria-hidden />
                    {isPending ? 'Following…' : 'Follow'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={confirmUnfollow !== null}
        title={confirmUnfollow ? `Unfollow ${confirmUnfollow.displayName}?` : ''}
        description="You'll no longer see their training. You can re-follow at any time."
        confirmLabel="Unfollow"
        busy={pendingId !== null}
        onConfirm={onConfirmUnfollow}
        onCancel={() => setConfirmUnfollow(null)}
      />
    </section>
  );
}

function PartnersSkeleton() {
  return (
    <ul className="card divide-y" style={{ borderColor: 'var(--color-border)' }}>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-4">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-32" />
            <div className="skeleton h-3 w-48" />
          </div>
          <div className="skeleton h-8 w-24" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
      <Users className="h-5 w-5 text-[color:var(--color-muted)]" aria-hidden />
      <div>
        <div className="text-sm font-semibold">No other climbers yet</div>
        <p className="mt-1 max-w-[36ch] text-xs text-[color:var(--color-text-muted)]">
          Seed accounts will appear after running <code className="font-mono">pnpm seed</code>.
        </p>
      </div>
    </div>
  );
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function messageForKind(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('kind' in data)) return null;
  const kind = (data as { kind: string }).kind;
  switch (kind) {
    case 'self_follow':
      return "You can't follow yourself.";
    case 'already_following':
      return 'Already following.';
    default:
      return null;
  }
}
