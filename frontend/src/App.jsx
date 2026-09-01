import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'
import AdminPage from './pages/AdminPage'
import AuthGuard from './components/AuthGuard'
import api from './api'

function HomeWrapper() {
  const navigate = useNavigate()
  return <HomePage onStart={() => navigate('/login')} />
}

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('username'))
  const [role, setRole] = useState(() => localStorage.getItem('role') || 'user')
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(localStorage.getItem('token') && localStorage.getItem('username'))
  )

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/auth/me').then(res => {
        if (res.data?.role) {
          setRole(res.data.role)
          localStorage.setItem('role', res.data.role)
        }
      }).catch(() => {})
    }
  }, [isAuthenticated])

  const handleLogin = (user, userRole = 'user') => {
    localStorage.setItem('username', user)
    localStorage.setItem('role', userRole)
    setUsername(user)
    setRole(userRole)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    setUsername(null)
    setRole('user')
    setIsAuthenticated(false)
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            isAuthenticated
              ? <Navigate to="/" replace />
              : <AuthPage onLogin={handleLogin} />
          }
        />
        <Route
          path="/welcome"
          element={
            <Navigate to="/" replace />
          }
        />

        {/* Root: public home when belum login, dashboard ketika sudah login */}
        <Route
          path="/"
          element={
            isAuthenticated
              ? <DashboardPage username={username} role={role} onLogout={handleLogout} />
              : <HomeWrapper />
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={
            <AuthGuard isAuthenticated={isAuthenticated}>
              <AdminPage username={username} role={role} onLogout={handleLogout} />
            </AuthGuard>
          }
        />

        {/* Protected routes */}
        <Route
          path="/project/:projectId"
          element={
            <AuthGuard isAuthenticated={isAuthenticated}>
              <ChatPage username={username} onLogout={handleLogout} />
            </AuthGuard>
          }
        />
        <Route
          path="/project/:projectId/chat/:sessionId"
          element={
            <AuthGuard isAuthenticated={isAuthenticated}>
              <ChatPage username={username} onLogout={handleLogout} />
            </AuthGuard>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
