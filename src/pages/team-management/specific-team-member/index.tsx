import React, { useState } from 'react'
import { Box, CircularProgress, Divider, Stack } from '@mui/material'
import { useParams } from 'react-router'
import { useAuth0 } from '@auth0/auth0-react'

import SidebarContentWrapper from 'src/components/SidebarTabs/SidebarContentWrapper'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'
import MemberRoleAndPermissionsList from './components/MemberRoleAndPermissionsList'
import PermissionsEditActions from './components/PermissionsEditActions'

import styles from './MemberRolesAndPermission.module.scss'
import {
  useMemberRolesAndPermissions,
  PermissionObject
} from './hook/useMemberRolesAndPermissions'
import { getUserOrgUuid } from 'src/utils/getActivePracticeId'
import { notify } from 'src/components/notistack/NotificationProvider'
import PageBreadcrumbs from 'src/components/bread-crumbs/PageBreadcrumbs'
import {
  PermissionChangedMinimal,
  buildChangedList,
  updateUserPermission,
  hasPermissionChanges,
  specificMembersBreadCrumbs
} from './permissionsUtils'
import MemberInfoHeader from './components/MemberInfoHeader'

const MemberRolesAndPermission: React.FC = () => {
  const { id } = useParams<{
    id: string
  }>()

  const { user } = useAuth0()
  const orgUuid = user ? getUserOrgUuid(user) : null

  // Query data for selected member
  const { data, refetch, isPending } = useMemberRolesAndPermissions(true, id)

  // Local UI state
  const [isEditing, setIsEditing] = useState(false)
  const [updatedPermissions, setUpdatedPermissions] = useState<
    Record<string, PermissionObject[]>
  >({})

  const role = data?.roles?.[0]
  const rolePermissions = role?.permissions || {}
  const roleId = role?.id
  const permissionGroups = Object.keys(rolePermissions)

  const handleEdit = () => setIsEditing(true)
  const handleCancel = () => {
    setIsEditing(false)
    setUpdatedPermissions({})
  }

  const handlePermissionChange = (
    groupKey: string,
    updatedList: PermissionObject[]
  ) => {
    setUpdatedPermissions((prev) => ({
      ...prev,
      [groupKey]: updatedList
    }))
  }

  const handleSave = async (): Promise<void> => {
    if (!orgUuid || !id) {
      notify.error('Missing organisation or user id')
      return
    }

    const changed: PermissionChangedMinimal[] = buildChangedList(
      updatedPermissions,
      rolePermissions
    )

    if (changed.length === 0) {
      notify.info('No permission changes detected')
      return
    }

    await updateUserPermission(orgUuid, id, roleId, changed, refetch)
    setIsEditing(false)
    setUpdatedPermissions({})
  }

  const canSave = hasPermissionChanges(updatedPermissions, rolePermissions)

  return (
    <Box className={styles.membersPageRoot}>
      <PageBreadcrumbs items={specificMembersBreadCrumbs} />

      <MemberInfoHeader />

      <TeamManagementContentWrapper
        imageSrc='/assets/team-members-list.svg'
        imageAlt='team-members-list'
        title='Team members'
        subtitle='Manage your practice team members and their access'
        showInviteTeamMember={false}
      >
        <Box className={styles.contentArea}>
          <Divider
            sx={{
              borderColor: 'var(--grey-200)',
              margin: '0px 0px 16px 0px'
            }}
          />

          {isPending ? (
            <Box
              className='center-align-width--100'
              sx={{
                height: '150px'
              }}
            >
              <CircularProgress size={22} />
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 2.5
                }}
              >
                <SidebarContentWrapper
                  title={role?.name ?? '—'}
                  description={role?.description ?? ''}
                  logo='/assets/profile.svg'
                  isDividerVisible={false}
                />

                <PermissionsEditActions
                  isEditing={isEditing}
                  onEdit={handleEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  canSave={canSave}
                />
              </Box>

              <Stack spacing={2.5}>
                <MemberRoleAndPermissionsList
                  data={data}
                  isEditing={isEditing}
                  onPermissionChange={handlePermissionChange}
                  permissionGroups={permissionGroups}
                />
              </Stack>
            </>
          )}
        </Box>
      </TeamManagementContentWrapper>
    </Box>
  )
}

export default MemberRolesAndPermission
