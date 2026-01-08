/**
 * localStorage implementation of DataAdapter.
 * Moves all localStorage logic from Today.tsx into this adapter.
 * Behavior must remain identical to the original implementation.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate } from '../domain/types';
import { getTodayDateKey, createCareNote, createHandoffNote, updateCareNote, addCaretaker as addCaretakerDomain, removeCaretaker as removeCaretakerDomain, createCaretakerAddedNote, createCaretakerRemovedNote } from '../domain/notebook';
import { todayData } from '../mock/todayData';

const STORAGE_KEY_NOTES_BY_DATE = 'care-app-notes-by-date';
const STORAGE_KEY_LAST_DATE = 'care-app-last-date';
const STORAGE_KEY_CURRENT_CAREGIVER = 'care-app-current-caregiver';
const STORAGE_KEY_LAST_UPDATED_BY = 'care-app-last-updated-by';
const STORAGE_KEY_CARETAKERS = 'care-app-caretakers';

/**
 * Migrate old data format if it exists
 */
function migrateOldData(): NotesByDate {
  const oldKey = 'care-app-care-notes';
  const oldData = localStorage.getItem(oldKey);
  if (oldData) {
    try {
      const oldNotes: CareNote[] = JSON.parse(oldData);
      if (Array.isArray(oldNotes) && oldNotes.length > 0) {
        // Move old notes to today's date and add authors if missing
        const todayKey = getTodayDateKey();
        const migratedNotes = oldNotes.map(note => ({
          ...note,
          author: note.author || 'Lupe'
        }));
        const migrated: NotesByDate = { [todayKey]: migratedNotes };
        localStorage.setItem(STORAGE_KEY_NOTES_BY_DATE, JSON.stringify(migrated));
        localStorage.removeItem(oldKey);
        return migrated;
      }
    } catch (e) {
      // If parsing fails, ignore old data
    }
  }
  return {};
}

/**
 * Load notes by date from localStorage
 */
function loadNotesByDate(): NotesByDate {
  const saved = localStorage.getItem(STORAGE_KEY_NOTES_BY_DATE);
  if (saved) {
    try {
      const notesByDate: NotesByDate = JSON.parse(saved);
      // Migrate any notes without authors
      const migrated: NotesByDate = {};
      for (const [dateKey, notes] of Object.entries(notesByDate)) {
        migrated[dateKey] = notes.map(note => ({
          ...note,
          author: note.author || 'Lupe'
        }));
      }
      return migrated;
    } catch (e) {
      return {};
    }
  }
  // Try to migrate old data
  return migrateOldData();
}

/**
 * Check if date has changed and preserve history
 */
function checkDateChange(notesByDate: NotesByDate): NotesByDate {
  const todayKey = getTodayDateKey();
  const lastDateKey = localStorage.getItem(STORAGE_KEY_LAST_DATE);
  
  // If date changed and we have notes from previous date, preserve them
  if (lastDateKey && lastDateKey !== todayKey && notesByDate[lastDateKey]) {
    // Notes are already preserved, just update the last date
    localStorage.setItem(STORAGE_KEY_LAST_DATE, todayKey);
    return notesByDate;
  }
  
  // First time or same date
  if (!lastDateKey || lastDateKey !== todayKey) {
    localStorage.setItem(STORAGE_KEY_LAST_DATE, todayKey);
  }
  
  return notesByDate;
}

/**
 * Save notes by date to localStorage
 */
function saveNotesByDate(notesByDate: NotesByDate): void {
  localStorage.setItem(STORAGE_KEY_NOTES_BY_DATE, JSON.stringify(notesByDate));
}

/**
 * Load caretakers from localStorage
 * Returns default caretakers if none exist
 */
function loadCaretakers(): string[] {
  const saved = localStorage.getItem(STORAGE_KEY_CARETAKERS);
  if (saved) {
    try {
      const caretakers: string[] = JSON.parse(saved);
      if (Array.isArray(caretakers)) {
        return caretakers;
      }
    } catch (e) {
      // If parsing fails, return defaults
    }
  }
  // Default caretakers: initialize with current caregiver if it exists
  const currentCaregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER) || todayData.currentCaregiver;
  // Initialize with current caregiver and the other default (Lupe or Maria)
  // Ensure current caregiver is always first, and include the other default if different
  const defaultCaretakers = [currentCaregiver];
  if (currentCaregiver === 'Lupe') {
    defaultCaretakers.push('Maria');
  } else if (currentCaregiver === 'Maria') {
    defaultCaretakers.push('Lupe');
  } else {
    // If current caregiver is neither default, include both defaults
    defaultCaretakers.push('Lupe', 'Maria');
  }
  return defaultCaretakers;
}

