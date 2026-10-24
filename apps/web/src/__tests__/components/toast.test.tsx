import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toaster } from '@/components/ui/toaster';
import { toast, useToast } from '@/components/ui/use-toast';

function ToastTrigger() {
  const { toast: trigger } = useToast();
  return (
    <button
      onClick={() =>
        trigger({
          title: 'Scan Complete',
          description: 'No vulnerabilities found.',
        })
      }
    >
      Show Notification
    </button>
  );
}

describe('Toast & Toaster component', () => {
  it('renders toaster container and displays toast on trigger', () => {
    render(
      <>
        <ToastTrigger />
        <Toaster />
      </>,
    );

    expect(screen.getByRole('button', { name: /show notification/i })).toBeInTheDocument();

    act(() => {
      toast({
        title: 'Security Alert',
        description: 'Critical issue detected.',
      });
    });

    expect(screen.getByText('Security Alert')).toBeInTheDocument();
    expect(screen.getByText('Critical issue detected.')).toBeInTheDocument();
  });
});
