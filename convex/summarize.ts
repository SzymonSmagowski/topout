/**
 * Per-session AI coach blurb — public retry mutation.
 *
 * The internal action that actually calls OpenAI lives in
 * `summarizeActions.ts` because it requires the Node runtime
 * (`'use node';`). Mutations cannot share a module with the Node action.
 *
 * @see apps/topout/docs/architecture.md §5.5
 */
import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { mutation } from './_generated/server';
import { requireOwner } from './lib/auth';
import { typedError } from './lib/errors';

const RETRY_WINDOW_MS = 5_000;

/**
 * Module-scoped rate-limit cache. The architect's note: this only catches
 * accidental double-clicks within one function instance — not a true
 * distributed rate limit. Acceptable for v1; the cost ceiling of a runaway
 * loop is small.
 */
const lastRetryAt = new Map<string, number>();

export const retrySummary = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, { sessionId }): Promise<null> => {
    await requireOwner(ctx, sessionId);

    const now = Date.now();
    const key = sessionId as unknown as string;
    const last = lastRetryAt.get(key);
    if (last !== undefined && now - last < RETRY_WINDOW_MS) {
      throw typedError('summary_retry_rate_limited');
    }
    lastRetryAt.set(key, now);

    await ctx.db.patch(sessionId as Id<'sessions'>, {
      summary: null,
      summaryStatus: 'pending',
      summaryError: null,
    });
    await ctx.scheduler.runAfter(0, internal.summarizeActions.run, { sessionId });
    return null;
  },
});
