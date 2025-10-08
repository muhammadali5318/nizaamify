// TeamMembers.tsx
import React, { useState } from 'react'
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText
} from '@mui/material'
import TeamManagementContentWrapper from '../components/TeamManagementContentWrapper'

const ROLE_OPTIONS = [
  'Admin',
  'Manager',
  'Dentist',
  'Hygienist',
  'Reception',
  'Finance'
]

const STATUS_OPTIONS = ['Active', 'Pending', 'Invited', 'Disabled']

const ITEM_HEIGHT = 48
const ITEM_PADDING_TOP = 8
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 260
    }
  }
}

const TeamMembers: React.FC = () => {
  const [search, setSearch] = useState<string>('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])

  return (
    <TeamManagementContentWrapper
      imageSrc='/assets/team-members-list.svg'
      imageAlt='team-members-list'
      title='Team members'
      subtitle='Manage your practice team members and their access'
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          flexWrap: 'wrap',
          mt: 2
        }}
      >
        {/* 1. Search box */}
        <TextField
          label='Search team members'
          variant='outlined'
          size='small'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search by name, email...'
          sx={{ minWidth: 260, flex: '1 1 320px' }}
        />

        {/* 2. Multi-select dropdown (roles) - shows checkboxes in dropdown, plain text when closed */}
        <FormControl sx={{ minWidth: 220, flex: '0 0 260px' }} size='small'>
          <InputLabel id='roles-select-label'>Role</InputLabel>
          <Select
            labelId='roles-select-label'
            multiple
            value={selectedRoles}
            onChange={(e) => {
              const value = e.target.value
              // MUI sometimes returns string when autofill; we ensure string[]
              setSelectedRoles(
                typeof value === 'string' ? value.split(',') : value
              )
            }}
            renderValue={(selected) => (selected as string[]).join(', ')}
            label='Role'
            MenuProps={MenuProps}
          >
            {ROLE_OPTIONS.map((role) => (
              <MenuItem key={role} value={role}>
                <Checkbox checked={selectedRoles.indexOf(role) > -1} />
                <ListItemText primary={role} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 3. Multi-select dropdown (status) - shows checkboxes in dropdown, plain text when closed */}
        <FormControl sx={{ minWidth: 220, flex: '0 0 260px' }} size='small'>
          <InputLabel id='status-select-label'>Status</InputLabel>
          <Select
            labelId='status-select-label'
            multiple
            value={selectedStatuses}
            onChange={(e) => {
              const value = e.target.value
              setSelectedStatuses(
                typeof value === 'string' ? value.split(',') : value
              )
            }}
            renderValue={(selected) => (selected as string[]).join(', ')}
            label='Status'
            MenuProps={MenuProps}
          >
            {STATUS_OPTIONS.map((status) => (
              <MenuItem key={status} value={status}>
                <Checkbox checked={selectedStatuses.indexOf(status) > -1} />
                <ListItemText primary={status} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </TeamManagementContentWrapper>
  )
}

export default TeamMembers
