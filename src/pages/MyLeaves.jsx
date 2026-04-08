import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import LeaveRequestModal from '../components/LeaveRequestModal'
import LeaveBalance from '../components/LeaveBalance'
import { LEAVE_TYPES, CAYMAN_HOLIDAYS } from '../utils/leaveUtils'
import { Plus, Clock, CheckCircle, XCircle, Trash2, Filter } from 'lucide-react'

const STATUS_CONFIG = {
  pending: { cls: 'status-pending', icon: <Clock size={10} />, label: 'Pending' },
  approved: { cls: 'status-approved', icon: <CheckCircle size={10} />, label: 'Approved' },
  declined: { cls: 'status-declined', icon: <XCircle size={10} />, label: 'Declined' },
  cancelled: { cls: 'status-cancelled', icon: null, label: 'Cancelled' },
}

export default function MyLeaves() {
  const { currentUser } = useAuth()
  const [leaves, setLeaves] = useState([])
  const [allLeaves, setAllLeaves] = useState([])
  const [balances, setBalances] = useState({})
  const [showRequest, setShowRequest] = useState(false)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(null)

  const year = new Date().getFullYear()
  const holidays = [...(CAYMAN_HOLIDAYS[year] || []), ...(CAYMAN_HOLIDAYS[year + 1] || [])]

  useEffect(() => {
    const q = query(
      collection(db, 'leaves'),
      where('userId', '==', currentUser.uid),
      where('year', '==', year)
    )
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.startDate.localeCompare(a.startDate))
      setLeaves(all)

      // All leaves for conflict detection
      setAllLeaves(all)

      // Balances
      const approved = all.filter(l => l.status === 'approved')
      const bal = {}
      approved.forEach(l => {
        if (!bal[l.type]) bal[l.type] = { used: 0 }
        bal[l.type].used += l.workingDays || 0
      })
      setBalances(bal)
      setLoading(false)
    })
    return unsub
  }, [currentUser.uid, year])

  const handleCancel = async (leave) => {
    if (!confirm('Cancel this leave request?')) return
    setCancelling(leave.id)
    try {
      await updateDoc(doc(db, 'leaves', leave.id), {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
      })
    } catch (err) {
      alert('Failed to cancel. Please try again.')
    }
    setCancelling(null)
  }

  const filtered = filter === 'all' ? leaves : leaves.filter(l => l.status === filter)

  const StatusBadge = ({ status }) => {
    const m = STATUS_CONFIG[status] || STATUS_CONFIG.pending
    return <span className={m.cls}>{m.icon}{m.label}</span>
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">My Leaves</h1>
          <p className="text-stone-500 text-sm mt-0.5">{year} leave history & requests</p>
        </div>
        <button onClick={() => setShowRequest(true)} className="btn-primary">
          <Plus size={16} /> Request Leave
        </button>
      </div>

      {/* Balance */}
      <div>
        <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Leave Balance</h2>
        <LeaveBalance balances={balances} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-stone-400" />
        {['all', 'pending', 'approved', 'declined', 'cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-stone-800 text-white' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Leaves list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🌴</div>
          <h3 className="font-semibold text-stone-700 mb-1">No leave requests yet</h3>
          <p className="text-stone-400 text-sm">Request time off using the button above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => {
            const lt = LEAVE_TYPES[l.type]
            const canCancel = l.status === 'pending' || (l.status === 'approved' && l.startDate > new Date().toISOString().slice(0, 10))
            return (
              <div key={l.id} className="card p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: lt?.bg }}>
                  <div className="w-3 h-3 rounded-full" style={{ background: lt?.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-stone-800 text-sm">{lt?.label}</span>
                    <StatusBadge status={l.status} />
                    {l.isHalfDay && (
                      <span className="badge bg-stone-100 text-stone-600">½ day · {l.halfDayPeriod}</span>
                    )}
                  </div>
                  <p className="text-sm text-stone-600">
                    {l.startDate === l.endDate ? l.startDate : `${l.startDate} → ${l.endDate}`}
                    <span className="text-stone-400 ml-2 text-xs">
                      {l.isHalfDay ? '0.5' : l.workingDays} working day{l.workingDays !== 1 ? 's' : ''}
                    </span>
                  </p>
                  {l.notes && <p className="text-xs text-stone-400 mt-1 italic">"{l.notes}"</p>}
                  {l.reviewNotes && (
                    <p className="text-xs mt-1 px-2 py-1 rounded-lg bg-stone-50 text-stone-500">
                      <strong>Admin note:</strong> {l.reviewNotes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canCancel && (
                    <button
                      onClick={() => handleCancel(l)}
                      disabled={cancelling === l.id}
                      className="btn-danger py-1.5 px-2.5 text-xs"
                    >
                      {cancelling === l.id ? '…' : <><Trash2 size={12} />Cancel</>}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showRequest && (
        <LeaveRequestModal
          onClose={() => setShowRequest(false)}
          holidays={holidays}
          leaves={allLeaves}
          balances={balances}
        />
      )}
    </div>
  )
}
