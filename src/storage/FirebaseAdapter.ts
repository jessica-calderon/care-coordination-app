/**
 * Firebase/Firestore implementation of DataAdapter.
 * 
 * Firebase is the single authoritative source of truth.
 * No localStorage, no fallback, no migration.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate, Caretaker, Task } from '../domain/types';
import { firestore } from '../firebase/config';
import { getTodayDateKey, createCareNote, createHandoffNote, updateCareNote, addCaretaker as addCaretakerDomain, archiveCaretaker as archiveCaretakerDomain, restoreCaretaker as restoreCaretakerDomain, setPrimaryCaretaker as setPrimaryCaretakerDomain, createCaretakerAddedNote, createCaretakerArchivedNote, createCaretakerRestoredNote, createPrimaryContactChangedNote, createCareeNameChangedNote, createCaretakerNameChangedNote, createNoteDeletedNote, createTaskAddedNote, createTaskCompletedNote, createTaskUncompletedNote, createTaskUpdatedNote, createTaskDeletedNote } from '../domain/notebook';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { nanoid } from 'nanoid';

/**
 * Firestore caretaker document structure
 */
interface FirestoreCaretaker {
  id: string;          // Stable ID stored in Firestore
  name: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: Timestamp;
}

/**
 * Notebook metadata structure in Firestore
 */
export interface NotebookMetadata {
  careeName: string;
  createdAt: Timestamp;
  lastOpenedAt: Timestamp;
}

export class FirebaseAdapter implements DataAdapter {
  private notebookId: string;

  /**
   * Create a new FirebaseAdapter instance.
   * @param notebookId The unique identifier for the care notebook
   */
  constructor(notebookId: string) {
    this.notebookId = notebookId;
  }

  /**
   * Helper function to handle Firestore errors with retry logic
   * Note: Quota errors are not retried as they indicate a hard limit
   * @param operation The async operation to retry
   * @param maxRetries Maximum number of retries (default: 3)
   * @param baseDelay Base delay in milliseconds (default: 1000)
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a quota/resource-exhausted error
        const isQuotaError = 
          error?.code === 'resource-exhausted' ||
          error?.code === 'quota-exceeded' ||
          (error?.message && error.message.includes('quota'));
        
        // Don't retry quota errors - they indicate a hard limit that won't be resolved by retrying
        if (isQuotaError) {
          throw error;
        }
        
        // For other errors, retry if we haven't exceeded max retries
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          const timestamp = new Date().toISOString();
          console.warn(
            `[${timestamp}] Firestore error (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // After max retries, throw the error
        throw error;
      }
    }
    
    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Get the Firestore collection reference for caretakers
   */
  private getCaretakersCollection() {
    return collection(firestore, 'notebooks', this.notebookId, 'caretakers');
  }


  /**
   * Convert Firestore caretaker document to Caretaker domain type
   */
  private firestoreCaretakerToDomain(docId: string, data: FirestoreCaretaker): Caretaker {
    return {
      id: data.id || docId, // Use stored id or fallback to docId for backward compatibility
      name: data.name,
      isPrimary: data.isPrimary,
      isActive: data.isActive
    };
  }

