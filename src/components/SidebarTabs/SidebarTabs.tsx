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
import { isPracticeManager } from 'src/utils/helper'

type SidebarTabsProps = {
  menu: any[]
  activeId: string
  onChange: (id: string) => void
  userData?: any
  onboardingCompleted?: boolean
  width?: { xs: string; sm: number | string }
  flex?: { xs: string; sm: string }
  header?: string
  scrollAmount?: number
}

const SidebarTabs: React.FC<SidebarTabsProps> = ({
  menu,
  activeId,
  onChange,
  userData,
  onboardingCompleted = true,
  width = { xs: '100%', sm: 180 },
  flex = { xs: '0 0 auto', sm: '0 0 180px' },
  header,
  scrollAmount = 200
}) => {
  const theme = useTheme()
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'))
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
    if (isMdUp) {
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

    // update on scroll
    const onScroll = () => updateArrows()
    el.addEventListener('scroll', onScroll, { passive: true })

    // update on resize
    const ro = new ResizeObserver(() => updateArrows())
    ro.observe(el)
    // also observe window in case layout changes
    window.addEventListener('resize', updateArrows)

    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      window.removeEventListener('resize', updateArrows)
    }
  }, [isMdUp, menu.length])

  // Programmatic scroll
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
      {header ? (
        <Typography variant='h6' fontWeight={700} sx={{ mb: 1 }}>
          {header}
        </Typography>
      ) : null}

      {showLeft && !isMdUp ? (
        <IconButton
          aria-label='scroll left'
          onClick={() => scrollBy(-scrollAmount)}
          size='small'
          sx={{
            position: 'absolute',
            left: 6,
            top: header ? 36 : 6,
            zIndex: 5,
            bgcolor: 'background.paper',
            boxShadow: 1,
            '&:hover': { boxShadow: 3 }
          }}
        >
          <ChevronLeftIcon />
        </IconButton>
      ) : null}

      {showRight && !isMdUp ? (
        <IconButton
          aria-label='scroll right'
          onClick={() => scrollBy(scrollAmount)}
          size='small'
          sx={{
            position: 'absolute',
            right: 6,
            top: header ? 36 : 6,
            zIndex: 5,
            bgcolor: 'background.paper',
            boxShadow: 1,
            '&:hover': { boxShadow: 3 }
          }}
        >
          <ChevronRightIcon />
        </IconButton>
      ) : null}

      {/* Scroll container (native scroll + swipe on touch) */}
      <Box
        ref={scrollRef}
        sx={{
          // On xs: horizontal row with native scroll
          display: 'flex',
          flexDirection: { xs: 'row', md: 'column' },
          flexWrap: 'nowrap',
          overflowX: { xs: 'auto', md: 'visible' },
          overflowY: { xs: 'hidden', md: 'visible' }, // avoid vertical scroll inside tabs on mobile
          WebkitOverflowScrolling: 'touch',
          // hide native scrollbar visually (optional). Browsers vary — this keeps page static.
          '&::-webkit-scrollbar': {
            height: { xs: '8px', md: '0px' }
          },
          // spacing for scroll arrows so they don't overlap content
          px: { xs: showLeft || showRight ? '36px' : 0, md: 0 }
        }}
        aria-label='Sidebar tabs scroll area'
      >
        <List
          component='nav'
          aria-label='Settings menu'
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            flexWrap: 'nowrap',
            padding: 0,
            // ensure list takes full width on mobile so horizontal scroll works as expected
            width: { xs: 'auto', md: '100%' }
          }}
        >
          {menu.map((m) => {
            const isPracticeTab = m.id === 'practice'

            if (isPracticeTab && isPracticeManager(userData)) {
              return null
            }

            const isDisabled = isPracticeTab && !onboardingCompleted

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
                  // IMPORTANT: prevent shrinking so items keep their width and cause overflow
                  flexShrink: 0,
                  // Inline layout on xs to prevent wrap; column on md for original behavior
                  display: { xs: 'inline-flex', sm: 'flex' },
                  minWidth: { xs: 96, sm: 'auto' },
                  mr: { xs: 1, sm: 0 },
                  mb: { md: 1 }
                }}
              >
                <Typography
                  className='font-weight--700'
                  variant='subtitle2'
                  py={0.2}
                >
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
