// Toast styling — token-driven per spec §6 / §11.
// Uses the v1.7 status-* token pairs so toasts visually align with badges
// and banners. notistack's MaterialDesignContent is a styled card we
// override with our semantic backgrounds.

import { styled } from '@mui/material/styles'
import { MaterialDesignContent } from 'notistack'

const StyledMaterialDesignContent = styled(MaterialDesignContent)(() => ({
  '&&': {
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    fontWeight: 500,
    boxShadow: 'var(--shadow-lg)',
    fontSize: '0.9375rem'
  },

  '& .MuiPaper-root': {
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    fontWeight: 500
  },

  '& .notistack-MuiContent-message': {
    fontWeight: 500
  },

  '&.notistack-MuiContent-success': {
    backgroundColor: 'var(--success-600)',
    color: 'var(--neutral-0)'
  },

  '&.notistack-MuiContent-error': {
    backgroundColor: 'var(--error-600)',
    color: 'var(--neutral-0)'
  },

  '&.notistack-MuiContent-warning': {
    backgroundColor: 'var(--warning-600)',
    color: 'var(--neutral-900)'
  },

  '&.notistack-MuiContent-info': {
    backgroundColor: 'var(--info-600)',
    color: 'var(--neutral-0)'
  },

  '&.notistack-MuiContent-default': {
    backgroundColor: 'var(--neutral-900)',
    color: 'var(--neutral-0)'
  }
}))

export default StyledMaterialDesignContent
