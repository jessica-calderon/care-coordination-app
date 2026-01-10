import { useState, useEffect, useRef } from 'react';
import { InlineSpinner } from './InlineSpinner';

interface AddCaretakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  isSubmitting?: boolean;
}

function AddCaretakerModal({ isOpen, onClose, onSubmit, isSubmitting = false }: AddCaretakerModalProps) {
  const [caretakerName, setCaretakerName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCaretakerName('');
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } else {
      // Reset form when modal closes
      setCaretakerName('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    const trimmed = caretakerName.trim();
    if (!trimmed) return;

    try {
      await onSubmit(trimmed);
    } catch (error) {
      console.error('Failed to add caretaker:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-caretaker-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full p-6"
        style={{ 
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="add-caretaker-modal-title"
          className="text-xl font-normal mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Add Care Team Member
        </h2>
        <p
          className="text-sm mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          Enter the name of the person you'd like to add to the care team.
        </p>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <label htmlFor="caretaker-name-input" className="sr-only">
            Caretaker name
          </label>
          <input
            id="caretaker-name-input"
            ref={inputRef}
            type="text"
            value={caretakerName}
            onChange={(e) => setCaretakerName(e.target.value)}
            placeholder="Enter name…"
            className="w-full px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent mb-4"
            style={{
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              '--tw-ring-color': 'var(--focus-ring)',
            } as React.CSSProperties}
            required
            disabled={isSubmitting}
            aria-label="Caretaker name"
            aria-required="true"
          />
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'transparent',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              aria-label="Cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              style={{
                color: 'var(--button-secondary-text)',
                backgroundColor: 'var(--button-secondary-bg)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (!isSubmitting && caretakerName.trim()) {
                  e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
              }}
              aria-label="Add caretaker"
            >
              {isSubmitting ? (
                <>
                  <InlineSpinner size="sm" />
                  Adding...
                </>
              ) : (
                'Add'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddCaretakerModal;

