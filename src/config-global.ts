export type ConfigValue = {
  serverUrl: string
  auth: {
    clientId: string
    domain: string
    callbackUrl: string
    audience: string
  }
}

export const CONFIG: ConfigValue = {
  serverUrl: import.meta.env.VITE_API_URL ?? '',
  auth: {
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID ?? '',
    domain: import.meta.env.VITE_AUTH0_DOMAIN ?? '',
    callbackUrl: import.meta.env.VITE_AUTH0_CALLBACK_URL ?? '',
    audience: import.meta.env.VITE_AUTH0_AUDIENCE ?? ''
  }
}
