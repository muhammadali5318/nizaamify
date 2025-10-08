// FILE: components/ReusableTabs/CenteredTab.tsx
import { styled } from '@mui/material/styles'
import { Tab } from '@mui/material'

const CenteredTab = styled(Tab)(() => ({
  textTransform: 'none',
  alignItems: 'center',
  gap: 8,
  minHeight: 42,

  '& .MuiTab-iconWrapper': {
    minWidth: 20,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    verticalAlign: 'middle'
  },

  '&.Mui-selected': {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: '12px',
    border: '1px solid var(--grey-300, #E0E0E0)',
    background: 'var(--grey-200, #EEE)',
    minHeight: 42
  }
}))

export default CenteredTab
