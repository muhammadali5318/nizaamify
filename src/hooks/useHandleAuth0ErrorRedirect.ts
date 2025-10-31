// File: src/auth/hooks/useAuthErrorRedirect.ts
import { useMemo } from 'react'
import { useLocation } from 'react-router'

export default function useAuthErrorRedirect(): string | null {
  const location = useLocation()

  return useMemo(() => {
    try {
      // Merge search and hash params (hash may contain query-like params)
      const params = new URLSearchParams(location.search)
      if (location.hash) {
        const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''))
        for (const [k, v] of hashParams.entries()) {
          if (!params.has(k)) params.set(k, v)
        }
      }

      const error = params.get('error') ?? ''
      const rawErrorDesc =
        params.get('error_description') ??
        params.get('error_description%3A') ??
        ''
      const decoded = decodeURIComponent(rawErrorDesc || '')
      const errorDesc = decoded.toLowerCase()
      // Map of substring -> redirect path. Add more handlers here if needed.
      const ERROR_MATCHERS: Array<{ match: string; path: string }> = [
        { match: 'email_not_verified', path: '/auth/verify-email' },
        {
          match: 'your account has been deactivated',
          path: 'logout'
        }
      ]

      if (error) {
        for (const e of ERROR_MATCHERS) {
          if (errorDesc.includes(e.match)) {
            // Try to extract auth0 id from the decoded description.
            // Common formats:
            //  - email_not_verified:auth0|68cae4db...
            //  - email_not_verified:auth0|68cae4db... (already decoded)
            let auth0Id: string | null = null

            // First, look for the auth0|<id> pattern
            const auth0Match = decoded.match(/auth0\|([A-Za-z0-9_-]+)/i)
            if (auth0Match && auth0Match[1]) {
              auth0Id = auth0Match[1]
            } else {
              // Fallback: take the substring after the first colon
              const colonIndex = decoded.indexOf(':')
              if (colonIndex !== -1) {
                const afterColon = decoded.slice(colonIndex + 1).trim()
                // strip any leading "auth0|" if present
                const rawId = afterColon.replace(/^auth0\|/i, '')
                const idMatch = rawId.match(/[A-Za-z0-9_-]+/)
                if (idMatch) auth0Id = idMatch[0]
              }
            }

            // Build redirect path. Append auth0Id as query param if found.
            if (auth0Id) {
              // ensure we don't accidentally double-encode
              const encoded = encodeURIComponent(auth0Id)
              return `${window.location.origin}${e.path}?auth0Id=${encoded}`
            }

            return window.location.origin
          }
        }
      }

      return null
    } catch {
      // On parse error, don't redirect
      return null
    }
  }, [location.pathname, location.search, location.hash])
}
