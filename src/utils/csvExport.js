import { LEAVE_TYPES } from './leaveUtils'

export function exportLeavesToCSV(leaves, employees) {
  const headers = [
    'Employee', 'Leave Type', 'Start Date', 'End Date',
    'Working Days', 'Half Day', 'Status', 'Notes', 'Requested At', 'Reviewed By'
  ]

  const empMap = {}
  employees.forEach(e => { empMap[e.id] = e.name })

  const rows = leaves.map(l => [
    empMap[l.userId] || l.userName || l.userId,
    LEAVE_TYPES[l.type]?.label || l.type,
    l.startDate,
    l.endDate,
    l.isHalfDay ? '0.5' : (l.workingDays || ''),
    l.isHalfDay ? (l.halfDayPeriod || 'morning') : '',
    l.status,
    l.notes || '',
    l.requestedAt ? new Date(l.requestedAt.seconds * 1000).toLocaleDateString() : '',
    l.reviewedBy || '',
  ])

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leave-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportBalancesToCSV(employees, balances) {
  const headers = ['Employee', 'Annual Used', 'Annual Remaining', 'Sick Used', 'Sick Remaining', 'Lieu Days Used', 'Remote Days Used']
  const rows = employees.map(e => {
    const b = balances[e.id] || {}
    return [
      e.name,
      b.annual?.used ?? 0,
      b.annual?.remaining ?? 20,
      b.sick?.used ?? 0,
      b.sick?.remaining ?? 10,
      b.lieu?.used ?? 0,
      b.remote?.used ?? 0,
    ]
  })

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `leave-balances-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
