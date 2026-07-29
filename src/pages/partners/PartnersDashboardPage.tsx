import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { Badge } from '../../components/ui/Badge.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { formatDate, formatPrice } from '../../lib/utils.js';
import { partnerFetchDashboard } from '../../lib/api.js';
import { useProducts } from '../../hooks/useProducts.js';
import { useRanges } from '../../hooks/useRanges.js';
import { PartnerOrderWorkspace } from '../../components/partners/PartnerOrderWorkspace.js';
import { usePartnerSession } from '../../hooks/usePartner.js';
import type { PartnerDashboard, Product } from '../../../types/index.js';
import { DEFAULT_SIZE_OPTIONS } from '../../../types/catalog.js';

function buildCollaborationProducts(partner: PartnerDashboard['partner']): Product[] {
  if (!partner.collaborationEnabled) return [];

  const designs = partner.collaborationDesigns.length > 0
    ? partner.collaborationDesigns
    : partner.collaborationDesign
      ? [partner.collaborationDesign]
      : [];

  return designs.map((design, index) => {
    const sizes = design.sizes.length > 0 ? design.sizes : DEFAULT_SIZE_OPTIONS.slice();
    const wholesalePrice = Math.max(0, design.partnerPrice);
    const rrp = Math.max(wholesalePrice, design.rrp ?? wholesalePrice);
    const wholesalePricePounds = (wholesalePrice / 100).toFixed(2);
    const rrpPounds = (rrp / 100).toFixed(2);
    const colorName = design.colorName.trim() || 'Collaboration';
    const imageUrls = design.imageUrls.length > 0
      ? design.imageUrls
      : design.imageUrl
        ? [design.imageUrl]
        : [];

    return {
      id: `partner-collab:${partner.slug}:${index}`,
      printifyId: `partner-collab:${partner.slug}:${index}`,
      title: design.title.trim() || `${partner.name} collaboration`,
      description: design.description ?? '',
      category: 'partner-collaboration',
      rangeId: null,
      audience: 'Partner',
      productType: 'Collaboration',
      garment: design.garment?.trim() || 'Collaboration Shirt',
      pricingMatrix: {
        audience: 'Partner',
        product: 'Collaboration',
        garment: design.garment?.trim() || 'Collaboration Shirt',
        printSurface: 'Partner exclusive',
        manufacturingCost: '',
        saleCost: '',
        deliveryRetail: '',
        deliveryPartner: '',
        deliveryOnlinePartnership: '',
        salePrice: rrpPounds,
        partnerPrice: wholesalePricePounds,
      },
      images: imageUrls.length > 0
        ? imageUrls.map((src, imageIndex) => ({
          src: src.trim() || '/UTC_Logo.png',
          isDefault: imageIndex === 0,
          variantIds: sizes.map((_, variantIndex) => variantIndex + 1),
          color: colorName,
        }))
        : [
          {
            src: '/UTC_Logo.png',
            isDefault: true,
            variantIds: [1],
            color: colorName,
          },
        ],
      variants: sizes.map((size, sizeIndex) => ({
        id: sizeIndex + 1,
        color: colorName,
        size,
        price: wholesalePrice,
        available: true,
      })),
      colors: [
        {
          name: colorName,
          hex: design.colorHex?.trim() || '#111827',
        },
      ],
      hiddenColors: [],
      sizes,
      minPrice: rrp,
      maxPrice: rrp,
      isEnabled: true,
      sizeGuideImage: null,
      syncedAt: partner.updatedAt,
      createdAt: partner.createdAt,
      updatedAt: partner.updatedAt,
    };
  });
}

export default function PartnersDashboardPage() {
  const navigate = useNavigate();
  const { session, clearSession } = usePartnerSession();
  const { products, loading: productsLoading, error: productsError } = useProducts('partner');
  const { ranges, loading: rangesLoading, error: rangesError } = useRanges('partner');
  const [dashboard, setDashboard] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const collaborationProducts = useMemo(
    () => (dashboard ? buildCollaborationProducts(dashboard.partner) : []),
    [dashboard],
  );

  useEffect(() => {
    if (!session) {
      navigate('/partners/login', { replace: true });
      return;
    }
    const partnerSession = session;

    let active = true;
    async function loadDashboard() {
      try {
        setError(null);
        setLoading(true);
        const data = await partnerFetchDashboard(partnerSession.slug, partnerSession.accessToken);
        if (!active) return;
        setDashboard(data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load partner dashboard');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [navigate, session]);

  if (!session) {
    return <PageLoader />;
  }

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream px-4 py-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <ErrorMessage message={error} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/partners/login')}>Back to login</Button>
            <Button
              variant="secondary"
              onClick={() => {
                clearSession();
                navigate('/partners/login', { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return <ErrorMessage message="Partner dashboard not available" />;
  }

  const { partner, summary, recentOrders } = dashboard;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#06122c_0%,_#0a1736_18%,_#f8f7f3_18%,_#f8f7f3_100%)] text-navy-900">
      <header className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute inset-0 opacity-25" aria-hidden>
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute right-0 top-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
              <img
                src={partner.logoUrl || '/UTC_WordMark_White_Trans_BG.png'}
                alt={`${partner.name} logo`}
                className="h-full w-full object-contain p-2"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
                Club Referral Code {partner.slug.toUpperCase()}
              </p>
              <p className="mt-1 text-sm font-semibold text-white/90">{partner.name}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                clearSession();
                navigate('/partners/login', { replace: true });
              }}
              className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-navy-900 transition-colors hover:bg-white/90"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-[0_20px_70px_rgba(5,13,31,0.07)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="label">Club portal</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-navy-900 sm:text-4xl">
                {partner.name}
              </h1>
            </div>
            <div className="flex flex-wrap gap-3">
            </div>
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-[0_12px_40px_rgba(5,13,31,0.06)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Club Referral Sales this period</p>
                <p className="mt-2 text-3xl font-black text-navy-900">{formatPrice(summary.grossSales)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Commission due</p>
                <p className="mt-2 text-3xl font-black text-brand-500">{formatPrice(summary.commissionDue)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-8">
          <article className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-[0_20px_70px_rgba(5,13,31,0.07)] sm:p-8">
            <p className="label">Your Orders</p>
            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200">
              {recentOrders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                    <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Order</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Commission</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-navy-900">{order.customerName || order.customerEmail}</div>
                            <div className="text-xs text-gray-500">{order.itemCount} item{order.itemCount === 1 ? '' : 's'}</div>
                          </td>
                          <td className="px-4 py-4 text-gray-600">{order.status}</td>
                          <td className="px-4 py-4 font-semibold text-navy-900">{formatPrice(order.commissionAmount)}</td>
                          <td className="px-4 py-4 text-gray-600">{formatDate(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-sm leading-7 text-gray-500">
                  Once orders are placed through the club code, they will appear here.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-[0_20px_70px_rgba(5,13,31,0.07)] sm:p-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="label">UTC Range</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-navy-900">Partner Ordering</h2>              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">{products.length} products</Badge>
                <Badge variant="success">{products.filter((product) => product.isEnabled).length} live</Badge>
              </div>
            </div>

            <div className="mt-8">
              {productsLoading || rangesLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-100" />
                  ))}
                </div>
              ) : productsError ? (
                <p className="text-sm text-red-600">{productsError}</p>
              ) : rangesError ? (
                <p className="text-sm text-red-600">{rangesError}</p>
              ) : (
                <PartnerOrderWorkspace
                  products={products}
                  collaborationProducts={collaborationProducts}
                  ranges={ranges}
                  slug={session.slug}
                  accessToken={session.accessToken}
                />
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
