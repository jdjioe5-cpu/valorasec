'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { useAuthStore } from '@/lib/store/auth-store';
import { api } from '@/lib/api';
import { loginSchema, validateData, mapServerErrorToFields } from '@/lib/validation/auth-schemas';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate form in real-time
  const validationResult = useMemo(() => {
    return validateData(loginSchema, { email, password });
  }, [email, password]);

  const activeErrors = useMemo(() => {
    const errors: { email?: string; password?: string } = {};

    if (touched.email && !validationResult.success && validationResult.errors.email) {
      errors.email = validationResult.errors.email;
    } else if (fieldErrors.email) {
      errors.email = fieldErrors.email;
    }

    if (touched.password && !validationResult.success && validationResult.errors.password) {
      errors.password = validationResult.errors.password;
    } else if (fieldErrors.password) {
      errors.password = fieldErrors.password;
    }

    return errors;
  }, [touched, validationResult, fieldErrors]);

  const isFormValid = validationResult.success;

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    setFieldErrors((prev) => ({ ...prev, email: undefined }));
    setServerError('');
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    setFieldErrors((prev) => ({ ...prev, password: undefined }));
    setServerError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setServerError('');

    const validation = validateData(loginSchema, { email, password });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setLoading(true);

    try {
      const res = await api.login({ email, password });
      setAuth(res.data.user, res.data.tokens);
      api.setTokens(res.data.tokens);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      const mapped = mapServerErrorToFields(message);

      if (mapped.field === 'email' || mapped.field === 'password') {
        setFieldErrors((prev) => ({ ...prev, [mapped.field as string]: mapped.message }));
      }
      setServerError(mapped.message);
    } finally {
      setLoading(false);
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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {serverError && (
            <div
              data-testid="login-server-error"
              className="bg-destructive/10 border-destructive/30 text-destructive rounded-md border p-3 text-sm"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              data-testid="login-email-input"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => handleBlur('email')}
              aria-invalid={Boolean(activeErrors.email)}
              aria-describedby={activeErrors.email ? 'email-error' : undefined}
              className={`border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                activeErrors.email ? 'border-destructive focus:ring-destructive' : ''
              }`}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            {activeErrors.email && (
              <p
                id="email-error"
                data-testid="login-email-error"
                role="alert"
                className="text-destructive mt-1.5 text-xs"
              >
                {activeErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <PasswordInput
              id="password"
              data-testid="login-password-input"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={() => handleBlur('password')}
              aria-invalid={Boolean(activeErrors.password)}
              aria-describedby={activeErrors.password ? 'password-error' : undefined}
              error={Boolean(activeErrors.password)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            {activeErrors.password && (
              <p
                id="password-error"
                data-testid="login-password-error"
                role="alert"
                className="text-destructive mt-1.5 text-xs"
              >
                {activeErrors.password}
              </p>
            )}
          </div>

          <Button
            type="submit"
            data-testid="login-submit-btn"
            className="w-full"
            disabled={loading || !isFormValid}
          >
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
