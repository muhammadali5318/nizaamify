// pages/role-and-permissions-config.ts

import {
  OwnerPrincipal,
  CompanyDirector,
  PracticeManager,
  PracticeViewer
} from './components/RoleWrappers'

export const TEAM_ROLES_MENU: any[] = [
  {
    id: 'owner-principal',
    label: 'Owner / Principal',
    title: 'Owner / Principal',
    description: 'Practice Owner / Principal access and permissions',
    component: OwnerPrincipal
  },
  {
    id: 'company-director',
    label: 'Company Director',
    title: 'Company Director',
    description: 'Company Director access and permissions',
    component: CompanyDirector
  },
  {
    id: 'practice-manager',
    label: 'Practice Manager',
    title: 'Practice Manager',
    description: 'Practice Manager access and permissions',
    component: PracticeManager
  },
  {
    id: 'practice-viewer',
    label: 'Practice User',
    title: 'Practice User',
    description: 'Practice User access and permissions',
    component: PracticeViewer
  }
]
