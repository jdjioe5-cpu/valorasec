'use client';

import { ValoraSecProvider, SdkHooksDemo } from '@valorasec/react';
import { getApiClient } from '@/lib/api';

export default function HooksDemoPage() {
  const client = getApiClient();

  return (
    <ValoraSecProvider client={client}>
      <main className="bg-background text-foreground min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SdkHooksDemo />
        </div>
      </main>
    </ValoraSecProvider>
  );
}
