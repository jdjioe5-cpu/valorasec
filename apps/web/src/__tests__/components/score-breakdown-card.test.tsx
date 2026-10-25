import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ScoreBreakdownCard } from '@/components/reports/score-breakdown-card';
import type { Finding, ScoreBreakdown } from '@valorasec/shared';

describe('ScoreBreakdownCard Component', () => {
  it('renders provided ScoreBreakdown data with Grade, deductions, and rationale', () => {
    const mockBreakdown: ScoreBreakdown = {
      baseScore: 100,
      rawDeduction: 28.5,
      densityFactor: 1.25,
      deductionsBySeverity: {
        critical: 25,
        high: 0,
        medium: 3.5,
        low: 0,
        info: 0,
      },
      finalScore: 72,
      grade: 'C',
      rationale: [
        'Deducted 25 pts from Critical vulnerabilities with high exploitability.',
        'Density penalty of 25% applied due to high finding concentration per 100 lines.',
      ],
    };

    render(<ScoreBreakdownCard score={72} breakdown={mockBreakdown} />);

    expect(screen.getByTestId('score-breakdown-card')).toBeInTheDocument();
    expect(screen.getByTestId('score-grade-badge')).toHaveTextContent('Grade C');
    expect(screen.getByText('-28.5')).toBeInTheDocument();
    expect(screen.getByText('1.25x')).toBeInTheDocument();
    expect(screen.getByText('72/100')).toBeInTheDocument();
    expect(screen.getByText('-25 pts')).toBeInTheDocument();
    expect(
      screen.getByText('Deducted 25 pts from Critical vulnerabilities with high exploitability.'),
    ).toBeInTheDocument();
  });

  it('computes fallback breakdown gracefully when breakdown is not provided', () => {
    const mockFindings: Finding[] = [
      {
        id: 'f-1',
        ruleId: 'R001',
        title: 'Missing Auth',
        description: 'desc',
        severity: 'critical',
        recommendation: 'Fix',
      },
      {
        id: 'f-2',
        ruleId: 'R002',
        title: 'Storage bug',
        description: 'desc',
        severity: 'medium',
        recommendation: 'Fix',
      },
    ];

    render(<ScoreBreakdownCard score={67} findings={mockFindings} linesAnalyzed={200} />);

    expect(screen.getByTestId('score-grade-badge')).toHaveTextContent('Grade C');
    expect(screen.getByText('67/100')).toBeInTheDocument();
    expect(screen.getByText('-25 pts')).toBeInTheDocument();
    expect(screen.getByText('-8 pts')).toBeInTheDocument();
  });

  it('renders perfect Grade A and pristine rationale for 0 findings', () => {
    render(<ScoreBreakdownCard score={100} findings={[]} linesAnalyzed={400} />);

    expect(screen.getByTestId('score-grade-badge')).toHaveTextContent('Grade A');
    expect(screen.getByText('100/100')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No security vulnerabilities found. Contract maintains pristine safety rating.',
      ),
    ).toBeInTheDocument();
  });
});
