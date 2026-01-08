import { useState, useEffect } from 'react';
import AppShell from './app/AppShell';
import Landing from './pages/Landing';
import Today from './pages/Today';
import CareTeam from './pages/CareTeam';
import About from './pages/About';
import HowItWorks from './pages/HowItWorks';
import Privacy from './pages/Privacy';
import Footer from './components/Footer';
import { dataAdapter } from './storage';

const STORAGE_KEY_VIEW = 'care-app-view';

type ViewType = 'home' | 'today' | 'careTeam' | 'about' | 'howItWorks' | 'privacy';

function App() {

  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW);
    const validViews: ViewType[] = ['home', 'today', 'careTeam', 'about', 'howItWorks', 'privacy'];
    return validViews.includes(saved as ViewType) ? (saved as ViewType) : 'home';
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
      ) : currentView === 'about' ? (
        <About />
      ) : currentView === 'howItWorks' ? (
        <HowItWorks />
      ) : currentView === 'privacy' ? (
        <Privacy />
      ) : (
        <Landing onStartNotebook={handleStartNotebook} hasNotebook={hasNotebook} />
      )}
      {showFooter && (
        <Footer 
          onNavigateAbout={handleNavigateAbout}
          onNavigateHowItWorks={handleNavigateHowItWorks}
          onNavigatePrivacy={handleNavigatePrivacy}
        />
      )}
    </AppShell>
  );
}

export default App
