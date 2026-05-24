import { Activity, ArrowRight, Lock, UserCheck, UserPlus } from 'lucide-react';

import { GradePill } from '@/components/GradePill';
import { SummaryBanner } from '@/components/SummaryBanner';

import { ALL_USERS, gymName, SAM_SESSIONS, USER_ALEX, USER_ME, USER_SAM, type MockUser } from '../_data/mock';
import { Dashboard } from './Dashboard';
import { SectionHeader } from './SectionHeader';

interface Row {
  readonly user: MockUser;
  readonly following: boolean;
  readonly followers: number;
  readonly lastSession: string;
}

const ROWS: readonly Row[] = [
  { user: USER_ALEX, following: true, followers: 1, lastSession: '2 days ago' },
  { user: USER_SAM, following: true, followers: 2, lastSession: '17 hours ago' },
];

export function PartnersSection() {
  return (
    <section className="space-y-8">
      <SectionHeader
        id="partners"
        eyebrow="04 · follow-partner"
        title="Partners — list, follow, watch their dashboard live."
        description={
          <>
            All authorization is server-side via <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">requireFollowing(ctx, targetUserId)</code>. The partner detail below renders the <strong>same</strong> <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">Dashboard</code> component as your own page, just parameterised with Sam’s userId.
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,1.4fr)]">
        {/* List */}
        <div className="card overflow-hidden">
          <div className="border-b hairline px-5 py-4">
            <h3 className="text-sm font-semibold">All climbers ({ALL_USERS.length - 1})</h3>
            <p className="text-xs text-[color:var(--color-text-muted)]">
              You don’t see yourself. Self-follow rejected server-side.
            </p>
          </div>

          <ul>
            {ROWS.map(({ user, following, followers, lastSession }) => (
              <li
                key={user.id}
                className="flex items-center gap-3 border-b hairline px-5 py-4 last:border-b-0"
              >
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--color-sienna-200)',
                    color: 'var(--color-sienna-900)',
                  }}
                >
                  {user.initials}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">{user.displayName}</span>
                    <span className="flex items-center gap-1 text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      <GradePill grade={user.gradeRange[0]} size="sm" />
                      <span>–</span>
                      <GradePill grade={user.gradeRange[1]} size="sm" />
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-[color:var(--color-text-muted)]">
                    <span>{followers} followers</span>
                    <span aria-hidden>·</span>
                    <span>{lastSession}</span>
                  </div>
                </div>
                {following ? (
                  <button type="button" className="btn btn-secondary h-8 text-xs">
                    <UserCheck className="h-3.5 w-3.5 text-[color:var(--color-success)]" aria-hidden />
                    Following
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary h-8 text-xs">
                    <UserPlus className="h-3.5 w-3.5" aria-hidden />
                    Follow
                  </button>
                )}
              </li>
            ))}
            {/* Locked example */}
            <li
              className="flex items-center gap-3 border-b hairline px-5 py-4 last:border-b-0"
              aria-label="Example: unfollowed partner gate"
            >
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface-2)] text-xs font-semibold text-[color:var(--color-muted)]">
                ?
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium text-[color:var(--color-text-muted)]">
                  New climber
                </div>
                <div className="text-xs text-[color:var(--color-text-muted)]">
                  Follow to see grade range
                </div>
              </div>
              <button type="button" className="btn btn-primary h-8 text-xs">
                <UserPlus className="h-3.5 w-3.5" aria-hidden />
                Follow
              </button>
            </li>
          </ul>
        </div>

        {/* Partner detail (reuses dashboard) */}
        <div id="partner-detail" className="space-y-4 scroll-mt-24">
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--color-sienna-200)',
                    color: 'var(--color-sienna-900)',
                  }}
                >
                  {USER_SAM.initials}
                </span>
                <div>
                  <div className="text-base font-semibold">{USER_SAM.displayName}</div>
                  <div className="flex items-center gap-2 text-xs text-[color:var(--color-text-muted)]">
                    <Activity className="h-3 w-3" aria-hidden />
                    First V6 send 17h ago
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip">
                  <UserCheck className="h-3 w-3 text-[color:var(--color-success)]" aria-hidden />
                  Following
                </span>
                <button type="button" className="btn btn-ghost h-8 text-xs">
                  Unfollow
                </button>
              </div>
            </div>
          </div>

          <Dashboard userId={USER_SAM.id} variant="partner" />

          <div className="card overflow-hidden">
            <div className="border-b hairline px-5 py-3">
              <div className="flex items-baseline justify-between">
                <h4 className="text-sm font-semibold">Sam’s recent sessions (read-only)</h4>
                <span className="text-xs text-[color:var(--color-text-muted)]">
                  Edit / Delete hidden — <code className="font-mono">isOwner=false</code>
                </span>
              </div>
            </div>
            <ul>
              {SAM_SESSIONS.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center gap-3 border-b hairline px-5 py-3 last:border-b-0"
                >
                  <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                    {new Date(`${session.dateIso}T12:00:00Z`).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span className="text-xs text-[color:var(--color-text-muted)]">{gymName(session.gymId)}</span>
                  <GradePill
                    grade={
                      [...session.attempts]
                        .filter((a) => a.outcome === 'send' || a.outcome === 'flash' || a.outcome === 'repeat')
                        .sort((a, b) => b.grade.localeCompare(a.grade))[0]?.grade ?? 'V0'
                    }
                  />
                  <span className="text-xs text-[color:var(--color-text-muted)]">
                    {session.attempts.filter((a) => a.outcome === 'send' || a.outcome === 'flash' || a.outcome === 'repeat').length} sends ·{' '}
                    {session.attempts.reduce((acc, a) => acc + a.attemptCount, 0)} attempts
                  </span>
                  <button type="button" className="ml-auto btn btn-ghost h-7 text-xs">
                    View
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {SAM_SESSIONS[0]?.summary.kind === 'ok' && (
            <SummaryBanner state={SAM_SESSIONS[0].summary} />
          )}

          {/* Gate example */}
          <div
            className="card flex flex-col items-center justify-center gap-3 p-8 text-center"
            aria-label="Unfollowed partner gate"
          >
            <Lock className="h-5 w-5 text-[color:var(--color-muted)]" aria-hidden />
            <div>
              <div className="text-sm font-semibold">Follow to see their training</div>
              <p className="mt-1 max-w-[36ch] text-xs text-[color:var(--color-text-muted)]">
                When you’re not following someone, the partner endpoints return no data — not even a row count. The frontend never sees their sessions.
              </p>
            </div>
            <button type="button" className="btn btn-primary h-9">
              <UserPlus className="h-4 w-4" aria-hidden />
              Follow new climber
            </button>
          </div>

          <p className="text-xs text-[color:var(--color-text-muted)]">
            Signed in as <strong className="text-[color:var(--color-text)]">{USER_ME.displayName}</strong>. Sam logs a V6 in their tab → this dashboard reflows in under 500ms.
          </p>
        </div>
      </div>
    </section>
  );
}
