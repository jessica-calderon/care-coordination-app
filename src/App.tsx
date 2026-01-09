import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import AppShell from './app/AppShell';
import Footer from './components/Footer';
import CareeNameModal from './components/CareeNameModal';
import { Spinner } from './components/Spinner';
import { createDataAdapter, createFirebaseAdapter } from './storage';
import { DataAdapterContext } from './storage/DataAdapterContext';
import { resolveNotebookId, createNewNotebook, switchToNotebook, updateUrlWithNotebookId } from './utils/notebookId';
import { readNotebookIndex } from './domain/notebook';

// Lazy load page components for code splitting
const Landing = lazy(() => import('./pages/Landing'));
const Today = lazy(() => import('./pages/Today'));
const CareTeam = lazy(() => import('./pages/CareTeam'));
const About = lazy(() => import('./pages/About'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Privacy = lazy(() => import('./pages/Privacy'));

const STORAGE_KEY_VIEW = 'care-app-view';

type ViewType = 'home' | 'today' | 'careTeam' | 'about' | 'howItWorks' | 'privacy';

function App() {
  // Resolve initial notebook ID from URL or last-used
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(() => {
    return resolveNotebookId();
  });

  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW);
    const validViews: ViewType[] = ['home', 'today', 'careTeam', 'about', 'howItWorks', 'privacy'];
    return validViews.includes(saved as ViewType) ? (saved as ViewType) : 'home';
  });

  const [notebookIndex, setNotebookIndex] = useState(() => readNotebookIndex());
  const [showCareeNameModal, setShowCareeNameModal] = useState(false);

  // Create adapter for current notebook ID
  const dataAdapter = useMemo(() => {
    if (!currentNotebookId) {
      // Return a dummy adapter that will be replaced when notebook is selected
      // This should only happen briefly during initialization
      return createDataAdapter('');
    }
    return createDataAdapter(currentNotebookId);
  }, [currentNotebookId]);

  // Listen for URL changes (e.g., browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const resolved = resolveNotebookId();
      if (resolved && resolved !== currentNotebookId) {
        setCurrentNotebookId(resolved);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentNotebookId]);

  // Sync URL parameter with current notebook ID
  useEffect(() => {
    if (currentNotebookId) {
      updateUrlWithNotebookId(currentNotebookId);
    }
  }, [currentNotebookId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEW, currentView);
  }, [currentView]);

  // Update notebook index when it changes
  useEffect(() => {
    setNotebookIndex(readNotebookIndex());
  }, [currentNotebookId]);

  const handleStartNotebook = () => {
    // Show modal to prompt for caree name
    setShowCareeNameModal(true);
  }

  const handleCareeNameSubmit = async (careeName: string) => {
    // Create a new notebook
    const newNotebookId = createNewNotebook();
    
    // Create notebook metadata in Firestore with careeName
    const adapter = createFirebaseAdapter(newNotebookId);
    await adapter.createNotebook(careeName);
    
    setCurrentNotebookId(newNotebookId);
    setNotebookIndex(readNotebookIndex());
    setShowCareeNameModal(false);
    setCurrentView('today');
  }

  const handleSwitchNotebook = (notebookId: string) => {
    switchToNotebook(notebookId);
    setCurrentNotebookId(notebookId);
    setNotebookIndex(readNotebookIndex());
    setCurrentView('today');
  }

  const handleCreateAnotherNotebook = () => {
    handleStartNotebook();
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

  const handleNavigateAbout = () => {
    setCurrentView('about')
  }

  const handleNavigateHowItWorks = () => {
    setCurrentView('howItWorks')
  }

  const handleNavigatePrivacy = () => {
    setCurrentView('privacy')
  }

  const showFooter = currentView === 'home' || currentView === 'today' || currentView === 'about' || currentView === 'howItWorks' || currentView === 'privacy';

  return (
    <DataAdapterContext.Provider value={dataAdapter}>
      <AppShell 
        onNavigateHome={handleNavigateHome} 
        onNavigateCareTeam={currentView === 'today' ? handleNavigateCareTeam : undefined}
        onNavigateBack={currentView === 'careTeam' ? handleNavigateBack : undefined}
        currentView={currentView}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <Spinner size="lg" />
          </div>
        }>
          {currentView === 'today' ? (
            <Today key={currentNotebookId} />
          ) : currentView === 'careTeam' ? (
            <CareTeam key={currentNotebookId} />
          ) : currentView === 'about' ? (
            <About />
          ) : currentView === 'howItWorks' ? (
            <HowItWorks />
          ) : currentView === 'privacy' ? (
            <Privacy />
          ) : (
            <Landing 
              onStartNotebook={handleStartNotebook}
              onSwitchNotebook={handleSwitchNotebook}
              onCreateAnotherNotebook={handleCreateAnotherNotebook}
              notebookIndex={notebookIndex}
            />
          )}
        </Suspense>
        {showFooter && (
          <Footer 
            onNavigateAbout={handleNavigateAbout}
            onNavigateHowItWorks={handleNavigateHowItWorks}
            onNavigatePrivacy={handleNavigatePrivacy}
          />
        )}
      </AppShell>
      <CareeNameModal
        isOpen={showCareeNameModal}
        onClose={() => setShowCareeNameModal(false)}
        onSubmit={handleCareeNameSubmit}
      />
    </DataAdapterContext.Provider>
  );
}

export default App
