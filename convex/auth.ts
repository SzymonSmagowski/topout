/**
 * Convex Auth — Password provider only.
 *
 * Spec: `docs/specs/topout/auth.md` — email + password, no OAuth, no email
 * verification, no password reset for v1. Min 8 chars is the only rule.
 *
 * The `profile()` callback runs on sign-up. It captures `displayName` from the
 * register form and writes it onto the new `users` row alongside the email
 * field that Convex Auth itself populates. `isSeed` defaults to `false` for
 * real users; the seed script patches it to `true` after running this flow
 * programmatically.
 *
 * @see https://labs.convex.dev/auth/config/passwords
 */
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

import type { DataModel } from './_generated/dataModel';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        const email = params.email as string;
        const rawDisplayName = params.displayName as string | undefined;
        const displayName =
          rawDisplayName !== undefined && rawDisplayName.trim().length > 0
            ? rawDisplayName.trim()
            : email.split('@')[0];

        return {
          email,
          displayName,
          isSeed: false,
        };
      },
    }),
  ],
});
