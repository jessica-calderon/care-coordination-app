/**
 * Firebase/Firestore implementation of DataAdapter.
 * 
 * This adapter is prepared for Firebase persistence but currently stubs all methods
 * to return reasonable defaults. No Firestore reads or writes are performed yet.
 * 
 * This allows the adapter to be instantiated and integrated without changing
 * existing behavior, preparing for future Firebase implementation.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate, Caretaker } from '../domain/types';
import { firestore } from '../firebase/config';
import { todayData } from '../mock/todayData';

export class FirebaseAdapter implements DataAdapter {
  private notebookId: string;

  /**
   * Create a new FirebaseAdapter instance.
   * @param notebookId The unique identifier for the care notebook
   */
  constructor(notebookId: string) {
    this.notebookId = notebookId;
    // Firestore is imported but not used yet
    // This ensures the import is valid and the adapter can be instantiated
    // notebookId is stored for future use when implementing Firestore operations
    void firestore;
    void this.notebookId;
  }

  /**
   * Load today's complete state (notes, tasks, current caregiver, last updated by)
   * Stub: Returns empty state with defaults from mock data
   */
  async loadToday(): Promise<TodayState> {
    // TODO: Implement Firestore read
    return {
      careNotes: [],
      tasks: todayData.tasks,
      currentCaregiver: todayData.currentCaregiver,
      lastUpdatedBy: todayData.lastUpdatedBy,
      caretakers: []
    };
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

