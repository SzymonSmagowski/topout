/**
 * Follows — asymmetric, no approval. The partner-follow demo's data layer.
 *
 * Indexes used:
 *   follows.byFollowerAndFollowee — uniqueness + the `requireFollowing` lookup
 *   follows.byFollower / byFollowee — lists for the partners UI
 *
 * @see apps/topout/docs/architecture.md §5.4
 */
import { v } from 'convex/values';

import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type QueryCtx } from './_generated/server';
import { requireUser } from './lib/auth';
import { V_GRADES, isSent, type VGrade } from './lib/enums';
import { typedError } from './lib/errors';

export const follow = mutation({
  args: { followeeId: v.id('users') },
  handler: async (ctx, { followeeId }): Promise<{ followId: Id<'follows'> }> => {
    const viewerId = await requireUser(ctx);
    if (viewerId === followeeId) {
      throw typedError('self_follow');
    }
    const target = await ctx.db.get(followeeId);
    if (target === null) {
      // No dedicated kind — `not_following` is the closest match, but the
      // request is well-formed up to "this user doesn't exist". Use the
      // existing kind so we don't grow the enum unnecessarily.
      throw typedError('not_following', 'followee not found');
    }
    const existing = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowee', (q) =>
        q.eq('followerId', viewerId).eq('followeeId', followeeId),
      )
      .first();
    if (existing !== null) {
      throw typedError('already_following');
    }
    const followId = await ctx.db.insert('follows', {
      followerId: viewerId,
      followeeId,
      createdAt: Date.now(),
    });
    return { followId };
  },
});

export const unfollow = mutation({
  args: { followeeId: v.id('users') },
  handler: async (ctx, { followeeId }): Promise<null> => {
    const viewerId = await requireUser(ctx);
    const existing = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowee', (q) =>
        q.eq('followerId', viewerId).eq('followeeId', followeeId),
      )
      .first();
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export interface PartnerRow {
  readonly userId: Id<'users'>;
  readonly displayName: string;
  readonly isFollowing: boolean;
  readonly followerCount: number;
  readonly lastSessionAt: number | null;
  readonly gradeRange: { readonly min: VGrade; readonly max: VGrade } | null;
}

async function gradeRangeFor(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<{ readonly min: VGrade; readonly max: VGrade } | null> {
  const sessions = await ctx.db
    .query('sessions')
    .withIndex('byUserAndDate', (q) => q.eq('userId', userId))
    .collect();
  let minIdx = Number.POSITIVE_INFINITY;
  let maxIdx = -1;
  let minGrade: VGrade | null = null;
  let maxGrade: VGrade | null = null;
  for (const s of sessions) {
    const attempts = await ctx.db
      .query('attempts')
      .withIndex('bySession', (q) => q.eq('sessionId', s._id))
      .collect();
    for (const a of attempts) {
      if (!isSent(a.outcome)) continue;
      const idx = V_GRADES.indexOf(a.grade);
      if (idx < minIdx) {
        minIdx = idx;
        minGrade = a.grade;
      }
      if (idx > maxIdx) {
        maxIdx = idx;
        maxGrade = a.grade;
      }
    }
  }
  if (minGrade === null || maxGrade === null) return null;
  return { min: minGrade, max: maxGrade };
}

async function lastSessionAtFor(
  ctx: QueryCtx,
  userId: Id<'users'>,
): Promise<number | null> {
  const latest = await ctx.db
    .query('sessions')
    .withIndex('byUserAndDate', (q) => q.eq('userId', userId))
    .order('desc')
    .first();
  return latest?.date ?? null;
}

export const listPartners = query({
  args: {},
  handler: async (ctx): Promise<readonly PartnerRow[]> => {
    const viewerId = await requireUser(ctx);
    const users = await ctx.db.query('users').collect();
    const followings = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', viewerId))
      .collect();
    const followedIds = new Set<string>(followings.map((f) => f.followeeId));

    const rows: PartnerRow[] = [];
    for (const u of users) {
      if (u._id === viewerId) continue;
      const followerRows = await ctx.db
        .query('follows')
        .withIndex('byFollowee', (q) => q.eq('followeeId', u._id))
        .collect();
      const gradeRange = await gradeRangeFor(ctx, u._id);
      const lastSessionAt = await lastSessionAtFor(ctx, u._id);
      rows.push({
        userId: u._id,
        displayName: u.displayName,
        isFollowing: followedIds.has(u._id),
        followerCount: followerRows.length,
        lastSessionAt,
        gradeRange,
      });
    }
    rows.sort((a, b) => (b.lastSessionAt ?? 0) - (a.lastSessionAt ?? 0));
    return rows;
  },
});

export const listFollowing = query({
  args: {},
  handler: async (ctx): Promise<readonly Doc<'users'>[]> => {
    const viewerId = await requireUser(ctx);
    const rows = await ctx.db
      .query('follows')
      .withIndex('byFollower', (q) => q.eq('followerId', viewerId))
      .collect();
    const out: Doc<'users'>[] = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.followeeId);
      if (u !== null) out.push(u);
    }
    return out;
  },
});

export const listFollowers = query({
  args: { userId: v.optional(v.id('users')) },
  handler: async (ctx, { userId }): Promise<readonly Doc<'users'>[]> => {
    const viewerId = await requireUser(ctx);
    const target = userId ?? viewerId;
    const rows = await ctx.db
      .query('follows')
      .withIndex('byFollowee', (q) => q.eq('followeeId', target))
      .collect();
    const out: Doc<'users'>[] = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.followerId);
      if (u !== null) out.push(u);
    }
    return out;
  },
});

export const isFollowing = query({
  args: { targetUserId: v.id('users') },
  handler: async (ctx, { targetUserId }): Promise<boolean> => {
    const viewerId = await requireUser(ctx);
    if (viewerId === targetUserId) return true;
    const row = await ctx.db
      .query('follows')
      .withIndex('byFollowerAndFollowee', (q) =>
        q.eq('followerId', viewerId).eq('followeeId', targetUserId),
      )
      .first();
    return row !== null;
  },
});
