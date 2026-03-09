import { useState, useEffect } from 'react'
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'

function getSessionFromUrl() {
  const m = window.location.pathname.match(/^\/chat\/([a-zA-Z0-9-]+)$/)
  return m ? m[1] : null
}

export default function App() {
  const [username, setUsername] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [initialSessionId] = useState(getSessionFromUrl)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('username')
    if (token && savedUser) {
      setUsername(savedUser)
    }
  }, [])

  const handleLogin = (user) => {
    localStorage.setItem('username', user)
    setUsername(user)
    setShowAuth(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    setUsername(null)
    setShowAuth(false)
    window.history.replaceState({}, '', '/')
  }

  if (username) return <ChatPage username={username} onLogout={handleLogout} initialSessionId={initialSessionId} />
  if (showAuth) return <AuthPage onLogin={handleLogin} onBack={() => setShowAuth(false)} />
  return <HomePage onStart={() => setShowAuth(true)} />
}
