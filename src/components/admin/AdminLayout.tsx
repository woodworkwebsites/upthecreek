import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { useEffect } from 'react';

const navItems = [
  { path: '/admin/orders',   label: 'Orders'   },
  { path: '/admin/products', label: 'Products' },
  { path: '/admin/logs',     label: 'Logs'     },
];

export default function AdminLayout() {
  const { token, clearToken } = useAdminToken();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) navigate('/admin/login', { replace: true });
  }, [token, navigate]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                UTC Admin
              </span>
              <nav className="flex gap-1">
                {navItems.map(({ path, label }) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                      }`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <NavLink
                to="/"
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ← Store
              </NavLink>
              <button
                onClick={clearToken}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