/**
 * Save caretakers to localStorage
 */
function saveCaretakers(caretakers: string[]): void {
  localStorage.setItem(STORAGE_KEY_CARETAKERS, JSON.stringify(caretakers));
}

export class LocalStorageAdapter implements DataAdapter {
  /**
   * Load today's complete state
   */
  async loadToday(): Promise<TodayState> {
    const notesByDate = loadNotesByDate();
    const checkedNotesByDate = checkDateChange(notesByDate);
    const todayKey = getTodayDateKey();
    
    // Get today's notes, with fallback to mock data
    const notes = checkedNotesByDate[todayKey] || todayData.careNotes;
    // Migrate old notes without authors
    const careNotes = notes.map(note => ({
      ...note,
      author: note.author || 'Lupe'
    }));
    
    // Get current caregiver and last updated by from localStorage, with fallbacks
    const currentCaregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER) || todayData.currentCaregiver;
    const lastUpdatedBy = localStorage.getItem(STORAGE_KEY_LAST_UPDATED_BY) || todayData.lastUpdatedBy;
    
    // Load caretakers
    let caretakers = loadCaretakers();
    
    // Ensure current caregiver is always in the list
    const currentInList = caretakers.some(c => c.toLowerCase() === currentCaregiver.toLowerCase());
    if (!currentInList) {
      caretakers = [currentCaregiver, ...caretakers];
      saveCaretakers(caretakers);
    }
    
    // Tasks are currently mock data (not persisted)
    const tasks = todayData.tasks;
    
