/**
 * Convex schema — single source of truth for TopOut's database shape.
 *
 * Rules of engagement (from the manifest's code-quality bar):
 * - Every literal-union validator uses `v.union(v.literal('a'), v.literal('b'), …)`
 *   and the corresponding TS type must derive from the same `as const` array.
 *   The arrays live in `convex/lib/enums.ts` so both the validator and any
 *   TS narrowing helper read from the same source of truth.
 * - Every entity reference uses `v.id('tableName')`. Convex generates branded
 *   `Id<'tableName'>` types for these so they cannot be confused.
 * - Indexes are NAMED so call sites read like English; one index per query
 *   pattern documented in the specs (no broad over-indexing).
 * - `authTables` from `@convex-dev/auth/server` are spread first; the `users`
 *   table is inlined so we can add `displayName` and an `email` index.
 *
 * Cross-reference: the V_GRADES / OUTCOMES arrays MUST match
 * `apps/topout/frontend/src/lib/grades.ts` exactly — no drift between
 * client-side runtime checks and server-side validators.
 */
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

import {
  vGrade,
  vOutcome,
  vSummaryStatus,
  vReportStatus,
} from './lib/enums';

export default defineSchema({
  // ---------------------------------------------------------------------------
  // Auth tables (users, authSessions, authAccounts, authVerificationCodes,
  // authRefreshTokens, authVerifiers, authRateLimits) come from Convex Auth.
  // We override `users` to add `displayName` and a stable `email` index.
  // ---------------------------------------------------------------------------
  ...authTables,

  users: defineTable({
    // Required by Convex Auth Password provider.
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // TopOut additions.
    /** Set-once at registration. Shown in user menu + partner lists. */
    displayName: v.string(),

    /**
     * Marks seed-created accounts so `pnpm seed` can wipe them idempotently
     * without ever touching real users. Real users register without it.
     */
    isSeed: v.optional(v.boolean()),
  })
    .index('email', ['email'])
    .index('byIsSeed', ['isSeed']),

  // ---------------------------------------------------------------------------
  // Domain tables.
  // ---------------------------------------------------------------------------

  /**
   * Globally-shared gym registry. One row per gym name. No PII; readable by
   * every signed-in user. Gym autocomplete prefix-matches on `name`.
   */
  gyms: defineTable({
    name: v.string(),
    city: v.optional(v.string()),
  })
    .index('byName', ['name']),

  /**
   * One row per logged climbing session. Owned by exactly one user. Cascades
   * to `attempts` on delete (handled in the mutation, not at the DB level —
   * Convex has no FK cascade).
   */
  sessions: defineTable({
    userId: v.id('users'),
    /** Epoch millis at 00:00 UTC of the session's calendar day. */
    date: v.number(),
    gymId: v.id('gyms'),
    /** 1..10 inclusive — validated in the mutation, not at the schema level. */
    perceivedEffort: v.number(),
    notes: v.optional(v.string()),
    /** Optional total session length. Display-only. */
    durationMinutes: v.optional(v.number()),
    createdAt: v.number(),

    // summarize-session fields. createSession inserts these as
    // { summary: null, summaryStatus: 'pending', summaryError: null } and
    // schedules `internal.summarize.run`.
    summary: v.union(v.string(), v.null()),
    summaryStatus: vSummaryStatus,
    summaryError: v.union(v.string(), v.null()),
  })
    // List view ("most recent first for this user"). Also used by dashboard
    // window queries — server sorts by `date` desc, bounded by window start.
    .index('byUserAndDate', ['userId', 'date'])
    .index('byUserAndCreated', ['userId', 'createdAt'])
    .index('byGym', ['gymId']),

  /**
   * Individual attempts within a session. One session has 1..N attempts.
   * Always queried with `bySession` — never list all attempts globally.
   */
  attempts: defineTable({
    sessionId: v.id('sessions'),
    grade: vGrade,
    outcome: vOutcome,
    /** ≥ 1 — validated in the mutation. */
    attemptCount: v.number(),
    notes: v.optional(v.string()),
  })
    .index('bySession', ['sessionId']),

  /**
   * Asymmetric follow relationships. No approval flow. Self-follow rejected
   * at the mutation layer with ConvexError({ kind: 'self_follow' }).
   * Composite index doubles as uniqueness check (mutation reads via this
   * index and rejects duplicates with `{ kind: 'already_following' }`).
   */
  follows: defineTable({
    followerId: v.id('users'),
    followeeId: v.id('users'),
    createdAt: v.number(),
  })
    .index('byFollowerAndFollowee', ['followerId', 'followeeId'])
    .index('byFollower', ['followerId'])
    .index('byFollowee', ['followeeId']),

  /**
   * One row per (user, weekStart). `generateReport` upserts via the composite
   * index — regenerating overwrites the same row, no duplicates.
   */
  weeklyReports: defineTable({
    userId: v.id('users'),
    /** Epoch millis at Monday 00:00 UTC of the report's ISO week. */
    weekStart: v.number(),
    /** Epoch millis at Sunday 23:59:59.999 UTC. */
    weekEnd: v.number(),
    status: vReportStatus,
    narrativeMd: v.union(v.string(), v.null()),
    /** JSON-encoded stats blob from the sidecar's analyze_stats node. */
    statsJson: v.union(v.string(), v.null()),
    model: v.union(v.string(), v.null()),
    generatedAt: v.union(v.number(), v.null()),
    error: v.union(v.string(), v.null()),
  })
    .index('byUserAndWeekStart', ['userId', 'weekStart'])
    .index('byUserAndCreated', ['userId', 'generatedAt']),
});
