/**
 * Adapter selection layer.
 * Exports a single dataAdapter instance based on environment configuration.
 * Defaults to localStorageAdapter to maintain existing behavior.
 */

import { LocalStorageAdapter } from './localStorageAdapter';
import { ApiAdapter } from './apiAdapter';

/**
 * Select adapter based on environment flag.
 * VITE_USE_API=true uses API adapter, otherwise uses localStorage (default).
 */
export const dataAdapter =
  import.meta.env.VITE_USE_API === 'true'
    ? new ApiAdapter()
    : new LocalStorageAdapter();


