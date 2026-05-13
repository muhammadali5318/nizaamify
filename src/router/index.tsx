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
import TiersPage from 'src/features/tiers/TiersPage'
import VariantAttributesPage from 'src/features/variants/VariantAttributesPage'
import ProductsListPage from 'src/features/products/ProductsListPage'
import ProductFormPage from 'src/features/products/ProductFormPage'
import ProductDetailPage from 'src/features/products/ProductDetailPage'
import ExpiredStockListPage from 'src/features/batches/ExpiredStockListPage'
import ExpiredSalesListPage from 'src/features/sales/ExpiredSalesListPage'
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
import TeamPage from 'src/features/team/TeamPage'
import AcceptInvitationPage from 'src/features/team/AcceptInvitationPage'

import {
  RedirectIfActiveSubscription,
  RedirectIfAuthed,
  RedirectIfOnboarded,
  RequireActiveSubscription,
  RequireAnyPermission,
  RequireAuth,
  RequireOnboarded,
  RequirePermission
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
      // /invite/accept is intentionally NOT wrapped in RequireOnboarded
      // or the AppShell wrapper: invitees may be auth'd but not onboarded
      // (they bypass the owner wizard; the page self-updates onboarding_
      // completed after a successful accept).
      path: paths.acceptInvitation,
      element: (
        <RequireAuth>
          <AcceptInvitationPage />
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
        {
          path: paths.tiers,
          element: (
            <RequirePermission permission='manage_customer_tiers'>
              <TiersPage />
            </RequirePermission>
          )
        },
        {
          path: paths.variantAttributes,
          element: (
            <RequirePermission permission='manage_variant_attributes'>
              <VariantAttributesPage />
            </RequirePermission>
          )
        },
        {
          path: paths.team,
          element: (
            <RequirePermission permission='view_team'>
              <TeamPage />
            </RequirePermission>
          )
        },
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
              <RequirePermission permission='view_products'>
                <ProductsListPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.newProduct,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='create_product'>
                <ProductFormPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.productDetail,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_products'>
                <ProductDetailPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.expiredInventory,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_inventory_batches'>
                <ExpiredStockListPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          // Per E.3 matrix discrepancy #1 + page audit doc §6: this page is
          // an audit/management surface ("who sold expired stock?"). Requires
          // both view_inventory_batches AND view_all_sales — salespersons
          // (who have view_inventory_batches but not view_all_sales by
          // default) shouldn't see other staff's sales.
          path: paths.expiredSales,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_all_sales'>
                <RequirePermission permission='view_inventory_batches'>
                  <ExpiredSalesListPage />
                </RequirePermission>
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.purchases,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_purchases'>
                <PurchasesListPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.newPurchase,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='record_purchase'>
                <NewPurchasePage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.purchaseDetail,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_purchases'>
                <PurchaseDetailPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.sales,
          element: (
            <RequireActiveSubscription>
              <RequireAnyPermission
                permissions={['record_sale', 'view_all_sales']}
              >
                <SalesListPage />
              </RequireAnyPermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.saleDetail,
          element: (
            <RequireActiveSubscription>
              <RequireAnyPermission
                permissions={['record_sale', 'view_all_sales']}
              >
                <SaleDetailPage />
              </RequireAnyPermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.pos,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='record_sale'>
                <POSPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.customers,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_customers'>
                <CustomersListPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.newCustomer,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='create_customer_basic'>
                <CustomerFormPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.customerEdit,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='edit_customer'>
                <CustomerFormPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.customerDetail,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_customers'>
                <CustomerDetailPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.khata,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_customer_khata'>
                <KhataPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.suppliers,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_suppliers'>
                <SuppliersListPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.newSupplier,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='manage_suppliers'>
                <SupplierFormPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.supplierEdit,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='manage_suppliers'>
                <SupplierFormPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.expenses,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_expenses'>
                <ExpensesPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.targets,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_monthly_targets'>
                <TargetsPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        },
        {
          path: paths.reports,
          element: (
            <RequireActiveSubscription>
              <RequirePermission permission='view_reports'>
                <ReportsPage />
              </RequirePermission>
            </RequireActiveSubscription>
          )
        }
      ]
    },

    { path: '*', element: <NotFound /> }
  ]

  return useRoutes(routes)
}
