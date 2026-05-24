/**
 * Attempt-table helpers. Attempts are always queried in the context of a
 * single session via the `bySession` index; we never list attempts globally.
 *
 * Public callers go through `sessions.getById` which joins attempts in.
 * The internal helpers below exist for the summarize action + dashboard
 * aggregation queries.
 */
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { internalQuery, type QueryCtx } from './_generated/server';

export async function bySessionInternal(
  ctx: QueryCtx,
  sessionId: Id<'sessions'>,
): Promise<readonly Doc<'attempts'>[]> {
  return await ctx.db
    .query('attempts')
    .withIndex('bySession', (q) => q.eq('sessionId', sessionId))
    .collect();
}

/** Exposed for the summarize action to load attempts via `ctx.runQuery`. */
export const listBySession = internalQuery({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }) => {
    return await bySessionInternal(ctx, sessionId);
  },
});
