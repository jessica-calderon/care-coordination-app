import { useState } from 'react'
import Landing from './pages/Landing'
import Today from './pages/Today'

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'today'>('landing')

  const handleStartNotebook = () => {
    setCurrentView('today')
  }

  if (currentView === 'today') {
    return <Today />
  }

  return <Landing onStartNotebook={handleStartNotebook} />
}

export default App
