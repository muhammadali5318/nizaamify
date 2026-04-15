import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import dayjs from 'dayjs'
import { RangeISO } from 'src/components/date-range-selector'

type ExpenseBreakdownState = {
  startDate: string | null
  endDate: string | null
}

const lastMonth = dayjs().subtract(1, 'month')

const initialState: ExpenseBreakdownState = {
  startDate: lastMonth.startOf('month').toISOString(),
  endDate: lastMonth.endOf('month').toISOString()
}

const expenseBreakdownSlice = createSlice({
  name: 'expenseBreakdown',
  initialState,
  reducers: {
    setStartDate(state, action: PayloadAction<string>) {
      state.startDate = action.payload
    },
    setEndDate(state, action: PayloadAction<string>) {
      state.endDate = action.payload
    },
    setDateRange(state, action: PayloadAction<RangeISO>) {
      state.startDate = action.payload.start
      state.endDate = action.payload.end
    }
  }
})

export const { setStartDate, setEndDate, setDateRange } =
  expenseBreakdownSlice.actions

export default expenseBreakdownSlice.reducer

export const selectExpenseBreakdownDateRange = (state: {
  expenseBreakdown: ExpenseBreakdownState
}): RangeISO => ({
  start: state.expenseBreakdown.startDate,
  end: state.expenseBreakdown.endDate
})

export const selectStartDate = (state: {
  expenseBreakdown: ExpenseBreakdownState
}) => state.expenseBreakdown.startDate

export const selectEndDate = (state: {
  expenseBreakdown: ExpenseBreakdownState
}) => state.expenseBreakdown.endDate
