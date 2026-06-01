import { Navigate } from 'react-router-dom'

export default function AuthGuard({ children, isAuthenticated }) {
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}
