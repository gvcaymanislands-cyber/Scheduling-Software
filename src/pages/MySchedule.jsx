import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, doc, setDoc,
  deleteDoc, query, where, updateDoc
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import {
  DAY_NAMES, DAY_NAMES_FULL, getWeekStart,
  getWeekDates, CAYMAN_HOLIDAYS
} from '../utils/leaveUtils'
import { ChevronLeft, ChevronRight, CheckCircle, Info, Calendar, Save } from 'lucide-react'

export default function MySchedule() {
  const { currentUser, userProfile } = useAuth()

  const today = new Date().toISOString().slice(0, 10)
  const year = new Date().getFullYear()
  const holidays = [...(CAYMAN_HOLIDAYS[year] || []), ...(CAYMAN_HOLIDAYS[year + 1] || [])]
  const holidayDates = holidays.map(h => h.date)

  const savedSchedule = userProfile?.workSchedule || { type: 'fixed', workingDays: [1, 2, 3, 4, 5] }

  // ── Fixed schedule state ───────────────────────────────────────────────────
  const [scheduleType, setScheduleType] = useState(savedSchedule.type || 'fixed')
  const [fixedDays, setFixedDays] = useState(savedSchedule.workingDays || [1, 2, 3, 4, 5])
  const [savingFixed, setSavingFixed] = useState(false)
  const [savedFixed, setSavedFixed] = useState(false)

  const fixedChanged =
    scheduleType !== savedSchedule.type ||
    JSON.stringify([...fixedDays].sort()) !== JSON.stringify([...(savedSchedule.workingDays || [1,2,3,4,5])].sort())

  const toggleFixedDay = (dayNum) => {
    setFixedDays(prev =>
      prev.includes(dayNum) ? prev.filter(d => d !== dayNum) : [...prev, dayNum].sort()
    )
  }

  const saveFixedSchedule = async () => {
    setSavingFixed(true)
    await updateDoc(doc(db, 'users', currentUser.uid), {
      workSchedule: { type: scheduleType, workingDays: scheduleType === 'fixed' ? fixedDays : fixedDays }
    })
    setSavingFixed(false)
    setSavedFixed(true)
    setTimeout(() => setSavedFixed(false), 2000)
  }

  // ── Variable roster state ─────────────────────────────────────────────────
  const [rosters, setRosters] = useState({})
  const [weekOffset, setWeekOffset] = useState(0)
  const [localRoster, setLocalRoster] = useState([])
  const [rosterLoaded, setRosterLoaded] = useState(false)
  const [savingRoster, setSavingRoster] = useState(false)

  const getMonday = (offset) => {
    const base = getWeekStart(today)
    const d = new Date(base + 'T12:00:00')
    d.setDate(d.getDate() + offset * 7)
    return d.toISOString().slice(0, 10)
  }

  const currentWeekStart = getMonday(weekOffset)
  const weekDates = getWeekDates(currentWeekStart)
  const rosterId = `${currentUser.uid}_${currentWeekStart}`

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'weeklyRosters'), where('userId', '==', currentUser.uid)),
      snap => {
        const map = {}
        snap.docs.forEach(d => { map[d.id] = d.data() })
        setRosters(map)
        setRosterLoaded(true)
      }
    )
    return unsub
  }, [currentUser.uid])

  useEffect(() => {
    if (!rosterLoaded) return
    setLocalRoster(rosters[rosterId]?.workingDates || [])
  }, [rosterId, rosters, rosterLoaded])

  const rosterChanged =
    JSON.stringify([...localRoster].sort()) !==
    JSON.stringify([...(rosters[rosterId]?.workingDates || [])].sort())

  const toggleDate = (dateStr) => {
    setLocalRoster(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort()
    )
  }

  const saveRoster = async () => {
    setSavingRoster(true)
    const ref = doc(db, 'weeklyRosters', rosterId)
    if (localRoster.length === 0) {
      await deleteDoc(ref).catch(() => {})
    } else {
      await setDoc(ref, {
        userId: currentUser.uid,
        weekStart: currentWeekStart,
        workingDates: localRoster,
        updatedAt: new Date().toISOString(),
      })
    }
    setSavingRoster(false)
  }

  const copyFromLastWeek = () => {
    const lastId = `${currentUser.uid}_${getMonday(weekOffset - 1)}`
    const last = rosters[lastId]
    if (!last?.workingDates?.length) return alert('No saved roster for last week.')
    const shifted = last.workingDates.map(d => {
      const dt = new Date(d + 'T12:00:00')
      dt.setDate(dt.getDate() + 7)
      return dt.toISOString().slice(0, 10)
    }).filter(d => weekDates.includes(d))
    setLocalRoster(shifted)
  }

  const formatWeek = (mondayStr) => {
    const start = new Date(mondayStr + 'T12:00:00')
    const end = new Date(mondayStr + 'T12:00:00')
    end.setDate(end.getDate() + 6)
    return `${start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const isVariable = scheduleType === 'variable'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-800">My Schedule</h1>
        <p className="text-stone-500 text-sm mt-0.5">
          Set your working pattern — leave requests use this to calculate working days automatically
        </p>
      </div>

      {/* ── Section 1: Schedule Type & Fixed Days ──────────────────────────── */}
      <div className="card p-5 space-y-5">
        <div>
          <h2 className="font-bold text-stone-700 mb-1">Schedule type</h2>
          <p className="text-xs text-stone-400 mb-3">
            Choose Fixed if you work the same days every week. Choose Variable if your days change week to week (e.g. housekeeping).
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setScheduleType('fixed')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${!isVariable ? 'bg-stone-800 text-white border-stone-800' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
            >
              📅 Fixed weekly pattern
            </button>
            <button
              onClick={() => setScheduleType('variable')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${isVariable ? 'bg-blue-600 text-white border-blue-600' : 'border-stone-200 text-stone-500 hover:bg-stone-50'}`}
            >
              📋 Variable roster
            </button>
          </div>
        </div>

        {/* Fixed day toggles — shown for fixed AND as default days for variable */}
        <div>
          <h3 className="font-semibold text-stone-700 text-sm mb-1">
            {isVariable ? 'Default working days (used as fallback)' : 'Your working days'}
          </h3>
          <p className="text-xs text-stone-400 mb-3">
            {isVariable
              ? 'For variable schedules, set your weekly roster below. These default days are a fallback if no roster is entered for a week.'
              : 'Click days to toggle them on or off. These are the days that count toward your leave requests.'}
          </p>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map(dayNum => {
              const isOn = fixedDays.includes(dayNum)
              const isWeekendDay = dayNum === 0 || dayNum === 6
              return (
                <button
                  key={dayNum}
                  onClick={() => toggleFixedDay(dayNum)}
                  className="flex-1 py-3 rounded-xl text-xs font-bold text-center transition-all"
                  style={isOn
                    ? {
                        background: isWeekendDay ? '#fef3c7' : '#d1fae5',
                        color: isWeekendDay ? '#92400e' : '#065f46',
                        border: `2px solid ${isWeekendDay ? '#f59e0b' : '#10b981'}`
                      }
                    : { background: '#f3f4f6', color: '#c4c4c4', border: '2px solid transparent' }
                  }
                >
                  <div>{DAY_NAMES[dayNum]}</div>
                  <div className="mt-0.5">{isOn ? '✓' : '·'}</div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-stone-400 mt-2">
            {fixedDays.length === 0
              ? 'No days selected'
              : `Working: ${fixedDays.sort().map(d => DAY_NAMES_FULL[d]).join(', ')}`}
          </p>
        </div>

        {/* Save fixed schedule */}
        <div className="flex items-center justify-between pt-1 border-t border-stone-100">
          <p className="text-xs text-stone-400">
            {fixedChanged ? 'You have unsaved changes' : 'Schedule is up to date'}
          </p>
          <button
            onClick={saveFixedSchedule}
            disabled={savingFixed || (!fixedChanged && !savedFixed)}
            className={`btn-primary py-2 px-4 text-sm ${!fixedChanged && !savedFixed ? 'opacity-40' : ''}`}
          >
            {savingFixed ? 'Saving…' : savedFixed ? '✓ Saved!' : <><Save size={14} /> Save Schedule</>}
          </button>
        </div>
      </div>

      {/* ── Section 2: Weekly Roster (always shown, required for variable) ── */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-bold text-stone-700 mb-1">Weekly roster</h2>
          <p className="text-xs text-stone-400">
            {isVariable
              ? 'Enter your working days each week. This is what counts for leave calculations.'
              : 'You can also enter specific weeks if your pattern changes temporarily.'}
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setWeekOffset(o => o - 1)} className="p-2 rounded-xl hover:bg-stone-100 border border-stone-200 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <div className="font-bold text-stone-800 text-sm">{formatWeek(currentWeekStart)}</div>
            <div className="text-xs mt-0.5">
              {weekOffset === 0 && <span className="text-amber-500 font-semibold">Current week</span>}
              {weekOffset === 1 && <span className="text-stone-400">Next week</span>}
              {weekOffset > 1 && <span className="text-stone-400">{weekOffset} weeks ahead</span>}
              {weekOffset < 0 && <span className="text-stone-400">{Math.abs(weekOffset)} week{Math.abs(weekOffset) > 1 ? 's' : ''} ago</span>}
            </div>
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)} className="p-2 rounded-xl hover:bg-stone-100 border border-stone-200 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day tiles */}
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((dateStr) => {
            const dayNum = new Date(dateStr + 'T12:00:00').getDay()
            const isWeekendDay = dayNum === 0 || dayNum === 6
            const isWorking = localRoster.includes(dateStr)
            const isToday = dateStr === today
            const isHol = holidayDates.includes(dateStr)
            return (
              <button
                key={dateStr}
                onClick={() => !isHol && toggleDate(dateStr)}
                disabled={isHol}
                className="rounded-xl p-2 text-center transition-all"
                style={isHol
                  ? { background: '#fef3c7', border: '2px solid #fcd34d', cursor: 'not-allowed' }
                  : isWorking
                  ? { background: '#d1fae5', border: '2px solid #10b981', color: '#065f46' }
                  : isToday
                  ? { background: '#fffbeb', border: '2px solid #fbbf24', color: '#92400e' }
                  : { background: isWeekendDay ? '#f5f4f1' : '#f9f9f8', border: '2px solid transparent', color: '#9ca3af' }
                }
              >
                <div className="text-xs font-bold mb-0.5">{DAY_NAMES[dayNum]}</div>
                <div className="text-sm font-semibold">{new Date(dateStr + 'T12:00:00').getDate()}</div>
                {isHol
                  ? <div className="text-xs mt-0.5">🌴</div>
                  : isWorking
                  ? <CheckCircle size={12} className="mx-auto mt-1 text-emerald-500" />
                  : <div className="h-3 mt-1" />
                }
              </button>
            )
          })}
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-500">
            <strong className="text-stone-700" style={{ fontFamily: 'DM Mono, monospace' }}>
              {localRoster.length}
            </strong> working {localRoster.length === 1 ? 'day' : 'days'} this week
          </span>
          <button onClick={copyFromLastWeek} className="text-xs text-stone-400 hover:text-stone-600 underline transition-colors">
            Copy from last week
          </button>
        </div>

        {/* Roster actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setLocalRoster([])}
            className="btn-secondary flex-1 justify-center text-xs py-2"
          >
            Clear week
          </button>
          <button
            onClick={() => {
              const weekdays = weekDates.filter(d => {
                const dn = new Date(d + 'T12:00:00').getDay()
                return dn !== 0 && dn !== 6 && !holidayDates.includes(d)
              })
              setLocalRoster(weekdays)
            }}
            className="btn-secondary flex-1 justify-center text-xs py-2"
          >
            Fill Mon–Fri
          </button>
          <button
            onClick={saveRoster}
            disabled={savingRoster || !rosterChanged}
            className={`btn-primary flex-1 justify-center text-xs py-2 ${!rosterChanged ? 'opacity-50' : ''}`}
          >
            {savingRoster ? 'Saving…' : rosterChanged ? '💾 Save Week' : '✓ Saved'}
          </button>
        </div>
      </div>

      {/* ── Section 3: Saved roster history ───────────────────────────────── */}
      {Object.keys(rosters).length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-3">Saved Rosters</h3>
          {Object.entries(rosters)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 10)
            .map(([id, roster]) => {
              const weekStr = id.replace(`${currentUser.uid}_`, '')
              const isCurrent = weekStr === currentWeekStart
              return (
                <div key={id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-stone-300" />
                    <span className="text-sm text-stone-600">{formatWeek(weekStr)}</span>
                    {isCurrent && <span className="badge bg-amber-100 text-amber-600 text-xs">current</span>}
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700"
                    style={{ fontFamily: 'DM Mono, monospace' }}>
                    {roster.workingDates?.length || 0}d
                  </span>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
