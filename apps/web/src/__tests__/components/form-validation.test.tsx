import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LoginPage from '@/app/login/page';
import RegisterPage from '@/app/register/page';
import { PasswordInput } from '@/components/ui/password-input';
import { api } from '@/lib/api';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    setTokens: vi.fn(),
  },
}));

describe('Form Validation & Error Handling Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PasswordInput Component', () => {
    it('renders with type="password" and allows toggling to text', () => {
      render(<PasswordInput data-testid="pwd-input" />);
      const input = screen.getByTestId('pwd-input');
      expect(input).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button', { name: 'Show password' });
      expect(toggleBtn).toBeInTheDocument();

      fireEvent.click(toggleBtn);
      expect(input).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
      expect(input).toHaveAttribute('type', 'password');
    });
  });

  describe('LoginPage Form Validation', () => {
    it('disables submit button initially and validates fields on blur', async () => {
      render(<LoginPage />);

      const submitBtn = screen.getByTestId('login-submit-btn');
      expect(submitBtn).toBeDisabled();

      const emailInput = screen.getByTestId('login-email-input');
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        const errorMsg = screen.getByTestId('login-email-error');
        expect(errorMsg).toHaveTextContent('Please enter a valid email address');
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');
      });

      // Submit button remains disabled
      expect(submitBtn).toBeDisabled();
    });

    it('enables submit button when valid email and password are provided', async () => {
      render(<LoginPage />);

      const emailInput = screen.getByTestId('login-email-input');
      const passwordInput = screen.getByTestId('login-password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecretPassword123' } });

      await waitFor(() => {
        expect(screen.queryByTestId('login-email-error')).not.toBeInTheDocument();
        expect(screen.queryByTestId('login-password-error')).not.toBeInTheDocument();
        expect(submitBtn).not.toBeDisabled();
      });
    });

    it('maps server authentication error to field and displays alert', async () => {
      vi.mocked(api.login).mockRejectedValue(new Error('Invalid email or password'));

      render(<LoginPage />);

      const emailInput = screen.getByTestId('login-email-input');
      const passwordInput = screen.getByTestId('login-password-input');
      const submitBtn = screen.getByTestId('login-submit-btn');

      fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'WrongPass' } });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('login-server-error')).toHaveTextContent(
          'Invalid email or password',
        );
        expect(screen.getByTestId('login-password-error')).toHaveTextContent(
          'Invalid email or password',
        );
      });
    });
  });

  describe('RegisterPage Form Validation', () => {
    it('disables submit button initially and validates short name', async () => {
      render(<RegisterPage />);

      const submitBtn = screen.getByTestId('register-submit-btn');
      expect(submitBtn).toBeDisabled();

      const nameInput = screen.getByTestId('register-name-input');
      fireEvent.change(nameInput, { target: { value: 'A' } });
      fireEvent.blur(nameInput);

      await waitFor(() => {
        const error = screen.getByTestId('register-name-error');
        expect(error).toHaveTextContent('Name must be at least 2 characters');
        expect(nameInput).toHaveAttribute('aria-invalid', 'true');
        expect(nameInput).toHaveAttribute('aria-describedby', 'name-error');
      });
    });

    it('calculates real-time password strength and checklist', async () => {
      render(<RegisterPage />);

      const passwordInput = screen.getByTestId('register-password-input');

      // Type weak password
      fireEvent.change(passwordInput, { target: { value: 'pass' } });

      await waitFor(() => {
        expect(screen.getByTestId('password-strength-container')).toBeInTheDocument();
        expect(screen.getByTestId('password-strength-label')).toHaveTextContent('Weak');
      });

      // Type strong password meeting all criteria
      fireEvent.change(passwordInput, { target: { value: 'SecurePass123' } });

      await waitFor(() => {
        expect(screen.getByTestId('password-strength-label')).toHaveTextContent('Good');
      });
    });

    it('allows submission when name, email, and strong password are provided', async () => {
      vi.mocked(api.register).mockResolvedValue({
        data: {
          user: {
            id: 'u1',
            email: 'newuser@example.com',
            name: 'New User',
            role: 'user',
            isVerified: false,
            createdAt: '',
            updatedAt: '',
          },
          tokens: {
            accessToken: 'acc',
            refreshToken: 'ref',
            expiresIn: 3600,
          },
        },
      });

      render(<RegisterPage />);

      fireEvent.change(screen.getByTestId('register-name-input'), {
        target: { value: 'Alice Star' },
      });
      fireEvent.change(screen.getByTestId('register-email-input'), {
        target: { value: 'alice@example.com' },
      });
      fireEvent.change(screen.getByTestId('register-password-input'), {
        target: { value: 'ComplexPass123' },
      });

      const submitBtn = screen.getByTestId('register-submit-btn');
      await waitFor(() => {
        expect(submitBtn).not.toBeDisabled();
      });

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(api.register).toHaveBeenCalledWith({
          name: 'Alice Star',
          email: 'alice@example.com',
          password: 'ComplexPass123',
        });
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('maps email already exists server error to email field', async () => {
      vi.mocked(api.register).mockRejectedValue(new Error('Email already exists in system'));

      render(<RegisterPage />);

      fireEvent.change(screen.getByTestId('register-name-input'), { target: { value: 'Bob' } });
      fireEvent.change(screen.getByTestId('register-email-input'), {
        target: { value: 'bob@existing.com' },
      });
      fireEvent.change(screen.getByTestId('register-password-input'), {
        target: { value: 'ValidPass1' },
      });

      const submitBtn = screen.getByTestId('register-submit-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId('register-server-error')).toHaveTextContent(
          'An account with this email already exists',
        );
        expect(screen.getByTestId('register-email-error')).toHaveTextContent(
          'An account with this email already exists',
        );
      });
    });
  });
});
