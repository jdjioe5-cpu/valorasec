import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityScoreRing } from '@/components/dashboard/security-score-ring';

describe('SecurityScoreRing component', () => {
  it('renders score value and out of 100 indicator', () => {
    render(<SecurityScoreRing score={85} />);

    expect(screen.getByTestId('security-score-ring')).toBeInTheDocument();
    expect(screen.getByTestId('score-value')).toHaveTextContent('85');
    expect(screen.getByText('/100')).toBeInTheDocument();
  });

  it('renders green color and Good label when score >= 70', () => {
    render(<SecurityScoreRing score={75} />);

    expect(screen.getByTestId('score-ring-circle')).toHaveClass('stroke-green-400');
    expect(screen.getByTestId('score-status-dot')).toHaveClass('bg-green-400');
    expect(screen.getByTestId('score-status-label')).toHaveTextContent('Good');
  });

  it('renders yellow color and Fair label when score is between 40 and 69', () => {
    render(<SecurityScoreRing score={55} />);

    expect(screen.getByTestId('score-ring-circle')).toHaveClass('stroke-yellow-400');
    expect(screen.getByTestId('score-status-dot')).toHaveClass('bg-yellow-400');
    expect(screen.getByTestId('score-status-label')).toHaveTextContent('Fair');
  });

  it('renders red color and Poor label when score < 40', () => {
    render(<SecurityScoreRing score={25} />);

    expect(screen.getByTestId('score-ring-circle')).toHaveClass('stroke-red-400');
    expect(screen.getByTestId('score-status-dot')).toHaveClass('bg-red-400');
    expect(screen.getByTestId('score-status-label')).toHaveTextContent('Poor');
  });
});
