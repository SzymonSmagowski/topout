'use client';

import { useConvexAuth, useQuery } from 'convex/react';
import type { FunctionReference } from 'convex/server';

/**
 * `useQuery` that auto-skips while Convex Auth is loading or signed-out.
 *
 * Convex's reactive engine re-runs every active subscription whenever the
 * auth state changes. On sign-out, any subscription that calls `requireUser`
 * server-side will throw `not_authenticated` once before the component
 * unmounts — flooding the dev log with errors that don't reflect a real
 * problem. This wrapper passes `'skip'` to `useQuery` when the user isn't
 * authenticated, so the subscription unregisters cleanly.
 *
 * Use this for every query whose server handler calls `requireUser` /
 * `requireOwner` / `requireFollowing`. For soft-auth queries that return
 * `null` for unauthenticated callers (`api.users.viewer`,
 * `api.users.getPublic`), use the bare `useQuery` so the component can
 * react to the null result.
 */
export function useAuthedQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: Query['_args'] | 'skip',
): Query['_returnType'] | undefined {
  const { isAuthenticated } = useConvexAuth();
  // Convex's OptionalRestArgsOrSkip variadic doesn't narrow under a generic
  // wrapper — at the call sites it resolves to the specific function's
  // arg-or-'skip' overload, but here `Query` is unbound. The literal
  // `'skip'` is a documented public API; cast away the variadic noise.
  const finalArgs = (isAuthenticated && args !== 'skip' ? args : 'skip') as Query['_args'];
  return useQuery(query, finalArgs);
}
