import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/footer';

describe('Footer component', () => {
  it('renders footer brand, links, and copyright notice', () => {
    render(<Footer />);

    expect(screen.getByRole('link', { name: /valorasec home/i })).toBeInTheDocument();
    expect(
      screen.getByText('Open-source security platform for Soroban smart contracts.'),
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Documentation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Accessibility' })).toBeInTheDocument();

    const githubLink = screen.getByRole('link', { name: /valorasec on github/i });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/valorasec/valorasec');
    expect(githubLink).toHaveAttribute('target', '_blank');

    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${year} ValoraSec`))).toBeInTheDocument();
  });
});
