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
  signup: {
    createUser: `user-workstation/${apiVersion}/users/signup/`,
    verifyEmail: `user-workstation/${apiVersion}/users/verify-email/`
  },
  userInvitation: (id: string) => `${API_BASE}/practices/${id}/invite/`,
  currentPractice: (id: string) => `${API_BASE}/practices/${id}/`,
  practiceProfile: (id: string) => `${API_BASE}/practices/${id}/profile/`,
  inviteUser: (id: string) => `${API_BASE}/invited-users/${id}/`,
  userWithActivePractices: (id: string) => `${API_BASE}/users/${id}/`,
  userProfile: (id: string) => `${API_BASE}/users/${id}/profile/`,
  teamMembersList: (id: string) => `${API_BASE}/practices/${id}/users/`,
  nominateExistingManager: (orgId: string, userId: string) =>
    `${API_BASE}/practices/${orgId}/users/${userId}/nominate/`
}
