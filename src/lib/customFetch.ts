// customFetch wraps the default fetch to inject the `app-shop-id`
// HTTP header on every Supabase request. The header value is read
// from localStorage via getActiveShopId(); when absent, no header
// is sent and the server falls back to single-shop resolution
// (migration 0085).
//
// It also post-inspects responses for `no_access_to_shop` — the
// owner-revoked-this-member case. See lib/accessRevoked.ts.
//
// Wired into createClient via { global: { fetch: customFetch } }.

import { getActiveShopId } from './activeShop'
import { triggerAccessRevoked } from './accessRevoked'

export const customFetch: typeof fetch = async (input, init) => {
  const shopId = getActiveShopId()
  const headers = new Headers(init?.headers)
  if (shopId != null && !headers.has('app-shop-id')) {
    headers.set('app-shop-id', shopId)
  }
  const response = await fetch(input, { ...init, headers })

  // PostgREST surfaces RAISE EXCEPTION as a JSON body with the
  // message in `message`. 401/403/4xx with body containing
  // `no_access_to_shop` means the caller's user_shop_access row is
  // gone — sign them out + redirect. Clone so the caller's body
  // remains untouched.
  if (response.status >= 400 && response.status < 500) {
    const cloned = response.clone()
    try {
      const text = await cloned.text()
      if (text.includes('no_access_to_shop')) {
        void triggerAccessRevoked()
      }
    } catch {
      // Body wasn't readable; ignore
    }
  }
  return response
}
