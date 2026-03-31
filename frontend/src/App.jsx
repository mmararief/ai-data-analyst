import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ChatPage from './pages/ChatPage'

function AuthGuard({ children, isAuthenticated }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function HomeWrapper() {
  const navigate = useNavigate()
  return <HomePage onStart={() => navigate('/login')} />
}

export default function App() {
  const [username, setUsername] = useState(() => localStorage.getItem('username'))
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!(localStorage.getItem('token') && localStorage.getItem('username'))
  )

  const handleLogin = (user) => {
    localStorage.setItem('username', user)
    setUsername(user)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setUsername(null)
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
              ? <DashboardPage username={username} onLogout={handleLogout} />
              : <HomeWrapper />
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
