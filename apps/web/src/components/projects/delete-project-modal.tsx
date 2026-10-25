'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DeleteProjectModalProps {
  isOpen: boolean;
  projectName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteProjectModal({
  isOpen,
  projectName,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteProjectModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
      aria-describedby="delete-project-description"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Background backdrop button */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close modal backdrop"
        onClick={() => {
          if (!isDeleting) onClose();
        }}
        className="fixed inset-0 h-full w-full cursor-default border-none bg-black/60 backdrop-blur-sm"
      />

      {/* Modal Dialog Card */}
      <div className="cyber-card bg-card border-border/80 animate-fade-in relative z-10 w-full max-w-md border p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="bg-destructive/10 text-destructive flex-shrink-0 rounded-full p-3">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h2 id="delete-project-title" className="font-heading text-lg font-bold">
              Delete Project
            </h2>
            <p
              id="delete-project-description"
              className="text-muted-foreground text-sm leading-relaxed"
            >
              Are you sure you want to delete{' '}
              <span className="text-foreground font-semibold">"{projectName}"</span>? This action
              cannot be undone. All associated contracts and scan history records will be
              permanently removed.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="cancel-delete-btn"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="confirm-delete-btn"
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Project'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
