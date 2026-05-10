import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { Link as RouterLink, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useNavSections } from 'src/layouts/navConfig'

export interface SidebarProps {
  /** Pixel width — also drives AppBar/main offset on desktop. */
  width: number
  /** True = mobile (temporary drawer), false = desktop (permanent). */
  isMobile: boolean
  /** Mobile drawer open/close state. */
  open: boolean
  onClose: () => void
}

/**
 * Side navigation (spec §5.1). 240px wide on desktop, slide-over drawer on
 * mobile. Active route gets bg-status-brand-bg + a 3px brand-700 leading
 * accent bar (logical property — RTL-safe). Section headers use the
 * overline typography variant for the small uppercase look.
 */
export function Sidebar({ width, isMobile, open, onClose }: SidebarProps) {
  const { t } = useTranslation('common')
  const location = useLocation()
  const sections = useNavSections()

  const content = (
    <Box
      sx={{ width, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <Stack
        direction='row'
        spacing={1}
        alignItems='center'
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <StorefrontIcon sx={{ color: 'var(--text-brand)' }} />
        <Typography
          variant='h3'
          sx={{ color: 'var(--text-primary)', fontWeight: 700 }}
        >
          {t('app_name')}
        </Typography>
      </Stack>

      <Box sx={{ p: 1.5, flex: 1, overflowY: 'auto' }}>
        {sections.map((section, sectionIdx) => (
          <Box key={section.title} sx={{ mt: sectionIdx === 0 ? 0 : 2 }}>
            <Typography
              variant='overline'
              sx={{
                display: 'block',
                px: 1.5,
                pb: 0.5,
                color: 'var(--text-muted)'
              }}
            >
              {section.title}
            </Typography>
            <List dense disablePadding>
              {section.items.map((item) => {
                const active = location.pathname.startsWith(item.to)
                const Icon = item.icon
                return (
                  <ListItem key={item.to} disablePadding>
                    <ListItemButton
                      component={RouterLink}
                      to={item.to}
                      onClick={isMobile ? onClose : undefined}
                      sx={{
                        // Pill-shaped active state, matches screenshots —
                        // softer than the leading bar approach.
                        borderRadius: 'var(--radius-md)',
                        my: 0.25,
                        paddingInline: 1.25,
                        backgroundColor: active
                          ? 'var(--status-brand-bg)'
                          : 'transparent',
                        color: active
                          ? 'var(--text-brand)'
                          : 'var(--text-secondary)',
                        transition:
                          'background-color var(--duration-fast) var(--ease-out)',
                        '&:hover': {
                          backgroundColor: active
                            ? 'var(--status-brand-bg)'
                            : 'var(--surface-muted)'
                        }
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 36,
                          // text-brand flips with mode (brand-700 light /
                          // brand-400 dark) so the active icon stays legible
                          // on the amber-tinted pill in either theme.
                          color: active ? 'var(--text-brand)' : 'inherit'
                        }}
                      >
                        <Icon fontSize='small' />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: active ? 600 : 500
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
            {sectionIdx === 0 && sections.length > 1 && (
              <Divider sx={{ mt: 1.5, borderColor: 'var(--border-subtle)' }} />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )

  if (isMobile) {
    return (
      <Drawer
        variant='temporary'
        open={open}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        slotProps={{ paper: { sx: { width } } }}
      >
        {content}
      </Drawer>
    )
  }

  return (
    <Drawer
      variant='permanent'
      open
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          borderInlineEnd: '1px solid var(--border-default)'
        }
      }}
    >
      {content}
    </Drawer>
  )
}

export default Sidebar
