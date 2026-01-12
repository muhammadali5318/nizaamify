import { Stack } from '@mui/material'
import AuditLogsContent from './components/audit-logs-content'
import styles from './auditLogs.module.scss'
import PageHeader from 'src/components/page-header'

const AuditLogs = () => {
  return (
    <Stack className={styles.auditLogsRoot}>
      <PageHeader
        title='Monai Tech Logs'
        description='Platform activity logs for document processing, financial updates, and user actions.'
        logo='/assets/team-management.svg'
        isDividerVisible={false}
      />
      <AuditLogsContent />
    </Stack>
  )
}

export default AuditLogs
