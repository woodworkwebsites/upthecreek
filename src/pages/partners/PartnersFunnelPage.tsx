import { NavLink } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';

const metrics = [
  { label: 'Member discount', value: '10%' },
  { label: 'Referral commission', value: '10%' },
  { label: 'Delivery', value: 'Free' },
  { label: 'Partner pricing', value: 'Wholesale' },
];

const flow = [
  {
    title: 'Club code',
    body: 'Each partner gets one unique code tied to their club.',
  },
  {
    title: 'Member order',
    body: 'Members shop the UTC range online and apply the code.',
  },
  {
    title: 'Auto track',
    body: 'Commission is attributed automatically against the order.',
  },
  {
    title: 'Dashboard',
    body: 'The portal shows orders, totals, and commission due.',
  },
];

const streams = [
  {
    title: 'In-club retail',
    badge: 'Margin',
    body: 'Stock a curated shelf range at partner pricing and keep the retail margin in the clubhouse.',
    bullets: [
      'Low-SKU opening range',
      'Branded display rail and hangers',
      'Restock as needed',
    ],
  },
  {
    title: 'Online member benefit',
    badge: 'Commission',
    body: 'Members use the club code online for 10% off and the club earns tracked commission on every sale.',
    bullets: [
      'Full UTC collection online',
      'No stock risk for the club',
      'Commission visible in the portal',
    ],
  },
];

const whyCards = [
  {
    title: 'Your club',
    icon: 'C',
    bullets: [
      'Retail margin on shelf stock',
      'Recurring online commission',
      'A clear member perk',
    ],
  },
  {
    title: 'Your members',
    icon: 'M',
    bullets: [
      'Exclusive club pricing',
      'Free UK delivery',
      'The full UTC range',
    ],
  },
  {
    title: 'UTC',
    icon: 'U',
    bullets: [
      'Trusted club-led distribution',
      'Central fulfilment and support',
      'Simple reporting for partners',
    ],
  },
];

const steps = [
  {
    title: 'Apply',
    body: 'Send the club name, contact and rough member numbers.',
  },
  {
    title: 'Agree terms',
    body: 'We confirm pricing, discount code, and access details.',
  },
  {
    title: 'Go live',
    body: 'Members get the code and the portal starts tracking orders.',
  },
  {
    title: 'Review',
    body: 'Use the dashboard to track commission and sales performance.',
  },
];

const faqs = [
  {
    q: 'How is commission calculated?',
    a: 'Commission is tracked against orders placed with the club code. The partner dashboard shows totals and recent orders so you can reconcile quickly.',
  },
  {
    q: 'Do we need to hold stock for online sales?',
    a: 'No. Online sales are fulfilled centrally by UTC, so clubs only manage any shelf stock they choose to keep in the clubhouse.',
  },
  {
    q: 'Can we choose our own code?',
    a: 'Yes, within reason. We normalise and assign the code when the partner record is created.',
  },
  {
    q: 'Can members access the full range?',
    a: 'Yes. The online discount code applies to the UTC collection, not just a limited club range.',
  },
  {
    q: 'How do we get started?',
    a: 'Use the apply email button on this page and we will set up the club record, code and portal access.',
  },
];

export default function PartnersFunnelPage() {
  return (
    <div className="min-h-screen bg-cream text-navy-900">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(43,77,164,0.30),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_28%),linear-gradient(180deg,_#050D1F_0%,_#0B1437_56%,_#F8F7F3_56%,_#F8F7F3_100%)] text-white">
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <img src="/UTC_WordMark_White_Trans_BG.png" alt="Up the Creek Padel" className="h-12 w-auto" />
            <NavLink
              to="/partners/login"
              className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70 transition-colors hover:text-white"
            >
              Partner login
            </NavLink>
          </div>

          <div className="grid gap-14 pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="max-w-3xl animate-fade-up">
              <p className="label text-white/60">Club Partnership Programme</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
                Turn club apparel into recurring revenue.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/78 sm:text-lg">
                Partner clubs stock a small retail range in-house and share a club code with members for the full UTC collection online. No stock risk for online orders, no admin noise, and a clean dashboard for commission tracking.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button asChild={false} className="bg-white text-navy-900 hover:bg-white/90">
                  <NavLink to="/partners/login">Open partner portal</NavLink>
                </Button>
                <a
                  href="mailto:partners@upthecreekpadel.club?subject=UTC%20Partner%20Programme"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3 text-sm font-bold tracking-wider text-white transition-colors hover:bg-white/10"
                >
                  Apply to partner
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-white/10 bg-navy-900/60 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/50">At a glance</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {metrics.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">{item.label}</p>
                      <p className="mt-2 text-xl font-black text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="-mt-10">
        <div className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {flow.map((item, index) => (
              <div key={item.title} className="relative">
                <article className="h-full rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-[0_20px_70px_rgba(5,13,31,0.06)]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-black text-white">
                      {index + 1}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-500">Step</span>
                  </div>
                  <h2 className="mt-6 text-lg font-black text-navy-900">{item.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-gray-600">{item.body}</p>
                </article>
                {index < flow.length - 1 && (
                  <div
                    aria-hidden
                    className="absolute right-[-14px] top-1/2 hidden h-0.5 w-7 -translate-y-1/2 bg-gradient-to-r from-brand-400 to-brand-500 xl:block"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            {streams.map((item) => (
              <article
                key={item.title}
                className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]"
              >
                <p className="label">{item.badge}</p>
                <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-gray-600">{item.body}</p>
                <ul className="mt-6 space-y-3">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {whyCards.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.75rem] border border-gray-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f7f8fb_100%)] p-6 shadow-[0_20px_70px_rgba(5,13,31,0.06)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-black text-white">
                  {item.icon}
                </div>
                <h3 className="mt-5 text-lg font-black text-navy-900">{item.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[2rem] border border-navy-900 bg-navy-900 p-8 text-white shadow-[0_25px_80px_rgba(5,13,31,0.12)]">
              <p className="label text-white/55">Getting started</p>
              <ol className="mt-6 space-y-4">
                {steps.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 text-sm font-black">
                      {index + 1}
                    </span>
                    <div className="pt-1">
                      <p className="text-sm font-bold text-white">{step.title}</p>
                      <p className="mt-1 text-sm leading-7 text-white/82">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>

            <article className="rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
              <p className="label">Portal view</p>
              <h3 className="mt-3 text-2xl font-black tracking-tight text-navy-900">What the partner dashboard shows</h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-200">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Orders</p>
                  <p className="mt-2 text-3xl font-black text-navy-900">Live</p>
                  <p className="mt-2 text-sm text-gray-600">Recent club-attributed orders at a glance.</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-200">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Commission</p>
                  <p className="mt-2 text-3xl font-black text-navy-900">Tracked</p>
                  <p className="mt-2 text-sm text-gray-600">Totals due, pending, and paid.</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-5 ring-1 ring-gray-200 sm:col-span-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Access</p>
                  <p className="mt-2 text-3xl font-black text-navy-900">Private</p>
                  <p className="mt-2 text-sm text-gray-600">Club login only, with access scoped to that partner.</p>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-8 rounded-[2rem] border border-gray-200 bg-white p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
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
        </div>
      </section>

      <section className="bg-[linear-gradient(135deg,_#1f5c3f_0%,_#0b1437_100%)] py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-white/10 bg-white/8 p-8 shadow-2xl shadow-black/10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="label text-white/55">Apply</p>
              <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
                Ready to add UTC apparel to your club?
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/75">
                Send the club name and contact details and we’ll set up the partner record, code, pricing, and portal access.
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
