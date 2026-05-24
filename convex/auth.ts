/**
 * Convex Auth — Password provider only.
 *
 * Spec: `docs/specs/topout/auth.md` — email + password, no OAuth, no email
 * verification, no password reset for v1.
 *
 * The Password provider's `profile()` callback extracts `displayName` from
 * the sign-up form and stores it on the `users` row. The frontend's register
 * form MUST POST `flow=signUp` + `email` + `password` + `displayName`.
 *
 * Developer notes:
 * - This file is the ONE place the OAuth swap would happen later; that's why
 *   the spec calls out "Auth provider config isolated to convex/auth.ts".
 * - No password complexity rule beyond min 8 chars (validated on the client).
 * - Session cookie behaviour (httpOnly, secure, sameSite=lax, 30-day) is
 *   handled by Convex Auth itself — we don't configure it manually.
 *
 * Implementation TODOs for BackendDeveloper:
 * - Wire up `convexAuth({ providers: [Password<DataModel>({ profile })] })`.
 * - Export `auth`, `signIn`, `signOut`, `store`, `isAuthenticated`.
 * - Re-throw a `ConvexError({ kind: 'email_taken' })` if the Password
 *   provider raises a duplicate-email error (catch in the wrapper export).
 *
 * @see https://labs.convex.dev/auth/config/passwords
 */
export {};
