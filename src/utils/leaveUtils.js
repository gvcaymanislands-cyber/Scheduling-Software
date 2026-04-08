// Cayman Islands Public Holidays
export const CAYMAN_HOLIDAYS = {
  2024: [
    { name: "New Year's Day", date: '2024-01-01' },
    { name: 'National Heroes Day', date: '2024-01-22' },
    { name: 'Ash Wednesday', date: '2024-02-14' },
    { name: 'Good Friday', date: '2024-03-29' },
    { name: 'Easter Monday', date: '2024-04-01' },
    { name: 'Discovery Day', date: '2024-05-20' },
    { name: "King's Birthday", date: '2024-06-17' },
    { name: 'Constitution Day', date: '2024-07-01' },
    { name: 'Remembrance Day', date: '2024-11-11' },
    { name: 'Christmas Day', date: '2024-12-25' },
    { name: 'Boxing Day', date: '2024-12-26' },
  ],
  2025: [
    { name: "New Year's Day", date: '2025-01-01' },
    { name: 'National Heroes Day', date: '2025-01-27' },
    { name: 'Ash Wednesday', date: '2025-03-05' },
    { name: 'Good Friday', date: '2025-04-18' },
    { name: 'Easter Monday', date: '2025-04-21' },
    { name: 'Discovery Day', date: '2025-05-19' },
    { name: "King's Birthday", date: '2025-06-09' },
    { name: 'Constitution Day', date: '2025-07-07' },
    { name: 'Remembrance Day', date: '2025-11-10' },
    { name: 'Christmas Day', date: '2025-12-25' },
    { name: 'Boxing Day', date: '2025-12-26' },
  ],
  2026: [
    { name: "New Year's Day", date: '2026-01-01' },
    { name: 'National Heroes Day', date: '2026-01-26' },
    { name: 'Ash Wednesday', date: '2026-02-18' },
    { name: 'Good Friday', date: '2026-04-03' },
    { name: 'Easter Monday', date: '2026-04-06' },
    { name: 'Discovery Day', date: '2026-05-18' },
    { name: "King's Birthday", date: '2026-06-08' },
    { name: 'Constitution Day', date: '2026-07-06' },
    { name: 'Remembrance Day', date: '2026-11-09' },
    { name: 'Christmas Day', date: '2026-12-25' },
    { name: 'Boxing Day', date: '2026-12-28' },
  ],
}

export function isHoliday(dateStr, holidayDates) {
  return holidayDates.includes(dateStr)
}

export function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  return day === 0 || day === 6
}

// DAY NUMBERS: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5] // Mon–Fri

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Get the employee's effective working day numbers
// schedule = { type: 'fixed', workingDays: [1,2,3,4,5] } | { type: 'variable' }
export function getWorkingDayNumbers(schedule) {
  if (!schedule || schedule.type === 'fixed') {
    return schedule?.workingDays || DEFAULT_WORK_DAYS
  }
  return DEFAULT_WORK_DAYS // variable schedules are checked per-date separately
}

// Check if a specific date is a working day for an employee
// For variable schedule employees, pass rosterDates (array of date strings they're scheduled to work)
export function isWorkingDay(dateStr, holidayDates, schedule, rosterDates = []) {
  if (isHoliday(dateStr, holidayDates)) return false
  if (!schedule || schedule.type === 'fixed') {
    const workDays = schedule?.workingDays || DEFAULT_WORK_DAYS
    const dayNum = new Date(dateStr + 'T12:00:00').getDay()
    return workDays.includes(dayNum)
  }
  // Variable schedule — check roster
  return rosterDates.includes(dateStr)
}

// Count working days between two dates, respecting employee schedule
export function countWorkingDays(startStr, endStr, holidayDates, schedule = null, rosterDates = []) {
  const start = new Date(startStr + 'T12:00:00')
  const end = new Date(endStr + 'T12:00:00')
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const ds = cur.toISOString().slice(0, 10)
    if (isWorkingDay(ds, holidayDates, schedule, rosterDates)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// Get start of week (Monday) for a given date string
export function getWeekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // adjust to Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

// Generate the 7 dates of a week starting from a Monday date string
export function getWeekDates(mondayStr) {
  const dates = []
  const start = new Date(mondayStr + 'T12:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

export function getDatesInRange(startStr, endStr) {
  const dates = []
  const start = new Date(startStr + 'T12:00:00')
  const end = new Date(endStr + 'T12:00:00')
  const cur = new Date(start)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export const LEAVE_TYPES = {
  annual: { label: 'Annual Leave', color: '#10b981', bg: '#d1fae5', text: '#065f46' },
  sick: { label: 'Sick Leave', color: '#f43f5e', bg: '#ffe4e6', text: '#9f1239' },
  lieu: { label: 'Lieu Day', color: '#8b5cf6', bg: '#ede9fe', text: '#4c1d95' },
  remote: { label: 'Remote Work', color: '#3b82f6', bg: '#dbeafe', text: '#1e3a8a' },
  unpaid: { label: 'Unpaid Leave', color: '#f97316', bg: '#ffedd5', text: '#7c2d12' },
  maternity: { label: 'Maternity', color: '#ec4899', bg: '#fce7f3', text: '#831843' },
  paternity: { label: 'Paternity', color: '#6366f1', bg: '#e0e7ff', text: '#312e81' },
}

export const LEAVE_LIMITS = {
  annual: 20,
  sick: 10,
  lieu: null,
  remote: null,
  unpaid: null,
  maternity: null,
  paternity: null,
}
