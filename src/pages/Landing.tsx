import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Icons } from '../ui/icons';
import type { NotebookIndex } from '../domain/notebook';
import { generateNotebookDisplayName } from '../domain/notebook';
import { createFirebaseAdapter } from '../storage';

interface LandingProps {
  onStartNotebook: () => void
  onSwitchNotebook: (notebookId: string) => void
  onCreateAnotherNotebook: () => void
  notebookIndex: NotebookIndex
}

function Landing({ onStartNotebook, onSwitchNotebook, onCreateAnotherNotebook, notebookIndex }: LandingProps) {
  const hasNotebooks = notebookIndex.length > 0;
  const [careeNames, setCareeNames] = useState<Record<string, string>>({});

  // Load caree names for all notebooks
  useEffect(() => {
    const loadCareeNames = async () => {
      const names: Record<string, string> = {};
      await Promise.all(
        notebookIndex.map(async (entry) => {
          try {
            const adapter = createFirebaseAdapter(entry.id);
            const metadata = await adapter.getNotebookMetadata();
            names[entry.id] = metadata.careeName;
          } catch (error) {
            // Silently handle errors - use fallback
            names[entry.id] = 'Care recipient';
          }
        })
      );
      setCareeNames(names);
    };

    if (hasNotebooks) {
      loadCareeNames();
    }
  }, [notebookIndex, hasNotebooks]);

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <section className="px-6 py-12 max-w-2xl mx-auto" aria-labelledby="landing-heading">
        <h1 id="landing-heading" className="text-3xl md:text-4xl font-normal mb-6 leading-tight" style={{ color: 'var(--text-primary)' }}>
          Care, shared simply.
        </h1>
        
        <p className="text-lg md:text-xl mb-8 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          A calm, shared notebook for families coordinating daily care — notes, tasks, and handoffs, all in one place.
        </p>

        {hasNotebooks ? (
          <>
            <div className="mb-8">
              <h2 className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
                Your care notebooks
              </h2>
              <ul className="space-y-3 mb-6" role="list">
                {notebookIndex.map((entry) => {
                  const careeName = careeNames[entry.id] || 'Care recipient';
                  const displayName = `${careeName}'s notebook`;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => onSwitchNotebook(entry.id)}
                        className="w-full px-4 py-3 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors cursor-pointer hover:opacity-80 border"
                        style={{ 
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--border-color)',
                          '--tw-ring-color': 'var(--button-bg)',
                        } as React.CSSProperties}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--button-bg-hover)';
                          e.currentTarget.style.color = 'var(--button-text)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        aria-label={`Continue with ${displayName}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{displayName}</span>
                          <FontAwesomeIcon 
                            icon={Icons.back} 
                            className="opacity-60 transform rotate-180" 
                            style={{ fontSize: '0.85em' }} 
                            aria-hidden="true" 
                          />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <button 
              type="button"
              onClick={onCreateAnotherNotebook}
              className="px-6 py-3 rounded-md text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors cursor-pointer hover:opacity-80"
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
              aria-label="Start another care notebook"
            >
              Start another care notebook
            </button>
          </>
        ) : (
          <>
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
              className="px-6 py-3 rounded-md text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors cursor-pointer hover:opacity-80"
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
              aria-label="Start care notebook"
            >
              Start care notebook
            </button>
          </>
        )}
      </section>
    </main>
  )
}

export default Landing

