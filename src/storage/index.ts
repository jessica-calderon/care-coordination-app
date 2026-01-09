/**
 * Adapter selection layer.
 * Exports a single dataAdapter instance based on environment configuration.
 * Defaults to HybridAdapter (Firebase with localStorage fallback) for cloud storage.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate, Caretaker } from '../domain/types';
import { LocalStorageAdapter } from './localStorageAdapter';
import { ApiAdapter } from './apiAdapter';
import { FirebaseAdapter } from './FirebaseAdapter';
import { resolveNotebookId } from '../utils/notebookId';

/**
 * Hybrid adapter that uses Firebase as the primary storage.
 * This makes Firebase the authoritative source for reads when data exists,
 * while maintaining localStorage as a fallback for offline scenarios.
 */
class HybridAdapter implements DataAdapter {
  private firebaseAdapter: FirebaseAdapter;
  private localStorageAdapter: LocalStorageAdapter;

  constructor(notebookId: string) {
    this.firebaseAdapter = new FirebaseAdapter(notebookId);
    this.localStorageAdapter = new LocalStorageAdapter(notebookId);
  }

  /**
   * Load today's data from Firebase.
   * HybridAdapter is now a thin pass-through to FirebaseAdapter.
   */
  async loadToday(): Promise<TodayState> {
    return this.firebaseAdapter.loadToday();
  }

  /**
   * Add a new care note.
   * Routes to FirebaseAdapter when notebookId exists (which it always does in HybridAdapter).
   * FirebaseAdapter handles writing to Firestore and caching to localStorage.
   */
  async addNote(noteText: string): Promise<CareNote> {
    // Route to FirebaseAdapter - it handles Firestore writes and localStorage caching
    return this.firebaseAdapter.addNote(noteText);
  }

  async updateNote(noteIndex: number, newNoteText: string): Promise<CareNote> {
    return this.localStorageAdapter.updateNote(noteIndex, newNoteText);
  }

  async toggleTask(taskId: string, completed: boolean): Promise<void> {
    return this.localStorageAdapter.toggleTask(taskId, completed);
  }

  async handoff(toCaregiverName: string): Promise<void> {
    return this.localStorageAdapter.handoff(toCaregiverName);
  }

  async getNotesByDate(): Promise<NotesByDate> {
    return this.localStorageAdapter.getNotesByDate();
  }

  async notebookExists(): Promise<boolean> {
    return this.localStorageAdapter.notebookExists();
  }

  async addCaretaker(name: string): Promise<void> {
    // Route to FirebaseAdapter - it handles Firestore writes and localStorage caching
    return this.firebaseAdapter.addCaretaker(name);
  }

  async archiveCaretaker(name: string): Promise<void> {
    // Route to FirebaseAdapter - it handles Firestore writes and localStorage caching
    return this.firebaseAdapter.archiveCaretaker(name);
  }

  async restoreCaretaker(name: string): Promise<void> {
    // Route to FirebaseAdapter - it handles Firestore writes and localStorage caching
    return this.firebaseAdapter.restoreCaretaker(name);
  }

  async setPrimaryCaretaker(name: string): Promise<void> {
    // Route to FirebaseAdapter - it handles Firestore writes and localStorage caching
    return this.firebaseAdapter.setPrimaryCaretaker(name);
  }

  async getCaretakers(): Promise<Caretaker[]> {
    // CARETAKERS CANONICAL LOCATION: /notebooks/{notebookId}/caretakers collection
    // NO FALLBACK to localStorage - Firebase is the single authoritative source
    try {
      const caretakers = await this.firebaseAdapter.getCaretakers();
      return caretakers; // Return empty array if no caretakers exist (no fallback)
    } catch (error) {
      // If Firebase fails, silently return empty array
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore AbortError - request was cancelled
        return [];
      }
      // Return empty array instead of falling back to localStorage
      // This enforces Firebase as the single authoritative source
      return [];
    }
  }
}

/**
 * Create a data adapter for a specific notebook ID.
 * @param notebookId The notebook ID to create an adapter for
 * @returns A DataAdapter instance configured for the given notebook
 */
export function createDataAdapter(notebookId: string): DataAdapter {
  if (import.meta.env.VITE_USE_API === 'true') {
    return new ApiAdapter();
  }
  return new HybridAdapter(notebookId);
}

/**
 * Resolve notebook ID before adapter instantiation.
 * This ensures the notebookId is available at app initialization time.
 * Returns null if no notebook is selected (for landing page).
 */
const notebookId = resolveNotebookId();

/**
 * Default adapter instance for backward compatibility.
 * Uses the resolved notebook ID, or a fallback if none exists.
 * Note: This adapter should be replaced with context-based adapter in App.tsx
 * when multiple notebooks are in use.
 */
export const dataAdapter = notebookId 
  ? createDataAdapter(notebookId)
  : createDataAdapter(''); // Fallback empty ID (will be replaced by App.tsx)

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




