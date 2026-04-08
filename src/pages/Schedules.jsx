import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, doc, updateDoc,
  setDoc, getDocs, query, where, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import { DAY_NAMES, DAY_NAMES_FULL, getWeekStart, getWeekDates } from '../utils/leaveUtils'
import { CalendarDays, Clock, ChevronLeft, ChevronRight, CheckCircle, Info } from 'lucide-react'

export default function Schedules() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('fixed')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => !e.isHidden && e.isActive !== false))
      setLoading(false)
    })
    return unsub
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Work Schedules</h1>
        <p className="text-stone-500 text-sm mt-0.5">
          Set permanent schedules and weekly rosters — leave calculations automatically respect each person's working days
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-800 text-sm">
        <Info size={16} className="flex-shrink-0 mt-0.5 text-blue-500" />
        <div>
          <strong>How schedules affect leave:</strong> When an employee requests leave, only their actual scheduled working days are counted.
          If Chinnabu is always off Sunday and Monday, a leave request from Mon–Wed only counts as 2 days (Tue + Wed), not 3.
          Public holidays on working days are also excluded automatically.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('fixed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'fixed' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <CalendarDays size={15} /> Fixed Schedules
        </button>
        <button
          onClick={() => setActiveTab('variable')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'variable' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
        >
          <Clock size={15} /> Weekly Rosters
        </button>
      </div>

      {activeTab === 'fixed' && <FixedSchedules employees={employees} />}
      {activeTab === 'variable' && <WeeklyRosters employees={employees} />}
    </div>
  )
}

