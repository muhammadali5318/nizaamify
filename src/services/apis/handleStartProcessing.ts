import { notify } from 'src/components/notistack/NotificationProvider'
import { triggerProcessAPI } from './triggerProcessAPI'
export const uploadFilesToS3 = async (
  items: any[],
  files: any[],
  batchId: string,
  userId: string,
  practiceId: string
) => {
  for (let i = 0; i < items.length; i++) {
    const { url, key, headers, filename } = items[i]
    const file = files.find((f) => f.name === filename)
    if (!file) continue

    try {
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        headers,
        body: file
      })

      if (uploadResponse.ok) {
        notify.success(`${filename} uploaded successfully!`)
        await triggerProcessAPI(batchId, key, filename, userId, practiceId)
      } else {
        notify.error(`Failed to upload ${filename}`)
      }
    } catch (error) {
      console.error('S3 upload error:', error)
      notify.error(`Error uploading ${filename}`)
    }
  }
}
