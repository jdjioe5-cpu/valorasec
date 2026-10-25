import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  getPasswordStrength,
  validateData,
  mapServerErrorToFields,
} from '@/lib/validation/auth-schemas';

describe('Auth Validation Schemas & Utilities', () => {
  describe('loginSchema', () => {
    it('validates correct email and password', () => {
      const res = validateData(loginSchema, {
        email: 'user@example.com',
        password: 'Password123',
      });
      expect(res.success).toBe(true);
    });

    it('rejects empty email and password', () => {
      const res = validateData(loginSchema, {
        email: '',
        password: '',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.email).toBe('Email is required');
        expect(res.errors.password).toBe('Password is required');
      }
    });

    it('rejects invalid email formats', () => {
      const res = validateData(loginSchema, {
        email: 'invalid-email-string',
        password: 'validpassword',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.email).toBe('Please enter a valid email address');
      }
    });
  });

  describe('registerSchema', () => {
    it('validates a complete valid registration payload', () => {
      const res = validateData(registerSchema, {
        name: 'Alice Developer',
        email: 'alice@stellar.org',
        password: 'SecurePassword1',
      });
      expect(res.success).toBe(true);
    });

    it('rejects short name (< 2 characters)', () => {
      const res = validateData(registerSchema, {
        name: 'A',
        email: 'alice@stellar.org',
        password: 'SecurePassword1',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.name).toBe('Name must be at least 2 characters');
      }
    });

    it('rejects password shorter than 8 characters', () => {
      const res = validateData(registerSchema, {
        name: 'Alice',
        email: 'alice@stellar.org',
        password: 'Pass1',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.password).toBe('Password must be at least 8 characters');
      }
    });

    it('rejects password without uppercase letter', () => {
      const res = validateData(registerSchema, {
        name: 'Alice',
        email: 'alice@stellar.org',
        password: 'password123',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.password).toBe('Password must contain at least one uppercase letter');
      }
    });

    it('rejects password without lowercase letter', () => {
      const res = validateData(registerSchema, {
        name: 'Alice',
        email: 'alice@stellar.org',
        password: 'PASSWORD123',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.password).toBe('Password must contain at least one lowercase letter');
      }
    });

    it('rejects password without number', () => {
      const res = validateData(registerSchema, {
        name: 'Alice',
        email: 'alice@stellar.org',
        password: 'PasswordOnly',
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errors.password).toBe('Password must contain at least one number');
      }
    });
  });

  describe('getPasswordStrength', () => {
    it('returns score 0 / Weak for empty string', () => {
      const s = getPasswordStrength('');
      expect(s.score).toBe(0);
      expect(s.label).toBe('Weak');
      expect(s.hasLength).toBe(false);
      expect(s.hasMixedCase).toBe(false);
      expect(s.hasNumber).toBe(false);
    });

    it('returns Fair for moderate password (length + mixed case)', () => {
      const s = getPasswordStrength('Password');
      expect(s.score).toBe(2);
      expect(s.label).toBe('Fair');
      expect(s.hasLength).toBe(true);
      expect(s.hasMixedCase).toBe(true);
      expect(s.hasNumber).toBe(false);
    });

    it('returns Good for strong password (length + mixed case + number)', () => {
      const s = getPasswordStrength('Password123');
      expect(s.score).toBe(3);
      expect(s.label).toBe('Good');
      expect(s.hasLength).toBe(true);
      expect(s.hasMixedCase).toBe(true);
      expect(s.hasNumber).toBe(true);
    });

    it('returns Strong when special characters are included', () => {
      const s = getPasswordStrength('Password123!@#');
      expect(s.score).toBe(4);
      expect(s.label).toBe('Strong');
      expect(s.hasSpecial).toBe(true);
    });
  });

  describe('mapServerErrorToFields', () => {
    it('maps email already taken errors to email field', () => {
      const mapped = mapServerErrorToFields('Email already exists');
      expect(mapped.field).toBe('email');
      expect(mapped.message).toBe('An account with this email already exists');
    });

    it('maps invalid credentials errors to password field', () => {
      const mapped = mapServerErrorToFields('Invalid credentials provided');
      expect(mapped.field).toBe('password');
      expect(mapped.message).toBe('Invalid email or password');
    });

    it('maps incorrect password errors to password field', () => {
      const mapped = mapServerErrorToFields('Incorrect password');
      expect(mapped.field).toBe('password');
      expect(mapped.message).toBe('Incorrect password');
    });

    it('preserves generic server errors without specific field', () => {
      const mapped = mapServerErrorToFields('Internal server error 500');
      expect(mapped.field).toBeUndefined();
      expect(mapped.message).toBe('Internal server error 500');
    });
  });
});
