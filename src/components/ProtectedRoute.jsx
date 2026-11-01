import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FullScreenLoader } from './ui'

function safeNext(from) {
  const path = from?.pathname || ''
  if (!path.startsWith('/') || path.startsWith('//') || path === '/login') return '/dashboard'
  return `${path}${from.search || ''}`
}

export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function GuestRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (session) return <Navigate to={safeNext(location.state?.from)} replace />
  return <Outlet />
}
