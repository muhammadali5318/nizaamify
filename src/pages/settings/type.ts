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

export type UserApiProfile = {
  id?: string
  first_name?: string
  last_name?: string
  contact_number?: string
  email?: string
  role?: string
}

export type UserProfileForm = {
  firstName: string
  lastName: string
  email: string
  role?: string
  phone?: string
}

export type StepProps = {
  onNext: () => void
  onBack: () => void
  activeStep: number
}
