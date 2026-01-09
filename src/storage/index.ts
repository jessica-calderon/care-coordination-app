/**
 * Adapter selection layer.
 * Exports a single dataAdapter instance based on environment configuration.
 * Defaults to localStorageAdapter to maintain existing behavior.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate, Caretaker } from '../domain/types';
import { LocalStorageAdapter } from './localStorageAdapter';
import { ApiAdapter } from './apiAdapter';
import { FirebaseAdapter } from './FirebaseAdapter';
import { resolveNotebookId } from '../utils/notebookId';

/**
 * Hybrid adapter that tries Firebase first, then falls back to localStorage.
 * This makes Firebase the authoritative source for reads when data exists,
 * while maintaining localStorage as a fallback for local-only users.
 */
class HybridAdapter implements DataAdapter {
  private firebaseAdapter: FirebaseAdapter;
  private localStorageAdapter: LocalStorageAdapter;

  constructor(notebookId: string) {
    this.firebaseAdapter = new FirebaseAdapter(notebookId);
    this.localStorageAdapter = new LocalStorageAdapter(notebookId);
  }

  /**
   * Load today's data from Firebase first, fallback to localStorage if not found.
   */
  async loadToday(): Promise<TodayState> {
    // Try Firebase first
    const firebaseResult = await this.firebaseAdapter.loadTodayInternal();
    if (firebaseResult !== null) {
      // Firebase has data - use it
      return firebaseResult;
    }
    // Firebase has no data - fallback to localStorage
    return this.localStorageAdapter.loadToday();
  }

  /**
   * All write operations delegate to localStorage for now
   * (Firebase writes will be implemented in a future step)
   */
  async addNote(noteText: string): Promise<CareNote> {
    return this.localStorageAdapter.addNote(noteText);
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
    return this.localStorageAdapter.addCaretaker(name);
  }

  async archiveCaretaker(name: string): Promise<void> {
    return this.localStorageAdapter.archiveCaretaker(name);
  }

  async restoreCaretaker(name: string): Promise<void> {
    return this.localStorageAdapter.restoreCaretaker(name);
  }

  async setPrimaryCaretaker(name: string): Promise<void> {
    return this.localStorageAdapter.setPrimaryCaretaker(name);
  }

  async getCaretakers(): Promise<Caretaker[]> {
    return this.localStorageAdapter.getCaretakers();
  }
}

/**
 * Resolve notebook ID before adapter instantiation.
 * This ensures the notebookId is available at app initialization time.
 */
const notebookId = resolveNotebookId();

/**
 * Select adapter based on environment flag.
 * VITE_USE_API=true uses API adapter.
 * Otherwise uses HybridAdapter (Firebase reads with localStorage fallback and writes).
 */
export const dataAdapter =
  import.meta.env.VITE_USE_API === 'true'
    ? new ApiAdapter()
    : new HybridAdapter(notebookId);

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




