import { Link, Outlet } from 'react-router'
import { useAuth0 } from '@auth0/auth0-react'

export default function AppLayout() {
  const { logout } = useAuth0()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar / Navigation */}
      <aside style={{ width: '200px', background: '#f5f5f5', padding: '1rem' }}>
        <nav
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          <Link to='/dashboard'>Dashboard</Link>
          <Link to='/reports'>Reports</Link>
          <Link to='/profile'>Sales</Link>

          {/* Logout button */}
          <button
            style={{
              marginTop: '1rem',
              padding: '0.5rem',
              border: 'none',
              background: '#e63946',
              color: 'white',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
            onClick={() =>
              logout({
                logoutParams: { returnTo: window.location.origin }
              })
            }
          >
            Logout
          </button>
        </nav>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: '1rem' }}>
        <Outlet /> {/* <-- Nested routes render here */}
      </main>
    </div>
  )
}
