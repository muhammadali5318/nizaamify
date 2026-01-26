// FILE: components/ReusableTabs/TabPanel.tsx
import React from 'react'
import { Box } from '@mui/material'

interface TabPanelProps {
  value: React.Key | number | string
  index: React.Key | number | string
  children?: React.ReactNode
}

const TabPanel: React.FC<TabPanelProps> = ({ value, index, children }) => {
  return (
    <div
      role='tabpanel'
      hidden={value !== index}
      id={`reusable-tabpanel-${String(index)}`}
      aria-labelledby={`reusable-tab-${String(index)}`}
    >
      {value === index && <Box sx={{ mt: 2 }}>{children}</Box>}
    </div>
  )
}

export default TabPanel
