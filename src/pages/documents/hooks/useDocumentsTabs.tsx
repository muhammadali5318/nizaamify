import React from 'react'
import { ReusableTabItem } from 'src/components/tabs/ReusableTabs'
import { documentsTabsData } from '../config/documentsConfig'
import UploadedDocuments from '../tabs/UploadDocuments'
import PendingDocuments from '../tabs/PendingDocuments'
export default function useDocumentsTabs(): ReusableTabItem[] {
  return React.useMemo(() => {
    return documentsTabsData.map((t) => {
      let content: React.ReactNode = null

      switch (t.key) {
        case 0:
          content = <UploadedDocuments />
          break
        case 1:
          content = (
            <PendingDocuments
              title='Pending documents'
              description='Search, filter, and manage your uploaded documents'
              icon='/assets/document-upload-card-icon.svg'
              isPendingDocments={true}
            />
          )
          break
        case 2:
          content = (
            <PendingDocuments
              title='Upload history'
              description='Search, filter, and manage your uploaded documents'
              icon='/assets/history-Icon-blue.svg'
              isPendingDocments={false}
            />
          )
          break
        default:
          content = null
      }

      return {
        key: t.key,
        label: t.label,
        activeIcon: t.activeIcon,
        inactiveIcon: t.inactiveIcon,
        count: t.count,
        content
      }
    })
  }, [])
}
