import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, Calendar, AlertCircle } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError('Invalid email or password. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] p-12 text-white" style={{ background: 'var(--sidebar)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.2)' }}>
            <Calendar size={18} color="#f59e0b" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">TeamLeave</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4" style={{ color: '#f8fafc' }}>
            Leave & scheduling<br />
            <span style={{ color: '#f59e0b' }}>made simple.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Request time off, track balances, manage approvals — all in one clean workspace for your team.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { num: '20', label: 'Annual leave days' },
            { num: '6', label: 'Leave types tracked' },
            { num: '11', label: 'Cayman holidays' },
            { num: '∞', label: 'Team members' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-2xl font-bold text-white mb-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>{s.num}</div>
              <div className="text-xs text-slate-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Calendar size={22} color="#f59e0b" />
            <span className="font-bold text-lg">TeamLeave</span>
          </div>

          <h2 className="text-2xl font-bold text-stone-800 mb-1">Welcome back</h2>
          <p className="text-stone-500 text-sm mb-8">Sign in to your account</p>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-3 text-base rounded-xl mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Signing in…
                </span>
              ) : (
                <><LogIn size={16} /> Sign in</>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-stone-400 mt-8">
            Contact your admin to get access.
          </p>
        </div>
      </div>
    </div>
  )
}
