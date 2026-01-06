/**
 * Centralized domain types for care coordination app.
 * These types represent authoritative care data without any persistence concerns.
 */

export interface CareNote {
  time: string;
  note: string;
  author: string;
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
}

/**
 * Notes organized by date key (YYYY-MM-DD format)
 */
export type NotesByDate = Record<string, CareNote[]>;

