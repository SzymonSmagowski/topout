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

// ---------------------------------------------------------------------------
// Mock weekly reports — for `pnpm seed --reports N`.
//
// Direct-inserts a weeklyReports row with REAL stats computed from the
// seed user's sessions in that week, plus a TEMPLATED narrative that quotes
// those numbers. The trailing disclaimer line marks the report as mocked so
// nobody mistakes it for a real LangGraph + OpenAI generation.
// ---------------------------------------------------------------------------

const SENT_OUTCOMES = new Set(['flash', 'send', 'repeat']);

// Grade rank for "top grade" comparisons. Mirrors V_GRADES order.
const GRADE_RANK: Readonly<Record<string, number>> = {
  VB: 0, V0: 1, V1: 2, V2: 3, V3: 4, V4: 5, V5: 6, V6: 7, V7: 8, V8: 9,
  V9: 10, V10: 11, V11: 12, V12: 13, V13: 14, V14: 15, V15: 16, V16: 17, V17: 18,
};

interface WeekStats {
  readonly sessions: number;
  readonly gyms: number;
  readonly sends: number;
  readonly attempts: number;
  readonly sendRate: number; // 0..1
  readonly topGrade: string | null;
  readonly topGradeSends: number;
  readonly avgEffort: number;
  readonly pyramid: Readonly<Record<string, number>>; // grade -> sends
}

function bestGrade(grades: readonly string[]): string | null {
  let best: string | null = null;
  let bestRank = -1;
  for (const g of grades) {
    const r = GRADE_RANK[g] ?? -1;
    if (r > bestRank) {
      bestRank = r;
      best = g;
    }
  }
  return best;
}

