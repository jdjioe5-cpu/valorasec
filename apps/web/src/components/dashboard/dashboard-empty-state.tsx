import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardEmptyState() {
  return (
    <div data-testid="dashboard-empty-state" className="cyber-card p-8 text-center">
      <AlertTriangle className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
      <p className="text-muted-foreground mb-4 text-sm">No projects yet</p>
      <Link href="/projects/new">
        <Button variant="cyber" size="sm" data-testid="create-project-cta">
          <Plus className="mr-2 h-4 w-4" /> Create your first project
        </Button>
      </Link>
    </div>
  );
}
