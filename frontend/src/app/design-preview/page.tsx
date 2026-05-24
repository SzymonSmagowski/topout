import { AppShell } from './_components/AppShell';
import { AuthSection } from './_components/AuthSection';
import { DashboardSection } from './_components/DashboardSection';
import { LogSessionSection } from './_components/LogSessionSection';
import { PartnersSection } from './_components/PartnersSection';
import { ReportsSection } from './_components/ReportsSection';
import { SessionsSection } from './_components/SessionsSection';

export const metadata = {
  title: 'TopOut — design preview',
};

/**
 * App-scope design preview.
 *
 * Renders every spec'd feature of TopOut on one page with static mock data so
 * the user can audit the Chalk + Crag visual language end-to-end before
 * /build wires real Convex + Python sidecar code.
 *
 * Feature order matches the manifest build order:
 *   01 auth  →  02a log-session  →  02b sessions list/detail (+ summary banner states)
 *            →  03 live-dashboard  →  04 follow-partner  →  05 weekly-report
 *
 * Seed-data has no UI surface and is documented in the README + design doc.
 */
export default function DesignPreviewPage() {
  return (
    <AppShell>
      <AuthSection />
      <LogSessionSection />
      <SessionsSection />
      <DashboardSection />
      <PartnersSection />
      <ReportsSection />
    </AppShell>
  );
}
