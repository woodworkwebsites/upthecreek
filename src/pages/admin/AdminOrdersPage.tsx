import { useState, useEffect, useCallback } from 'react';
import type { Order } from '../../../types/index.js';
import { adminFetchOrders, adminFetchOrder, adminFulfillOrder, adminUpdateOrderStatus } from '../../lib/api.js';
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

function OrderRow({ order, token, onFulfilled }: { order: Order; token: string; onFulfilled: (order: Order) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [status, setStatus] = useState<Order['status']>(order.status);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [externalOrderRef, setExternalOrderRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const shown = detail ?? order;

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => void toggleExpanded()}
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
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <Badge variant={statusVariant[shown.status] ?? 'default'}>
              {shown.status.replace(/_/g, ' ')}
            </Badge>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Order['status'])}
              className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              {orderStatuses.map((value) => (
                <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={statusSaving || status === shown.status}
              className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
            >
              {statusSaving ? 'Saving…' : 'Move status'}
            </button>
            {statusError && <div className="text-xs text-red-600 dark:text-red-400">{statusError}</div>}
          </div>
        </td>
        <td className="px-3 py-3">
          <Badge variant={providerVariant[order.fulfillmentProvider] ?? 'default'}>
            {order.fulfillmentProvider}
          </Badge>
        </td>
        <td className="px-3 py-3">
          <Badge variant={modeVariant[order.printifyMode] ?? 'default'}>
            {order.printifyMode.replace(/_/g, ' ')}
          </Badge>
        </td>
        <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
          {order.printifyOrderId ?? shown.externalOrderRef ?? '—'}
        </td>
        <td className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500">
          {formatDate(order.createdAt)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-900/50">
          <td colSpan={8} className="px-4 py-4 sm:px-6">
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

  function handleFulfilled(updated: Order) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status, externalOrderRef: updated.externalOrderRef } : o)));
  }

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
                  {['Session', 'Customer', 'Amount', 'Status', 'Provider', 'Mode', 'Ref', 'Created'].map((h) => (
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
                  <OrderRow key={order.id} order={order} token={token!} onFulfilled={handleFulfilled} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
