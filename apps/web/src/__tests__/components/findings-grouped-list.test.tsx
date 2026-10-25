import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FindingsGroupedList } from '@/components/reports/findings-grouped-list';
import type { Finding } from '@valorasec/shared';

const mockFindings: Finding[] = [
  {
    id: 'f-1',
    ruleId: 'R009',
    title: 'Missing Authorization Check on Invocation',
    description: 'The function fails to verify sender authentication via require_auth.',
    severity: 'critical',
    location: {
      file: 'contracts/vault/src/lib.rs',
      line: 42,
      column: 8,
    },
    recommendation: 'Add env.current_contract_address().require_auth() at entry.',
    references: ['https://soroban.stellar.org/docs/auth'],
  },
  {
    id: 'f-2',
    ruleId: 'R010',
    title: 'Integer Overflow in Token Mint Calculation',
    description: 'Multiplication without checked_mul can cause silent arithmetic wraps.',
    severity: 'critical',
    location: {
      file: 'contracts/vault/src/token.rs',
      line: 110,
    },
    recommendation: 'Use checked_mul and return error on overflow.',
    references: ['https://doc.rust-lang.org/std/primitive.u128.html'],
  },
  {
    id: 'f-3',
    ruleId: 'R003',
    title: 'Outdated Dependency Version',
    description: 'soroban-sdk dependency version is below minimum recommended v22.',
    severity: 'low',
    location: {
      file: 'Cargo.toml',
      line: 14,
    },
    recommendation: 'Upgrade to soroban-sdk 22.0.0 or higher.',
  },
];

describe('FindingsGroupedList Component', () => {
  it('renders zero state when findings list is empty', () => {
    render(<FindingsGroupedList findings={[]} />);
    expect(screen.getByTestId('findings-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No vulnerabilities detected')).toBeInTheDocument();
  });

  it('groups findings by severity and displays count badge', () => {
    render(<FindingsGroupedList findings={mockFindings} />);
    expect(screen.getByTestId('severity-group-critical')).toBeInTheDocument();
    expect(screen.getByTestId('severity-group-low')).toBeInTheDocument();

    expect(screen.getByText('Missing Authorization Check on Invocation')).toBeInTheDocument();
    expect(screen.getByText('Integer Overflow in Token Mint Calculation')).toBeInTheDocument();
    expect(screen.getByText('R009')).toBeInTheDocument();
    expect(screen.getByText('contracts/vault/src/lib.rs:42:8')).toBeInTheDocument();
  });

  it('toggles group expansion on header click', () => {
    render(<FindingsGroupedList findings={mockFindings} />);
    const toggleCriticalBtn = screen.getByTestId('toggle-group-critical');

    // Currently expanded
    expect(toggleCriticalBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Missing Authorization Check on Invocation')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(toggleCriticalBtn);
    expect(toggleCriticalBtn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Missing Authorization Check on Invocation')).not.toBeInTheDocument();

    // Click to re-expand
    fireEvent.click(toggleCriticalBtn);
    expect(toggleCriticalBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Missing Authorization Check on Invocation')).toBeInTheDocument();
  });

  it('handles Expand All and Collapse All global actions', () => {
    render(<FindingsGroupedList findings={mockFindings} />);
    const collapseAllBtn = screen.getByTestId('collapse-all-btn');
    const expandAllBtn = screen.getByTestId('expand-all-btn');

    fireEvent.click(collapseAllBtn);
    expect(screen.queryByText('Missing Authorization Check on Invocation')).not.toBeInTheDocument();

    fireEvent.click(expandAllBtn);
    expect(screen.getByText('Missing Authorization Check on Invocation')).toBeInTheDocument();
    expect(screen.getByText('Outdated Dependency Version')).toBeInTheDocument();
  });
});
