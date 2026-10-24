import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge component', () => {
  it('renders default badge', () => {
    render(<Badge>Default Badge</Badge>);
    const badge = screen.getByText('Default Badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-primary');
  });

  it('renders all severity levels with correct style classes', () => {
    const severities = [
      { variant: 'critical' as const, expectedClass: 'severity-critical' },
      { variant: 'high' as const, expectedClass: 'severity-high' },
      { variant: 'medium' as const, expectedClass: 'severity-medium' },
      { variant: 'low' as const, expectedClass: 'severity-low' },
      { variant: 'info' as const, expectedClass: 'severity-info' },
    ];

    severities.forEach(({ variant, expectedClass }) => {
      const { unmount } = render(<Badge variant={variant}>{variant.toUpperCase()}</Badge>);
      const badge = screen.getByText(variant.toUpperCase());
      expect(badge).toHaveClass(expectedClass);
      expect(badge).toHaveClass('border');
      unmount();
    });
  });

  it('renders secondary and outline variants', () => {
    const { unmount: unmountSecondary } = render(<Badge variant="secondary">Secondary</Badge>);
    expect(screen.getByText('Secondary')).toHaveClass('bg-secondary');
    unmountSecondary();

    const { unmount: unmountOutline } = render(<Badge variant="outline">Outline</Badge>);
    expect(screen.getByText('Outline')).toHaveClass('text-foreground');
    unmountOutline();
  });
});
