function About() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <section className="px-6 py-12 max-w-2xl mx-auto" aria-labelledby="about-heading">
        <h1 id="about-heading" className="text-3xl md:text-4xl font-normal mb-6 leading-tight" style={{ color: 'var(--text-primary)' }}>
          About Care Notebook
        </h1>
        
        <div className="space-y-6 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>
            Care Notebook is a simple, shared tool for families coordinating daily care. It helps caregivers stay connected, reduce mental load, and ensure nothing falls through the cracks.
          </p>
          
          <p>
            Whether you're caring for a loved one at home, managing shifts between family members, or coordinating with a care team, Care Notebook provides a calm, focused place to track what matters.
          </p>
          
          <h2 className="text-xl font-normal mt-8 mb-4" style={{ color: 'var(--text-primary)' }}>
            Our approach
          </h2>
          
          <p>
            We believe care coordination should be simple, not stressful. That's why Care Notebook:
          </p>
          
          <ul className="space-y-3 ml-4 list-disc" style={{ color: 'var(--text-secondary)' }}>
            <li>Requires no accounts or setup</li>
            <li>Securely syncs data across all your devices</li>
            <li>Focuses on what matters today</li>
            <li>Reduces complexity, not adds to it</li>
          </ul>
          
          <p className="mt-6">
            Care Notebook is designed for families who need a shared space to coordinate care, with secure cloud storage that keeps your data accessible and synchronized.
          </p>
        </div>
      </section>
    </main>
  );
}

export default About;




