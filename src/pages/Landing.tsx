import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Icons } from '../ui/icons';

interface LandingProps {
  onStartNotebook: () => void
  hasNotebook: boolean
}

function Landing({ onStartNotebook, hasNotebook }: LandingProps) {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <section className="px-6 py-12 max-w-2xl mx-auto" aria-labelledby="landing-heading">
        <h1 id="landing-heading" className="text-3xl md:text-4xl font-normal mb-6 leading-tight" style={{ color: 'var(--text-primary)' }}>
          Care, shared simply.
        </h1>
        
        <p className="text-lg md:text-xl mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          A calm, shared notebook for families coordinating daily care — notes, tasks, and handoffs, all in one place.
        </p>

        <ul className="space-y-4 mb-10" style={{ color: 'var(--text-secondary)' }} aria-label="Features">
          <li className="flex items-start">
            <FontAwesomeIcon icon={Icons.listItem} className="mr-3 opacity-55 mt-0.5" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            <span>Keep daily notes about care, symptoms, and observations</span>
          </li>
          <li className="flex items-start">
            <FontAwesomeIcon icon={Icons.listItem} className="mr-3 opacity-55 mt-0.5" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            <span>See what matters today at a glance</span>
          </li>
          <li className="flex items-start">
            <FontAwesomeIcon icon={Icons.listItem} className="mr-3 opacity-55 mt-0.5" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            <span>Hand off responsibility clearly between caregivers</span>
          </li>
          <li className="flex items-start">
            <FontAwesomeIcon icon={Icons.listItem} className="mr-3 opacity-55 mt-0.5" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            <span>Reduce mental load during care transitions</span>
          </li>
        </ul>

        <p className="text-sm mb-8 leading-relaxed opacity-75" style={{ color: 'var(--text-secondary)' }}>
          No accounts. No setup. Just a shared care notebook.
        </p>

        <button 
          type="button"
          onClick={onStartNotebook}
          className="px-6 py-3 rounded-md text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors cursor-pointer"
          style={{ 
            backgroundColor: 'var(--button-bg)',
            color: 'var(--button-text)',
            '--tw-ring-color': 'var(--button-bg)',
          } as React.CSSProperties}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--button-bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--button-bg)';
          }}
          aria-label={hasNotebook ? "Open care notebook" : "Start care notebook"}
        >
          {hasNotebook ? 'Open care notebook' : 'Start care notebook'}
        </button>
      </section>
    </main>
  )
}

export default Landing

