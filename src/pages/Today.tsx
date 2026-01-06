import { useState, useEffect, useRef } from 'react'
import { todayData, type CareNote } from '../mock/todayData'

const STORAGE_KEY_NOTES_BY_DATE = 'care-app-notes-by-date'
const STORAGE_KEY_LAST_DATE = 'care-app-last-date'
const STORAGE_KEY_CURRENT_CAREGIVER = 'care-app-current-caregiver'
const STORAGE_KEY_LAST_UPDATED_BY = 'care-app-last-updated-by'

type NotesByDate = Record<string, CareNote[]>

// Get today's date in YYYY-MM-DD format
const getTodayDateKey = (): string => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

// Migrate old data format if it exists
const migrateOldData = (): NotesByDate => {
  const oldKey = 'care-app-care-notes'
  const oldData = localStorage.getItem(oldKey)
  if (oldData) {
    try {
      const oldNotes: CareNote[] = JSON.parse(oldData)
      if (Array.isArray(oldNotes) && oldNotes.length > 0) {
        // Move old notes to today's date
        const todayKey = getTodayDateKey()
        const migrated: NotesByDate = { [todayKey]: oldNotes }
        localStorage.setItem(STORAGE_KEY_NOTES_BY_DATE, JSON.stringify(migrated))
        localStorage.removeItem(oldKey)
        return migrated
      }
    } catch (e) {
      // If parsing fails, ignore old data
    }
  }
  return {}
}

// Load notes by date from localStorage
const loadNotesByDate = (): NotesByDate => {
  const saved = localStorage.getItem(STORAGE_KEY_NOTES_BY_DATE)
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch (e) {
      return {}
    }
  }
  // Try to migrate old data
  return migrateOldData()
}

// Check if date has changed and preserve history
const checkDateChange = (notesByDate: NotesByDate): NotesByDate => {
  const todayKey = getTodayDateKey()
  const lastDateKey = localStorage.getItem(STORAGE_KEY_LAST_DATE)
  
  // If date changed and we have notes from previous date, preserve them
  if (lastDateKey && lastDateKey !== todayKey && notesByDate[lastDateKey]) {
    // Notes are already preserved, just update the last date
    localStorage.setItem(STORAGE_KEY_LAST_DATE, todayKey)
    return notesByDate
  }
  
  // First time or same date
  if (!lastDateKey || lastDateKey !== todayKey) {
    localStorage.setItem(STORAGE_KEY_LAST_DATE, todayKey)
  }
  
  return notesByDate
}

