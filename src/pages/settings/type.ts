// src/types/settings.ts
import type { ReactNode } from 'react'

export interface SettingsWrapperProps {
  title: string
  description: string
  logo: string
  children: ReactNode
}

export type ComponentProps = Record<string, unknown>

export interface MenuItem {
  id: string
  label: string
  title: string
  description: string
  logo: string
  component: React.ComponentType<any>
  componentProps?: ComponentProps
}
