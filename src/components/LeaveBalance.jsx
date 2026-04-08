import { LEAVE_TYPES } from '../utils/leaveUtils'

export default function LeaveBalance({ balances, compact = false }) {
  const items = [
    { key: 'annual', limit: 20 },
    { key: 'sick', limit: 10 },
    { key: 'lieu', limit: null },
    { key: 'remote', limit: null },
    { key: 'maternity', limit: null },
    { key: 'paternity', limit: null },
  ]

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 4).map(({ key, limit }) => {
          const lt = LEAVE_TYPES[key]
          const used = balances?.[key]?.used || 0
          const remaining = limit != null ? limit - used : null
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
              style={{ background: lt.bg, color: lt.text }}>
              <span className="font-semibold">{lt.label}:</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>
                {remaining != null ? `${remaining} left` : `${used} used`}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map(({ key, limit }) => {
        const lt = LEAVE_TYPES[key]
        const used = balances?.[key]?.used || 0
        const remaining = limit != null ? limit - used : null
        const pct = limit ? Math.min((used / limit) * 100, 100) : 0

        return (
          <div key={key} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: lt.color }} />
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{lt.label}</span>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-bold text-stone-800" style={{ fontFamily: 'DM Mono, monospace' }}>
                {remaining != null ? remaining : used}
              </span>
              {limit != null ? (
                <span className="text-xs text-stone-400">/ {limit} days left</span>
              ) : (
                <span className="text-xs text-stone-400">days used</span>
              )}
            </div>
            {limit != null && (
              <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: pct > 80 ? '#f43f5e' : lt.color }}
                />
              </div>
            )}
            {limit != null && (
              <div className="text-xs text-stone-400 mt-1.5">{used} used of {limit}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
