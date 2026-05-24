/**
 * Singleton ConvexReactClient.
 *
 * Created once for the entire client bundle. Read by `<ConvexAuthNextjsProvider>`
 * in `app/providers.tsx`. The deployment URL is `NEXT_PUBLIC_CONVEX_URL`,
 * documented in `.env.local.example`.
 */
import { ConvexReactClient } from 'convex/react';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  // The design-preview page is a portfolio asset that doesn't touch Convex
  // queries, so we don't want a missing `.env.local` to crash that route.
  // We log a clear warning instead, and the client will fail loudly the
  // first time a real `useQuery` / `useMutation` fires.
  // eslint-disable-next-line no-console
  console.warn(
    'NEXT_PUBLIC_CONVEX_URL is not set. Copy apps/topout/frontend/.env.local.example to .env.local before any authenticated route is loaded.',
  );
}

export const convex = new ConvexReactClient(convexUrl ?? 'https://placeholder.convex.cloud');
