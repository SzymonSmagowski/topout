/**
 * Deterministic seed data — internal mutations.
 *
 * All mutations + queries live here (default V8 runtime). The orchestrator
 * `run` action that walks through wipe → ensureGyms → createSeedUser × N →
 * insert sessions → insertFollows lives in `seedActions.ts` because the
 * PRNG-driven arc generator imports utility code that Convex treats as
 * Node-only (`startOfDayUtc`, deterministic helpers).
 *
 * Production guard:
 *   `assertNonProd` inspects the active Convex deployment name. Without an
 *   explicit `dev:` prefix (or an entry in `ALLOWED_SEED_DEPLOYMENTS`), it
 *   throws `production_deployment_blocked`. The seed action calls this
 *   first; `scripts/seed.ts` ALSO refuses on the client side. Two guards by
 *   design.
 *
 * @see apps/topout/docs/architecture.md §5.7
 * @see docs/specs/topout/seed-data.md
 */
import { createAccount } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Id } from './_generated/dataModel';
import { internalMutation, internalQuery } from './_generated/server';
import { typedError } from './lib/errors';

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------

function isAllowedDeployment(name: string | undefined): boolean {
  // Convex CLI's anonymous local backend doesn't populate CONVEX_DEPLOYMENT
  // inside the function runtime — `name` comes through as ''. The host IS
  // strictly local in that mode, so empty-on-local is safe; real prod
  // deployments always carry a populated name.
  if (name === undefined || name === '') return true;
  if (
    name.startsWith('dev:') ||
    name.startsWith('local:') ||
    name.startsWith('anonymous:')
  ) {
    return true;
  }
  const allowlist = (process.env.ALLOWED_SEED_DEPLOYMENTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return allowlist.includes(name);
}

export const assertNonProd = internalQuery({
  args: {},
  handler: async (_ctx): Promise<{ deployment: string }> => {
    const deployment = process.env.CONVEX_DEPLOYMENT ?? '';
    if (!isAllowedDeployment(deployment)) {
      throw typedError(
        'production_deployment_blocked',
        `deployment=${deployment || '<unset>'} is not allow-listed for seed runs`,
      );
    }
    return { deployment };
  },
});

// ---------------------------------------------------------------------------
// Gym + user bootstrap
// ---------------------------------------------------------------------------

const ensureGymsArgs = v.object({
  gyms: v.array(v.object({ name: v.string(), city: v.optional(v.string()) })),
});

export const ensureGyms = internalMutation({
  args: ensureGymsArgs,
  handler: async (ctx, { gyms }): Promise<readonly Id<'gyms'>[]> => {
    const ids: Id<'gyms'>[] = [];
    const all = await ctx.db.query('gyms').collect();
    for (const g of gyms) {
      const lower = g.name.toLowerCase();
      const match = all.find((row) => row.name.toLowerCase() === lower);
      if (match !== undefined) {
        ids.push(match._id);
      } else {
        const id = await ctx.db.insert('gyms', { name: g.name, city: g.city });
        ids.push(id);
      }
    }
    return ids;
  },
});

// ---------------------------------------------------------------------------
// Wipe — only touches `isSeed: true` users. Real accounts never enumerated.
// ---------------------------------------------------------------------------

export const wipeSeedUsers = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ usersDeleted: number; sessionsDeleted: number; attemptsDeleted: number; followsDeleted: number; reportsDeleted: number }> => {
    const seedUsers = await ctx.db
      .query('users')
      .withIndex('byIsSeed', (q) => q.eq('isSeed', true))
      .collect();
    let usersDeleted = 0;
    let sessionsDeleted = 0;
    let attemptsDeleted = 0;
    let followsDeleted = 0;
    let reportsDeleted = 0;

    for (const u of seedUsers) {
      // Weekly reports
      const reports = await ctx.db
        .query('weeklyReports')
        .withIndex('byUserAndWeekStart', (q) => q.eq('userId', u._id))
        .collect();
      for (const r of reports) {
        await ctx.db.delete(r._id);
        reportsDeleted += 1;
      }

      // Follows (both directions)
      const outgoing = await ctx.db
        .query('follows')
        .withIndex('byFollower', (q) => q.eq('followerId', u._id))
        .collect();
      for (const f of outgoing) {
        await ctx.db.delete(f._id);
        followsDeleted += 1;
      }
      const incoming = await ctx.db
        .query('follows')
        .withIndex('byFollowee', (q) => q.eq('followeeId', u._id))
        .collect();
      for (const f of incoming) {
        await ctx.db.delete(f._id);
        followsDeleted += 1;
      }

      // Sessions + attempts
      const sessions = await ctx.db
        .query('sessions')
        .withIndex('byUserAndDate', (q) => q.eq('userId', u._id))
        .collect();
      for (const s of sessions) {
        const attempts = await ctx.db
          .query('attempts')
          .withIndex('bySession', (q) => q.eq('sessionId', s._id))
          .collect();
        for (const a of attempts) {
          await ctx.db.delete(a._id);
          attemptsDeleted += 1;
        }
        await ctx.db.delete(s._id);
        sessionsDeleted += 1;
      }

      // Clean up auth-side rows (authAccounts, authSessions, authRefreshTokens).
      // We iterate without an index because the exact index names belong to
      // Convex Auth and may change between minor versions; the seed wipe runs
      // on tiny N so the full-table scan is fine.
      const authAccounts = await ctx.db.query('authAccounts').collect();
      for (const aa of authAccounts) {
        if ((aa as { userId?: Id<'users'> }).userId === u._id) {
          await ctx.db.delete(aa._id);
        }
      }
      const authSessions = await ctx.db.query('authSessions').collect();
      for (const as of authSessions) {
        if ((as as { userId?: Id<'users'> }).userId === u._id) {
          await ctx.db.delete(as._id);
        }
      }

      await ctx.db.delete(u._id);
      usersDeleted += 1;
    }

    return { usersDeleted, sessionsDeleted, attemptsDeleted, followsDeleted, reportsDeleted };
  },
});

