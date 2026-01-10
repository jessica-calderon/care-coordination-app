import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import AppShell from './app/AppShell';
import Footer from './components/Footer';
import CareeNameModal from './components/CareeNameModal';
import { Spinner } from './components/Spinner';
import { createDataAdapter, createFirebaseAdapter } from './storage';
import { DataAdapterContext } from './storage/DataAdapterContext';
import { resolveNotebookId, generateNotebookId, switchToNotebook, updateUrlWithNotebookId } from './utils/notebookId';
import { readNotebookIndex, addNotebookToIndex, setLastNotebookId } from './domain/notebook';

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
  const [isCreatingAnotherNotebook, setIsCreatingAnotherNotebook] = useState(false);
  const [optimisticCareeNames, setOptimisticCareeNames] = useState<Record<string, string>>({});

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

  /**
   * Create a notebook with metadata.
   * Resilient to quota failure - app works even if Firestore is unavailable.
   * @param careeName The name of the care recipient
   * @returns The new notebook ID
   */
  const createNotebookWithCaree = async (careeName: string): Promise<string> => {
    const notebookId = generateNotebookId();

    addNotebookToIndex(notebookId, careeName);

    // Seed optimistic + persistent local cache FIRST
    setOptimisticCareeNames((prev) => ({
      ...prev,
      [notebookId]: careeName,
    }));

    setLastNotebookId(notebookId);
    updateUrlWithNotebookId(notebookId);

    const adapter = createFirebaseAdapter(notebookId);

    try {
      await adapter.setNotebookMetadata({
        careeName,
        createdAt: Date.now(),
      });
    } catch (err: any) {
      if (err?.code === 'resource-exhausted') {
        // Graceful degradation: allow app to function offline
        console.warn('Notebook created locally due to Firestore quota limits');
      } else {
        throw err;
      }
    }

    return notebookId;
  };

  const handleStartNotebookClick = () => {
    // Show modal to prompt for caree name
    setIsCreatingAnotherNotebook(false);
    setShowCareeNameModal(true);
  }

  const handleStartNotebook = async (careeName: string): Promise<string> => {
    const notebookId = await createNotebookWithCaree(careeName);
    
    // Update notebook index
    const updatedIndex = readNotebookIndex();
    setNotebookIndex(updatedIndex);
    
    // Creating first notebook - navigate to Today page
    setCurrentNotebookId(notebookId);
    setCurrentView('today');
    
    return notebookId;
  }

  const handleCreateAnotherNotebookClick = () => {
    setIsCreatingAnotherNotebook(true);
    setShowCareeNameModal(true);
  }

  const handleCreateAnotherNotebook = async (careeName: string): Promise<string> => {
    const notebookId = await createNotebookWithCaree(careeName);
    
    // Update notebook index
    const updatedIndex = readNotebookIndex();
    setNotebookIndex(updatedIndex);
    
    // Creating another notebook - stay on Landing page
    // Optimistic update already done in createNotebookWithCaree
    
    return notebookId;
  }

  const handleSwitchNotebook = (notebookId: string) => {
    switchToNotebook(notebookId);
    setCurrentNotebookId(notebookId);
    setNotebookIndex(readNotebookIndex());
    setCurrentView('today');
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
              onSwitchNotebook={handleSwitchNotebook}
              notebookIndex={notebookIndex}
              optimisticCareeNames={optimisticCareeNames}
              onStartNotebookClick={handleStartNotebookClick}
              onCreateAnotherNotebookClick={handleCreateAnotherNotebookClick}
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
        onClose={() => {
          setShowCareeNameModal(false);
          setIsCreatingAnotherNotebook(false);
        }}
        onSubmit={async (careeName: string) => {
          try {
            if (isCreatingAnotherNotebook) {
              await handleCreateAnotherNotebook(careeName);
            } else {
              await handleStartNotebook(careeName);
            }
            setShowCareeNameModal(false);
            setIsCreatingAnotherNotebook(false);
          } catch (error) {
            // Re-throw error so modal can handle it
            throw error;
          }
        }}
      />
    </DataAdapterContext.Provider>
  );
}

export default App
