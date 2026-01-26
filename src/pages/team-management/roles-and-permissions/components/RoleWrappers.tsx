// src/components/role-permissions/RoleWrappers.tsx
import React from 'react'
import RolePermissions from './RolePermissions'

export const OwnerPrincipal: React.FC = () => (
  <RolePermissions roleName='Owner' />
)
export const CompanyDirector: React.FC = () => (
  <RolePermissions roleName='Company Director' />
)
export const PracticeManager: React.FC = () => (
  <RolePermissions roleName='Manager' />
)
export const PracticeViewer: React.FC = () => (
  <RolePermissions roleName='Viewer' />
)
