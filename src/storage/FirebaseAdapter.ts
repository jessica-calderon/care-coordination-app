/**
 * Firebase/Firestore implementation of DataAdapter.
 * 
 * Firebase is the single authoritative source of truth.
 * No localStorage, no fallback, no migration.
 */

import type { DataAdapter } from './DataAdapter';
import type { CareNote, TodayState, NotesByDate, Caretaker } from '../domain/types';
import { firestore } from '../firebase/config';
import { getTodayDateKey, createCareNote, createHandoffNote, addCaretaker as addCaretakerDomain, archiveCaretaker as archiveCaretakerDomain, restoreCaretaker as restoreCaretakerDomain, setPrimaryCaretaker as setPrimaryCaretakerDomain, createCaretakerAddedNote, createCaretakerArchivedNote, createCaretakerRestoredNote, createPrimaryContactChangedNote } from '../domain/notebook';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, Timestamp } from 'firebase/firestore';
import { todayData } from '../mock/todayData';
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
   * Private initializer that is CARETAKER-AWARE.
   * Ensures Today document exists and has valid caregiver state.
   * If Today exists AND has a caregiver, trusts it.
   * Otherwise hydrates from caretakers (active caretakers, primary or first active).
   * Uses merge: true to never wipe existing data.
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

    // If Today exists AND has a caregiver, trust it
    if (snap.exists()) {
      const data = snap.data() as TodayState;
      if (data.currentCaregiver) {
        return data;
      }
    }

    // Otherwise hydrate from caretakers
    const caretakers = await this.getCaretakers();
    const active = caretakers.filter(c => c.isActive);

    const primary =
      active.find(c => c.isPrimary) ??
      active[0];

    const hydrated: TodayState = {
      careNotes: snap.exists() ? (snap.data() as TodayState).careNotes ?? [] : [],
      tasks: snap.exists() ? (snap.data() as TodayState).tasks ?? todayData.tasks ?? [] : todayData.tasks ?? [],
      currentCaregiver: primary?.name ?? '',
      lastUpdatedBy: primary?.name ?? ''
    };

    await setDoc(
      todayRef,
      {
        ...hydrated,
        createdAt: Timestamp.now(),
        version: 1
      },
      { merge: true } // IMPORTANT: never wipe existing data
    );

    return hydrated;
  }

  /**
   * Load today's complete state (notes, tasks, current caregiver, last updated by)
   * Reads only from Firestore. If document does not exist, creates it with defaults.
   * Never throws, never falls back.
   */
  async loadToday(): Promise<TodayState> {
    return this.ensureTodayDocument();
  }

  /**
   * Add a new care note
   * Reads current TodayState from Firestore, adds the note, and writes back.
   * No caching, no localStorage.
   */
  async addNote(noteText: string): Promise<CareNote> {
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
        tasks: todayData.tasks || [],
        currentCaregiver: primaryCaretaker,
        lastUpdatedBy: primaryCaretaker
      };
    } else {
      // Document exists - use existing data
      const data = docSnap.data();
      todayState = {
        careNotes: data.careNotes || [],
        tasks: data.tasks || todayData.tasks || [],
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
    
    // Write updated TodayState to Firestore using merge: true
    await setDoc(docRef, updatedTodayState, { merge: true });
    
    return newNote;
  }

  /**
   * Update an existing care note
   * Stub: Returns updated note structure but doesn't persist
   */
  async updateNote(_noteIndex: number, newNoteText: string): Promise<CareNote> {
    // TODO: Implement Firestore update
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    return {
      time,
      note: newNoteText,
      author: todayData.currentCaregiver,
      editedAt: now.toISOString()
    };
  }

  /**
   * Toggle task completion status
   * Stub: No-op
   */
  async toggleTask(_taskId: string, _completed: boolean): Promise<void> {
    // TODO: Implement Firestore update
  }

  /**
   * Perform a handoff from current caregiver to another
   * Updates currentCaregiver, lastUpdatedBy, and creates a system handoff note.
   */
  async handoff(toCaregiverName: string): Promise<void> {
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
        tasks: todayData.tasks || [],
        currentCaregiver: primaryCaretaker,
        lastUpdatedBy: primaryCaretaker
      };
    } else {
      // Document exists - use existing data
      const data = docSnap.data();
      todayState = {
        careNotes: data.careNotes || [],
        tasks: data.tasks || todayData.tasks || [],
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

