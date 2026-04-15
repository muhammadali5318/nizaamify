import React, { useMemo, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  Typography
} from '@mui/material'
import { useSelector } from 'react-redux'
import { useAuth } from 'src/context/AuthProvider'
import { selectExpenseBreakdownDateRange } from 'src/store/slices/expenseBreakdownSlice'
import { useFetchExpenseBreakdown } from './hooks/useFetchExpenseBreakdown'

const COLORS = {
  revenue: '#0288D1',
  expense: '#EF6C00',
  profit: '#4CAF50',
  grid: '#E6EAF0',
  axis: '#6B7280',
  text: '#111827',
  muted: '#6B7280',
  bg: '#FFFFFF',
  hover: '#F9FAFB'
}

const VIEWBOX = {
  width: 1000,
  height: 460
}

const MARGINS = {
  top: 28,
  right: 24,
  bottom: 60,
  left: 64
}

type ExpenseCategory = {
  parent_category: string
  share_of_total_percent: string
  amount: string
  water_fall_chart_data: string
}

type ExpenseBreakdownResponse = {
  label: string
  total: string
  operating_profit: string
  total_revenue: string
  final_profit?: string
  revenue_cateogories?: Array<{
    revenue_type: string
    amount: string
  }>
  categories?: ExpenseCategory[]
}

type WaterfallBar = {
  label: string
  kind: 'revenue' | 'expense' | 'profit'
  amount: number
  start: number
  end: number
  color: string
  x: number
  y: number
  width: number
  height: number
  centerX: number
  displayAmount: string
  tooltipX: number
  tooltipY: number
}

const toNumber = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const formatAmount = (value: number) =>
  new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)

