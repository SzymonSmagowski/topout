/**
 * Dashboard queries. All aggregation server-side — clients render only.
 *
 * Every query takes `{ userId, window }` and gates on `requireFollowing` so
 * the same query family powers both the current user's dashboard and a
 * partner's dashboard (`viewer === target` short-circuits to ok).
 *
 * Indexes used:
 *   sessions.byUserAndDate — window-bounded scan
 *   attempts.bySession     — child fan-out per session
 *
 * @see apps/topout/docs/architecture.md §5.3
 */
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { internalQuery, query, type QueryCtx } from './_generated/server';
import { requireFollowing } from './lib/auth';
import {
  V_GRADES,
  isSent,
  vTimeWindow,
  type TimeWindow,
  type VGrade,
} from './lib/enums';
import { weekStartFor, windowStart } from './lib/time';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface KpiStats {
  readonly sessionsCount: number;
  readonly topGradeEver: VGrade | null;
  readonly topGradeEverDate: number | null;
  readonly sendRate: number;
  readonly totalAttempts: number;
}

export interface SendPyramidBin {
  readonly grade: VGrade;
  readonly sends: number;
}

export interface WeeklyVolumeBin {
  readonly weekStart: number;
  readonly sessions: number;
  readonly attempts: number;
}

export interface GradeAttemptBin {
  readonly grade: VGrade;
  readonly attempts: number;
}

export interface SendRateTrendBin {
  readonly weekStart: number;
  readonly sendRate: number;
  readonly baselineSendRate: number;
}

// ---------------------------------------------------------------------------
// Shared loaders
// ---------------------------------------------------------------------------

async function loadWindowSessions(
  ctx: QueryCtx,
  userId: Id<'users'>,
  window: TimeWindow,
): Promise<readonly Doc<'sessions'>[]> {
  const start = windowStart(window, Date.now());
  return await ctx.db
    .query('sessions')
    .withIndex('byUserAndDate', (q) => q.eq('userId', userId).gte('date', start))
    .collect();
}

async function loadAttemptsForSessions(
  ctx: QueryCtx,
  sessions: readonly Doc<'sessions'>[],
): Promise<readonly Doc<'attempts'>[]> {
  const all: Doc<'attempts'>[] = [];
  for (const s of sessions) {
    const rows = await ctx.db
      .query('attempts')
      .withIndex('bySession', (q) => q.eq('sessionId', s._id))
      .collect();
    all.push(...rows);
  }
  return all;
}

function sendRateOf(attempts: readonly Doc<'attempts'>[]): number {
  let total = 0;
  let sent = 0;
  for (const a of attempts) {
    total += a.attemptCount;
    if (isSent(a.outcome)) sent += a.attemptCount;
  }
  return total === 0 ? 0 : sent / total;
}

