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
        // make tabs container scrollable & hide native scrollbar visually
        sx={{
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'auto',
          // keep the flex container tight so tabs wrap/scroll correctly
          '& .MuiTabs-flexContainer': {
            gap: 1,
            alignItems: 'center'
          },
          // hide scrollbar (still scrollable)
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': {
            height: 0,
            display: 'none'
          }
        }}
        slotProps={{
          indicator: {
            style: { display: 'none' }
          }
        }}
      >
        {tabs.map((t) => (
          <CenteredTab
            key={String(t.key)}
            value={t.key}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {t.label}

                {t.count ? (
                  <Box
                    sx={{
                      display: 'flex',
                      width: '22px',
                      height: '22px',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: '33px',
                      border: '0.917px solid var(--warning-main, #EF6C00)',
                      background: 'var(--warning-main, #EF6C00)',
                      color: 'var(--warning-contrast, #FFF)',
                      fontFamily: 'Roboto',
                      fontSize: '11px',
                      fontWeight: 700,
                      lineHeight: '166%', // 18.26px
                      letterSpacing: '0.367px'
                    }}
                  >
                    {t.count}
                  </Box>
                ) : null}
              </Box>
            }
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
        ))}
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