  /**
   * Find a caretaker document by name (case-insensitive)
   * Returns the document ID and data, or null if not found
   */
  private async findCaretakerByName(name: string): Promise<{ id: string; data: FirestoreCaretaker } | null> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return null;
    }

    // Load all caretakers and find by case-insensitive name match
    // This matches the behavior of domain functions which use case-insensitive matching
    const caretakersRef = this.getCaretakersCollection();
    const querySnapshot = await getDocs(caretakersRef);

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data() as FirestoreCaretaker;
      if (data.name.toLowerCase() === trimmedName.toLowerCase()) {
        return {
          id: docSnap.id,
          data
        };
      }
    }

    return null;
  }

  /**
   * Find a caretaker document by ID or name
   * Supports both UUID document IDs and caretaker names
   */
  private async findCaretakerByIdOrName(idOrName: string): Promise<{ id: string; data: FirestoreCaretaker } | null> {
    // First try to find by document ID (UUID)
    try {
      const docRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', idOrName);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          data: docSnap.data() as FirestoreCaretaker
        };
      }
    } catch {
      // If document ID lookup fails, try by name
    }

    // Fall back to finding by name
    return this.findCaretakerByName(idOrName);
  }

  /**
   * Load all caretakers from Firestore
   */
  private async loadCaretakersFromFirestore(): Promise<Caretaker[]> {
    try {
      const caretakersRef = this.getCaretakersCollection();
      const querySnapshot = await getDocs(caretakersRef);
      
      const caretakers: Caretaker[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreCaretaker;
        caretakers.push(this.firestoreCaretakerToDomain(docSnap.id, data));
      });

      return caretakers;
    } catch (error) {
      // Silently handle errors - return empty array
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore AbortError - request was cancelled
        return [];
      }
      return [];
    }
  }

  /**
   * Load active caretakers from Firestore.
   * This method explicitly loads caretakers during notebook initialization.
   * Reads from /notebooks/{notebookId}/caretakers and filters by isActive === true.
   * Returns an empty array ONLY if the collection truly has no documents.
   * 
   * @returns Array of active caretakers
   */
  async loadCaretakers(): Promise<Caretaker[]> {
    try {
      const caretakersRef = this.getCaretakersCollection();
      const querySnapshot = await getDocs(caretakersRef);
      
      const caretakers: Caretaker[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as FirestoreCaretaker;
        const caretaker = this.firestoreCaretakerToDomain(docSnap.id, data);
        // Filter by isActive === true
        if (caretaker.isActive) {
          caretakers.push(caretaker);
        }
      });

      return caretakers;
    } catch (error) {
      // Silently handle errors - return empty array
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore AbortError - request was cancelled
        return [];
      }
      return [];
    }
  }

  /**
   * Get the primary caretaker from Firestore
   * Returns the name of the primary caretaker, or empty string if none exists
   */
  private async getPrimaryCaretakerName(): Promise<string> {
    try {
      const caretakers = await this.loadCaretakersFromFirestore();
      const primary = caretakers.find(c => c.isPrimary && c.isActive);
      return primary?.name || '';
    } catch (error) {
      // Silently handle errors - return empty string
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore AbortError - request was cancelled
        return '';
      }
      return '';
    }
  }

  /**
   * Ensures the Today document exists in Firestore.
   * Creates it with initial state if it doesn't exist.
   * This is called at the start of all Today entry points to guarantee
   * the document exists before any operations.
   * Only writes if document doesn't exist.
   */
  private async ensureNotebookInitialized(): Promise<void> {
    const todayKey = getTodayDateKey();
    const todayRef = doc(
      firestore,
      'notebooks',
      this.notebookId,
      'today',
      todayKey
    );

    const snap = await getDoc(todayRef);

    if (snap.exists()) {
      return;
    }

    const initialTodayState: TodayState = {
      careNotes: [],
      tasks: [],
      currentCaregiver: '',
      lastUpdatedBy: ''
    };

    try {
      await this.withRetry(async () => {
        await setDoc(todayRef, {
          ...initialTodayState,
          createdAt: Timestamp.now(),
          version: 1
        });
      });
    } catch (error: any) {
      // If quota error persists after retries, log and continue
      // The document will be created on next attempt or by ensureTodayDocument
      if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] Firestore quota exceeded during notebook initialization. Will retry on next operation.`);
        // Don't throw - allow the operation to continue
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Private initializer that is CARETAKER-AWARE.
   * Ensures Today document exists and has valid caregiver state.
   * Always checks Firestore for caretakers first (authoritative source).
   * If caretakers exist in Firestore, uses them to hydrate currentCaregiver.
   * Otherwise, trusts existing Today document if it has a caregiver.
   * Uses merge: true to never wipe existing data.
   * Only writes to Firestore if document doesn't exist or needs updates.
   */
  private async ensureTodayDocument(): Promise<TodayState> {
    const dateKey = getTodayDateKey();
    const todayRef = doc(
      firestore,
      'notebooks',
      this.notebookId,
      'today',
      dateKey
    );

    const snap = await getDoc(todayRef);
    const existingData = snap.exists() ? (snap.data() as TodayState) : null;

    // Always check Firestore for caretakers first (authoritative source)
    // If caretakers exist in Firestore, use them to hydrate currentCaregiver
    const activeCaretakers = await this.loadCaretakers();

    if (activeCaretakers.length > 0) {
      // Caretakers exist in Firestore - use them to compute current caregiver
      const primary =
        activeCaretakers.find(c => c.isPrimary) ??
        activeCaretakers[0];

      // If Today document exists and has a caregiver that matches an active caretaker, keep it
      // Otherwise, use primary or first active caretaker
      let currentCaregiver = primary?.name ?? '';
      if (existingData?.currentCaregiver) {
        const existingCaregiverIsActive = activeCaretakers.some(
          c => c.name.toLowerCase() === existingData.currentCaregiver.toLowerCase()
        );
        if (existingCaregiverIsActive) {
          currentCaregiver = existingData.currentCaregiver;
        }
      }

      // Ensure tasks have completed field (default to false if missing)
      const tasks = (existingData?.tasks || []).map((task: any) => ({
        id: task.id,
        text: task.text,
        completed: task.completed !== undefined ? task.completed : false
      }));
      
      const hydrated: TodayState = {
        careNotes: existingData?.careNotes ?? [],
        tasks: tasks,
        currentCaregiver: currentCaregiver,
        lastUpdatedBy: existingData?.lastUpdatedBy ?? currentCaregiver
      };

      // Only write if document doesn't exist or if caregiver state needs updating
      const needsUpdate = !existingData || 
        existingData.currentCaregiver !== hydrated.currentCaregiver ||
        existingData.lastUpdatedBy !== hydrated.lastUpdatedBy;

      if (needsUpdate) {
        try {
          await this.withRetry(async () => {
            // When merging, explicitly preserve tasks and careNotes from existing data if they exist
            const updateData: any = {
              currentCaregiver: hydrated.currentCaregiver,
              lastUpdatedBy: hydrated.lastUpdatedBy,
              createdAt: (existingData as any)?.createdAt ?? Timestamp.now(),
              version: 1
            };
            
            // Only update tasks/careNotes if they don't exist in Firestore (new document)
            // Otherwise preserve what's already there
            if (!existingData) {
              updateData.tasks = hydrated.tasks;
              updateData.careNotes = hydrated.careNotes;
            }
            
            await setDoc(todayRef, updateData, { merge: true });
          });
        } catch (error: any) {
          // If quota error persists after retries, log and return existing data or hydrated state
          if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
            const timestamp = new Date().toISOString();
            console.error(`[${timestamp}] Firestore quota exceeded. Returning existing or computed state without writing.`);
            // Return existing data if available, otherwise return hydrated state
            return existingData || hydrated;
          }
          // Re-throw other errors
          throw error;
        }
      }

      return hydrated;
    }

    // No caretakers in Firestore - trust existing Today document if it has a caregiver
    if (existingData?.currentCaregiver) {
      return existingData;
    }

    // No caretakers and no existing caregiver - create empty state
    // Ensure tasks have completed field (default to false if missing)
    const tasks = (existingData?.tasks || []).map((task: any) => ({
      id: task.id,
      text: task.text,
      completed: task.completed !== undefined ? task.completed : false
    }));
    
    const hydrated: TodayState = {
      careNotes: existingData?.careNotes ?? [],
      tasks: tasks,
      currentCaregiver: '',
      lastUpdatedBy: ''
    };

    // Only write if document doesn't exist
    if (!existingData) {
      try {
        await this.withRetry(async () => {
          await setDoc(
            todayRef,
            {
              ...hydrated,
              createdAt: Timestamp.now(),
              version: 1
            },
            { merge: true } // IMPORTANT: never wipe existing data
          );
        });
      } catch (error: any) {
        // If quota error persists after retries, log and return hydrated state
        if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
          const timestamp = new Date().toISOString();
          console.error(`[${timestamp}] Firestore quota exceeded. Returning computed state without writing.`);
          return hydrated;
        }
        // Re-throw other errors
        throw error;
      }
    }

    return hydrated;
  }

  /**
   * Load today's complete state (notes, tasks, current caregiver, last updated by)
   * Reads only from Firestore. If document does not exist, creates it with defaults.
   * Never throws, never falls back.
   */
  async loadToday(): Promise<TodayState> {
    try {
      await this.ensureNotebookInitialized();
      return await this.ensureTodayDocument();
    } catch (error: any) {
      // Handle quota errors gracefully - return empty state
      if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] Firestore quota exceeded in loadToday. Returning empty state.`);
        return {
          careNotes: [],
          tasks: [],
          currentCaregiver: '',
          lastUpdatedBy: ''
        };
      }
      // For other errors, log and return empty state (never throw as per contract)
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] Error loading today state:`, error);
      return {
        careNotes: [],
        tasks: [],
        currentCaregiver: '',
        lastUpdatedBy: ''
      };
    }
  }

  /**
   * Add a new care note
   * Reads current TodayState from Firestore, adds the note, and writes back.
   * No caching, no localStorage.
   */
  async addNote(noteText: string): Promise<CareNote> {
    await this.ensureNotebookInitialized();
    const dateKey = getTodayDateKey();
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Read current TodayState from Firestore with retry logic
    const docSnap = await this.withRetry(async () => {
      return await getDoc(docRef);
    });
    let todayState: TodayState;
    
    if (!docSnap.exists()) {
      // Document doesn't exist - initialize with defaults
      const primaryCaretaker = await this.getPrimaryCaretakerName();
      todayState = {
        careNotes: [],
        tasks: [],
        currentCaregiver: primaryCaretaker,
        lastUpdatedBy: primaryCaretaker
      };
    } else {
      // Document exists - use existing data
      const data = docSnap.data();
      // Ensure tasks have completed field (default to false if missing)
      const tasks = (data.tasks || []).map((task: any) => ({
        id: task.id,
        text: task.text,
        completed: task.completed !== undefined ? task.completed : false
      }));
      todayState = {
        careNotes: data.careNotes || [],
        tasks: tasks,
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || ''
      };
    }
    
    // Get current caregiver for note author
    const currentCaregiver = todayState.currentCaregiver;
    
    // Create new note using domain helper
    const newNote = createCareNote(noteText, currentCaregiver);
    
    // Append note at the beginning of careNotes array
    const updatedCareNotes = [newNote, ...todayState.careNotes];
    
    // Update TodayState with new note
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedCareNotes,
      lastUpdatedBy: currentCaregiver
    };
    
    // Write updated TodayState to Firestore using merge: true with retry logic
    await this.withRetry(async () => {
      await setDoc(docRef, updatedTodayState, { merge: true });
    });
    
    return newNote;
  }

  /**
   * Update an existing care note
   * Reads current TodayState from Firestore, updates the note, and writes back.
   */
  async updateNote(noteIndex: number, newNoteText: string): Promise<CareNote> {
    await this.ensureNotebookInitialized();
    const dateKey = getTodayDateKey();
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Read current TodayState from Firestore with retry logic
    const docSnap = await this.withRetry(async () => {
      return await getDoc(docRef);
    });
    let todayState: TodayState;
    
    if (!docSnap.exists()) {
      throw new Error('Cannot update note: today document does not exist');
    } else {
      const data = docSnap.data();
      todayState = {
        careNotes: data.careNotes || [],
        tasks: data.tasks || [],
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || ''
      };
    }
    
    // Validate index
    if (noteIndex < 0 || noteIndex >= todayState.careNotes.length) {
      throw new Error('Invalid note index');
    }
    
    // Update the note using domain function
    const updatedNote = updateCareNote(todayState.careNotes[noteIndex], newNoteText);
    
    // Create updated notes array
    const updatedNotes = [...todayState.careNotes];
    updatedNotes[noteIndex] = updatedNote;
    
    // Update TodayState with updated note
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedNotes,
      lastUpdatedBy: todayState.currentCaregiver
    };
    
    // Write updated TodayState to Firestore using merge: true with retry logic
    await this.withRetry(async () => {
      await setDoc(docRef, updatedTodayState, { merge: true });
    });
    
    return updatedNote;
  }

  /**
   * Delete an existing care note
   * Reads current TodayState from Firestore, removes the note, and writes back.
   */
  async deleteNote(noteIndex: number): Promise<void> {
    await this.ensureNotebookInitialized();
    const dateKey = getTodayDateKey();
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Read current TodayState from Firestore
    const docSnap = await getDoc(docRef);
    let todayState: TodayState;
    
    if (!docSnap.exists()) {
      throw new Error('Cannot delete note: today document does not exist');
    } else {
      const data = docSnap.data();
      todayState = {
        careNotes: data.careNotes || [],
        tasks: data.tasks || [],
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || ''
      };
    }
    
    // Validate index
    if (noteIndex < 0 || noteIndex >= todayState.careNotes.length) {
      throw new Error('Invalid note index');
    }
    
    // Get the note being deleted (before removing it)
    const noteToDelete = todayState.careNotes[noteIndex];
    
    // Create system note for deletion (only if not a system note)
    let updatedNotes = [...todayState.careNotes];
    if (noteToDelete.author !== 'System') {
      const deleteNote = createNoteDeletedNote(noteToDelete.author, noteToDelete.note);
      // Insert system note at the same position, then remove the original
      updatedNotes.splice(noteIndex, 1, deleteNote);
    } else {
      // For system notes, just remove them without creating a deletion note
      updatedNotes = updatedNotes.filter((_, index) => index !== noteIndex);
    }
    
    // Update TodayState with updated notes
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedNotes,
      lastUpdatedBy: todayState.currentCaregiver
    };
    
    // Write updated TodayState to Firestore using merge: true
    await setDoc(docRef, updatedTodayState, { merge: true });
  }

  /**
   * Toggle task completion status
   * Reads current TodayState from Firestore, toggles the task's completed status, and writes back.
   */
  async toggleTask(taskId: string): Promise<void> {
    await this.ensureNotebookInitialized();
    const dateKey = getTodayDateKey();
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Read current TodayState from Firestore with retry logic
    const docSnap = await this.withRetry(async () => {
      return await getDoc(docRef);
    });
    
    let todayState: TodayState;
    
    if (!docSnap.exists()) {
      // Document doesn't exist - initialize with defaults
      const primaryCaretaker = await this.getPrimaryCaretakerName();
      todayState = {
        careNotes: [],
        tasks: [],
        currentCaregiver: primaryCaretaker,
        lastUpdatedBy: primaryCaretaker
      };
    } else {
      // Document exists - use existing data
      const data = docSnap.data();
      // Ensure tasks have completed field (default to false if missing)
      const tasks = (data.tasks || []).map((task: any) => ({
        id: task.id,
        text: task.text,
        completed: task.completed !== undefined ? task.completed : false
      }));
      todayState = {
        careNotes: data.careNotes || [],
        tasks: tasks,
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || ''
      };
    }
    
    // Find the task and toggle its completed status
    const taskIndex = todayState.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      // Task not found - silently return (task may have been deleted)
      return;
    }
    
    const task = todayState.tasks[taskIndex];
    const wasCompleted = task.completed;
    
    // Toggle the completed status
    const updatedTasks = [...todayState.tasks];
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      completed: !wasCompleted
    };
    
    // Create system note for task completion/uncompletion
    const currentCaregiver = todayState.currentCaregiver;
    const taskNote = wasCompleted 
      ? createTaskUncompletedNote(currentCaregiver, task.text)
      : createTaskCompletedNote(currentCaregiver, task.text);
    
    // Prepend system note to careNotes
    const updatedCareNotes = [taskNote, ...todayState.careNotes];
    
    // Update TodayState with toggled task and system note
    const updatedTodayState: TodayState = {
      ...todayState,
      tasks: updatedTasks,
      careNotes: updatedCareNotes,
      lastUpdatedBy: currentCaregiver
    };
    
    // Write updated TodayState to Firestore using merge: true with retry logic
    await this.withRetry(async () => {
      await setDoc(docRef, updatedTodayState, { merge: true });
    });
  }

  /**
   * Add a new task
   * Reads current TodayState from Firestore, adds the task, and writes back.
   */
  async addTask(text: string): Promise<Task> {
    await this.ensureNotebookInitialized();
    const dateKey = getTodayDateKey();
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Read current TodayState from Firestore with retry logic
    const docSnap = await this.withRetry(async () => {
      return await getDoc(docRef);
    });
    
    let todayState: TodayState;
    
    if (!docSnap.exists()) {
      // Document doesn't exist - initialize with defaults
      const primaryCaretaker = await this.getPrimaryCaretakerName();
      todayState = {
        careNotes: [],
        tasks: [],
        currentCaregiver: primaryCaretaker,
        lastUpdatedBy: primaryCaretaker
      };
    } else {
      // Document exists - use existing data
      const data = docSnap.data();
      // Ensure tasks have completed field (default to false if missing)
      const tasks = (data.tasks || []).map((task: any) => ({
        id: task.id,
        text: task.text,
        completed: task.completed !== undefined ? task.completed : false
      }));
      todayState = {
        careNotes: data.careNotes || [],
        tasks: tasks,
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || ''
      };
    }
    
    // Create new task
    const newTask: Task = {
      id: nanoid(),
      text: text.trim(),
      completed: false
    };
    
    // Add task to the beginning of tasks array
    const updatedTasks = [newTask, ...todayState.tasks];
    
    // Create system note for task added
    const currentCaregiver = todayState.currentCaregiver;
    const taskAddedNote = createTaskAddedNote(currentCaregiver, newTask.text);
    
    // Prepend system note to careNotes
    const updatedCareNotes = [taskAddedNote, ...todayState.careNotes];
    
    // Update TodayState with new task and system note
    const updatedTodayState: TodayState = {
      ...todayState,
      tasks: updatedTasks,
      careNotes: updatedCareNotes,
      lastUpdatedBy: currentCaregiver
    };
    
    // Write updated TodayState to Firestore using merge: true with retry logic
    await this.withRetry(async () => {
      await setDoc(docRef, updatedTodayState, { merge: true });
    });
    
    return newTask;
  }

  /**
   * Update an existing task
   * Reads current TodayState from Firestore, updates the task, and writes back.
   */
  async updateTask(taskId: string, newText: string): Promise<Task> {
    await this.ensureNotebookInitialized();
    const dateKey = getTodayDateKey();
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Read current TodayState from Firestore with retry logic
    const docSnap = await this.withRetry(async () => {
      return await getDoc(docRef);
    });
    
    let todayState: TodayState;
    
    if (!docSnap.exists()) {
      // Document doesn't exist - initialize with defaults
      const primaryCaretaker = await this.getPrimaryCaretakerName();
      todayState = {
        careNotes: [],
        tasks: [],
        currentCaregiver: primaryCaretaker,
        lastUpdatedBy: primaryCaretaker
      };
    } else {
      // Document exists - use existing data
      const data = docSnap.data();
      // Ensure tasks have completed field (default to false if missing)
      const tasks = (data.tasks || []).map((task: any) => ({
        id: task.id,
        text: task.text,
        completed: task.completed !== undefined ? task.completed : false
      }));
      todayState = {
        careNotes: data.careNotes || [],
        tasks: tasks,
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || ''
      };
    }
    
    // Find the task and update its text
    const taskIndex = todayState.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error('Task not found');
    }
    
    const oldTask = todayState.tasks[taskIndex];
    const oldText = oldTask.text;
    const newTextTrimmed = newText.trim();
    
    // Update the task text
    const updatedTasks = [...todayState.tasks];
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      text: newTextTrimmed
    };
    
    // Create system note for task updated
    const currentCaregiver = todayState.currentCaregiver;
    const taskUpdatedNote = createTaskUpdatedNote(currentCaregiver, oldText, newTextTrimmed);
    
    // Prepend system note to careNotes
    const updatedCareNotes = [taskUpdatedNote, ...todayState.careNotes];
    
    // Update TodayState with updated task and system note
    const updatedTodayState: TodayState = {
      ...todayState,
      tasks: updatedTasks,
      careNotes: updatedCareNotes,
      lastUpdatedBy: currentCaregiver
    };
    
    // Write updated TodayState to Firestore using merge: true with retry logic
    await this.withRetry(async () => {
      await setDoc(docRef, updatedTodayState, { merge: true });
    });
    
    return updatedTasks[taskIndex];
  }

  /**
   * Delete an existing task
   * Reads current TodayState from Firestore, removes the task, and writes back.
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.ensureNotebookInitialized();
    const dateKey = getTodayDateKey();
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Read current TodayState from Firestore with retry logic
    const docSnap = await this.withRetry(async () => {
      return await getDoc(docRef);
    });
    
    let todayState: TodayState;
    
    if (!docSnap.exists()) {
      // Document doesn't exist - nothing to delete
      return;
    } else {
      // Document exists - use existing data
      const data = docSnap.data();
      // Ensure tasks have completed field (default to false if missing)
      const tasks = (data.tasks || []).map((task: any) => ({
        id: task.id,
        text: task.text,
        completed: task.completed !== undefined ? task.completed : false
      }));
      todayState = {
        careNotes: data.careNotes || [],
        tasks: tasks,
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || ''
      };
    }
    
    // Find the task before removing it (for system note)
    const taskToDelete = todayState.tasks.find(t => t.id === taskId);
    
    // Remove the task
    const updatedTasks = todayState.tasks.filter(t => t.id !== taskId);
    
    // If task wasn't found, silently return
    if (updatedTasks.length === todayState.tasks.length) {
      return;
    }
    
    // Create system note for task deleted
    const currentCaregiver = todayState.currentCaregiver;
    const taskDeletedNote = createTaskDeletedNote(currentCaregiver, taskToDelete!.text);
    
    // Prepend system note to careNotes
    const updatedCareNotes = [taskDeletedNote, ...todayState.careNotes];
    
    // Update TodayState with task removed and system note
    const updatedTodayState: TodayState = {
      ...todayState,
      tasks: updatedTasks,
      careNotes: updatedCareNotes,
      lastUpdatedBy: currentCaregiver
    };
    
    // Write updated TodayState to Firestore using merge: true with retry logic
    await this.withRetry(async () => {
      await setDoc(docRef, updatedTodayState, { merge: true });
    });
  }

  /**
   * Perform a handoff from current caregiver to another
   * Updates currentCaregiver, lastUpdatedBy, and creates a system handoff note.
   */
  async handoff(toCaregiverName: string): Promise<void> {
    await this.ensureNotebookInitialized();
    const dateKey = getTodayDateKey();
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Read current TodayState from Firestore
    const docSnap = await getDoc(docRef);
    let todayState: TodayState;
    
    if (!docSnap.exists()) {
      // Document doesn't exist - initialize with defaults
      const primaryCaretaker = await this.getPrimaryCaretakerName();
      todayState = {
        careNotes: [],
        tasks: [],
        currentCaregiver: primaryCaretaker,
        lastUpdatedBy: primaryCaretaker
      };
    } else {
      // Document exists - use existing data
      const data = docSnap.data();
      // Ensure tasks have completed field (default to false if missing)
      const tasks = (data.tasks || []).map((task: any) => ({
        id: task.id,
        text: task.text,
        completed: task.completed !== undefined ? task.completed : false
      }));
      todayState = {
        careNotes: data.careNotes || [],
        tasks: tasks,
        currentCaregiver: data.currentCaregiver || '',
        lastUpdatedBy: data.lastUpdatedBy || ''
      };
    }
    
    const fromCaregiver = todayState.currentCaregiver;
    
    // Create handoff system note
    const handoffNote = createHandoffNote(fromCaregiver, toCaregiverName);
    
    // Prepend handoff note to careNotes
    const updatedCareNotes = [handoffNote, ...todayState.careNotes];
    
    // Update TodayState with handoff
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedCareNotes,
      currentCaregiver: toCaregiverName,
      lastUpdatedBy: toCaregiverName
    };
    
    // Write updated TodayState to Firestore
    await setDoc(docRef, updatedTodayState, { merge: true });
  }

  /**
   * Get all notes organized by date key (for history display)
   * Queries all /today/{dateKey} documents for this notebook.
   */
  async getNotesByDate(): Promise<NotesByDate> {
    try {
      const todayCollectionRef = collection(firestore, 'notebooks', this.notebookId, 'today');
      const querySnapshot = await getDocs(todayCollectionRef);
      
      const notesByDate: NotesByDate = {};
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const dateKey = docSnap.id;
        const careNotes = data.careNotes || [];
        
        if (careNotes.length > 0) {
          notesByDate[dateKey] = careNotes;
        }
      });
      
      return notesByDate;
    } catch (error) {
      // Silently handle errors - return empty object
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore AbortError - request was cancelled
        return {};
      }
      return {};
    }
  }

  /**
   * Check if a care notebook already exists
   * Returns true if at least one caretaker exists OR any /today/{date} document exists
   */
  async notebookExists(): Promise<boolean> {
    try {
      // Check for caretakers
      const caretakers = await this.loadCaretakersFromFirestore();
      if (caretakers.length > 0) {
        return true;
      }
      
      // Check for today documents
      const todayCollectionRef = collection(firestore, 'notebooks', this.notebookId, 'today');
      const querySnapshot = await getDocs(todayCollectionRef);
      
      return !querySnapshot.empty;
    } catch (error) {
      // Silently handle errors - return false
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore AbortError - request was cancelled
        return false;
      }
      return false;
    }
  }

  /**
   * Add a new caretaker to the notebook
   * 
   * MUTATION PATTERN:
   * 1. Read current caretakers from Firebase (/notebooks/{notebookId}/caretakers collection)
   * 2. Apply domain logic (addCaretakerDomain)
   * 3. Write updated caretaker document(s) back to Firebase
   * 
   * Caretakers are stored ONLY in /notebooks/{notebookId}/caretakers collection.
   * They are NEVER written to Today documents or localStorage.
   */
  async addCaretaker(name: string): Promise<void> {
    await this.ensureNotebookInitialized();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    // Step 1: Read current caretakers from Firebase (authoritative source)
    const currentCaretakers = await this.loadCaretakersFromFirestore();
    
    // Optional: Guard against duplicate names
    if (currentCaretakers.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      throw new Error('Caretaker already exists');
    }
    
    // Step 2: Apply domain logic (includes duplicate check and primary assignment)
    const updatedCaretakers = addCaretakerDomain(currentCaretakers, trimmedName);
    
    // Check if caretaker was actually added
    if (updatedCaretakers.length === currentCaretakers.length) {
      // Already exists, no-op
      return;
    }

    // Get the newly added caretaker
    const newCaretaker = updatedCaretakers.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    if (!newCaretaker) {
      return;
    }

    // Step 3: Generate stable ID and write new caretaker document to Firebase
    const stableId = nanoid();
    const caretakerId = nanoid(); // Use nanoid for Firestore document ID
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', caretakerId);
    
    const firestoreCaretaker: FirestoreCaretaker = {
      id: stableId, // Store stable ID in document
      name: newCaretaker.name,
      isPrimary: newCaretaker.isPrimary,
      isActive: newCaretaker.isActive,
      createdAt: Timestamp.now()
    };

    await setDoc(docRef, firestoreCaretaker);

    // If this caretaker became primary, update other caretakers
    if (newCaretaker.isPrimary) {
      const caretakersRef = this.getCaretakersCollection();
      const querySnapshot = await getDocs(caretakersRef);
      
      const batchUpdates: Promise<void>[] = [];
      querySnapshot.forEach((docSnap) => {
        if (docSnap.id !== caretakerId) {
          const data = docSnap.data() as FirestoreCaretaker;
          if (data.isPrimary) {
            const updateRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', docSnap.id);
            batchUpdates.push(updateDoc(updateRef, { isPrimary: false }));
          }
        }
      });
      await Promise.all(batchUpdates);
    }

    // Caretakers are stored ONLY in /notebooks/{notebookId}/caretakers collection

    // Create system note and add to today's notes
    const systemNote = createCaretakerAddedNote(trimmedName);
    const dateKey = getTodayDateKey();
    const todayDocRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Load today state
    const todayState = await this.loadToday();

    // Add system note at the beginning
    const updatedCareNotes = [systemNote, ...todayState.careNotes];
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedCareNotes
    };

    await setDoc(todayDocRef, updatedTodayState, { merge: true });

    // Re-hydrate Today to ensure valid caregiver state after mutation
    await this.ensureTodayDocument();
  }

  /**
   * Archive a caretaker (mark as inactive)
   * Supports both name and ID lookup
   * 
   * MUTATION PATTERN:
   * 1. Read current caretakers from Firebase (/notebooks/{notebookId}/caretakers collection)
   * 2. Apply domain logic (archiveCaretakerDomain)
   * 3. Write updated caretaker document back to Firebase
   * 
   * Caretakers are stored ONLY in /notebooks/{notebookId}/caretakers collection.
   * They are NEVER written to Today documents or localStorage.
   */
  async archiveCaretaker(nameOrId: string): Promise<void> {
    await this.ensureNotebookInitialized();
    // Step 1: Read current caretakers from Firebase (authoritative source)
    const currentCaretakers = await this.loadCaretakersFromFirestore();
    
    // Get current caregiver from today state
    const todayState = await this.loadToday();
    const currentCaregiver = todayState.currentCaregiver;

    // Step 2: Apply domain logic (validates can archive, computes updated state)
    const { canArchive, reason } = archiveCaretakerDomain(currentCaretakers, nameOrId, currentCaregiver);
    
    if (!canArchive) {
      throw new Error(reason || 'Cannot archive this caretaker');
    }

    // Find the caretaker document in Firestore
    const caretakerDoc = await this.findCaretakerByIdOrName(nameOrId);
    if (!caretakerDoc) {
      throw new Error('Caretaker not found');
    }

    // Step 3: Write updated caretaker document back to Firebase
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', caretakerDoc.id);
    await updateDoc(docRef, { isActive: false });

    // Create system note and add to today's notes
    const systemNote = createCaretakerArchivedNote(caretakerDoc.data.name);
    const dateKey = getTodayDateKey();
    const todayDocRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Add system note at the beginning
    const updatedCareNotes = [systemNote, ...todayState.careNotes];
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedCareNotes
    };

    await setDoc(todayDocRef, updatedTodayState, { merge: true });

    // Re-hydrate Today to ensure valid caregiver state after mutation
    await this.ensureTodayDocument();
  }

  /**
   * Restore an archived caretaker (mark as active)
   * Supports both name and ID lookup
   * 
   * MUTATION PATTERN:
   * 1. Read current caretakers from Firebase (/notebooks/{notebookId}/caretakers collection)
   * 2. Apply domain logic (restoreCaretakerDomain)
   * 3. Write updated caretaker document back to Firebase
   * 
   * Caretakers are stored ONLY in /notebooks/{notebookId}/caretakers collection.
   * They are NEVER written to Today documents or localStorage.
   */
  async restoreCaretaker(nameOrId: string): Promise<void> {
    await this.ensureNotebookInitialized();
    // Step 1: Read current caretakers from Firebase (authoritative source)
    const currentCaretakers = await this.loadCaretakersFromFirestore();

    // Step 2: Apply domain logic (validates can restore, computes updated state)
    const { canRestore, reason } = restoreCaretakerDomain(currentCaretakers, nameOrId);
    
    if (!canRestore) {
      throw new Error(reason || 'Cannot restore this caretaker');
    }

    // Find the caretaker document in Firestore
    const caretakerDoc = await this.findCaretakerByIdOrName(nameOrId);
    if (!caretakerDoc) {
      throw new Error('Caretaker not found');
    }

    // Step 3: Write updated caretaker document back to Firebase
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', caretakerDoc.id);
    await updateDoc(docRef, { isActive: true });

    // Create system note and add to today's notes
    const systemNote = createCaretakerRestoredNote(caretakerDoc.data.name);
    const dateKey = getTodayDateKey();
    const todayDocRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Load today state
    const todayState = await this.loadToday();

    // Add system note at the beginning
    const updatedCareNotes = [systemNote, ...todayState.careNotes];
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedCareNotes
    };

    await setDoc(todayDocRef, updatedTodayState, { merge: true });

    // Re-hydrate Today to ensure valid caregiver state after mutation
    await this.ensureTodayDocument();
  }

  /**
   * Update a caretaker's name
   * Supports both name and ID lookup for the old name
   * 
   * MUTATION PATTERN:
   * 1. Find caretaker document in Firestore
   * 2. Update the name field
   * 3. Update any references in Today documents if needed
   * 
   * @param oldName The current name of the caretaker
   * @param newName The new name for the caretaker
   */
  async updateCaretakerName(oldName: string, newName: string): Promise<void> {
    await this.ensureNotebookInitialized();
    const trimmedOldName = oldName.trim();
    const trimmedNewName = newName.trim();
    
    if (!trimmedOldName || !trimmedNewName) {
      throw new Error('Invalid name');
    }
    
    if (trimmedOldName.toLowerCase() === trimmedNewName.toLowerCase()) {
      // No change needed
      return;
    }
    
    // Check if new name already exists
    const currentCaretakers = await this.loadCaretakersFromFirestore();
    if (currentCaretakers.some(c => c.name.toLowerCase() === trimmedNewName.toLowerCase())) {
      throw new Error('A caretaker with this name already exists');
    }
    
    // Find the caretaker document
    const caretakerDoc = await this.findCaretakerByIdOrName(trimmedOldName);
    if (!caretakerDoc) {
      throw new Error('Caretaker not found');
    }
    
    // Update the caretaker document
    const docRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', caretakerDoc.id);
    await updateDoc(docRef, { name: trimmedNewName });
    
    // Update references in Today documents (currentCaregiver and lastUpdatedBy)
    const todayCollectionRef = collection(firestore, 'notebooks', this.notebookId, 'today');
    const querySnapshot = await getDocs(todayCollectionRef);
    
    const batchUpdates: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const updates: any = {};
      let needsUpdate = false;
      
      if (data.currentCaregiver === trimmedOldName) {
        updates.currentCaregiver = trimmedNewName;
        needsUpdate = true;
      }
      
      if (data.lastUpdatedBy === trimmedOldName) {
        updates.lastUpdatedBy = trimmedNewName;
        needsUpdate = true;
      }
      
      // Update careNotes that reference the old name
      if (data.careNotes && Array.isArray(data.careNotes)) {
        const updatedNotes = data.careNotes.map((note: any) => {
          if (note.author === trimmedOldName) {
            return { ...note, author: trimmedNewName };
          }
          return note;
        });
        
        // Check if any notes were updated
        const notesChanged = updatedNotes.some((note: any, index: number) => 
          note.author !== data.careNotes[index].author
        );
        
        if (notesChanged) {
          updates.careNotes = updatedNotes;
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        const updateRef = doc(firestore, 'notebooks', this.notebookId, 'today', docSnap.id);
        batchUpdates.push(updateDoc(updateRef, updates));
      }
    });
    
    await Promise.all(batchUpdates);
    
    // Create system note and add to today's notes
    const systemNote = createCaretakerNameChangedNote(trimmedOldName, trimmedNewName);
    const dateKey = getTodayDateKey();
    const todayDocRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Load today state
    const todayState = await this.loadToday();
    
    // Add system note at the beginning
    const updatedCareNotes = [systemNote, ...todayState.careNotes];
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedCareNotes
    };
    
    await setDoc(todayDocRef, updatedTodayState, { merge: true });
  }

  /**
   * Set a caretaker as the primary contact
   * Supports both name and ID lookup
   * 
   * MUTATION PATTERN:
   * 1. Read current caretakers from Firebase (/notebooks/{notebookId}/caretakers collection)
   * 2. Apply domain logic (setPrimaryCaretakerDomain)
   * 3. Write updated caretaker document(s) back to Firebase
   * 
   * Caretakers are stored ONLY in /notebooks/{notebookId}/caretakers collection.
   * They are NEVER written to Today documents or localStorage.
   */
  async setPrimaryCaretaker(nameOrId: string): Promise<void> {
    await this.ensureNotebookInitialized();
    // Step 1: Read current caretakers from Firebase (authoritative source)
    const currentCaretakers = await this.loadCaretakersFromFirestore();

    // Step 2: Apply domain logic (validates can set primary, computes updated state)
    const { canSetPrimary, reason } = setPrimaryCaretakerDomain(currentCaretakers, nameOrId);
    
    if (!canSetPrimary) {
      throw new Error(reason || 'Cannot set this caretaker as primary');
    }

    // Find the caretaker document in Firestore
    const caretakerDoc = await this.findCaretakerByIdOrName(nameOrId);
    if (!caretakerDoc) {
      throw new Error('Caretaker not found');
    }

    // Step 3: Write updated caretaker documents back to Firebase
    // Update all caretakers: clear existing primary, set new primary
    const caretakersRef = this.getCaretakersCollection();
    const querySnapshot = await getDocs(caretakersRef);
    
    const batchUpdates: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      const updateRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', docSnap.id);
      if (docSnap.id === caretakerDoc.id) {
        // Set this one as primary
        batchUpdates.push(updateDoc(updateRef, { isPrimary: true }));
      } else {
        // Clear primary flag for others
        const data = docSnap.data() as FirestoreCaretaker;
        if (data.isPrimary) {
          batchUpdates.push(updateDoc(updateRef, { isPrimary: false }));
        }
      }
    });
    await Promise.all(batchUpdates);

    // Create system note and add to today's notes
    const systemNote = createPrimaryContactChangedNote(caretakerDoc.data.name);
    const dateKey = getTodayDateKey();
    const todayDocRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
    
    // Load today state
    const todayState = await this.loadToday();

    // Add system note at the beginning
    const updatedCareNotes = [systemNote, ...todayState.careNotes];
    const updatedTodayState: TodayState = {
      ...todayState,
      careNotes: updatedCareNotes
    };

    await setDoc(todayDocRef, updatedTodayState, { merge: true });

    // Re-hydrate Today to ensure valid caregiver state after mutation
    await this.ensureTodayDocument();
  }

  /**
   * Create a new notebook with metadata in Firestore.
   * Creates the notebook document at /notebooks/{notebookId} with careeName.
   * @param careeName The name of the care recipient
   */
  async createNotebook(careeName: string): Promise<void> {
    const notebookRef = doc(firestore, 'notebooks', this.notebookId);
    const now = Timestamp.now();
    
    await setDoc(notebookRef, {
      careeName: careeName.trim(),
      createdAt: now,
      lastOpenedAt: now
    });
  }

  /**
   * Update notebook metadata in Firestore.
   * Updates the careeName and lastOpenedAt timestamp.
   * Creates a system note when the name changes.
   * @param careeName The updated name of the care recipient
   */
  async updateNotebookMetadata(careeName: string): Promise<void> {
    const notebookRef = doc(firestore, 'notebooks', this.notebookId);
    
    // Get old name before updating
    const snap = await getDoc(notebookRef);
    const oldName = snap.exists() ? (snap.data().careeName || 'Care recipient') : 'Care recipient';
    const newName = careeName.trim();
    
    // Only create note if name actually changed
    if (oldName !== newName) {
      // Update the metadata
      await updateDoc(notebookRef, {
        careeName: newName,
        lastOpenedAt: Timestamp.now()
      });
      
      // Create system note and add to today's notes
      const systemNote = createCareeNameChangedNote(oldName, newName);
      const dateKey = getTodayDateKey();
      const todayDocRef = doc(firestore, 'notebooks', this.notebookId, 'today', dateKey);
      
      // Load today state
      const todayState = await this.loadToday();
      
      // Add system note at the beginning
      const updatedCareNotes = [systemNote, ...todayState.careNotes];
      const updatedTodayState: TodayState = {
        ...todayState,
        careNotes: updatedCareNotes
      };
      
      await setDoc(todayDocRef, updatedTodayState, { merge: true });
    } else {
      // Just update timestamp if name didn't change
      await updateDoc(notebookRef, {
        lastOpenedAt: Timestamp.now()
      });
    }
  }

  /**
   * Get notebook metadata from Firestore.
   * Returns metadata with careeName, or fallback to "Care recipient" if not found.
   * @returns Notebook metadata
   */
  async getNotebookMetadata(): Promise<NotebookMetadata> {
    try {
      const notebookRef = doc(firestore, 'notebooks', this.notebookId);
      const snap = await getDoc(notebookRef);
      
      if (snap.exists()) {
        const data = snap.data();
        return {
          careeName: data.careeName || 'Care recipient',
          createdAt: data.createdAt || Timestamp.now(),
          lastOpenedAt: data.lastOpenedAt || Timestamp.now()
        };
      }
      
      // Notebook doesn't exist - return fallback
      return {
        careeName: 'Care recipient',
        createdAt: Timestamp.now(),
        lastOpenedAt: Timestamp.now()
      };
    } catch (error) {
      // Silently handle errors - return fallback
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore AbortError - request was cancelled
      }
      return {
        careeName: 'Care recipient',
        createdAt: Timestamp.now(),
        lastOpenedAt: Timestamp.now()
      };
    }
  }

  /**
   * Get the list of all caretakers
   * Loads from Firestore (authoritative source)
   * Reads ONLY from /notebooks/{notebookId}/caretakers collection
   * 
   * CARETAKERS CANONICAL LOCATION:
   * /notebooks/{notebookId}/caretakers (collection)
   * 
   * Ensures that if there's a currentCaregiver in the Today document,
   * it exists as a caretaker document (creates one if missing).
   */
  async getCaretakers(): Promise<Caretaker[]> {
    try {
      let caretakers = await this.loadCaretakersFromFirestore();
      
      // Ensure currentCaregiver from Today document exists as a caretaker
      const todayState = await this.loadToday();
      const currentCaregiver = todayState.currentCaregiver;
      
      if (currentCaregiver && currentCaregiver.trim()) {
        const trimmedName = currentCaregiver.trim();
        const exists = caretakers.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
        
        if (!exists) {
          // Create caretaker document for currentCaregiver
          const stableId = nanoid();
          const caretakerId = nanoid();
          const docRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', caretakerId);
          
          // Make this caretaker primary if no caretakers exist, otherwise just active
          const isPrimary = caretakers.length === 0;
          
          const firestoreCaretaker: FirestoreCaretaker = {
            id: stableId,
            name: trimmedName,
            isPrimary: isPrimary,
            isActive: true,
            createdAt: Timestamp.now()
          };
          
          await setDoc(docRef, firestoreCaretaker);
          
          // If there are existing caretakers and we made this one primary, clear other primary flags
          if (isPrimary && caretakers.length > 0) {
            const caretakersRef = this.getCaretakersCollection();
            const querySnapshot = await getDocs(caretakersRef);
            
            const batchUpdates: Promise<void>[] = [];
            querySnapshot.forEach((docSnap) => {
              if (docSnap.id !== caretakerId) {
                const data = docSnap.data() as FirestoreCaretaker;
                if (data.isPrimary) {
                  const updateRef = doc(firestore, 'notebooks', this.notebookId, 'caretakers', docSnap.id);
                  batchUpdates.push(updateDoc(updateRef, { isPrimary: false }));
                }
              }
            });
            if (batchUpdates.length > 0) {
              await Promise.all(batchUpdates);
            }
          }
          
          // Reload caretakers to include the newly created one
          caretakers = await this.loadCaretakersFromFirestore();
        }
      }
      
      // Deduplicate caretakers by name (case-insensitive)
      // If duplicates exist, keep the one that is: active > primary > first encountered
      const deduplicated: Caretaker[] = [];
      const seenNames = new Set<string>();
      
      for (const caretaker of caretakers) {
        const nameKey = caretaker.name.toLowerCase();
        if (!seenNames.has(nameKey)) {
          // First occurrence of this name - add it
          deduplicated.push(caretaker);
          seenNames.add(nameKey);
        } else {
          // Duplicate found - replace if this one is better
          const existingIndex = deduplicated.findIndex(c => c.name.toLowerCase() === nameKey);
          const existing = deduplicated[existingIndex];
          
          // Prefer: active > primary > existing
          if (caretaker.isActive && !existing.isActive) {
            deduplicated[existingIndex] = caretaker;
          } else if (caretaker.isPrimary && !existing.isPrimary && caretaker.isActive === existing.isActive) {
            deduplicated[existingIndex] = caretaker;
          }
          // Otherwise keep existing
        }
      }
      
      return deduplicated;
    } catch (error) {
      // Silently handle errors - return empty array
      if (error instanceof Error && error.name === 'AbortError') {
        // Ignore AbortError - request was cancelled
        return [];
      }
      // Return empty array instead of falling back
      // This enforces Firebase as the single authoritative source
      return [];
    }
  }
}

