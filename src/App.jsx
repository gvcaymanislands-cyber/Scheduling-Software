import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MyLeaves from './pages/MyLeaves'
import MySchedule from './pages/MySchedule'
import AdminConsole from './pages/AdminConsole'
import Reports from './pages/Reports'
import Schedules from './pages/Schedules'
import RosterView from './pages/RosterView'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth()
  return currentUser ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { currentUser, isAdmin } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { currentUser } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="my-leaves" element={<MyLeaves />} />
        <Route path="my-schedule" element={<MySchedule />} />
        <Route path="roster" element={<RosterView />} />
        <Route path="admin" element={<AdminRoute><AdminConsole /></AdminRoute>} />
        <Route path="schedules" element={<AdminRoute><Schedules /></AdminRoute>} />
        <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
