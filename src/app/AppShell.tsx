import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Icons } from '../ui/icons'
import { useTheme } from '../hooks/useTheme'

interface AppShellProps {
  children: ReactNode
  onNavigateHome: () => void
  currentView: 'home' | 'today'
}

function AppShell({ children, onNavigateHome, currentView }: AppShellProps) {
  const isLanding = currentView === 'home'
  const { theme, toggleTheme } = useTheme()

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
                onClick={onNavigateHome}
                className="text-base hover:underline focus:outline-none focus:ring-2 rounded px-2 py-1 transition-all cursor-pointer inline-flex items-center hover:-translate-x-0.5"
                style={{ 
                  color: 'var(--text-secondary)',
                  '--tw-ring-color': 'var(--focus-ring)',
                } as React.CSSProperties}
                aria-label="Navigate to home page"
              >
                <FontAwesomeIcon icon={Icons.back} className="mr-2 opacity-60" style={{ fontSize: '0.85em' }} aria-hidden="true" />
                <span>Care notebook</span>
              </button>
            )}
          </div>
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
        </nav>
      </header>
      <main role="main">{children}</main>
    </div>
  )
}

export default AppShell

