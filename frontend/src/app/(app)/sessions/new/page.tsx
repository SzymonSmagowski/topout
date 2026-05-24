import { LogSessionForm } from '@/components/LogSessionForm';

export default function NewSessionPage() {
  return (
    <section className="space-y-6">
      <header>
        <div className="section-eyebrow">topout · log session</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Log a session</h1>
        <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">
          One screen, every attempt. The coach summary fires automatically on submit.
        </p>
      </header>
      <LogSessionForm />
    </section>
  );
}
