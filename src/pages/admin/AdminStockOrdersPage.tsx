import { useCallback, useEffect, useState } from 'react';
import type { PartnerStockOrderAdminSummary, PartnerStockOrderStatus } from '../../../types/index.js';
import {
  adminDeletePartnerStockOrder,
  adminDownloadPartnerStockOrderInvoice,
  adminFetchPartnerStockOrders,
  adminUpdatePartnerStockOrderStatus,
} from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatDate, formatPrice } from '../../lib/utils.js';

const statusVariant: Record<PartnerStockOrderStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  club_submitted: 'warning',
  invoiced: 'info',
  sellshirts_order: 'default',
  sellshirts_dispatched: 'info',
  at_utc: 'success',
  with_club: 'success',
  cancelled: 'error',
  archived: 'default',
};

const stockOrderStatuses: PartnerStockOrderStatus[] = [
  'club_submitted',
  'invoiced',
  'sellshirts_order',
  'sellshirts_dispatched',
  'at_utc',
  'with_club',
  'cancelled',
  'archived',
];

const statusLabels: Record<PartnerStockOrderStatus, string> = {
  club_submitted: 'Club submitted',
  invoiced: 'Invoiced',
  sellshirts_order: 'Sellshirts order',
  sellshirts_dispatched: 'Sellshirts Dispatched',
  at_utc: 'At UTC',
  with_club: 'With Club',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

function StockOrderRow({
  order,
  token,
  onUpdated,
  onDeleted,
}: {
  order: PartnerStockOrderAdminSummary;
  token: string;
  onUpdated: (order: PartnerStockOrderAdminSummary) => void;
  onDeleted: (orderId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<PartnerStockOrderStatus>(order.status);
  const [invoicePaid, setInvoicePaid] = useState(order.invoicePaid);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceDownloading, setInvoiceDownloading] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(order.status);
    setInvoicePaid(order.invoicePaid);
  }, [order.invoicePaid, order.status]);

  async function handleUpdateStatus() {
    setSaving(true);
    setError(null);
    try {
      await adminUpdatePartnerStockOrderStatus(token, order.id, status, invoicePaid);
      onUpdated({ ...order, status, invoicePaid });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveOrder() {
    setSaving(true);
    setError(null);
    try {
      await adminUpdatePartnerStockOrderStatus(token, order.id, 'archived');
      onUpdated({ ...order, status: 'archived', invoicePaid });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive stock order');
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadInvoice() {
    setInvoiceDownloading(true);
    setInvoiceError(null);
    try {
      const { blob, filename } = await adminDownloadPartnerStockOrderInvoice(token, order.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : 'Failed to download invoice');
    } finally {
      setInvoiceDownloading(false);
    }
  }

  async function handleDeleteOrder() {
    if (!window.confirm(`Delete stock order for ${order.partnerName}?`)) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await adminDeletePartnerStockOrder(token, order.id);
      onDeleted(order.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete stock order');
    } finally {
      setDeleting(false);
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
              {statusLabels[order.status]}
            </Badge>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PartnerStockOrderStatus)}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              {stockOrderStatuses.map((value) => (
                <option key={value} value={value}>{statusLabels[value]}</option>
              ))}
            </select>
            <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
              <input
                type="checkbox"
                checked={invoicePaid}
                onChange={(e) => setInvoicePaid(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-navy-800 focus:ring-navy-500"
              />
              Invoice Paid
            </label>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={saving || (status === order.status && invoicePaid === order.invoicePaid)}
              className="h-8 rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleDownloadInvoice}
              disabled={invoiceDownloading}
              className="h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
            >
              {invoiceDownloading ? 'Generating…' : 'Invoice'}
            </button>
            {order.status !== 'archived' && (
              <button
                type="button"
                onClick={handleArchiveOrder}
                disabled={saving}
                className="h-8 rounded-lg border border-amber-200 px-3 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 transition-colors dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-950/30"
              >
                Archive
              </button>
            )}
            {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
            {invoiceError && <span className="text-xs text-red-600 dark:text-red-400">{invoiceError}</span>}
            <button
              type="button"
              onClick={handleDeleteOrder}
              disabled={deleting || order.status !== 'archived'}
              title={order.status !== 'archived' ? 'Archive the stock order before deleting it' : undefined}
              className="h-8 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
            >
              {deleting ? 'Deleting…' : 'Delete archived'}
            </button>
            {deleteError && <span className="text-xs text-red-600 dark:text-red-400">{deleteError}</span>}
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
                    onDeleted={(orderId) => setOrders((current) => current.filter((item) => item.id !== orderId))}
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
