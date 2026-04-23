import { Navigate } from 'react-router'
import { paths } from 'src/paths'

export const authRoutes = [
  {
    path: '/auth',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/login',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/logout',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/signup',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/verify-email',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/subscribed',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/subscription-failed',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/invite-user',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/access-request',
    element: <Navigate to={paths.dashboard} replace />
  },
  {
    path: '/auth/signup/agreements',
    element: <Navigate to={paths.dashboard} replace />
  }
]