function formatPyramid(pyramid: Readonly<Record<string, number>>): string {
  const entries = Object.entries(pyramid)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => (GRADE_RANK[b] ?? 0) - (GRADE_RANK[a] ?? 0));
  if (entries.length === 0) return '_no sends_';
  return entries.map(([g, n]) => `${n}×${g}`).join(', ');
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function buildNarrative(weekStart: number, stats: WeekStats, displayName: string): string {
  const dateStr = formatDate(weekStart);
  const sendRatePct = Math.round(stats.sendRate * 100);

  if (stats.sessions === 0) {
    return [
      `# Week recap — ${dateStr}`,
      '',
      'No sessions logged this week.',
      '',
      '*Mock-seeded report. Real reports use LangGraph → OpenAI via the sidecar.*',
    ].join('\n');
  }

  const lines: string[] = [];
  lines.push(`# Week recap — ${dateStr}`);
  lines.push('');
  lines.push(
    `**${stats.sessions} session${stats.sessions === 1 ? '' : 's'}** at **${stats.gyms} gym${stats.gyms === 1 ? '' : 's'}** this week — ` +
      `**${stats.sends} sends on ${stats.attempts} attempts** (send rate **${sendRatePct}%**).`,
  );
  if (stats.topGrade !== null) {
    lines.push(
      `Top grade: **${stats.topGrade}** (${stats.topGradeSends} send${stats.topGradeSends === 1 ? '' : 's'}).`,
    );
  }
  lines.push('');
  lines.push('## Send pyramid');
  lines.push(formatPyramid(stats.pyramid));
  lines.push('');
  lines.push('## At a glance');
  lines.push(`- Average perceived effort: **${stats.avgEffort.toFixed(1)} / 10**`);
  lines.push(`- Send rate: **${sendRatePct}%**`);
  if (stats.topGrade !== null && stats.topGradeSends >= 2) {
    lines.push(`- **${stats.topGrade}** is becoming a repeatable grade — push for a flash next session.`);
  } else if (stats.topGrade !== null) {
    lines.push(`- **${stats.topGrade}** is a project — back-to-back attempts next session should consolidate it.`);
  }
  lines.push('');
  lines.push('## Coach take');
  if (sendRatePct >= 40) {
    lines.push(
      `${displayName.split(' ')[0]}, the send rate is high — that means the line of difficulty is sitting comfortably. Step up a grade on your warm-up next week.`,
    );
  } else if (sendRatePct >= 20) {
    lines.push(
      `${displayName.split(' ')[0]}, you're spending time on projects rather than ticking low-effort grades. The shape of the pyramid is healthy.`,
    );
  } else {
    lines.push(
      `${displayName.split(' ')[0]}, a lower send rate this week. If it's project work — keep going. If it's fatigue — consider a deload session.`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('*Mock-seeded report. Real reports use LangGraph → OpenAI via the sidecar.*');
  return lines.join('\n');
}

export const insertMockReports = internalMutation({
  args: {
    userId: v.id('users'),
    displayName: v.string(),
    weeksCount: v.number(),
  },
  handler: async (ctx, { userId, displayName, weeksCount }): Promise<{ reportsCreated: number }> => {
    if (weeksCount <= 0) return { reportsCreated: 0 };

    // Compute week boundaries — most recent N completed weeks. Same Monday-UTC
    // anchor as `weekStartFor` so report ranges line up with sessions.
    const now = Date.now();
    const nowD = new Date(now);
    const daysFromMon = (nowD.getUTCDay() + 6) % 7;
    const thisWeekStart = Date.UTC(
      nowD.getUTCFullYear(),
      nowD.getUTCMonth(),
      nowD.getUTCDate() - daysFromMon,
    );
    const WEEK_MS = 7 * 86_400_000;

    const sessions = await ctx.db
      .query('sessions')
      .withIndex('byUserAndDate', (q) => q.eq('userId', userId))
      .collect();

    let reportsCreated = 0;
    for (let i = 1; i <= weeksCount; i += 1) {
      const weekStart = thisWeekStart - i * WEEK_MS;
      const weekEnd = weekStart + WEEK_MS - 1;

      // Idempotent: skip if a report for this week already exists.
      const existing = await ctx.db
        .query('weeklyReports')
        .withIndex('byUserAndWeekStart', (q) =>
          q.eq('userId', userId).eq('weekStart', weekStart),
        )
        .first();
      if (existing !== null) continue;

      const weekSessions = sessions.filter(
        (s) => s.date >= weekStart && s.date <= weekEnd,
      );
      const gymIds = new Set(weekSessions.map((s) => s.gymId));

      let sends = 0;
      let attempts = 0;
      let effortSum = 0;
      const pyramid: Record<string, number> = {};
      const sentGrades: string[] = [];

      for (const s of weekSessions) {
        effortSum += s.perceivedEffort;
        const sessionAttempts = await ctx.db
          .query('attempts')
          .withIndex('bySession', (q) => q.eq('sessionId', s._id))
          .collect();
        for (const a of sessionAttempts) {
          attempts += a.attemptCount;
          if (SENT_OUTCOMES.has(a.outcome)) {
            sends += a.attemptCount;
            sentGrades.push(a.grade);
            pyramid[a.grade] = (pyramid[a.grade] ?? 0) + a.attemptCount;
          }
        }
      }

      const top = bestGrade(sentGrades);
      const stats: WeekStats = {
        sessions: weekSessions.length,
        gyms: gymIds.size,
        sends,
        attempts,
        sendRate: attempts > 0 ? sends / attempts : 0,
        topGrade: top,
        topGradeSends: top === null ? 0 : (pyramid[top] ?? 0),
        avgEffort: weekSessions.length > 0 ? effortSum / weekSessions.length : 0,
        pyramid,
      };

      const narrativeMd = buildNarrative(weekStart, stats, displayName);

      await ctx.db.insert('weeklyReports', {
        userId,
        weekStart,
        weekEnd,
        status: 'ok',
        narrativeMd,
        statsJson: JSON.stringify({
          sends_count: stats.sends,
          top_grade: stats.topGrade,
          send_rate: Math.round(stats.sendRate * 10000) / 10000,
          total_attempts: stats.attempts,
          gyms_visited: stats.gyms,
          longest_send_streak: 0,
          send_rate_delta_prev_week: 0,
          send_rate_delta_baseline: 0,
          top_grade_delta: 0,
        }),
        model: 'mock-seeded',
        generatedAt: now,
        error: null,
      });
      reportsCreated += 1;
    }
    return { reportsCreated };
  },
});
