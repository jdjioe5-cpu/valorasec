import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button component', () => {
  it('renders default button with text', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-primary');
  });

  it('renders all variants correctly', () => {
    const variants = [
      { variant: 'default' as const, expectedClass: 'bg-primary' },
      { variant: 'secondary' as const, expectedClass: 'bg-secondary' },
      { variant: 'outline' as const, expectedClass: 'border-input' },
      { variant: 'ghost' as const, expectedClass: 'hover:bg-accent' },
      { variant: 'destructive' as const, expectedClass: 'bg-destructive' },
      { variant: 'link' as const, expectedClass: 'text-primary' },
      { variant: 'cyber' as const, expectedClass: 'cyber-glow' },
    ];

    variants.forEach(({ variant, expectedClass }) => {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole('button', { name: variant });
      expect(button).toHaveClass(expectedClass);
      unmount();
    });
  });

  it('renders all sizes correctly', () => {
    const sizes = [
      { size: 'default' as const, expectedClass: 'h-10' },
      { size: 'sm' as const, expectedClass: 'h-9' },
      { size: 'lg' as const, expectedClass: 'h-11' },
      { size: 'icon' as const, expectedClass: 'h-10 w-10' },
    ];

    sizes.forEach(({ size, expectedClass }) => {
      const { unmount } = render(<Button size={size}>Button</Button>);
      const button = screen.getByRole('button', { name: /button/i });
      expect(button).toHaveClass(expectedClass);
      unmount();
    });
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is provided', () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole('button', { name: /disabled/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
