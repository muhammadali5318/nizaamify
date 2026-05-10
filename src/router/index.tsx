import { Navigate, RouteObject, useRoutes } from 'react-router'
import AppShell from 'src/layouts/AppShell'
import { paths } from 'src/paths'
import NotFound from 'src/pages/NotFound'

import LoginPage from 'src/features/auth/LoginPage'
import SignupPage from 'src/features/auth/SignupPage'
import ForgotPasswordPage from 'src/features/auth/ForgotPasswordPage'
import ResetPasswordPage from 'src/features/auth/ResetPasswordPage'
import VerifyEmailPage from 'src/features/auth/VerifyEmailPage'
import OnboardingPage from 'src/features/onboarding/OnboardingPage'
import SubscriptionExpiredPage from 'src/features/subscription/SubscriptionExpiredPage'
import DashboardPage from 'src/features/dashboard/DashboardPage'
import SettingsPage from 'src/features/settings/SettingsPage'
import SupportPage from 'src/features/settings/SupportPage'
import ProductsListPage from 'src/features/products/ProductsListPage'
import ProductFormPage from 'src/features/products/ProductFormPage'
import PurchasesListPage from 'src/features/purchases/PurchasesListPage'
import NewPurchasePage from 'src/features/purchases/NewPurchasePage'
import PurchaseDetailPage from 'src/features/purchases/PurchaseDetailPage'
import SalesListPage from 'src/features/sales/SalesListPage'
import SaleDetailPage from 'src/features/sales/SaleDetailPage'
import POSPage from 'src/features/pos/POSPage'
import CustomersListPage from 'src/features/customers/CustomersListPage'
import CustomerDetailPage from 'src/features/customers/CustomerDetailPage'
import CustomerFormPage from 'src/features/customers/CustomerFormPage'
import KhataPage from 'src/features/khata/KhataPage'
import SuppliersListPage from 'src/features/suppliers/SuppliersListPage'
import SupplierFormPage from 'src/features/suppliers/SupplierFormPage'
import ExpensesPage from 'src/features/expenses/ExpensesPage'
import TargetsPage from 'src/features/targets/TargetsPage'
import ReportsPage from 'src/features/reports/ReportsPage'

import {
  RedirectIfActiveSubscription,
  RedirectIfAuthed,
  RedirectIfOnboarded,
  RequireActiveSubscription,
  RequireAuth,
  RequireOnboarded
} from 'src/lib/guards'

export function Router() {
  const routes: RouteObject[] = [
    {
      path: paths.login,
      element: (
        <RedirectIfAuthed>
          <LoginPage />
        </RedirectIfAuthed>
      )
    },
    {
      path: paths.signup,
      element: (
        <RedirectIfAuthed>
          <SignupPage />
        </RedirectIfAuthed>
      )
    },
    {
      path: paths.forgotPassword,
      element: (
        <RedirectIfAuthed>
          <ForgotPasswordPage />
        </RedirectIfAuthed>
      )
    },
    { path: paths.resetPassword, element: <ResetPasswordPage /> },
    { path: paths.verifyEmail, element: <VerifyEmailPage /> },

    {
      path: paths.onboarding,
      element: (
        <RequireAuth>
          <RedirectIfOnboarded>
            <OnboardingPage />
          </RedirectIfOnboarded>
        </RequireAuth>
      )
    },
    {
      path: paths.subscriptionExpired,
      element: (
        <RequireAuth>
          <RequireOnboarded>
            <RedirectIfActiveSubscription>
              <SubscriptionExpiredPage />
            </RedirectIfActiveSubscription>
          </RequireOnboarded>
        </RequireAuth>
      )
    },

    {
      element: (
        <RequireAuth>
          <RequireOnboarded>
            <AppShell />
          </RequireOnboarded>
        </RequireAuth>
      ),
      children: [
        { index: true, element: <Navigate to={paths.dashboard} replace /> },
        // Always-accessible (any subscription state)
        { path: paths.settings, element: <SettingsPage /> },
        { path: paths.support, element: <SupportPage /> },
        // Subscription-gated
        {
          path: paths.dashboard,
          element: (
            <RequireActiveSubscription>
              <DashboardPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.products,
          element: (
            <RequireActiveSubscription>
              <ProductsListPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.newProduct,
          element: (
            <RequireActiveSubscription>
              <ProductFormPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.productDetail,
          element: (
            <RequireActiveSubscription>
              <ProductFormPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.purchases,
          element: (
            <RequireActiveSubscription>
              <PurchasesListPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.newPurchase,
          element: (
            <RequireActiveSubscription>
              <NewPurchasePage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.purchaseDetail,
          element: (
            <RequireActiveSubscription>
              <PurchaseDetailPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.sales,
          element: (
            <RequireActiveSubscription>
              <SalesListPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.saleDetail,
          element: (
            <RequireActiveSubscription>
              <SaleDetailPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.pos,
          element: (
            <RequireActiveSubscription>
              <POSPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.customers,
          element: (
            <RequireActiveSubscription>
              <CustomersListPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.newCustomer,
          element: (
            <RequireActiveSubscription>
              <CustomerFormPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.customerEdit,
          element: (
            <RequireActiveSubscription>
              <CustomerFormPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.customerDetail,
          element: (
            <RequireActiveSubscription>
              <CustomerDetailPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.khata,
          element: (
            <RequireActiveSubscription>
              <KhataPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.suppliers,
          element: (
            <RequireActiveSubscription>
              <SuppliersListPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.newSupplier,
          element: (
            <RequireActiveSubscription>
              <SupplierFormPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.supplierEdit,
          element: (
            <RequireActiveSubscription>
              <SupplierFormPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.expenses,
          element: (
            <RequireActiveSubscription>
              <ExpensesPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.targets,
          element: (
            <RequireActiveSubscription>
              <TargetsPage />
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.reports,
          element: (
            <RequireActiveSubscription>
              <ReportsPage />
            </RequireActiveSubscription>
          )
        }
      ]
    },

    { path: '*', element: <NotFound /> }
  ]

  return useRoutes(routes)
}
