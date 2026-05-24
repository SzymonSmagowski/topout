/**
 * Public user queries — the missing piece the frontend (`AppShell`, dashboard,
 * `partners/[userId]`) was already importing as `api.users.viewer` and
 * `api.users.getPublic`.
 *
 * Two queries, two intentions:
 *
 * - `viewer` is intentionally "soft" auth: it returns `null` rather than
 *   throwing when the caller is unauthenticated, so the shell can render the
 *   sign-in CTA without `useQuery` ever erroring. Internal app routes still
 *   gate behind the `convexAuthNextjsMiddleware` redirect, so an
 *   unauthenticated viewer never sees gated data — they see the landing.
 *
 * - `getPublic` deliberately strips internal fields (`email`, `isSeed`,
 *   `_creationTime`) and returns only the display surface a partner page
 *   needs. Authorization still flows through `requireFollowing` on the data
 *   queries (`dashboard.kpiStats`, etc.) — `getPublic` is for chrome only.
 */
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { query } from './_generated/server';

export interface PublicUser {
  readonly _id: Id<'users'>;
  readonly displayName: string;
}

export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('users'),
      displayName: v.string(),
      email: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (
    ctx,
  ): Promise<{
    readonly _id: Id<'users'>;
    readonly displayName: string;
    readonly email: string | null;
  } | null> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user: Doc<'users'> | null = await ctx.db.get(userId);
    if (user === null) {
      return null;
    }
    return {
      _id: user._id,
      displayName: user.displayName,
      email: user.email ?? null,
    };
  },
});

export const getPublic = query({
  args: { userId: v.id('users') },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('users'),
      displayName: v.string(),
    }),
  ),
  handler: async (ctx, { userId }): Promise<PublicUser | null> => {
    const user: Doc<'users'> | null = await ctx.db.get(userId);
    if (user === null) {
      return null;
    }
    return {
      _id: user._id,
      displayName: user.displayName,
    };
  },
});
