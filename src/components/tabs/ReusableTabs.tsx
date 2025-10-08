// FILE: components/ReusableTabs/ReusableTabs.tsx
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
    <Box sx={{ width: '100%' }}>
      <Tabs
        value={value}
        onChange={handleTabChange as any}
        aria-label='Reusable tabs'
        variant={variant}
        scrollButtons='auto'
        textColor='primary'
        indicatorColor='primary'
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
            label={t.label}
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
