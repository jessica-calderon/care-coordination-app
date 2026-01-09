/**
 * Notebook ID utilities.
 * Handles generation, resolution, and persistence of notebook IDs.
 */

const STORAGE_KEY_NOTEBOOK_ID = 'care-app-notebook-id';

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
function updateUrlWithNotebookId(notebookId: string): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.set('notebook', notebookId);
  
  // Use replaceState to update URL without reloading or adding to history
  window.history.replaceState({}, '', url.toString());
}

/**
 * Resolve notebook ID from URL parameter, localStorage, or generate a new one.
 * Priority:
 * 1. URL parameter ?notebook=<id>
 * 2. localStorage value
 * 3. Generate new ID
 * 
 * The resolved ID is persisted to localStorage and the URL is updated to show it.
 * @returns The resolved notebook ID
 */
export function resolveNotebookId(): string {
  // Check URL parameter first
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlNotebookId = params.get('notebook');
    if (urlNotebookId && urlNotebookId.trim().length > 0) {
      const trimmedId = urlNotebookId.trim();
      // Persist URL notebook ID to localStorage
      localStorage.setItem(STORAGE_KEY_NOTEBOOK_ID, trimmedId);
      return trimmedId;
    }
  }

  // Check localStorage
  if (typeof window !== 'undefined') {
    const storedNotebookId = localStorage.getItem(STORAGE_KEY_NOTEBOOK_ID);
    if (storedNotebookId && storedNotebookId.trim().length > 0) {
      const trimmedId = storedNotebookId.trim();
      // Update URL to show the notebook ID from localStorage
      updateUrlWithNotebookId(trimmedId);
      return trimmedId;
    }
  }

  // Generate new ID and persist it
  const newNotebookId = generateNotebookId();
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_NOTEBOOK_ID, newNotebookId);
    // Update URL to show the new notebook ID
    updateUrlWithNotebookId(newNotebookId);
  }
  return newNotebookId;
}

