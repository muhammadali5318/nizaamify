import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface PollingJob {
  batchId: string
  key: string
  filename: string
  userId: string
  practiceId: string
  startedAt: number
}

interface PollingJobsState {
  jobs: Record<string, PollingJob>
}

const initialState: PollingJobsState = {
  jobs: {}
}

const pollingJobsSlice = createSlice({
  name: 'pollingJobsBankStatement',
  initialState,
  reducers: {
    addPollingJob: (state, action: PayloadAction<PollingJob>) => {
      state.jobs[action.payload.batchId] = action.payload
    },
    removePollingJob: (state, action: PayloadAction<string>) => {
      delete state.jobs[action.payload]
    }
  }
})

export const { addPollingJob, removePollingJob } = pollingJobsSlice.actions
export default pollingJobsSlice.reducer
