export type ConfigValue = {
  envName: 'dev' | 'qa' | 'unknown'
  serverUrl: string
  auth: {
    clientId: string
    domain: string
    callbackUrl: string
    audience: string
  }
}

function detectEnv(audience?: string): 'dev' | 'qa' | 'unknown' {
  if (!audience) return 'unknown'
  if (audience.includes('dev')) return 'dev'
  if (audience.includes('qa')) return 'qa'
  return 'unknown'
}

export const CONFIG: ConfigValue = {
  envName: detectEnv(import.meta.env.VITE_AUTH0_AUDIENCE),
  serverUrl: import.meta.env.VITE_API_URL ?? '',
  auth: {
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID ?? '',
    domain: import.meta.env.VITE_AUTH0_DOMAIN ?? '',
    callbackUrl: import.meta.env.VITE_AUTH0_CALLBACK_URL ?? '',
    audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? ''
  }
}
