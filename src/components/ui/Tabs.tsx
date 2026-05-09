import { type ReactNode, useState, type SyntheticEvent } from 'react'
import Box from '@mui/material/Box'
import MuiTabs, { type TabsProps as MuiTabsProps } from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

export type TabKey = string | number

export interface TabItem {
  key: TabKey
  label: ReactNode
  /** Optional content. When present, the tab acts as a controlled section. */
  content?: ReactNode
  /** Optional small numeric/text badge after the label. */
  badge?: ReactNode
  disabled?: boolean
}

export interface TabsProps extends Omit<MuiTabsProps, 'onChange' | 'value'> {
  items: TabItem[]
  /** Controlled active key. If omitted, the component manages its own state. */
  value?: TabKey
  defaultValue?: TabKey
  onChange?: (key: TabKey) => void
}

/**
 * Tabs primitive (spec §6). Active tab uses the theme's brand-700 underline
 * indicator. Renders content of the active item below the tab strip when
 * `items[i].content` is provided.
 */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  ...rest
}: TabsProps) {
  const [internal, setInternal] = useState<TabKey>(
    defaultValue ?? items[0]?.key ?? 0
  )
  const active = value ?? internal

  const handleChange = (_: SyntheticEvent, key: TabKey) => {
    if (value === undefined) setInternal(key)
    onChange?.(key)
  }

  const activeContent = items.find((i) => i.key === active)?.content

  return (
    <Box sx={{ width: '100%' }}>
      <MuiTabs
        value={active}
        onChange={handleChange}
        textColor='primary'
        indicatorColor='primary'
        variant='scrollable'
        allowScrollButtonsMobile
        {...rest}
      >
        {items.map((it) => (
          <Tab
            key={it.key}
            value={it.key}
            disabled={it.disabled}
            label={
              it.badge !== undefined && it.badge !== null ? (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75
                  }}
                >
                  {it.label}
                  <Box
                    component='span'
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 20,
                      height: 20,
                      paddingInline: 0.75,
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--status-brand-bg)',
                      color: 'var(--status-brand-text)',
                      fontSize: '0.6875rem',
                      fontWeight: 600
                    }}
                  >
                    {it.badge}
                  </Box>
                </Box>
              ) : (
                it.label
              )
            }
          />
        ))}
      </MuiTabs>
      {activeContent !== undefined && <Box sx={{ pt: 2 }}>{activeContent}</Box>}
    </Box>
  )
}

export default Tabs
