import { createClient } from '@supabase/supabase-js'
import type { Database } from 'src/types/database'
import { customFetch } from './customFetch'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    // Injects the `app-shop-id` header from localStorage on every request.
    // Reads via current_active_shop_id() (mig 0070/0084/0085) on the server.
    fetch: customFetch
  }
})
