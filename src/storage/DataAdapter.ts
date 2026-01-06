/**
 * Storage abstraction interface for care notebook data operations.
 * This interface defines all data operations currently happening in Today.tsx.
 * Implementations can use localStorage, API, or any other persistence mechanism.
 */

import type { CareNote, Task, TodayState, NotesByDate } from '../domain/types';

export interface DataAdapter {
  /**
   * Load today's complete state (notes, tasks, current caregiver, last updated by)
   */
  loadToday(): Promise<TodayState>;

  /**
   * Add a new care note
   * @param noteText The text content of the note
   * @returns The created note with time and author populated
   */
  addNote(noteText: string): Promise<CareNote>;

  /**
   * Toggle task completion status
   * @param taskId The ID of the task to toggle
   * @param completed The new completion status
   */
  toggleTask(taskId: string, completed: boolean): Promise<void>;

  /**
   * Perform a handoff from current caregiver to another
   * @param toCaregiverName The name of the caregiver receiving the handoff
   */
  handoff(toCaregiverName: string): Promise<void>;

  /**
   * Get all notes organized by date key (for history display)
   * @returns Notes organized by date key (YYYY-MM-DD format)
   */
  getNotesByDate(): Promise<NotesByDate>;

  /**
   * Check if a care notebook already exists
   * @returns true if notebook has any data (notes, caregiver state, or tasks)
   */
  notebookExists(): Promise<boolean>;
}