function totalAttemptsOf(attempts: readonly Doc<'attempts'>[]): number {
  let total = 0;
  for (const a of attempts) total += a.attemptCount;
  return total;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const baseArgs = { userId: v.id('users'), window: vTimeWindow } as const;

export const kpiStats = query({
  args: baseArgs,
  handler: async (ctx, { userId, window }): Promise<KpiStats> => {
    await requireFollowing(ctx, userId);
    const sessions = await loadWindowSessions(ctx, userId, window);
    const attempts = await loadAttemptsForSessions(ctx, sessions);

    // Top grade ever — window-independent per spec.
    const allSessions = await ctx.db
      .query('sessions')
      .withIndex('byUserAndDate', (q) => q.eq('userId', userId))
      .collect();
    let bestIdx = -1;
    let topGradeEver: VGrade | null = null;
    let topGradeEverDate: number | null = null;
    for (const s of allSessions) {
      const rows = await ctx.db
        .query('attempts')
        .withIndex('bySession', (q) => q.eq('sessionId', s._id))
        .collect();
      for (const a of rows) {
        if (!isSent(a.outcome)) continue;
        const idx = V_GRADES.indexOf(a.grade);
        if (idx > bestIdx) {
          bestIdx = idx;
          topGradeEver = a.grade;
          topGradeEverDate = s.date;
        }
      }
    }

    return {
      sessionsCount: sessions.length,
      topGradeEver,
      topGradeEverDate,
      sendRate: sendRateOf(attempts),
      totalAttempts: totalAttemptsOf(attempts),
    };
  },
});

export const sendPyramid = query({
  args: baseArgs,
  handler: async (ctx, { userId, window }): Promise<readonly SendPyramidBin[]> => {
    await requireFollowing(ctx, userId);
    const sessions = await loadWindowSessions(ctx, userId, window);
    const attempts = await loadAttemptsForSessions(ctx, sessions);
    const bins = new Map<VGrade, number>();
    for (const a of attempts) {
      if (!isSent(a.outcome)) continue;
      bins.set(a.grade, (bins.get(a.grade) ?? 0) + a.attemptCount);
    }
    const out: SendPyramidBin[] = [];
    for (const grade of V_GRADES) {
      const count = bins.get(grade) ?? 0;
      if (count > 0) out.push({ grade, sends: count });
    }
    return out;
  },
});

export const weeklyVolume = query({
  args: baseArgs,
  handler: async (ctx, { userId, window }): Promise<readonly WeeklyVolumeBin[]> => {
    await requireFollowing(ctx, userId);
    const sessions = await loadWindowSessions(ctx, userId, window);
    const sessionCountsByWeek = new Map<number, number>();
    const attemptCountsByWeek = new Map<number, number>();
    for (const s of sessions) {
      const wk = weekStartFor(s.date);
      sessionCountsByWeek.set(wk, (sessionCountsByWeek.get(wk) ?? 0) + 1);
      const rows = await ctx.db
        .query('attempts')
        .withIndex('bySession', (q) => q.eq('sessionId', s._id))
        .collect();
      let weekAttempts = 0;
      for (const a of rows) weekAttempts += a.attemptCount;
      attemptCountsByWeek.set(wk, (attemptCountsByWeek.get(wk) ?? 0) + weekAttempts);
    }
    const weeks = [...sessionCountsByWeek.keys()].sort((a, b) => a - b);
    return weeks.map((wk) => ({
      weekStart: wk,
      sessions: sessionCountsByWeek.get(wk) ?? 0,
      attempts: attemptCountsByWeek.get(wk) ?? 0,
    }));
  },
});

export const gradeAttemptDist = query({
  args: baseArgs,
  handler: async (ctx, { userId, window }): Promise<readonly GradeAttemptBin[]> => {
    await requireFollowing(ctx, userId);
    const sessions = await loadWindowSessions(ctx, userId, window);
    const attempts = await loadAttemptsForSessions(ctx, sessions);
    const bins = new Map<VGrade, number>();
    for (const a of attempts) {
      bins.set(a.grade, (bins.get(a.grade) ?? 0) + a.attemptCount);
    }
    const out: GradeAttemptBin[] = [];
    for (const grade of V_GRADES) {
      const attemptsCount = bins.get(grade) ?? 0;
      if (attemptsCount > 0) out.push({ grade, attempts: attemptsCount });
    }
    return out;
  },
});

export const sendRateTrend = query({
  args: baseArgs,
  handler: async (ctx, { userId, window }): Promise<readonly SendRateTrendBin[]> => {
    await requireFollowing(ctx, userId);
    const sessions = await loadWindowSessions(ctx, userId, window);
    const sentByWeek = new Map<number, number>();
    const attemptsByWeek = new Map<number, number>();
    let baselineSent = 0;
    let baselineTotal = 0;
    for (const s of sessions) {
      const wk = weekStartFor(s.date);
      const rows = await ctx.db
        .query('attempts')
        .withIndex('bySession', (q) => q.eq('sessionId', s._id))
        .collect();
      for (const a of rows) {
        attemptsByWeek.set(wk, (attemptsByWeek.get(wk) ?? 0) + a.attemptCount);
        baselineTotal += a.attemptCount;
        if (isSent(a.outcome)) {
          sentByWeek.set(wk, (sentByWeek.get(wk) ?? 0) + a.attemptCount);
          baselineSent += a.attemptCount;
        }
      }
    }
    const baseline = baselineTotal === 0 ? 0 : baselineSent / baselineTotal;
    const weeks = [...attemptsByWeek.keys()].sort((a, b) => a - b);
    return weeks.map((wk) => {
      const total = attemptsByWeek.get(wk) ?? 0;
      const sent = sentByWeek.get(wk) ?? 0;
      return {
        weekStart: wk,
        sendRate: total === 0 ? 0 : sent / total,
        baselineSendRate: baseline,
      };
    });
  },
});

// ---------------------------------------------------------------------------
// Internal baseline loader for the summarize action.
//
// 30-day window: top grade, send rate, total attempts.
// ---------------------------------------------------------------------------

export interface BaselineSnapshot {
  readonly windowDays: number;
  readonly sessionsCount: number;
  readonly sendRate: number;
  readonly topGrade: VGrade | null;
  readonly totalAttempts: number;
}

export const baselineInternal = internalQuery({
  args: { userId: v.id('users'), windowDays: v.number() },
  handler: async (ctx, { userId, windowDays }): Promise<BaselineSnapshot> => {
    const start = Date.now() - windowDays * 86_400_000;
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('byUserAndDate', (q) => q.eq('userId', userId).gte('date', start))
      .collect();
    const attempts = await loadAttemptsForSessions(ctx, sessions);
    let bestIdx = -1;
    let topGrade: VGrade | null = null;
    for (const a of attempts) {
      if (!isSent(a.outcome)) continue;
      const idx = V_GRADES.indexOf(a.grade);
      if (idx > bestIdx) {
        bestIdx = idx;
        topGrade = a.grade;
      }
    }
    return {
      windowDays,
      sessionsCount: sessions.length,
      sendRate: sendRateOf(attempts),
      topGrade,
      totalAttempts: totalAttemptsOf(attempts),
    };
  },
});

