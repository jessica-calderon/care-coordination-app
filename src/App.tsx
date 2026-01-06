import { useState, useEffect } from 'react';
import AppShell from './app/AppShell';
import Landing from './pages/Landing';
import Today from './pages/Today';
import { dataAdapter } from './storage';

const STORAGE_KEY_VIEW = 'care-app-view';

function App() {

  const [currentView, setCurrentView] = useState<'home' | 'today'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW);
    return (saved === 'home' || saved === 'today') ? saved : 'home';
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

  return (
    <AppShell onNavigateHome={handleNavigateHome}>
      {currentView === 'today' ? (
        <Today />
      ) : (
        <Landing onStartNotebook={handleStartNotebook} hasNotebook={hasNotebook} />
      )}
    </AppShell>
  );
}

export default App
