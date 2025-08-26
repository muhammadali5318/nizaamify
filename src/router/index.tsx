import { ReactNode } from 'react'
import { Navigate, useRoutes } from 'react-router'
import AppLayout from 'src/layouts/AppLayout.tsx'

// Dummy pages
const Dashboard = () => <h1>Dashboard</h1>
const Reports = () => <h1>Reports</h1>
const Sales = () => <h1>Sales</h1>
const SalesDetail = () => <h1>Sales Detail</h1>
const NotFound = () => <h1>404 - Not Found</h1>

export function Router(): ReactNode {
  const routes = [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <Navigate to='/dashboard' replace /> },
        { path: 'dashboard', element: <Dashboard /> },
        { path: 'reports', element: <Reports /> },
        {
          path: 'sales',
          children: [
            { index: true, element: <Sales /> },
            { path: ':id', element: <SalesDetail /> }
          ]
        }
      ]
    },
    { path: '*', element: <NotFound /> }
  ]

  return useRoutes(routes)
}
