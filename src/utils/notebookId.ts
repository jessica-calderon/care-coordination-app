/**
 * Notebook ID utilities.
 * Handles generation, resolution, and persistence of notebook IDs.
 * Supports multiple notebooks with a local index.
 */

import { getLastNotebookId, setLastNotebookId, addNotebookToIndex } from '../domain/notebook';

/**
 * Generate a new opaque notebook ID using crypto.randomUUID().
 * @returns A new UUID v4 string
 */
export function generateNotebookId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (shouldn't happen in modern browsers)
  // Generate a simple UUID-like string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Update the URL to include the notebook ID parameter without page reload.
 * @param notebookId The notebook ID to add to the URL
 */
export function updateUrlWithNotebookId(notebookId: string): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.set('notebook', notebookId);
  
  // Use replaceState to update URL without reloading or adding to history
  window.history.replaceState({}, '', url.toString());
}

/**
 * Resolve notebook ID from URL parameter, last-used notebook, or return null.
 * Priority:
 * 1. URL parameter ?notebook=<id>
 * 2. Last-used notebook ID from localStorage
 * 3. null (no auto-generation)
 * 
 * The resolved ID is persisted as last-used and the URL is updated to show it.
 * @returns The resolved notebook ID, or null if none found
 */
export function resolveNotebookId(): string | null {
  // Check URL parameter first
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlNotebookId = params.get('notebook');
    if (urlNotebookId && urlNotebookId.trim().length > 0) {
      const trimmedId = urlNotebookId.trim();
      // Update last-used and add to index
      setLastNotebookId(trimmedId);
      addNotebookToIndex(trimmedId);
      return trimmedId;
    }
  }

  // Check last-used notebook
  const lastNotebookId = getLastNotebookId();
  if (lastNotebookId) {
    // Update URL to show the last-used notebook ID
    updateUrlWithNotebookId(lastNotebookId);
    return lastNotebookId;
  }

  // No notebook ID found - return null
  // This allows the app to show the landing page for notebook selection
  return null;
}

/**
 * Create a new notebook and add it to the index.
 * Generates a new ID, adds it to the index, sets it as last-used, and updates the URL.
 * @returns The new notebook ID
 */
export function createNewNotebook(): string {
  const newNotebookId = generateNotebookId();
  
  // Add to index
  addNotebookToIndex(newNotebookId);
  
  // Set as last-used
  setLastNotebookId(newNotebookId);
  
  // Update URL
  updateUrlWithNotebookId(newNotebookId);
  
  return newNotebookId;
}

/**
 * Switch to a different notebook.
 * Updates the URL, sets as last-used, and ensures it's in the index.
 * @param notebookId The notebook ID to switch to
 */
export function switchToNotebook(notebookId: string): void {
  // Update URL
  updateUrlWithNotebookId(notebookId);
  
  // Set as last-used
  setLastNotebookId(notebookId);
  
  // Ensure it's in the index
  addNotebookToIndex(notebookId);
}

