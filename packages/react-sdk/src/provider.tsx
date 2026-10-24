import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ValoraSecClient, type SdkConfig } from '@valorasec/sdk';
import type { ValoraSecContextValue } from './types';

const ValoraSecContext = createContext<ValoraSecContextValue | null>(null);

export interface ValoraSecProviderProps {
  client?: ValoraSecClient;
  config?: SdkConfig;
  children: ReactNode;
}

export function ValoraSecProvider({ client, config, children }: ValoraSecProviderProps) {
  const value = useMemo<ValoraSecContextValue>(() => {
    if (client) {
      return { client };
    }
    if (config) {
      return { client: new ValoraSecClient(config) };
    }
    throw new Error('ValoraSecProvider requires either a "client" instance or a "config" object.');
  }, [client, config]);

  return <ValoraSecContext.Provider value={value}>{children}</ValoraSecContext.Provider>;
}

export function useValoraSecClient(customClient?: ValoraSecClient): ValoraSecClient {
  const context = useContext(ValoraSecContext);
  if (customClient) {
    return customClient;
  }
  if (!context?.client) {
    throw new Error(
      'No ValoraSecClient found. Wrap your component tree in <ValoraSecProvider client={...}> or pass a client directly to the hook.',
    );
  }
  return context.client;
}
