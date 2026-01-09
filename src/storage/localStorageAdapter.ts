/**
 * localStorage implementation of DataAdapter.
 * Moves all localStorage logic from Today.tsx into this adapter.
 * Behavior must remain identical to the original implementation.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate, Caretaker } from '../domain/types';
import { getTodayDateKey, createCareNote, createHandoffNote, updateCareNote, addCaretaker as addCaretakerDomain, archiveCaretaker as archiveCaretakerDomain, restoreCaretaker as restoreCaretakerDomain, setPrimaryCaretaker as setPrimaryCaretakerDomain, createCaretakerAddedNote, createCaretakerArchivedNote, createCaretakerRestoredNote, createPrimaryContactChangedNote } from '../domain/notebook';
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
 * Migrates old string[] format to Caretaker[] format
 */
function loadCaretakers(): Caretaker[] {
  const saved = localStorage.getItem(STORAGE_KEY_CARETAKERS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        // Check if it's old format (string[]) or new format (Caretaker[])
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          // Migrate old format: convert string[] to Caretaker[]
          // First caretaker becomes primary, all are active
          const migrated: Caretaker[] = parsed.map((name: string, index: number) => ({
            name,
            isPrimary: index === 0,
            isActive: true
          }));
          // Save migrated format
          saveCaretakers(migrated);
          return migrated;
        } else {
          // New format: validate and ensure at least one primary
          const caretakers: Caretaker[] = parsed;
          const hasPrimary = caretakers.some(c => c.isPrimary);
          if (!hasPrimary && caretakers.length > 0) {
            // If no primary, set first active caretaker as primary
            const firstActive = caretakers.find(c => c.isActive);
            if (firstActive) {
              const updated = caretakers.map(c => ({
                ...c,
                isPrimary: c.name === firstActive.name
              }));
              saveCaretakers(updated);
              return updated;
            }
          }
          return caretakers;
        }
      }
    } catch (e) {
      // If parsing fails, return defaults
    }
  }
  // Default caretakers: initialize with current caregiver if it exists
  const currentCaregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER) || todayData.currentCaregiver;
  // Initialize with current caregiver and the other default (Lupe or Maria)
  // Ensure current caregiver is primary, and include the other default if different
  const defaultCaretakers: Caretaker[] = [
    { name: currentCaregiver, isPrimary: true, isActive: true }
  ];
  if (currentCaregiver === 'Lupe') {
    defaultCaretakers.push({ name: 'Maria', isPrimary: false, isActive: true });
  } else if (currentCaregiver === 'Maria') {
    defaultCaretakers.push({ name: 'Lupe', isPrimary: false, isActive: true });
  } else {
    // If current caregiver is neither default, include both defaults
    defaultCaretakers.push(
      { name: 'Lupe', isPrimary: false, isActive: true },
      { name: 'Maria', isPrimary: false, isActive: true }
    );
  }
  // Save defaults to localStorage so they persist and show up immediately
  saveCaretakers(defaultCaretakers);
  return defaultCaretakers;
}

/**
 * Save caretakers to localStorage
 */
function saveCaretakers(caretakers: Caretaker[]): void {
  localStorage.setItem(STORAGE_KEY_CARETAKERS, JSON.stringify(caretakers));
}

export class LocalStorageAdapter implements DataAdapter {
  /**
   * Create a new LocalStorageAdapter instance.
   * @param notebookId The unique identifier for the care notebook (currently unused, reserved for future use)
   */
  constructor(_notebookId: string) {
    // notebookId is reserved for future use but not currently needed for localStorage operations
  }

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
    
    // Ensure current caregiver is always in the list and active
    const currentCaretakerIndex = caretakers.findIndex(c => c.name.toLowerCase() === currentCaregiver.toLowerCase());
    if (currentCaretakerIndex === -1) {
      // Add current caregiver as active, and make them primary if no primary exists
      const hasPrimary = caretakers.some(c => c.isPrimary);
      caretakers = [
        { name: currentCaregiver, isPrimary: !hasPrimary, isActive: true },
        ...caretakers
      ];
      saveCaretakers(caretakers);
    } else {
      // Ensure current caregiver is always active
      const currentCaretaker = caretakers[currentCaretakerIndex];
      if (!currentCaretaker.isActive) {
        caretakers = caretakers.map(c => 
          c.name.toLowerCase() === currentCaregiver.toLowerCase()
            ? { ...c, isActive: true }
            : c
        );
        saveCaretakers(caretakers);
      }
    }
    
