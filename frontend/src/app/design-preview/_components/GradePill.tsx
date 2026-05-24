import type { VGrade } from '@/lib/grades';
import { gradePillVars } from '@/lib/grade-colors';
import { cn } from '@/lib/utils';

interface GradePillProps {
  readonly grade: VGrade;
  readonly className?: string;
  readonly size?: 'sm' | 'md';
}

export function GradePill({ grade, className, size = 'md' }: GradePillProps) {
  return (
    <span
      data-grade={grade}
      className={cn('grade-pill', size === 'sm' && 'h-5 min-w-[2rem] text-[0.6875rem]', className)}
      style={gradePillVars(grade)}
    >
      {grade}
    </span>
  );
}
