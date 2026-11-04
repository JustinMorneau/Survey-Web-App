import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../lib/useAuth'

export default function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <p role="status" className="p-8 text-center text-muted">
        Loading...
      </p>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
