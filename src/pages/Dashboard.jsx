import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import TeamCalendar from '../components/TeamCalendar'
import LeaveBalance from '../components/LeaveBalance'
import LeaveRequestModal from '../components/LeaveRequestModal'
import { LEAVE_TYPES, CAYMAN_HOLIDAYS } from '../utils/leaveUtils'
import { Plus, Clock, CheckCircle, XCircle, Users, AlertTriangle, Cake } from 'lucide-react'

export default function Dashboard() {
  const { currentUser, userProfile, isAdmin } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [pendingLeaves, setPendingLeaves] = useState([])
  const [balances, setBalances] = useState({})
  const [holidays, setHolidays] = useState([])
  const [showRequest, setShowRequest] = useState(false)
  const [loading, setLoading] = useState(true)

  const year = new Date().getFullYear()
  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    // Load holidays from Firestore (admin-managed), fall back to built-in
    const hUnsub = onSnapshot(collection(db, 'holidays'), snap => {
      if (snap.docs.length > 0) {
        setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } else {
        const defaults = [
          ...(CAYMAN_HOLIDAYS[year] || []),
          ...(CAYMAN_HOLIDAYS[year + 1] || []),
        ]
        setHolidays(defaults.map(h => ({ ...h, id: h.date })))
      }
    })

    const empUnsub = onSnapshot(
      query(collection(db, 'users'), where('isHidden', '==', false)),
      snap => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    const leavesUnsub = onSnapshot(
      query(collection(db, 'leaves'), where('year', '==', year)),
      snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setLeaves(all)
        const myLeaves = all.filter(l => l.userId === currentUser.uid && l.status === 'approved')
        const bal = {}
        myLeaves.forEach(l => {
          if (!bal[l.type]) bal[l.type] = { used: 0 }
          bal[l.type].used += l.workingDays || 0
        })
        setBalances(bal)
        if (isAdmin) setPendingLeaves(all.filter(l => l.status === 'pending'))
        setLoading(false)
      }
    )

    return () => { hUnsub(); empUnsub(); leavesUnsub() }
  }, [year])

  const myUpcoming = leaves
    .filter(l => l.userId === currentUser.uid && l.status !== 'cancelled' && l.endDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3)

  const whoIsOff = leaves.filter(l =>
    l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr && l.type !== 'remote'
  )
  const whoIsRemote = leaves.filter(l =>
    l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr && l.type === 'remote'
  )

  // Birthday reminders — upcoming within 7 days (admin only)
  const upcomingBirthdays = isAdmin ? employees.filter(e => {
    if (!e.birthday) return false
    const today = new Date()
    const [bMonth, bDay] = e.birthday.split('-').map(Number)
    for (let i = 0; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      if (d.getMonth() + 1 === bMonth && d.getDate() === bDay) return true
    }
    return false
  }) : []

  const StatusBadge = ({ status }) => {
    const map = {
      pending: { cls: 'status-pending', icon: <Clock size={10} />, label: 'Pending' },
      approved: { cls: 'status-approved', icon: <CheckCircle size={10} />, label: 'Approved' },
      declined: { cls: 'status-declined', icon: <XCircle size={10} />, label: 'Declined' },
      cancelled: { cls: 'status-cancelled', icon: null, label: 'Cancelled' },
    }
    const m = map[status] || map.pending
    return <span className={m.cls}>{m.icon}{m.label}</span>
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-stone-400 text-sm">Loading your dashboard…</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {userProfile?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('en-KY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => setShowRequest(true)} className="btn-primary">
          <Plus size={16} /> Request Leave
        </button>
      </div>

      {/* Admin pending alert */}
      {isAdmin && pendingLeaves.length > 0 && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {pendingLeaves.length} leave request{pendingLeaves.length > 1 ? 's' : ''} awaiting approval
              </p>
              <p className="text-xs text-amber-600">Review them in the Admin Console</p>
            </div>
          </div>
          <a href="/admin" className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline">Review now →</a>
        </div>
      )}

      {/* Birthday reminders */}
      {upcomingBirthdays.length > 0 && (
        <div className="p-4 rounded-2xl bg-pink-50 border border-pink-200">
          <div className="flex items-center gap-2 mb-2">
            <Cake size={16} className="text-pink-500" />
            <span className="text-sm font-semibold text-pink-700">Upcoming Birthdays</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingBirthdays.map(e => {
              const today = new Date()
              const [bMonth, bDay] = e.birthday.split('-').map(Number)
              let daysUntil = null
              for (let i = 0; i <= 7; i++) {
                const d = new Date(today)
                d.setDate(d.getDate() + i)
                if (d.getMonth() + 1 === bMonth && d.getDate() === bDay) { daysUntil = i; break }
              }
              return (
                <div key={e.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-pink-100 text-pink-700 text-sm">
                  <span>🎂</span>
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-pink-400 text-xs">
                    {daysUntil === 0 ? 'Today!' : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Today at a glance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
              <Users size={14} className="text-rose-600" />
            </div>
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Off Today</span>
          </div>
          {whoIsOff.length === 0 ? (
            <p className="text-sm text-stone-400">Everyone's in! 🎉</p>
          ) : (
            <div className="space-y-1">
              {whoIsOff.map(l => {
                const emp = employees.find(e => e.id === l.userId)
                const lt = LEAVE_TYPES[l.type]
                return (
                  <div key={l.id} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: lt?.color }} />
                    <span className="font-medium text-stone-700">{emp?.name || l.userName}</span>
                    <span className="text-stone-400 text-xs">{lt?.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users size={14} className="text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Remote Today</span>
          </div>
          {whoIsRemote.length === 0 ? (
            <p className="text-sm text-stone-400">No remote workers today</p>
          ) : (
            <div className="space-y-1">
              {whoIsRemote.map(l => {
                const emp = employees.find(e => e.id === l.userId)
                return (
                  <div key={l.id} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <span className="font-medium text-stone-700">{emp?.name || l.userName}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle size={14} className="text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">In Office</span>
          </div>
          <div className="space-y-1">
            {employees.filter(e => !whoIsOff.some(l => l.userId === e.id) && !whoIsRemote.some(l => l.userId === e.id))
              .slice(0, 5).map(e => (
                <div key={e.id} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="font-medium text-stone-700">{e.name}</span>
                </div>
              ))}
            {employees.filter(e => !whoIsOff.some(l => l.userId === e.id) && !whoIsRemote.some(l => l.userId === e.id)).length === 0 && (
              <p className="text-sm text-stone-400">No one in office today</p>
            )}
          </div>
        </div>
      </div>

      {/* My leave balance */}
      <div>
        <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3">My Leave Balance — {year}</h2>
        <LeaveBalance balances={balances} />
      </div>

      {/* My upcoming leaves */}
      {myUpcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3">My Upcoming Leave</h2>
          <div className="space-y-2">
            {myUpcoming.map(l => {
              const lt = LEAVE_TYPES[l.type]
              return (
                <div key={l.id} className="card p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: lt?.bg }}>
                    <div className="w-3 h-3 rounded-full" style={{ background: lt?.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-stone-800 text-sm">{lt?.label}</span>
                      <StatusBadge status={l.status} />
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {l.startDate === l.endDate ? l.startDate : `${l.startDate} → ${l.endDate}`}
                      {l.isHalfDay ? ` · Half day (${l.halfDayPeriod})` : ` · ${l.workingDays} working day${l.workingDays !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Team Calendar — now uses Firestore holidays */}
      <div>
        <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3">Team Calendar</h2>
        <TeamCalendar leaves={leaves} holidays={holidays} employees={employees} />
      </div>

      {showRequest && (
        <LeaveRequestModal
          onClose={() => setShowRequest(false)}
          holidays={holidays}
          leaves={leaves}
          balances={balances}
        />
      )}
    </div>
  )
}
