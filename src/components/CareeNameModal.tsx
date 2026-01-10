import { useState, useEffect, useRef } from 'react';
import { Spinner } from './Spinner';

interface CareeNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (careeName: string) => Promise<void>;
  initialValue?: string;
  title?: string;
  submitLabel?: string;
}

function CareeNameModal({ isOpen, onClose, onSubmit, initialValue = '', title, submitLabel }: CareeNameModalProps) {
  const [careeName, setCareeName] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCareeName(initialValue);
      setIsSubmitting(false);
      setError(null);
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isOpen, initialValue]);

  const handleCreate = async () => {
    if (!careeName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(careeName.trim());
      closeModal();
    } catch (err) {
      console.error('Notebook creation failed', err);
      setError('Unable to create notebook. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleCreate();
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setCareeName('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={closeModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="caree-name-modal-title"
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
          id="caree-name-modal-title"
          className="text-xl font-normal mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          {title || 'Start new notebook'}
        </h2>
        <p
          className="text-sm mb-4"
          style={{ color: 'var(--text-secondary)' }}
        >
          Who are you caring for?
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="caree-name-input" className="sr-only">
            Care recipient name
          </label>
          <input
            id="caree-name-input"
            ref={inputRef}
            type="text"
            value={careeName}
            onChange={(e) => setCareeName(e.target.value)}
            placeholder="e.g. Mom, Dad, Wela"
            className="w-full px-4 py-3 text-base rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent mb-4"
            style={{
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              '--tw-ring-color': 'var(--focus-ring)',
            } as React.CSSProperties}
            required
            disabled={isSubmitting}
            aria-label="Care recipient name"
            aria-required="true"
          />
          {error && (
            <div className="mb-4 text-sm" style={{ color: 'var(--text-error)' }}>
              {error}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={closeModal}
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
              type="submit"
              disabled={isSubmitting || !careeName.trim()}
              className="px-6 py-2 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                color: 'var(--button-secondary-text)',
                backgroundColor: 'var(--button-secondary-bg)',
                '--tw-ring-color': 'var(--focus-ring)',
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                if (!isSubmitting && careeName.trim()) {
                  e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--button-secondary-bg)';
              }}
              aria-label={submitLabel || 'Create notebook'}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" />
                  Creating…
                </span>
              ) : (
                (submitLabel || 'Create notebook')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CareeNameModal;

