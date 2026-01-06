import { useState, useEffect } from 'react'
import AppShell from './app/AppShell'
import Landing from './pages/Landing'
import Today from './pages/Today'

const STORAGE_KEY_VIEW = 'care-app-view'

function App() {
  const [currentView, setCurrentView] = useState<'home' | 'today'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW)
    return (saved === 'home' || saved === 'today') ? saved : 'home'
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEW, currentView)
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
        <Landing onStartNotebook={handleStartNotebook} />
      )}
    </AppShell>
  )
}

export default App
