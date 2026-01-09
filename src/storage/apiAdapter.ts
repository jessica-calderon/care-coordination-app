/**
 * API implementation of DataAdapter.
 * Uses fetch() to communicate with a serverless API backend.
 * This adapter matches the localStorage adapter interface for read/write parity.
 * 
 * Note: Endpoints are placeholders. This adapter will fail at runtime until
 * a backend is configured. No authentication is included yet.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate, Caretaker, Task } from '../domain/types';

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
  try {
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
  } catch (error) {
    // Handle AbortError silently - request was cancelled
    if (error instanceof Error && error.name === 'AbortError') {
      throw error; // Re-throw to allow caller to handle cancellation
    }
    throw error;
  }
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
   * Delete an existing care note
   */
  async deleteNote(noteIndex: number): Promise<void> {
    await apiRequest<void>(`/notes/${noteIndex}`, {
      method: 'DELETE',
    });
  }

  /**
   * Toggle task completion status
   */
  async toggleTask(taskId: string): Promise<void> {
    // Read current state to get the task's current completed status
    const todayState = await this.loadToday();
    const task = todayState.tasks.find(t => t.id === taskId);
    if (!task) {
      // Task not found - silently return
      return;
    }
    // Toggle and send the new completed status
    await apiRequest<void>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !task.completed }),
    });
  }

  /**
   * Add a new task
   */
  async addTask(text: string): Promise<Task> {
    return apiRequest<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, newText: string): Promise<Task> {
    return apiRequest<Task>(`/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ text: newText }),
    });
  }

  /**
   * Delete an existing task
   */
  async deleteTask(taskId: string): Promise<void> {
    await apiRequest<void>(`/tasks/${taskId}`, {
      method: 'DELETE',
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
      // Handle AbortError - request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }
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
   * Archive a caretaker (mark as inactive)
   */
  async archiveCaretaker(name: string): Promise<void> {
    await apiRequest<void>(`/caretakers/${encodeURIComponent(name)}/archive`, {
      method: 'POST',
    });
  }

  /**
   * Restore an archived caretaker (mark as active)
   */
  async restoreCaretaker(name: string): Promise<void> {
    await apiRequest<void>(`/caretakers/${encodeURIComponent(name)}/restore`, {
      method: 'POST',
    });
  }

  /**
   * Set a caretaker as the primary contact
   */
  async setPrimaryCaretaker(name: string): Promise<void> {
    await apiRequest<void>(`/caretakers/${encodeURIComponent(name)}/primary`, {
      method: 'POST',
    });
  }

  /**
   * Get the list of all caretakers
   */
  async getCaretakers(): Promise<Caretaker[]> {
    return apiRequest<Caretaker[]>('/caretakers');
  }

  /**
   * Update a caretaker's name
   */
  async updateCaretakerName(oldName: string, newName: string): Promise<void> {
    await apiRequest<void>(`/caretakers/${encodeURIComponent(oldName)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    });
  }
}

