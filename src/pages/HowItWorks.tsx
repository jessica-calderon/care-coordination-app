import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Icons } from '../ui/icons';

function HowItWorks() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <section className="px-6 py-12 max-w-2xl mx-auto" aria-labelledby="how-it-works-heading">
        <h1 id="how-it-works-heading" className="text-3xl md:text-4xl font-normal mb-6 leading-tight" style={{ color: 'var(--text-primary)' }}>
          How it works
        </h1>
        
        <div className="space-y-8 text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <div>
            <h2 className="text-xl font-normal mb-3 inline-flex items-center" style={{ color: 'var(--text-primary)' }}>
              <FontAwesomeIcon icon={Icons.quickNote} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
              Add notes
            </h2>
            <p>
              As things happen throughout the day, add quick notes about care, symptoms, observations, or anything that feels important. Notes are timestamped and show who added them.
            </p>
          </div>
          
          <div>
            <h2 className="text-xl font-normal mb-3 inline-flex items-center" style={{ color: 'var(--text-primary)' }}>
              <FontAwesomeIcon icon={Icons.tasks} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
              Track what matters
            </h2>
            <p>
              See what needs attention today at a glance. Add tasks or reminders for follow-up care, medications, appointments, or anything that needs to happen next.
            </p>
          </div>
          
          <div>
            <h2 className="text-xl font-normal mb-3 inline-flex items-center" style={{ color: 'var(--text-primary)' }}>
              <FontAwesomeIcon icon={Icons.handoff} className="mr-2 opacity-70" style={{ fontSize: '0.85em' }} aria-hidden="true" />
              Hand off care
            </h2>
            <p>
              When it's time to transition care to another caregiver, use the handoff feature to clearly indicate who is now responsible. This helps everyone know who's on duty and reduces confusion during shift changes.
            </p>
          </div>
          
          <div>
            <h2 className="text-xl font-normal mb-3" style={{ color: 'var(--text-primary)' }}>
              View history
            </h2>
            <p>
              Access notes from previous days to see patterns, track progress, or reference what happened earlier. Recent history is available right in the Today view.
            </p>
          </div>
          
          <div className="mt-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Note:</strong> All data is stored locally on your device. There's no cloud sync, no accounts, and no server. This means your care notes stay private and accessible only on the device where you use the app.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HowItWorks;

