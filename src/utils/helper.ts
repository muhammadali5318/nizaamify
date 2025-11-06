// src/utils/getUserOrgUuid.ts
import { User } from '@auth0/auth0-react'

export const getUserId = (user?: User): string => {
  return user?.user_data?.user_metadata?.uuid
}
