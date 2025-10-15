import PermissionsContainer from 'src/components/permission-container/PermissionsContainer'

const permissionsList = [
  {
    path: '/assets/roles-dashboard.svg',
    title: 'Dashboards & insights'
  },
  { path: '/assets/roles-bench-marking.svg', title: 'Benchmarking' },
  { path: '/assets/roles-subscription.svg', title: 'Subscription & billings' },
  { path: '/assets/roles-payments.svg', title: 'Payments' },
  { path: '/assets/roles-audiance.svg', title: 'Data access & management' },
  { path: '/assets/roles-settings.svg', title: 'User & account management' },
  { path: '/assets/roles-audiance.svg', title: 'Legal & compliance' },
  { path: '/assets/roles-question-mark.svg', title: 'Feedback & support' },
  { path: '/assets/spark.svg', title: 'AI assistant' },
  { path: '/assets/roles-audiance.svg', title: 'Audit logs' }
]

export const SuperAdmin = () => {
  return (
    <>
      {permissionsList.map((item, index) => (
        <PermissionsContainer key={index} item={item} />
      ))}
    </>
  )
}
