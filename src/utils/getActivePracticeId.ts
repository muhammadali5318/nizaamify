// src/utils/getUserOrgUuid.ts
import { User } from '@auth0/auth0-react'

// The user type might be extended, so keep it flexible
export const getUserOrgUuid = (user?: User): string => {
  return user?.organizations_with_roles?.[0]?.metadata?.uuid
}
