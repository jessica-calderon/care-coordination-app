/**
 * Centralized domain types for care coordination app.
 * These types represent authoritative care data without any persistence concerns.
 */

export interface CareNote {
  time: string;
  note: string;
  author: string;
  editedAt?: string; // ISO timestamp when note was last edited
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface TodayState {
  careNotes: CareNote[];
  tasks: Task[];
  lastUpdatedBy: string;
  currentCaregiver: string;
  caretakers: string[];
}

/**
 * Notes organized by date key (YYYY-MM-DD format)
 */
export type NotesByDate = Record<string, CareNote[]>;


