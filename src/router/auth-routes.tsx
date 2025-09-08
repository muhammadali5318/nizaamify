import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router'
import RedirectAuthGuard from 'src/auth/RedirectAuthGuard'
import { SplashScreen } from 'src/components/common/SplashScreen'
import AuthLayout from 'src/layouts/AuthLayout'

const AuthPages = {
  Login: lazy(() => import('src/auth/Login')),
  Logout: lazy(() => import('src/auth/Logout')),
  Signup: lazy(() => import('src/pages/signup')),
  Congratulations: lazy(
    () => import('src/pages/signup/components/Congratulations')
  )
}

export const authRoutes = [
  {
    path: '/auth',
    element: (
      <Suspense fallback={<SplashScreen />}>
        <RedirectAuthGuard>
          <Outlet />
        </RedirectAuthGuard>
      </Suspense>
    ),
    children: [
      {
        path: 'login',
        element: (
          <AuthLayout>
            <AuthPages.Login />
          </AuthLayout>
        )
      },
      {
        path: 'logout',
        element: (
          <AuthLayout>
            <AuthPages.Logout />
          </AuthLayout>
        )
      },
      {
        path: 'signup',
        element: (
          <AuthLayout>
            <AuthPages.Signup />
          </AuthLayout>
        )
      },
      {
        path: 'signup/congratulations',
        element: (
          <AuthLayout>
            <AuthPages.Congratulations />
          </AuthLayout>
        )
      }
    ]
  }
]
