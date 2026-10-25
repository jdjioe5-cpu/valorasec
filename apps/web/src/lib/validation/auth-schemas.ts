import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type RegisterFormData = z.infer<typeof registerSchema>;

export interface PasswordStrength {
  score: number; // 0 - 4
  hasLength: boolean;
  hasMixedCase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
}

export function getPasswordStrength(password: string): PasswordStrength {
  const hasLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (hasLength) score++;
  if (hasMixedCase) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;

  let label: 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Weak';
  if (score === 2) label = 'Fair';
  else if (score === 3) label = 'Good';
  else if (score >= 4) label = 'Strong';

  return {
    score,
    hasLength,
    hasMixedCase,
    hasNumber,
    hasSpecial,
    label,
  };
}

export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (key && !errors[String(key)]) {
      errors[String(key)] = issue.message;
    }
  }

  return { success: false, errors };
}

export function mapServerErrorToFields(errorMessage: string): { field?: string; message: string } {
  const lower = errorMessage.toLowerCase();

  if (
    lower.includes('credentials') ||
    lower.includes('unauthorized') ||
    (lower.includes('invalid') && lower.includes('password'))
  ) {
    return { field: 'password', message: 'Invalid email or password' };
  }
  if (
    lower.includes('email') &&
    (lower.includes('taken') || lower.includes('exist') || lower.includes('already'))
  ) {
    return { field: 'email', message: 'An account with this email already exists' };
  }
  if (lower.includes('email') && (lower.includes('invalid') || lower.includes('format'))) {
    return { field: 'email', message: 'Please enter a valid email address' };
  }
  if (
    lower.includes('password') &&
    (lower.includes('incorrect') || lower.includes('wrong') || lower.includes('invalid'))
  ) {
    return { field: 'password', message: 'Incorrect password' };
  }
  if (lower.includes('name')) {
    return { field: 'name', message: errorMessage };
  }

  return { message: errorMessage };
}
