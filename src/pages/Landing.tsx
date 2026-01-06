interface LandingProps {
  onStartNotebook: () => void
}

function Landing({ onStartNotebook }: LandingProps) {
  return (
    <main className="min-h-screen bg-white">
      <section className="px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-normal text-gray-900 mb-6 leading-tight">
          Care, shared simply.
        </h1>
        
        <p className="text-lg md:text-xl text-gray-700 mb-8 leading-relaxed">
          A calm place for family caregivers to keep track of daily care and hand off responsibility without stress.
        </p>

        <ul className="space-y-4 mb-10 text-gray-700">
          <li className="flex items-start">
            <span className="mr-3 text-gray-500">•</span>
            <span>Keep daily notes about care, symptoms, and tasks</span>
          </li>
          <li className="flex items-start">
            <span className="mr-3 text-gray-500">•</span>
            <span>See what matters today at a glance</span>
          </li>
          <li className="flex items-start">
            <span className="mr-3 text-gray-500">•</span>
            <span>Share responsibility with family</span>
          </li>
          <li className="flex items-start">
            <span className="mr-3 text-gray-500">•</span>
            <span>Reduce mental load during handoffs</span>
          </li>
        </ul>

        <button 
          onClick={onStartNotebook}
          className="bg-gray-900 text-white px-6 py-3 rounded-md text-base font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
        >
          Start a care notebook
        </button>
      </section>
    </main>
  )
}

export default Landing

