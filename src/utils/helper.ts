// src/utils/getUserOrgUuid.ts
import { User } from '@auth0/auth0-react'

// The user type might be extended, so keep it flexible
export const getUserRole = (user?: User): string => {
  return user?.organizations_with_roles?.[0]?.roles[0]?.toLowerCase()
}

export const getUserId = (user?: User): string => {
  return user?.user_data?.user_metadata?.uuid
}

export const isPracticeOwner = (user?: User): boolean => {
  const roles = user?.organizations_with_roles?.[0]?.roles ?? []
  return roles.some((role: string) => {
    const normalized = role.toLowerCase()
    return (
      normalized.includes('owner') ||
      normalized === 'company director'.toLowerCase()
    )
  })
}

export const isPracticeManager = (userData) => {
  return userData?.active_practices[0].user_role
    .toLowerCase()
    .includes('manager')
}
