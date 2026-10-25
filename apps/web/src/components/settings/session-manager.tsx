'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth-store';
import { api } from '@/lib/api';
import type { SessionInfo } from '@valorasec/shared';

function getDeviceIcon(device?: string) {
  const d = (device || '').toLowerCase();
  if (d === 'mobile') return <Smartphone className="text-primary h-5 w-5" />;
  if (d === 'tablet') return <Tablet className="text-primary h-5 w-5" />;
  if (d === 'desktop') return <Laptop className="text-primary h-5 w-5" />;
  return <Monitor className="text-primary h-5 w-5" />;
}

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Active now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}

export function SessionManager() {
  const router = useRouter();
  const { tokens, logout } = useAuthStore();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSessions(tokens?.refreshToken);
      setSessions(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load active sessions');
    } finally {
      setLoading(false);
    }
  }, [tokens?.refreshToken]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSingle = async (session: SessionInfo) => {
    setRevokingId(session.id);
    setFeedback(null);
    try {
      await api.revokeSession(session.id);
      if (session.isCurrent) {
        logout();
        router.push('/login');
        return;
      }
      setFeedback({ type: 'success', text: 'Session revoked successfully.' });
      await fetchSessions();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to revoke session.',
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    setFeedback(null);
    try {
      const res = await api.revokeOtherSessions(tokens?.refreshToken);
      setFeedback({
        type: 'success',
        text: `Revoked ${res.data.revokedCount} other session(s).`,
      });
      await fetchSessions();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to revoke other sessions.',
      });
    } finally {
      setRevokingOthers(false);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="cyber-card p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <ShieldCheck className="text-primary h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Active Sessions</h2>
            <p className="text-muted-foreground text-sm">
              Manage devices and active refresh tokens authenticated to your account
            </p>
          </div>
        </div>

        {sessions.length > 1 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevokeOthers}
            disabled={revokingOthers || otherSessionsCount === 0}
            className="shrink-0 text-xs"
          >
            {revokingOthers ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="text-destructive mr-1.5 h-3.5 w-3.5" />
            )}
            Revoke Other Sessions
          </Button>
        )}
      </div>

      {feedback && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-md p-3 text-sm ${
            feedback.type === 'error'
              ? 'bg-destructive/10 border-destructive/30 text-destructive border'
              : 'bg-primary/10 border-primary/30 text-primary border'
          }`}
          role="status"
        >
          {feedback.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {loading && (
        <div className="space-y-3 py-8 text-center">
          <Loader2 className="text-primary mx-auto h-6 w-6 animate-spin" />
          <p className="text-muted-foreground text-xs">Loading active sessions...</p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-destructive/10 border-destructive/30 space-y-3 rounded-md border p-4 text-center">
          <AlertTriangle className="text-destructive mx-auto h-6 w-6" />
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchSessions} className="gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="bg-accent/20 text-muted-foreground rounded-lg p-6 text-center text-sm">
          No active sessions found.
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex flex-col gap-3 rounded-lg p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                session.isCurrent
                  ? 'bg-primary/5 border-primary/40 border shadow-[0_0_15px_rgba(56,189,248,0.08)]'
                  : 'bg-accent/30 border-border/50 hover:bg-accent/40 border'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="bg-background/80 border-border/60 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border">
                  {getDeviceIcon(session.device)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {session.browser || 'Unknown Browser'} on {session.os || 'Unknown OS'}
                    </span>
                    {session.isCurrent && (
                      <span className="bg-success/15 text-success border-success/30 rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide">
                        Current Session
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                    <span>Last active: {formatRelativeTime(session.lastUsedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="sm:self-center">
                <Button
                  variant={session.isCurrent ? 'destructive' : 'outline'}
                  size="sm"
                  disabled={revokingId === session.id}
                  onClick={() => handleRevokeSingle(session)}
                  className="w-full text-xs sm:w-auto"
                >
                  {revokingId === session.id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-3 w-3" />
                  )}
                  {session.isCurrent ? 'Sign Out' : 'Revoke'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
