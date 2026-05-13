// Cross-cutting handler for the `no_access_to_shop` server error.
//
// When an owner revokes a team member's access (or deletes their
// user_shop_access row), the member's existing JWT is still valid —
// every API call fires `current_active_shop_id()`, which now raises
// P0001 `no_access_to_shop`. Without this handler the user sees raw
// error blobs from every cached query and can't recover until the
// 60s self-permission cache rolls over.
//
// Behaviour:
//   1. Set a sessionStorage flag so the /login page can show a banner.
//   2. Clear the persisted active-shop id (otherwise customFetch keeps
//      injecting the stale header into the next request).
//   3. supabase.auth.signOut() — server-side session invalidation +
//      `onAuthStateChange` propagates to AuthProvider.
//   4. Force-navigate to /login (signOut + RequireAuth would do the
//      same after a tick, but we want the redirect to be immediate
//      and survive any in-flight code paths).
//
// Idempotent at the module scope: a burst of in-flight requests will
// each surface no_access_to_shop, but only the first triggers the
// flow.

import { setActiveShopId } from './activeShop'

const REVOKED_FLAG_KEY = 'nizaamify.access_revoked'

let handled = false

export async function triggerAccessRevoked(): Promise<void> {
  if (handled) return
  handled = true

  try {
    sessionStorage.setItem(REVOKED_FLAG_KEY, '1')
  } catch {
    // sessionStorage disabled — banner won't show but flow continues
  }
  setActiveShopId(null)

  // Lazy import to avoid the circular dep with supabase.ts → customFetch.ts.
  const { supabase } = await import('./supabase')
  await supabase.auth.signOut()

  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

export function consumeAccessRevokedFlag(): boolean {
  try {
    const v = sessionStorage.getItem(REVOKED_FLAG_KEY)
    if (v) {
      sessionStorage.removeItem(REVOKED_FLAG_KEY)
      return true
    }
  } catch {
    // ignore
  }
  return false
}
