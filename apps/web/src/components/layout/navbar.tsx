'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, Menu, X, Bell, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth-store';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/projects', label: 'Projects' },
  { href: '/reports', label: 'Reports' },
  { href: '/docs', label: 'Docs' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on ESC
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    router.push('/');
  };

  if (!isAuthenticated) return null;

  return (
    <header className="border-border/50 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/dashboard"
            className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center gap-2"
            aria-label="ValoraSec Dashboard"
          >
            <Shield className="text-primary h-6 w-6 flex-shrink-0" aria-hidden="true" />
            <span className="font-heading text-lg font-bold tracking-tight">
              Valora<span className="text-primary">Sec</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Desktop Primary Navigation"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  pathname?.startsWith(link.href)
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                aria-current={pathname?.startsWith(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Desktop User Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            size="icon"
            className="relative min-h-[44px] min-w-[44px]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            <span
              className="bg-primary absolute right-2.5 top-2.5 h-2 w-2 rounded-full"
              aria-hidden="true"
            />
          </Button>
          <Button
            variant="ghost"
            className="flex min-h-[44px] items-center gap-2"
            aria-label={`User menu for ${user?.name ?? 'User'}`}
          >
            <User className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">{user?.name ?? 'User'}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Sign out"
            className="min-h-[44px] min-w-[44px]"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Mobile Menu Toggle Button (WCAG >= 44x44px touch target) */}
        <Button
          variant="ghost"
          size="icon"
          className="min-h-[44px] min-w-[44px] touch-manipulation p-2.5 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="mobile-menu-toggle"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation-menu"
        >
          {mobileOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          data-testid="mobile-menu-backdrop"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="animate-fade-in fixed inset-0 top-16 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div
          id="mobile-navigation-menu"
          data-testid="mobile-menu-drawer"
          className="border-border/50 bg-background/98 animate-fade-in fixed left-0 right-0 top-16 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto border-t p-4 shadow-2xl md:hidden"
        >
          {/* User Profile Summary in Mobile Drawer */}
          {user && (
            <div className="border-border/50 mb-4 flex items-center gap-3 border-b pb-3">
              <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
                <User className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <div className="text-foreground text-sm font-semibold">{user.name}</div>
                <div className="text-muted-foreground text-xs">{user.email}</div>
              </div>
            </div>
          )}

          <nav className="flex flex-col gap-1.5" aria-label="Mobile Primary Navigation">
            {navLinks.map((link) => {
              const isActive = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex min-h-[44px] touch-manipulation items-center rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-accent text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                  }`}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              );
            })}

            <hr className="border-border/50 my-2" />

            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-destructive hover:bg-destructive/10 flex min-h-[44px] w-full touch-manipulation items-center justify-start px-4 py-3 text-sm font-medium"
              aria-label="Sign out"
            >
              <LogOut className="mr-2.5 h-4 w-4" aria-hidden="true" /> Sign Out
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
