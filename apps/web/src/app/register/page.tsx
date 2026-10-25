'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { useAuthStore } from '@/lib/store/auth-store';
import { api } from '@/lib/api';
import {
  registerSchema,
  validateData,
  getPasswordStrength,
  mapServerErrorToFields,
} from '@/lib/validation/auth-schemas';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean; password?: boolean }>(
    {},
  );
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate form in real-time
  const validationResult = useMemo(() => {
    return validateData(registerSchema, { name, email, password });
  }, [name, email, password]);

  const passwordStrength = useMemo(() => {
    return getPasswordStrength(password);
  }, [password]);

  const activeErrors = useMemo(() => {
    const errors: { name?: string; email?: string; password?: string } = {};

    if (touched.name && !validationResult.success && validationResult.errors.name) {
      errors.name = validationResult.errors.name;
    } else if (fieldErrors.name) {
      errors.name = fieldErrors.name;
    }

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

  const handleBlur = (field: 'name' | 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setFieldErrors((prev) => ({ ...prev, name: undefined }));
    setServerError('');
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
    setTouched({ name: true, email: true, password: true });
    setServerError('');

    const validation = validateData(registerSchema, { name, email, password });
    if (!validation.success) {
      setFieldErrors(validation.errors);
      return;
    }

    setLoading(true);

    try {
      const res = await api.register({ email, password, name });
      setAuth(res.data.user, res.data.tokens);
      api.setTokens(res.data.tokens);
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      const mapped = mapServerErrorToFields(message);

      if (mapped.field) {
        setFieldErrors((prev) => ({ ...prev, [mapped.field as string]: mapped.message }));
      }
      setServerError(mapped.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      id="main-content"
      className="bg-background flex min-h-screen items-center justify-center py-12"
    >
      <div className="w-full max-w-md px-6">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <Shield className="text-primary h-8 w-8" />
            <span className="font-heading text-2xl font-bold">
              Valora<span className="text-primary">Sec</span>
            </span>
          </Link>
          <h1 className="mb-2 text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm">Start auditing your Soroban contracts</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {serverError && (
            <div
              data-testid="register-server-error"
              className="bg-destructive/10 border-destructive/30 text-destructive rounded-md border p-3 text-sm"
              role="alert"
            >
              {serverError}
            </div>
          )}

          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Full Name
            </label>
            <input
              id="name"
              data-testid="register-name-input"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => handleBlur('name')}
              aria-invalid={Boolean(activeErrors.name)}
              aria-describedby={activeErrors.name ? 'name-error' : undefined}
              className={`border-input bg-background ring-offset-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                activeErrors.name ? 'border-destructive focus:ring-destructive' : ''
              }`}
              placeholder="Satoshi Nakamoto"
              required
              autoComplete="name"
            />
            {activeErrors.name && (
              <p
                id="name-error"
                data-testid="register-name-error"
                role="alert"
                className="text-destructive mt-1.5 text-xs"
              >
                {activeErrors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email Address
            </label>
            <input
              id="email"
              data-testid="register-email-input"
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
                data-testid="register-email-error"
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
              data-testid="register-password-input"
              value={password}
              onChange={(e) => handlePasswordChange(e.target.value)}
              onBlur={() => handleBlur('password')}
              aria-invalid={Boolean(activeErrors.password)}
              aria-describedby={activeErrors.password ? 'password-error' : undefined}
              error={Boolean(activeErrors.password)}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
            />

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div data-testid="password-strength-container" className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Strength:</span>
                  <span
                    data-testid="password-strength-label"
                    className={`font-semibold ${
                      passwordStrength.label === 'Strong'
                        ? 'text-green-500'
                        : passwordStrength.label === 'Good'
                          ? 'text-blue-500'
                          : passwordStrength.label === 'Fair'
                            ? 'text-yellow-500'
                            : 'text-red-500'
                    }`}
                  >
                    {passwordStrength.label}
                  </span>
                </div>

                <div className="bg-muted/40 flex h-1 w-full gap-1 overflow-hidden rounded">
                  <div
                    className={`h-full flex-1 transition-colors ${
                      passwordStrength.score >= 1
                        ? passwordStrength.score === 1
                          ? 'bg-red-500'
                          : passwordStrength.score === 2
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        : 'bg-transparent'
                    }`}
                  />
                  <div
                    className={`h-full flex-1 transition-colors ${
                      passwordStrength.score >= 2
                        ? passwordStrength.score === 2
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                        : 'bg-transparent'
                    }`}
                  />
                  <div
                    className={`h-full flex-1 transition-colors ${
                      passwordStrength.score >= 3 ? 'bg-green-500' : 'bg-transparent'
                    }`}
                  />
                  <div
                    className={`h-full flex-1 transition-colors ${
                      passwordStrength.score >= 4 ? 'bg-green-500' : 'bg-transparent'
                    }`}
                  />
                </div>

                {/* Password Criteria Checklist */}
                <div className="text-muted-foreground grid grid-cols-2 gap-1 pt-1 text-[11px]">
                  <span
                    className={`flex items-center gap-1 ${passwordStrength.hasLength ? 'text-green-500' : ''}`}
                  >
                    {passwordStrength.hasLength ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    8+ characters
                  </span>
                  <span
                    className={`flex items-center gap-1 ${passwordStrength.hasMixedCase ? 'text-green-500' : ''}`}
                  >
                    {passwordStrength.hasMixedCase ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    Upper & lower case
                  </span>
                  <span
                    className={`flex items-center gap-1 ${passwordStrength.hasNumber ? 'text-green-500' : ''}`}
                  >
                    {passwordStrength.hasNumber ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    At least one number
                  </span>
                </div>
              </div>
            )}

            {activeErrors.password && (
              <p
                id="password-error"
                data-testid="register-password-error"
                role="alert"
                className="text-destructive mt-1.5 text-xs"
              >
                {activeErrors.password}
              </p>
            )}
          </div>

          <Button
            type="submit"
            data-testid="register-submit-btn"
            className="w-full"
            disabled={loading || !isFormValid}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Account
          </Button>
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
