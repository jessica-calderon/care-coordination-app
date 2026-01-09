/**
 * Pure domain functions for care notebook operations.
 * No side effects, no localStorage, no React dependencies.
 * Input → output only.
 */

import type { CareNote, Caretaker } from './types';

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateKey(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Format a Date object to time string (e.g., "8:30 AM")
 */
export function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Format date key (YYYY-MM-DD) to human-readable format
 * Returns "Yesterday", day name (e.g., "Monday"), or formatted date
 */
export function formatDateLabel(dateKey: string): string {
  const date = new Date(dateKey + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Reset time to compare dates only
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  
  if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Yesterday';
  }
  
  // Check if within last 7 days
  const daysDiff = Math.floor((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff >= 2 && daysDiff <= 7) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[date.getDay()];
  }
  
  // Fallback to formatted date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined 
  });
}

/**
 * Create a new care note (pure function, no side effects)
 */
export function createCareNote(noteText: string, author: string): CareNote {
  return {
    time: formatTime(new Date()),
    note: noteText.trim(),
    author: author
  };
}

/**
 * Generate handoff message text
 */
export function generateHandoffMessage(fromCaregiver: string, toCaregiver: string): string {
  return `${fromCaregiver} handed off care to ${toCaregiver}.`;
}

/**
 * Create a system note for handoff (pure function)
 */
export function createHandoffNote(fromCaregiver: string, toCaregiver: string): CareNote {
  return {
    time: formatTime(new Date()),
    note: generateHandoffMessage(fromCaregiver, toCaregiver),
    author: 'System'
  };
}

/**
 * Parse time string (e.g., "8:30 AM") to Date object for today
 * Returns null if parsing fails
 */
function parseTimeString(timeStr: string, dateKey?: string): Date | null {
  try {
    const [timePart, ampm] = timeStr.split(' ');
    const [hours, minutes] = timePart.split(':');
    let hour24 = parseInt(hours, 10);
    if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
    if (ampm === 'AM' && hour24 === 12) hour24 = 0;
    
    const baseDate = dateKey ? new Date(dateKey + 'T00:00:00') : new Date();
    baseDate.setHours(hour24, parseInt(minutes, 10), 0, 0);
    return baseDate;
  } catch {
    return null;
  }
}

/**
 * Check if a note can be edited by the current caregiver
 * Returns true only if:
 * - Note author matches current caregiver
 * - Note is not a system note
 * - Note was created within the last 15 minutes
 */
export function canEditNote(note: CareNote, currentCaregiver: string, now: Date): boolean {
  // System notes cannot be edited
  if (note.author === 'System') {
    return false;
  }
  
  // Only author can edit
  if (note.author !== currentCaregiver) {
    return false;
  }
  
  // Parse the note's creation time
  const noteDate = parseTimeString(note.time);
  if (!noteDate) {
    return false;
  }
  
  // Check if note was created within 15 minutes
  const diffMs = now.getTime() - noteDate.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  
  return diffMinutes <= 15;
}

/**
 * Update an existing care note (pure function)
 * Preserves original time and author, updates note text and editedAt
 */
export function updateCareNote(note: CareNote, newNoteText: string): CareNote {
  return {
    ...note,
    note: newNoteText.trim(),
    editedAt: new Date().toISOString()
  };
}

/**
 * Generate a temporary ID for optimistic updates
 * Real IDs will come from the adapter when persisted
 */
function generateTempId(): string {
  // Use timestamp + random for uniqueness in optimistic updates
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a caretaker to the list (pure function)
 * Returns a new array with the caretaker added if not already present
 * New caretakers are added as active and non-primary
 * Generates a temporary ID for optimistic updates (real ID comes from adapter)
 */
export function addCaretaker(caretakers: Caretaker[], name: string): Caretaker[] {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return caretakers;
  }
  // Check if already exists (case-insensitive)
  const exists = caretakers.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
  if (exists) {
    return caretakers;
  }
  // If this is the first caretaker, make them primary
  const isFirst = caretakers.length === 0;
  return [...caretakers, { 
    id: generateTempId(), // Temporary ID for optimistic updates
    name: trimmedName, 
    isPrimary: isFirst, 
    isActive: true 
  }];
}

/**
 * Set a caretaker as primary (pure function)
 * Enforces invariants:
 * - Only one primary contact at a time
 * - Primary contact must be active
 * Returns new array with updated primary status
 */
