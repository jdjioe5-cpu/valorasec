'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('text-muted-foreground', className)}
        aria-label="Toggle theme"
        disabled
      >
        <div className="h-4 w-4" />
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('system');
    } else {
      setTheme('dark');
    }
  };

  const getLabel = () => {
    if (theme === 'system') return 'Theme: System';
    if (theme === 'light') return 'Theme: Light';
    return 'Theme: Dark';
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('text-muted-foreground hover:text-foreground', className)}
      onClick={cycleTheme}
      aria-label={getLabel()}
      title={getLabel()}
      data-testid="theme-toggle-btn"
    >
      {theme === 'system' ? (
        <Laptop className="text-primary h-4 w-4" aria-hidden="true" />
      ) : resolvedTheme === 'dark' ? (
        <Moon className="h-4 w-4 text-blue-400" aria-hidden="true" />
      ) : (
        <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" />
      )}
      <span className="sr-only">{getLabel()}</span>
    </Button>
  );
}

export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="bg-muted/40 h-9 w-48 animate-pulse rounded-lg" />;
  }

  const options: Array<{
    value: 'light' | 'dark' | 'system';
    label: string;
    icon: React.ElementType;
  }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Laptop },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      data-testid="theme-segmented-control"
      className={cn(
        'border-border bg-muted/40 inline-flex items-center rounded-lg border p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            data-testid={`theme-option-${opt.value}`}
            onClick={() => setTheme(opt.value)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
