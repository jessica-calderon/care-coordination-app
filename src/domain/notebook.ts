/**
 * Pure domain functions for care notebook operations.
 * No side effects, no localStorage, no React dependencies.
 * Input → output only.
 */

import type { CareNote } from './types';

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
 * Add a caretaker to the list (pure function)
 * Returns a new array with the caretaker added if not already present
 */
export function addCaretaker(caretakers: string[], name: string): string[] {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return caretakers;
  }
  // Check if already exists (case-insensitive)
  const exists = caretakers.some(c => c.toLowerCase() === trimmedName.toLowerCase());
  if (exists) {
    return caretakers;
  }
  return [...caretakers, trimmedName];
}

/**
 * Remove a caretaker from the list (pure function)
 * Guards against removing the current caretaker
 * Returns the original array if guard fails, otherwise returns new array without the caretaker
 */
export function removeCaretaker(caretakers: string[], name: string, currentCaretaker: string): { caretakers: string[]; canRemove: boolean } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { caretakers, canRemove: false };
  }
  // Guard: cannot remove current caretaker
  if (trimmedName.toLowerCase() === currentCaretaker.toLowerCase()) {
    return { caretakers, canRemove: false };
  }
  // Remove the caretaker (case-insensitive)
  const updated = caretakers.filter(c => c.toLowerCase() !== trimmedName.toLowerCase());
  return { caretakers: updated, canRemove: true };
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
 * Create a system note for caretaker removed (pure function)
 */
export function createCaretakerRemovedNote(name: string): CareNote {
  return {
    time: formatTime(new Date()),
    note: `${name} was removed as a caretaker.`,
    author: 'System'
  };
}


