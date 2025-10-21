import React from 'react'
import { Box, Tabs } from '@mui/material'
import CenteredTab from './CenteredTab'
import TabPanel from './TabPanel'

export type TabKey = number | string

export type ReusableTabItem = {
  key: TabKey
  label: string
  activeIcon?: string
  inactiveIcon?: string
  content: React.ReactNode
  count?: number
}

interface ReusableTabsProps {
  tabs: ReusableTabItem[]
  initialTab?: TabKey
  variant?: 'scrollable' | 'standard' | 'fullWidth'
  onChange?: (key: TabKey) => void
}

function a11yProps(index: TabKey) {
  return {
    id: `reusable-tab-${String(index)}`,
    'aria-controls': `reusable-tabpanel-${String(index)}`
  }
}

const ReusableTabs: React.FC<ReusableTabsProps> = ({
  tabs,
  initialTab,
  variant = 'scrollable',
  onChange
}) => {
  const [value, setValue] = React.useState<TabKey>(
    initialTab ?? (tabs.length ? tabs[0].key : 0)
  )

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabKey) => {
    setValue(newValue)
    onChange?.(newValue)
  }

  return (
    <Box sx={{ width: '100%', boxSizing: 'border-box', maxWidth: '100%' }}>
      <Tabs
        value={value}
        onChange={handleTabChange as any}
        aria-label='Reusable tabs'
        variant={variant}
        scrollButtons='auto'
        textColor='primary'
        indicatorColor='primary'
        sx={{
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'auto',
          '& .MuiTabs-flexContainer': {
            gap: 1,
            alignItems: 'center'
          },
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { height: 0, display: 'none' }
        }}
        slotProps={{ indicator: { style: { display: 'none' } } }}
      >
        {tabs.map((t) => {
          const showBadge = typeof t.count === 'number' && t.count > 0
          const badgeText =
            typeof t.count === 'number' && t.count > 99 ? '99+' : t.count

          const labelNode = (
            <Box
              component='span'
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                whiteSpace: 'nowrap'
              }}
            >
              <Box component='span' sx={{ lineHeight: 1 }}>
                {t.label}
              </Box>

              {showBadge && (
                <Box
                  component='span'
                  sx={{
                    bgcolor: 'warning.main',
                    color: '#fff',
                    borderRadius: '999px',
                    minWidth: 20,
                    height: 22,
                    px: 0.6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    boxShadow: '0 0 0 2px rgba(0,0,0,0.05)'
                  }}
                  aria-hidden
                >
                  {badgeText}
                </Box>
              )}
            </Box>
          )

          return (
            <CenteredTab
              key={String(t.key)}
              value={t.key}
              // pass the composed label node
              label={labelNode}
              sx={{ minWidth: 'auto', px: { xs: 0.75, sm: 1.5 } }}
              icon={
                t.activeIcon || t.inactiveIcon ? (
                  <img
                    src={
                      value === t.key
                        ? (t.activeIcon ?? t.inactiveIcon)
                        : (t.inactiveIcon ?? t.activeIcon)
                    }
                    alt={`${t.label} icon`}
                  />
                ) : undefined
              }
              iconPosition='start'
              {...a11yProps(t.key)}
            />
          )
        })}
      </Tabs>

      {tabs.map((t) => (
        <TabPanel key={String(t.key)} value={value} index={t.key}>
          {t.content}
        </TabPanel>
      ))}
    </Box>
  )
}

export default ReusableTabs
