/**
 * Sessions — CRUD. Owner-scoped writes; reads gated by `requireFollowing`
 * for partner views. Mutations schedule `internal.summarizeActions.run` so the AI
 * coach blurb regenerates whenever a session is created or updated.
 *
 * Indexes used:
 *   sessions.byUserAndDate — list & dashboard window queries
 *   attempts.bySession     — child fan-out and cascade delete
 *
 * @see apps/topout/docs/architecture.md §5.2
 */
import { v, type Infer } from 'convex/values';

import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from './_generated/server';
import { bySessionInternal } from './attempts';
import { requireFollowing, requireOwner, requireUser } from './lib/auth';
import {
  V_GRADES,
  isSent,
  vGrade,
  vOutcome,
  vSummaryStatus,
  type VGrade,
} from './lib/enums';
import { typedError } from './lib/errors';
import { startOfDayUtc } from './lib/time';

const MAX_ATTEMPTS_PER_SESSION = 64;
const DEFAULT_LIST_LIMIT = 50;

// ---------------------------------------------------------------------------
// Shared validators + derived types
// ---------------------------------------------------------------------------

const attemptInput = v.object({
  grade: vGrade,
  outcome: vOutcome,
  attemptCount: v.number(),
  notes: v.optional(v.string()),
});
export type AttemptInput = Infer<typeof attemptInput>;

const sessionInputCore = {
  date: v.number(),
  gymId: v.id('gyms'),
  perceivedEffort: v.number(),
  notes: v.optional(v.string()),
  durationMinutes: v.optional(v.number()),
  attempts: v.array(attemptInput),
};

const createSessionArgs = v.object(sessionInputCore);
export type CreateSessionArgs = Infer<typeof createSessionArgs>;

const updateSessionArgs = v.object({
  sessionId: v.id('sessions'),
  ...sessionInputCore,
});
export type UpdateSessionArgs = Infer<typeof updateSessionArgs>;

// ---------------------------------------------------------------------------
// Output types (hand-rolled `Infer`-style aliases — Convex doesn't infer
// returns without an explicit returns validator).
// ---------------------------------------------------------------------------

export interface SessionWithSummary {
  readonly _id: Id<'sessions'>;
  readonly _creationTime: number;
  readonly userId: Id<'users'>;
  readonly date: number;
  readonly gymId: Id<'gyms'>;
  readonly gymName: string;
  readonly perceivedEffort: number;
  readonly durationMinutes: number | undefined;
  readonly notes: string | undefined;
  readonly summary: string | null;
  readonly summaryStatus: Doc<'sessions'>['summaryStatus'];
  readonly summaryError: string | null;
  readonly topGrade: VGrade | null;
  readonly sendCount: number;
  readonly attemptsCount: number;
}

export interface SessionDetail extends SessionWithSummary {
  readonly attempts: readonly Doc<'attempts'>[];
}

// ---------------------------------------------------------------------------
// Validation helpers (shared by create + update + the seed internal mutation).
// ---------------------------------------------------------------------------

interface ValidatedSession {
  readonly date: number;
  readonly perceivedEffort: number;
  readonly attempts: readonly AttemptInput[];
}

function validateSessionShape(
  args: { date: number; perceivedEffort: number; attempts: readonly AttemptInput[] },
  options: { allowFutureDate: boolean },
): ValidatedSession {
  if (!options.allowFutureDate) {
    const today = startOfDayUtc(Date.now());
    const day = startOfDayUtc(args.date);
    if (day > today) {
      throw typedError('future_date');
    }
  }
  if (args.perceivedEffort < 1 || args.perceivedEffort > 10) {
    throw typedError('invalid_effort');
  }
  if (args.attempts.length === 0) {
    throw typedError('invalid_attempts_empty');
  }
  if (args.attempts.length > MAX_ATTEMPTS_PER_SESSION) {
    throw typedError('invalid_attempts_empty', 'too many attempts');
  }
  for (const a of args.attempts) {
    if (!Number.isFinite(a.attemptCount) || a.attemptCount < 1) {
      throw typedError('invalid_attempt_count');
    }
  }
  return args;
}

