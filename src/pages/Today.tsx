import { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { todayData } from '../mock/todayData';
import type { CareNote, NotesByDate } from '../domain/types';
import { getTodayDateKey, formatDateLabel } from '../domain/notebook';
import { dataAdapter } from '../storage';
import { Icons } from '../ui/icons';

function Today() {
  const [notesByDate, setNotesByDate] = useState<NotesByDate>({});
  const [careNotes, setCareNotes] = useState<CareNote[]>([]);
  const [noteText, setNoteText] = useState('');
  const [lastUpdatedBy, setLastUpdatedBy] = useState(todayData.lastUpdatedBy);
  const [currentCaregiver, setCurrentCaregiver] = useState(todayData.currentCaregiver);

  // Track the last date we checked to avoid unnecessary updates
  const lastCheckedDateRef = useRef<string>(getTodayDateKey());
  const careNotesRef = useRef<CareNote[]>(careNotes);

  // Keep ref in sync with state
  useEffect(() => {
    careNotesRef.current = careNotes;
  }, [careNotes]);

  // Load initial state from adapter
  useEffect(() => {
    const loadState = async () => {
      const todayState = await dataAdapter.loadToday();
      setCareNotes(todayState.careNotes);
      setCurrentCaregiver(todayState.currentCaregiver);
      setLastUpdatedBy(todayState.lastUpdatedBy);
      
      // Load notesByDate for history
      const allNotes = await dataAdapter.getNotesByDate();
      setNotesByDate(allNotes);
      
      // Initialize date ref
      lastCheckedDateRef.current = getTodayDateKey();
    };
    loadState();
  }, []);

  // Check for date change on mount and periodically
  useEffect(() => {
    const checkDate = async () => {
      const currentTodayKey = getTodayDateKey();
      const lastDateKey = lastCheckedDateRef.current;
      
      if (lastDateKey && lastDateKey !== currentTodayKey) {
        // Date changed - reload state from adapter
        const todayState = await dataAdapter.loadToday();
        setCareNotes(todayState.careNotes);
        setCurrentCaregiver(todayState.currentCaregiver);
        setLastUpdatedBy(todayState.lastUpdatedBy);
        
        // Reload notesByDate for history
        const allNotes = await dataAdapter.getNotesByDate();
        setNotesByDate(allNotes);
        
        lastCheckedDateRef.current = currentTodayKey;
      }
    };
    
    checkDate();
    // Check every minute for date changes
    const interval = setInterval(checkDate, 60000);
    return () => clearInterval(interval);
  }, []);

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
        dateLabel: formatDateLabel(dateKey),
        notes: notesByDate[dateKey]
      });
    }
    
    return entries;
  };

  const handleAddNote = async () => {
    if (noteText.trim()) {
      // Use adapter to add note
      const newNote = await dataAdapter.addNote(noteText.trim());
      
      // Update UI state
      setCareNotes([newNote, ...careNotes]);
      setNoteText('');
      
      // Reload notesByDate to keep history in sync
      const allNotes = await dataAdapter.getNotesByDate();
      setNotesByDate(allNotes);
    }
  };

  const handleHandoff = async () => {
    // Determine target caregiver based on current caregiver
    const targetCaregiver = currentCaregiver === 'Lupe' ? 'Maria' : 'Lupe';
    
    // Use adapter to perform handoff
    await dataAdapter.handoff(targetCaregiver);
    
    // Reload state from adapter
    const todayState = await dataAdapter.loadToday();
    setCareNotes(todayState.careNotes);
    setCurrentCaregiver(todayState.currentCaregiver);
    setLastUpdatedBy(todayState.lastUpdatedBy);
    
    // Reload notesByDate for history
    const allNotes = await dataAdapter.getNotesByDate();
    setNotesByDate(allNotes);
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-normal mb-8 leading-tight" style={{ color: 'var(--text-primary)' }}>
          Today
        </h1>

        <header className="mb-8 pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-lg font-normal mb-2 inline-flex items-center" style={{ color: 'var(--text-secondary)' }}>
            <FontAwesomeIcon icon={Icons.notebook} className="mr-2 opacity-75" style={{ fontSize: '0.95em' }} aria-hidden="true" />
            Today — Wela
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Current caregiver: <span className="font-medium" style={{ color: 'var(--text-secondary)' }} aria-label={`Current caregiver is ${currentCaregiver}`}>{currentCaregiver}</span>
          </p>
        </header>

        {/* First-Time Context */}
        {careNotes.length === 0 && todayData.tasks.length === 0 && (
          <section className="mb-8">
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This is today's shared care notebook. Add notes as things happen, and they'll be here for everyone helping care for Wela.
            </p>
          </section>
        )}

        {/* Quick Note Section */}
        <section className="mb-10" aria-labelledby="quick-note-heading">
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
              className="w-full sm:w-auto px-6 py-3 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer"
              style={{ 
                color: 'var(--button-secondary-text)',
                backgroundColor: 'var(--button-secondary-bg)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
              }}
              aria-label="Add note to care notebook"
            >
              Add note
            </button>
          </form>
        </section>

        {/* Care Notes Section */}
        <section className="mb-10" aria-labelledby="care-notes-heading">
          <h2 id="care-notes-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
            <FontAwesomeIcon icon={Icons.careNotes} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            Care Notes
          </h2>
          {careNotes.length === 0 ? (
            <div className="py-6" role="status" aria-live="polite">
              <p className="text-base mb-2" style={{ color: 'var(--text-secondary)' }}>
                No notes yet today
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                When you add a note, it will appear here for everyone caring for Wela.
              </p>
            </div>
          ) : (
            <div className="space-y-4" role="list" aria-label="Care notes for today">
              {careNotes.map((note, index) => {
                // Parse time string (e.g., "8:30 AM" or "2:00 PM") to datetime
                const parseTime = (timeStr: string): string => {
                  try {
                    const [timePart, ampm] = timeStr.split(' ');
                    const [hours, minutes] = timePart.split(':');
                    let hour24 = parseInt(hours, 10);
                    if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
                    if (ampm === 'AM' && hour24 === 12) hour24 = 0;
                    const noteDate = new Date();
                    noteDate.setHours(hour24, parseInt(minutes, 10));
                    return noteDate.toISOString();
                  } catch {
                    return '';
                  }
                };
                const isoTime = parseTime(note.time);
                
                return (
                  <article key={index} className="border-b pb-4 last:border-b-0" style={{ borderColor: 'var(--border-color)' }} role="listitem">
                    <div className="flex items-start gap-3">
                      <time 
                        className="text-sm font-medium whitespace-nowrap" 
                        style={{ color: 'var(--text-muted)' }}
                        dateTime={isoTime || undefined}
                        aria-label={`Note added at ${note.time}`}
                      >
                        <FontAwesomeIcon icon={Icons.time} className="mr-1 opacity-60" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                        {note.time}
                      </time>
                      <div className="flex-1">
                        <p className="text-base leading-relaxed flex-1" style={{ 
                          color: note.author === 'System' ? 'var(--text-muted)' : 'var(--text-primary)',
                          fontStyle: note.author === 'System' ? 'italic' : 'normal'
                        }}>
                          {note.note}
                        </p>
                        <p className="text-xs mt-1.5" style={{ color: 'var(--text-light)' }} aria-label={`Noted by ${note.author}`}>
                          — {note.author}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* What matters next Section */}
        <section className="mb-10" aria-labelledby="tasks-heading">
          <h2 id="tasks-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
            <FontAwesomeIcon icon={Icons.tasks} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            What matters next
          </h2>
          {todayData.tasks.length === 0 ? (
            <div className="py-2" role="status">
              <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                No upcoming tasks added yet.
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                You can add reminders here when something needs follow-up.
              </p>
            </div>
          ) : (
            <ul className="space-y-3" role="list" aria-label="Upcoming tasks">
              {todayData.tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-3" role="listitem">
                  <input
                    type="checkbox"
                    id={task.id}
                    checked={task.completed}
                    readOnly
                    className="mt-1 w-5 h-5 rounded focus:ring-2 focus:ring-offset-2 cursor-pointer"
                    style={{ 
                      accentColor: 'var(--text-primary)',
                      borderColor: 'var(--border-color)',
                      '--tw-ring-color': 'var(--text-primary)',
                    } as React.CSSProperties}
                    aria-label={`${task.text}, ${task.completed ? 'completed' : 'not completed'}`}
                    aria-checked={task.completed}
                  />
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
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Handoff Section */}
        <section className="border-t pt-6 mt-8" style={{ borderColor: 'var(--border-color)' }} aria-labelledby="handoff-heading">
          <h2 id="handoff-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
            <FontAwesomeIcon icon={Icons.handoff} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            Handoff
          </h2>
          <div className="space-y-3 text-base" style={{ color: 'var(--text-secondary)' }}>
            <p>
              Last updated by: <span className="font-medium" style={{ color: 'var(--text-primary)' }} aria-label={`Last updated by ${lastUpdatedBy}`}>{lastUpdatedBy}</span>
            </p>
            <p>
              Current caregiver: <span className="font-medium" style={{ color: 'var(--text-primary)' }} aria-label={`Current caregiver is ${currentCaregiver}`}>{currentCaregiver}</span>
            </p>
            {(() => {
              // Determine target caregiver for handoff
              const targetCaregiver = currentCaregiver === 'Lupe' ? 'Maria' : 'Lupe';
              return (
                <button
                  type="button"
                  onClick={handleHandoff}
                  className="mt-4 px-6 py-3 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer"
                  style={{ 
                    color: 'var(--button-secondary-text)',
                    backgroundColor: 'var(--button-secondary-bg)',
                    '--tw-ring-color': 'var(--focus-ring)',
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
                  }}
                  aria-label={`Hand off care to ${targetCaregiver}`}
                >
                  <FontAwesomeIcon icon={Icons.handoff} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                  Hand off care to {targetCaregiver}
                </button>
              );
            })()}
          </div>
        </section>

        {/* Earlier Section */}
        {(() => {
          const historyEntries = getHistoryEntries();
          if (historyEntries.length === 0) return null;
          
          return (
            <section className="border-t pt-6 mt-8" style={{ borderColor: 'var(--border-color)' }} aria-labelledby="earlier-heading">
              <h2 id="earlier-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
                <FontAwesomeIcon icon={Icons.careNotes} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                Earlier
              </h2>
              <div className="space-y-6" role="list" aria-label="Earlier care notes">
                {historyEntries.map((entry) => (
                  <div key={entry.dateKey} role="listitem">
                    <h3 className="text-base font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                      {entry.dateLabel}
                    </h3>
                    <ul className="space-y-2" role="list" aria-label={`Care notes for ${entry.dateLabel}`}>
                      {entry.notes.map((note, index) => {
                        const noteWithAuthor = {
                          ...note,
                          author: note.author || 'Lupe'
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
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })()}
      </div>
    </main>
  );
}

export default Today;
