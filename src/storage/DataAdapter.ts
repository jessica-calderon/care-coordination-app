/**
 * Storage abstraction interface for care notebook data operations.
 * This interface defines all data operations currently happening in Today.tsx.
 * Implementations can use localStorage, API, or any other persistence mechanism.
 */

import type { CareNote, TodayState, NotesByDate, Caretaker } from '../domain/types';

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
   * Update an existing care note
   * @param noteIndex The index of the note in today's notes array
   * @param newNoteText The updated text content of the note
   * @returns The updated note
   */
  updateNote(noteIndex: number, newNoteText: string): Promise<CareNote>;

  /**
   * Delete an existing care note
   * @param noteIndex The index of the note in today's notes array
   */
  deleteNote(noteIndex: number): Promise<void>;

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

  /**
   * Add a new caretaker to the notebook
   * @param name The name of the caretaker to add
   */
  addCaretaker(name: string): Promise<void>;

  /**
   * Archive a caretaker (mark as inactive)
   * @param name The name of the caretaker to archive
   * @throws Error if attempting to archive the primary contact or current caregiver
   */
  archiveCaretaker(name: string): Promise<void>;

  /**
   * Restore an archived caretaker (mark as active)
   * @param name The name of the caretaker to restore
   */
  restoreCaretaker(name: string): Promise<void>;

  /**
   * Set a caretaker as the primary contact
   * @param name The name of the caretaker to set as primary
   * @throws Error if attempting to set an inactive caretaker as primary
   */
  setPrimaryCaretaker(name: string): Promise<void>;

  /**
   * Update a caretaker's name
   * @param oldName The current name of the caretaker
   * @param newName The new name for the caretaker
   * @throws Error if caretaker not found or new name is invalid
   */
  updateCaretakerName(oldName: string, newName: string): Promise<void>;

  /**
   * Get the list of all caretakers
   * @returns Array of caretaker objects
   */
  getCaretakers(): Promise<Caretaker[]>;
}

