import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Order } from '../../../types/index.js';
import { adminFetchOrders, adminFetchOrder, adminFulfillOrder, adminUpdateOrderStatus, adminDeleteOrder, adminDownloadOrderReceipt, adminSendOrderConfirmation, adminPreviewOrderConfirmation, adminPreviewDispatchEmail, adminSendDispatchEmail } from '../../lib/api.js';
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
  order_received: 'info',
  ordered_sellshirts: 'warning',
  dispatched: 'info',
  delivered: 'success',
  cancelled: 'error',
};

const providerVariant: Record<string, 'default' | 'info'> = {
  printify: 'default',
  manual:   'info',
};

const labels: Record<string,string> = { order_received:'Order received',ordered_sellshirts:'Ordered from SellShirts',dispatched:'Dispatched',delivered:'Delivered',cancelled:'Cancelled',failed:'Failed' };

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
  const [emailKind,setEmailKind]=useState<'confirmation'|'dispatch'>('confirmation');
  const [previewOpen,setPreviewOpen]=useState(false);
  const [previewLoading,setPreviewLoading]=useState(false);
  const [preview,setPreview]=useState<{subject:string;html:string;text:string;recipient:string;from:string;sentAt:string|null}|null>(null);
  const [sendMode,setSendMode]=useState<'test'|'customer'>('customer');
  const testRecipient='ash@woodworkproductions.co.uk';
  const recipient=sendMode==='test' ? testRecipient : (preview?.recipient ?? '');
  const [confirmationSending, setConfirmationSending] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [receiptDownloading, setReceiptDownloading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
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
      const updated: Order = { ...(detail ?? order), status: 'ordered_sellshirts', externalOrderRef: externalOrderRef.trim() || null };
      setDetail(updated);
      onFulfilled(updated);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to mark as fulfilled');
    } finally {
      setSubmitting(false);
    }
  }

  async function advanceOrder(next: Order['status']) {
    setStatus(next);
    setStatusSaving(true);
    setStatusError(null);
    try {
      await adminUpdateOrderStatus(token,order.id,next,externalOrderRef.trim() || undefined);
      const updated: Order={...(detail??order),status:next,externalOrderRef:externalOrderRef.trim() || (detail??order).externalOrderRef};
      setDetail(updated);onFulfilled(updated);
    } catch(e) {setStatusError(e instanceof Error ? e.message : 'Could not update order');}
    finally {setStatusSaving(false);}
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

  async function openConfirmationPreview(kind: 'confirmation'|'dispatch' = 'confirmation') {
    setEmailKind(kind);setPreview(null);
    setPreviewOpen(true);setPreviewLoading(true);setConfirmationError(null);
    try {const data=kind==='dispatch' ? await adminPreviewDispatchEmail(token,order.id) : await adminPreviewOrderConfirmation(token,order.id);setPreview(data);setSendMode('customer');}
    catch(e){setConfirmationError(e instanceof Error?e.message:'Preview unavailable');}
    finally{setPreviewLoading(false);}
  }

  async function handleSendConfirmation() {
    if (!preview) return;
    const test=sendMode==='test';
    if (!window.confirm(test ? 'Send a test copy to '+recipient+'? The customer will not be marked as emailed.' : 'Send this confirmation to the customer?')) return;
    setConfirmationSending(true); setConfirmationError(null);
    try {
      if(emailKind==='dispatch') await adminSendDispatchEmail(token,order.id,recipient.trim());
      else await adminSendOrderConfirmation(token, order.id, recipient.trim());
      if(!test && emailKind==='confirmation')setConfirmationSent(true);
      setPreviewOpen(false);
    } catch(e) { setConfirmationError(e instanceof Error ? e.message : 'Email failed'); }
    finally {setConfirmationSending(false);}
  }

  async function handleDownloadReceipt() {
    setReceiptDownloading(true);
    setReceiptError(null);
    try {
      const { blob, filename } = await adminDownloadOrderReceipt(token, order.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setReceiptError(err instanceof Error ? err.message : 'Failed to download receipt');
    } finally {
      setReceiptDownloading(false);
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
          <div className="flex flex-wrap items-start gap-2 md:flex-nowrap md:items-center md:whitespace-nowrap md:overflow-x-auto" onClick={(e) => e.stopPropagation()}>
            <Badge variant={statusVariant[shown.status] ?? 'default'} className="shrink-0">
              {labels[shown.status] ?? shown.status.replace(/_/g, ' ')}
            </Badge>
            <select value={status} onChange={e=>setStatus(e.target.value as Order['status'])} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
              {(['order_received','ordered_sellshirts','dispatched','delivered','cancelled'] as Order['status'][]).map(value=><option key={value} value={value}>{labels[value]}</option>)}
            </select>
            <button type="button" onClick={()=>void handleUpdateStatus()} disabled={statusSaving || status===shown.status} className="h-8 rounded-lg bg-navy-800 px-3 text-xs font-semibold text-white disabled:opacity-50">{statusSaving?'Saving…':'Move status'}</button>
            {statusError && <div className="text-xs text-red-600 dark:text-red-400">{statusError}</div>}
          </div>
        </td>
        <td className="px-3 py-2 align-middle">
          <Badge variant={providerVariant[order.fulfillmentProvider] ?? 'default'} className="shrink-0">
            {order.fulfillmentProvider}
          </Badge>
        </td>
        <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 align-middle">
          {shown.externalOrderRef ?? '—'}
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
                        <div key={item.id} className="space-y-1 border-b border-gray-100 pb-1 last:border-0 last:pb-0 dark:border-gray-800">
                          <div className="flex justify-between gap-2">
                          <span className="flex flex-wrap items-center gap-2">
                            <span>{item.quantity}x {item.title} ({item.color}, {item.size})</span>
                            {item.orderUrl && (
                              <a
                                href={item.orderUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-navy-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-blue-300"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Open garment
                              </a>
                            )}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500">{formatPrice(item.unitPrice * item.quantity)}</span>
                          </div>
                          {item.personalization && <p className="whitespace-pre-wrap break-words rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"><span className="font-semibold">Personalisation:</span> {item.personalization}</p>}
                        </div>
                      )) : (
                        <p className="text-gray-400 dark:text-gray-500">No items loaded</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={handleDownloadReceipt}
                    disabled={receiptDownloading}
                    className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
                  >
                    {receiptDownloading ? 'Preparing receipt…' : 'Download receipt'}
                  </button>
                  <button type="button" onClick={() => void openConfirmationPreview('confirmation')} disabled={confirmationSending || !['ordered_sellshirts','dispatched','delivered'].includes(shown.status)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-50 dark:text-gray-100">{confirmationSending ? 'Sending…' : confirmationSent ? 'Preview / test email' : 'Preview / send email'}</button>
                  {['dispatched','delivered'].includes(shown.status) && <button type="button" onClick={()=>void openConfirmationPreview('dispatch')} disabled={confirmationSending} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-50 dark:text-gray-100">Preview / send dispatched email</button>}
                  {confirmationError && <span className="text-xs text-red-600">{confirmationError}</span>}
                  {receiptError && <span className="text-xs text-red-600 dark:text-red-400">{receiptError}</span>}
                </div>

                {shown.fulfillmentProvider === 'manual' && shown.status === 'order_received' && (
                  <div className="rounded-lg border border-gray-200 bg-white p-3 dark:bg-gray-950 dark:border-gray-800">
                    <p className="mb-2 text-xs font-semibold">SellShirts supplier reference (optional)</p>
                    <div className="flex flex-wrap gap-2">
                      <input value={externalOrderRef} onChange={e=>setExternalOrderRef(e.target.value)} placeholder="SellShirts order reference" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs dark:bg-gray-900 dark:border-gray-700"/>
                      <button type="button" disabled={submitting} onClick={() => void handleMarkFulfilled()} className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{submitting?'Saving…':'Record SellShirts order'}</button>
                    </div>
                    {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
      {typeof document !== 'undefined' && createPortal(
        <>
          {previewOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3 sm:p-6" onClick={()=>!confirmationSending&&setPreviewOpen(false)}>
              <div style={{backgroundColor:"#ffffff",color:"#202527",colorScheme:"light"}} className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl" onClick={e=>e.stopPropagation()}>
                <div style={{backgroundColor:"#ffffff",color:"#202527"}} className="shrink-0 border-b border-gray-200 p-4">
                  <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{emailKind==='dispatch'?'Dispatch email preview':'Order confirmation preview'}</h2><button onClick={()=>setPreviewOpen(false)} className="text-sm font-semibold text-gray-800">Close</button></div>
                  <p className="mt-2 text-xs text-gray-500">From: orders@upthecreekpadel.club</p>
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-800">Send to</p>
                    <div role="group" aria-label="Email recipient" className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
                      <button type="button" aria-pressed={sendMode==='test'} onClick={()=>setSendMode('test')} style={{backgroundColor:sendMode==='test'?'#202527':'transparent',color:sendMode==='test'?'#ffffff':'#202527'}} className="rounded-md px-3 py-2 text-sm font-semibold">Test</button>
                      <button type="button" aria-pressed={sendMode==='customer'} onClick={()=>setSendMode('customer')} style={{backgroundColor:sendMode==='customer'?'#202527':'transparent',color:sendMode==='customer'?'#ffffff':'#202527'}} className="rounded-md px-3 py-2 text-sm font-semibold">Customer</button>
                    </div>
                    <p className="mt-2 break-all text-sm text-gray-700">{recipient}</p>
                  </div>
                  {preview && <p className="mt-2 break-words text-sm text-gray-900"><strong>Subject:</strong> {preview.subject}</p>}
                  {preview?.sentAt && <p className="mt-2 text-xs text-green-700">{emailKind==='dispatch'?'Dispatch email':'Order confirmation'} sent {preview.sentAt}. Test copies remain available.</p>}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-gray-100 p-3 sm:p-4">
                  {previewLoading ? <p>Loading preview…</p> : preview ? <iframe title="Rendered customer email" sandbox="" srcDoc={preview.html} className="h-[420px] w-full rounded-lg border border-gray-200 bg-white"/> : <p>Preview unavailable</p>}
                </div>
                {confirmationError && <p className="px-4 text-xs text-red-600">{confirmationError}</p>}
                <div style={{backgroundColor:"#ffffff",color:"#202527"}} className="flex shrink-0 justify-end gap-2 border-t border-gray-200 p-4">
                  <button type="button" onClick={()=>setPreviewOpen(false)} style={{backgroundColor:"#ffffff",color:"#202527"}} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">Cancel</button>
                  <button type="button" disabled={!preview || confirmationSending || !recipient.trim() || (!!preview.sentAt && sendMode==='customer') || (emailKind==='confirmation' && confirmationSent && sendMode==='customer')} onClick={()=>void handleSendConfirmation()} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{confirmationSending?'Sending…':sendMode==='test'?'Send test email':'Send to customer'}</button>
                </div>
              </div>
            </div>
          )}
          {sessionModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
              onClick={() => setSessionModalOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-950 max-h-[calc(100dvh-2rem)] overflow-y-auto"
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
                className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-950 max-h-[calc(100dvh-2rem)] overflow-y-auto"
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
      <div className="fixed left-4 right-4 top-4 z-50 mx-auto flex w-auto max-w-md flex-col gap-3 pointer-events-none md:left-auto md:right-4 md:w-[min(24rem,calc(100vw-2rem))]">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  {['Session', 'Customer', 'Amount', 'Status', 'Provider', 'Ref', 'Created', ''].map((h, index) => (
                    <th
                      key={h || `col-${index}`}
                      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${index === 0 ? 'pl-6' : ''} ${index === 7 ? 'text-right sm:pr-6' : ''}`}
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
