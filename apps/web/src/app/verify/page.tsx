'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, Loader2, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/navbar';
import { api } from '@/lib/api';

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'idle'>(
    token ? 'verifying' : 'idle',
  );
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('idle');
      return;
    }

    let isMounted = true;
    api
      .verifyEmail(token)
      .then((res) => {
        if (!isMounted) return;
        setStatus('success');
        setMessage(res.data?.message || 'Your email has been verified successfully!');
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setStatus('error');
        setMessage(
          err instanceof Error
            ? err.message
            : 'The verification link is invalid or has expired. Please request a new link.',
        );
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResending(true);
    setResendMessage('');
    try {
      const res = await api.resendVerification(resendEmail);
      setResendMessage(
        res.data?.message || 'If an unverified account exists, a new verification email was sent.',
      );
    } catch (err: unknown) {
      setResendMessage(err instanceof Error ? err.message : 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      <main id="main-content" className="flex items-center justify-center px-4 py-16" tabIndex={-1}>
        <div className="cyber-card animate-fade-in w-full max-w-md p-8 text-center">
          {status === 'verifying' && (
            <div className="space-y-4 py-8">
              <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
              <h1 className="font-heading text-2xl font-bold">Verifying Your Email</h1>
              <p className="text-muted-foreground text-sm">
                Please wait while we confirm your email verification token...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-5 py-6">
              <div className="bg-success/10 text-success mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h1 className="font-heading text-2xl font-bold">Email Verified</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
              <div className="pt-4">
                <Button asChild className="w-full">
                  <Link href="/login" className="flex items-center justify-center gap-2">
                    Proceed to Login
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {(status === 'error' || status === 'idle') && (
            <div className="space-y-5 py-6 text-left">
              <div className="text-center">
                <div className="bg-destructive/10 text-destructive mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <AlertTriangle className="h-10 w-10" />
                </div>
                <h1 className="font-heading text-2xl font-bold">
                  {status === 'error' ? 'Verification Failed' : 'Email Verification'}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {status === 'error'
                    ? message
                    : 'No verification token was provided in the URL. If you need a new link, enter your email below.'}
                </p>
              </div>

              <div className="border-border/60 bg-accent/20 mt-6 rounded-lg border p-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Mail className="text-primary h-4 w-4" />
                  Resend Verification Email
                </h2>
                <form onSubmit={handleResend} className="space-y-3">
                  <div>
                    <label htmlFor="resend-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="resend-email"
                      type="email"
                      placeholder="name@example.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      required
                      className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                  {resendMessage && (
                    <div
                      className={`rounded p-2 text-xs ${
                        resendMessage.includes('Failed')
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary'
                      }`}
                      role="status"
                    >
                      {resendMessage}
                    </div>
                  )}
                  <Button type="submit" disabled={resending} className="w-full" size="sm">
                    {resending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    Send New Link
                  </Button>
                </form>
              </div>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground text-xs transition-colors"
                >
                  Return to sign in
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background min-h-screen">
          <Navbar />
          <main
            id="main-content"
            className="flex items-center justify-center px-4 py-16"
            tabIndex={-1}
          >
            <div className="py-12 text-center">
              <Loader2 className="text-primary mx-auto h-8 w-8 animate-spin" />
            </div>
          </main>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
