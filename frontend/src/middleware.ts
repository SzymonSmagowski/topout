import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';

const isPublicAuthRoute = createRouteMatcher(['/sign-in', '/register']);

const isProtectedRoute = createRouteMatcher([
  '/dashboard',
  '/sessions(.*)',
  '/partners(.*)',
  '/reports(.*)',
]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const authed = await convexAuth.isAuthenticated();
    if (isPublicAuthRoute(request) && authed) {
      return nextjsMiddlewareRedirect(request, '/dashboard');
    }
    if (isProtectedRoute(request) && !authed) {
      return nextjsMiddlewareRedirect(request, '/sign-in');
    }
  },
  {
    cookieConfig: { maxAge: 60 * 60 * 24 * 30 },
  },
);

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
