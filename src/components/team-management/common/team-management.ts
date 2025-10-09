export const USER_ROLES = [
  { value: 'PRACTICE OWNER', label: 'Practice Owner' },
  { value: 'PRACTICE MANAGER', label: 'Practice Manager' },
  { value: 'COMPANY DIRECTOR', label: 'Company Director' },
  { value: 'PRACTICE USER', label: 'Practice User' }
] as const

export type UserRole = (typeof USER_ROLES)[number]['value']

export interface InviteUserFormData {
  email: string
  role: UserRole
}

export interface InvitedUserData {
  email: string
  role: UserRole
}

export interface TeamMemberInvitation {
  id: string
  email: string
  role: UserRole
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  invitedAt: string
  expiresAt: string
  invitedBy: string
}

export const getRoleLabel = (roleValue: string): string => {
  const roleMap: Record<string, string> = Object.fromEntries(
    USER_ROLES.map((role) => [role.value, role.label])
  )
  return roleMap[roleValue] || roleValue
}
