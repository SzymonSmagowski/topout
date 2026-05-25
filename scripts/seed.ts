/**
 * `pnpm seed` — calls `internal.seedActions.run` on the configured Convex
 * deployment via the admin HTTP client. The heavy lifting lives in the
 * Convex action; this script is a thin invoker with a hard client-side
 * production-deployment guard.
 *
 * Required env vars (in gitignored `apps/topout/.env`):
 *   CONVEX_URL          — https://<your-dev-deployment>.convex.cloud
 *   CONVEX_DEPLOY_KEY   — admin key (for setAdminAuth)
 *
 * Optional:
 *   CONVEX_DEPLOYMENT   — name, e.g. `dev:fluffy-otter-42`. The client guard
 *                          checks this when present; the Convex action's
 *                          `assertNonProd` is the authoritative check.
 *   ALLOWED_SEED_DEPLOYMENTS — comma-separated allowlist of non-`dev:` names.
 *
 * CLI flags:
 *   --seed <n>        override the PRNG seed (default 42)
 *   --users <list>    `alex` / `sam` / `all` (default `all`)
 *   --no-follows      skip mutual-follow setup
 */
import 'dotenv/config';
import { ConvexHttpClient } from 'convex/browser';

// The generated API path is fixed by Convex codegen output. If you haven't
// run `pnpm convex dev` yet, the import will fail at module load with a
// clear error.
import { internal } from '../convex/_generated/api';

type UsersFilter = 'alex' | 'sam' | 'all';

interface CliArgs {
  readonly rngSeed: number;
  readonly users: UsersFilter;
  readonly insertFollows: boolean;
  readonly reportsPerUser: number;
}

interface SeedSummary {
  readonly deployment: string;
  readonly usersCreated: number;
  readonly reportsCreated: number;
  readonly sessionsCreated: number;
  readonly attemptsCreated: number;
  readonly gymsEnsured: number;
  readonly followsCreated: number;
  readonly durationMs: number;
}

function die(msg: string): never {
  console.error(`pnpm seed: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: readonly string[]): CliArgs {
  let rngSeed = 42;
  let users: UsersFilter = 'all';
  let insertFollows = true;
  let reportsPerUser = 0;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    switch (flag) {
      case '--reports': {
        const v = argv[i + 1];
        if (v === undefined) die('--reports requires a numeric value');
        const n = Number.parseInt(v, 10);
        if (!Number.isFinite(n) || n < 0) die(`--reports must be a non-negative integer, got "${v}"`);
        reportsPerUser = n;
        i += 1;
        break;
      }
      case '--seed': {
        const v = argv[i + 1];
        if (v === undefined) die('--seed requires a numeric value');
        const n = Number.parseInt(v, 10);
        if (!Number.isFinite(n)) die(`--seed must be an integer, got "${v}"`);
        rngSeed = n;
        i += 1;
        break;
      }
      case '--users': {
        const v = argv[i + 1];
        if (v === 'alex' || v === 'sam' || v === 'all') {
          users = v;
        } else {
          die(`--users must be one of alex|sam|all, got "${v ?? '<missing>'}"`);
        }
        i += 1;
        break;
      }
      case '--no-follows':
        insertFollows = false;
        break;
      case '--help':
      case '-h':
        console.log(
          [
            'Usage: pnpm seed [--seed N] [--users alex|sam|all] [--no-follows]',
            '',
            'Required env (in apps/topout/.env):',
            '  CONVEX_URL=https://<dev>.convex.cloud',
            '  CONVEX_DEPLOY_KEY=...',
          ].join('\n'),
        );
        process.exit(0);
      default:
        // Ignore unknown flags rather than dying — keeps re-runs friendly.
        break;
    }
  }
  return { rngSeed, users, insertFollows, reportsPerUser };
}

function looksProd(deployment: string | undefined): boolean {
  if (deployment === undefined || deployment === '') return false;
  // `anonymous:` covers the Convex CLI's local-only backend started by
  // `pnpm convex dev` without a login — it's strictly local, never prod.
  if (
    deployment.startsWith('dev:') ||
    deployment.startsWith('local:') ||
    deployment.startsWith('anonymous:')
  ) {
    return false;
  }
  const allowlist = (process.env.ALLOWED_SEED_DEPLOYMENTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return !allowlist.includes(deployment);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const url = process.env.CONVEX_URL;
  if (url === undefined || url === '') die('CONVEX_URL missing in env');
  const adminKey = process.env.CONVEX_DEPLOY_KEY;
  if (adminKey === undefined || adminKey === '') {
    die('CONVEX_DEPLOY_KEY missing in env');
  }

  if (looksProd(process.env.CONVEX_DEPLOYMENT)) {
    die(
      `CONVEX_DEPLOYMENT="${process.env.CONVEX_DEPLOYMENT ?? ''}" looks like prod. ` +
        'Set ALLOWED_SEED_DEPLOYMENTS to whitelist if intentional.',
    );
  }

  const client = new ConvexHttpClient(url);
  client.setAdminAuth(adminKey);

  console.log(
    `Seeding ${url} (seed=${args.rngSeed}, users=${args.users}, follows=${args.insertFollows}, reports=${args.reportsPerUser}) …`,
  );

  const summary = (await client.action(internal.seedActions.run, {
    rngSeed: args.rngSeed,
    users: args.users,
    insertFollows: args.insertFollows,
    reportsPerUser: args.reportsPerUser,
  })) as SeedSummary;

  console.log('Seed complete:');
  console.log(`  deployment       ${summary.deployment}`);
  console.log(`  users created    ${summary.usersCreated}`);
  console.log(`  gyms ensured     ${summary.gymsEnsured}`);
  console.log(`  sessions created ${summary.sessionsCreated}`);
  console.log(`  attempts created ${summary.attemptsCreated}`);
  console.log(`  follows created  ${summary.followsCreated}`);
  console.log(`  reports created  ${summary.reportsCreated}`);
  console.log(`  duration         ${summary.durationMs} ms`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('pnpm seed: failed —', msg);
  process.exit(1);
});
