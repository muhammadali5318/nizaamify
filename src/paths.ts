export const paths = {
  root: '/',

  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  verifyEmail: '/verify-email',

  onboarding: '/onboarding',
  subscriptionExpired: '/subscription/expired',

  dashboard: '/dashboard',

  pos: '/pos',

  products: '/products',
  newProduct: '/products/new',
  productDetail: '/products/:id',
  gotoProduct: (id: string) => `/products/${id}`,

  customers: '/customers',
  newCustomer: '/customers/new',
  customerDetail: '/customers/:id',
  customerEdit: '/customers/:id/edit',
  gotoCustomer: (id: string) => `/customers/${id}`,
  gotoCustomerEdit: (id: string) => `/customers/${id}/edit`,

  suppliers: '/suppliers',
  newSupplier: '/suppliers/new',
  supplierEdit: '/suppliers/:id/edit',
  gotoSupplierEdit: (id: string) => `/suppliers/${id}/edit`,

  khata: '/khata',

  purchases: '/purchases',
  newPurchase: '/purchases/new',
  purchaseDetail: '/purchases/:id',
  gotoPurchase: (id: string) => `/purchases/${id}`,

  sales: '/sales',
  saleDetail: '/sales/:id',
  gotoSale: (id: string) => `/sales/${id}`,

  expenses: '/expenses',

  targets: '/targets',

  reports: '/reports',

  settings: '/settings',
  support: '/settings/support',
  tiers: '/settings/tiers',

  notFound: '/404'
}
