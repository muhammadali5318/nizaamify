// localStorage transport for the active shop ID. The `app-shop-id`
// HTTP header is sourced from this value by customFetch; the
// `current_active_shop_id()` Postgres function reads the header.
//
// Empty / missing localStorage = no header sent = server-side fallback
// path fires (migration 0085: returns the user's sole shop if they
// have exactly one; otherwise NULL → no_shop_for_user). The fallback
// keeps single-shop owners working without ever populating this key.
//
// The shop switcher writes this key via useSetActiveShop (Phase D.2);
// for v2.9.1 pilot phase (single-shop owners) it usually stays empty.

const KEY = 'nizaamify.active_shop_id'

export function getActiveShopId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(KEY) || null
  } catch {
    return null
  }
}

export function setActiveShopId(id: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (id == null) window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, id)
  } catch {
    // localStorage disabled — silently ignore; server fallback handles it
  }
}
