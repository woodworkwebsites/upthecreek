import { NavLink } from 'react-router-dom';
import { ProductGrid } from '../../components/product/ProductGrid.js';
import { useProducts } from '../../hooks/useProducts.js';

const facts = [
  {
    label: 'In-club stock',
    value: 'Club-run range',
    detail: 'Stock for the clubhouse, receptions and events.',
  },
  {
    label: 'Online sales',
    value: 'Player orders',
    detail: 'Club code sales tracked separately in the portal.',
  },
  {
    label: 'Commission',
    value: '10%',
    detail: 'Earn on attributed online orders.',
  },
  {
    label: 'Delivery',
    value: 'Free',
    detail: 'Display kit and setup included.',
  },
];

const process = [
  'Set up the club with a small opening range and display kit.',
  'Players use the club code online across the full UTC range.',
  'The portal tracks attributed orders, sales and commission in one place.',
];

const faqs = [
  {
    q: 'How is commission paid?',
    a: 'Commission is calculated on attributed online orders and shown in the partner dashboard alongside paid and pending totals.',
  },
  {
    q: 'Can clubs order stock directly?',
    a: 'Yes. The partner portal lets clubs place stock orders when they need to replenish the range.',
  },
  {
    q: 'Does the club code work on the full range?',
    a: 'Yes. The club code applies to the UTC collection, not a limited subset.',
  },
];

export default function PartnersFunnelPage() {
  const { products, loading, error } = useProducts();
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="min-h-screen bg-cream text-navy-900">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(43,77,164,0.34),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_26%),linear-gradient(180deg,_#06122c_0%,_#0a1736_52%,_#f8f7f3_52%,_#f8f7f3_100%)] text-white">
        <div className="absolute inset-0 opacity-25" aria-hidden>
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div aria-hidden className="hidden sm:block" />
            <img
              src="/UTC_WordMark_White_Trans_BG.png"
              alt="Up the Creek Padel"
              className="h-12 w-auto justify-self-center sm:h-14 lg:h-16"
            />
            <NavLink
              to="/partners/login"
              className="justify-self-end text-xs font-semibold uppercase tracking-[0.28em] text-white/70 transition-colors hover:text-white"
            >
              Partner login
            </NavLink>
          </div>

          <div className="mx-auto max-w-4xl pt-14 text-center animate-fade-up">
            <p className="label text-white/60">Partner programme</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
              Club apparel with stock ordering and tracked commission.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/78 sm:text-lg">
              UTC gives clubs a stock range for the clubhouse, a code for players to use online, and a portal that shows
              orders, sales and commission clearly.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-3 text-center sm:grid-cols-2 xl:grid-cols-4">
            {facts.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-navy-950/55 p-4 text-left backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">{item.label}</p>
                <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-white/70">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-6xl rounded-[2rem] border border-white/10 bg-navy-950/50 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
            <p className="px-1 pb-4 text-xs font-bold uppercase tracking-[0.28em] text-white/50">Featured products</p>

            <div className="rounded-[1.5rem] border border-gray-200 bg-[linear-gradient(180deg,_#f7f3eb_0%,_#efe7db_100%)] p-4 sm:p-6">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-100" />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-sm text-gray-500">
                  {error}
                </div>
              ) : featuredProducts.length > 0 ? (
                <ProductGrid products={featuredProducts} priceLabel="RRP" />
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-sm text-gray-500">
                  No products are available right now.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <h2 className="mx-auto max-w-3xl text-center text-2xl font-black tracking-tight text-navy-900 sm:text-3xl">
          Partners collect both margin from wholesale and commission from referrals.
        </h2>
        <div className="mx-auto mt-8 max-w-2xl">
          <article className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
            <p className="label">How it works</p>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">Set up, sell, track</h3>
            <div className="mt-6 space-y-5">
              {process.map((item, index) => (
                <div key={item} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-sm font-black text-white">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-7 text-gray-700">{item}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="mt-10 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
          <p className="label">Collaboration drop</p>
          <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">One-off club x UTC collection</h3>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
            If a club wants something beyond the core range, UTC can produce a limited edition design that combines the club
            identity with UTC branding. It can be run as a one-time drop, a short seasonal release, or a small exclusive
            collection for club players.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">Use case</p>
              <p className="mt-2 text-sm font-semibold text-navy-900">Launch event or seasonal drop</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">Scope</p>
              <p className="mt-2 text-sm font-semibold text-navy-900">One design, club specific</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">Run</p>
              <p className="mt-2 text-sm font-semibold text-navy-900">Limited and time boxed</p>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
          <p className="label">Frequently asked</p>
          <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">Good to know</h3>
          <div className="mt-6 grid gap-3">
            {faqs.map((item) => (
              <details key={item.q} className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
                <summary className="cursor-pointer list-none text-sm font-bold text-navy-900">
                  {item.q}
                </summary>
                <p className="mt-3 text-sm leading-7 text-gray-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)] lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="label">Apply</p>
            <h3 className="mt-3 text-3xl font-black tracking-tight text-navy-900">
              Ready to set up a partner account?
            </h3>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              Send the club name and contact details and we’ll set up the partner record, pricing, access and stock ordering.
            </p>
          </div>
          <a
            href="mailto:partners@upthecreekpadel.club?subject=UTC%20Partner%20Programme"
            className="inline-flex items-center justify-center rounded-full bg-navy-900 px-7 py-3 text-sm font-bold tracking-wider text-white transition-colors hover:bg-navy-800"
          >
            Apply to become a partner club
          </a>
        </div>
      </section>
    </div>
  );
}
