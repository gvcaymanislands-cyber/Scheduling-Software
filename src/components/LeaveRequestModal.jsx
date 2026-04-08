import { useState, useEffect } from 'react'
import { X, AlertTriangle, CheckCircle } from 'lucide-react'
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { LEAVE_TYPES, countWorkingDays, getDatesInRange, DAY_NAMES_FULL } from '../utils/leaveUtils'

export default function LeaveRequestModal({ onClose, holidays, leaves, balances }) {
  const { currentUser, userProfile } = useAuth()
  const [type, setType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isHalfDay, setIsHalfDay] = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState('morning')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [workingDays, setWorkingDays] = useState(0)
  const [conflicts, setConflicts] = useState([])
  const [rosterDates, setRosterDates] = useState([])

  const holidayDates = holidays.map(h => h.date)
  const schedule = userProfile?.workSchedule || { type: 'fixed', workingDays: [1, 2, 3, 4, 5] }

  useEffect(() => {
    if (schedule.type !== 'variable' || !startDate) return
    const loadRoster = async () => {
      const snap = await getDocs(
        query(collection(db, 'weeklyRosters'), where('userId', '==', currentUser.uid))
      )
      const all = []
      snap.docs.forEach(d => {
        const data = d.data()
        if (data.workingDates) all.push(...data.workingDates)
      })
      setRosterDates(all)
    }
    loadRoster()
  }, [startDate, endDate, schedule.type])

  useEffect(() => {
    if (!startDate) return
    const end = endDate || startDate
    if (isHalfDay) {
      const wd = countWorkingDays(startDate, startDate, holidayDates, schedule, rosterDates)
      setWorkingDays(wd > 0 ? 0.5 : 0)
      return
    }
    const wd = countWorkingDays(startDate, end, holidayDates, schedule, rosterDates)
    setWorkingDays(wd)

    const reqDates = new Set(getDatesInRange(startDate, end))
    const found = leaves.filter(l => {
      if (l.userId === currentUser.uid) return false
      if (l.status !== 'approved') return false
      return getDatesInRange(l.startDate, l.endDate).some(d => reqDates.has(d))
    })
    setConflicts([...new Set(found.map(f => f.userName))])
  }, [startDate, endDate, isHalfDay, rosterDates])

  const scheduleDescription = () => {
    if (schedule.type === 'variable') return 'Variable roster'
    const days = schedule.workingDays || [1, 2, 3, 4, 5]
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Mon – Fri'
    return days.sort().map(d => DAY_NAMES_FULL[d]).join(', ')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!startDate) return setError('Please select a start date.')
    const end = endDate || startDate
    if (end < startDate) return setError('End date cannot be before start date.')
    if (workingDays === 0) return setError('No working days in the selected range for your schedule.')

    const limit = type === 'annual'
      ? (userProfile?.leaveAllowances?.annual || 20)
      : type === 'sick'
      ? (userProfile?.leaveAllowances?.sick || 10)
      : null

    if (limit) {
      const used = balances?.[type]?.used || 0
      if (used + workingDays > limit) {
        return setError(`Not enough ${LEAVE_TYPES[type].label} balance. You have ${(limit - used).toFixed(1)} days remaining.`)
      }
    }

    setError('')
    setLoading(true)
    try {
      await addDoc(collection(db, 'leaves'), {
        userId: currentUser.uid,
        userName: userProfile?.name || currentUser.email,
        type,
        startDate,
        endDate: end,
        isHalfDay,
        halfDayPeriod: isHalfDay ? halfDayPeriod : null,
        workingDays,
        notes,
        status: 'pending',
        requestedAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes: null,
        year: new Date(startDate).getFullYear(),
        scheduleType: schedule.type,
      })
      onClose(true)
    } catch (err) {
      setError('Failed to submit request. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Request Leave</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Your schedule: <span className="font-semibold text-stone-500">{scheduleDescription()}</span> · Off days & holidays excluded
            </p>
          </div>
          <button onClick={() => onClose()} className="p-1.5 rounded-lg hover:bg-stone-100"><X size={18} /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            <AlertTriangle size={14} className="flex-shrink-0" />{error}
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span><strong>Heads up:</strong> {conflicts.join(', ')} {conflicts.length === 1 ? 'is' : 'are'} also off on some of these days.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Leave type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(LEAVE_TYPES).map(([k, v]) => (
                <button key={k} type="button" onClick={() => setType(k)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                  style={type === k ? { background: v.bg, color: v.text, borderColor: v.color } : { borderColor: '#e5e7eb', color: '#6b7280' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.color }} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="label mb-0">Half day?</label>
            <button type="button" onClick={() => setIsHalfDay(h => !h)}
              className={`relative w-10 h-5 rounded-full transition-colors ${isHalfDay ? 'bg-amber-500' : 'bg-stone-200'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isHalfDay ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {isHalfDay && (
            <div className="flex gap-2">
              {['morning', 'afternoon'].map(p => (
                <button key={p} type="button" onClick={() => setHalfDayPeriod(p)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${halfDayPeriod === p ? 'bg-amber-50 border-amber-400 text-amber-700' : 'border-stone-200 text-stone-500'}`}>{p}</button>
              ))}
            </div>
          )}

          <div className={`grid gap-3 ${isHalfDay ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div>
              <label className="label">Start date</label>
              <input type="date" className="input" value={startDate}
                onChange={e => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value) }} required />
            </div>
            {!isHalfDay && (
              <div>
                <label className="label">End date</label>
                <input type="date" className="input" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} required />
              </div>
            )}
          </div>

          {startDate && (
            <div className={`flex items-center gap-2 p-3 rounded-xl border ${workingDays === 0 ? 'bg-rose-50 border-rose-200' : 'bg-stone-50 border-stone-200'}`}>
              {workingDays === 0
                ? <AlertTriangle size={15} className="text-rose-500 flex-shrink-0" />
                : <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />}
              <span className="text-sm text-stone-600">
                {workingDays === 0
                  ? 'No working days in this range for your schedule'
                  : <><strong style={{ fontFamily: 'DM Mono, monospace' }}>{workingDays}</strong> working {workingDays === 1 ? 'day' : 'days'} — your off days & holidays excluded</>}
              </span>
            </div>
          )}

          {schedule.type === 'variable' && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs">
              ℹ️ You have a variable roster. Your count is based on the weekly schedule your admin enters.
            </div>
          )}

          <div>
            <label className="label">Notes <span className="normal-case font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={2} placeholder="Any additional details…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => onClose()} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={loading || workingDays === 0} className="btn-primary flex-1 justify-center">
              {loading ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
