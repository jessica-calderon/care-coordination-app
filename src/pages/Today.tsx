import { useState } from 'react'
import { todayData, type CareNote } from '../mock/todayData'

function Today() {
  const [careNotes, setCareNotes] = useState<CareNote[]>(todayData.careNotes)
  const [noteText, setNoteText] = useState('')

  const formatTime = (date: Date): string => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    const displayMinutes = minutes.toString().padStart(2, '0')
    return `${displayHours}:${displayMinutes} ${ampm}`
  }

  const handleAddNote = () => {
    if (noteText.trim()) {
      const newNote: CareNote = {
        time: formatTime(new Date()),
        note: noteText.trim()
      }
      setCareNotes([newNote, ...careNotes])
      setNoteText('')
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="px-6 py-8 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-normal text-gray-900 mb-8 leading-tight">
          Today
        </h1>

        {/* Quick Note Section */}
        <section className="mb-10">
          <h2 className="text-xl font-normal text-gray-900 mb-4">
            Quick note
          </h2>
          <div className="space-y-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about care, symptoms, or anything that feels important…"
              className="w-full px-4 py-3 text-base text-gray-800 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-y min-h-[100px] leading-relaxed"
              rows={4}
            />
            <button
              onClick={handleAddNote}
              className="w-full sm:w-auto px-6 py-3 text-base font-medium text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Add note
            </button>
          </div>
        </section>

        {/* Care Notes Section */}
        <section className="mb-10">
          <h2 className="text-xl font-normal text-gray-900 mb-4">
            Care Notes
          </h2>
          <div className="space-y-4">
            {careNotes.map((note, index) => (
              <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                <div className="flex items-start gap-3">
                  <time className="text-sm text-gray-600 font-medium whitespace-nowrap">
                    {note.time}
                  </time>
                  <p className="text-base text-gray-800 leading-relaxed flex-1">
                    {note.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What matters next Section */}
        <section className="mb-10">
          <h2 className="text-xl font-normal text-gray-900 mb-4">
            What matters next
          </h2>
          <ul className="space-y-3">
            {todayData.tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={task.id}
                  checked={task.completed}
                  readOnly
                  className="mt-1 w-5 h-5 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 cursor-pointer"
                  aria-label={task.text}
                />
                <label
                  htmlFor={task.id}
                  className={`text-base leading-relaxed flex-1 cursor-pointer ${
                    task.completed ? 'text-gray-500 line-through' : 'text-gray-800'
                  }`}
                >
                  {task.text}
                </label>
              </li>
            ))}
          </ul>
        </section>

        {/* Handoff Section */}
        <section className="border-t border-gray-200 pt-6">
          <h2 className="text-xl font-normal text-gray-900 mb-4">
            Handoff
          </h2>
          <div className="space-y-2 text-base text-gray-700">
            <p>
              Last updated by: <span className="font-medium text-gray-900">{todayData.lastUpdatedBy}</span>
            </p>
            <p>
              Current caregiver: <span className="font-medium text-gray-900">{todayData.currentCaregiver}</span>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

export default Today

