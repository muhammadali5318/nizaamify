// src/hooks/useUserDetails.ts
import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { selectUserDetailsInActivePractice } from 'src/store/slices/userDetailsInActivePracticeSlice'

/** shape based on the object you provided */
export interface UserDetailsInActivePractice {
  practice_id?: string
  practice_name?: string
  user_practice_status?: string
  user_role?: string
  is_nominated?: boolean
  id?: string
  first_name?: string
  last_name?: string
  email?: string
  contact_number?: string
  auth0_id?: string
}

/** return shape from the hook */
export interface UseUserDetailsResult {
  userId: string | null
  userFullName: string
  firstName: string | null
  lastName: string | null
  email: string | null
  contactNumber: string | null
  auth0Id: string | null
  userRole: string | null
  status: string | null
  practiceId: string | null
  practiceName: string | null
  initials: string
  isUserNominated: boolean
  isUserManager: boolean
  isUserOwner: boolean
  isUserDirector: boolean
  isUserOwnerOrDirector: boolean
}

export function useUserDetails(): UseUserDetailsResult {
  const user = useSelector(selectUserDetailsInActivePractice) as
    | UserDetailsInActivePractice
    | undefined

  const userId = user?.id ?? null
  const firstName = user?.first_name ?? null
  const lastName = user?.last_name ?? null
  const email = user?.email ?? null
  const contactNumber = user?.contact_number ?? null
  const auth0Id = user?.auth0_id ?? null
  const userRole = user?.user_role ?? null
  const status = user?.user_practice_status ?? null
  const practiceId = user?.practice_id ?? null
  const practiceName = user?.practice_name ?? null
  const isUserNominated = user?.is_nominated ?? false

  const userFullName = useMemo(() => {
    if (!firstName && !lastName) return ''
    return [firstName, lastName].filter(Boolean).join(' ')
  }, [firstName, lastName])

  const initials = useMemo(() => {
    const parts = [firstName, lastName].filter(Boolean) as string[]
    if (parts.length === 0) return ''
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
  }, [firstName, lastName])

  const isUserManager =
    user?.user_role?.toLowerCase().includes('manager') ?? false
  const isUserOwner = user?.user_role?.toLowerCase().includes('owner') ?? false
  const isUserDirector =
    user?.user_role?.toLowerCase().includes('director') ?? false

  const isUserOwnerOrDirector = isUserOwner || isUserDirector

  return {
    userId,
    userFullName,
    firstName,
    lastName,
    email,
    contactNumber,
    auth0Id,
    userRole,
    status,
    practiceId,
    practiceName,
    initials,
    isUserNominated,
    isUserManager,
    isUserOwner,
    isUserDirector,
    isUserOwnerOrDirector
  }
}

export default useUserDetails
