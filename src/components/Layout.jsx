import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Calendar, Settings, LogOut,
  LayoutDashboard, BarChart2, Menu, X, CalendarDays, Grid3X3, ClipboardList
} from 'lucide-react'
import { useState } from 'react'

export default function Layout() {
  const { userProfile, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??'

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/my-leaves', label: 'My Leaves', icon: Calendar },
    { to: '/my-schedule', label: 'My Schedule', icon: ClipboardList },
    { to: '/roster', label: 'Team Roster', icon: Grid3X3 },
    ...(isAdmin ? [
      { to: '/admin', label: 'Admin Console', icon: Settings },
      { to: '/schedules', label: 'Schedules', icon: CalendarDays },
      { to: '/reports', label: 'Reports', icon: BarChart2 },
    ] : []),
  ]

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,158,11,0.15)' }}>
          <Calendar size={18} color="#f59e0b" />
        </div>
        <div>
          <div className="text-white font-bold text-base leading-none">TeamLeave</div>
          <div className="text-slate-500 text-xs mt-0.5">Cayman Islands</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5">
        {navLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            onClick={() => setMobileOpen(false)}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 mt-4">
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: '#f59e0b', color: '#0f172a' }}>
            {initials(userProfile?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{userProfile?.name || 'User'}</div>
            <div className="text-slate-400 text-xs truncate capitalize">{userProfile?.role}</div>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0" style={{ background: 'var(--sidebar)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-56 flex flex-col" style={{ background: 'var(--sidebar)' }}>
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-stone-100">
          <div className="flex items-center gap-2">
            <Calendar size={18} color="#f59e0b" />
            <span className="font-bold">TeamLeave</span>
          </div>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
