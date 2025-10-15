import CompanyDirector from './components/CompanyDirector'
import OwnerPrincipal from './components/OwnerPrincipal'
import PracticeManager from './components/PracticeManager'
import PracticeViewer from './components/PracticeViewer'
import { SuperAdmin } from './components/SuperAdmin'

export const TEAM_ROLES_MENU: any[] = [
  {
    id: 'super-admin',
    label: 'Super Admin (Monai)',
    title: 'Super Admin (Monai)',
    description: 'Super admin access and permissions',
    component: SuperAdmin
  },
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
    label: 'Practice Viewer',
    title: 'Practice Viewer',
    description: 'Practice Viewer access and permissions',
    component: PracticeViewer
  }
]