// ---------------------------------------------------------------------------
// Follows — explicit insert, used by the action for the mutual-follow step.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Seed user creation — uses Convex Auth's `createAccount` so seed users go
// through the same plumbing as real signUp (Password provider scrypt hash +
// authAccounts row + users row).
// ---------------------------------------------------------------------------

const createSeedUserArgs = v.object({
  email: v.string(),
  password: v.string(),
  displayName: v.string(),
});

export const createSeedUserMutation = internalMutation({
  args: createSeedUserArgs,
  handler: async (ctx, { email, password, displayName }): Promise<{ userId: Id<'users'> }> => {
    // Idempotency: if the seed user already exists (e.g. partial prior run),
    // reuse the row instead of inserting a duplicate.
    const existing = await ctx.db
      .query('users')
      .withIndex('email', (q) => q.eq('email', email))
      .first();
    if (existing !== null) {
      await ctx.db.patch(existing._id, { isSeed: true, displayName });
      return { userId: existing._id };
    }

    const { user } = await createAccount(ctx, {
      provider: 'password',
      account: {
        id: email,
        secret: password,
      },
      profile: {
        email,
        displayName,
        isSeed: true,
      },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });
    // Convex Auth's Password provider re-runs the `profile()` callback in
    // `auth.ts` to shape the row it inserts. That callback only looks at
    // params, so `isSeed: true` from the explicit `profile` above gets
    // overwritten back to `false`. Patch directly to restore the flag —
    // both `wipeSeedUsers` and the `byIsSeed` index depend on it.
    const userId = user._id as Id<'users'>;
    await ctx.db.patch(userId, { isSeed: true });
    return { userId };
  },
});

export const insertFollow = internalMutation({
  args: { followerId: v.id('users'), followeeId: v.id('users') },
  handler: async (ctx, { followerId, followeeId }): Promise<{ followId: Id<'follows'> }> => {
    const existing = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowee', (q) =>
        q.eq('followerId', followerId).eq('followeeId', followeeId),
      )
      .first();
    if (existing !== null) {
      return { followId: existing._id };
    }
    const followId = await ctx.db.insert('follows', {
      followerId,
      followeeId,
      createdAt: Date.now(),
    });
    return { followId };
  },
});
