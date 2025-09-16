// File: src/components/notistack/StyledMaterialDesignContent.tsx
import { styled } from '@mui/material/styles'
import { MaterialDesignContent } from 'notistack'

const StyledMaterialDesignContent = styled(MaterialDesignContent)(() => ({
  '&&': {
    borderRadius: '16px',
    overflow: 'hidden',
    fontWeight: 500,
    opacity: 1
  },

  '& .MuiPaper-root': {
    borderRadius: '16px',
    overflow: 'hidden',
    fontWeight: 500,
    opacity: 1
  },

  '& .notistack-MuiContent-message': {
    fontWeight: 500,
    opacity: 1
  },

  '&.notistack-MuiContent-success': {
    backgroundColor: '#2E7D32',
    color: '#fff'
  }
}))

export default StyledMaterialDesignContent
