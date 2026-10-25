import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SecurityScoreRing } from '@/components/ui/security-score-ring';

describe('SecurityScoreRing Component', () => {
  it('renders score with green stroke for high score (>=70)', () => {
    render(<SecurityScoreRing score={85} />);
    const scoreText = screen.getByText('85');
    expect(scoreText).toBeInTheDocument();

    const svg = screen.getByRole('img', { name: 'Security Score: 85 out of 100' });
    expect(svg).toBeInTheDocument();

    const circle = svg.querySelectorAll('circle')[1];
    expect(circle).toHaveClass('stroke-green-500');
  });

  it('renders yellow stroke for medium score (40-69)', () => {
    render(<SecurityScoreRing score={55} />);
    const svg = screen.getByRole('img', { name: 'Security Score: 55 out of 100' });
    const circle = svg.querySelectorAll('circle')[1];
    expect(circle).toHaveClass('stroke-yellow-500');
  });

  it('renders red stroke for critical low score (<40)', () => {
    render(<SecurityScoreRing score={25} />);
    const svg = screen.getByRole('img', { name: 'Security Score: 25 out of 100' });
    const circle = svg.querySelectorAll('circle')[1];
    expect(circle).toHaveClass('stroke-red-500');
  });

  it('renders different size dimensions', () => {
    const { rerender } = render(<SecurityScoreRing score={90} size="sm" />);
    let svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '90');

    rerender(<SecurityScoreRing score={90} size="lg" />);
    svg = screen.getByRole('img');
    expect(svg).toHaveAttribute('width', '160');
  });
});
