import { JSX, Suspense } from 'react'
import { Navigate, useRoutes } from 'react-router'
import AppLayout from 'src/layouts/AppLayout'
import About from 'src/pages/About'
import Dashboard from 'src/pages/Dashboard'
import Home from 'src/pages/Home'
import NotFound from 'src/pages/NotFound'
import Profile from 'src/pages/Profile'
import { paths } from 'src/paths'

export function Router(): JSX.Element | null {
  const routes = [
    {
      path: paths.root,
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to={paths.dashboard} replace /> },
        { path: paths.dashboard, element: <Dashboard /> },
        { path: paths.home, element: <Home /> },
        {
          path: paths.profile.root,
          children: [
            { index: true, element: <Profile /> },
            { path: paths.profile.detail(), element: <About /> }
          ]
        }
      ]
    },
    { path: '*', element: <NotFound /> }
  ]

  return (
    <Suspense fallback={<div>Loading...</div>}>{useRoutes(routes)}</Suspense>
  )
}
