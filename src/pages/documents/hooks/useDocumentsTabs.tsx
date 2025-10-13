import React from 'react'
import { ReusableTabItem } from 'src/components/tabs/ReusableTabs'
import { documentsTabsData } from '../config/documentsConfig'
import UploadedDocuments from '../tabs/UploadDocuments'
import PendingDocuments from '../tabs/PendingDocuments'
import { UploadHistory } from '../tabs/UploadHistory'
export default function useDocumentsTabs(): ReusableTabItem[] {
  return React.useMemo(() => {
    return documentsTabsData.map((t) => {
      let content: React.ReactNode = null

      switch (t.key) {
        case 0:
          content = <UploadedDocuments />
          break
        case 1:
          content = <PendingDocuments />
          break
        case 2:
          content = <UploadHistory />
          break
        default:
          content = null
      }

      return {
        key: t.key,
        label: t.label,
        activeIcon: t.activeIcon,
        inactiveIcon: t.inactiveIcon,
        content
      }
    })
  }, [])
}
