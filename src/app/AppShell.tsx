import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Icons } from '../ui/icons'
import { useTheme } from '../hooks/useTheme'

interface AppShellProps {
  children: ReactNode
  onNavigateHome: () => void
  onNavigateCareTeam?: () => void
  onNavigateBack?: () => void
  currentView: 'home' | 'today' | 'careTeam'
}

function AppShell({ children, onNavigateHome, onNavigateCareTeam, onNavigateBack, currentView }: AppShellProps) {
  const isLanding = currentView === 'home'
  const isToday = currentView === 'today'
  const isCareTeam = currentView === 'careTeam'
  const { theme, toggleTheme } = useTheme()

  const handleBackClick = () => {
    if (isCareTeam && onNavigateBack) {
      onNavigateBack()
    } else {
      onNavigateHome()
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <header className="border-b" style={{ borderColor: 'var(--border-color)' }} role="banner">
        <nav className="px-6 py-4 max-w-2xl mx-auto flex items-center justify-between" aria-label="Main navigation">
          <div className="flex-1">
            {isLanding ? (
              // Brand mode: Not clickable, no arrow, notebook icon
              <div className="text-base inline-flex items-center" style={{ color: 'var(--text-secondary)' }}>
                <FontAwesomeIcon icon={Icons.brand} className="mr-2 opacity-55" style={{ fontSize: '0.8em' }} aria-hidden="true" />
                <span>Care notebook</span>
              </div>
            ) : (
              // Back mode: Clickable, arrow icon, navigation affordance
              <button
                type="button"
                onClick={handleBackClick}
                className="text-base hover:underline focus:outline-none focus:ring-2 rounded px-2 py-1 transition-all cursor-pointer inline-flex items-center hover:-translate-x-0.5"
                style={{ 
                  color: 'var(--text-secondary)',
                  '--tw-ring-color': 'var(--focus-ring)',
                } as React.CSSProperties}
                aria-label={isCareTeam ? "Navigate back to Today" : "Navigate to home page"}
              >
                <FontAwesomeIcon icon={Icons.back} className="mr-2 opacity-60" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                <span>Care notebook</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isToday && onNavigateCareTeam && (
              <button
                type="button"
                onClick={onNavigateCareTeam}
                className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 transition-colors cursor-pointer inline-flex items-center gap-2 hover:opacity-80"
                style={{ 
                  color: 'var(--text-secondary)',
                  '--tw-ring-color': 'var(--focus-ring)',
                } as React.CSSProperties}
                aria-label="Care team"
                title="Care team"
              >
                <FontAwesomeIcon 
                  icon={Icons.careTeam} 
                  style={{ fontSize: '1em' }} 
                  aria-hidden="true" 
                />
                <span className="text-sm hidden sm:inline">Care team</span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md focus:outline-none focus:ring-2 transition-colors cursor-pointer"
              style={{ 
                color: 'var(--text-secondary)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-pressed={theme === 'dark'}
            >
              <FontAwesomeIcon 
                icon={theme === 'light' ? Icons.moon : Icons.sun} 
                style={{ fontSize: '1em' }} 
                aria-hidden="true" 
              />
            </button>
          </div>
        </nav>
      </header>
      <main role="main">{children}</main>
    </div>
  )
}

export default AppShell

