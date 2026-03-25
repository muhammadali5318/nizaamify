import { useState, useCallback } from 'react'
import { useActivePractice } from 'src/hooks/useActivePractice'
import apiClient from 'src/services/api-client'
import { endpoints } from 'src/services/backendUrl'
import {
  fetchAndSaveFile,
  getFileNameFromUrl
} from 'src/utils/downloadFileUtils'

export const useDownloadHistoryDoc = () => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const { activePracticeId } = useActivePractice()

  const download = useCallback(
    async (id: string) => {
      if (!activePracticeId) return

      setDownloadingId(id)

      try {
        const response = await apiClient.get(
          endpoints.bankIntegrator.downloadHistoryDoc(activePracticeId, id)
        )

        const fileUrl = response?.data?.data

        if (!fileUrl) return

        await fetchAndSaveFile(
          fileUrl,
          getFileNameFromUrl(fileUrl) || undefined
        )
      } catch (error) {
        console.error('Download failed:', error)
      } finally {
        setDownloadingId(null)
      }
    },
    [activePracticeId]
  )

  return {
    downloadingId,
    download
  }
}