async function assertGymExists(ctx: MutationCtx, gymId: Id<'gyms'>): Promise<void> {
  const gym = await ctx.db.get(gymId);
  if (gym === null) {
    throw typedError('gym_not_found');
  }
}

async function deleteAttemptsFor(
  ctx: MutationCtx,
  sessionId: Id<'sessions'>,
): Promise<void> {
  const attempts = await ctx.db
    .query('attempts')
    .withIndex('bySession', (q) => q.eq('sessionId', sessionId))
    .collect();
  for (const a of attempts) {
    await ctx.db.delete(a._id);
  }
}

async function insertAttemptsFor(
  ctx: MutationCtx,
  sessionId: Id<'sessions'>,
  attempts: readonly AttemptInput[],
): Promise<void> {
  for (const a of attempts) {
    await ctx.db.insert('attempts', {
      sessionId,
      grade: a.grade,
      outcome: a.outcome,
      attemptCount: a.attemptCount,
      notes: a.notes,
    });
  }
}

// ---------------------------------------------------------------------------
// Hydration helpers (server-side, so the client never aggregates raw rows).
// ---------------------------------------------------------------------------

function topGradeIn(attempts: readonly Doc<'attempts'>[]): VGrade | null {
  let bestIdx = -1;
  let best: VGrade | null = null;
  for (const a of attempts) {
    if (!isSent(a.outcome)) continue;
    const idx = gradeOrdinal(a.grade);
    if (idx > bestIdx) {
      bestIdx = idx;
      best = a.grade;
    }
  }
  return best;
}

function sendCountOf(attempts: readonly Doc<'attempts'>[]): number {
  let total = 0;
  for (const a of attempts) {
    if (isSent(a.outcome)) total += a.attemptCount;
  }
  return total;
}

function attemptsCountOf(attempts: readonly Doc<'attempts'>[]): number {
  let total = 0;
  for (const a of attempts) total += a.attemptCount;
  return total;
}

function gradeOrdinal(grade: VGrade): number {
  return V_GRADES.indexOf(grade);
}

async function hydrateOne(
  ctx: QueryCtx,
  session: Doc<'sessions'>,
): Promise<SessionWithSummary> {
  const attempts = await ctx.db
    .query('attempts')
    .withIndex('bySession', (q) => q.eq('sessionId', session._id))
    .collect();
  const gym = await ctx.db.get(session.gymId);
  return {
    _id: session._id,
    _creationTime: session._creationTime,
    userId: session.userId,
    date: session.date,
    gymId: session.gymId,
    gymName: gym?.name ?? 'Unknown gym',
    perceivedEffort: session.perceivedEffort,
    durationMinutes: session.durationMinutes,
    notes: session.notes,
    summary: session.summary,
    summaryStatus: session.summaryStatus,
    summaryError: session.summaryError,
    topGrade: topGradeIn(attempts),
    sendCount: sendCountOf(attempts),
    attemptsCount: attemptsCountOf(attempts),
  };
}

// ---------------------------------------------------------------------------
// Public mutations
// ---------------------------------------------------------------------------

export const createSession = mutation({
  args: createSessionArgs,
  handler: async (ctx, args): Promise<{ sessionId: Id<'sessions'> }> => {
    const userId = await requireUser(ctx);
    validateSessionShape(args, { allowFutureDate: false });
    await assertGymExists(ctx, args.gymId);

    const sessionId = await ctx.db.insert('sessions', {
      userId,
      date: args.date,
      gymId: args.gymId,
      perceivedEffort: args.perceivedEffort,
      notes: args.notes,
      durationMinutes: args.durationMinutes,
      createdAt: Date.now(),
      summary: null,
      summaryStatus: 'pending',
      summaryError: null,
    });
    await insertAttemptsFor(ctx, sessionId, args.attempts);

    await ctx.scheduler.runAfter(0, internal.summarizeActions.run, { sessionId });
    return { sessionId };
  },
});

