import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { pollBatchStatusUntilComplete } from './pollProcessApi'

export const useResumePolling = () => {
  const jobs = useSelector((state: RootState) => state.pollingJobs.jobs)

  const startedRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    Object.values(jobs).forEach((job) => {
      if (!job) return

      if (startedRef.current[job.batchId]) return

      startedRef.current[job.batchId] = true

      pollBatchStatusUntilComplete(
        job.batchId,
        job.key,
        job.filename,
        job.userId,
        job.practiceId
      ).catch((err: any) => {
        console.error('Auto resume polling job failed:', err)
      })
    })
  }, [jobs])
}
