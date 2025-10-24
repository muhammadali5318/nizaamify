/* eslint-disable no-console */
import { useMemo } from 'react'
import { GridColDef, GridCellParams } from '@mui/x-data-grid'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { StatusChip, ImgIcon } from '../components/TeamMembers'
import { toTitleCase } from 'src/utils/stringUtils'
import { FEATURE_RULE_IDS } from 'src/constants/feature-rules'
import { useFeatureRule } from 'src/hooks/useFeatureRule'
import RemoveRedEyeOutlinedIcon from '@mui/icons-material/RemoveRedEyeOutlined'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { TeamMemberRow } from '..'
import { useAuth0 } from '@auth0/auth0-react'

type Handlers = {
  onView?: (
    id: string,
    name: string,
    email: string,
    role: string,
    isNominated: boolean
  ) => void
  onInvite?: (id: string) => void
  onUpdateMember?: (member: TeamMemberRow) => void
  onNominate?: (id: any) => void
}

export const useTeamMembersColumns = (handlers: Handlers = {}) => {
  const { onView, onInvite, onUpdateMember, onNominate } = handlers
  const { isEnabled: onboardingCompleted } = useFeatureRule(
    FEATURE_RULE_IDS.ONBOARDING_COMPLETED
  )
  const { user } = useAuth0()

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: 'member',
        headerName: 'Members',
        minWidth: 250,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Typography variant='body2'>{params?.row?.user_name}</Typography>
              <Typography variant='body2' sx={{ lineHeight: 1 }}>
                {params?.row?.email}
              </Typography>
            </Box>
          </Box>
        )
      },
      {
        field: 'user_role',
        headerName: 'Role',
        minWidth: 140,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => (
          <Typography variant='body2'>
            {toTitleCase(params?.row?.user_role)}
          </Typography>
        )
      },
      {
        field: 'user_practice_status',
        headerName: 'Status',
        minWidth: 130,
        flex: 1,
        sortable: true,
        renderCell: (params: GridCellParams) => {
          return <StatusChip status={params?.row?.user_practice_status} />
        }
      },
      {
        field: 'actions',
        headerName: 'Actions',
        minWidth: 170,
        flex: 1,
        sortable: false,
        renderCell: (params: GridCellParams) => (
          <Box
            sx={{
              display: 'flex',
              gap: 0.6,
              justifyContent: 'flex-start',
              width: '100%',
              alignItems: 'center'
            }}
          >
            <Tooltip placement='top' title='Manage member permissions'>
              <Box
                component='span'
                sx={{
                  display: 'inline-flex',
                  verticalAlign: 'middle'
                }}
              >
                <IconButton
                  size='small'
                  aria-label='view member'
                  disabled={params?.row?.user_practice_status === 'INVITED'}
                  onClick={() =>
                    onView
                      ? onView(
                          params?.row?.user_id,
                          params?.row?.user_name,
                          params?.row?.email,
                          params?.row?.user_role,
                          params?.row?.is_nominated
                        )
                      : console.log('view', params.row.id)
                  }
                >
                  <RemoveRedEyeOutlinedIcon fontSize='small' />
                </IconButton>
              </Box>
            </Tooltip>

            <Tooltip placement='top' title='Deactivate user'>
              <IconButton
                size='small'
                onClick={() =>
                  onInvite
                    ? onInvite(String(params.row.id))
                    : console.log('invite', params.row.id)
                }
                aria-label='invite member'
              >
                <ImgIcon src='/assets/person-add.svg' alt='invite' />
              </IconButton>
            </Tooltip>

            <Tooltip placement='top' title='Update member role'>
              <Box
                component='span'
                sx={{
                  display: 'inline-flex',
                  verticalAlign: 'middle'
                }}
              >
                <IconButton
                  size='small'
                  disabled={
                    params?.row?.user_practice_status !== 'ACTIVE' ||
                    params?.row?.email === user?.email
                  }
                  onClick={() =>
                    onUpdateMember
                      ? onUpdateMember(params.row)
                      : console.log('swap', params.row.id)
                  }
                  aria-label='Update member role'
                >
                  <SwapHorizIcon fontSize='small' />
                </IconButton>
              </Box>
            </Tooltip>

            {!onboardingCompleted &&
              params.row.user_role === 'PRACTICE MANAGER' &&
              params.row.user_practice_status === 'ACTIVE' && (
                <Tooltip
                  placement='top'
                  title={
                    params?.row?.is_nominated
                      ? 'Already nominated'
                      : 'Nominate to complete onboarding'
                  }
                >
                  <IconButton
                    size='small'
                    aria-label='Nomination flag'
                    onClick={() => {
                      if (!params?.row?.is_nominated) {
                        onNominate?.(params.row)
                      } else {
                        console.log('nominate', params.row.id)
                      }
                    }}
                  >
                    <ImgIcon
                      src={
                        params?.row?.is_nominated
                          ? '/assets/green-flag.svg'
                          : '/assets/blue-flag.svg'
                      }
                      alt='flag icon'
                    />
                  </IconButton>
                </Tooltip>
              )}
          </Box>
        )
      }
    ],
    [onView, onInvite, onUpdateMember, onNominate]
  )

  return columns
}

export type { GridColDef } from '@mui/x-data-grid'
