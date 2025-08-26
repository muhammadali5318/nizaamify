import { Link, Outlet } from 'react-router'

export default function AppLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar / Navigation */}
      <aside style={{ width: '200px', background: '#f5f5f5', padding: '1rem' }}>
        <nav
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <Link to='/dashboard'>Dashboard</Link>
          <Link to='/reports'>Reports</Link>
          <Link to='/sales'>Sales</Link>
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '1rem' }}>
        <Outlet /> {/* <-- Nested routes render here */}
      </main>
    </div>
  )
}
