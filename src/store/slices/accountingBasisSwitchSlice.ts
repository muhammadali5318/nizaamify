import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { RootState } from '../store'

export type AccountingBasisExportData = {
  id: string
  practice_id: string
  s3_key: string
  status: string
  file_generated: number
  total_records: number
  start_date: string | null
  end_date: string | null
}

type AccountingBasisSwitchState = {
  exportData: AccountingBasisExportData | null
  exportDataId: string | null
  statusUrl: string | null
}

const initialState: AccountingBasisSwitchState = {
  exportData: null,
  exportDataId: null,
  statusUrl: null
}

const accountingBasisSwitchSlice = createSlice({
  name: 'accountingBasisSwitch',
  initialState,
  reducers: {
    setAccountingBasisSwitchExportMeta: (
      state,
      action: PayloadAction<{ export_data_id: string; status_url: string }>
    ) => {
      state.exportDataId = action.payload.export_data_id
      state.statusUrl = action.payload.status_url
    },

    setAccountingBasisSwitchExportData: (
      state,
      action: PayloadAction<AccountingBasisExportData>
    ) => {
      state.exportData = action.payload
    },

    clearAccountingBasisSwitchData: () => initialState
  }
})

export const {
  setAccountingBasisSwitchExportMeta,
  setAccountingBasisSwitchExportData,
  clearAccountingBasisSwitchData
} = accountingBasisSwitchSlice.actions

export const selectAccountingBasisSwitchExportData = (state: RootState) =>
  state.accountingBasisSwitch.exportData

export const selectAccountingBasisSwitchStatusUrl = (state: RootState) =>
  state.accountingBasisSwitch.statusUrl

export const selectAccountingBasisSwitchExportDataId = (state: RootState) =>
  state.accountingBasisSwitch.exportDataId

export default accountingBasisSwitchSlice.reducer