function Today() {
  const [notesByDate, setNotesByDate] = useState<NotesByDate>(() => {
    const loaded = loadNotesByDate()
    return checkDateChange(loaded)
  })
  
  const todayKey = getTodayDateKey()
  const [careNotes, setCareNotes] = useState<CareNote[]>(() => {
    return notesByDate[todayKey] || todayData.careNotes
  })
  
  const [noteText, setNoteText] = useState('')
  const [lastUpdatedBy, setLastUpdatedBy] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LAST_UPDATED_BY)
    return saved || todayData.lastUpdatedBy
  })
  const [currentCaregiver, setCurrentCaregiver] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER)
    return saved || todayData.currentCaregiver
  })

  // Track the last date we checked to avoid unnecessary updates
  const lastCheckedDateRef = useRef<string>(localStorage.getItem(STORAGE_KEY_LAST_DATE) || getTodayDateKey())
  const careNotesRef = useRef<CareNote[]>(careNotes)

  // Keep ref in sync with state
  useEffect(() => {
    careNotesRef.current = careNotes
  }, [careNotes])

  // Save care notes to localStorage whenever they change
  useEffect(() => {
    const updated = { ...notesByDate, [todayKey]: careNotes }
    setNotesByDate(updated)
    localStorage.setItem(STORAGE_KEY_NOTES_BY_DATE, JSON.stringify(updated))
  }, [careNotes, todayKey])

  // Check for date change on mount and periodically
  useEffect(() => {
    const checkDate = () => {
      const currentTodayKey = getTodayDateKey()
      const lastDateKey = lastCheckedDateRef.current
      
      if (lastDateKey && lastDateKey !== currentTodayKey) {
        // Date changed - preserve previous day's notes as history
        const currentNotes = careNotesRef.current
        
        // Read current notesByDate from localStorage to get the latest state
        const saved = localStorage.getItem(STORAGE_KEY_NOTES_BY_DATE)
        const currentNotesByDate: NotesByDate = saved ? JSON.parse(saved) : {}
        
        // Update notesByDate: save current notes to previous date, load today's notes
        const updated = { ...currentNotesByDate }
        if (currentNotes.length > 0) {
          updated[lastDateKey] = currentNotes
        }
        const savedTodayNotes = updated[currentTodayKey] || []
        updated[currentTodayKey] = savedTodayNotes
        
        // Update both states
        setNotesByDate(updated)
        setCareNotes(savedTodayNotes)
        
        // Update localStorage and refs
        localStorage.setItem(STORAGE_KEY_NOTES_BY_DATE, JSON.stringify(updated))
        lastCheckedDateRef.current = currentTodayKey
        localStorage.setItem(STORAGE_KEY_LAST_DATE, currentTodayKey)
      }
    }
    
    checkDate()
    // Check every minute for date changes
    const interval = setInterval(checkDate, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CURRENT_CAREGIVER, currentCaregiver)
  }, [currentCaregiver])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LAST_UPDATED_BY, lastUpdatedBy)
  }, [lastUpdatedBy])

  const formatTime = (date: Date): string => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${ampm}`
  }

  // Format date key (YYYY-MM-DD) to human-readable format
  const formatDateLabel = (dateKey: string): string => {
    const date = new Date(dateKey + 'T00:00:00')
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    // Reset time to compare dates only
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    
    if (dateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday'
    }
    
    // Check if within last 7 days
    const daysDiff = Math.floor((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDiff >= 2 && daysDiff <= 7) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      return dayNames[date.getDay()]
    }
    
    // Fallback to formatted date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
  }

  // Get history entries (last 3 days, excluding today)
  const getHistoryEntries = (): Array<{ dateKey: string; dateLabel: string; notes: CareNote[] }> => {
    const todayKey = getTodayDateKey()
    const entries: Array<{ dateKey: string; dateLabel: string; notes: CareNote[] }> = []
    
    // Get all date keys except today, sorted descending
    const dateKeys = Object.keys(notesByDate)
      .filter(key => key !== todayKey && notesByDate[key] && notesByDate[key].length > 0)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 3) // Limit to 3 most recent days
    
    for (const dateKey of dateKeys) {
      entries.push({
        dateKey,
        dateLabel: formatDateLabel(dateKey),
        notes: notesByDate[dateKey]
      })
    }
    
    return entries
  }

  const handleAddNote = () => {
    if (noteText.trim()) {
      const newNote: CareNote = {
        time: formatTime(new Date()),
        note: noteText.trim()
      }
      setCareNotes([newNote, ...careNotes])
      setNoteText('')
    }
  }

  const handleHandoff = () => {
    const now = new Date()
    const handoffNote: CareNote = {
      time: formatTime(now),
      note: 'Lupe handed off care to Maria.'
    }
    setCareNotes([handoffNote, ...careNotes])
    setCurrentCaregiver('Maria')
    setLastUpdatedBy('Lupe')
  }

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
                <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="flex items-start gap-3">
                    <time className="text-sm text-gray-600 font-medium whitespace-nowrap">
                      {note.time}
                    </time>
                    <p className="text-base text-gray-800 leading-relaxed flex-1">
                      {note.note}
                    </p>
                  </div>
                </div>
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
          const historyEntries = getHistoryEntries()
          if (historyEntries.length === 0) return null
          
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
                      {entry.notes.map((note, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <time className="text-sm text-gray-600 font-medium whitespace-nowrap">
                            {note.time}
                          </time>
                          <p className="text-sm text-gray-700 leading-relaxed flex-1">
                            {note.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )
        })()}
      </div>
    </main>
  )
}

export default Today

