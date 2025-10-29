import React from 'react'
import { ReusableTabItem } from 'src/components/tabs/ReusableTabs'
import { documentsTabsData } from '../config/documentsConfig'
import UploadedDocuments from '../tabs/UploadDocuments'
import FinancialDocumentsList from '../tabs/FinancialDocumentsList'
import useFetchUploadedDocsList from './useFetchUploadedDocsList'

export default function useDocumentsTabs(): ReusableTabItem[] {
  // Call hook once here
  const { total } = useFetchUploadedDocsList({
    requires_review: true
  })

  return React.useMemo(() => {
    return documentsTabsData.map((t) => {
      let content: React.ReactNode = null
      let count: number | undefined = t.count

      switch (t.key) {
        case 0:
          content = <UploadedDocuments />
          break

        case 1:
          // Pending Documents Tab → Use total from hook
          count = total
          content = (
            <FinancialDocumentsList
              title='Pending documents'
              description='Search, filter, and manage your uploaded documents'
              icon='/assets/document-upload-card-icon.svg'
              isPendingDocments={true}
            />
          )
          break

        case 2:
          content = (
            <FinancialDocumentsList
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
        count, // replace count here
        content
      }
    })
  }, [total]) // important: re-run when total changes
}
