import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAdminToken } from '../../hooks/useAdmin.js';
import AdminLoginPage from '../../pages/admin/AdminLoginPage.js';
import { adminFetchOrders } from '../../lib/api.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Order } from '../../../types/index.js';

const navItems = [
  { path: '/admin/products', label: 'Products' },
  { path: '/admin/ranges', label: 'Ranges' },
  { path: '/admin/orders',   label: 'Orders'   },
  { path: '/admin/partners', label: 'Partners' },
  { path: '/admin/stock-orders', label: 'Stock Orders' },
  { path: '/admin/discount-codes', label: 'Discount Codes' },
  { path: '/admin/catalog',  label: 'Catalog'  },
  { path: '/admin/logs',     label: 'Logs'     },
  { path: '/admin/settings', label: 'Settings' },
];

const LAST_SEEN_KEY = 'up-the-creek-admin-last-seen-orders-at';

export default function AdminLayout() {
  const { token, clearToken } = useAdminToken();
  const navigate = useNavigate();
  const location = useLocation();
  const [unseenCount, setUnseenCount] = useState(0);
  const [latestOrders, setLatestOrders] = useState<Order[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const seenAtRef = useRef<number>(Number(window.localStorage.getItem(LAST_SEEN_KEY) ?? '0') || 0);

  const isOrdersPage = location.pathname === '/admin/orders';

  const markSeen = useCallback((orders: Order[]) => {
    if (orders.length === 0) return;
    const latestAt = Math.max(...orders.map((order) => Date.parse(order.createdAt) || 0));
    if (!Number.isFinite(latestAt) || latestAt <= 0) return;

    seenAtRef.current = latestAt;
    window.localStorage.setItem(LAST_SEEN_KEY, String(latestAt));
    setUnseenCount(0);
  }, []);

  const refreshOrderAlert = useCallback(async () => {
    if (!token) return;
    try {
      const orders = await adminFetchOrders(token);
      setLatestOrders(orders);

      if (orders.length === 0) {
        setUnseenCount(0);
        return;
      }

      const newestAt = Math.max(...orders.map((order) => Date.parse(order.createdAt) || 0));
      if (!Number.isFinite(newestAt) || newestAt <= 0) {
        setUnseenCount(0);
        return;
      }

      if (isOrdersPage) {
        markSeen(orders);
        return;
      }

      const unseen = orders.filter((order) => (Date.parse(order.createdAt) || 0) > seenAtRef.current).length;
      setUnseenCount(unseen);
    } catch {
      // Ignore alert polling failures; the Orders page already has its own error handling.
    }
  }, [isOrdersPage, markSeen, token]);

  useEffect(() => {
    if (!token) return;
    void refreshOrderAlert();
    const interval = window.setInterval(() => {
      void refreshOrderAlert();
    }, 20000);
    return () => window.clearInterval(interval);
  }, [refreshOrderAlert, token]);

  useEffect(() => {
    if (!token) return;
    if (isOrdersPage) {
      void refreshOrderAlert();
    }
  }, [isOrdersPage, refreshOrderAlert, token]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!token) return <AdminLoginPage />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {unseenCount > 0 && !isOrdersPage && (
        <div className="fixed left-4 right-4 top-4 z-50 mx-auto w-auto max-w-md rounded-2xl border border-red-200 bg-white px-4 py-3 shadow-2xl shadow-gray-900/10 ring-1 ring-black/5 dark:border-red-900/40 dark:bg-gray-900 md:left-auto md:right-4 md:w-[min(24rem,calc(100vw-2rem))]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {unseenCount === 1 ? 'New order received' : `${unseenCount} new orders received`}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Open Orders to review the latest checkout.
              </p>
            </div>
            <NavLink
              to="/admin/orders"
              className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 transition-colors"
            >
              View orders
            </NavLink>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/96 backdrop-blur dark:border-gray-800 dark:bg-gray-900/96">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-3 md:flex-row md:items-center md:justify-between md:h-14 md:gap-6 md:py-0">
            <div className="flex items-center justify-between gap-3 md:justify-start md:gap-6">
              <span className="text-sm font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                UTC Admin
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((current) => !current)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 md:hidden"
                aria-expanded={mobileMenuOpen}
                aria-controls="admin-navigation"
              >
                Sections
              </button>
            </div>

            <nav
              id="admin-navigation"
              className={`${
                mobileMenuOpen ? 'flex' : 'hidden'
              } flex-col gap-1 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl shadow-gray-900/5 dark:border-gray-800 dark:bg-gray-900 md:flex md:flex-row md:flex-wrap md:gap-1 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
            >
                {navItems.map(({ path, label }) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 text-sm font-medium transition-colors md:inline-flex md:py-1.5 ${
                        isActive
                          ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                      }`
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      {label}
                      {path === '/admin/orders' && unseenCount > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                          {unseenCount}
                        </span>
                      )}
                    </span>
                  </NavLink>
                ))}
            </nav>

            <div className="flex items-center gap-3 md:shrink-0">
              <NavLink
                to="/"
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ← Store
              </NavLink>
              <button
                onClick={clearToken}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-3 py-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
