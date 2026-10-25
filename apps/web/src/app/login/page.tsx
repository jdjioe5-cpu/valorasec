'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth-store';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const isUnverifiedError =
    error.toLowerCase().includes('verify') || error.toLowerCase().includes('verification');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResendStatus('');
    setLoading(true);

    try {
      const res = await api.login({ email, password });
      setAuth(res.data.user, res.data.tokens);
      api.setTokens(res.data.tokens);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Please enter your email above to resend verification.');
      return;
    }
    setResending(true);
    setResendStatus('');
    try {
      const res = await api.resendVerification(email);
      setResendStatus(res.data?.message || 'Verification email resent successfully.');
    } catch (err: unknown) {
      setResendStatus(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <main id="main-content" className="bg-background flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md px-6">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <Shield className="text-primary h-8 w-8" />
            <span className="font-heading text-2xl font-bold">
              Valora<span className="text-primary">Sec</span>
            </span>
          </Link>
          <h1 className="mb-2 text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground text-sm">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              className="bg-destructive/10 border-destructive/30 text-destructive space-y-2 rounded-md border p-3.5 text-sm"
              role="alert"
            >
              <div>{error}</div>
              {isUnverifiedError && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="text-primary hover:text-primary/80 flex items-center gap-1.5 text-xs font-medium underline transition-colors"
                  >
                    {resending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <MailCheck className="h-3.5 w-3.5" />
                    )}
                    Resend verification email
                  </button>
                </div>
              )}
            </div>
          )}

          {resendStatus && (
            <div
              className={`rounded-md p-3 text-sm ${
                resendStatus.includes('Failed')
                  ? 'bg-destructive/10 text-destructive border-destructive/30 border'
                  : 'bg-primary/10 text-primary border-primary/30 border'
              }`}
              role="status"
            >
              {resendStatus}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign In
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
