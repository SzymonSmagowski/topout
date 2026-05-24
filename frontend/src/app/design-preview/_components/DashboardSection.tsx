import { USER_ME } from '../_data/mock';
import { Dashboard } from './Dashboard';
import { SectionHeader } from './SectionHeader';

export function DashboardSection() {
  return (
    <section className="space-y-6">
      <SectionHeader
        id="dashboard"
        eyebrow="03 · live-dashboard"
        title="Four KPI tiles. Four charts. One Convex subscription per query."
        description={
          <>
            The dashboard component takes a <code className="rounded bg-[color:var(--color-surface-2)] px-1 text-xs">userId</code> prop and reuses unchanged in the partner-follow view below. Send pyramid + grade distribution use the canonical sienna ramp so V3 looks the same color on the log form, in the list, and on every chart.
          </>
        }
      />
      <Dashboard userId={USER_ME.id} />
    </section>
  );
}
