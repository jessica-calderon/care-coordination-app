import { useState, useEffect } from 'react'
import AppShell from './app/AppShell'
import Landing from './pages/Landing'
import Today from './pages/Today'

const STORAGE_KEY_VIEW = 'care-app-view'
const STORAGE_KEY_NOTES_BY_DATE = 'care-app-notes-by-date'
const STORAGE_KEY_CURRENT_CAREGIVER = 'care-app-current-caregiver'
const STORAGE_KEY_LAST_UPDATED_BY = 'care-app-last-updated-by'
const STORAGE_KEY_TASKS = 'care-app-tasks'

/**
 * Checks if a care notebook already exists in localStorage.
 * A notebook exists if any of the following are true:
 * - There are saved care notes
 * - There is saved caregiver state
 * - There is saved task state
 */
function notebookExists(): boolean {
  // Check for saved care notes
  const notesData = localStorage.getItem(STORAGE_KEY_NOTES_BY_DATE)
  if (notesData) {
    try {
      const notesByDate = JSON.parse(notesData)
      // Check if there are any notes in any date
      if (notesByDate && typeof notesByDate === 'object') {
        const hasNotes = Object.values(notesByDate).some(
          (notes: unknown) => Array.isArray(notes) && notes.length > 0
        )
        if (hasNotes) return true
      }
    } catch (e) {
      // If parsing fails, continue checking other indicators
    }
  }

  // Check for saved caregiver state
  const caregiver = localStorage.getItem(STORAGE_KEY_CURRENT_CAREGIVER)
  const lastUpdatedBy = localStorage.getItem(STORAGE_KEY_LAST_UPDATED_BY)
  if (caregiver || lastUpdatedBy) {
    return true
  }

  // Check for saved task state
  const tasks = localStorage.getItem(STORAGE_KEY_TASKS)
  if (tasks) {
    try {
      const tasksData = JSON.parse(tasks)
      if (Array.isArray(tasksData) && tasksData.length > 0) {
        return true
      }
    } catch (e) {
      // If parsing fails, continue
    }
  }

  return false
}

function App() {
  const [currentView, setCurrentView] = useState<'home' | 'today'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW)
    return (saved === 'home' || saved === 'today') ? saved : 'home'
  })

  const [hasNotebook, setHasNotebook] = useState(() => notebookExists())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEW, currentView)
  }, [currentView])

  // Re-check notebook existence when returning to home view
  useEffect(() => {
    if (currentView === 'home') {
      setHasNotebook(notebookExists())
    }
  }, [currentView])

  const handleStartNotebook = () => {
    setCurrentView('today')
  }

  const handleNavigateHome = () => {
    setCurrentView('home')
  }

  return (
    <AppShell onNavigateHome={handleNavigateHome}>
      {currentView === 'today' ? (
        <Today />
      ) : (
        <Landing onStartNotebook={handleStartNotebook} hasNotebook={hasNotebook} />
      )}
    </AppShell>
  )
}

export default App
