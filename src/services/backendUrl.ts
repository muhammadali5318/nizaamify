const apiVersion = 'v1'

// Base API
export const API_BASE = 'user-workstation/v1'

export const endpoints = {
  practiceOnboarding: {
    stepOne: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/1/`,
    stepTwo: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/2/`,
    stepThree: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/3/`,
    stepFour: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/4/`
  },
  userInvitation: (id: string) => `${API_BASE}/practices/${id}/invite/`,
  currentPractice: (id: string) => `${API_BASE}/practices/${id}/`,
  userInfo: apiVersion,
  inviteUser: (id: string) => `user-workstation/v1/invited-users/${id}/`,
  signup: {
    createUser: `user-workstation/${apiVersion}/users/signup/`,
    verifyEmail: `user-workstation/${apiVersion}/users/verify-email/`
  }
}