    // Ensure exactly one primary contact
    const primaryCount = caretakers.filter(c => c.isPrimary).length;
    if (primaryCount === 0 && caretakers.length > 0) {
      // Set first active caretaker as primary (prefer current caregiver)
      const currentCaretaker = caretakers.find(c => c.name.toLowerCase() === currentCaregiver.toLowerCase() && c.isActive);
      const firstActive = currentCaretaker || caretakers.find(c => c.isActive);
      if (firstActive) {
        caretakers = caretakers.map(c => ({
          ...c,
          isPrimary: c.name === firstActive.name
        }));
        saveCaretakers(caretakers);
      }
    } else if (primaryCount > 1) {
      // Multiple primaries: keep first, clear others
      let foundFirst = false;
      caretakers = caretakers.map(c => {
        if (c.isPrimary && !foundFirst) {
          foundFirst = true;
          return c;
        }
        return { ...c, isPrimary: false };
      });
      saveCaretakers(caretakers);
    }
    
    // Final safety check: ensure at least one active caretaker exists
    const activeCount = caretakers.filter(c => c.isActive).length;
    if (activeCount === 0 && caretakers.length > 0) {
      // If no active caretakers, activate the current caregiver
      caretakers = caretakers.map(c => 
        c.name.toLowerCase() === currentCaregiver.toLowerCase()
          ? { ...c, isActive: true, isPrimary: true }
          : c
      );
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
   * Archive a caretaker (mark as inactive)
   */
  async archiveCaretaker(name: string): Promise<void> {
    const todayKey = getTodayDateKey();
    const currentCaregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER) || todayData.currentCaregiver;
    
    // Load current caretakers
    const currentCaretakers = loadCaretakers();
    
    // Archive caretaker using domain function (includes guards)
    const { caretakers: updatedCaretakers, canArchive, reason } = archiveCaretakerDomain(currentCaretakers, name, currentCaregiver);
    
    // Guard: check if archiving is allowed
    if (!canArchive) {
      throw new Error(reason || 'Cannot archive this caretaker');
    }
    
    // Save updated caretakers
    saveCaretakers(updatedCaretakers);
    
    // Create system note
    const systemNote = createCaretakerArchivedNote(name);
    
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
   * Restore an archived caretaker (mark as active)
   */
  async restoreCaretaker(name: string): Promise<void> {
    const todayKey = getTodayDateKey();
    
    // Load current caretakers
    const currentCaretakers = loadCaretakers();
    
    // Restore caretaker using domain function
    const { caretakers: updatedCaretakers, canRestore, reason } = restoreCaretakerDomain(currentCaretakers, name);
    
    // Guard: check if restore is allowed
    if (!canRestore) {
      throw new Error(reason || 'Cannot restore this caretaker');
    }
    
    // Save updated caretakers
    saveCaretakers(updatedCaretakers);
    
    // Create system note
    const systemNote = createCaretakerRestoredNote(name);
    
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
   * Set a caretaker as the primary contact
   */
  async setPrimaryCaretaker(name: string): Promise<void> {
    const todayKey = getTodayDateKey();
    
    // Load current caretakers
    const currentCaretakers = loadCaretakers();
    
    // Set primary using domain function (includes guards)
    const { caretakers: updatedCaretakers, canSetPrimary, reason } = setPrimaryCaretakerDomain(currentCaretakers, name);
    
    // Guard: check if setting primary is allowed
    if (!canSetPrimary) {
      throw new Error(reason || 'Cannot set this caretaker as primary');
    }
    
    // Save updated caretakers
    saveCaretakers(updatedCaretakers);
    
    // Create system note
    const systemNote = createPrimaryContactChangedNote(name);
    
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
  async getCaretakers(): Promise<Caretaker[]> {
    return loadCaretakers();
  }
}