    return {
      careNotes,
      tasks,
      currentCaregiver,
      lastUpdatedBy,
      caretakers
    };
  }

  /**
   * Add a new care note
   */
  async addNote(noteText: string): Promise<CareNote> {
    const todayKey = getTodayDateKey();
    const currentCaregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER) || todayData.currentCaregiver;
    
    // Create the note using domain function
    const newNote = createCareNote(noteText, currentCaregiver);
    
    // Load current notes
    const notesByDate = loadNotesByDate();
    const todayNotes = notesByDate[todayKey] || [];
    
    // Add new note at the beginning
    const updatedNotes = [newNote, ...todayNotes];
    const updatedNotesByDate = { ...notesByDate, [todayKey]: updatedNotes };
    
    // Save to localStorage
    saveNotesByDate(updatedNotesByDate);
    
    return newNote;
  }

  /**
   * Update an existing care note
   */
  async updateNote(noteIndex: number, newNoteText: string): Promise<CareNote> {
    const todayKey = getTodayDateKey();
    
    // Load current notes
    const notesByDate = loadNotesByDate();
    const todayNotes = notesByDate[todayKey] || [];
    
    // Validate index
    if (noteIndex < 0 || noteIndex >= todayNotes.length) {
      throw new Error('Invalid note index');
    }
    
    // Update the note using domain function
    const updatedNote = updateCareNote(todayNotes[noteIndex], newNoteText);
    
    // Create updated notes array
    const updatedNotes = [...todayNotes];
    updatedNotes[noteIndex] = updatedNote;
    const updatedNotesByDate = { ...notesByDate, [todayKey]: updatedNotes };
    
    // Save to localStorage
    saveNotesByDate(updatedNotesByDate);
    
    return updatedNote;
  }

  /**
   * Toggle task completion status
   * Note: Tasks are currently mock data and not persisted, so this is a no-op
   * but included for interface completeness.
   */
  async toggleTask(_taskId: string, _completed: boolean): Promise<void> {
    // Tasks are not currently persisted in localStorage
    // This is a no-op for now, but the interface is ready for future implementation
  }

  /**
   * Perform a handoff from current caregiver to another
   */
  async handoff(toCaregiverName: string): Promise<void> {
    const todayKey = getTodayDateKey();
    const currentCaregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER) || todayData.currentCaregiver;
    
    // Create handoff note using domain function
    const handoffNote = createHandoffNote(currentCaregiver, toCaregiverName);
    
    // Load current notes
    const notesByDate = loadNotesByDate();
    const todayNotes = notesByDate[todayKey] || [];
    
    // Add handoff note at the beginning
    const updatedNotes = [handoffNote, ...todayNotes];
    const updatedNotesByDate = { ...notesByDate, [todayKey]: updatedNotes };
    
    // Save notes
    saveNotesByDate(updatedNotesByDate);
    
    // Update current caregiver and last updated by
    localStorage.setItem(STORAGE_KEY_CURRENT_CAREGIVER, toCaregiverName);
    localStorage.setItem(STORAGE_KEY_LAST_UPDATED_BY, currentCaregiver);
  }

  /**
   * Get all notes organized by date key (for history display)
   */
  async getNotesByDate(): Promise<NotesByDate> {
    const notesByDate = loadNotesByDate();
    return checkDateChange(notesByDate);
  }

  /**
   * Check if a care notebook already exists
   */
  async notebookExists(): Promise<boolean> {
    // Check for saved care notes
    const notesData = localStorage.getItem(STORAGE_KEY_NOTES_BY_DATE);
    if (notesData) {
      try {
        const notesByDate: NotesByDate = JSON.parse(notesData);
        // Check if there are any notes in any date
        if (notesByDate && typeof notesByDate === 'object') {
          const hasNotes = Object.values(notesByDate).some(
            (notes: unknown) => Array.isArray(notes) && notes.length > 0
          );
          if (hasNotes) return true;
        }
      } catch (e) {
        // If parsing fails, continue checking other indicators
      }
    }

    // Check for saved caregiver state
    const caregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER);
    const lastUpdatedBy = localStorage.getItem(STORAGE_KEY_LAST_UPDATED_BY);
    if (caregiver || lastUpdatedBy) {
      return true;
    }

    // Check for saved task state (though tasks are currently not persisted)
    const tasks = localStorage.getItem('care-app-tasks');
    if (tasks) {
      try {
        const tasksData = JSON.parse(tasks);
        if (Array.isArray(tasksData) && tasksData.length > 0) {
          return true;
        }
      } catch (e) {
        // If parsing fails, continue
      }
    }

    return false;
  }

  /**
   * Add a new caretaker to the notebook
   */
  async addCaretaker(name: string): Promise<void> {
    const todayKey = getTodayDateKey();
    
    // Load current caretakers
    const currentCaretakers = loadCaretakers();
    
    // Add caretaker using domain function
    const updatedCaretakers = addCaretakerDomain(currentCaretakers, name);
    
    // Only proceed if caretaker was actually added
    if (updatedCaretakers.length === currentCaretakers.length) {
      return; // Already exists, no-op
    }
    
    // Save updated caretakers
    saveCaretakers(updatedCaretakers);
    
    // Create system note
    const systemNote = createCaretakerAddedNote(name);
    
    // Load current notes
    const notesByDate = loadNotesByDate();
    const todayNotes = notesByDate[todayKey] || [];
    
    // Add system note at the beginning
    const updatedNotes = [systemNote, ...todayNotes];
    const updatedNotesByDate = { ...notesByDate, [todayKey]: updatedNotes };
    
    // Save notes
    saveNotesByDate(updatedNotesByDate);
  }

  /**
   * Remove a caretaker from the notebook
   */
  async removeCaretaker(name: string): Promise<void> {
    const todayKey = getTodayDateKey();
    const currentCaregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER) || todayData.currentCaregiver;
    
    // Load current caretakers
    const currentCaretakers = loadCaretakers();
    
    // Remove caretaker using domain function (includes guard)
    const { caretakers: updatedCaretakers, canRemove } = removeCaretakerDomain(currentCaretakers, name, currentCaregiver);
    
    // Guard: cannot remove current caregiver
    if (!canRemove) {
      throw new Error('Cannot remove the current caregiver');
    }
    
    // Save updated caretakers
    saveCaretakers(updatedCaretakers);
    
    // Create system note
    const systemNote = createCaretakerRemovedNote(name);
    
    // Load current notes
    const notesByDate = loadNotesByDate();
    const todayNotes = notesByDate[todayKey] || [];
    
    // Add system note at the beginning
    const updatedNotes = [systemNote, ...todayNotes];
    const updatedNotesByDate = { ...notesByDate, [todayKey]: updatedNotes };
    
    // Save notes
    saveNotesByDate(updatedNotesByDate);
  }

  /**
   * Get the list of all caretakers
   */
  async getCaretakers(): Promise<string[]> {
    return loadCaretakers();
  }
}

