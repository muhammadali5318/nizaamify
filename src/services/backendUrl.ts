export const API_BASE = 'user-workstation/v1'
export const API_BASE_DOCUMENTS = 'docs/v1'
export const API_BASE_CHATBOT = 'chatbot/v1'
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
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/reconsent/confirm/`,
    unverifiedTransations: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/unverified-transactions/`,
    documentStatus: (practiceId: string, documentId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/documents/${documentId}/status/`,
    reconcileTransactions: (practiceId: string, transactionId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/unverified-transactions/${transactionId}/reconcile/`,
    uncategorisedTransactions: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/uncategorised-transactions/`,
    revenueTransactions: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/uncategorised-revenue-transactions/`,
    revenueTransactionsCategorise: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/uncategorised-revenue-transactions/categorise/`,
    categorisedTransactions: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/categorised-transactions/`,
    uploadCategorisedTransactionsInvoice: (
      practiceId: string,
      transactionId: string
    ) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/categorised-transactions/${transactionId}/invoices/upload/`,
    uncategorisedTransactionsUpdate: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/uncategorised-transactions/categorise/`,
    transactionsHistory: (practiceId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/transaction-documents/`,
    downloadHistoryDoc: (practiceId: string, docId: string) =>
      `${API_BASE_BANK_INTEGRATOR}/practices/${practiceId}/transaction-documents/${docId}/download/`
  },
  chatBot: {
    chat: (practiceId: string) =>
      `${API_BASE_CHATBOT}/practices/${practiceId}/chat/`,
    recentChats: (practiceId: string) =>
      `${API_BASE_CHATBOT}/practices/${practiceId}/chat-sessions/`,
    chatsHistory: (practiceId: string, conversationId: string) =>
      `${API_BASE_CHATBOT}/practices/${practiceId}/chat-history/${conversationId}/`
  },
  audit: {
    appAuditLogs: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/audit-logs/`,
    appAuditLogsCategories: (practiceId: string) =>
      `${API_BASE}/practices/${practiceId}/event-features/`
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
  dashboardStatsForManager: (id: string) =>
    `${API_BASE_DOCUMENTS}/practices/${id}/dashboard-document-counts/`,
  currentPractice: (id: string) => `${API_BASE}/practices/${id}/`,
  listAllPractices: (userId: string) =>
    `${API_BASE}/users/${userId}/practices/`,
  practiceProfile: (id: string) => `${API_BASE}/practices/${id}/profile/`,
  archivePractice: (userId: string, practiceId: string) =>
    `${API_BASE}/users/${userId}/practices/${practiceId}/archive/`,
  unarchivePractice: (userId: string, practiceId: string) =>
    `${API_BASE}/users/${userId}/practices/${practiceId}/unarchive/`,
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
  resetMFA: (userId: string) => `${API_BASE}/users/${userId}/mfa/reset/`,
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
    nonPLBreakDown: (practiceId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${practiceId}/non-pl-expense-breakdown/`,
    expenseBreakdownDocuments: (practiceId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${practiceId}/expense-breakdown-documents/`,
    expenseBreakdownManualDocuments: (practiceId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${practiceId}/expense-breakdown-manual-entries/`,
    expenseBreakdownAggregatorDocuments: (practiceId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${practiceId}/expense-breakdown-aggregator-entries/`,
    benchmarkConfiguration: (practiceId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${practiceId}/benchmarking-configurations/`,
    deleteDocument: (id: string, documentId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${id}/document/${documentId}/`,
    documentStatus: (id: string, documentId: string) =>
      `/${API_BASE_DOCUMENTS}/practices/${id}/document-status/${documentId}/`,
    dashboardAiSummary: (id: string) =>
      `${API_BASE_DOCUMENTS}/practices/${id}/dashboard/ai-summary/`
  },
  accountingBasis: {
    sendOtp: (orgId: string) => `${API_BASE}/practices/${orgId}/otp/send/`,
    exportPracticeData: (orgId: string) =>
      `${API_BASE}/practices/${orgId}/export/`,
    exportPracticeDataHistory: (orgId: string) =>
      `${API_BASE}/practices/${orgId}/export/history/`,
    exportPracticeDataStatus: (orgId: string, exportId: string) =>
      `${API_BASE}/practices/${orgId}/export/${exportId}/status`,
    verifyOtp: (orgId: string) => `${API_BASE}/practices/${orgId}/otp/verify/`,
    verifyIdentity: (orgId: string) =>
      `${API_BASE}/practices/${orgId}/identity/verify/`
  }
}
