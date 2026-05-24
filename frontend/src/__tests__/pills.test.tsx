/**
 * GradePill + OutcomePill — rendering and color correctness.
 *
 * GradePill renders the grade text and receives CSS custom-property vars from
 * gradePillVars(). We assert on the rendered text and the data-grade attribute
 * (stable selector). We also verify that gradePillVars doesn't throw for any
 * valid grade (the function itself throws on bad bucket index).
 *
 * OutcomePill renders each outcome label from OUTCOME_LABEL and uses a tint
 * background. We verify correct label text for all 5 outcomes.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { GradePill } from '../components/GradePill';
import { OutcomePill } from '../components/OutcomePill';
import { V_GRADES, OUTCOMES, OUTCOME_LABEL, type VGrade, type Outcome } from '../lib/grades';
import { gradePillVars, gradeStyle } from '../lib/grade-colors';

describe('GradePill', () => {
  it('unit GradePill renders correct text for every V-grade', () => {
    for (const grade of V_GRADES) {
      const { unmount } = render(<GradePill grade={grade} />);
      expect(screen.getByText(grade)).toBeInTheDocument();
      unmount();
    }
  });

  it('unit GradePill sets data-grade attribute matching the grade prop', () => {
    const { container } = render(<GradePill grade="V5" />);
    const pill = container.querySelector('[data-grade="V5"]');
    expect(pill).toBeInTheDocument();
  });

  it('unit gradePillVars — does not throw for any valid grade', () => {
    for (const grade of V_GRADES) {
      expect(() => gradePillVars(grade)).not.toThrow();
    }
  });

  it('unit gradeStyle — low grades (VB, V0) use lighter bucket than high grades (V8+)', () => {
    const low = gradeStyle('VB');
    const high = gradeStyle('V17');
    // They must be different stops (sienna-100 vs sienna-900).
    expect(low.fill).not.toEqual(high.fill);
    expect(low.fill).toContain('sienna-100');
    expect(high.fill).toContain('sienna-900');
  });

  it('unit GradePill size="sm" — applies sm sizing class', () => {
    const { container } = render(<GradePill grade="V3" size="sm" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain('h-5');
  });
});

describe('OutcomePill', () => {
  it('unit OutcomePill renders correct label for every outcome', () => {
    for (const outcome of OUTCOMES) {
      const { unmount } = render(<OutcomePill outcome={outcome} />);
      expect(screen.getByText(OUTCOME_LABEL[outcome])).toBeInTheDocument();
      unmount();
    }
  });

  it('unit OutcomePill flash — renders "Flash" label', () => {
    render(<OutcomePill outcome="flash" />);
    expect(screen.getByText('Flash')).toBeInTheDocument();
  });

  it('unit OutcomePill fall — renders "Fall" label', () => {
    render(<OutcomePill outcome="fall" />);
    expect(screen.getByText('Fall')).toBeInTheDocument();
  });

  it('unit OutcomePill project — renders "Project" label', () => {
    render(<OutcomePill outcome="project" />);
    expect(screen.getByText('Project')).toBeInTheDocument();
  });
});
