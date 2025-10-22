import React, { useState } from 'react'
import {
  Box,
  Button,
  Popover,
  Stack,
  TextField,
  InputAdornment
} from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { PickersDay, PickersDayProps } from '@mui/x-date-pickers/PickersDay'
import dayjs, { Dayjs } from 'dayjs'
import InsertInvitationIcon from '@mui/icons-material/InsertInvitation'

export type RangeISO = { start: string | null; end: string | null }

type Props = {
  value: RangeISO
  onChange: (next: RangeISO) => void
  label?: string
  minDate?: string | null
  maxDate?: string | null
}

const toDayjs = (s?: string | null): Dayjs | null => (s ? dayjs(s) : null)
const toISO = (d: Dayjs | null): string | null => (d ? d.toISOString() : null)

const DateRangeSelector: React.FC<Props> = ({
  value,
  onChange,
  label = 'MM/DD/YYYY',
  minDate = null,
  maxDate = null
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [tempStart, setTempStart] = useState<Dayjs | null>(toDayjs(value.start))
  const [tempEnd, setTempEnd] = useState<Dayjs | null>(toDayjs(value.end))

  const minDayjs = toDayjs(minDate)
  const maxDayjs = toDayjs(maxDate)

  const open = Boolean(anchorEl)
  const id = open ? 'date-range-popover' : undefined

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
    // revert temporary values if canceled
    setTempStart(toDayjs(value.start))
    setTempEnd(toDayjs(value.end))
  }

  const handleSave = () => {
    onChange({ start: toISO(tempStart), end: toISO(tempEnd) })
    setAnchorEl(null)
  }

  const handleSelect = (date: Dayjs | null) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(date)
      setTempEnd(null)
    } else if (tempStart && !tempEnd) {
      if (date && date.isBefore(tempStart)) {
        setTempEnd(tempStart)
        setTempStart(date)
      } else {
        setTempEnd(date)
      }
    }
  }

  const formattedLabel =
    value.start && value.end
      ? `${dayjs(value.start).format('DD MMM YYYY')} - ${dayjs(
          value.end
        ).format('DD MMM YYYY')}`
      : ''

  const isInRange = (d: Dayjs) =>
    tempStart &&
    tempEnd &&
    d.isAfter(tempStart, 'day') &&
    d.isBefore(tempEnd, 'day')

  // Custom day slot to highlight range
  const CustomDay = (props: PickersDayProps) => {
    const { day, outsideCurrentMonth, ...other } = props

    const isSelectedStart = !!tempStart && tempStart.isSame(day, 'day')
    const isSelectedEnd = !!tempEnd && tempEnd.isSame(day, 'day')
    const inRange = isInRange(day)

    return (
      <PickersDay
        {...other}
        day={day}
        outsideCurrentMonth={outsideCurrentMonth}
        selected={isSelectedStart || isSelectedEnd}
        sx={(theme) => {
          const grey = theme.palette.action.hover
          const primary = theme.palette.primary.main
          const contrast = theme.palette.primary.contrastText

          return {
            margin: 0,
            borderRadius: 0,
            position: 'relative',
            transition: 'all 0.2s ease',
            overflow: 'visible',

            ...(inRange && {
              backgroundColor: grey,
              color: theme.palette.text.primary
            }),

            // ✅ Start date
            ...(isSelectedStart && {
              backgroundColor: primary,
              color: contrast,
              borderRadius: '50%',
              zIndex: 2,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: '100%',
                backgroundColor: grey,
                zIndex: -1
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '50%',
                right: '0%',
                backgroundColor: grey,
                zIndex: -2
              }
            }),

            // ✅ End date
            ...(isSelectedEnd && {
              backgroundColor: primary,
              color: contrast,
              borderRadius: '50%',
              zIndex: 2,
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: '50%',
                left: 0,
                backgroundColor: grey,
                zIndex: -1
              },
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: '100%',
                left: 0,
                backgroundColor: grey,
                zIndex: -2
              }
            })
          }
        }}
      />
    )
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <TextField
          label={label}
          value={formattedLabel}
          onClick={handleOpen}
          fullWidth
          slotProps={{
            input: {
              readOnly: true,
              endAdornment: (
                <InputAdornment position='start'>
                  <InsertInvitationIcon fontSize='small' color='action' />
                </InputAdornment>
              )
            }
          }}
        />

        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box>
            <DateCalendar
              value={tempEnd || tempStart}
              onChange={handleSelect}
              minDate={minDayjs ?? undefined}
              maxDate={maxDayjs ?? undefined}
              slots={{ day: CustomDay }}
            />

            <Stack
              direction='row'
              spacing={1}
              justifyContent='flex-end'
              p={'0px 20px 24px 0px'}
            >
              <Button size='small' variant='text' onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size='small'
                variant='contained'
                onClick={handleSave}
                disabled={!tempStart || !tempEnd}
              >
                Ok
              </Button>
            </Stack>
          </Box>
        </Popover>
      </Box>
    </LocalizationProvider>
  )
}

export default DateRangeSelector
