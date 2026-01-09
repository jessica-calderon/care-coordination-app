interface FooterProps {
  onNavigateAbout?: () => void;
  onNavigateHowItWorks?: () => void;
  onNavigatePrivacy?: () => void;
}

function Footer({ onNavigateAbout, onNavigateHowItWorks, onNavigatePrivacy }: FooterProps) {
  const handleAboutClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onNavigateAbout?.();
  };

  const handleHowItWorksClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onNavigateHowItWorks?.();
  };

  const handlePrivacyClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onNavigatePrivacy?.();
  };

  return (
    <footer 
      className="border-t py-6 px-6" 
      style={{ 
        borderColor: 'var(--border-color)',
        backgroundColor: 'var(--bg-primary)'
      }}
      role="contentinfo"
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {/* Left: App name + tagline */}
          <div className="flex-shrink-0">
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              Care Notebook · v0.1.0
            </p>
            <p className="text-xs mt-0.5">
              Shared care, simply.
            </p>
          </div>

          {/* Center: Data clarity note */}
          <div className="flex-shrink-0 text-center sm:text-left">
            <small style={{ color: 'var(--text-muted)' }}>
              Stored only on this device
            </small>
          </div>

          {/* Right: Links */}
          <nav className="flex-shrink-0" aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-4 sm:gap-6">
              <li>
                <a
                  href="#"
                  onClick={handleAboutClick}
                  className="hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded px-1 transition-colors"
                  style={{ 
                    color: 'var(--text-muted)',
                    '--tw-ring-color': 'var(--focus-ring)',
                  } as React.CSSProperties}
                  aria-label="About Care Notebook"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href="#"
                  onClick={handleHowItWorksClick}
                  className="hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded px-1 transition-colors"
                  style={{ 
                    color: 'var(--text-muted)',
                    '--tw-ring-color': 'var(--focus-ring)',
                  } as React.CSSProperties}
                  aria-label="How it works"
                >
                  How it works
                </a>
              </li>
              <li>
                <a
                  href="#"
                  onClick={handlePrivacyClick}
                  className="hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded px-1 transition-colors"
                  style={{ 
                    color: 'var(--text-muted)',
                    '--tw-ring-color': 'var(--focus-ring)',
                  } as React.CSSProperties}
                  aria-label="Privacy information"
                >
                  Privacy
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

