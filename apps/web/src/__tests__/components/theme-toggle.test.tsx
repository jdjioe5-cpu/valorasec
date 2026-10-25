import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeToggle, ThemeSegmentedControl } from '@/components/layout/theme-toggle';
import { useTheme } from 'next-themes';

vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}));

describe('Theme Toggle & Switching Components Suite', () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ThemeToggle', () => {
    it('renders current dark theme with moon icon and cycles to light theme on click', () => {
      vi.mocked(useTheme).mockReturnValue({
        theme: 'dark',
        resolvedTheme: 'dark',
        setTheme: mockSetTheme,
        themes: ['light', 'dark', 'system'],
        systemTheme: 'dark',
      });

      render(<ThemeToggle />);
      const btn = screen.getByTestId('theme-toggle-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('aria-label', 'Theme: Dark');

      fireEvent.click(btn);
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('cycles from light theme to system theme on click', () => {
      vi.mocked(useTheme).mockReturnValue({
        theme: 'light',
        resolvedTheme: 'light',
        setTheme: mockSetTheme,
        themes: ['light', 'dark', 'system'],
        systemTheme: 'light',
      });

      render(<ThemeToggle />);
      const btn = screen.getByTestId('theme-toggle-btn');
      expect(btn).toHaveAttribute('aria-label', 'Theme: Light');

      fireEvent.click(btn);
      expect(mockSetTheme).toHaveBeenCalledWith('system');
    });

    it('cycles from system theme to dark theme on click', () => {
      vi.mocked(useTheme).mockReturnValue({
        theme: 'system',
        resolvedTheme: 'dark',
        setTheme: mockSetTheme,
        themes: ['light', 'dark', 'system'],
        systemTheme: 'dark',
      });

      render(<ThemeToggle />);
      const btn = screen.getByTestId('theme-toggle-btn');
      expect(btn).toHaveAttribute('aria-label', 'Theme: System');

      fireEvent.click(btn);
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  describe('ThemeSegmentedControl', () => {
    it('renders 3 options with correct radio attributes', () => {
      vi.mocked(useTheme).mockReturnValue({
        theme: 'dark',
        resolvedTheme: 'dark',
        setTheme: mockSetTheme,
        themes: ['light', 'dark', 'system'],
        systemTheme: 'dark',
      });

      render(<ThemeSegmentedControl />);
      expect(screen.getByRole('radiogroup', { name: 'Theme preference' })).toBeInTheDocument();

      const lightOpt = screen.getByTestId('theme-option-light');
      const darkOpt = screen.getByTestId('theme-option-dark');
      const systemOpt = screen.getByTestId('theme-option-system');

      expect(darkOpt).toHaveAttribute('aria-checked', 'true');
      expect(lightOpt).toHaveAttribute('aria-checked', 'false');
      expect(systemOpt).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(lightOpt);
      expect(mockSetTheme).toHaveBeenCalledWith('light');

      fireEvent.click(systemOpt);
      expect(mockSetTheme).toHaveBeenCalledWith('system');
    });
  });
});
