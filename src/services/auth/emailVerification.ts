// File: src/services/auth/sendVerificationEmail.ts
import { apiClientOpen } from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

const { verifyEmail } = endpoints.signup

type Payload = { email?: string; auth0Id?: string }

/**
 * Send verification request using either email or auth0Id.
 * Preference: auth0Id (if provided) -> email.
 */
export const sendVerificationEmail = async ({
  email,
  auth0Id
}: Payload): Promise<boolean> => {
  if (!auth0Id && !email) {
    console.error('sendVerificationEmail: missing email and auth0Id')
    return false
  }

  const body = auth0Id ? { auth0_id: auth0Id } : { email }

  try {
    await apiClientOpen.post(verifyEmail, body)
    return true
  } catch (error) {
    console.error('Verification email send failure', error)
    return false
  }
}
