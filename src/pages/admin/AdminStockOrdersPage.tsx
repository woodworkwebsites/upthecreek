import { useCallback, useEffect, useState } from 'react';
import type { PartnerStockOrderAdminSummary, PartnerStockOrderStatus } from '../../../types/index.js';
import { adminFetchPartnerStockOrders, adminUpdatePartnerStockOrderStatus } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatDate, formatPrice } from '../../lib/utils.js';

const statusVariant: Record<PartnerStockOrderStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  submitted: 'warning',
  fulfilled: 'success',
  cancelled: 'error',
};

const stockOrderStatuses: PartnerStockOrderStatus[] = ['submitted', 'fulfilled', 'cancelled'];

function StockOrderRow({
  order,
  token,
  onUpdated,
}: {
  order: PartnerStockOrderAdminSummary;
  token: string;
  onUpdated: (order: PartnerStockOrderAdminSummary) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<PartnerStockOrderStatus>(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(order.status);
  }, [order.status]);

  async function handleUpdateStatus() {
    setSaving(true);
    setError(null);
    try {
      await adminUpdatePartnerStockOrderStatus(token, order.id, status);
      onUpdated({ ...order, status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr
        className="cursor-pointer align-middle hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <td className="py-2 pl-4 pr-4 align-middle sm:pl-6">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{order.partnerName}</span>
          <span className="block text-xs text-gray-400 dark:text-gray-500">{order.partnerSlug}</span>
        </td>
        <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 align-middle">
          {order.totalPieces} pcs
        </td>
        <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 align-middle">
          {formatPrice(order.totalValue)}
        </td>
        <td className="px-3 py-2 align-middle">
          <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap overflow-x-auto" onClick={(e) => e.stopPropagation()}>
            <Badge variant={statusVariant[order.status]} className="shrink-0">
              {order.status}
            </Badge>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PartnerStockOrderStatus)}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              {stockOrderStatuses.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={saving || status === order.status}
              className="h-8 rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Move status'}
            </button>
            {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
          </div>
        </td>
        <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 align-middle">
          {formatDate(order.createdAt)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-900/50">
          <td colSpan={5} className="px-4 py-4 sm:px-6">
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Items</p>
                <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2">
                      <span>{item.quantity}x {item.title} ({item.color}, {item.size})</span>
                      <span className="text-gray-400 dark:text-gray-500">{formatPrice(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {order.notes && (
                <div className="rounded-lg border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">{order.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminStockOrdersPage() {
  const { token } = useAdminToken();
  const [orders, setOrders] = useState<PartnerStockOrderAdminSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchPartnerStockOrders(token);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function handleUpdated(updated: PartnerStockOrderAdminSummary) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Stock Orders</h1>
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
          <p className="text-gray-500 dark:text-gray-400">No partner stock orders yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] divide-y divide-gray-100 dark:divide-gray-800">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  {['Partner', 'Pieces', 'Value', 'Status', 'Created'].map((h, index) => (
                    <th
                      key={h}
                      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${index === 0 ? 'pl-6' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
                {orders.map((order) => (
                  <StockOrderRow
                    key={order.id}
                    order={order}
                    token={token!}
                    onUpdated={handleUpdated}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
