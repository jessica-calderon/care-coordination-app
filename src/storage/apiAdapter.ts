/**
 * API implementation of DataAdapter.
 * Uses fetch() to communicate with a serverless API backend.
 * This adapter matches the localStorage adapter interface for read/write parity.
 * 
 * Note: Endpoints are placeholders. This adapter will fail at runtime until
 * a backend is configured. No authentication is included yet.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate } from '../domain/types';

/**
 * Base API URL - can be configured via environment variable in the future
 */
const API_BASE_URL = '/api';

/**
 * Helper to make API requests with JSON
 */
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export class ApiAdapter implements DataAdapter {
  /**
   * Load today's complete state
   */
  async loadToday(): Promise<TodayState> {
    return apiRequest<TodayState>('/today');
  }

  /**
   * Add a new care note
   */
  async addNote(noteText: string): Promise<CareNote> {
    const response = await apiRequest<CareNote>('/notes', {
      method: 'POST',
      body: JSON.stringify({ noteText }),
    });
    return response;
  }

  /**
   * Update an existing care note
   */
  async updateNote(noteIndex: number, newNoteText: string): Promise<CareNote> {
    const response = await apiRequest<CareNote>(`/notes/${noteIndex}`, {
      method: 'PATCH',
      body: JSON.stringify({ noteText: newNoteText }),
    });
    return response;
  }

  /**
   * Toggle task completion status
   */
  async toggleTask(taskId: string, completed: boolean): Promise<void> {
    await apiRequest<void>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  }

  /**
   * Perform a handoff from current caregiver to another
   */
  async handoff(toCaregiverName: string): Promise<void> {
    await apiRequest<void>('/handoff', {
      method: 'POST',
      body: JSON.stringify({ toCaregiverName }),
    });
  }

  /**
   * Get all notes organized by date key (for history display)
   */
  async getNotesByDate(): Promise<NotesByDate> {
    return apiRequest<NotesByDate>('/notes');
  }

  /**
   * Check if a care notebook already exists
   */
  async notebookExists(): Promise<boolean> {
    try {
      // Try to load today's state - if it succeeds, notebook exists
      await this.loadToday();
      return true;
    } catch (error) {
      // If 404 or other error, notebook doesn't exist
      return false;
    }
  }

  /**
   * Add a new caretaker to the notebook
   */
  async addCaretaker(name: string): Promise<void> {
    await apiRequest<void>('/caretakers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Remove a caretaker from the notebook
   */
  async removeCaretaker(name: string): Promise<void> {
    await apiRequest<void>(`/caretakers/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get the list of all caretakers
   */
  async getCaretakers(): Promise<string[]> {
    return apiRequest<string[]>('/caretakers');
  }
}

