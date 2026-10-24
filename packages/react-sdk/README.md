# @valorasec/react

Official React hooks library for the ValoraSec SDK, powered by [TanStack React Query](https://tanstack.com/query). Provides declarative queries, cache invalidation, mutation management, and automatic progress polling for Soroban smart contract security auditing.

## Installation

```bash
pnpm add @valorasec/react @valorasec/sdk @tanstack/react-query
```

## Setup

Wrap your application in `QueryClientProvider` and `ValoraSecProvider`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ValoraSecProvider } from '@valorasec/react';
import { ValoraSecClient } from '@valorasec/sdk';

const queryClient = new QueryClient();
const client = new ValoraSecClient({ baseUrl: 'https://api.valorasec.com' });

export function App({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ValoraSecProvider client={client}>{children}</ValoraSecProvider>
    </QueryClientProvider>
  );
}
```

## Available Hooks

### 1. `useProjects(params?, options?)`

Fetches paginated projects with query parameters tracked in the cache key.

```tsx
import { useProjects } from '@valorasec/react';

function ProjectsList() {
  const { data, isLoading, isError, error } = useProjects({ page: 1, limit: 10, search: 'vault' });

  if (isLoading) return <p>Loading...</p>;
  if (isError) return <p>Error: {error?.message}</p>;

  return (
    <ul>
      {data?.data.map((project) => (
        <li key={project.id}>{project.name}</li>
      ))}
    </ul>
  );
}
```

### 2. `useProject(id, options?)`

Fetches a single project by its ID. Exposes both raw `data` and unwrapped `project`.

```tsx
import { useProject } from '@valorasec/react';

function ProjectDetail({ id }: { id: string }) {
  const { project, isLoading } = useProject(id);
  if (isLoading) return <p>Loading project...</p>;
  return <h1>{project?.name}</h1>;
}
```

### 3. `useReports(params?, options?)`

Fetches paginated audit and scan reports with filtering.

```tsx
import { useReports } from '@valorasec/react';

function Reports({ projectId }: { projectId: string }) {
  const { data: reports, isLoading } = useReports({ projectId, page: 1, limit: 20 });
  // ...
}
```

### 4. `useRunScan(projectId?, contractId?, options?)`

Initiates a Soroban smart contract security scan and automatically polls progress until completion.

```tsx
import { useRunScan } from '@valorasec/react';

function Scanner({ projectId, contractId }: { projectId: string; contractId: string }) {
  const { runScan, scanResult, isLoading, isPolling } = useRunScan(projectId, contractId, {
    pollingInterval: 1000,
    onProgress: (scan) => console.log('Scanning status:', scan.status),
    onScanComplete: (scan) => console.log('Scan completed, score:', scan.summary.score),
  });

  return (
    <button disabled={isLoading} onClick={() => runScan()}>
      {isPolling ? 'Analyzing Contract...' : 'Run Security Scan'}
    </button>
  );
}
```

### 5. `useAuth(options?)`

Provides authentication mutations (`login`, `register`, `logout`) and tracks current user profile and authentication status.

```tsx
import { useAuth } from '@valorasec/react';

function UserProfile() {
  const { user, isAuthenticated, login, logout, isLoading } = useAuth();

  if (isLoading) return <p>Loading...</p>;
  if (!isAuthenticated) {
    return (
      <button onClick={() => login({ email: 'user@example.com', password: 'secret' })}>
        Sign In
      </button>
    );
  }

  return (
    <div>
      <p>Welcome, {user?.name}</p>
      <button onClick={() => logout()}>Sign Out</button>
    </div>
  );
}
```
