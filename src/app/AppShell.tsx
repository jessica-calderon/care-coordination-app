import { ReactNode } from 'react'

interface AppShellProps {
  children: ReactNode
  onNavigateHome: () => void
}

function AppShell({ children, onNavigateHome }: AppShellProps) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="px-6 py-4 max-w-2xl mx-auto">
          <button
            onClick={onNavigateHome}
            className="text-base text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 rounded px-2 py-1 transition-colors"
          >
            Care notebook
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}

export default AppShell

