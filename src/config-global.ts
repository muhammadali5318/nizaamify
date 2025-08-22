export type ConfigValue = {
  serverUrl: string
}

export const CONFIG: ConfigValue = {
  serverUrl: import.meta.env.VITE_APP_API_URL ?? ''
}