const WaterfallChart = () => {
  const dateRange = useSelector(selectExpenseBreakdownDateRange)
  const hasValidDate = Boolean(dateRange?.start) && Boolean(dateRange?.end)
  const { accessToken } = useAuth()

  const { data, isPending } = useFetchExpenseBreakdown({
    enabled: !!accessToken && hasValidDate,
    startDate: dateRange.start,
    endDate: dateRange.end
  })

  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const chartData = useMemo(() => {
    const response = (data ?? {}) as ExpenseBreakdownResponse

    const revenue = toNumber(response.total_revenue)
    const operatingProfit = toNumber(
      response.final_profit ?? response.operating_profit
    )

    const categories = (response.categories ?? []).map((item) => ({
      label: item.parent_category,
      amount: toNumber(item.amount)
    }))

    const barsBase: Array<{
      label: string
      kind: 'revenue' | 'expense' | 'profit'
      amount: number
      start: number
      end: number
      color: string
    }> = [
      {
        label: 'Total Revenue',
        kind: 'revenue',
        amount: revenue,
        start: 0,
        end: revenue,
        color: COLORS.revenue
      },
      ...categories.map((item) => ({
        label: item.label,
        kind: 'expense' as const,
        amount: item.amount,
        start: 0,
        end: 0,
        color: COLORS.expense
      })),
      {
        label: 'Operating Profit',
        kind: 'profit',
        amount: operatingProfit,
        start: 0,
        end: operatingProfit,
        color: COLORS.profit
      }
    ]

    let runningTotal = revenue

    const barsWithPositions = barsBase.map((bar) => {
      if (bar.kind === 'revenue') {
        return {
          ...bar,
          start: 0,
          end: revenue
        }
      }

      if (bar.kind === 'profit') {
        return {
          ...bar,
          start: 0,
          end: operatingProfit
        }
      }

      const start = runningTotal
      const end = runningTotal - bar.amount
      runningTotal = end

      return {
        ...bar,
        start,
        end
      }
    })

    const maxValue = Math.max(
      revenue,
      operatingProfit,
      ...barsWithPositions.map((bar) => Math.max(bar.start, bar.end))
    )

    const innerWidth = VIEWBOX.width - MARGINS.left - MARGINS.right
    const innerHeight = VIEWBOX.height - MARGINS.top - MARGINS.bottom
    const gap = 14
    const barCount = barsWithPositions.length
    const barWidth = (innerWidth - gap * (barCount - 1)) / barCount

    const scaleY = (value: number) => {
      if (maxValue <= 0) return MARGINS.top + innerHeight
      return (
        MARGINS.top +
        innerHeight -
        (Math.max(0, value) / maxValue) * innerHeight
      )
    }

    const bars: WaterfallBar[] = barsWithPositions.map((bar, index) => {
      const x = MARGINS.left + index * (barWidth + gap)
      const high = Math.max(bar.start, bar.end)
      const low = Math.min(bar.start, bar.end)
      const yTop = scaleY(high)
      const yBottom = scaleY(low)

      const height =
        bar.kind === 'expense'
          ? Math.max(6, yBottom - yTop)
          : Math.max(1, yBottom - yTop)

      const centerX = x + barWidth / 2

      return {
        ...bar,
        x,
        y: yTop,
        width: barWidth,
        height,
        centerX,
        displayAmount:
          bar.kind === 'expense'
            ? `-${formatAmount(bar.amount)}`
            : formatAmount(bar.amount),
        tooltipX: Math.min(96, Math.max(4, (centerX / VIEWBOX.width) * 100)),
        tooltipY: Math.min(92, Math.max(10, (yTop / VIEWBOX.height) * 100))
      }
    })

    const ticks = Array.from({ length: 5 }, (_, i) => {
      const value = (maxValue / 4) * (4 - i)
      return {
        value,
        y: scaleY(value)
      }
    })

    return {
      bars,
      ticks,
      revenue,
      operatingProfit,
      expenseTotal: categories.reduce((sum, item) => sum + item.amount, 0),
      label: response.label ?? '',
      maxValue
    }
  }, [data])

  const activeBar = activeIndex !== null ? chartData.bars[activeIndex] : null

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: '20px',
        border: '1px solid var(--grey-100, #F5F5F5)',
        overflow: 'hidden',
        px: 2.5
      }}
    >
      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent='space-between'
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={1}
          >
            <Box>
              <Typography variant='h6' fontWeight={600} color={COLORS.text}>
                Expense trends
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            useFlexGap
            flexWrap='wrap'
          >
            <StatChip
              label='Total Revenue'
              value={chartData.revenue}
              color={COLORS.revenue}
            />
            <StatChip
              label='Total Expense'
              value={chartData.expenseTotal}
              color={COLORS.expense}
            />
            <StatChip
              label='Operating Profit'
              value={chartData.operatingProfit}
              color={COLORS.profit}
            />
          </Stack>

          <Divider sx={{ padding: '8px' }} />

          {isPending ? (
            <Box
              sx={{
                minHeight: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ position: 'relative' }}>
              <Box
                sx={{
                  width: '100%',
                  aspectRatio: '2.2 / 1',
                  minHeight: 330,
                  position: 'relative'
                }}
              >
                <svg
                  viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
                  width='100%'
                  height='100%'
                  role='img'
                  aria-label='Waterfall chart'
                  style={{ display: 'block', overflow: 'visible' }}
                >
                  {chartData.ticks.map((tick, index) => (
                    <g key={index}>
                      <line
                        x1={MARGINS.left}
                        x2={VIEWBOX.width - MARGINS.right}
                        y1={tick.y}
                        y2={tick.y}
                        stroke={COLORS.grid}
                        strokeWidth={1}
                      />
                      <text
                        x={MARGINS.left - 12}
                        y={tick.y + 5}
                        textAnchor='end'
                        fontSize='12'
                        fill={COLORS.axis}
                      >
                        {formatAmount(tick.value)}
                      </text>
                    </g>
                  ))}

                  {chartData.bars.map((bar, index) => {
                    const prevBar = chartData.bars[index - 1]
                    const connectorY =
                      index > 0 ? Math.max(prevBar?.end ?? 0, bar.start) : null

                    return (
                      <g key={`${bar.label}-${index}`}>
                        {index > 0 && connectorY !== null && (
                          <line
                            x1={prevBar!.x + prevBar!.width}
                            x2={bar.x}
                            y1={
                              MARGINS.top +
                              (chartData.maxValue > 0
                                ? (1 - connectorY / chartData.maxValue) *
                                  (VIEWBOX.height -
                                    MARGINS.top -
                                    MARGINS.bottom)
                                : 0)
                            }
                            y2={
                              MARGINS.top +
                              (chartData.maxValue > 0
                                ? (1 - connectorY / chartData.maxValue) *
                                  (VIEWBOX.height -
                                    MARGINS.top -
                                    MARGINS.bottom)
                                : 0)
                            }
                            stroke={COLORS.grid}
                            strokeWidth={2}
                            strokeDasharray='4 4'
                          />
                        )}

                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={bar.width}
                          height={bar.height}
                          rx={6}
                          ry={6}
                          fill={bar.color}
                          opacity={activeIndex === index ? 0.88 : 1}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => setActiveIndex(index)}
                          onMouseLeave={() => setActiveIndex(null)}
                        />

                        <text
                          x={bar.centerX}
                          y={Math.max(18, bar.y - 10)}
                          textAnchor='middle'
                          fontSize='12'
                          fontWeight={700}
                          fill={COLORS.text}
                          pointerEvents='none'
                        >
                          {bar.displayAmount}
                        </text>

                        <text
                          x={bar.centerX}
                          y={VIEWBOX.height - 28}
                          textAnchor='middle'
                          fontSize='12'
                          fontWeight={700}
                          fill={COLORS.text}
                          pointerEvents='none'
                        >
                          {bar.label}
                        </text>
                      </g>
                    )
                  })}
                </svg>

                {activeBar && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${activeBar.tooltipX}%`,
                      top: `${activeBar.tooltipY}%`,
                      transform: 'translate(-50%, -112%)',
                      minWidth: 180,
                      maxWidth: 240,
                      p: 1.25,
                      borderRadius: 2,
                      backgroundColor: '#111827',
                      color: '#fff',
                      boxShadow: '0 16px 32px rgba(0,0,0,0.18)',
                      pointerEvents: 'none',
                      zIndex: 2
                    }}
                  >
                    <Typography variant='subtitle2' fontWeight={700}>
                      {activeBar.label}
                    </Typography>
                    <Typography variant='body2' sx={{ opacity: 0.92 }}>
                      Amount: {activeBar.displayAmount}
                    </Typography>
                    <Typography variant='body2' sx={{ opacity: 0.92 }}>
                      Start: {formatAmount(activeBar.start)}
                    </Typography>
                    <Typography variant='body2' sx={{ opacity: 0.92 }}>
                      End: {formatAmount(activeBar.end)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  )
}

type StatChipProps = {
  label: string
  value: number
  color: string
}

const StatChip: React.FC<StatChipProps> = ({ label, value, color }) => {
  return (
    <Box
      sx={{
        flex: '1 1 180px',
        minWidth: 180,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: '#fff'
      }}
    >
      <Stack direction='row' spacing={1.25} alignItems='center'>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: color,
            flexShrink: 0
          }}
        />
        <Typography variant='body2' color={COLORS.muted} fontWeight={600}>
          {label}
        </Typography>
      </Stack>
      <Typography
        variant='h6'
        fontWeight={800}
        sx={{ mt: 0.75, color: COLORS.text, lineHeight: 1.15 }}
      >
        {formatAmount(value)}
      </Typography>
    </Box>
  )
}

export default WaterfallChart
