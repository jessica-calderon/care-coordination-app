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

