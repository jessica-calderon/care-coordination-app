import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Caretaker } from '../domain/types';
import { dataAdapter } from '../storage';
import { Icons } from '../ui/icons';

function CareTeam() {
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [currentCaregiver, setCurrentCaregiver] = useState<string>('');
  const [newCaretakerName, setNewCaretakerName] = useState('');

  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      const todayState = await dataAdapter.loadToday();
      setCurrentCaregiver(todayState.currentCaregiver);
      const loadedCaretakers = todayState.caretakers || [];
      setCaretakers(loadedCaretakers);
    };
    loadState();
  }, []);

  const handleAddCaretaker = async () => {
    if (newCaretakerName.trim()) {
      try {
        await dataAdapter.addCaretaker(newCaretakerName.trim());
        setNewCaretakerName('');
        
        // Reload state from adapter
        const todayState = await dataAdapter.loadToday();
        const updatedCaretakers = todayState.caretakers || [];
        setCaretakers(updatedCaretakers);
        setCurrentCaregiver(todayState.currentCaregiver);
      } catch (error) {
        // Silently handle errors (e.g., duplicate caretaker)
        console.error('Failed to add caretaker:', error);
      }
    }
  };

  const handleArchiveCaretaker = async (name: string) => {
    try {
      await dataAdapter.archiveCaretaker(name);
      
      // Reload state from adapter
      const todayState = await dataAdapter.loadToday();
      const updatedCaretakers = todayState.caretakers || [];
      setCaretakers(updatedCaretakers);
      setCurrentCaregiver(todayState.currentCaregiver);
    } catch (error) {
      // Show error message (e.g., trying to archive primary or current caregiver)
      alert(error instanceof Error ? error.message : 'Cannot archive this caregiver');
    }
  };

  const handleRestoreCaretaker = async (name: string) => {
    try {
      await dataAdapter.restoreCaretaker(name);
      
      // Reload state from adapter
      const todayState = await dataAdapter.loadToday();
      const updatedCaretakers = todayState.caretakers || [];
      setCaretakers(updatedCaretakers);
      setCurrentCaregiver(todayState.currentCaregiver);
    } catch (error) {
      // Show error message
      alert(error instanceof Error ? error.message : 'Cannot restore this caregiver');
    }
  };

  const handleSetPrimaryCaretaker = async (name: string) => {
    try {
      await dataAdapter.setPrimaryCaretaker(name);
      
      // Reload state from adapter
      const todayState = await dataAdapter.loadToday();
      const updatedCaretakers = todayState.caretakers || [];
      setCaretakers(updatedCaretakers);
      setCurrentCaregiver(todayState.currentCaregiver);
    } catch (error) {
      // Show error message
      alert(error instanceof Error ? error.message : 'Cannot set this caregiver as primary');
    }
  };

  const activeCaretakers = caretakers.filter(c => c.isActive);
  const inactiveCaretakers = caretakers.filter(c => !c.isActive);

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-normal mb-8 leading-tight" style={{ color: 'var(--text-primary)' }}>
          Care Team
        </h1>

        <header className="mb-8 pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Manage the people who help care for Wela. Changes here affect everyone on the care team.
          </p>
        </header>

        {/* Active Caretakers Section */}
        <section className="mb-8" aria-labelledby="active-caretakers-heading">
          <h2 id="active-caretakers-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
            <FontAwesomeIcon icon={Icons.caregiver} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
            Active Care Team
          </h2>
          {activeCaretakers.length > 0 ? (
            <ul className="space-y-2 mb-6" role="list" aria-label="List of active caretakers">
              {activeCaretakers.map((caretaker) => {
                const isCurrent = caretaker.name === currentCaregiver;
                const isPrimary = caretaker.isPrimary;
                const canArchive = !isPrimary && !isCurrent;
                const canSetPrimary = !isPrimary;
                
                return (
                  <li key={caretaker.name} className="flex items-center justify-between gap-3 py-3 px-4 border rounded-lg" style={{ borderColor: 'var(--border-color)' }} role="listitem">
                    <div className="flex items-center gap-2 flex-1">
                      {isPrimary && (
                        <span className="text-base" aria-label="Primary contact" title="Primary contact">
                          ⭐
                        </span>
                      )}
                      <span className="text-base" style={{ color: 'var(--text-primary)' }}>
                        {caretaker.name}
                      </span>
                      {isCurrent && (
                        <span className="text-xs px-2 py-0.5 rounded" style={{ 
                          color: 'var(--text-secondary)',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)'
                        }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canSetPrimary && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryCaretaker(caretaker.name)}
                          className="text-sm px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
                          style={{ 
                            color: 'var(--text-secondary)',
                            backgroundColor: 'transparent',
                            '--tw-ring-color': 'var(--focus-ring)',
                          } as React.CSSProperties}
                          aria-label={`Set ${caretaker.name} as primary contact`}
                        >
                          Set as primary
                        </button>
                      )}
                      {canArchive ? (
                        <button
                          type="button"
                          onClick={() => handleArchiveCaretaker(caretaker.name)}
                          className="text-sm px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
                          style={{ 
                            color: 'var(--text-secondary)',
                            backgroundColor: 'transparent',
                            '--tw-ring-color': 'var(--focus-ring)',
                          } as React.CSSProperties}
                          aria-label={`Archive ${caretaker.name}`}
                        >
                          Archive
                        </button>
                      ) : (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }} title={isPrimary ? 'Cannot archive primary contact' : 'Cannot archive current caregiver'}>
                          {isPrimary ? 'Primary' : 'Current'}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-4 mb-6" role="status">
              <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                No active caretakers. Please restore a caretaker below or add a new one.
              </p>
            </div>
          )}
        </section>

        {/* Inactive Caretakers Section */}
        {inactiveCaretakers.length > 0 && (
          <section className="mb-8" aria-labelledby="inactive-caretakers-heading">
            <h2 id="inactive-caretakers-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
              Inactive
            </h2>
            <ul className="space-y-2" role="list" aria-label="List of inactive caretakers">
              {inactiveCaretakers.map((caretaker) => {
                return (
                  <li key={caretaker.name} className="flex items-center justify-between gap-3 py-3 px-4 border rounded-lg" style={{ borderColor: 'var(--border-color)' }} role="listitem">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-base" style={{ color: 'var(--text-muted)' }}>
                        {caretaker.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreCaretaker(caretaker.name)}
                      className="text-sm px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
                      style={{ 
                        color: 'var(--text-secondary)',
                        backgroundColor: 'transparent',
                        '--tw-ring-color': 'var(--focus-ring)',
                      } as React.CSSProperties}
                      aria-label={`Restore ${caretaker.name}`}
                    >
                      Restore
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Add Caretaker Section */}
        <section className="border-t pt-8 mt-8" style={{ borderColor: 'var(--border-color)' }} aria-labelledby="add-caretaker-heading">
          <h2 id="add-caretaker-heading" className="text-xl font-normal mb-4" style={{ color: 'var(--text-primary)' }}>
            Add Care Team Member
          </h2>
          <form 
            className="flex gap-2" 
            onSubmit={(e) => {
              e.preventDefault();
              handleAddCaretaker();
            }}
            aria-label="Add a new caretaker"
          >
            <input
              type="text"
              value={newCaretakerName}
              onChange={(e) => setNewCaretakerName(e.target.value)}
              placeholder="Enter name…"
              className="flex-1 px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ 
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              aria-label="Caretaker name"
            />
            <button
              type="submit"
              className="px-6 py-3 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80"
              style={{ 
                color: 'var(--button-secondary-text)',
                backgroundColor: 'var(--button-secondary-bg)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
              }}
              aria-label="Add caretaker"
            >
              Add
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

export default CareTeam;

