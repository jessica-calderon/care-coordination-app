import { Spinner } from './Spinner';

interface InlineSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Inline spinner for use within buttons or inline actions.
 * Maintains layout space to prevent shift.
 */
export function InlineSpinner({ size = 'sm', className = '' }: InlineSpinnerProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Spinner size={size} />
    </span>
  );
}

