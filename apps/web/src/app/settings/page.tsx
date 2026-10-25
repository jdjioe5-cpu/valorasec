'use client';

import { useState } from 'react';
import { User, Shield, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/navbar';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';

import { SessionManager } from '@/components/settings/session-manager';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { shouldRender } = useAuthGuard();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  if (!shouldRender || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await api.getProfile();
      setUser(res.data);
      setMessage('Profile updated successfully!');
    } catch {
      setMessage('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-8" tabIndex={-1}>
        <div className="animate-fade-in">
          <h1 className="font-heading mb-2 text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mb-8">Manage your account and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="cyber-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <User className="text-primary h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Profile</h2>
                <p className="text-muted-foreground text-sm">Update your account information</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="settings-email" className="mb-1.5 block text-sm font-medium">
                  Email
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={user.email}
                  disabled
                  className="border-input bg-accent/50 text-muted-foreground w-full cursor-not-allowed rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="settings-name" className="mb-1.5 block text-sm font-medium">
                  Name
                </label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                />
              </div>
              <div>
                <label htmlFor="settings-role" className="mb-1.5 block text-sm font-medium">
                  Role
                </label>
                <input
                  id="settings-role"
                  type="text"
                  value={user.role}
                  disabled
                  className="border-input bg-accent/50 text-muted-foreground w-full cursor-not-allowed rounded-md border px-3 py-2 text-sm capitalize"
                />
              </div>
              {message && (
                <div
                  className={`rounded-md p-3 text-sm ${message.includes('success') ? 'bg-success/10 border-success/30 text-success border' : 'bg-destructive/10 border-destructive/30 text-destructive border'}`}
                  role="alert"
                >
                  {message}
                </div>
              )}
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Save Changes
              </Button>
            </form>
          </div>

          {/* Security Section */}
          <div className="cyber-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Shield className="text-primary h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Security</h2>
                <p className="text-muted-foreground text-sm">Manage your security settings</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="bg-accent/30 flex items-center justify-between rounded-md p-3">
                <div>
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  <p className="text-muted-foreground text-xs">Add an extra layer of security</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
              <div className="bg-accent/30 flex items-center justify-between rounded-md p-3">
                <div>
                  <p className="text-sm font-medium">API Keys</p>
                  <p className="text-muted-foreground text-xs">Manage your API keys</p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
            </div>
          </div>

          {/* Active Sessions Section (Issue #18) */}
          <SessionManager />

          {/* Active Sessions Section (Issue #18) */}

          {/* Notifications Section */}
          <div className="cyber-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Bell className="text-primary h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Notifications</h2>
                <p className="text-muted-foreground text-sm">Configure notification preferences</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Scan completions', desc: 'When a security scan finishes' },
                { label: 'Report generation', desc: 'When a new report is available' },
                { label: 'Verification updates', desc: 'On-chain verification status changes' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-accent/30 flex items-center justify-between rounded-md p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-muted-foreground text-xs">{item.desc}</p>
                  </div>
                  <span
                    className="relative inline-flex cursor-not-allowed items-center opacity-50"
                    aria-label={`${item.label} toggle (disabled)`}
                  >
                    <input type="checkbox" checked disabled className="sr-only" />
                    <div className="bg-primary h-5 w-9 rounded-full" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
