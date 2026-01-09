/**
 * React context for providing the current DataAdapter instance.
 * This allows the adapter to be dynamically created based on the current notebook ID.
 */

import { createContext, useContext } from 'react';
import type { DataAdapter } from './DataAdapter';

export const DataAdapterContext = createContext<DataAdapter | null>(null);

/**
 * Hook to access the current DataAdapter from context.
 * Throws an error if used outside of the provider.
 */
export function useDataAdapter(): DataAdapter {
  const adapter = useContext(DataAdapterContext);
  if (!adapter) {
    throw new Error('useDataAdapter must be used within a DataAdapterProvider');
  }
  return adapter;
}

