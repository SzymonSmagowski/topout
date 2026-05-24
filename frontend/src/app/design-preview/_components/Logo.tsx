import type { SVGProps } from 'react';

/**
 * TopOut wordmark — an abstract topographic line glyph (suggests a topo line
 * pulling up off the wall) paired with the wordmark. SVG so it adapts to both
 * themes via `currentColor`.
 */
export function Logo({ className, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 132 28"
      role="img"
      aria-label="TopOut"
      className={className}
      {...rest}
    >
      <g fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 22 L8 16 L13 19 L18 11 L24 14 L29 6" />
        <circle cx={29} cy={6} r={1.6} fill="currentColor" stroke="none" />
      </g>
      <text
        x={36}
        y={20}
        fill="currentColor"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}
      >
        topout
      </text>
    </svg>
  );
}
