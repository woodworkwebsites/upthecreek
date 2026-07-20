import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { ProductGrid } from '../../components/product/ProductGrid.js';
import { useProducts } from '../../hooks/useProducts.js';

const overview = [
  { label: 'Member discount', value: '10%' },
  { label: 'Referral commission', value: '10%' },
  { label: 'Delivery', value: 'Free' },
  { label: 'Display kit', value: 'Included' },
];

const journey = [
  {
    title: 'Brand the club',
    body: 'Open with a compact shelf range and a clean UTC display rail, hangers and partner pricing.',
  },
  {
    title: 'Share the code',
    body: 'Members use a club-specific discount code online for 10% off the full UTC range.',
  },
  {
    title: 'Track the return',
    body: 'The partner portal shows attributed orders, gross sales and commission due.',
  },
];

const pricing = [
  {
    title: 'RRP',
    value: '£24.99',
    note: 'Standard retail price on the core tee range.',
  },
  {
    title: 'Starter partner',
    value: '£19.50',
    note: 'Margin of £5.49 per tee, around 22%.',
  },
  {
    title: 'Preferred partner',
    value: '£19.00',
    note: 'Margin of £5.99 per tee, around 24%.',
  },
];

const benefits = [
  'No stock risk for online orders.',
  'A retail margin on physical club stock.',
  'A live dashboard for commission and sales.',
  'A member perk that feels specific to the club.',
];

const faqs = [
  {
    q: 'How is commission paid?',
    a: 'Commission is calculated on attributed online orders and shown in the partner dashboard alongside paid and pending totals.',
  },
  {
    q: 'Can the club order stock directly?',
    a: 'Yes. The partner portal gives clubs a path into the UTC collection so they can order shelf stock when they need it.',
  },
  {
    q: 'Is the member discount available on the full range?',
    a: 'Yes. The club code applies to the UTC collection rather than a tiny restricted subset.',
  },
  {
    q: 'What is included with the opening range?',
    a: 'Partner pricing, free delivery, and the display rail plus hangers needed to present the stock properly.',
  },
];

