import React, { useEffect, useState } from 'react'
import { getStreakCalendar } from '../utils/storage'

export default function StreakCalendar({ days = 30 }) {
  const [cal, setCal] = useState([])
  useEffect(() => { (async () => setCal(await getStreakCalendar(days)))() }, [days])

  return (
    <div className="grid grid-cols-7 gap-1" aria-label="Streak calendar">
      {cal.map(c => (
        <div key={c.date} title={c.date} className={`w-6 h-6 rounded ${c.success ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`} />
      ))}
    </div>
  )
}
