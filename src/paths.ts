// src/paths.ts
export const paths = {
  root: '/',
  dashboard: '/dashboard',
  practiceOnboarding: '/practice-onboarding',
  agreements: '/agreements',
  practiceOnboardingStepper: '/practice-onboarding/stepper',
  documents: '/documents',
  expense: '/expense-breakdown',
  reports: '/reports',
  benchmarks: '/benchmarks',
  teamManagement: {
    root: '/team-management',
    specificTeamMember: '/team-management/members/:id',
    gotoSpecificTeamMember: (id: string) => `/team-management/members/${id}`
  },
  practiceSettings: '/practice-settings',
  billing: '/billing',
  settings: '/settings',
  bankIntegrator: '/bank-integrator',
  helpAndSupport: '/help-and-support',
  auth1: {
    login: '/login'
  },
  auth: {
    login: '/auth/login',
    logout: '/auth/logout'
  },
  page404: '/404'
}
