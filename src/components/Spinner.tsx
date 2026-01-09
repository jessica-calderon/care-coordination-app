type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
}

const sizeMap: Record<SpinnerSize, { width: string; height: string; borderWidth: string }> = {
  sm: { width: '1rem', height: '1rem', borderWidth: '2px' },
  md: { width: '1.5rem', height: '1.5rem', borderWidth: '2px' },
  lg: { width: '2rem', height: '2rem', borderWidth: '3px' },
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const dimensions = sizeMap[size];

  return (
    <div
      className={`inline-block ${className}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div
        className="rounded-full border-solid animate-spin"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          borderWidth: dimensions.borderWidth,
          borderTopColor: 'var(--text-muted)',
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: 'transparent',
        }}
        aria-hidden="true"
      />
    </div>
  );
}

