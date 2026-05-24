/**
 * Authorization helpers. Every public Convex function goes through one of
 * these before touching `ctx.db`. The BackendTester's contract test greps
 * each handler in `sessions.ts`, `dashboard.ts`, `follows.ts`, etc. for one
 * of these names.
 *
 * @see apps/topout/docs/architecture.md §3
 */
import { getAuthUserId } from '@convex-dev/auth/server';

import type { Doc, Id } from '../_generated/dataModel';
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server';
import { typedError } from './errors';

type AnyCtx = QueryCtx | MutationCtx | ActionCtx;

/**
 * Returns the current user's id, or throws `not_authenticated` if no JWT.
 * Use in every authenticated query/mutation/action.
 */
export async function requireUser(ctx: AnyCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw typedError('not_authenticated');
  }
  return userId;
}

export interface OwnerResult {
  readonly userId: Id<'users'>;
  readonly session: Doc<'sessions'>;
}

/**
 * Loads a session and asserts the caller owns it. Throws
 * `session_not_found` if the row is missing, `not_session_owner` if it
 * belongs to someone else. Use in updateSession, deleteSession,
 * retrySummary, and any owner-only mutation.
 */
export async function requireOwner(
  ctx: MutationCtx,
  sessionId: Id<'sessions'>,
): Promise<OwnerResult> {
  const userId = await requireUser(ctx);
  const session = await ctx.db.get(sessionId);
  if (session === null) {
    throw typedError('session_not_found');
  }
  if (session.userId !== userId) {
    throw typedError('not_session_owner');
  }
  return { userId, session };
}

/**
 * Asserts the caller follows `targetUserId` (or is `targetUserId`).
 * `viewer === target` short-circuits to ok so the dashboard component
 * re-uses the same queries for self and partner views.
 */
export async function requireFollowing(
  ctx: QueryCtx,
  targetUserId: Id<'users'>,
): Promise<Id<'users'>> {
  const viewerId = await requireUser(ctx);
  if (viewerId === targetUserId) {
    return viewerId;
  }
  const follow = await ctx.db
    .query('follows')
    .withIndex('byFollowerAndFollowee', (q) =>
      q.eq('followerId', viewerId).eq('followeeId', targetUserId),
    )
    .first();
  if (follow === null) {
    throw typedError('not_following');
  }
  return viewerId;
}
