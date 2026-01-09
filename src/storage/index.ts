/**
 * Adapter selection layer.
 * Exports a single dataAdapter instance based on environment configuration.
 * Defaults to localStorageAdapter to maintain existing behavior.
 */

import { LocalStorageAdapter } from './localStorageAdapter';
import { ApiAdapter } from './apiAdapter';
import { FirebaseAdapter } from './FirebaseAdapter';

/**
 * Select adapter based on environment flag.
 * VITE_USE_API=true uses API adapter, otherwise uses localStorage (default).
 * 
 * FirebaseAdapter is available and can be instantiated when a notebookId is present,
 * but localStorage remains the authoritative source until explicitly switched.
 * 
 * To switch to FirebaseAdapter in the future:
 * - Extract notebookId from URL params or environment
 * - Replace LocalStorageAdapter with: new FirebaseAdapter(notebookId)
 */
export const dataAdapter =
  import.meta.env.VITE_USE_API === 'true'
    ? new ApiAdapter()
    : new LocalStorageAdapter();

/**
 * Helper function to create a FirebaseAdapter instance when notebookId is available.
 * This allows FirebaseAdapter to be instantiated without changing the default behavior.
 * 
 * @param notebookId The unique identifier for the care notebook
 * @returns A new FirebaseAdapter instance (currently stubbed, not used by default)
 */
export function createFirebaseAdapter(notebookId: string): FirebaseAdapter {
  return new FirebaseAdapter(notebookId);
}

/**
 * Export FirebaseAdapter class for direct instantiation if needed.
 */
export { FirebaseAdapter };




