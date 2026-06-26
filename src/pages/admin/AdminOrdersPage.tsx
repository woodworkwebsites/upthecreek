import { useState, useEffect, useCallback } from 'react';
import type { Order } from '../../../types/index.js';
import { adminFetchOrders } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatDate, formatPrice } from '../../lib/utils.js';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending:              'default',
  paid:                 'info',
  fulfillment_started:  'warning',
  fulfilled:            'success',
  failed:               'error',
};

const modeVariant: Record<string, 'default' | 'warning' | 'info'> = {
  dry_run: 'warning',
  draft:   'info',
  live:    'default',
};

function OrderRow({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="py-3 pr-4 pl-4 sm:pl-6">
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
            {order.stripeSessionId.slice(0, 24)}…
          </span>
        </td>
        <td className="px-3 py-3">
          <span className="text-sm text-gray-900 dark:text-gray-100">
            {order.customerEmail}
          </span>
        </td>
        <td className="px-3 py-3 text-sm text-gray-900 dark:text-gray-100">
          {formatPrice(order.amountTotal)}
        </td>
        <td className="px-3 py-3">
          <Badge variant={statusVariant[order.status] ?? 'default'}>
            {order.status.replace(/_/g, ' ')}
          </Badge>
        </td>
        <td className="px-3 py-3">
          <Badge variant={modeVariant[order.printifyMode] ?? 'default'}>
            {order.printifyMode.replace(/_/g, ' ')}
          </Badge>
        </td>
        <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
          {order.printifyOrderId ?? '—'}
        </td>
        <td className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500">
          {formatDate(order.createdAt)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-900/50">
          <td colSpan={7} className="px-4 py-4 sm:px-6">
            {order.error && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Error</p>
                <p className="mt-1 text-xs text-red-600 dark:text-red-300 font-mono">{order.error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {order.printifyPayload !== null && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Printify Payload
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-green-400 dark:bg-black">
                    {JSON.stringify(order.printifyPayload, null, 2)}
                  </pre>
                </div>
              )}
              {order.printifyResponse !== null && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Printify Response
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-blue-400 dark:bg-black">
                    {JSON.stringify(order.printifyResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminOrdersPage() {
  const { token } = useAdminToken();
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchOrders(token);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Orders</h1>
        <button
          onClick={load}
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400">No orders yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  {['Session', 'Customer', 'Amount', 'Status', 'Mode', 'Printify ID', 'Created'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider first:pl-6"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
                {orders.map((order) => (
                  <OrderRow key={order.id} order={order} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
