import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Order } from '../../../types/index.js';
import { adminFetchOrders, adminFetchOrder, adminFulfillOrder, adminUpdateOrderStatus, adminDeleteOrder } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatDate, formatPrice } from '../../lib/utils.js';

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending:              'default',
  paid:                 'info',
  fulfillment_started:  'warning',
  awaiting_fulfillment: 'warning',
  fulfilled:            'success',
  failed:               'error',
};

const modeVariant: Record<string, 'default' | 'warning' | 'info'> = {
  dry_run: 'warning',
  draft:   'info',
  live:    'default',
};

const providerVariant: Record<string, 'default' | 'info'> = {
  printify: 'default',
  manual:   'info',
};

const orderStatuses: Order['status'][] = [
  'pending',
  'paid',
  'fulfillment_started',
  'awaiting_fulfillment',
  'fulfilled',
  'failed',
];

function OrderRow({
  order,
  token,
  onFulfilled,
  onDeleted,
}: {
  order: Order;
  token: string;
  onFulfilled: (order: Order) => void;
  onDeleted: (orderId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [status, setStatus] = useState<Order['status']>(order.status);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [externalOrderRef, setExternalOrderRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const shown = detail ?? order;
    setStatus(shown.status);
  }, [detail, order.status]);

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);

    if (next && !detail) {
      setLoadingDetail(true);
      try {
        const full = await adminFetchOrder(token, order.id);
        setDetail(full);
      } catch {
        // Fall back to the summary already shown in the row.
      } finally {
        setLoadingDetail(false);
      }
    }
  }

  async function handleMarkFulfilled() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await adminFulfillOrder(token, order.id, externalOrderRef.trim() || undefined);
      const updated: Order = { ...(detail ?? order), status: 'fulfilled', externalOrderRef: externalOrderRef.trim() || null };
      setDetail(updated);
      onFulfilled(updated);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to mark as fulfilled');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateStatus() {
    setStatusSaving(true);
    setStatusError(null);
    try {
      await adminUpdateOrderStatus(token, order.id, status, externalOrderRef.trim() || undefined);
      const updated: Order = {
        ...(detail ?? order),
        status,
        externalOrderRef: externalOrderRef.trim() || (detail ?? order).externalOrderRef,
      };
      setDetail(updated);
      onFulfilled(updated);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleDeleteOrder() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await adminDeleteOrder(token, order.id);
      setDeleteConfirmOpen(false);
      onDeleted(order.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete order');
    } finally {
      setDeleting(false);
    }
  }

  const shown = detail ?? order;

  return (
    <>
      <tr
        className="cursor-pointer align-middle hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => void toggleExpanded()}
      >
        <td className="py-2 pr-4 pl-4 sm:pl-6 align-middle">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSessionModalOpen(true);
            }}
            className="text-xs font-semibold text-navy-700 underline decoration-gray-300 underline-offset-2 hover:text-navy-900 dark:text-blue-300 dark:decoration-gray-600"
          >
            Session
          </button>
        </td>
        <td className="px-3 py-2 align-middle">
          <span className="text-sm text-gray-900 dark:text-gray-100">
            {order.customerEmail}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 align-middle">
          {formatPrice(order.amountTotal)}
        </td>
        <td className="px-3 py-2 align-middle">
          <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap overflow-x-auto" onClick={(e) => e.stopPropagation()}>
            <Badge variant={statusVariant[shown.status] ?? 'default'} className="shrink-0">
              {shown.status.replace(/_/g, ' ')}
            </Badge>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Order['status'])}
              className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              {orderStatuses.map((value) => (
                <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={statusSaving || status === shown.status}
              className="h-8 rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
            >
              {statusSaving ? 'Saving…' : 'Move status'}
            </button>
            {statusError && <div className="text-xs text-red-600 dark:text-red-400">{statusError}</div>}
          </div>
        </td>
        <td className="px-3 py-2 align-middle">
          <Badge variant={providerVariant[order.fulfillmentProvider] ?? 'default'} className="shrink-0">
            {order.fulfillmentProvider}
          </Badge>
        </td>
        <td className="px-3 py-2 align-middle">
          <Badge variant={modeVariant[order.printifyMode] ?? 'default'} className="shrink-0">
            {order.printifyMode.replace(/_/g, ' ')}
          </Badge>
        </td>
        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 align-middle">
          {order.printifyOrderId ?? shown.externalOrderRef ?? '—'}
        </td>
        <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 align-middle">
          {formatDate(order.createdAt)}
        </td>
        <td className="px-3 py-2 text-right align-middle sm:pr-6">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirmOpen(true);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 dark:border-gray-700 dark:text-red-400 dark:hover:bg-red-900/20"
            aria-label={`Delete order ${order.id}`}
          >
            X
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-900/50">
          <td colSpan={9} className="px-4 py-4 sm:px-6">
            {loadingDetail ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading order details…</p>
            ) : (
              <div className="space-y-4">
                {shown.error && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">Error</p>
                    <p className="mt-1 text-xs text-red-600 dark:text-red-300 font-mono">{shown.error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Shipping Address
                    </p>
                    <div className="rounded-lg bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-3 text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{shown.shippingName || '—'}</p>
                      <p>{shown.shippingPhone}</p>
                      <p>{shown.shippingAddress1}</p>
                      {shown.shippingAddress2 && <p>{shown.shippingAddress2}</p>}
                      <p>{shown.shippingCity}{shown.shippingRegion ? `, ${shown.shippingRegion}` : ''}</p>
                      <p>{shown.shippingZip}, {shown.shippingCountry}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Items
                    </p>
                    <div className="rounded-lg bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800 p-3 text-xs text-gray-700 dark:text-gray-300 space-y-1.5">
                      {shown.items && shown.items.length > 0 ? shown.items.map((item) => (
                        <div key={item.id} className="flex justify-between gap-2">
                          <span>{item.quantity}x {item.title} ({item.color}, {item.size})</span>
                          <span className="text-gray-400 dark:text-gray-500">{formatPrice(item.unitPrice * item.quantity)}</span>
                        </div>
                      )) : (
                        <p className="text-gray-400 dark:text-gray-500">No items loaded</p>
                      )}
                    </div>
                  </div>
                </div>

                {shown.fulfillmentProvider === 'manual' && (
                  <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 p-3">
                    <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Manual Fulfillment (SellShirts)
                    </p>
                    {shown.status === 'fulfilled' ? (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        ✓ Fulfilled{shown.externalOrderRef ? ` — SellShirts ref: ${shown.externalOrderRef}` : ''}
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={externalOrderRef}
                          onChange={(e) => setExternalOrderRef(e.target.value)}
                          placeholder="SellShirts order ref (optional)"
                          className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
                        />
                        <button
                          onClick={handleMarkFulfilled}
                          disabled={submitting}
                          className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
                        >
                          {submitting ? 'Saving…' : 'Mark as fulfilled'}
                        </button>
                        {submitError && <span className="text-xs text-red-600 dark:text-red-400">{submitError}</span>}
                      </div>
                    )}
                  </div>
                )}

                {shown.printifyPayload !== null && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Printify Payload
                      </p>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-green-400 dark:bg-black">
                        {JSON.stringify(shown.printifyPayload, null, 2)}
                      </pre>
                    </div>
                    {shown.printifyResponse !== null && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Printify Response
                        </p>
                        <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-blue-400 dark:bg-black">
                          {JSON.stringify(shown.printifyResponse, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
      {typeof document !== 'undefined' && createPortal(
        <>
          {sessionModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
              onClick={() => setSessionModalOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-950"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Session ID</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Full Stripe session ID for this order.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSessionModalOpen(false)}
                    className="text-sm font-semibold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    aria-label="Close session details"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                  <code className="block break-all font-mono text-xs text-gray-900 dark:text-gray-100">
                    {order.stripeSessionId}
                  </code>
                </div>
              </div>
            </div>
          )}
          {deleteConfirmOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
              onClick={() => !deleting && setDeleteConfirmOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-950"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delete order?</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This will remove the order and its items from D1. The action cannot be undone.
                </p>
                <p className="mt-3 rounded-xl bg-gray-50 p-3 font-mono text-xs break-all text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                  {order.stripeSessionId}
                </p>
                {deleteError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{deleteError}</p>}
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmOpen(false)}
                    disabled={deleting}
                    className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteOrder()}
                    disabled={deleting}
                    className="h-8 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>,
        document.body,
      )}
    </>
  );
}

export default function AdminOrdersPage() {
  const { token } = useAdminToken();
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string }>>([]);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const toastTimersRef = useRef<Record<string, number>>({});

  const pushToast = useCallback((title: string, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, title, message }]);

    window.clearTimeout(toastTimersRef.current[id]);
    toastTimersRef.current[id] = window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      delete toastTimersRef.current[id];
    }, 6000);
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await adminFetchOrders(token);
      data.forEach((order) => {
        const seen = seenOrderIdsRef.current.has(order.id);
        if (!seen && initialLoadDoneRef.current) {
          pushToast(
            'New order received',
            `${order.customerEmail} · ${order.stripeSessionId.slice(0, 12)}… · ${formatPrice(order.amountTotal)}`,
          );
        }
      });
      seenOrderIdsRef.current = new Set(data.map((order) => order.id));
      initialLoadDoneRef.current = true;
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [token, pushToast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!token) return;

    const interval = window.setInterval(() => {
      void load({ silent: true });
    }, 15000);

    return () => window.clearInterval(interval);
  }, [token, load]);

  useEffect(() => {
    return () => {
      Object.values(toastTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current = {};
    };
  }, []);

  function handleFulfilled(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status, externalOrderRef: updated.externalOrderRef } : o)));
  }

  function handleDeleted(orderId: string) {
    setOrders((prev) => prev.filter((order) => order.id !== orderId));
  }

  return (
    <div className="space-y-6">
      <div className="fixed right-4 top-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-2xl shadow-gray-900/10 ring-1 ring-black/5 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{toast.title}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                className="text-xs font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                aria-label="Dismiss notification"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>

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
                  {['Session', 'Customer', 'Amount', 'Status', 'Provider', 'Mode', 'Ref', 'Created', ''].map((h, index) => (
                    <th
                      key={h || `col-${index}`}
                      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${index === 0 ? 'pl-6' : ''} ${index === 8 ? 'text-right sm:pr-6' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    token={token!}
                    onFulfilled={handleFulfilled}
                    onDeleted={handleDeleted}
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
