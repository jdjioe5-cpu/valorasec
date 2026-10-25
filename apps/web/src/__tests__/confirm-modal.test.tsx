// @ts-expect-error react act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { axe } from 'jest-axe';
import { ConfirmModal } from '@/components/ui/confirm-modal';

describe('ConfirmModal Component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders confirmation modal with title and description when open', async () => {
    await act(async () => {
      root.render(
        <ConfirmModal
          open={true}
          onOpenChange={vi.fn()}
          title="Archive Project"
          description="Are you sure you want to archive this project?"
          confirmText="Archive"
          cancelText="Cancel"
          onConfirm={vi.fn()}
        />,
      );
    });

    expect(document.body.textContent).toContain('Archive Project');
    expect(document.body.textContent).toContain('Are you sure you want to archive this project?');
    expect(document.body.textContent).toContain('Archive');
    expect(document.body.textContent).toContain('Cancel');
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirmMock = vi.fn();
    const onOpenChangeMock = vi.fn();

    await act(async () => {
      root.render(
        <ConfirmModal
          open={true}
          onOpenChange={onOpenChangeMock}
          title="Delete Project"
          description="Are you sure?"
          confirmText="Delete"
          variant="destructive"
          onConfirm={onConfirmMock}
        />,
      );
    });

    const buttons = Array.from(document.querySelectorAll('button'));
    const confirmBtn = buttons.find((b) => b.textContent?.includes('Delete'));
    expect(confirmBtn).toBeDefined();

    await act(async () => {
      confirmBtn?.click();
    });

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel and closes when cancel button is clicked', async () => {
    const onCancelMock = vi.fn();
    const onOpenChangeMock = vi.fn();

    await act(async () => {
      root.render(
        <ConfirmModal
          open={true}
          onOpenChange={onOpenChangeMock}
          title="Restore Project"
          description="Restore this?"
          confirmText="Restore"
          cancelText="Nevermind"
          onCancel={onCancelMock}
          onConfirm={vi.fn()}
        />,
      );
    });

    const buttons = Array.from(document.querySelectorAll('button'));
    const cancelBtn = buttons.find((b) => b.textContent?.includes('Nevermind'));
    expect(cancelBtn).toBeDefined();

    await act(async () => {
      cancelBtn?.click();
    });

    expect(onCancelMock).toHaveBeenCalledTimes(1);
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it('passes axe accessibility checks', async () => {
    await act(async () => {
      root.render(
        <ConfirmModal
          open={true}
          onOpenChange={vi.fn()}
          title="Confirm Action"
          description="Accessible description"
          confirmText="Yes"
          cancelText="No"
          onConfirm={vi.fn()}
        />,
      );
    });

    const results = await axe(document.body);
    expect(results.violations).toHaveLength(0);
  });
});
