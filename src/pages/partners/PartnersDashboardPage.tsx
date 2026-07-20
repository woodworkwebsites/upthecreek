import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner.js';
import { partnerFetchDashboard } from '../../lib/api.js';
import { formatDate, formatPrice } from '../../lib/utils.js';
import { usePartnerSession } from '../../hooks/usePartner.js';
import type { PartnerDashboard, PartnerOrderSummary } from '../../../types/index.js';

const statusVariant: Record<PartnerOrderSummary['status'], 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  pending: 'default',
  paid: 'info',
  fulfillment_started: 'warning',
  awaiting_fulfillment: 'warning',
  fulfilled: 'success',
  failed: 'error',
};

function money(value: number): string {
  return formatPrice(value);
}

function OrderCard({ order }: { order: PartnerOrderSummary }) {
  const visibleItems = order.items.slice(0, 2);
  const hiddenCount = Math.max(0, order.items.length - visibleItems.length);

  return (
    <article className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-[0_18px_60px_rgba(5,13,31,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-navy-900">{order.customerName ?? 'Customer checkout'}</p>
          <p className="mt-1 text-xs text-gray-500">{order.customerEmail}</p>
        </div>
        <Badge variant={statusVariant[order.status]}>{order.status.replace(/_/g, ' ')}</Badge>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Order total</p>
          <p className="mt-2 text-lg font-black text-navy-900">{money(order.amountTotal)}</p>
        </div>
        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Commission</p>
          <p className="mt-2 text-lg font-black text-navy-900">{money(order.commissionAmount)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {visibleItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm text-gray-700">
            <div>
              <p className="font-semibold text-navy-900">{item.title}</p>
              <p className="text-xs text-gray-500">{item.color} / {item.size} × {item.quantity}</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">{money(item.unitPrice * item.quantity)}</span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="text-xs text-gray-400">+{hiddenCount} more line item{hiddenCount === 1 ? '' : 's'}</p>
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500">
        <div>
          <dt className="uppercase tracking-[0.2em] text-gray-400">Discount code</dt>
          <dd className="mt-1 font-semibold text-navy-900">{order.discountCode ?? 'None'}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.2em] text-gray-400">Discount value</dt>
          <dd className="mt-1 font-semibold text-navy-900">{money(order.discountAmount)}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.2em] text-gray-400">Fulfilment</dt>
          <dd className="mt-1 font-semibold text-navy-900">{order.fulfillmentProvider}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.2em] text-gray-400">Updated</dt>
          <dd className="mt-1 font-semibold text-navy-900">{formatDate(order.updatedAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

export default function PartnersDashboardPage() {
  const navigate = useNavigate();
  const { session, clearSession } = usePartnerSession();
  const [dashboard, setDashboard] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      navigate('/partners/login', { replace: true });
    }
  }, [navigate, session]);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await partnerFetchDashboard(session.slug, session.accessToken);
        if (!cancelled) {
          setDashboard(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load partner dashboard';
          setError(message);
          if (/unauthorized/i.test(message)) {
            clearSession();
            navigate('/partners/login', { replace: true });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [clearSession, navigate, session]);

  const metrics = useMemo(() => {
    if (!dashboard) return null;

    const { summary } = dashboard;
    return [
      { label: 'Commission due', value: money(summary.commissionDue) },
      { label: 'Commission paid', value: money(summary.commissionPaid) },
      { label: 'Commission pending', value: money(summary.commissionPending) },
      { label: 'Net sales', value: money(summary.netSales) },
    ];
  }, [dashboard]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#06112a_0%,_#08183a_18%,_#f8f7f3_18%,_#f8f7f3_100%)] text-navy-900">
      <header className="border-b border-white/10 bg-navy-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <img src="/UTC_WordMark_White_Trans_BG.png" alt="Up the Creek Padel" className="h-10 w-auto" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">Partner portal</p>
              <h1 className="text-sm font-black tracking-tight sm:text-base">{session.partner.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a href="/partners" className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60 hover:text-white">
              Funnel
            </a>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                clearSession();
                navigate('/partners/login', { replace: true });
              }}
              className="border-white/20 text-white hover:bg-white hover:text-navy-900"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex min-h-[55vh] items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <ErrorMessage
            title="Partner dashboard unavailable"
            message={error}
            onRetry={() => {
              if (!session) return;
              setError(null);
              setLoading(true);
              void partnerFetchDashboard(session.slug, session.accessToken)
                .then((data) => setDashboard(data))
                .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load partner dashboard'))
                .finally(() => setLoading(false));
            }}
          />
        ) : dashboard ? (
          <>
            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
                <p className="label">Current partner</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">{dashboard.partner.name}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
                  Club slug: <span className="font-semibold text-navy-900">{dashboard.partner.slug}</span>
                  {dashboard.partner.discountCode ? (
                    <>
                      {' '}| code <span className="font-semibold text-navy-900">{dashboard.partner.discountCode}</span>
                    </>
                  ) : null}
                  {' '}| commission <span className="font-semibold text-navy-900">{dashboard.partner.commissionRate}%</span>
                </p>
                {dashboard.partner.description && (
                  <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm leading-7 text-gray-600">
                    {dashboard.partner.description}
                  </p>
                )}
              </div>

              <div className="rounded-[2rem] border border-navy-900 bg-navy-900 p-8 text-white shadow-[0_25px_80px_rgba(5,13,31,0.12)]">
                <p className="label text-white/55">Summary</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {metrics?.map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">{metric.label}</p>
                      <p className="mt-2 text-2xl font-black">{metric.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-white/60">
                  <span>{dashboard.summary.totalOrders} order{dashboard.summary.totalOrders === 1 ? '' : 's'}</span>
                  <span>•</span>
                  <span>Gross sales {money(dashboard.summary.grossSales)}</span>
                  <span>•</span>
                  <span>Discounts {money(dashboard.summary.discountTotal)}</span>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="label">Recent orders</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight">Track your club sales</h3>
                </div>
                <p className="text-xs uppercase tracking-[0.24em] text-gray-500">
                  {dashboard.recentOrders.length} shown
                </p>
              </div>

              {dashboard.recentOrders.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                  No partner orders have been attributed to this club code yet.
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {dashboard.recentOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