export default function PartnersFunnelPage() {
  const navigate = useNavigate();
  const { products, loading, error } = useProducts();
  const featuredProducts = products.slice(0, 4);

  return (
    <div className="min-h-screen bg-cream text-navy-900">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(43,77,164,0.32),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.16),_transparent_28%),linear-gradient(180deg,_#06122c_0%,_#0a1736_58%,_#f8f7f3_58%,_#f8f7f3_100%)] text-white">
        <div className="absolute inset-0 opacity-25" aria-hidden>
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute right-0 top-28 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <img src="/UTC_WordMark_White_Trans_BG.png" alt="Up the Creek Padel" className="h-12 w-auto" />
            <NavLink
              to="/partners/login"
              className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70 transition-colors hover:text-white"
            >
              Partner login
            </NavLink>
          </div>

          <div className="grid gap-12 pt-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="max-w-3xl animate-fade-up">
              <p className="label text-white/60">Partner programme</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
                Club apparel that sells in-club and pays back online.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/78 sm:text-lg">
                UTC gives padel clubs a simple retail format: a small stock range for the clubhouse, a member discount code online,
                and a portal that shows exactly what the club has earned.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button className="bg-white text-navy-900 hover:bg-white/90" onClick={() => navigate('/partners/login')}>
                  Open partner portal
                </Button>
                <a
                  href="mailto:partners@upthecreekpadel.club?subject=UTC%20Partner%20Programme"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3 text-sm font-bold tracking-wider text-white transition-colors hover:bg-white/10"
                >
                  Apply to partner
                </a>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overview.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">{item.label}</p>
                    <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="rounded-[1.75rem] border border-white/10 bg-navy-900/70 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/50">What the range looks like</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <img
                    src="/UTC-Apparel-Black.png"
                    alt="UTC black apparel"
                    className="h-48 w-full rounded-[1.5rem] object-cover shadow-lg shadow-black/30"
                  />
                  <img
                    src="/UTC-Apparel-White.png"
                    alt="UTC white apparel"
                    className="h-48 w-full rounded-[1.5rem] object-cover shadow-lg shadow-black/30"
                  />
                  <img
                    src="/UTC-Wear-Black.png"
                    alt="UTC wear black"
                    className="h-48 w-full rounded-[1.5rem] object-cover shadow-lg shadow-black/30"
                  />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">Retail setup</p>
                    <p className="mt-2 text-sm leading-7 text-white/80">Display rail, hangers and a tight opening range.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">Online value</p>
                    <p className="mt-2 text-sm leading-7 text-white/80">Code-based discount and automated commission tracking.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="-mt-10">
        <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {journey.map((item, index) => (
              <article
                key={item.title}
                className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-[0_20px_70px_rgba(5,13,31,0.06)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-500">Step</span>
                </div>
                <h2 className="mt-6 text-lg font-black text-navy-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-600">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <article className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
              <p className="label">Pricing</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">The numbers, clearly laid out</h3>
              <div className="mt-6 grid gap-4">
                {pricing.map((tier) => (
                  <div key={tier.title} className="rounded-2xl border border-gray-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f7f8fb_100%)] p-5">
                    <div className="flex items-end justify-between gap-4">
                      <p className="text-sm font-bold uppercase tracking-[0.24em] text-gray-400">{tier.title}</p>
                      <p className="text-2xl font-black text-navy-900">{tier.value}</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-gray-600">{tier.note}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-2xl bg-navy-900 p-5 text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">Also included</p>
                <p className="mt-2 text-sm leading-7 text-white/80">
                  10% member discount online, 10% referral commission, free delivery, and the display kit for the club opening range.
                </p>
              </div>
            </article>

            <article className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
              <p className="label">Why it works</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">Built for clubs that want something clean and measurable</h3>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {benefits.map((item, index) => (
                  <div key={item} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <p className="mt-4 text-sm leading-7 text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="label">Featured products</p>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">A few product shots from the collection</h3>
              </div>
              <p className="text-sm leading-7 text-gray-500">
                Open the full range below. Product cards show the actual imagery and live collection pricing.
              </p>
            </div>

            <div className="mt-8">
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
                <ProductGrid products={featuredProducts} />
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-sm text-gray-500">
                  No products are available right now.
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
            <article className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
              <p className="label">What the portal shows</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">Private partner access</h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-200">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Orders</p>
                  <p className="mt-2 text-3xl font-black text-navy-900">Live</p>
                  <p className="mt-2 text-sm text-gray-600">Club-attributed orders and statuses.</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-200">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Commission</p>
                  <p className="mt-2 text-3xl font-black text-navy-900">Tracked</p>
                  <p className="mt-2 text-sm text-gray-600">Paid, pending and due totals.</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-200 sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Stock</p>
                  <p className="mt-2 text-3xl font-black text-navy-900">Orderable</p>
                  <p className="mt-2 text-sm text-gray-600">Partners can use the same portal to order club stock when needed.</p>
                </div>
              </div>
            </article>

            <article className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
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
            </article>
          </div>
        </div>
      </section>

      <section className="bg-[linear-gradient(135deg,_#1f5c3f_0%,_#0b1437_100%)] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-white/10 bg-white/8 p-8 shadow-2xl shadow-black/10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="label text-white/55">Apply</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
                Ready to put UTC on your club floor?
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/75">
                Send the club name and contact details and we’ll set up the partner record, pricing, access and stock ordering.
              </p>
            </div>
            <a
              href="mailto:partners@upthecreekpadel.club?subject=UTC%20Partner%20Programme"
              className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-bold tracking-wider text-navy-900 transition-colors hover:bg-white/90"
            >
              Apply to become a partner club
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
