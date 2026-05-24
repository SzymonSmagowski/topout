/**
 * Convex HTTP router — wires Convex Auth's HTTP routes (sign-in, sign-up,
 * sign-out, JWT refresh). Add new HTTP endpoints here in the future.
 */
import { httpRouter } from 'convex/server';

import { auth } from './auth';

const http = httpRouter();

auth.addHttpRoutes(http);

export default http;
