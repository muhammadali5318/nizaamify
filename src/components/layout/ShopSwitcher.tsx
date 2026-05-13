// v2.9.1 Phase D.2 — TopBar shop switcher.
//
// Visible behavior per [[2026-05-13-rbac-set-active-shop-fallback-path]] + B.3:
//   - 0 shops (loading or no access)   → render nothing
//   - 1 shop  (pilot phase)            → render shop name as informational label
//   - 2+ shops                         → render dropdown; select switches active shop
//
// On switch: useSetActiveShop invalidates the entire query cache (cached
// reads are scoped to the previous shop) and the caller redirects to
// /dashboard (the resource the user was viewing may not exist in the new shop).

import { useState, useRef } from 'react'
import {
  Box,
  Button as MuiButton,
  CircularProgress,
  Divider,
  ListItemIcon,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Typography
} from '@mui/material'
import StoreOutlinedIcon from '@mui/icons-material/StoreOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckIcon from '@mui/icons-material/Check'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  useActiveShop,
  useSetActiveShop,
  useUserShopList
} from 'src/features/team/hooks'
import { paths } from 'src/paths'

export function ShopSwitcher() {
  const { t } = useTranslation('shop_switcher')
  const navigate = useNavigate()
  const { data: shops, isLoading: shopsLoading } = useUserShopList()
  const { data: activeShop, isLoading: activeLoading } = useActiveShop()
  const setActiveShop = useSetActiveShop()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement | null>(null)

  // Hidden states: loading, no active shop, or no shop list
  if (shopsLoading || activeLoading) {
    return (
      <Stack direction='row' alignItems='center' gap={0.75} sx={{ ml: 1 }}>
        <CircularProgress size={14} sx={{ color: 'inherit' }} />
        <Typography variant='caption' sx={{ opacity: 0.7 }}>
          {t('loading')}
        </Typography>
      </Stack>
    )
  }
  if (!activeShop) return null

  const hasMultiple = (shops?.length ?? 0) >= 2

  const handleSelect = async (shopId: string) => {
    setOpen(false)
    if (shopId === activeShop.shop_id) return
    try {
      await setActiveShop.mutateAsync(shopId)
      navigate(paths.dashboard, { replace: true })
    } catch {
      // Error handling lands via the central error map in the calling page;
      // the menu just closes. The mutation isn't retryable here.
    }
  }

  // ---- Single-shop variant: read-only label ---------------------------------
  if (!hasMultiple) {
    return (
      <Stack
        direction='row'
        alignItems='center'
        gap={0.75}
        sx={{
          color: 'inherit',
          paddingInline: 1.25,
          paddingBlock: 0.5,
          borderRadius: 'var(--radius-sm)',
          maxWidth: { xs: 160, md: 'none' }
        }}
        aria-label={t('active_shop_label')}
      >
        <StoreOutlinedIcon
          fontSize='small'
          sx={{ color: 'var(--text-brand)', opacity: 0.85 }}
        />
        <Typography
          variant='body2'
          sx={{
            fontWeight: 600,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {activeShop.shop_name}
        </Typography>
      </Stack>
    )
  }

  // ---- Multi-shop variant: dropdown -----------------------------------------
  return (
    <Box>
      <MuiButton
        ref={anchorRef}
        onClick={() => setOpen((v) => !v)}
        startIcon={
          <StoreOutlinedIcon
            fontSize='small'
            sx={{ color: 'var(--text-brand)' }}
          />
        }
        endIcon={<ExpandMoreIcon fontSize='small' />}
        aria-haspopup='menu'
        aria-expanded={open}
        aria-label={t('switch_shop')}
        sx={{
          color: 'inherit',
          textTransform: 'none',
          fontWeight: 600,
          paddingInline: 1.25,
          paddingBlock: 0.5,
          minHeight: 36,
          borderRadius: 'var(--radius-md)',
          maxWidth: { xs: 180, md: 240 },
          '& .MuiButton-startIcon': { marginInlineEnd: 0.5 },
          '& .MuiButton-endIcon': { marginInlineStart: 0.5 },
          '&:hover': {
            backgroundColor:
              'color-mix(in srgb, var(--text-primary) 6%, transparent)'
          }
        }}
      >
        <Typography
          variant='body2'
          component='span'
          sx={{
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {activeShop.shop_name}
        </Typography>
      </MuiButton>
      <Menu
        open={open}
        onClose={() => setOpen(false)}
        anchorEl={anchorRef.current}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { minWidth: 240, mt: 0.5 }
          }
        }}
        MenuListProps={{
          'aria-label': t('switch_shop'),
          dense: false
        }}
      >
        <ListSubheader
          disableSticky
          sx={{
            lineHeight: '2rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}
        >
          {t('menu_header')}
        </ListSubheader>
        <Divider sx={{ borderColor: 'var(--border-subtle)' }} />
        {(shops ?? []).map((shop) => {
          const isActive = shop.shop_id === activeShop.shop_id
          const roleLabel = shop.is_owner
            ? t('owner_badge')
            : shop.preset_applied === 'manager'
              ? t('manager_badge')
              : shop.preset_applied === 'salesperson'
                ? t('salesperson_badge')
                : null
          return (
            <MenuItem
              key={shop.shop_id}
              selected={isActive}
              disabled={setActiveShop.isPending}
              onClick={() => void handleSelect(shop.shop_id)}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                {isActive ? (
                  <CheckIcon
                    fontSize='small'
                    sx={{ color: 'var(--text-brand)' }}
                  />
                ) : (
                  <Box sx={{ width: 20 }} />
                )}
              </ListItemIcon>
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant='body2'
                  sx={{
                    fontWeight: isActive ? 600 : 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {shop.shop_name}
                </Typography>
                {roleLabel && (
                  <Typography
                    variant='caption'
                    sx={{ color: 'var(--text-secondary)' }}
                  >
                    {roleLabel}
                  </Typography>
                )}
              </Stack>
            </MenuItem>
          )
        })}
      </Menu>
    </Box>
  )
}
