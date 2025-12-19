export const API_BASE = 'user-workstation/v1'
export const API_BASE_DOCUMENTS = 'docs/v1'
export const API_BASE_BANK_INTEGRATOR = 'banking/v1'

export const endpoints = {
  practiceOnboarding: {
    stepOne: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/1/`,
    stepTwo: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/2/`,
    stepThree: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/3/`,
    stepFour: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/4/`,
    stepFive: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/onboarding/steps/5/`
  },
  bankIntegrator: {
    list: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/institutions/`,
    connectionUrl: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/connect/start/`,
    finalzieConnection: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/connect/finalise/`,
    connectionHealth: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/connection/health/`,
    revokeConnection: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/revoke/`,
    connectionDetails: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/connection/`,
    accountsDetails: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/accounts/`,
    reconsentConfirm: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/reconsent/confirm/`
  },
  signup: {
    requestPracticeAssociation: `${API_BASE}/users/signup/access-requests/`,
    createUser: `${API_BASE}/users/signup/`,
    verifyEmail: `${API_BASE}/users/verify-email/`
  },
  subscription: {
    checkoutUrl: `${API_BASE}/users/signup/subscription/`
  },
  userInvitation: (id: string) => `${API_BASE}/practices/${id}/invite/`,
  currentPractice: (id: string) => `${API_BASE}/practices/${id}/`,
  listAllPractices: (userId: string) =>
    `${API_BASE}/users/${userId}/practices/`,
  practiceProfile: (id: string) => `${API_BASE}/practices/${id}/profile/`,
  inviteUser: (id: string) => `${API_BASE}/invited-users/${id}/`,
  userWithActivePractices: (id: string) => `${API_BASE}/users/${id}/`,
  userProfile: (id: string) => `${API_BASE}/users/${id}/profile/`,
  teamMembersList: (id: string) => `${API_BASE}/practices/${id}/users/`,
  accessRequestUserDetails: (id: string | null) =>
    `${API_BASE}/practices/access-requests/users/${id}/`,
  resendInvite: (id: string) => `${API_BASE}/practices/${id}/resend-invite/`,
  practiceRolesAndPermission: (id: string) =>
    `${API_BASE}/practices/${id}/roles/permissions/`,
  userRolesAndPermission: (orgId: string, userId: string | undefined) =>
    `${API_BASE}/practices/${orgId}/users/${userId}/permissions/`,
  nominateExistingManager: (orgId: string, userId: string) =>
    `${API_BASE}/practices/${orgId}/users/${userId}/nominate/`,
  updateMemberRole: (orgId: string, userId: string | undefined) =>
    `${API_BASE}/practices/${orgId}/users/${userId}/role/`,
  deactivateTeamMember: (orgId: string, userId: string | undefined) =>
    `${API_BASE}/practices/${orgId}/users/${userId}/deactivate/`,
  approveOrRejectTeamMember: (orgId: string, userId: string | undefined) =>
    `${API_BASE}/practices/${orgId}/users/${userId}/requests/status/`,
  documents: {
    uploadedDocumentList: (id: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${id}/documents/`,
    downloaduploadedDocument: (id: string, documentId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${id}/documents/${documentId}/download/`,
    uploadedByFilterList: (id: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${id}/documents/filters/`,
    updateDocumentDate: (id: string, documentId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${id}/documents/${documentId}/post-date/`,
    expenseBreakdown: (practiceId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${practiceId}/expense-breakdown-detail/`,
    expenseBreakdownDocuments: (practiceId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${practiceId}/expense-breakdown-documents/`
  }
}
