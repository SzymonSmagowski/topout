/**
 * Convex Auth — provider discovery config consumed by the Convex JWT verifier.
 *
 * `CONVEX_SITE_URL` is populated automatically by the Convex deployment.
 *
 * @see https://labs.convex.dev/auth/setup
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: 'convex',
    },
  ],
};
