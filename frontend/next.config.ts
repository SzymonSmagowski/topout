import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next's build typecheck cascades into ../convex/*.ts (re-exported by
  // _generated stubs) and fails on package-export-map imports because the
  // convex/ directory has no node_modules of its own on Vercel. The convex
  // source is already typechecked by `convex deploy` in the same build
  // wrapper, so we skip Next's redundant check here. Run `pnpm typecheck`
  // locally for the frontend.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
