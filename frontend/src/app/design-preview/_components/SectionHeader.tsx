import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly specHref?: string;
}

export function SectionHeader({ id, eyebrow, title, description, specHref }: SectionHeaderProps) {
  return (
    <header id={id} className="scroll-mt-24">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="section-eyebrow">{eyebrow}</div>
        {specHref ? (
          <a
            href={specHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
          >
            spec
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
      <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <p className="mt-2 max-w-[68ch] text-sm leading-relaxed text-[color:var(--color-text-muted)]">
        {description}
      </p>
    </header>
  );
}