export function setPrimaryCaretaker(caretakers: Caretaker[], name: string): { caretakers: Caretaker[]; canSetPrimary: boolean; reason?: string } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { caretakers, canSetPrimary: false, reason: 'Invalid name' };
  }
  
  // Find the caretaker
  const caretakerIndex = caretakers.findIndex(c => c.name.toLowerCase() === trimmedName.toLowerCase());
  if (caretakerIndex === -1) {
    return { caretakers, canSetPrimary: false, reason: 'Caretaker not found' };
  }
  
  const caretaker = caretakers[caretakerIndex];
  
  // Guard: primary contact must be active
  if (!caretaker.isActive) {
    return { caretakers, canSetPrimary: false, reason: 'Cannot set inactive caretaker as primary' };
  }
  
  // If already primary, no-op
  if (caretaker.isPrimary) {
    return { caretakers, canSetPrimary: true };
  }
  
  // Update all caretakers: clear existing primary, set new primary
  const updated = caretakers.map(c => ({
    ...c,
    isPrimary: c.name.toLowerCase() === trimmedName.toLowerCase()
  }));
  
  return { caretakers: updated, canSetPrimary: true };
}

/**
 * Archive a caretaker (pure function)
 * Enforces invariants:
 * - Cannot archive primary contact
 * - Cannot archive current caregiver
 * Returns new array with caretaker marked as inactive
 */
export function archiveCaretaker(caretakers: Caretaker[], name: string, currentCaregiver: string): { caretakers: Caretaker[]; canArchive: boolean; reason?: string } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { caretakers, canArchive: false, reason: 'Invalid name' };
  }
  
  // Find the caretaker
  const caretakerIndex = caretakers.findIndex(c => c.name.toLowerCase() === trimmedName.toLowerCase());
  if (caretakerIndex === -1) {
    return { caretakers, canArchive: false, reason: 'Caretaker not found' };
  }
  
  const caretaker = caretakers[caretakerIndex];
  
  // Guard: cannot archive primary contact
  if (caretaker.isPrimary) {
    return { caretakers, canArchive: false, reason: 'Cannot archive primary contact' };
  }
  
  // Guard: cannot archive current caregiver
  if (trimmedName.toLowerCase() === currentCaregiver.toLowerCase()) {
    return { caretakers, canArchive: false, reason: 'Cannot archive current caregiver' };
  }
  
  // If already archived, no-op
  if (!caretaker.isActive) {
    return { caretakers, canArchive: true };
  }
  
  // Mark as inactive
  const updated = caretakers.map(c => 
    c.name.toLowerCase() === trimmedName.toLowerCase()
      ? { ...c, isActive: false }
      : c
  );
  
  return { caretakers: updated, canArchive: true };
}

/**
 * Restore an archived caretaker (pure function)
 * Returns new array with caretaker marked as active
 */
export function restoreCaretaker(caretakers: Caretaker[], name: string): { caretakers: Caretaker[]; canRestore: boolean; reason?: string } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { caretakers, canRestore: false, reason: 'Invalid name' };
  }
  
  // Find the caretaker
  const caretakerIndex = caretakers.findIndex(c => c.name.toLowerCase() === trimmedName.toLowerCase());
  if (caretakerIndex === -1) {
    return { caretakers, canRestore: false, reason: 'Caretaker not found' };
  }
  
  const caretaker = caretakers[caretakerIndex];
  
  // If already active, no-op
  if (caretaker.isActive) {
    return { caretakers, canRestore: true };
  }
  
  // Mark as active
  const updated = caretakers.map(c => 
    c.name.toLowerCase() === trimmedName.toLowerCase()
      ? { ...c, isActive: true }
      : c
  );
  
  return { caretakers: updated, canRestore: true };
}

/**
 * Create a system note for caretaker added (pure function)
 */
export function createCaretakerAddedNote(name: string): CareNote {
  return {
    time: formatTime(new Date()),
    note: `${name} was added as a caretaker.`,
    author: 'System'
  };
}

/**
 * Create a system note for caretaker archived (pure function)
 */
export function createCaretakerArchivedNote(name: string): CareNote {
  return {
    time: formatTime(new Date()),
    note: `${name} was archived as a caretaker.`,
    author: 'System'
  };
}

/**
 * Create a system note for caretaker restored (pure function)
 */
export function createCaretakerRestoredNote(name: string): CareNote {
  return {
    time: formatTime(new Date()),
    note: `${name} was restored as a caretaker.`,
    author: 'System'
  };
}

/**
 * Create a system note for primary contact changed (pure function)
 */
export function createPrimaryContactChangedNote(name: string): CareNote {
  return {
    time: formatTime(new Date()),
    note: `${name} was set as the primary contact.`,
    author: 'System'
  };
}


