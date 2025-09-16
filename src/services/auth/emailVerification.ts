import { apiClientOpen } from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'

const { verifyEmail } = endpoints.signup

export const sendVerificationEmail = async (email: string) => {
  try {
    await apiClientOpen.post(verifyEmail, { email })
    return true
  } catch (error) {
    console.error('Verification email send failure', error)
    return false
  }
}
