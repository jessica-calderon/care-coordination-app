import { useState, useEffect, useRef } from 'react';
import { todayData } from '../mock/todayData';
import type { CareNote, NotesByDate } from '../domain/types';
import { getTodayDateKey, formatDateLabel } from '../domain/notebook';
import { dataAdapter } from '../storage';

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
    // Use adapter to perform handoff
    await dataAdapter.handoff('Maria');
    
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
    <main className="min-h-screen bg-white">
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-normal text-gray-900 mb-8 leading-tight">
          Today
        </h1>

        <header className="mb-8 pb-6 border-b border-gray-200">
          <h2 className="text-lg font-normal text-gray-700 mb-2">
            Today — Wela
          </h2>
          <p className="text-sm text-gray-600">
            Current caregiver: <span className="font-medium text-gray-700">{currentCaregiver}</span>
          </p>
        </header>

        {/* First-Time Context */}
        {careNotes.length === 0 && todayData.tasks.length === 0 && (
          <section className="mb-8">
            <p className="text-base text-gray-700 leading-relaxed">
              This is today's shared care notebook. Add notes as things happen, and they'll be here for everyone helping care for Wela.
            </p>
          </section>
        )}

        {/* Quick Note Section */}
        <section className="mb-10">
          <h2 className="text-xl font-normal text-gray-900 mb-4">
            Quick note
          </h2>
          <div className="space-y-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about care, symptoms, or anything that feels important…"
              className="w-full px-4 py-3 text-base text-gray-800 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-y min-h-[100px] leading-relaxed"
              rows={4}
            />
            <button
              onClick={handleAddNote}
              className="w-full sm:w-auto px-6 py-3 text-base font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Add note
            </button>
          </div>
        </section>

        {/* Care Notes Section */}
        <section className="mb-10">
          <h2 className="text-xl font-normal text-gray-900 mb-4">
            Care Notes
          </h2>
          {careNotes.length === 0 ? (
            <div className="py-6">
              <p className="text-base text-gray-700 mb-2">
                No notes yet today
              </p>
              <p className="text-sm text-gray-600">
                When you add a note, it will appear here for everyone caring for Wela.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {careNotes.map((note, index) => (
                <article key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <time className="text-sm text-gray-600 font-medium whitespace-nowrap">
                      {note.time}
                    </time>
                    <div className="flex-1">
                      <p className={`text-base leading-relaxed flex-1 ${
                        note.author === 'System' 
                          ? 'text-gray-600 italic' 
                          : 'text-gray-800'
                      }`}>
                        {note.note}
                      </p>
                      <p className="text-xs text-gray-500 mt-1.5" aria-label={`Noted by ${note.author}`}>
                        — {note.author}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* What matters next Section */}
        <section className="mb-10">
          <h2 className="text-xl font-normal text-gray-900 mb-4">
            What matters next
          </h2>
          {todayData.tasks.length === 0 ? (
            <div className="py-2">
              <p className="text-base text-gray-700">
                No upcoming tasks added yet.
              </p>
              <p className="text-sm text-gray-600 mt-1">
                You can add reminders here when something needs follow-up.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {todayData.tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id={task.id}
                    checked={task.completed}
                    readOnly
                    className="mt-1 w-5 h-5 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 cursor-pointer"
                    aria-label={task.text}
                  />
                  <label
                    htmlFor={task.id}
                    className={`text-base leading-relaxed flex-1 cursor-pointer ${
                      task.completed ? 'text-gray-500 line-through' : 'text-gray-800'
                    }`}
                  >
                    {task.text}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Handoff Section */}
        <section className="border-t border-gray-200 pt-6 mt-8">
          <h2 className="text-xl font-normal text-gray-900 mb-4">
            Handoff
          </h2>
          <div className="space-y-3 text-base text-gray-700">
            <p>
              Last updated by: <span className="font-medium text-gray-900">{lastUpdatedBy}</span>
            </p>
            <p>
              Current caregiver: <span className="font-medium text-gray-900">{currentCaregiver}</span>
            </p>
            {currentCaregiver === 'Lupe' && (
              <button
                onClick={handleHandoff}
                className="mt-4 px-6 py-3 text-base font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Hand off care to Maria
              </button>
            )}
          </div>
        </section>

        {/* Earlier Section */}
        {(() => {
          const historyEntries = getHistoryEntries();
          if (historyEntries.length === 0) return null;
          
          return (
            <section className="border-t border-gray-200 pt-6 mt-8" aria-label="Earlier care notes">
              <h2 className="text-xl font-normal text-gray-900 mb-4">
                Earlier
              </h2>
              <div className="space-y-6">
                {historyEntries.map((entry) => (
                  <div key={entry.dateKey}>
                    <h3 className="text-base font-medium text-gray-700 mb-3">
                      {entry.dateLabel}
                    </h3>
                    <ul className="space-y-2">
                      {entry.notes.map((note, index) => {
                        const noteWithAuthor = {
                          ...note,
                          author: note.author || 'Lupe'
                        };
                        return (
                          <li key={index} className="flex items-start gap-3">
                            <time className="text-sm text-gray-600 font-medium whitespace-nowrap">
                              {noteWithAuthor.time}
                            </time>
                            <div className="flex-1">
                              <p className={`text-sm leading-relaxed flex-1 ${
                                noteWithAuthor.author === 'System' 
                                  ? 'text-gray-500 italic' 
                                  : 'text-gray-700'
                              }`}>
                                {noteWithAuthor.note}
                              </p>
                              <p className="text-xs text-gray-500 mt-1" aria-label={`Noted by ${noteWithAuthor.author}`}>
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
