import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Navbar } from '@/components/layout/navbar';
import { useAuthStore } from '@/lib/store/auth-store';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe('Responsive Navbar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        id: 'u-1',
        name: 'Alex Johnson',
        email: 'alex@example.com',
        role: 'user',
        isVerified: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    });
  });

  it('renders brand link and toggle button with initial closed state and accessible attributes', () => {
    render(<Navbar />);

    const brand = screen.getByLabelText('ValoraSec Dashboard');
    expect(brand).toBeInTheDocument();

    const toggleBtn = screen.getByTestId('mobile-menu-toggle');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Open navigation menu');
    expect(screen.queryByTestId('mobile-menu-drawer')).not.toBeInTheDocument();
  });

  it('toggles mobile menu open on click, displaying drawer, user summary, and links', () => {
    render(<Navbar />);

    const toggleBtn = screen.getByTestId('mobile-menu-toggle');
    fireEvent.click(toggleBtn);

    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Close navigation menu');

    const drawer = screen.getByTestId('mobile-menu-drawer');
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveTextContent('Alex Johnson');
    expect(drawer).toHaveTextContent('alex@example.com');

    // Verify touch-friendly navigation links
    const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(1);

    // Verify backdrop
    expect(screen.getByTestId('mobile-menu-backdrop')).toBeInTheDocument();
  });

  it('closes mobile menu when backdrop is clicked', () => {
    render(<Navbar />);

    const toggleBtn = screen.getByTestId('mobile-menu-toggle');
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('mobile-menu-drawer')).toBeInTheDocument();

    const backdrop = screen.getByTestId('mobile-menu-backdrop');
    fireEvent.click(backdrop);

    expect(screen.queryByTestId('mobile-menu-drawer')).not.toBeInTheDocument();
  });

  it('closes mobile menu on ESC keyboard key press', () => {
    render(<Navbar />);

    const toggleBtn = screen.getByTestId('mobile-menu-toggle');
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('mobile-menu-drawer')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('mobile-menu-drawer')).not.toBeInTheDocument();
  });

  it('triggers logout from mobile drawer and navigates to home', () => {
    render(<Navbar />);

    const toggleBtn = screen.getByTestId('mobile-menu-toggle');
    fireEvent.click(toggleBtn);

    const logoutBtns = screen.getAllByRole('button', { name: 'Sign out' });
    const mobileLogoutBtn = logoutBtns[logoutBtns.length - 1];
    expect(mobileLogoutBtn).toBeDefined();
    if (mobileLogoutBtn) {
      fireEvent.click(mobileLogoutBtn);
    }

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
