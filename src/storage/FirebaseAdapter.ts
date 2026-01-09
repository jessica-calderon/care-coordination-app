/**
 * Firebase/Firestore implementation of DataAdapter.
 * 
 * This adapter reads from Firestore when data is available, and returns null
 * when no data exists (allowing fallback to localStorage).
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate, Caretaker } from '../domain/types';
import { firestore } from '../firebase/config';
import { getTodayDateKey } from '../domain/notebook';
import { doc, getDoc } from 'firebase/firestore';
import { todayData } from '../mock/todayData';

export class FirebaseAdapter implements DataAdapter {
  private notebookId: string;

  /**
   * Create a new FirebaseAdapter instance.
   * @param notebookId The unique identifier for the care notebook
   */
  constructor(notebookId: string) {
    this.notebookId = notebookId;
  }

  /**
   * Load today's complete state (notes, tasks, current caregiver, last updated by)
   * Attempts to read from Firestore at /notebooks/{notebookId}/today/{dateKey}
   * Returns null if document does not exist (allowing fallback to localStorage)
   * 
   * This method can return null for fallback scenarios.
   * Use HybridAdapter for automatic fallback behavior.
   */
  async loadTodayInternal(): Promise<TodayState | null> {
    try {
      const dateKey = getTodayDateKey();
      const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // Document does not exist - return null to allow fallback
        return null;
      }
      
      const data = docSnap.data();
      
      // Parse and return TodayState from Firestore document
      // Document structure matches TodayState interface
      return {
        careNotes: data.careNotes || [],
        tasks: data.tasks || [],
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || '',
        caretakers: data.caretakers || []
      };
    } catch (error) {
      // On any error, return null to allow fallback to localStorage
      // This ensures the app continues to work even if Firestore is unavailable
      if (import.meta.env.DEV) {
        console.warn('Firestore read error, falling back to localStorage:', error);
      }
      return null;
    }
  }

  /**
   * Load today's complete state (notes, tasks, current caregiver, last updated by)
   * Implements DataAdapter interface - delegates to loadTodayInternal() but throws
   * if null is returned (should not happen when used through HybridAdapter)
   */
  async loadToday(): Promise<TodayState> {
    const result = await this.loadTodayInternal();
    if (result === null) {
      // This should not happen when used through HybridAdapter
      // But we need to satisfy the interface
      throw new Error('No data found in Firestore');
    }
    return result;
  }

  /**
   * Add a new care note
   * Stub: Returns a note with current timestamp but doesn't persist
   */
  async addNote(noteText: string): Promise<CareNote> {
    // TODO: Implement Firestore write
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    return {
      time,
      note: noteText,
      author: todayData.currentCaregiver
    };
  }

  /**
   * Update an existing care note
   * Stub: Returns updated note structure but doesn't persist
   */
  async updateNote(_noteIndex: number, newNoteText: string): Promise<CareNote> {
    // TODO: Implement Firestore update
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    return {
      time,
      note: newNoteText,
      author: todayData.currentCaregiver,
      editedAt: now.toISOString()
    };
  }

  /**
   * Toggle task completion status
   * Stub: No-op
   */
  async toggleTask(_taskId: string, _completed: boolean): Promise<void> {
    // TODO: Implement Firestore update
  }

  /**
   * Perform a handoff from current caregiver to another
   * Stub: No-op
   */
  async handoff(_toCaregiverName: string): Promise<void> {
    // TODO: Implement Firestore update
  }

  /**
   * Get all notes organized by date key (for history display)
   * Stub: Returns empty object
   */
  async getNotesByDate(): Promise<NotesByDate> {
    // TODO: Implement Firestore read
    return {};
  }

  /**
   * Check if a care notebook already exists
   * Stub: Returns false
   */
  async notebookExists(): Promise<boolean> {
    // TODO: Implement Firestore query
    return false;
  }

  /**
   * Add a new caretaker to the notebook
   * Stub: No-op
   */
  async addCaretaker(_name: string): Promise<void> {
    // TODO: Implement Firestore update
  }

  /**
   * Archive a caretaker (mark as inactive)
   * Stub: No-op
   */
  async archiveCaretaker(_name: string): Promise<void> {
    // TODO: Implement Firestore update
  }

  /**
   * Restore an archived caretaker (mark as active)
   * Stub: No-op
   */
  async restoreCaretaker(_name: string): Promise<void> {
    // TODO: Implement Firestore update
  }

  /**
   * Set a caretaker as the primary contact
   * Stub: No-op
   */
  async setPrimaryCaretaker(_name: string): Promise<void> {
    // TODO: Implement Firestore update
  }

  /**
   * Get the list of all caretakers
   * Stub: Returns empty array
   */
  async getCaretakers(): Promise<Caretaker[]> {
    // TODO: Implement Firestore read
    return [];
  }
}

