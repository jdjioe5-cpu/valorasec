'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, Shield, Bell, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/navbar';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import type { NotificationPreferences } from '@valorasec/shared';

function SettingsContent() {
  const { user, setUser } = useAuthStore();
  const { shouldRender } = useAuthGuard();
  const searchParams = useSearchParams();

  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Notification preferences
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    scanCompleted: true,
    reportPublished: true,
    verificationUpdates: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsMessage, setPrefsMessage] = useState('');

  const loadPreferences = useCallback(async () => {
    try {
      setPrefsLoading(true);
      const res = await api.getNotificationPreferences();
      setPrefs(res.data);
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shouldRender || !user) return;
    loadPreferences();

    // Check for unsubscribe query parameter in URL
    const unsubscribeToken = searchParams.get('unsubscribe');
    const unsubscribeType = searchParams.get('type') ?? undefined;
    if (unsubscribeToken) {
      api
        .unsubscribeEmail(unsubscribeToken, unsubscribeType)
        .then(() => {
          setPrefsMessage(
            unsubscribeType
              ? `You have been unsubscribed from ${unsubscribeType} notifications.`
              : 'You have been unsubscribed from all email notifications.',
          );
          loadPreferences();
        })
        .catch((err) => {
          console.error('Unsubscribe error:', err);
        });
    }
  }, [shouldRender, user, searchParams, loadPreferences]);

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

  const handleTogglePref = async (key: keyof NotificationPreferences) => {
    const newValue = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: newValue }));
    setPrefsMessage('');

    try {
      await api.updateNotificationPreferences({ [key]: newValue });
      setPrefsMessage('Notification preferences updated.');
    } catch (err) {
      console.error('Failed to update preference:', err);
      // Revert on error
      setPrefs((prev) => ({ ...prev, [key]: !newValue }));
      setPrefsMessage('Failed to update preference.');
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
                  className={`rounded-md p-3 text-sm ${
                    message.includes('success')
                      ? 'bg-success/10 border-success/30 text-success border'
                      : 'bg-destructive/10 border-destructive/30 text-destructive border'
                  }`}
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

          {/* Email Notifications Section */}
          <div className="cyber-card p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Bell className="text-primary h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Email Notifications</h2>
                <p className="text-muted-foreground text-sm">
                  Configure real-time email delivery for key smart contract events
                </p>
              </div>
            </div>

            {prefsMessage && (
              <div
                className={`mb-4 flex items-center gap-2 rounded-md p-3 text-sm ${
                  prefsMessage.includes('Failed')
                    ? 'bg-destructive/10 border-destructive/30 text-destructive border'
                    : 'bg-primary/10 border-primary/30 text-primary border'
                }`}
                role="status"
              >
                {prefsMessage.includes('Failed') ? (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                )}
                <span>{prefsMessage}</span>
              </div>
            )}

            {prefsLoading ? (
              <div className="py-6 text-center">
                <Loader2 className="text-primary mx-auto h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  {
                    key: 'scanCompleted' as const,
                    label: 'Scan completions',
                    desc: 'Receive security audit score & findings when a contract scan finishes',
                  },
                  {
                    key: 'reportPublished' as const,
                    label: 'Report generation',
                    desc: 'Receive notification when a full audit report is published',
                  },
                  {
                    key: 'verificationUpdates' as const,
                    label: 'Verification updates',
                    desc: 'Receive on-chain transaction hash when a report is verified on Stellar',
                  },
                ].map((item) => {
                  const isChecked = !!prefs[item.key];

                  return (
                    <div
                      key={item.key}
                      className="bg-accent/30 hover:bg-accent/40 flex items-center justify-between rounded-md p-3.5 transition-colors"
                    >
                      <div className="pr-4">
                        <label
                          htmlFor={`pref-toggle-${item.key}`}
                          className="cursor-pointer text-sm font-medium"
                        >
                          {item.label}
                        </label>
                        <p className="text-muted-foreground text-xs">{item.desc}</p>
                      </div>

                      <button
                        id={`pref-toggle-${item.key}`}
                        type="button"
                        role="switch"
                        aria-checked={isChecked}
                        aria-label={`Toggle ${item.label} email notification`}
                        onClick={() => handleTogglePref(item.key)}
                        className={`focus:ring-primary relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          isChecked ? 'bg-primary' : 'bg-input'
                        }`}
                      >
                        <span
                          className={`bg-background pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isChecked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background min-h-screen">
          <Navbar />
          <main id="main-content" className="mx-auto max-w-3xl px-6 py-8" tabIndex={-1}>
            <div className="py-12 text-center">
              <Loader2 className="text-primary mx-auto h-8 w-8 animate-spin" />
            </div>
          </main>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
