/**
 * Gym registry. Globally readable across signed-in users; no PII.
 *
 * `listByPrefix` powers the log-session autocomplete. `ensureByName` is the
 * "create-if-new" path the form invokes when the user types a gym not already
 * in the registry.
 *
 * Indexes used:
 *   gyms.byName — case-insensitive prefix matching + exact lookup
 */
import { v, type Infer } from 'convex/values';

import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { requireUser } from './lib/auth';

const DEFAULT_LIMIT = 12;

const listByPrefixArgs = v.object({
  prefix: v.string(),
  limit: v.optional(v.number()),
});
export type ListByPrefixArgs = Infer<typeof listByPrefixArgs>;

export const listByPrefix = query({
  args: listByPrefixArgs,
  handler: async (ctx, { prefix, limit }): Promise<readonly Doc<'gyms'>[]> => {
    await requireUser(ctx);
    const cap = Math.min(limit ?? DEFAULT_LIMIT, 25);
    const trimmed = prefix.trim();
    if (trimmed.length === 0) {
      return await ctx.db.query('gyms').withIndex('byName').take(cap);
    }
    // Case-insensitive prefix: lowercased compare in JS, because Convex
    // indexes are case-sensitive. N is tiny (≤ a few hundred gyms ever).
    const lower = trimmed.toLowerCase();
    const all = await ctx.db.query('gyms').withIndex('byName').collect();
    return all
      .filter((g) => g.name.toLowerCase().startsWith(lower))
      .slice(0, cap);
  },
});

const ensureByNameArgs = v.object({
  name: v.string(),
  city: v.optional(v.string()),
});
export type EnsureByNameArgs = Infer<typeof ensureByNameArgs>;

export const ensureByName = mutation({
  args: ensureByNameArgs,
  handler: async (ctx, { name, city }) => {
    await requireUser(ctx);
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new Error('gym name required');
    }
    const lower = trimmedName.toLowerCase();
    const existing = await ctx.db
      .query('gyms')
      .withIndex('byName')
      .collect();
    const match = existing.find((g) => g.name.toLowerCase() === lower);
    if (match !== undefined) {
      return { gymId: match._id, created: false } as const;
    }
    const gymId = await ctx.db.insert('gyms', {
      name: trimmedName,
      city: city?.trim() ?? undefined,
    });
    return { gymId, created: true } as const;
  },
});