// ── Fixed Schedules ────────────────────────────────────────────────────────────
function FixedSchedules({ employees }) {
  const [saving, setSaving] = useState(null)
  const [localSchedules, setLocalSchedules] = useState({})

  useEffect(() => {
    const initial = {}
    employees.forEach(e => {
      initial[e.id] = e.workSchedule || { type: 'fixed', workingDays: [1, 2, 3, 4, 5] }
    })
    setLocalSchedules(initial)
  }, [employees])

  const toggleDay = (empId, dayNum) => {
    setLocalSchedules(prev => {
      const sched = prev[empId] || { type: 'fixed', workingDays: [1, 2, 3, 4, 5] }
      const days = sched.workingDays || [1, 2, 3, 4, 5]
      const newDays = days.includes(dayNum)
        ? days.filter(d => d !== dayNum)
        : [...days, dayNum].sort()
      return { ...prev, [empId]: { ...sched, type: 'fixed', workingDays: newDays } }
    })
  }

  const setScheduleType = (empId, type) => {
    setLocalSchedules(prev => ({
      ...prev,
      [empId]: { ...prev[empId], type }
    }))
  }

  const saveSchedule = async (empId) => {
    setSaving(empId)
    await updateDoc(doc(db, 'users', empId), {
      workSchedule: localSchedules[empId]
    })
    setSaving(null)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-400 uppercase font-semibold tracking-wide">
        Click days to toggle them on/off. Changes take effect immediately on all future leave requests.
      </p>

      {employees.map(emp => {
        const sched = localSchedules[emp.id] || { type: 'fixed', workingDays: [1, 2, 3, 4, 5] }
        const isVariable = sched.type === 'variable'
        const workingDays = sched.workingDays || [1, 2, 3, 4, 5]
        const daysPerWeek = isVariable ? '?' : workingDays.length
        const hasChanged = JSON.stringify(sched) !== JSON.stringify(emp.workSchedule || { type: 'fixed', workingDays: [1, 2, 3, 4, 5] })

        return (
          <div key={emp.id} className="card p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div className="font-semibold text-stone-800">{emp.name}</div>
                  <div className="text-xs text-stone-400">
                    {emp.department || emp.role} ·{' '}
                    {isVariable
                      ? <span className="text-blue-500 font-medium">Variable roster (set weekly below)</span>
                      : <span>{daysPerWeek} day{daysPerWeek !== 1 ? 's' : ''}/week</span>}
                  </div>
                </div>
              </div>
              {hasChanged && (
                <button
                  onClick={() => saveSchedule(emp.id)}
                  disabled={saving === emp.id}
                  className="btn-primary py-1.5 px-3 text-xs flex-shrink-0"
                >
                  {saving === emp.id ? 'Saving…' : '💾 Save'}
                </button>
              )}
            </div>

            {/* Schedule type selector */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setScheduleType(emp.id, 'fixed')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!isVariable ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
              >
                Fixed weekly pattern
              </button>
              <button
                onClick={() => setScheduleType(emp.id, 'variable')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isVariable ? 'bg-blue-600 text-white border-blue-600' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
              >
                Variable / roster
              </button>
            </div>

            {/* Day toggles */}
            {!isVariable && (
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map(dayNum => {
                  const isOn = workingDays.includes(dayNum)
                  const isWeekend = dayNum === 0 || dayNum === 6
                  return (
                    <button
                      key={dayNum}
                      onClick={() => toggleDay(emp.id, dayNum)}
                      className="flex-1 py-3 rounded-xl text-xs font-bold transition-all"
                      style={isOn
                        ? { background: isWeekend ? '#fef3c7' : '#d1fae5', color: isWeekend ? '#92400e' : '#065f46', border: `2px solid ${isWeekend ? '#f59e0b' : '#10b981'}` }
                        : { background: '#f3f4f6', color: '#9ca3af', border: '2px solid transparent' }
                      }
                    >
                      <div>{DAY_NAMES[dayNum]}</div>
                      {isOn && <div className="text-xs mt-0.5">✓</div>}
                    </button>
                  )
                })}
              </div>
            )}

            {isVariable && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs">
                Switch to the <strong>Weekly Rosters</strong> tab to enter this person's schedule week by week.
              </div>
            )}

            {/* Schedule summary */}
            {!isVariable && (
              <div className="mt-3 text-xs text-stone-400">
                Works: {workingDays.length === 0 ? 'No days selected' : workingDays.map(d => DAY_NAMES_FULL[d]).join(', ')}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Weekly Rosters ─────────────────────────────────────────────────────────────
function WeeklyRosters({ employees }) {
  const variableEmps = employees.filter(e => e.workSchedule?.type === 'variable')
  const [selectedEmp, setSelectedEmp] = useState(variableEmps[0]?.id || null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [rosters, setRosters] = useState({}) // weekStart -> { workingDates: [...] }
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const baseMonday = getWeekStart(today)

  const getMonday = (offset) => {
    const d = new Date(baseMonday + 'T12:00:00')
    d.setDate(d.getDate() + offset * 7)
    return d.toISOString().slice(0, 10)
  }

  const currentWeekStart = getMonday(weekOffset)
  const weekDates = getWeekDates(currentWeekStart)

  useEffect(() => {
    if (!selectedEmp) return
    const loadRosters = async () => {
      const snap = await getDocs(
        query(collection(db, 'weeklyRosters'), where('userId', '==', selectedEmp))
      )
      const map = {}
      snap.docs.forEach(d => { map[d.id] = d.data() })
      setRosters(map)
    }
    loadRosters()
  }, [selectedEmp])

  const rosterId = `${selectedEmp}_${currentWeekStart}`
  const currentRoster = rosters[rosterId] || { workingDates: [] }
  const workingThisWeek = currentRoster.workingDates || []

  const toggleDate = (dateStr) => {
    const isOn = workingThisWeek.includes(dateStr)
    const newDates = isOn
      ? workingThisWeek.filter(d => d !== dateStr)
      : [...workingThisWeek, dateStr].sort()

    setRosters(prev => ({
      ...prev,
      [rosterId]: { ...currentRoster, workingDates: newDates }
    }))
  }

  const saveRoster = async () => {
    if (!selectedEmp) return
    setSaving(true)
    const docRef = doc(db, 'weeklyRosters', rosterId)
    if (workingThisWeek.length === 0) {
      await deleteDoc(docRef).catch(() => {})
    } else {
      await setDoc(docRef, {
        userId: selectedEmp,
        weekStart: currentWeekStart,
        workingDates: workingThisWeek,
        updatedAt: new Date().toISOString(),
      })
    }
    setSaving(false)
  }

  const formatWeek = (mondayStr) => {
    const start = new Date(mondayStr + 'T12:00:00')
    const end = new Date(mondayStr + 'T12:00:00')
    end.setDate(end.getDate() + 6)
    return `${start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const copyFromLastWeek = () => {
    const lastWeekId = `${selectedEmp}_${getMonday(weekOffset - 1)}`
    const lastRoster = rosters[lastWeekId]
    if (!lastRoster?.workingDates?.length) {
      alert('No roster found for last week.')
      return
    }
    // Shift dates by 7 days
    const shifted = lastRoster.workingDates.map(d => {
      const dt = new Date(d + 'T12:00:00')
      dt.setDate(dt.getDate() + 7)
      return dt.toISOString().slice(0, 10)
    }).filter(d => weekDates.includes(d))

    setRosters(prev => ({
      ...prev,
      [rosterId]: { ...currentRoster, workingDates: shifted }
    }))
  }

  const isHoliday = (dateStr) => false // Simplified — could load holidays

  if (variableEmps.length === 0) {
    return (
      <div className="card p-10 text-center">
        <Clock size={28} className="text-stone-300 mx-auto mb-2" />
        <h3 className="font-semibold text-stone-600 mb-1">No variable roster employees</h3>
        <p className="text-sm text-stone-400">
          Go to <strong>Fixed Schedules</strong> and set an employee to "Variable / roster" to use weekly rosters.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-400 uppercase font-semibold tracking-wide">
        Enter which days each variable-schedule employee is working each week
      </p>

      {/* Employee selector */}
      <div className="flex gap-2 flex-wrap">
        {variableEmps.map(emp => (
          <button
            key={emp.id}
            onClick={() => setSelectedEmp(emp.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all border ${selectedEmp === emp.id ? 'bg-stone-800 text-white border-stone-800' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
          >
            <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 flex-shrink-0">
              {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            {emp.name?.split(' ')[0]}
          </button>
        ))}
      </div>

      {selectedEmp && (
        <div className="card p-5">
          {/* Week nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setWeekOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <div className="font-bold text-stone-800">{formatWeek(currentWeekStart)}</div>
              {weekOffset === 0 && <div className="text-xs text-amber-500 font-semibold">Current week</div>}
              {weekOffset === 1 && <div className="text-xs text-stone-400">Next week</div>}
              {weekOffset < 0 && <div className="text-xs text-stone-400">{Math.abs(weekOffset)} week{Math.abs(weekOffset) > 1 ? 's' : ''} ago</div>}
            </div>
            <button onClick={() => setWeekOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDates.map((dateStr, i) => {
              const dayNum = new Date(dateStr + 'T12:00:00').getDay()
              const isWeekend = dayNum === 0 || dayNum === 6
              const isWorking = workingThisWeek.includes(dateStr)
              const isToday = dateStr === today
              const dayNum2 = i // 0=Mon, 6=Sun for display order
              return (
                <button
                  key={dateStr}
                  onClick={() => toggleDate(dateStr)}
                  className="rounded-xl p-2 text-center transition-all"
                  style={isWorking
                    ? { background: '#d1fae5', border: '2px solid #10b981', color: '#065f46' }
                    : isToday
                    ? { background: '#fffbeb', border: '2px solid #fbbf24', color: '#92400e' }
                    : { background: isWeekend ? '#f5f4f1' : '#f9f9f8', border: '2px solid transparent', color: '#9ca3af' }
                  }
                >
                  <div className="text-xs font-bold mb-1">{DAY_NAMES[dayNum]}</div>
                  <div className="text-sm font-semibold">
                    {new Date(dateStr + 'T12:00:00').getDate()}
                  </div>
                  {isWorking && <CheckCircle size={12} className="mx-auto mt-1 text-emerald-500" />}
                </button>
              )
            })}
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between text-sm mb-4">
            <span className="text-stone-500">
              <strong className="text-stone-700" style={{ fontFamily: 'DM Mono, monospace' }}>{workingThisWeek.length}</strong> working {workingThisWeek.length === 1 ? 'day' : 'days'} this week
            </span>
            <button
              onClick={copyFromLastWeek}
              className="text-xs text-stone-400 hover:text-stone-600 underline transition-colors"
            >
              Copy from last week
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setRosters(prev => ({ ...prev, [rosterId]: { ...currentRoster, workingDates: [] } }))}
              className="btn-secondary flex-1 justify-center text-xs py-2"
            >
              Clear week
            </button>
            <button
              onClick={() => {
                const allDays = weekDates.filter(d => {
                  const dn = new Date(d + 'T12:00:00').getDay()
                  return dn !== 0 && dn !== 6
                })
                setRosters(prev => ({ ...prev, [rosterId]: { ...currentRoster, workingDates: allDays } }))
              }}
              className="btn-secondary flex-1 justify-center text-xs py-2"
            >
              Fill Mon–Fri
            </button>
            <button
              onClick={saveRoster}
              disabled={saving}
              className="btn-primary flex-1 justify-center text-xs py-2"
            >
              {saving ? 'Saving…' : '💾 Save Week'}
            </button>
          </div>
        </div>
      )}

      {/* Upcoming weeks summary */}
      {selectedEmp && (
        <div className="card p-4">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">Saved Rosters — {variableEmps.find(e => e.id === selectedEmp)?.name?.split(' ')[0]}</h3>
          {Object.entries(rosters)
            .filter(([id]) => id.startsWith(selectedEmp))
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 8)
            .map(([id, roster]) => {
              const weekStr = id.replace(`${selectedEmp}_`, '')
              return (
                <div key={id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                  <span className="text-sm text-stone-600">{formatWeek(weekStr)}</span>
                  <span className="text-xs font-semibold text-stone-700 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {roster.workingDates?.length || 0}d
                  </span>
                </div>
              )
            })}
          {Object.keys(rosters).filter(id => id.startsWith(selectedEmp)).length === 0 && (
            <p className="text-sm text-stone-400">No rosters saved yet. Start by setting days above.</p>
          )}
        </div>
      )}
    </div>
  )
}
