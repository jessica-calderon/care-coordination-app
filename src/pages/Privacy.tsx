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
            Secure cloud storage
          </h2>
          
          <p>
            All care notes, tasks, and care team information are securely stored in Firebase. Your data is encrypted in transit and at rest, and is accessible only to those who have access to your care notebook.
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
            Your data is stored securely in the cloud, which means you can:
          </p>
          
          <ul className="space-y-2 ml-4 list-disc" style={{ color: 'var(--text-secondary)' }}>
            <li>Access your care notebook from any device with the notebook link</li>
            <li>Share access with family members and care team members</li>
            <li>Keep your data synchronized across all devices</li>
          </ul>
          
          <h2 className="text-xl font-normal mt-8 mb-4" style={{ color: 'var(--text-primary)' }}>
            Important considerations
          </h2>
          
          <div className="space-y-3">
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>Cloud-synced:</strong> Your data is stored securely in Firebase and automatically syncs across all devices where you access your care notebook.
            </p>
            
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>Notebook access:</strong> Access to your care notebook is controlled through the notebook link. Anyone with the link can view and edit the notebook.
            </p>
            
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>Data security:</strong> Your data is encrypted in transit and at rest using Firebase's security infrastructure.
            </p>
          </div>
          
          <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Questions?</strong> If you have questions about privacy or how your data is handled, please review Firebase's privacy and security documentation.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Privacy;

