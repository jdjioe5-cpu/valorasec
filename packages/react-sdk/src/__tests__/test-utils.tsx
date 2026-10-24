import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ValoraSecProvider } from '../provider';
import type { ValoraSecClient } from '@valorasec/sdk';
import { vi } from 'vitest';
import type {
  ApiSuccess,
  PaginatedResponse,
  Project,
  Report,
  ScanResult,
  User,
} from '@valorasec/shared';

// Configure React act environment
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        networkMode: 'always',
      },
      mutations: {
        retry: false,
        gcTime: Infinity,
        networkMode: 'always',
      },
    },
  });
}

export async function waitFor(
  callback: () => void | Promise<void>,
  { timeout = 2000, interval = 25 } = {},
): Promise<void> {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeout) {
    try {
      await act(async () => {
        await callback();
      });
      return;
    } catch (err) {
      lastError = err;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, interval));
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('waitFor timed out');
}

export const mockProject: Project = {
  id: 'proj-123',
  userId: 'user-1',
  name: 'Soroban Vault',
  description: 'DeFi vault contract',
  network: 'testnet',
  contracts: [
    {
      id: 'contract-1',
      projectId: 'proj-123',
      name: 'VaultContract',
      address: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
      network: 'testnet',
      createdAt: '2026-10-25T00:00:00.000Z',
      updatedAt: '2026-10-25T00:00:00.000Z',
    },
  ],
  createdAt: '2026-10-25T00:00:00.000Z',
  updatedAt: '2026-10-25T00:00:00.000Z',
};

export const mockProjectsResponse: PaginatedResponse<Project> = {
  data: [mockProject],
  meta: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

export const mockReport: Report = {
  id: 'rep-999',
  scanId: 'scan-111',
  projectId: 'proj-123',
  contractId: 'contract-1',
  userId: 'usr-1',
  title: 'Audit Report for VaultContract',
  findings: [],
  summary: {
    totalFindings: 1,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 1,
      low: 0,
      info: 0,
    },
    score: 92,
    linesAnalyzed: 450,
    rulesExecuted: 13,
  },
  status: 'published',
  verifiedOnChain: false,
  createdAt: '2026-10-25T00:00:00.000Z',
  updatedAt: '2026-10-25T00:00:00.000Z',
};

export const mockReportsResponse: PaginatedResponse<Report> = {
  data: [mockReport],
  meta: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
};

export const mockUser: User = {
  id: 'usr-1',
  email: 'auditor@stellar.org',
  name: 'Security Lead',
  role: 'admin',
  isVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const mockScanResult: ScanResult = {
  id: 'scan-111',
  projectId: 'proj-123',
  contractId: 'contract-1',
  status: 'completed',
  findings: [],
  summary: {
    totalFindings: 0,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    },
    score: 100,
    linesAnalyzed: 320,
    rulesExecuted: 13,
  },
  startedAt: '2026-10-25T00:00:00.000Z',
  completedAt: '2026-10-25T00:00:02.000Z',
  duration: 2000,
};

export function createMockValoraSecClient(
  overrides: Partial<Record<keyof ValoraSecClient, unknown>> = {},
): ValoraSecClient {
  return {
    getProjects: vi.fn().mockResolvedValue(mockProjectsResponse),
    getProject: vi
      .fn()
      .mockResolvedValue({ success: true, data: mockProject } as ApiSuccess<Project>),
    getReports: vi.fn().mockResolvedValue(mockReportsResponse),
    getReport: vi.fn().mockResolvedValue({ success: true, data: mockReport } as ApiSuccess<Report>),
    runScan: vi
      .fn()
      .mockResolvedValue({ success: true, data: mockScanResult } as ApiSuccess<ScanResult>),
    getScanDetails: vi
      .fn()
      .mockResolvedValue({ success: true, data: mockScanResult } as ApiSuccess<ScanResult>),
    getProfile: vi.fn().mockResolvedValue({ success: true, data: mockUser } as ApiSuccess<User>),
    login: vi.fn().mockResolvedValue({
      success: true,
      data: {
        user: mockUser,
        tokens: { accessToken: 'mock-access', refreshToken: 'mock-refresh' },
      },
    }),
    register: vi.fn().mockResolvedValue({
      success: true,
      data: {
        user: mockUser,
        tokens: { accessToken: 'mock-access', refreshToken: 'mock-refresh' },
      },
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    setTokens: vi.fn(),
    setOnTokenRefresh: vi.fn(),
    getContracts: vi.fn().mockResolvedValue({ success: true, data: mockProject.contracts }),
    ...overrides,
  } as unknown as ValoraSecClient;
}

export function renderHookWithClient<TResult, TProps = void>(
  hookFn: (props: TProps) => TResult,
  client: ValoraSecClient,
  queryClient: QueryClient = createTestQueryClient(),
) {
  const result = { current: undefined as unknown as TResult };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ValoraSecProvider client={client}>{children}</ValoraSecProvider>
      </QueryClientProvider>
    );
  }

  function TestComponent({ props }: { props: TProps }) {
    result.current = hookFn(props);
    return null;
  }

  act(() => {
    root.render(
      <Wrapper>
        <TestComponent props={undefined as unknown as TProps} />
      </Wrapper>,
    );
  });

  return {
    result,
    rerender: (newProps?: TProps) => {
      act(() => {
        root.render(
          <Wrapper>
            <TestComponent props={newProps as unknown as TProps} />
          </Wrapper>,
        );
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
    queryClient,
  };
}
