import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '@/components/layout/navbar';
import { useAuthStore } from '@/lib/store/auth-store';
import { usePathname, useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('@/lib/store/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

describe('Navbar component', () => {
  const mockPush = vi.fn();
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
    } as unknown as ReturnType<typeof useRouter>);
  });

  it('renders nothing when user is unauthenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: false,
      user: null,
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    const { container } = render(<Navbar />);
    expect(container.firstChild).toBeNull();
  });

  it('renders desktop navigation links when authenticated', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: { name: 'Alice Auditor', email: 'alice@stellar.org' },
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    render(<Navbar />);

    expect(screen.getByRole('link', { name: /valorasec dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Docs' })).toBeInTheDocument();
  });

  it('highlights the active route based on current pathname', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: { name: 'Alice Auditor' },
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(usePathname).mockReturnValue('/projects/123');

    render(<Navbar />);

    const projectsLink = screen.getByRole('link', { name: 'Projects' });
    expect(projectsLink).toHaveAttribute('aria-current', 'page');
    expect(projectsLink).toHaveClass('bg-accent');

    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboardLink).not.toHaveAttribute('aria-current');
  });

  it('toggles mobile menu when hamburger button is clicked', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: { name: 'Alice Auditor' },
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    render(<Navbar />);

    const toggleButton = screen.getByRole('button', { name: /open menu/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Click to open mobile menu
    fireEvent.click(toggleButton);

    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // Mobile navigation links now exist in DOM
    const allProjectsLinks = screen.getAllByRole('link', { name: 'Projects' });
    expect(allProjectsLinks.length).toBeGreaterThanOrEqual(2); // desktop + mobile

    // Click to close
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('calls logout and redirects to home on sign out button click', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      user: { name: 'Alice Auditor' },
      logout: mockLogout,
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(usePathname).mockReturnValue('/dashboard');

    render(<Navbar />);

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
