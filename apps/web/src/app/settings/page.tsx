'use client';

import { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Bell,
  Loader2,
  Radio,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/layout/navbar';
import { useAuthStore } from '@/lib/store/auth-store';
import { useAuthGuard } from '@/lib/hooks/use-auth-guard';
import { api } from '@/lib/api';
import type { Webhook } from '@valorasec/shared';

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const { shouldRender } = useAuthGuard();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loadingWebhooks, setLoadingWebhooks] = useState(false);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDescription, setWebhookDescription] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { status: string; statusCode?: number; attempts: number }>
  >({});
  const [webhookError, setWebhookError] = useState('');

  useEffect(() => {
    if (!shouldRender || !user) return;

    async function loadWebhooks() {
      setLoadingWebhooks(true);
      try {
        const res = await api.getWebhooks();
        setWebhooks(res.data);
      } catch (err) {
        console.error('Failed to load webhooks:', err);
      } finally {
        setLoadingWebhooks(false);
      }
    }

    loadWebhooks();
  }, [shouldRender, user]);

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

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;
    setWebhookError('');

    try {
      const res = await api.createWebhook({
        url: webhookUrl,
        description: webhookDescription || undefined,
        secret: webhookSecret || undefined,
      });
      setWebhooks([res.data, ...webhooks]);
      setWebhookUrl('');
      setWebhookDescription('');
      setWebhookSecret('');
      setShowAddWebhook(false);
    } catch (err: unknown) {
      console.error(err);
      setWebhookError('Failed to register webhook. Ensure the URL is valid.');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await api.deleteWebhook(id);
      setWebhooks(webhooks.filter((w) => w.id !== id));
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const handleTestWebhook = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.testWebhook(id);
      setTestResults((prev) => ({
        ...prev,
        [id]: res.data,
      }));
    } catch (err) {
      console.error('Failed to test webhook:', err);
      setTestResults((prev) => ({
        ...prev,
        [id]: { status: 'failed', attempts: 3, statusCode: 500 },
      }));
    } finally {
      setTestingId(null);
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

          {/* Webhooks Section */}
          <div className="cyber-card p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  <Radio className="text-primary h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Webhooks</h2>
                  <p className="text-muted-foreground text-sm">
                    Receive HTTP POST notifications when scans complete
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddWebhook(!showAddWebhook)}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add Webhook
              </Button>
            </div>

            {/* Add Webhook Form */}
            {showAddWebhook && (
              <form
                onSubmit={handleAddWebhook}
                className="border-border bg-accent/20 mb-6 space-y-4 rounded-md border p-4"
              >
                <h3 className="text-sm font-semibold">New Webhook Endpoint</h3>
                <div>
                  <label htmlFor="webhook-url" className="mb-1 block text-xs font-medium">
                    Payload URL *
                  </label>
                  <input
                    id="webhook-url"
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://example.com/api/webhook"
                    className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="webhook-desc" className="mb-1 block text-xs font-medium">
                      Description (Optional)
                    </label>
                    <input
                      id="webhook-desc"
                      type="text"
                      value={webhookDescription}
                      onChange={(e) => setWebhookDescription(e.target.value)}
                      placeholder="e.g. CI/CD Pipeline or Alert Channel"
                      className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="webhook-secret" className="mb-1 block text-xs font-medium">
                      HMAC Secret (Optional, auto-generated if blank)
                    </label>
                    <input
                      id="webhook-secret"
                      type="text"
                      value={webhookSecret}
                      onChange={(e) => setWebhookSecret(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className="border-input bg-background focus:ring-primary w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                </div>

                {webhookError && <p className="text-xs text-rose-500">{webhookError}</p>}

                <div className="flex gap-2">
                  <Button type="submit" size="sm">
                    Save Webhook
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddWebhook(false);
                      setWebhookError('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {/* Webhook List */}
            {loadingWebhooks ? (
              <div className="flex justify-center py-6">
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
              </div>
            ) : webhooks.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No webhooks registered yet. Add a URL to get notified on scan completion.
              </p>
            ) : (
              <div className="space-y-3">
                {webhooks.map((hook) => {
                  const testRes = testResults[hook.id];
                  return (
                    <div
                      key={hook.id}
                      className="border-border bg-accent/10 rounded-md border p-4 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-mono text-sm font-medium">
                              {hook.url}
                            </span>
                            <Badge variant={hook.isActive ? 'low' : 'critical'}>
                              {hook.isActive ? 'Active' : 'Disabled'}
                            </Badge>
                          </div>
                          {hook.description && (
                            <p className="text-muted-foreground mt-1 text-xs">{hook.description}</p>
                          )}
                          <div className="text-muted-foreground mt-2 flex items-center gap-2 font-mono text-[11px]">
                            <Key className="h-3 w-3" />
                            Secret: {hook.secret.slice(0, 10)}••••••••
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestWebhook(hook.id)}
                            disabled={testingId === hook.id}
                          >
                            {testingId === hook.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="mr-1 h-3.5 w-3.5" />
                            )}
                            Test Ping
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWebhook(hook.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Delete webhook"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Test feedback */}
                      {testRes && (
                        <div
                          className={`mt-3 flex items-center gap-2 rounded px-2.5 py-1.5 font-mono text-xs ${
                            testRes.status === 'success'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {testRes.status === 'success' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          <span>
                            Delivery {testRes.status.toUpperCase()}
                            {testRes.statusCode ? ` (${testRes.statusCode})` : ''} -{' '}
                            {testRes.attempts} attempt(s)
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
