import { SignupFormDataSet } from './types'

export const steps = [
  { heading: 'User Information', subHeading: 'Basic user details' },
  { heading: 'Practice Information', subHeading: 'Basic practice details' },
  { heading: 'Password Setup', subHeading: 'Password details' }
]

export const generatePayloadForSignUp = (form: SignupFormDataSet) => {
  return {
    user: {
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      contact_number: form.phone,
      password: form.password,
      confirm_password: form.confirmPassword,
      role: form.role,
      is_company_director_or_owner: form.isPracticeOwnerOrDirector
    },
    practice: {
      practice_name: form.practiceName,
      // join address fields into a single string (adjust as backend expects)
      address: [form.street, form.city, form.country]
        .filter(Boolean)
        .join(', '),
      postcode: form.postcode,
      email: form.practiceEmail
    },
    user_consents: {
      is_terms_of_service_accepted: form.terms,
      is_privacy_policy_accepted: form.privacy,
      is_financial_disclaimer_acknowledged: form.disclaimer,
      is_gdpr_consent_given: form.gdpr
    }
  }
}
