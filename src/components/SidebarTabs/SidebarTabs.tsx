// components/SidebarTabs/SidebarTabs.tsx
import React, { useEffect, useRef, useState } from 'react'
import {
  Box,
  List,
  ListItemButton,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

type SidebarTabItem = {
  id: string
  label: string
  disabled?: boolean
}

type SidebarTabsProps = {
  menu: SidebarTabItem[]
  activeId: string
  onChange: (id: string) => void
  width?: { xs: string; sm: number | string }
  flex?: { xs: string; sm: string }
  header?: string
  scrollAmount?: number
}

const SidebarTabs: React.FC<SidebarTabsProps> = ({
  menu,
  activeId,
  onChange,
  width = { xs: '100%', sm: 180 },
  flex = { xs: '0 0 auto', sm: '0 0 180px' },
  header,
  scrollAmount = 200
}) => {
  const theme = useTheme()
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'))
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)

  const updateArrows = () => {
    const el = scrollRef.current
    if (!el) {
      setShowLeft(false)
      setShowRight(false)
      return
    }

    if (isSmUp) {
      setShowLeft(false)
      setShowRight(false)
      return
    }

    const { scrollWidth, clientWidth, scrollLeft } = el
    const hasOverflow = scrollWidth > clientWidth + 1

    setShowLeft(hasOverflow && scrollLeft > 5)
    setShowRight(hasOverflow && scrollLeft + clientWidth < scrollWidth - 5)
  }

  useEffect(() => {
    updateArrows()
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => updateArrows()
    el.addEventListener('scroll', onScroll, { passive: true })

    const ro = new ResizeObserver(() => updateArrows())
    ro.observe(el)

    window.addEventListener('resize', updateArrows)

    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.removeEventListener('resize', updateArrows)
    }
  }, [isSmUp, menu.length])

  const scrollBy = (amount: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: amount, top: 0, behavior: 'smooth' })
    setTimeout(updateArrows, 250)
  }

  return (
    <Box
      sx={{
        width,
        flex,
        position: 'relative'
      }}
    >
      {header && (
        <Typography variant='h6' fontWeight={700} sx={{ mb: 1 }}>
          {header}
        </Typography>
      )}

      {showLeft && !isSmUp && (
        <IconButton
          aria-label='scroll left'
          onClick={() => scrollBy(-scrollAmount)}
          size='small'
          sx={{
            position: 'absolute',
            left: 6,
            top: header ? 42 : 6,
            zIndex: 5,
            bgcolor: 'background.paper',
            boxShadow: 1,
            '&:hover': { boxShadow: 3 }
          }}
        >
          <ChevronLeftIcon />
        </IconButton>
      )}

      {showRight && !isSmUp && (
        <IconButton
          aria-label='scroll right'
          onClick={() => scrollBy(scrollAmount)}
          size='small'
          sx={{
            position: 'absolute',
            right: 6,
            top: header ? 42 : 6,
            zIndex: 5,
            bgcolor: 'background.paper',
            boxShadow: 1,
            '&:hover': { boxShadow: 3 }
          }}
        >
          <ChevronRightIcon />
        </IconButton>
      )}

      <Box
        ref={scrollRef}
        sx={{
          display: 'flex',
          flexDirection: { xs: 'row', sm: 'column' },
          flexWrap: 'nowrap',
          overflowX: { xs: 'auto', sm: 'visible' },
          overflowY: { xs: 'hidden', sm: 'visible' },
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': {
            height: { xs: '8px', sm: '0px' }
          }
        }}
        aria-label='Sidebar tabs scroll area'
      >
        <List
          component='nav'
          aria-label='Settings menu'
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', sm: 'column' },
            flexWrap: 'nowrap',
            padding: 0,
            width: { xs: 0, sm: '100%' }
          }}
        >
          {menu.map((m) => {
            const isDisabled = Boolean(m.disabled)

            return (
              <ListItemButton
                key={m.id}
                selected={m.id === activeId}
                onClick={() => !isDisabled && onChange(m.id)}
                aria-selected={m.id === activeId}
                disabled={isDisabled}
                sx={{
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                    color: 'black'
                  },
                  color: isDisabled
                    ? 'text.disabled'
                    : 'var(--color-primary-light)',
                  textTransform: 'none',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  flexShrink: 0,
                  display: { xs: 'inline-flex', sm: 'flex' },
                  minWidth: { xs: 96, sm: 'auto' },
                  mr: { xs: 1, sm: 0 },
                  mb: { sm: 1 }
                }}
              >
                <Typography variant='subtitle2' fontWeight={700} py={0.2}>
                  {m.label}
                </Typography>
              </ListItemButton>
            )
          })}
        </List>
      </Box>
    </Box>
  )
}

export default SidebarTabs
