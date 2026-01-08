import { useState, useEffect } from 'react';
import AppShell from './app/AppShell';
import Landing from './pages/Landing';
import Today from './pages/Today';
import CareTeam from './pages/CareTeam';
import { dataAdapter } from './storage';

const STORAGE_KEY_VIEW = 'care-app-view';

function App() {

  const [currentView, setCurrentView] = useState<'home' | 'today' | 'careTeam'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW);
    return (saved === 'home' || saved === 'today' || saved === 'careTeam') ? saved : 'home';
  });

  const [hasNotebook, setHasNotebook] = useState(false);

  // Load notebook existence on mount
  useEffect(() => {
    const checkNotebook = async () => {
      const exists = await dataAdapter.notebookExists();
      setHasNotebook(exists);
    };
    checkNotebook();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEW, currentView);
  }, [currentView]);

  // Re-check notebook existence when returning to home view
  useEffect(() => {
    if (currentView === 'home') {
      const checkNotebook = async () => {
        const exists = await dataAdapter.notebookExists();
        setHasNotebook(exists);
      };
      checkNotebook();
    }
  }, [currentView]);

  const handleStartNotebook = () => {
    setCurrentView('today')
  }

  const handleNavigateHome = () => {
    setCurrentView('home')
  }

  const handleNavigateCareTeam = () => {
    setCurrentView('careTeam')
  }

  const handleNavigateBack = () => {
    setCurrentView('today')
  }

  return (
    <AppShell 
      onNavigateHome={handleNavigateHome} 
      onNavigateCareTeam={currentView === 'today' ? handleNavigateCareTeam : undefined}
      onNavigateBack={currentView === 'careTeam' ? handleNavigateBack : undefined}
      currentView={currentView}
    >
      {currentView === 'today' ? (
        <Today />
      ) : currentView === 'careTeam' ? (
        <CareTeam />
      ) : (
        <Landing onStartNotebook={handleStartNotebook} hasNotebook={hasNotebook} />
      )}
    </AppShell>
  );
}

export default App
