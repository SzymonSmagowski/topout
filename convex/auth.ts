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
 * ## Email allowlist (server-side gate)
 *
 * In prod the app is invite-only. Set the deployment env var
 * `ALLOWED_REGISTRATION_EMAILS` to a comma-separated list and `profile()`
 * throws `ConvexError({ kind: 'email_not_allowlisted' })` for anything else.
 * Local dev = env unset = open (so `pnpm seed` and ad-hoc signups still work).
 *
 *   npx convex env set ALLOWED_REGISTRATION_EMAILS "you@x.com,friend@y.com" --prod
 *
 * The `@topout.local` system domain is always exempt — the seed script uses
 * `seed-alex@topout.local` / `seed-sam@topout.local`, and the TLD doesn't
 * exist so no real human can claim it.
 *
 * @see https://labs.convex.dev/auth/config/passwords
 */
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';

import type { DataModel } from './_generated/dataModel';

const SYSTEM_EMAIL_DOMAIN = '@topout.local';

function assertAllowedEmail(email: string): void {
  // Seed accounts use a system domain that no real user can claim.
  if (email.endsWith(SYSTEM_EMAIL_DOMAIN)) return;

  const raw = process.env.ALLOWED_REGISTRATION_EMAILS ?? '';
  const allowlist = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);

  // Empty env var = no restriction (local dev / pre-launch).
  if (allowlist.length === 0) return;

  if (!allowlist.includes(email.toLowerCase())) {
    throw new ConvexError({
      kind: 'email_not_allowlisted',
      message: 'Registration is invite-only. Contact the operator to be added to the allowlist.',
    });
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        const email = params.email as string;
        assertAllowedEmail(email);

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
