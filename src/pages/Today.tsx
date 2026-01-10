import { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { CareNote, NotesByDate, Caretaker, Task } from '../domain/types';
import { getTodayDateKey, canEditNote, canDeleteNote } from '../domain/notebook';
import { useDataAdapter } from '../storage/DataAdapterContext';
import { createFirebaseAdapter } from '../storage';
import { resolveNotebookId } from '../utils/notebookId';
import { Icons } from '../ui/icons';
import { Spinner } from '../components/Spinner';
import { InlineSpinner } from '../components/InlineSpinner';
import CareeNameModal from '../components/CareeNameModal';

function Today() {
  const dataAdapter = useDataAdapter();
  const [notesByDate, setNotesByDate] = useState<NotesByDate>({});
  const [careNotes, setCareNotes] = useState<CareNote[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [noteText, setNoteText] = useState('');
  const [lastUpdatedBy, setLastUpdatedBy] = useState('');
  const [currentCaregiver, setCurrentCaregiver] = useState('');
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [selectedHandoffTarget, setSelectedHandoffTarget] = useState<string>('');
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isCareNotesExpanded, setIsCareNotesExpanded] = useState(true);
  const [isEarlierExpanded, setIsEarlierExpanded] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState<number | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState<number | null>(null);
  const [taskText, setTaskText] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [isSavingTaskEdit, setIsSavingTaskEdit] = useState<string | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState<string | null>(null);
  const [isTogglingTask, setIsTogglingTask] = useState<string | null>(null);
  const [careeName, setCareeName] = useState<string>('Care recipient');
  const [showEditCareeNameModal, setShowEditCareeNameModal] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set()); // Track which days are expanded

  // Track the last date we checked to avoid unnecessary updates
  const lastCheckedDateRef = useRef<string>(getTodayDateKey());
  const careNotesRef = useRef<CareNote[]>(careNotes);
  const hasLoadedRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    careNotesRef.current = careNotes;
  }, [careNotes]);

  // Helper function to load state from adapter
  const loadState = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setIsInitialLoading(true);
      }
      const todayState = await dataAdapter.loadToday();
      setCareNotes(todayState.careNotes);
      setTasks(todayState.tasks);
      setCurrentCaregiver(todayState.currentCaregiver);
      setLastUpdatedBy(todayState.lastUpdatedBy);
      
      // Load caretakers from Firebase (authoritative source)
      const loadedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(loadedCaretakers);
      
      // Initialize handoff target to first available active caretaker
      const otherActiveCaretakers = loadedCaretakers.filter(c => 
        c.isActive && c.name !== todayState.currentCaregiver
      );
      if (otherActiveCaretakers.length > 0) {
        setSelectedHandoffTarget(otherActiveCaretakers[0].name);
      } else {
        setSelectedHandoffTarget('');
      }
      
      // Load notesByDate for history
      const allNotes = await dataAdapter.getNotesByDate();
      setNotesByDate(allNotes);
      
      // Load careeName from notebook metadata
      const notebookId = resolveNotebookId();
      if (notebookId) {
        const adapter = createFirebaseAdapter(notebookId);
        const metadata = await adapter.getNotebookMetadata();
        setCareeName(metadata.careeName);
      }
      
      // Initialize date ref
      lastCheckedDateRef.current = getTodayDateKey();
    } catch (error) {
      // Silently handle AbortError - request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        if (isInitial) {
          setIsInitialLoading(false);
        }
        return;
      }
      // Log other errors for debugging
      console.error('Error loading state:', error);
      // Ensure loading state is cleared even on error
      if (isInitial) {
        setIsInitialLoading(false);
      }
    } finally {
      if (isInitial) {
        setIsInitialLoading(false);
      }
    }
  }, [dataAdapter]);

  // Load initial state from adapter (only once on mount)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadState(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run once on mount

  // Expand the latest day in Earlier section by default
  useEffect(() => {
    const historyEntries = getHistoryEntries();
    if (historyEntries.length > 0 && expandedDays.size === 0) {
      // Expand the first (most recent) day
      setExpandedDays(new Set([historyEntries[0].dateKey]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notesByDate]);

  // Refresh state when page becomes visible again (e.g., navigating back from CareTeam)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadState();
      }
    };

    const handleFocus = () => {
      loadState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadState]);

  // Periodic refresh to catch changes from other users/devices (every 30 seconds)
  useEffect(() => {
    if (!hasLoadedRef.current) {
      return; // Don't start periodic refresh until initial load is complete
    }

    const interval = setInterval(() => {
      // Only refresh if page is visible
      if (document.visibilityState === 'visible') {
        loadState();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [loadState]);

  // Check for date change on mount and periodically
  useEffect(() => {
    const checkDate = async () => {
      try {
        const currentTodayKey = getTodayDateKey();
        const lastDateKey = lastCheckedDateRef.current;
        
        if (lastDateKey && lastDateKey !== currentTodayKey) {
          // Date changed - reload state from adapter
          const todayState = await dataAdapter.loadToday();
          setCareNotes(todayState.careNotes);
          setTasks(todayState.tasks);
          setCurrentCaregiver(todayState.currentCaregiver);
          setLastUpdatedBy(todayState.lastUpdatedBy);
          
          // Load caretakers from Firebase (authoritative source)
          const loadedCaretakers = await dataAdapter.getCaretakers();
          setCaretakers(loadedCaretakers);
          
          // Update handoff target to first available active caretaker
          const otherActiveCaretakers = loadedCaretakers.filter(c => 
            c.isActive && c.name !== todayState.currentCaregiver
          );
          if (otherActiveCaretakers.length > 0) {
            setSelectedHandoffTarget(otherActiveCaretakers[0].name);
          }
          
          // Reload notesByDate for history
          const allNotes = await dataAdapter.getNotesByDate();
          setNotesByDate(allNotes);
          
          lastCheckedDateRef.current = currentTodayKey;
        }
      } catch (error) {
        // Silently handle AbortError - request was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        // Other errors are handled by global error handler
      }
    };
    
    checkDate();
    // Check every minute for date changes
    const interval = setInterval(checkDate, 60000);
    return () => clearInterval(interval);
  }, []);

  // Format date key to show actual date (not "Today", "Yesterday", etc.)
  const formatDateWithDay = (dateKey: string): string => {
    const date = new Date(dateKey + 'T00:00:00');
    const today = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
    return `${dayName}, ${dateStr}`;
  };

  // Toggle day expansion
  const toggleDay = (dateKey: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  // Get care notes grouped by date
  const getCareNotesByDate = (): Array<{ dateKey: string; dateLabel: string; notes: CareNote[] }> => {
    const todayKey = getTodayDateKey();
    const entries: Array<{ dateKey: string; dateLabel: string; notes: CareNote[] }> = [];
    
    // Group care notes by matching them with notesByDate
    // Create a map to track which notes belong to which date
    const notesByDateKey: Record<string, CareNote[]> = {};
    
    // For each note in careNotes, find which dateKey it belongs to
    for (const note of careNotes) {
      let found = false;
      // Check each dateKey in notesByDate to find where this note exists
      for (const dateKey of Object.keys(notesByDate)) {
        const notesForDate = notesByDate[dateKey] || [];
        // Match note by time, author, and note text (since notes don't have IDs)
        const matchingNote = notesForDate.find(n => 
          n.time === note.time && 
          n.author === note.author && 
          n.note === note.note
        );
        if (matchingNote) {
          if (!notesByDateKey[dateKey]) {
            notesByDateKey[dateKey] = [];
          }
          notesByDateKey[dateKey].push(note);
          found = true;
          break;
        }
      }
      // If not found in notesByDate, assume it's from today
      if (!found) {
        if (!notesByDateKey[todayKey]) {
          notesByDateKey[todayKey] = [];
        }
        notesByDateKey[todayKey].push(note);
      }
    }
    
    // Convert to entries array, sorted by date (most recent first)
    const dateKeys = Object.keys(notesByDateKey)
      .filter(key => notesByDateKey[key] && notesByDateKey[key].length > 0)
      .sort((a, b) => b.localeCompare(a));
    
    for (const dateKey of dateKeys) {
      entries.push({
        dateKey,
        dateLabel: formatDateWithDay(dateKey),
        notes: notesByDateKey[dateKey]
      });
    }
    
    return entries;
  };

  // Get history entries (last 3 days, excluding today)
  const getHistoryEntries = (): Array<{ dateKey: string; dateLabel: string; notes: CareNote[] }> => {
    const todayKey = getTodayDateKey();
    const entries: Array<{ dateKey: string; dateLabel: string; notes: CareNote[] }> = [];
    
    // Get all date keys except today, sorted descending
    const dateKeys = Object.keys(notesByDate)
      .filter(key => key !== todayKey && notesByDate[key] && notesByDate[key].length > 0)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 3); // Limit to 3 most recent days
    
    for (const dateKey of dateKeys) {
      entries.push({
        dateKey,
        dateLabel: formatDateWithDay(dateKey),
        notes: notesByDate[dateKey]
      });
    }
    
    return entries;
  };

  const handleAddNote = async () => {
    if (noteText.trim() && !isAddingNote) {
      try {
        setIsAddingNote(true);
        // Use adapter to add note
        const newNote = await dataAdapter.addNote(noteText.trim());
        
        // Update UI state
        setCareNotes([newNote, ...careNotes]);
        setNoteText('');
        
        // Reload notesByDate to keep history in sync
        const allNotes = await dataAdapter.getNotesByDate();
        setNotesByDate(allNotes);
      } catch (error) {
        // Silently handle AbortError - request was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        // Show error message to user
        let errorMessage = 'Failed to add comment. Please try again.';
        if (error instanceof Error) {
          // Check for quota/resource-exhausted errors
          if (error.message.includes('quota') || error.message.includes('resource-exhausted') || 
              (error as any)?.code === 'resource-exhausted') {
            errorMessage = 'Unable to add comment: Firebase quota exceeded. Please try again later or contact support.';
          } else {
            errorMessage = error.message || errorMessage;
          }
        }
        alert(errorMessage);
      } finally {
        setIsAddingNote(false);
      }
    }
  };

  const handleHandoff = async () => {
    // Use selected target caregiver, or first available active caretaker
    const otherActiveCaretakers = caretakers.filter(c => 
      c.isActive && c.name !== currentCaregiver
    );
    
    if (otherActiveCaretakers.length === 0 || isHandingOff) {
      // No other active caretakers available - cannot handoff
      return;
    }
    
    let targetCaregiver: string;
    if (selectedHandoffTarget && otherActiveCaretakers.some(c => c.name === selectedHandoffTarget)) {
      targetCaregiver = selectedHandoffTarget;
    } else {
      targetCaregiver = otherActiveCaretakers[0].name;
    }
    
    try {
      setIsHandingOff(true);
      await dataAdapter.handoff(targetCaregiver);
      
      // Reload state from adapter
      const todayState = await dataAdapter.loadToday();
      setCareNotes(todayState.careNotes);
      setTasks(todayState.tasks);
      setCurrentCaregiver(todayState.currentCaregiver);
      setLastUpdatedBy(todayState.lastUpdatedBy);
      
      // Load caretakers from Firebase (authoritative source)
      const updatedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(updatedCaretakers);
      
      // Update handoff target to first available active caretaker after handoff
      const newOtherActiveCaretakers = updatedCaretakers.filter(c => 
        c.isActive && c.name !== todayState.currentCaregiver
      );
      if (newOtherActiveCaretakers.length > 0) {
        setSelectedHandoffTarget(newOtherActiveCaretakers[0].name);
      }
      
      // Reload notesByDate for history
      const allNotes = await dataAdapter.getNotesByDate();
      setNotesByDate(allNotes);
    } catch (error) {
      // Silently handle AbortError - request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // Other errors are handled by global error handler
    } finally {
      setIsHandingOff(false);
    }
  };


  const handleStartEdit = (noteIndex: number) => {
    // Clear any previous saving state to ensure clean edit mode
    setIsSavingEdit(null);
    setEditingNoteIndex(noteIndex);
    setEditingNoteText(careNotes[noteIndex].note);
  };

  const handleCancelEdit = () => {
    setEditingNoteIndex(null);
    setEditingNoteText('');
  };

  const handleSaveEdit = async (noteIndex: number) => {
    if (editingNoteText.trim() && isSavingEdit !== noteIndex) {
      try {
        setIsSavingEdit(noteIndex);
        // Use adapter to update note
        const updatedNote = await dataAdapter.updateNote(noteIndex, editingNoteText.trim());
        
        // Update UI state
        const updatedNotes = [...careNotes];
        updatedNotes[noteIndex] = updatedNote;
        setCareNotes(updatedNotes);
        
        // Reload notesByDate to keep history in sync
        const allNotes = await dataAdapter.getNotesByDate();
        setNotesByDate(allNotes);
        
        // Clear saving state first, then reset editing state
        setIsSavingEdit(null);
        // Reset editing state
        setEditingNoteIndex(null);
        setEditingNoteText('');
      } catch (error) {
        // Silently handle AbortError - request was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          setIsSavingEdit(null);
          return;
        }
        // Show error message to user
        let errorMessage = 'Failed to save comment. Please try again.';
        if (error instanceof Error) {
          // Check for quota/resource-exhausted errors
          if (error.message.includes('quota') || error.message.includes('resource-exhausted') || 
              (error as any)?.code === 'resource-exhausted') {
            errorMessage = 'Unable to save comment: Firebase quota exceeded. Please try again later or contact support.';
          } else {
            errorMessage = error.message || errorMessage;
          }
        }
        alert(errorMessage);
        // Clear saving state on error
        setIsSavingEdit(null);
      }
    }
  };

  const handleDeleteNote = async (noteIndex: number) => {
    if (isDeletingNote !== noteIndex) {
      try {
        setIsDeletingNote(noteIndex);
        // Use adapter to delete note
        await dataAdapter.deleteNote(noteIndex);
        
        // Update UI state - remove the note
        const updatedNotes = careNotes.filter((_, index) => index !== noteIndex);
        setCareNotes(updatedNotes);
        
        // Reload notesByDate to keep history in sync
        const allNotes = await dataAdapter.getNotesByDate();
        setNotesByDate(allNotes);
      } catch (error) {
        // Silently handle AbortError - request was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        // Other errors are handled by global error handler
      } finally {
        setIsDeletingNote(null);
      }
    }
  };

  const handleAddTask = async () => {
    if (taskText.trim() && !isAddingTask) {
      try {
        setIsAddingTask(true);
        // Use adapter to add task
        const newTask = await dataAdapter.addTask(taskText.trim());
        
        // Update UI state
        setTasks([newTask, ...tasks]);
        setTaskText('');
      } catch (error) {
        // Silently handle AbortError - request was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        // Show error message to user
        let errorMessage = 'Failed to add task. Please try again.';
        if (error instanceof Error) {
          // Check for quota/resource-exhausted errors
          if (error.message.includes('quota') || error.message.includes('resource-exhausted') || 
              (error as any)?.code === 'resource-exhausted') {
            errorMessage = 'Unable to add task: Firebase quota exceeded. Please try again later or contact support.';
          } else {
            errorMessage = error.message || errorMessage;
          }
        }
        alert(errorMessage);
      } finally {
        setIsAddingTask(false);
      }
    }
  };

  const handleStartEditTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setEditingTaskId(taskId);
      setEditingTaskText(task.text);
    }
  };

  const handleCancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTaskText('');
  };

  const handleSaveTaskEdit = async (taskId: string) => {
    if (editingTaskText.trim() && isSavingTaskEdit !== taskId) {
      try {
        setIsSavingTaskEdit(taskId);
        // Use adapter to update task
        const updatedTask = await dataAdapter.updateTask(taskId, editingTaskText.trim());
        
        // Update UI state
        setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
        
        // Clear editing state
        setIsSavingTaskEdit(null);
        setEditingTaskId(null);
        setEditingTaskText('');
      } catch (error) {
        // Silently handle AbortError - request was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          setIsSavingTaskEdit(null);
          return;
        }
        // Show error message to user
        let errorMessage = 'Failed to save task. Please try again.';
        if (error instanceof Error) {
          // Check for quota/resource-exhausted errors
          if (error.message.includes('quota') || error.message.includes('resource-exhausted') || 
              (error as any)?.code === 'resource-exhausted') {
            errorMessage = 'Unable to save task: Firebase quota exceeded. Please try again later or contact support.';
          } else {
            errorMessage = error.message || errorMessage;
          }
        }
        alert(errorMessage);
        // Clear saving state on error
        setIsSavingTaskEdit(null);
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (isDeletingTask !== taskId) {
      try {
        setIsDeletingTask(taskId);
        // Use adapter to delete task
        await dataAdapter.deleteTask(taskId);
        
        // Update UI state - remove the task
        setTasks(tasks.filter(t => t.id !== taskId));
      } catch (error) {
        // Silently handle AbortError - request was cancelled
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        // Other errors are handled by global error handler
      } finally {
        setIsDeletingTask(null);
      }
    }
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="px-6 py-8 max-w-2xl mx-auto">
        {isInitialLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
        <h1 className="text-3xl md:text-4xl font-normal mb-8 leading-tight" style={{ color: 'var(--text-primary)' }}>
          Today
        </h1>

        <header className="mb-8 pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-lg font-normal mb-2 inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <FontAwesomeIcon icon={Icons.notebook} className="mr-2 opacity-75" style={{ fontSize: '0.95em' }} aria-hidden="true" />
            <span>Today — {careeName}</span>
            <button
              type="button"
              onClick={() => setShowEditCareeNameModal(true)}
              className="p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
              style={{
                color: 'var(--text-secondary)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              aria-label="Edit care recipient name"
              title="Edit care recipient name"
            >
              <FontAwesomeIcon 
                icon={Icons.quickNote} 
                style={{ fontSize: '0.75em' }} 
                aria-hidden="true" 
              />
            </button>
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Current caregiver: <span className="font-medium" style={{ color: 'var(--text-secondary)' }} aria-label={`Current caregiver is ${currentCaregiver}`}>{currentCaregiver}</span>
          </p>
        </header>

        {/* First-Time Context */}
        {careNotes.length === 0 && tasks.length === 0 && (
          <section className="mb-8">
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This is today's shared care notebook. Add notes as things happen, and they'll be here for everyone helping care for {careeName}.
            </p>
          </section>
        )}

        {/* Quick Note Section */}
        <section className="mb-12" aria-labelledby="quick-note-heading">
          <h2 id="quick-note-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
            <FontAwesomeIcon icon={Icons.quickNote} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            Quick note
          </h2>
          <form 
            className="space-y-3" 
            onSubmit={(e) => {
              e.preventDefault();
              handleAddNote();
            }}
            aria-label="Add a care note"
          >
            <label htmlFor="note-textarea" className="sr-only">
              Note text
            </label>
            <textarea
              id="note-textarea"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about care, symptoms, or anything that feels important…"
              className="w-full px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent resize-y min-h-[100px] leading-relaxed"
              style={{ 
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              rows={4}
              aria-label="Add a note about care, symptoms, or anything that feels important"
              aria-required="false"
            />
            <button
              type="submit"
              disabled={isAddingNote}
              className="w-full sm:w-auto px-6 py-3 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              style={{ 
                color: 'var(--button-secondary-text)',
                backgroundColor: 'var(--button-secondary-bg)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (!isAddingNote) {
                  e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
              }}
              aria-label="Add note to care notebook"
            >
              {isAddingNote && <InlineSpinner size="sm" />}
              Add note
            </button>
          </form>
        </section>

        {/* Care Notes Section - Collapsible */}
        <section className="mb-6" aria-labelledby="care-notes-heading">
          <button
            type="button"
            onClick={() => setIsCareNotesExpanded(!isCareNotesExpanded)}
            className="w-full flex items-center justify-between text-left mb-2 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg px-2 py-1 -ml-2 hover:opacity-80 transition-opacity"
            style={{ 
              '--tw-ring-color': 'var(--focus-ring)',
            } as React.CSSProperties}
            aria-expanded={isCareNotesExpanded}
            aria-controls="care-notes-content"
          >
            <h2 id="care-notes-heading" className="text-lg font-normal inline-flex items-center" style={{ color: 'var(--text-secondary)' }}>
              <FontAwesomeIcon icon={Icons.careNotes} className="mr-2 opacity-60" style={{ fontSize: '0.85em' }} aria-hidden="true" />
              Care Notes
              {careNotes.length > 0 && (
                <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                  ({careNotes.length})
                </span>
              )}
            </h2>
            <FontAwesomeIcon 
              icon={isCareNotesExpanded ? Icons.chevronUp : Icons.chevronDown} 
              className="opacity-50" 
              style={{ fontSize: '0.75em', color: 'var(--text-secondary)' }} 
              aria-hidden="true" 
            />
          </button>
          <div id="care-notes-content" className={isCareNotesExpanded ? '' : 'hidden'}>
          {careNotes.length === 0 ? (
            <div className="py-6" role="status" aria-live="polite">
              <p className="text-base mb-2" style={{ color: 'var(--text-secondary)' }}>
                No notes yet today
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                When you add a note, it will appear here for everyone caring for {careeName}.
              </p>
            </div>
          ) : (
            <div className="space-y-6" role="list" aria-label="Care notes">
              {getCareNotesByDate().map((entry) => {
                // Calculate the starting index for notes in this group
                let globalIndexOffset = 0;
                const allGrouped = getCareNotesByDate();
                for (const group of allGrouped) {
                  if (group.dateKey === entry.dateKey) break;
                  globalIndexOffset += group.notes.length;
                }
                
                return (
                  <div key={entry.dateKey}>
                    <h3 className="text-base font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                      {entry.dateLabel}
                    </h3>
                    {entry.notes.length === 0 ? (
                      <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>
                        No notes for this day.
                      </p>
                    ) : (
                      <div className="space-y-4">
                      {entry.notes.map((note, localIndex) => {
                        const index = globalIndexOffset + localIndex;
                        // Parse time string (e.g., "8:30 AM" or "2:00 PM") to datetime
                        const parseTime = (timeStr: string, dateKey: string): string => {
                          try {
                            const [timePart, ampm] = timeStr.split(' ');
                            const [hours, minutes] = timePart.split(':');
                            let hour24 = parseInt(hours, 10);
                            if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
                            if (ampm === 'AM' && hour24 === 12) hour24 = 0;
                            const noteDate = new Date(dateKey + 'T00:00:00');
                            noteDate.setHours(hour24, parseInt(minutes, 10));
                            return noteDate.toISOString();
                          } catch {
                            return '';
                          }
                        };
                        const isoTime = parseTime(note.time, entry.dateKey);
                        const isEditing = editingNoteIndex === index;
                        const canEdit = canEditNote(note, currentCaregiver);
                        const canDelete = canDeleteNote(note, currentCaregiver);
                
                        return (
                          <article key={index} className="border-b pb-4 last:border-b-0" style={{ borderColor: 'var(--border-color)' }} role="listitem">
                            <div className="flex items-start gap-3">
                              <time 
                                className="text-sm font-medium whitespace-nowrap" 
                                style={{ color: 'var(--text-muted)' }}
                                dateTime={isoTime || undefined}
                                aria-label={`Note added at ${note.time} on ${entry.dateLabel}`}
                              >
                                <FontAwesomeIcon icon={Icons.time} className="mr-1 opacity-60" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                                {note.time}
                              </time>
                      <div className="flex-1">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              className="w-full px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent resize-y min-h-[100px] leading-relaxed"
                              style={{ 
                                color: 'var(--text-primary)',
                                backgroundColor: 'var(--bg-primary)',
                                borderColor: 'var(--border-color)',
                                '--tw-ring-color': 'var(--focus-ring)',
                              } as React.CSSProperties}
                              rows={4}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(index)}
                                disabled={isSavingEdit === index}
                                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                                style={{ 
                                  color: 'var(--button-secondary-text)',
                                  backgroundColor: 'var(--button-secondary-bg)',
                                  '--tw-ring-color': 'var(--focus-ring)',
                                } as React.CSSProperties}
                                onMouseEnter={(e) => {
                                  if (isSavingEdit !== index) {
                                    e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
                                }}
                                aria-label="Save edited note"
                              >
                                {isSavingEdit === index && <InlineSpinner size="sm" />}
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
                                style={{ 
                                  color: 'var(--text-secondary)',
                                  backgroundColor: 'transparent',
                                  '--tw-ring-color': 'var(--focus-ring)',
                                } as React.CSSProperties}
                                aria-label="Cancel editing"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-base leading-relaxed flex-1" style={{ 
                                color: note.author === 'System' ? 'var(--text-muted)' : 'var(--text-primary)',
                                fontStyle: note.author === 'System' ? 'italic' : 'normal'
                              }}>
                                {note.note}
                              </p>
                              <div className="flex gap-2 flex-shrink-0">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(index)}
                                    className="text-sm px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
                                    style={{ 
                                      color: 'var(--text-secondary)',
                                      backgroundColor: 'transparent',
                                      '--tw-ring-color': 'var(--focus-ring)',
                                    } as React.CSSProperties}
                                    aria-label="Edit note"
                                  >
                                    Edit
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteNote(index)}
                                    disabled={isDeletingNote === index}
                                    className="text-sm px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                    style={{ 
                                      color: 'var(--text-secondary)',
                                      backgroundColor: 'transparent',
                                      '--tw-ring-color': 'var(--focus-ring)',
                                    } as React.CSSProperties}
                                    aria-label="Delete note"
                                  >
                                    {isDeletingNote === index ? (
                                      <>
                                        <InlineSpinner size="sm" />
                                        <span className="sr-only">Deleting...</span>
                                      </>
                                    ) : (
                                      'Delete'
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-xs mt-1.5" style={{ color: 'var(--text-light)' }} aria-label={`Noted by ${note.author}`}>
                              — {note.author}
                              {note.editedAt && (() => {
                                try {
                                  const editDate = new Date(note.editedAt);
                                  const today = new Date();
                                  
                                  // Always show date and time
                                  const editDateStr = editDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: editDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
                                  });
                                  const editTime = editDate.toLocaleTimeString('en-US', { 
                                    hour: 'numeric', 
                                    minute: '2-digit',
                                    hour12: true 
                                  });
                                  const editDisplay = `${editDateStr} at ${editTime}`;
                                  const ariaLabel = `Note was edited on ${editDateStr} at ${editTime}`;
                                  
                                  return (
                                    <span className="ml-2" style={{ color: 'var(--text-muted)' }} aria-label={ariaLabel}>
                                      (edited at {editDisplay})
                                    </span>
                                  );
                                } catch {
                                  return (
                                    <span className="ml-2" style={{ color: 'var(--text-muted)' }} aria-label="Note was edited">
                                      (edited)
                                    </span>
                                  );
                                }
                              })()}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                        </article>
                      );
                      })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </section>

        {/* What matters next Section */}
        <section className="mb-12" aria-labelledby="tasks-heading">
          <h2 id="tasks-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
            <FontAwesomeIcon icon={Icons.tasks} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            What matters next
          </h2>
          
          {/* Add Task Form */}
          <form 
            className="mb-6 space-y-3" 
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTask();
            }}
            aria-label="Add a task"
          >
            <label htmlFor="task-input" className="sr-only">
              Task text
            </label>
            <div className="flex gap-2">
              <input
                id="task-input"
                type="text"
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                placeholder="Add a task or reminder…"
                className="flex-1 px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ 
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                  '--tw-ring-color': 'var(--focus-ring)',
                } as React.CSSProperties}
                aria-label="Add a task or reminder"
              />
              <button
                type="submit"
                disabled={isAddingTask || !taskText.trim()}
                className="px-6 py-3 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                style={{ 
                  color: 'var(--button-secondary-text)',
                  backgroundColor: 'var(--button-secondary-bg)',
                  '--tw-ring-color': 'var(--focus-ring)',
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  if (!isAddingTask && taskText.trim()) {
                    e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
                }}
                aria-label="Add task"
              >
                {isAddingTask && <InlineSpinner size="sm" />}
                Add
              </button>
            </div>
          </form>

          {(() => {
            const incompleteTasks = tasks.filter(t => !t.completed);
            const completedTasks = tasks.filter(t => t.completed);

            const renderTaskItem = (task: Task) => {
              const isEditing = editingTaskId === task.id;
              return (
                <li key={task.id} className="flex items-start gap-3" role="listitem">
                  <div className="relative mt-1">
                    <input
                      type="checkbox"
                      id={task.id}
                      checked={task.completed}
                      onChange={async () => {
                        if (isTogglingTask === task.id) return; // Prevent double-clicks
                        const taskId = task.id; // Capture task ID before async operations
                        try {
                          setIsTogglingTask(taskId);
                          await dataAdapter.toggleTask(taskId);
                          // Reload state to ensure we have the latest from Firestore
                          const todayState = await dataAdapter.loadToday();
                          setTasks(todayState.tasks);
                          // Clear loading state after a brief delay to ensure React has processed the update
                          setTimeout(() => {
                            setIsTogglingTask(null);
                          }, 100);
                        } catch (error) {
                          // Silently handle AbortError - request was cancelled
                          if (error instanceof Error && error.name === 'AbortError') {
                            setIsTogglingTask(null);
                            return;
                          }
                          // On error, reload state to revert optimistic update
                          const todayState = await dataAdapter.loadToday();
                          setTasks(todayState.tasks);
                          // Clear loading state after error handling
                          setTimeout(() => {
                            setIsTogglingTask(null);
                          }, 100);
                        }
                      }}
                      className="w-5 h-5 rounded focus:ring-2 focus:ring-offset-2 cursor-pointer"
                      style={{ 
                        accentColor: 'var(--text-primary)',
                        borderColor: 'var(--border-color)',
                        '--tw-ring-color': 'var(--text-primary)',
                        opacity: isTogglingTask === task.id ? 0.5 : 1,
                      } as React.CSSProperties}
                      aria-label={`${task.text}, ${task.completed ? 'completed' : 'not completed'}`}
                      aria-checked={task.completed}
                      disabled={isEditing || isTogglingTask === task.id}
                    />
                    {isTogglingTask === task.id && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <InlineSpinner size="sm" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingTaskText}
                          onChange={(e) => setEditingTaskText(e.target.value)}
                          className="w-full px-4 py-2 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent"
                          style={{ 
                            color: 'var(--text-primary)',
                            backgroundColor: 'var(--bg-primary)',
                            borderColor: 'var(--border-color)',
                            '--tw-ring-color': 'var(--focus-ring)',
                          } as React.CSSProperties}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveTaskEdit(task.id)}
                            disabled={isSavingTaskEdit === task.id}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            style={{ 
                              color: 'var(--button-secondary-text)',
                              backgroundColor: 'var(--button-secondary-bg)',
                              '--tw-ring-color': 'var(--focus-ring)',
                            } as React.CSSProperties}
                            onMouseEnter={(e) => {
                              if (isSavingTaskEdit !== task.id) {
                                e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
                            }}
                            aria-label="Save edited task"
                          >
                            {isSavingTaskEdit === task.id && <InlineSpinner size="sm" />}
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditTask}
                            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
                            style={{ 
                              color: 'var(--text-secondary)',
                              backgroundColor: 'transparent',
                              '--tw-ring-color': 'var(--focus-ring)',
                            } as React.CSSProperties}
                            aria-label="Cancel editing"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <label
                          htmlFor={task.id}
                          className="text-base leading-relaxed flex-1 cursor-pointer"
                          style={{ 
                            color: task.completed ? 'var(--text-light)' : 'var(--text-primary)',
                            textDecoration: task.completed ? 'line-through' : 'none'
                          }}
                        >
                          {task.text}
                        </label>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditTask(task.id)}
                            className="text-sm px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
                            style={{ 
                              color: 'var(--text-secondary)',
                              backgroundColor: 'transparent',
                              '--tw-ring-color': 'var(--focus-ring)',
                            } as React.CSSProperties}
                            aria-label="Edit task"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={isDeletingTask === task.id}
                            className="text-sm px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                            style={{ 
                              color: 'var(--text-secondary)',
                              backgroundColor: 'transparent',
                              '--tw-ring-color': 'var(--focus-ring)',
                            } as React.CSSProperties}
                            aria-label="Delete task"
                          >
                            {isDeletingTask === task.id ? (
                              <>
                                <InlineSpinner size="sm" />
                                <span className="sr-only">Deleting...</span>
                              </>
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            };

            return (
              <>
                {/* Incomplete Tasks Section */}
                {incompleteTasks.length > 0 ? (
                  <div className="mb-8">
                    <h3 className="text-lg font-normal mb-3" style={{ color: 'var(--text-secondary)' }}>
                      To do
                    </h3>
                    <ul className="space-y-3" role="list" aria-label="Tasks to do">
                      {incompleteTasks.map(renderTaskItem)}
                    </ul>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="py-2" role="status">
                    <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                      No upcoming tasks added yet.
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      Use the form above to add reminders for follow-up care, medications, appointments, or anything that needs to happen next.
                    </p>
                  </div>
                ) : null}

                {/* Completed Tasks Section */}
                {completedTasks.length > 0 && (
                  <div className="border-t pt-6" style={{ borderColor: 'var(--border-color)' }}>
                    <h3 className="text-lg font-normal mb-3" style={{ color: 'var(--text-secondary)' }}>
                      Complete
                    </h3>
                    <ul className="space-y-3" role="list" aria-label="Completed tasks">
                      {completedTasks.map(renderTaskItem)}
                    </ul>
                  </div>
                )}
              </>
            );
          })()}
        </section>

        {/* Handoff Section */}
        <section className="border-t pt-8 mt-10" style={{ borderColor: 'var(--border-color)' }} aria-labelledby="handoff-heading">
          <h2 id="handoff-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
            <FontAwesomeIcon icon={Icons.handoff} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            Handoff
          </h2>
          {caretakers.length === 0 ? (
            <div className="space-y-3 text-base" style={{ color: 'var(--text-secondary)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No caregivers have been added yet. Go to Care Team to add the people helping care for {careeName}.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-base" style={{ color: 'var(--text-secondary)' }}>
              {(() => {
                // Detect empty handoff state
                const hasHandoff = Boolean(lastUpdatedBy && lastUpdatedBy !== 'nobody yet' && lastUpdatedBy !== '');
                
                if (!hasHandoff) {
                  // Empty handoff state - show neutral message
                  return (
                    <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                      No handoff has occurred yet.
                    </p>
                  );
                } else {
                  // Handoff exists - show last updated by
                  return (
                    <p>
                      Last updated by: <span className="font-medium" style={{ color: 'var(--text-primary)' }} aria-label={`Last updated by ${lastUpdatedBy}`}>{lastUpdatedBy}</span>
                    </p>
                  );
                }
              })()}
              <p>
                Current caregiver: <span className="font-medium" style={{ color: 'var(--text-primary)' }} aria-label={`Current caregiver is ${currentCaregiver || 'not set'}`}>{currentCaregiver || 'not set'}</span>
              </p>
              {(() => {
                // Get available active caretakers for handoff (exclude current)
                const otherActiveCaretakers = caretakers.filter(c => 
                  c.isActive && c.name !== currentCaregiver
                );
                
                if (otherActiveCaretakers.length === 0) {
                  // No other active caretakers available - disable handoff
                  return (
                    <div className="mt-4">
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No other active caretakers available for handoff.
                      </p>
                    </div>
                  );
                }
              
              if (otherActiveCaretakers.length === 1) {
                // Single option: show button
                const targetCaregiver = otherActiveCaretakers[0].name;
                return (
                  <button
                    type="button"
                    onClick={handleHandoff}
                    disabled={isHandingOff}
                    className="mt-4 px-6 py-3 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    style={{ 
                      color: 'var(--button-secondary-text)',
                      backgroundColor: 'var(--button-secondary-bg)',
                      '--tw-ring-color': 'var(--focus-ring)',
                    } as React.CSSProperties}
                    onMouseEnter={(e) => {
                      if (!isHandingOff) {
                        e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
                    }}
                    aria-label={`Hand off care to ${targetCaregiver}`}
                  >
                    {isHandingOff ? (
                      <InlineSpinner size="sm" />
                    ) : (
                      <FontAwesomeIcon icon={Icons.handoff} className="opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                    )}
                    Hand off care to {targetCaregiver}
                  </button>
                );
              }
              
              // Multiple options: show dropdown
              return (
                <div className="mt-4 space-y-3">
                  <label htmlFor="handoff-select" className="block text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Hand off care to:
                  </label>
                  <div className="flex gap-2">
                    <select
                      id="handoff-select"
                      value={selectedHandoffTarget}
                      onChange={(e) => setSelectedHandoffTarget(e.target.value)}
                      className="flex-1 px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent"
                      style={{ 
                        color: 'var(--text-primary)',
                        backgroundColor: 'var(--bg-primary)',
                        borderColor: 'var(--border-color)',
                        '--tw-ring-color': 'var(--focus-ring)',
                      } as React.CSSProperties}
                      aria-label="Select caregiver to hand off care to"
                    >
                      {otherActiveCaretakers.map((caretaker) => (
                        <option key={caretaker.id} value={caretaker.name}>
                          {caretaker.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleHandoff}
                      disabled={isHandingOff}
                      className="px-6 py-3 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      style={{ 
                        color: 'var(--button-secondary-text)',
                        backgroundColor: 'var(--button-secondary-bg)',
                        '--tw-ring-color': 'var(--focus-ring)',
                      } as React.CSSProperties}
                      onMouseEnter={(e) => {
                        if (!isHandingOff) {
                          e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
                      }}
                      aria-label={`Hand off care to ${selectedHandoffTarget}`}
                    >
                      {isHandingOff ? (
                        <InlineSpinner size="sm" />
                      ) : (
                        <FontAwesomeIcon icon={Icons.handoff} className="opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                      )}
                      Hand off
                    </button>
                  </div>
                </div>
              );
              })()}
            </div>
          )}
        </section>

        {/* Earlier Section - Collapsible */}
        {(() => {
          const historyEntries = getHistoryEntries();
          if (historyEntries.length === 0) return null;
          
          return (
            <section className="border-t pt-6 mt-6" style={{ borderColor: 'var(--border-color)' }} aria-labelledby="earlier-heading">
              <button
                type="button"
                onClick={() => setIsEarlierExpanded(!isEarlierExpanded)}
                className="w-full flex items-center justify-between text-left mb-2 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg px-2 py-1 -ml-2 hover:opacity-80 transition-opacity"
                style={{ 
                  '--tw-ring-color': 'var(--focus-ring)',
                } as React.CSSProperties}
                aria-expanded={isEarlierExpanded}
                aria-controls="earlier-content"
              >
                <h2 id="earlier-heading" className="text-lg font-normal inline-flex items-center" style={{ color: 'var(--text-secondary)' }}>
                  <FontAwesomeIcon icon={Icons.careNotes} className="mr-2 opacity-60" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                  Earlier
                </h2>
                <FontAwesomeIcon 
                  icon={isEarlierExpanded ? Icons.chevronUp : Icons.chevronDown} 
                  className="opacity-50" 
                  style={{ fontSize: '0.75em', color: 'var(--text-secondary)' }} 
                  aria-hidden="true" 
                />
              </button>
              <div id="earlier-content" className={isEarlierExpanded ? '' : 'hidden'}>
              {historyEntries.length > 0 && (
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  Click on any day to expand or collapse its notes.
                </p>
              )}
              <div className="space-y-6" role="list" aria-label="Earlier care notes">
                {historyEntries.map((entry) => {
                  const isDayExpanded = expandedDays.has(entry.dateKey);
                  
                  return (
                    <div key={entry.dateKey} role="listitem">
                      <button
                        type="button"
                        onClick={() => toggleDay(entry.dateKey)}
                        className="w-full flex items-center justify-between text-left mb-3 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg px-2 py-1 -ml-2 hover:opacity-80 transition-opacity"
                        style={{ 
                          '--tw-ring-color': 'var(--focus-ring)',
                        } as React.CSSProperties}
                        aria-expanded={isDayExpanded}
                        aria-controls={`earlier-day-${entry.dateKey}`}
                      >
                        <h3 className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {entry.dateLabel}
                        </h3>
                        <FontAwesomeIcon 
                          icon={isDayExpanded ? Icons.chevronUp : Icons.chevronDown} 
                          className="opacity-50" 
                          style={{ fontSize: '0.75em', color: 'var(--text-secondary)' }} 
                          aria-hidden="true" 
                        />
                      </button>
                      {entry.notes.length === 0 ? (
                        <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>
                          No notes for this day.
                        </p>
                      ) : (
                        <ul 
                          id={`earlier-day-${entry.dateKey}`}
                          className={isDayExpanded ? 'space-y-2' : 'hidden'} 
                          role="list" 
                          aria-label={`Care notes for ${entry.dateLabel}`}
                        >
                        {entry.notes.map((note, index) => {
                        const noteWithAuthor = {
                          ...note,
                          author: note.author || 'Unknown'
                        };
                        // Parse time string (e.g., "8:30 AM" or "2:00 PM") to datetime
                        const parseTime = (timeStr: string, dateKey: string): string => {
                          try {
                            const [timePart, ampm] = timeStr.split(' ');
                            const [hours, minutes] = timePart.split(':');
                            let hour24 = parseInt(hours, 10);
                            if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
                            if (ampm === 'AM' && hour24 === 12) hour24 = 0;
                            const noteDate = new Date(dateKey + 'T00:00:00');
                            noteDate.setHours(hour24, parseInt(minutes, 10));
                            return noteDate.toISOString();
                          } catch {
                            return '';
                          }
                        };
                        const isoTime = parseTime(noteWithAuthor.time, entry.dateKey);
                        
                        return (
                          <li key={index} className="flex items-start gap-3" role="listitem">
                            <time 
                              className="text-sm font-medium whitespace-nowrap" 
                              style={{ color: 'var(--text-muted)' }}
                              dateTime={isoTime || undefined}
                              aria-label={`Note added at ${noteWithAuthor.time} on ${entry.dateLabel}`}
                            >
                              <FontAwesomeIcon icon={Icons.time} className="mr-1 opacity-60" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                              {noteWithAuthor.time}
                            </time>
                            <div className="flex-1">
                              <p className="text-sm leading-relaxed flex-1" style={{ 
                                color: noteWithAuthor.author === 'System' ? 'var(--text-light)' : 'var(--text-secondary)',
                                fontStyle: noteWithAuthor.author === 'System' ? 'italic' : 'normal'
                              }}>
                                {noteWithAuthor.note}
                              </p>
                              <p className="text-xs mt-1" style={{ color: 'var(--text-light)' }} aria-label={`Noted by ${noteWithAuthor.author}`}>
                                — {noteWithAuthor.author}
                                {noteWithAuthor.editedAt && (() => {
                                  try {
                                    const editDate = new Date(noteWithAuthor.editedAt);
                                    const today = new Date();
                                    
                                    // Always show date and time
                                    const editDateStr = editDate.toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: editDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
                                    });
                                    const editTime = editDate.toLocaleTimeString('en-US', { 
                                      hour: 'numeric', 
                                      minute: '2-digit',
                                      hour12: true 
                                    });
                                    const editDisplay = `${editDateStr} at ${editTime}`;
                                    const ariaLabel = `Note was edited on ${editDateStr} at ${editTime}`;
                                    
                                    return (
                                      <span className="ml-2" style={{ color: 'var(--text-muted)' }} aria-label={ariaLabel}>
                                        (edited at {editDisplay})
                                      </span>
                                    );
                                  } catch {
                                    return (
                                      <span className="ml-2" style={{ color: 'var(--text-muted)' }} aria-label="Note was edited">
                                        (edited)
                                      </span>
                                    );
                                  }
                                })()}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            </section>
          );
        })()}
          </>
        )}
      </div>
      <CareeNameModal
        isOpen={showEditCareeNameModal}
        onClose={() => setShowEditCareeNameModal(false)}
        onSubmit={async (newCareeName: string) => {
          try {
            const notebookId = resolveNotebookId();
            if (notebookId) {
              const adapter = createFirebaseAdapter(notebookId);
              await adapter.updateNotebookMetadata(newCareeName);
              setCareeName(newCareeName);
              setShowEditCareeNameModal(false);
            }
          } catch (error) {
            // Silently handle errors
            if (error instanceof Error && error.name === 'AbortError') {
              return;
            }
          }
        }}
        initialValue={careeName}
        title="Update care recipient name"
        submitLabel="Update"
      />
    </main>
  );
}

export default Today;
