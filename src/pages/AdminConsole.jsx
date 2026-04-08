import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot, doc,
  updateDoc, deleteDoc, setDoc,
  serverTimestamp, writeBatch
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { LEAVE_TYPES, CAYMAN_HOLIDAYS } from '../utils/leaveUtils'
import {
  Users, Calendar, CheckCircle, XCircle, Clock,
  Plus, Trash2, Eye, EyeOff, Edit2,
  AlertTriangle, X, UserPlus, Palmtree
} from 'lucide-react'

export default function AdminConsole() {
  const { createEmployee } = useAuth()
  const [tab, setTab] = useState('requests')
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const year = new Date().getFullYear()

    const lUnsub = onSnapshot(
      query(collection(db, 'leaves'), where('year', '==', year)),
      snap => setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (b.status === 'pending' && a.status !== 'pending') return 1
        return b.startDate.localeCompare(a.startDate)
      }))
    )

    const eUnsub = onSnapshot(
      collection(db, 'users'),
      snap => { setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) }
    )

    const hUnsub = onSnapshot(
      collection(db, 'holidays'),
      snap => {
        const fromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // If no holidays in DB yet, use defaults
        if (fromDb.length === 0) {
          const defaults = [...(CAYMAN_HOLIDAYS[year] || []), ...(CAYMAN_HOLIDAYS[year + 1] || [])]
          setHolidays(defaults.map(h => ({ ...h, id: h.date })))
        } else {
          setHolidays(fromDb.sort((a, b) => a.date.localeCompare(b.date)))
        }
      }
    )

    return () => { lUnsub(); eUnsub(); hUnsub() }
  }, [])

  const handleLeaveAction = async (leave, action, reviewNotes = '') => {
    await updateDoc(doc(db, 'leaves', leave.id), {
      status: action,
      reviewedAt: serverTimestamp(),
      reviewedBy: 'Admin',
      reviewNotes,
    })
  }

  const TABS = [
    { key: 'requests', label: 'Leave Requests', icon: Clock, badge: leaves.filter(l => l.status === 'pending').length },
    { key: 'employees', label: 'Employees', icon: Users },
    { key: 'holidays', label: 'Holidays', icon: Palmtree },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Admin Console</h1>
        <p className="text-stone-500 text-sm mt-0.5">Manage requests, employees, and holidays</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-stone-100 rounded-xl w-fit">
        {TABS.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <Icon size={15} />
            {label}
            {badge > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Leave Requests */}
      {tab === 'requests' && (
        <LeaveRequestsTab
          leaves={leaves}
          employees={employees}
          onAction={handleLeaveAction}
        />
      )}

      {/* Employees */}
      {tab === 'employees' && (
        <EmployeesTab
          employees={employees}
          createEmployee={createEmployee}
          leaves={leaves}
        />
      )}

      {/* Holidays */}
      {tab === 'holidays' && (
        <HolidaysTab holidays={holidays} />
      )}
    </div>
  )
}

