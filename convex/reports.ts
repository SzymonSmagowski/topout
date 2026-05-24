/**
 * Weekly reports — public queries + internal mutations / queries used by
 * the `generateReport` action (which lives in `reportsActions.ts` because it
 * needs the Node runtime for `fetch`).
 *
 * @see apps/topout/docs/architecture.md §5.6
 */
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  query,
} from './_generated/server';
import { requireUser } from './lib/auth';
import { vReportStatus } from './lib/enums';
import { typedError } from './lib/errors';

interface SessionWithAttemptsRow {
  readonly sessionId: Id<'sessions'>;
  readonly date: number;
  readonly perceivedEffort: number;
  readonly durationMinutes: number | null;
  readonly notes: string | null;
  readonly gym: { readonly name: string };
  readonly attempts: ReadonlyArray<{
    readonly grade: Doc<'attempts'>['grade'];
    readonly outcome: Doc<'attempts'>['outcome'];
    readonly attemptCount: number;
    readonly notes: string | null;
  }>;
}
export type { SessionWithAttemptsRow };

// ---------------------------------------------------------------------------
// Internal helpers — called by the action via ctx.runMutation / ctx.runQuery.
// ---------------------------------------------------------------------------

const upsertPendingArgs = v.object({
  userId: v.id('users'),
  weekStart: v.number(),
  weekEnd: v.number(),
});

export const upsertPending = internalMutation({
  args: upsertPendingArgs,
  handler: async (ctx, { userId, weekStart, weekEnd }): Promise<{ reportId: Id<'weeklyReports'> }> => {
    const existing = await ctx.db
      .query('weeklyReports')
      .withIndex('byUserAndWeekStart', (q) =>
        q.eq('userId', userId).eq('weekStart', weekStart),
      )
      .first();
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        weekEnd,
        status: 'pending',
        narrativeMd: null,
        statsJson: null,
        model: null,
        generatedAt: null,
        error: null,
      });
      return { reportId: existing._id };
    }
    const reportId = await ctx.db.insert('weeklyReports', {
      userId,
      weekStart,
      weekEnd,
      status: 'pending',
      narrativeMd: null,
      statsJson: null,
      model: null,
      generatedAt: null,
      error: null,
    });
    return { reportId };
  },
});

const patchResultArgs = v.object({
  reportId: v.id('weeklyReports'),
  status: vReportStatus,
  narrativeMd: v.union(v.string(), v.null()),
  statsJson: v.union(v.string(), v.null()),
  model: v.union(v.string(), v.null()),
  generatedAt: v.union(v.number(), v.null()),
  error: v.union(v.string(), v.null()),
});

export const patchResult = internalMutation({
  args: patchResultArgs,
  handler: async (ctx, args): Promise<null> => {
    await ctx.db.patch(args.reportId, {
      status: args.status,
      narrativeMd: args.narrativeMd,
      statsJson: args.statsJson,
      model: args.model,
      generatedAt: args.generatedAt,
      error: args.error,
    });
    return null;
  },
});

export const loadWeekInternal = internalQuery({
  args: { userId: v.id('users'), weekStart: v.number(), weekEnd: v.number() },
  handler: async (ctx, { userId, weekStart, weekEnd }): Promise<readonly SessionWithAttemptsRow[]> => {
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('byUserAndDate', (q) =>
        q.eq('userId', userId).gte('date', weekStart).lte('date', weekEnd),
      )
      .collect();
    const rows: SessionWithAttemptsRow[] = [];
    for (const s of sessions) {
      const gym = await ctx.db.get(s.gymId);
      const attempts = await ctx.db
        .query('attempts')
        .withIndex('bySession', (q) => q.eq('sessionId', s._id))
        .collect();
      rows.push({
        sessionId: s._id,
        date: s.date,
        perceivedEffort: s.perceivedEffort,
        durationMinutes: s.durationMinutes ?? null,
        notes: s.notes ?? null,
        gym: { name: gym?.name ?? 'Unknown gym' },
        attempts: attempts.map((a) => ({
          grade: a.grade,
          outcome: a.outcome,
          attemptCount: a.attemptCount,
          notes: a.notes ?? null,
        })),
      });
    }
    rows.sort((a, b) => a.date - b.date);
    return rows;
  },
});

export const loadUserInternal = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<{ displayName: string; userId: Id<'users'> } | null> => {
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    return { displayName: user.displayName, userId: user._id };
  },
});

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export const listReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<readonly Doc<'weeklyReports'>[]> => {
    const userId = await requireUser(ctx);
    const cap = Math.min(limit ?? 20, 100);
    const rows = await ctx.db
      .query('weeklyReports')
      .withIndex('byUserAndWeekStart', (q) => q.eq('userId', userId))
      .collect();
    rows.sort((a, b) => b.weekStart - a.weekStart);
    return rows.slice(0, cap);
  },
});

export const getReport = query({
  args: { reportId: v.id('weeklyReports') },
  handler: async (ctx, { reportId }): Promise<Doc<'weeklyReports'> | null> => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(reportId);
    if (row === null) return null;
    if (row.userId !== userId) {
      throw typedError('not_following', 'reports are private');
    }
    return row;
  },
});
