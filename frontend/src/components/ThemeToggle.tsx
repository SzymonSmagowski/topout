'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="btn btn-ghost h-9 w-9 !px-0"
        suppressHydrationWarning
      >
        <Sun className="h-4 w-4 opacity-50" aria-hidden />
      </button>
    );
  }

  const current = (theme === 'system' ? resolvedTheme : theme) ?? 'light';
  const next = current === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      onClick={() => setTheme(next)}
      className="btn btn-ghost h-9 w-9 !px-0"
    >
      {current === 'dark' ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
