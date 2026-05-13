// customFetch wraps the default fetch to inject the `app-shop-id`
// HTTP header on every Supabase request. The header value is read
// from localStorage via getActiveShopId(); when absent, no header
// is sent and the server falls back to single-shop resolution
// (migration 0085).
//
// Wired into createClient via { global: { fetch: customFetch } }.

import { getActiveShopId } from './activeShop'

export const customFetch: typeof fetch = (input, init) => {
  const shopId = getActiveShopId()
  if (shopId == null) return fetch(input, init)

  const headers = new Headers(init?.headers)
  // Don't overwrite if caller already provided one (defensive)
  if (!headers.has('app-shop-id')) {
    headers.set('app-shop-id', shopId)
  }
  return fetch(input, { ...init, headers })
}
