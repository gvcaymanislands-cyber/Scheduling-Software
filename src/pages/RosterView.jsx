import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import {
  LEAVE_TYPES, CAYMAN_HOLIDAYS,
  getWeekStart, getWeekDates, DAY_NAMES
} from '../utils/leaveUtils'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']

// View modes
const VIEWS = { week: 'Week', month: 'Month' }

export default function RosterView() {
  const { isAdmin } = useAuth()
  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])
  const [rosters, setRosters] = useState([])
  const [holidays, setHolidays] = useState([])
  const [view, setView] = useState('week')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0, 10)
  const year = new Date().getFullYear()

  useEffect(() => {
    const eUnsub = onSnapshot(
      query(collection(db, 'users'), where('isHidden', '==', false)),
      snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.isActive !== false))
    )
    const lUnsub = onSnapshot(
      query(collection(db, 'leaves'), where('year', '==', year)),
      snap => setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const hUnsub = onSnapshot(collection(db, 'holidays'), snap => {
      if (snap.docs.length > 0) {
        setHolidays(snap.docs.map(d => d.data().date))
      } else {
        const defaults = [...(CAYMAN_HOLIDAYS[year] || []), ...(CAYMAN_HOLIDAYS[year+1] || [])]
        setHolidays(defaults.map(h => h.date))
      }
    })
    const rUnsub = onSnapshot(collection(db, 'weeklyRosters'),
      snap => {
        setRosters(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }
    )
    return () => { eUnsub(); lUnsub(); hUnsub(); rUnsub() }
  }, [year])

  // Generate the dates to display
  const getDates = () => {
    if (view === 'week') {
      const base = getWeekStart(today)
      const d = new Date(base + 'T12:00:00')
      d.setDate(d.getDate() + offset * 7)
      return getWeekDates(d.toISOString().slice(0, 10))
    } else {
      // Month view
      const d = new Date(year, new Date().getMonth() + offset, 1)
      const m = d.getMonth()
      const y = d.getFullYear()
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const dates = []
      for (let i = 1; i <= daysInMonth; i++) {
        dates.push(`${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`)
      }
      return dates
    }
  }

  const dates = getDates()

  const periodLabel = () => {
    if (view === 'week') {
      const start = new Date(dates[0] + 'T12:00:00')
      const end = new Date(dates[6] + 'T12:00:00')
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString('en', { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
      }
      return `${start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      const d = new Date(dates[0] + 'T12:00:00')
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    }
  }

  // Determine the status of an employee on a given date
  const getStatus = (emp, dateStr) => {
    const dayNum = new Date(dateStr + 'T12:00:00').getDay()
    const isHoliday = holidays.includes(dateStr)

    if (isHoliday) return { type: 'holiday', label: 'Holiday' }

    // Check approved/pending leaves
    const leave = leaves.find(l =>
      l.userId === emp.id &&
      l.status !== 'cancelled' &&
      l.status !== 'declined' &&
      l.startDate <= dateStr &&
      l.endDate >= dateStr
    )
    if (leave) {
      const lt = LEAVE_TYPES[leave.type]
      return {
        type: 'leave',
        leaveType: leave.type,
        label: lt?.label || leave.type,
        status: leave.status,
        isHalfDay: leave.isHalfDay,
        halfDayPeriod: leave.halfDayPeriod,
        color: lt?.color,
        bg: lt?.bg,
        text: lt?.text,
      }
    }

    // Check schedule
    const schedule = emp.workSchedule || { type: 'fixed', workingDays: [1,2,3,4,5] }

    if (schedule.type === 'fixed') {
      const workDays = schedule.workingDays || [1,2,3,4,5]
      if (!workDays.includes(dayNum)) return { type: 'off', label: 'Day Off' }
      return { type: 'working', label: 'Working' }
    } else {
      // Variable — check roster
      const roster = rosters.find(r => r.userId === emp.id && r.workingDates?.includes(dateStr))
      if (roster) return { type: 'working', label: 'Working' }
      const anyRosterForWeek = rosters.find(r =>
        r.userId === emp.id &&
        r.weekStart === getWeekStart(dateStr)
      )
      if (anyRosterForWeek) return { type: 'off', label: 'Not Rostered' }
      return { type: 'unset', label: 'No Roster' }
    }
  }

  const StatusCell = ({ status, compact }) => {
    if (!status) return <div className="h-full w-full bg-stone-50" />

    const configs = {
      working: { bg: '#f0fdf4', border: '#86efac', text: '#15803d', label: 'In' },
      off: { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8', label: 'Off' },
      holiday: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: 'Hol' },
      unset: { bg: '#fafafa', border: '#e5e7eb', text: '#d1d5db', label: '?' },
    }

    if (status.type === 'leave') {
      return (
        <div className="h-full w-full flex items-center justify-center relative overflow-hidden"
          style={{ background: status.bg, borderTop: `2px solid ${status.color}` }}
          title={`${status.label}${status.isHalfDay ? ` (${status.halfDayPeriod})` : ''}${status.status === 'pending' ? ' — pending' : ''}`}
        >
          {status.status === 'pending' && (
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 6px)`
            }} />
          )}
          <span className="text-xs font-bold relative z-10" style={{ color: status.text }}>
            {compact ? status.leaveType?.slice(0,3).toUpperCase() : status.label}
            {status.isHalfDay ? '½' : ''}
          </span>
        </div>
      )
    }

    const cfg = configs[status.type] || configs.off
    return (
      <div className="h-full w-full flex items-center justify-center"
        style={{ background: cfg.bg, borderTop: `2px solid ${cfg.border}` }}
        title={status.label}
      >
        <span className="text-xs font-semibold" style={{ color: cfg.text }}>
          {compact ? cfg.label : status.label}
        </span>
      </div>
    )
  }

  const isMonthView = view === 'month'
  const cellW = isMonthView ? 28 : 90

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 max-w-full mx-auto space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Team Roster</h1>
          <p className="text-stone-500 text-sm mt-0.5">At-a-glance view of who's working, off, or on leave</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 p-1 bg-stone-100 rounded-xl">
            {Object.entries(VIEWS).map(([k, v]) => (
              <button key={k} onClick={() => { setView(k); setOffset(0) }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === k ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                {v}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <button onClick={() => setOffset(o => o - 1)} className="p-2 rounded-xl hover:bg-stone-100 border border-stone-200 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setOffset(0)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-stone-200 hover:bg-stone-50 transition-colors">
            Today
          </button>
          <button onClick={() => setOffset(o => o + 1)} className="p-2 rounded-xl hover:bg-stone-100 border border-stone-200 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Period label */}
      <div className="flex items-center gap-2">
        <Calendar size={14} className="text-amber-500" />
        <span className="font-semibold text-stone-700">{periodLabel()}</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { bg: '#f0fdf4', border: '#86efac', text: '#15803d', label: 'Working' },
          { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8', label: 'Day Off' },
          { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', label: 'Public Holiday' },
          ...Object.entries(LEAVE_TYPES).map(([k, v]) => ({ bg: v.bg, border: v.color, text: v.text, label: v.label })),
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-sm" style={{ background: item.bg, border: `2px solid ${item.border}` }} />
            <span className="text-stone-500">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-sm bg-stone-50 border-2 border-stone-100"
            style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)' }} />
          <span className="text-stone-500">Pending</span>
        </div>
      </div>

      {/* Roster grid */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse" style={{ minWidth: '100%' }}>
            <thead>
              <tr>
                {/* Name column header */}
                <th className="sticky left-0 z-20 bg-stone-50 border-b border-r border-stone-200 px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wide"
                  style={{ minWidth: 160, width: 160 }}>
                  Employee
                </th>
                {dates.map(dateStr => {
                  const d = new Date(dateStr + 'T12:00:00')
                  const dayNum = d.getDay()
                  const isToday = dateStr === today
                  const isWeekend = dayNum === 0 || dayNum === 6
                  const isHol = holidays.includes(dateStr)
                  return (
                    <th key={dateStr}
                      className="border-b border-r border-stone-100 text-center"
                      style={{
                        width: cellW, minWidth: cellW,
                        background: isToday ? '#fffbeb' : isHol ? '#fef9ec' : isWeekend ? '#f8f8f6' : '#f9fafb',
                        padding: '6px 2px',
                      }}>
                      <div className="text-xs font-semibold" style={{ color: isToday ? '#d97706' : isWeekend ? '#94a3b8' : '#6b7280' }}>
                        {isMonthView ? d.getDate() : DAY_NAMES[dayNum]}
                      </div>
                      {!isMonthView && (
                        <div className={`text-xs mt-0.5 font-bold ${isToday ? 'text-amber-500' : 'text-stone-400'}`}>
                          {d.getDate()}
                        </div>
                      )}
                      {isMonthView && isHol && <div className="text-amber-400 text-xs">✦</div>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, ri) => (
                <tr key={emp.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-stone-50/40'}>
                  {/* Employee name — sticky */}
                  <td className="sticky left-0 z-10 border-r border-b border-stone-100 px-3 py-2"
                    style={{ background: ri % 2 === 0 ? 'white' : '#fafaf9', minWidth: 160, width: 160 }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                        style={{ background: '#0f172a' }}>
                        {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-stone-800 truncate">{emp.name}</div>
                        {emp.department && <div className="text-xs text-stone-400 truncate">{emp.department}</div>}
                      </div>
                    </div>
                  </td>
                  {/* Status cells */}
                  {dates.map(dateStr => {
                    const status = getStatus(emp, dateStr)
                    const isToday = dateStr === today
                    return (
                      <td key={dateStr}
                        className="border-r border-b border-stone-100 p-0"
                        style={{
                          width: cellW, minWidth: cellW, height: 44,
                          outline: isToday ? '2px solid #fbbf24' : 'none',
                          outlineOffset: '-1px',
                        }}>
                        <StatusCell status={status} compact={isMonthView} />
                      </td>
                    )
                  })}
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={dates.length + 1} className="text-center py-12 text-stone-400 text-sm">
                    No employees found. Add employees in the Admin Console.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary row */}
      {!isMonthView && (
        <div className="grid grid-cols-7 gap-2">
          {dates.map(dateStr => {
            const offCount = employees.filter(e => {
              const s = getStatus(e, dateStr)
              return s.type === 'off' || s.type === 'leave'
            }).length
            const onLeave = employees.filter(e => getStatus(e, dateStr).type === 'leave').length
            const isHol = holidays.includes(dateStr)
            return (
              <div key={dateStr} className="card p-2 text-center">
                <div className="text-xs font-bold text-stone-500">{new Date(dateStr+'T12:00:00').toLocaleDateString('en',{weekday:'short'})}</div>
                {isHol ? (
                  <div className="text-xs text-amber-600 font-semibold mt-0.5">Holiday</div>
                ) : (
                  <>
                    <div className="text-xs text-emerald-600 font-semibold mt-0.5">{employees.length - offCount} in</div>
                    {onLeave > 0 && <div className="text-xs text-rose-400">{onLeave} on leave</div>}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
