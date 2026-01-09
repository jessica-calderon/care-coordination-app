import { useState, useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { Caretaker } from '../domain/types';
import { useDataAdapter } from '../storage/DataAdapterContext';
import { createFirebaseAdapter } from '../storage';
import { resolveNotebookId } from '../utils/notebookId';
import { addCaretaker as addCaretakerDomain, archiveCaretaker as archiveCaretakerDomain, restoreCaretaker as restoreCaretakerDomain, setPrimaryCaretaker as setPrimaryCaretakerDomain } from '../domain/notebook';
import { Icons } from '../ui/icons';
import { Spinner } from '../components/Spinner';
import { InlineSpinner } from '../components/InlineSpinner';

function CareTeam() {
  const dataAdapter = useDataAdapter();
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [currentCaregiver, setCurrentCaregiver] = useState<string>('');
  const [newCaretakerName, setNewCaretakerName] = useState('');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isAddingCaretaker, setIsAddingCaretaker] = useState(false);
  const [archivingCaretaker, setArchivingCaretaker] = useState<string | null>(null);
  const [restoringCaretaker, setRestoringCaretaker] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [careeName, setCareeName] = useState<string>('Care recipient');
  const [editingCaretakerId, setEditingCaretakerId] = useState<string | null>(null);
  const [editingCaretakerName, setEditingCaretakerName] = useState<string>('');
  const [updatingCaretakerName, setUpdatingCaretakerName] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const handleStartEditCaretaker = (caretaker: Caretaker) => {
    setEditingCaretakerId(caretaker.id);
    setEditingCaretakerName(caretaker.name);
  };

  const handleCancelEditCaretaker = () => {
    setEditingCaretakerId(null);
    setEditingCaretakerName('');
  };

  const handleSaveEditCaretaker = async (oldName: string) => {
    const trimmedNewName = editingCaretakerName.trim();
    if (!trimmedNewName || trimmedNewName === oldName) {
      handleCancelEditCaretaker();
      return;
    }

    try {
      setUpdatingCaretakerName(oldName);
      await dataAdapter.updateCaretakerName(oldName, trimmedNewName);
      
      // Reload caretakers and current caregiver
      const updatedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(updatedCaretakers);
      
      const todayState = await dataAdapter.loadToday();
      setCurrentCaregiver(todayState.currentCaregiver);
      
      handleCancelEditCaretaker();
    } catch (error) {
      // Handle errors
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      alert(error instanceof Error ? error.message : 'Failed to update caretaker name');
    } finally {
      setUpdatingCaretakerName(null);
    }
  };

  // Load initial state (only once on mount)
  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;
    
    const loadState = async () => {
      try {
        setIsInitialLoading(true);
        // Load caretakers directly from Firebase (authoritative source)
        // CARETAKERS CANONICAL LOCATION: /notebooks/{notebookId}/caretakers collection
        const loadedCaretakers = await dataAdapter.getCaretakers();
        setCaretakers(loadedCaretakers);
        
        // Load current caregiver from today state
        const todayState = await dataAdapter.loadToday();
        setCurrentCaregiver(todayState.currentCaregiver);
        
        // Load careeName from notebook metadata
        const notebookId = resolveNotebookId();
        if (notebookId) {
          const adapter = createFirebaseAdapter(notebookId);
          const metadata = await adapter.getNotebookMetadata();
          setCareeName(metadata.careeName);
        }
      } catch (error) {
        // Log errors for debugging
        console.error('Error loading CareTeam state:', error);
        // Ensure loading state is cleared even on error
        setIsInitialLoading(false);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run once on mount

  const handleAddCaretaker = async () => {
    if (newCaretakerName.trim() && !isAddingCaretaker) {
      try {
        setIsAddingCaretaker(true);
        const trimmedName = newCaretakerName.trim();
        
        // Optimistically update UI using domain function
        const optimisticCaretakers = addCaretakerDomain(caretakers, trimmedName);
        const wasAdded = optimisticCaretakers.length > caretakers.length;
        
        if (wasAdded) {
          setCaretakers(optimisticCaretakers);
          setNewCaretakerName('');
        }
        
        // Write to Firebase
        await dataAdapter.addCaretaker(trimmedName);
        
        // Re-fetch from Firebase to ensure consistency
        const updatedCaretakers = await dataAdapter.getCaretakers();
        
        // Verify the new caretaker is in the re-fetched data
        // If not, keep the optimistic update (handles race conditions)
        const hasNewCaretaker = updatedCaretakers.some(
          c => c.name.toLowerCase() === trimmedName.toLowerCase()
        );
        
        if (hasNewCaretaker || updatedCaretakers.length >= optimisticCaretakers.length) {
          // Re-fetch succeeded and has the new caretaker, or has at least as many
          setCaretakers(updatedCaretakers);
        } else if (wasAdded) {
          // Re-fetch doesn't have the new caretaker yet, keep optimistic update
          // This can happen due to Firestore eventual consistency
          // Keep the optimistic state - it will sync on next page load or refresh
        }
        
        // Reload current caregiver from today state
        const todayState = await dataAdapter.loadToday();
        setCurrentCaregiver(todayState.currentCaregiver);
      } catch (error) {
        // On error, revert to Firebase state
        if (error instanceof Error && error.name === 'AbortError') {
          // Ignore AbortError - request was cancelled
          return;
        }
        const updatedCaretakers = await dataAdapter.getCaretakers();
        setCaretakers(updatedCaretakers);
        // Silently handle errors (e.g., duplicate caretaker)
      } finally {
        setIsAddingCaretaker(false);
      }
    }
  };

  const handleArchiveCaretaker = async (name: string) => {
    if (archivingCaretaker === name) return;
    
    try {
      setArchivingCaretaker(name);
      // Optimistically update UI using domain function
      const { caretakers: optimisticCaretakers, canArchive } = archiveCaretakerDomain(caretakers, name, currentCaregiver);
      if (canArchive) {
        setCaretakers(optimisticCaretakers);
      }
      
      // Write to Firebase
      await dataAdapter.archiveCaretaker(name);
      
      // Re-fetch from Firebase to ensure consistency
      const updatedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(updatedCaretakers);
      
      // Reload current caregiver from today state
      const todayState = await dataAdapter.loadToday();
      setCurrentCaregiver(todayState.currentCaregiver);
    } catch (error) {
      // Handle AbortError - request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // On error, revert to Firebase state
      const updatedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(updatedCaretakers);
      // Show error message (e.g., trying to archive primary or current caregiver)
      alert(error instanceof Error ? error.message : 'Cannot archive this caregiver');
    } finally {
      setArchivingCaretaker(null);
    }
  };

  const handleRestoreCaretaker = async (name: string) => {
    if (restoringCaretaker === name) return;
    
    try {
      setRestoringCaretaker(name);
      // Optimistically update UI using domain function
      const { caretakers: optimisticCaretakers, canRestore } = restoreCaretakerDomain(caretakers, name);
      if (canRestore) {
        setCaretakers(optimisticCaretakers);
      }
      
      // Write to Firebase
      await dataAdapter.restoreCaretaker(name);
      
      // Re-fetch from Firebase to ensure consistency
      const updatedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(updatedCaretakers);
      
      // Reload current caregiver from today state
      const todayState = await dataAdapter.loadToday();
      setCurrentCaregiver(todayState.currentCaregiver);
    } catch (error) {
      // Handle AbortError - request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // On error, revert to Firebase state
      const updatedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(updatedCaretakers);
      // Show error message
      alert(error instanceof Error ? error.message : 'Cannot restore this caregiver');
    } finally {
      setRestoringCaretaker(null);
    }
  };

  const handleSetPrimaryCaretaker = async (name: string) => {
    if (settingPrimary === name) return;
    
    try {
      setSettingPrimary(name);
      // Optimistically update UI using domain function
      const { caretakers: optimisticCaretakers, canSetPrimary } = setPrimaryCaretakerDomain(caretakers, name);
      if (canSetPrimary) {
        setCaretakers(optimisticCaretakers);
      }
      
      // Write to Firebase
      await dataAdapter.setPrimaryCaretaker(name);
      
      // Re-fetch from Firebase to ensure consistency
      const updatedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(updatedCaretakers);
      
      // Reload current caregiver from today state
      const todayState = await dataAdapter.loadToday();
      setCurrentCaregiver(todayState.currentCaregiver);
    } catch (error) {
      // Handle AbortError - request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      // On error, revert to Firebase state
      const updatedCaretakers = await dataAdapter.getCaretakers();
      setCaretakers(updatedCaretakers);
      // Show error message
      alert(error instanceof Error ? error.message : 'Cannot set this caregiver as primary');
    } finally {
      setSettingPrimary(null);
    }
  };

  const activeCaretakers = useMemo(() => {
    return caretakers.filter(c => c.isActive);
  }, [caretakers]);
  
  const inactiveCaretakers = useMemo(() => {
    return caretakers.filter(c => !c.isActive);
  }, [caretakers]);

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="px-6 py-8 max-w-2xl mx-auto">
        {isInitialLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
        <h1 className="text-3xl md:text-4xl font-normal mb-8 leading-tight" style={{ color: 'var(--text-primary)' }}>
          Care Team for {careeName}
        </h1>

        <header className="mb-8 pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Manage the people who help care for {careeName}. Changes here affect everyone on the care team.
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
                  <li key={caretaker.id} className="flex items-center justify-between gap-3 py-3 px-4 border rounded-lg" style={{ borderColor: 'var(--border-color)' }} role="listitem">
                    <div className="flex items-center gap-2 flex-1">
                      {isPrimary && (
                        <span className="text-base" aria-label="Primary contact" title="Primary contact">
                          ⭐
                        </span>
                      )}
                      {editingCaretakerId === caretaker.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingCaretakerName}
                            onChange={(e) => setEditingCaretakerName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEditCaretaker(caretaker.name);
                              } else if (e.key === 'Escape') {
                                handleCancelEditCaretaker();
                              }
                            }}
                            className="flex-1 px-2 py-1 text-base rounded border focus:outline-none focus:ring-2 focus:border-transparent"
                            style={{
                              color: 'var(--text-primary)',
                              backgroundColor: 'var(--bg-primary)',
                              borderColor: 'var(--border-color)',
                              '--tw-ring-color': 'var(--focus-ring)',
                            } as React.CSSProperties}
                            autoFocus
                            disabled={updatingCaretakerName === caretaker.name}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditCaretaker(caretaker.name)}
                            disabled={updatingCaretakerName === caretaker.name}
                            className="text-sm px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              color: 'var(--button-secondary-text)',
                              backgroundColor: 'var(--button-secondary-bg)',
                              '--tw-ring-color': 'var(--focus-ring)',
                            } as React.CSSProperties}
                            aria-label="Save caretaker name"
                          >
                            {updatingCaretakerName === caretaker.name ? (
                              <InlineSpinner size="sm" />
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditCaretaker}
                            disabled={updatingCaretakerName === caretaker.name}
                            className="text-sm px-2 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              color: 'var(--text-secondary)',
                              backgroundColor: 'transparent',
                              '--tw-ring-color': 'var(--focus-ring)',
                            } as React.CSSProperties}
                            aria-label="Cancel editing"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingCaretakerId !== caretaker.id && (
                        <button
                          type="button"
                          onClick={() => handleStartEditCaretaker(caretaker)}
                          className="text-sm px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 inline-flex items-center gap-2"
                          style={{ 
                            color: 'var(--text-secondary)',
                            backgroundColor: 'transparent',
                            '--tw-ring-color': 'var(--focus-ring)',
                          } as React.CSSProperties}
                          aria-label={`Edit ${caretaker.name}'s name`}
                          title="Edit name"
                        >
                          <FontAwesomeIcon 
                            icon={Icons.quickNote} 
                            style={{ fontSize: '0.75em' }} 
                            aria-hidden="true" 
                          />
                        </button>
                      )}
                      {canSetPrimary && editingCaretakerId !== caretaker.id && (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryCaretaker(caretaker.name)}
                          disabled={settingPrimary === caretaker.name}
                          className="text-sm px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                          style={{ 
                            color: 'var(--text-secondary)',
                            backgroundColor: 'transparent',
                            '--tw-ring-color': 'var(--focus-ring)',
                          } as React.CSSProperties}
                          aria-label={`Set ${caretaker.name} as primary contact`}
                        >
                          {settingPrimary === caretaker.name && <InlineSpinner size="sm" />}
                          Set as primary
                        </button>
                      )}
                      {canArchive && editingCaretakerId !== caretaker.id ? (
                        <button
                          type="button"
                          onClick={() => handleArchiveCaretaker(caretaker.name)}
                          disabled={archivingCaretaker === caretaker.name}
                          className="text-sm px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                          style={{ 
                            color: 'var(--text-secondary)',
                            backgroundColor: 'transparent',
                            '--tw-ring-color': 'var(--focus-ring)',
                          } as React.CSSProperties}
                          aria-label={`Archive ${caretaker.name}`}
                        >
                          {archivingCaretaker === caretaker.name && <InlineSpinner size="sm" />}
                          Archive
                        </button>
                      ) : editingCaretakerId !== caretaker.id ? (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }} title={isPrimary ? 'Cannot archive primary contact' : 'Cannot archive current caregiver'}>
                          {isPrimary ? 'Primary' : 'Current'}
                        </span>
                      ) : null}
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
                  <li key={caretaker.id} className="flex items-center justify-between gap-3 py-3 px-4 border rounded-lg" style={{ borderColor: 'var(--border-color)' }} role="listitem">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-base" style={{ color: 'var(--text-muted)' }}>
                        {caretaker.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestoreCaretaker(caretaker.name)}
                      disabled={restoringCaretaker === caretaker.name}
                      className="text-sm px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                      style={{ 
                        color: 'var(--text-secondary)',
                        backgroundColor: 'transparent',
                        '--tw-ring-color': 'var(--focus-ring)',
                      } as React.CSSProperties}
                      aria-label={`Restore ${caretaker.name}`}
                    >
                      {restoringCaretaker === caretaker.name && <InlineSpinner size="sm" />}
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
          </>
        )}
      </div>
    </main>
  );
}

export default CareTeam;