export const updateSession = mutation({
  args: updateSessionArgs,
  handler: async (ctx, args): Promise<{ sessionId: Id<'sessions'> }> => {
    await requireOwner(ctx, args.sessionId);
    validateSessionShape(args, { allowFutureDate: false });
    await assertGymExists(ctx, args.gymId);

    await ctx.db.patch(args.sessionId, {
      date: args.date,
      gymId: args.gymId,
      perceivedEffort: args.perceivedEffort,
      notes: args.notes,
      durationMinutes: args.durationMinutes,
      summary: null,
      summaryStatus: 'pending',
      summaryError: null,
    });
    await deleteAttemptsFor(ctx, args.sessionId);
    await insertAttemptsFor(ctx, args.sessionId, args.attempts);

    await ctx.scheduler.runAfter(0, internal.summarizeActions.run, {
      sessionId: args.sessionId,
    });
    return { sessionId: args.sessionId };
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }): Promise<null> => {
    await requireOwner(ctx, sessionId);
    await deleteAttemptsFor(ctx, sessionId);
    await ctx.db.delete(sessionId);
    return null;
  },
});

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export const listOwn = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }): Promise<readonly SessionWithSummary[]> => {
    const userId = await requireUser(ctx);
    const cap = Math.min(limit ?? DEFAULT_LIST_LIMIT, 200);
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('byUserAndDate', (q) => q.eq('userId', userId))
      .order('desc')
      .take(cap);
    const out: SessionWithSummary[] = [];
    for (const s of sessions) {
      out.push(await hydrateOne(ctx, s));
    }
    return out;
  },
});

export const listForUser = query({
  args: { userId: v.id('users'), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }): Promise<readonly SessionWithSummary[]> => {
    await requireFollowing(ctx, userId);
    const cap = Math.min(limit ?? DEFAULT_LIST_LIMIT, 200);
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('byUserAndDate', (q) => q.eq('userId', userId))
      .order('desc')
      .take(cap);
    const out: SessionWithSummary[] = [];
    for (const s of sessions) {
      out.push(await hydrateOne(ctx, s));
    }
    return out;
  },
});

export const getById = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }): Promise<SessionDetail | null> => {
    const session = await ctx.db.get(sessionId);
    if (session === null) return null;
    await requireFollowing(ctx, session.userId);
    const hydrated = await hydrateOne(ctx, session);
    const attempts = await bySessionInternal(ctx, sessionId);
    return { ...hydrated, attempts };
  },
});

// ---------------------------------------------------------------------------
// Internal — used by the summarize action and the seed action.
// ---------------------------------------------------------------------------

export const getInternal = internalQuery({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db.get(sessionId);
  },
});

const patchSummaryArgs = v.object({
  sessionId: v.id('sessions'),
  summary: v.union(v.string(), v.null()),
  status: vSummaryStatus,
  error: v.union(v.string(), v.null()),
});

export const patchSummary = internalMutation({
  args: patchSummaryArgs,
  handler: async (ctx, { sessionId, summary, status, error }): Promise<null> => {
    await ctx.db.patch(sessionId, {
      summary,
      summaryStatus: status,
      summaryError: error,
    });
    return null;
  },
});

/**
 * Seed-only insert that skips the `date <= today` validation (seed dates are
 * deliberately historical) and skips scheduling summarize (seed pre-populates
 * a templated summary). Still enforces attempt validation so the seed can't
 * drift from the production schema.
 */
const seedInsertArgs = v.object({
  userId: v.id('users'),
  date: v.number(),
  gymId: v.id('gyms'),
  perceivedEffort: v.number(),
  notes: v.optional(v.string()),
  durationMinutes: v.optional(v.number()),
  attempts: v.array(attemptInput),
  templatedSummary: v.string(),
});

export const seedInsert = internalMutation({
  args: seedInsertArgs,
  handler: async (ctx, args): Promise<{ sessionId: Id<'sessions'> }> => {
    validateSessionShape(args, { allowFutureDate: true });
    const sessionId = await ctx.db.insert('sessions', {
      userId: args.userId,
      date: args.date,
      gymId: args.gymId,
      perceivedEffort: args.perceivedEffort,
      notes: args.notes,
      durationMinutes: args.durationMinutes,
      createdAt: Date.now(),
      summary: args.templatedSummary,
      summaryStatus: 'ok',
      summaryError: null,
    });
    await insertAttemptsFor(ctx, sessionId, args.attempts);
    return { sessionId };
  },
});