// ── Leave Requests Tab ─────────────────────────────────────────────────────────
function LeaveRequestsTab({ leaves, employees, onAction }) {
  const [filter, setFilter] = useState('pending')
  const [reviewModal, setReviewModal] = useState(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const empMap = {}
  employees.forEach(e => { empMap[e.id] = e })

  const filtered = filter === 'all' ? leaves : leaves.filter(l => l.status === filter)

  const doAction = async (leave, action) => {
    await onAction(leave, action, reviewNotes)
    setReviewModal(null)
    setReviewNotes('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['pending', 'approved', 'declined', 'cancelled', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-stone-800 text-white' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}
          >
            {f} {f !== 'all' && <span className="ml-1 opacity-60">{leaves.filter(l => l.status === f).length}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
          <p className="font-semibold text-stone-600">No {filter !== 'all' ? filter : ''} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => {
            const lt = LEAVE_TYPES[l.type]
            const emp = empMap[l.userId]
            return (
              <div key={l.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#f1f5f9', color: '#0f172a' }}>
                      {emp?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '??'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-stone-800">{emp?.name || l.userName}</span>
                        <span className="badge" style={{ background: lt?.bg, color: lt?.text }}>
                          {lt?.label}
                        </span>
                        <span className={`status-${l.status}`}>
                          {l.status === 'pending' && <Clock size={10} />}
                          {l.status === 'approved' && <CheckCircle size={10} />}
                          {l.status === 'declined' && <XCircle size={10} />}
                          {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-stone-600">
                        {l.startDate === l.endDate ? l.startDate : `${l.startDate} → ${l.endDate}`}
                        <span className="text-stone-400 ml-2 text-xs">
                          {l.isHalfDay ? `Half day (${l.halfDayPeriod})` : `${l.workingDays} working day${l.workingDays !== 1 ? 's' : ''}`}
                        </span>
                      </p>
                      {l.notes && <p className="text-xs text-stone-400 mt-1 italic">"{l.notes}"</p>}
                      {l.reviewNotes && <p className="text-xs text-stone-500 mt-1 px-2 py-1 rounded bg-stone-50">Note: {l.reviewNotes}</p>}
                    </div>
                  </div>

                  {l.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setReviewModal({ leave: l, action: 'declined' })}
                        className="btn-danger py-1.5 px-3 text-xs"
                      >
                        <XCircle size={13} /> Decline
                      </button>
                      <button
                        onClick={() => doAction(l, 'approved')}
                        className="btn-primary py-1.5 px-3 text-xs"
                        style={{ background: '#10b981' }}
                      >
                        <CheckCircle size={13} /> Approve
                      </button>
                    </div>
                  )}

                  {l.status === 'approved' && (
                    <button
                      onClick={() => setReviewModal({ leave: l, action: 'declined' })}
                      className="btn-secondary py-1.5 px-3 text-xs flex-shrink-0"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Decline modal */}
      {reviewModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setReviewModal(null)}>
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-stone-800 mb-1">
              {reviewModal.action === 'declined' ? 'Decline' : 'Revoke'} Request
            </h3>
            <p className="text-sm text-stone-500 mb-4">Optionally add a note for the employee.</p>
            <textarea
              className="input resize-none mb-4"
              rows={3}
              placeholder="Reason (optional)…"
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setReviewModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={() => doAction(reviewModal.leave, reviewModal.action)} className="btn-danger flex-1 justify-center">
                {reviewModal.action === 'declined' ? 'Decline' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Employees Tab ──────────────────────────────────────────────────────────────
function EmployeesTab({ employees, createEmployee, leaves }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', department: '' })
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [editModal, setEditModal] = useState(null)

  const year = new Date().getFullYear()

  const getBalance = (emp) => {
    const empLeaves = leaves.filter(l => l.userId === emp.id && l.status === 'approved' && l.year === year)
    const bal = {}
    empLeaves.forEach(l => {
      if (!bal[l.type]) bal[l.type] = 0
      bal[l.type] += l.workingDays || 0
    })
    return bal
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    setAdding(true)
    try {
      await createEmployee(form.email, form.password, {
        name: form.name,
        role: form.role,
        department: form.department,
        isActive: true,
        isHidden: false,
      })
      setForm({ name: '', email: '', password: '', role: 'employee', department: '' })
      setShowAdd(false)
    } catch (err) {
      setError(err.message || 'Failed to create employee.')
    }
    setAdding(false)
  }

  const toggleHide = async (emp) => {
    await updateDoc(doc(db, 'users', emp.id), { isHidden: !emp.isHidden })
  }

  const saveEdit = async (empId, data) => {
    await updateDoc(doc(db, 'users', empId), data)
    setEditModal(null)
  }

  const active = employees.filter(e => !e.isHidden)
  const hidden = employees.filter(e => e.isHidden)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary">
          <UserPlus size={15} /> Add Employee
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card p-5 fade-in">
          <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2"><UserPlus size={16} /> New Employee</h3>
          {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3">{error}</div>}
          <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="jane@company.com" />
            </div>
            <div>
              <label className="label">Temporary Password</label>
              <input type="text" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required placeholder="Min 6 characters" minLength={6} />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Finance" />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="submit" disabled={adding} className="btn-primary flex-1 justify-center">
                {adding ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active employees */}
      <div className="space-y-2">
        {active.map(emp => {
          const bal = getBalance(emp)
          const annualUsed = bal.annual || 0
          const sickUsed = bal.sick || 0
          return (
            <div key={emp.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-stone-800">{emp.name}</span>
                  <span className={`badge ${emp.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                    {emp.role}
                  </span>
                  {emp.department && <span className="badge bg-blue-50 text-blue-600">{emp.department}</span>}
                  {!emp.isActive && <span className="badge bg-red-50 text-red-500">Inactive</span>}
                </div>
                <p className="text-xs text-stone-400 mt-0.5">{emp.email}</p>
                <div className="flex gap-3 mt-1.5 text-xs text-stone-500">
                  <span>Annual: <strong>{annualUsed}/{emp.leaveAllowances?.annual || 20}</strong></span>
                  <span>Sick: <strong>{sickUsed}/{emp.leaveAllowances?.sick || 10}</strong></span>
                  {bal.lieu > 0 && <span>Lieu: <strong>{bal.lieu}</strong></span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setEditModal(emp)} className="btn-secondary py-1.5 px-2.5 text-xs">
                  <Edit2 size={12} /> Edit
                </button>
                <button onClick={() => toggleHide(emp)} className="btn-secondary py-1.5 px-2.5 text-xs tooltip">
                  <EyeOff size={12} />
                  <span className="tooltip-text">Hide from calendar</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hidden employees */}
      {hidden.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Hidden Employees</p>
          {hidden.map(emp => (
            <div key={emp.id} className="card p-3 flex items-center gap-3 opacity-60">
              <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center text-stone-500 text-xs font-bold">
                {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-stone-600">{emp.name}</span>
                <span className="text-xs text-stone-400 ml-2">{emp.email}</span>
              </div>
              <button onClick={() => toggleHide(emp)} className="btn-secondary py-1.5 px-2.5 text-xs">
                <Eye size={12} /> Unhide
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <EditEmployeeModal emp={editModal} onClose={() => setEditModal(null)} onSave={saveEdit} />
      )}
    </div>
  )
}

function EditEmployeeModal({ emp, onClose, onSave }) {
  const [form, setForm] = useState({
    name: emp.name || '',
    email: emp.email || '',
    department: emp.department || '',
    role: emp.role || 'employee',
    isActive: emp.isActive !== false,
    annualAllowance: emp.leaveAllowances?.annual || 20,
    sickAllowance: emp.leaveAllowances?.sick || 10,
    birthday: emp.birthday || '',
  })

  const handleSave = () => {
    onSave(emp.id, {
      name: form.name,
      email: form.email,
      department: form.department,
      role: form.role,
      isActive: form.isActive,
      leaveAllowances: { annual: Number(form.annualAllowance), sick: Number(form.sickAllowance) },
      birthday: form.birthday || null,
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-stone-800">Edit Employee</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Display Email <span className="normal-case font-normal text-stone-400">(updates profile only — login email unchanged)</span></label>
            <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="label">Department</label>
            <input className="input" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
          </div>
          <div>
            <label className="label">Birthday <span className="normal-case font-normal text-stone-400">(shows on calendar, reminds admin)</span></label>
            <input type="date" className="input" value={form.birthday ? `2000-${form.birthday}` : ''} onChange={e => {
              const val = e.target.value
              if (val) {
                const parts = val.split('-')
                setForm(f => ({ ...f, birthday: `${parts[1]}-${parts[2]}` }))
              } else {
                setForm(f => ({ ...f, birthday: '' }))
              }
            }} />
            <p className="text-xs text-stone-400 mt-1">Year is ignored — only month and day are stored</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.isActive ? 'active' : 'inactive'} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'active' }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Annual Leave Days</label>
              <input type="number" className="input" value={form.annualAllowance} min={0} max={365} onChange={e => setForm(f => ({ ...f, annualAllowance: e.target.value }))} />
            </div>
            <div>
              <label className="label">Sick Leave Days</label>
              <input type="number" className="input" value={form.sickAllowance} min={0} max={365} onChange={e => setForm(f => ({ ...f, sickAllowance: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1 justify-center">Save Changes</button>
        </div>
      </div>
    </div>
  )
}


// ── Holidays Tab ───────────────────────────────────────────────────────────────
function HolidaysTab({ holidays }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', date: '' })
  const [saving, setSaving] = useState(false)

  const seedDefaults = async () => {
    if (!confirm('This will add all Cayman Islands public holidays to the database. Continue?')) return
    setSaving(true)
    const batch = writeBatch(db)
    const allHols = [
      ...(CAYMAN_HOLIDAYS[2024] || []),
      ...(CAYMAN_HOLIDAYS[2025] || []),
      ...(CAYMAN_HOLIDAYS[2026] || []),
    ]
    allHols.forEach(h => {
      batch.set(doc(db, 'holidays', h.date), { name: h.name, date: h.date })
    })
    await batch.commit()
    setSaving(false)
  }

  const addHoliday = async (e) => {
    e.preventDefault()
    setSaving(true)
    await setDoc(doc(db, 'holidays', form.date), { name: form.name, date: form.date })
    setForm({ name: '', date: '' })
    setShowAdd(false)
    setSaving(false)
  }

  const removeHoliday = async (id) => {
    if (!confirm('Remove this holiday?')) return
    await deleteDoc(doc(db, 'holidays', id))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{holidays.length} holidays configured</p>
        <div className="flex gap-2">
          <button onClick={seedDefaults} disabled={saving} className="btn-secondary text-xs py-1.5">
            <Palmtree size={13} /> Seed Cayman Holidays
          </button>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs py-1.5">
            <Plus size={13} /> Add Holiday
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={addHoliday} className="card p-4 fade-in flex items-end gap-3">
          <div className="flex-1">
            <label className="label">Holiday Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. National Heroes Day" />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '…' : 'Add'}</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {[2024, 2025, 2026].map(y => {
          const yHols = holidays.filter(h => h.date.startsWith(String(y)))
          if (yHols.length === 0) return null
          return (
            <div key={y}>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-2 mt-4">{y}</p>
              {yHols.map(h => (
                <div key={h.id || h.date} className="card p-3 flex items-center gap-3 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Palmtree size={14} className="text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-stone-700 text-sm">{h.name}</span>
                    <span className="text-xs text-stone-400 ml-3">{h.date}</span>
                  </div>
                  <button onClick={() => removeHoliday(h.id || h.date)} className="p-1.5 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-colors text-stone-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )
        })}
        {holidays.length === 0 && (
          <div className="card p-10 text-center">
            <Palmtree size={28} className="text-amber-300 mx-auto mb-2" />
            <p className="font-semibold text-stone-600">No holidays yet</p>
            <p className="text-sm text-stone-400">Click "Seed Cayman Holidays" to add all public holidays automatically</p>
          </div>
        )}
      </div>
    </div>
  )
}
