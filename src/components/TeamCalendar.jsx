import { useState } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { LEAVE_TYPES, getDatesInRange } from '../utils/leaveUtils'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function TeamCalendar({ leaves, holidays, employees }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [tooltip, setTooltip] = useState(null)

  const holidaySet = new Set(
    holidays.filter(h => {
      const d = new Date(h.date + 'T12:00:00')
      return d.getFullYear() === year && d.getMonth() === month
    }).map(h => h.date)
  )
  const holidayMap = {}
  holidays.forEach(h => { holidayMap[h.date] = h.name })

  // Build a map: date -> list of leave entries
  const leaveMap = {}
  leaves.filter(l => l.status === 'approved' || l.status === 'pending').forEach(l => {
    const dates = getDatesInRange(l.startDate, l.endDate)
    dates.forEach(d => {
      if (!leaveMap[d]) leaveMap[d] = []
      leaveMap[d].push(l)
    })
  })

  const empMap = {}
  employees.forEach(e => { empMap[e.id] = e })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const todayStr = today.toISOString().slice(0, 10)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <h2 className="font-bold text-stone-800 text-base">{MONTHS[month]} {year}</h2>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()) }}
            className="px-3 py-1 rounded-lg text-xs font-semibold hover:bg-stone-100 text-stone-600 transition-colors"
          >
            Today
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-5 py-2.5 border-b border-stone-100 bg-stone-50/50">
        {Object.entries(LEAVE_TYPES).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-stone-600">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />
            {v.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-200" />
          Public Holiday
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-stone-100">
        {DAYS.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-stone-400 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7" style={{ borderTop: '1px solid #f0ede8' }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="cal-day other-month" />
          const mm = String(month + 1).padStart(2, '0')
          const dd = String(day).padStart(2, '0')
          const dateStr = `${year}-${mm}-${dd}`
          const isToday = dateStr === todayStr
          const isWeekend = i % 7 === 0 || i % 7 === 6
          const isHol = holidaySet.has(dateStr)
          const dayLeaves = leaveMap[dateStr] || []

          let cls = 'cal-day '
          if (isToday) cls += 'today '
          else if (isHol) cls += 'holiday '
          else if (isWeekend) cls += 'weekend '

          return (
            <div key={dateStr} className={cls}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-amber-500 text-white' : 'text-stone-500'
                }`}>
                  {day}
                </span>
                {isHol && (
                  <span className="text-amber-600 cursor-pointer tooltip">
                    <Info size={10} />
                    <span className="tooltip-text">{holidayMap[dateStr]}</span>
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayLeaves.slice(0, 3).map((l, idx) => {
                  const lt = LEAVE_TYPES[l.type]
                  const emp = empMap[l.userId]
                  const name = emp?.name || l.userName || 'Unknown'
                  const isPending = l.status === 'pending'
                  return (
                    <div
                      key={idx}
                      className="leave-chip cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        background: lt?.bg || '#f3f4f6',
                        color: lt?.text || '#374151',
                        borderLeft: `2px solid ${lt?.color || '#9ca3af'}`,
                        opacity: isPending ? 0.65 : 1,
                        fontStyle: isPending ? 'italic' : 'normal',
                      }}
                      title={`${name} — ${lt?.label}${isPending ? ' (pending)' : ''}${l.isHalfDay ? ` (half day ${l.halfDayPeriod})` : ''}`}
                    >
                      {name.split(' ')[0]}
                    </div>
                  )
                })}
                {dayLeaves.length > 3 && (
                  <div className="text-xs text-stone-400 font-medium">+{dayLeaves.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
