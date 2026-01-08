function Privacy() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <section className="px-6 py-12 max-w-2xl mx-auto" aria-labelledby="privacy-heading">
        <h1 id="privacy-heading" className="text-3xl md:text-4xl font-normal mb-6 leading-tight" style={{ color: 'var(--text-primary)' }}>
          Privacy
        </h1>
        
        <div className="space-y-6 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>
            Your privacy is important to us. Care Notebook is designed with privacy as a core principle.
          </p>
          
          <h2 className="text-xl font-normal mt-8 mb-4" style={{ color: 'var(--text-primary)' }}>
            Local storage only
          </h2>
          
          <p>
            All care notes, tasks, and care team information are stored locally on your device using your browser's localStorage. Nothing is sent to any server, cloud service, or third party.
          </p>
          
          <h2 className="text-xl font-normal mt-8 mb-4" style={{ color: 'var(--text-primary)' }}>
            No accounts or authentication
          </h2>
          
          <p>
            Care Notebook doesn't require you to create an account, provide an email address, or authenticate in any way. There's no user database, no login system, and no way for us to identify you or access your data.
          </p>
          
          <h2 className="text-xl font-normal mt-8 mb-4" style={{ color: 'var(--text-primary)' }}>
            No tracking or analytics
          </h2>
          
          <p>
            We don't track your usage, collect analytics, or use any third-party services that might track you. The app runs entirely in your browser with no external connections for data collection.
          </p>
          
          <h2 className="text-xl font-normal mt-8 mb-4" style={{ color: 'var(--text-primary)' }}>
            Your data, your control
          </h2>
          
          <p>
            Since all data is stored locally on your device, you have complete control. You can:
          </p>
          
          <ul className="space-y-2 ml-4 list-disc" style={{ color: 'var(--text-secondary)' }}>
            <li>Clear your browser data to remove all care notes</li>
            <li>Export or backup data by accessing your browser's developer tools</li>
            <li>Use the app on multiple devices, but note that data won't sync between them</li>
          </ul>
          
          <h2 className="text-xl font-normal mt-8 mb-4" style={{ color: 'var(--text-primary)' }}>
            Important considerations
          </h2>
          
          <div className="space-y-3">
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>Device-specific:</strong> Data stored on one device won't automatically appear on another. Each device maintains its own separate care notebook.
            </p>
            
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>Browser data:</strong> If you clear your browser's local storage or use private/incognito mode, your care notes will be cleared.
            </p>
            
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>Shared devices:</strong> If multiple people use the same device and browser, they'll share the same care notebook data.
            </p>
          </div>
          
          <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Questions?</strong> If you have questions about privacy or how your data is handled, please review your browser's documentation on localStorage and local data storage.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Privacy;

