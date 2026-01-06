import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Icons } from '../ui/icons'

interface AppShellProps {
  children: ReactNode
  onNavigateHome: () => void
  currentView: 'home' | 'today'
}

function AppShell({ children, onNavigateHome, currentView }: AppShellProps) {
  const isLanding = currentView === 'home'

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="px-6 py-4 max-w-2xl mx-auto">
          {isLanding ? (
            // Brand mode: Not clickable, no arrow, notebook icon
            <div className="text-base text-gray-700 inline-flex items-center">
              <FontAwesomeIcon icon={Icons.brand} className="mr-2 opacity-55" style={{ fontSize: '0.8em' }} aria-hidden="true" />
              Care notebook
            </div>
          ) : (
            // Back mode: Clickable, arrow icon, navigation affordance
            <button
              type="button"
              onClick={onNavigateHome}
              className="text-base text-gray-700 hover:text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 rounded px-2 py-1 transition-all cursor-pointer inline-flex items-center hover:-translate-x-0.5"
            >
              <FontAwesomeIcon icon={Icons.back} className="mr-2 opacity-60" style={{ fontSize: '0.85em' }} aria-hidden="true" />
              Care notebook
            </button>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

export default AppShell

