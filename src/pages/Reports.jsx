import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { LEAVE_TYPES } from '../utils/leaveUtils'
import { exportLeavesToCSV, exportBalancesToCSV } from '../utils/csvExport'
import { Download, BarChart2, Users, Calendar, TrendingUp } from 'lucide-react'

export default function Reports() {
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const eUnsub = onSnapshot(collection(db, 'users'), snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => !e.isHidden))
    })
    const lUnsub = onSnapshot(
      query(collection(db, 'leaves'), where('year', '==', year)),
      snap => { setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) }
    )
    return () => { eUnsub(); lUnsub() }
  }, [year])

  // Compute per-employee balances
  const getEmployeeStats = (emp) => {
    const empLeaves = leaves.filter(l => l.userId === emp.id)
    const approved = empLeaves.filter(l => l.status === 'approved')
    const pending = empLeaves.filter(l => l.status === 'pending')

    const used = {}
    approved.forEach(l => {
      if (!used[l.type]) used[l.type] = 0
      used[l.type] += l.workingDays || 0
    })

    const annualAllowance = emp.leaveAllowances?.annual || 20
    const sickAllowance = emp.leaveAllowances?.sick || 10

    return {
      annualUsed: used.annual || 0,
      annualRemaining: annualAllowance - (used.annual || 0),
      annualAllowance,
      sickUsed: used.sick || 0,
      sickRemaining: sickAllowance - (used.sick || 0),
      sickAllowance,
      lieuUsed: used.lieu || 0,
      remoteUsed: used.remote || 0,
      unpaidUsed: used.unpaid || 0,
      pendingCount: pending.length,
    }
  }

  // Team totals
  const totals = {
    annual: leaves.filter(l => l.status === 'approved' && l.type === 'annual').reduce((s, l) => s + (l.workingDays || 0), 0),
    sick: leaves.filter(l => l.status === 'approved' && l.type === 'sick').reduce((s, l) => s + (l.workingDays || 0), 0),
    lieu: leaves.filter(l => l.status === 'approved' && l.type === 'lieu').reduce((s, l) => s + (l.workingDays || 0), 0),
    remote: leaves.filter(l => l.status === 'approved' && l.type === 'remote').reduce((s, l) => s + (l.workingDays || 0), 0),
    pending: leaves.filter(l => l.status === 'pending').length,
    total: leaves.filter(l => l.status === 'approved').length,
  }

  // Monthly breakdown
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0')
    const monthLeaves = leaves.filter(l =>
      l.status === 'approved' && l.startDate.startsWith(`${year}-${m}`)
    )
    return {
      month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
      days: monthLeaves.reduce((s, l) => s + (l.workingDays || 0), 0),
      count: monthLeaves.length,
    }
  })
  const maxDays = Math.max(...monthlyData.map(m => m.days), 1)

  const balances = {}
  employees.forEach(e => {
    const stats = getEmployeeStats(e)
    balances[e.id] = {
      annual: { used: stats.annualUsed, remaining: stats.annualRemaining },
      sick: { used: stats.sickUsed, remaining: stats.sickRemaining },
      lieu: { used: stats.lieuUsed },
      remote: { used: stats.remoteUsed },
    }
  })

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Reports</h1>
          <p className="text-stone-500 text-sm mt-0.5">Leave analytics & exports</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="input w-auto py-2"
          >
            {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={() => exportLeavesToCSV(leaves, employees)} className="btn-secondary">
            <Download size={15} /> Export Leaves
          </button>
          <button onClick={() => exportBalancesToCSV(employees, balances)} className="btn-primary">
            <Download size={15} /> Export Balances
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Annual Days Taken', value: totals.annual, icon: Calendar, color: '#10b981' },
          { label: 'Sick Days Taken', value: totals.sick, icon: TrendingUp, color: '#f43f5e' },
          { label: 'Remote Days', value: totals.remote, icon: Users, color: '#3b82f6' },
          { label: 'Pending Requests', value: totals.pending, icon: BarChart2, color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={15} style={{ color }} />
              <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-3xl font-bold text-stone-800" style={{ fontFamily: 'DM Mono, monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="card p-5">
        <h2 className="font-bold text-stone-700 mb-5 text-sm">Monthly Leave Days — {year}</h2>
        <div className="flex items-end gap-1.5 h-36">
          {monthlyData.map(({ month, days }) => (
            <div key={month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-stone-400" style={{ fontFamily: 'DM Mono, monospace' }}>{days || ''}</span>
              <div className="w-full rounded-t-md transition-all duration-500" style={{
                height: `${(days / maxDays) * 100}%`,
                minHeight: days > 0 ? '4px' : '0',
                background: days > 0 ? '#f59e0b' : '#f3f4f6',
              }} />
              <span className="text-xs text-stone-400 font-medium">{month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Leave type breakdown */}
      <div className="card p-5">
        <h2 className="font-bold text-stone-700 mb-4 text-sm">Leave Type Breakdown</h2>
        <div className="space-y-3">
          {Object.entries(LEAVE_TYPES).map(([key, lt]) => {
            const days = leaves.filter(l => l.status === 'approved' && l.type === key)
              .reduce((s, l) => s + (l.workingDays || 0), 0)
            const pct = totals.total > 0 ? Math.round((days / (totals.annual + totals.sick + totals.lieu + totals.remote)) * 100) || 0 : 0
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-28 text-xs text-stone-500 font-medium flex-shrink-0">{lt.label}</div>
                <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: lt.color }} />
                </div>
                <div className="w-16 text-right text-xs font-semibold text-stone-700" style={{ fontFamily: 'DM Mono, monospace' }}>
                  {days}d ({pct}%)
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-employee table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-bold text-stone-700 text-sm">Employee Leave Summary — {year}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50">
                {['Employee', 'Dept', 'Annual Used', 'Annual Left', 'Sick Used', 'Sick Left', 'Lieu', 'Remote', 'Pending'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-stone-400 uppercase tracking-wide py-3 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const s = getEmployeeStats(emp)
                const annualPct = (s.annualUsed / s.annualAllowance) * 100
                return (
                  <tr key={emp.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-medium text-stone-700">{emp.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-400 text-xs">{emp.department || '—'}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-stone-700" style={{ fontFamily: 'DM Mono, monospace' }}>{s.annualUsed}</span>
                      <div className="w-16 h-1 rounded-full bg-stone-100 mt-1">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(annualPct, 100)}%`, background: annualPct > 80 ? '#f43f5e' : '#10b981' }} />
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: s.annualRemaining < 5 ? '#f43f5e' : '#10b981' }}>{s.annualRemaining}</td>
                    <td className="py-3 px-4 font-semibold text-stone-700" style={{ fontFamily: 'DM Mono, monospace' }}>{s.sickUsed}</td>
                    <td className="py-3 px-4 font-semibold" style={{ fontFamily: 'DM Mono, monospace', color: s.sickRemaining < 3 ? '#f43f5e' : '#64748b' }}>{s.sickRemaining}</td>
                    <td className="py-3 px-4 font-semibold text-stone-700" style={{ fontFamily: 'DM Mono, monospace' }}>{s.lieuUsed || 0}</td>
                    <td className="py-3 px-4 font-semibold text-stone-700" style={{ fontFamily: 'DM Mono, monospace' }}>{s.remoteUsed || 0}</td>
                    <td className="py-3 px-4">
                      {s.pendingCount > 0 ? (
                        <span className="status-pending">{s.pendingCount}</span>
                      ) : <span className="text-stone-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
