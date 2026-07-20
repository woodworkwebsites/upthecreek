import { NavLink } from 'react-router-dom';

const highlights = [
  {
    title: 'Live order visibility',
    body: 'See which shirts sold through your club, when they shipped, and what is still in motion.',
  },
  {
    title: 'Commission tracking',
    body: 'Follow gross sales, discounts, and commission due from one place without waiting on spreadsheets.',
  },
  {
    title: 'Club-ready updates',
    body: 'Share a clean partner dashboard with coaches, captains, and committee members who need it.',
  },
];

const steps = [
  'We create a unique club code and partner access token.',
  'Players order shirts through the main UTC store using the club code.',
  'Your portal shows sales, commission due, and recent order status.',
];

export default function PartnersFunnelPage() {
  return (
    <div className="min-h-screen bg-cream text-navy-900">
      <section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(43,77,164,0.34),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_30%),linear-gradient(180deg,_#050D1F_0%,_#0B1437_58%,_#F8F7F3_58%,_#F8F7F3_100%)] text-white">
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <img src="/UTC_WordMark_White_Trans_BG.png" alt="Up the Creek Padel" className="h-12 w-auto" />
            <NavLink to="/partners/login" className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70 hover:text-white">
              Partner login
            </NavLink>
          </div>

          <div className="grid gap-14 pt-20 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div className="max-w-3xl animate-fade-up">
              <p className="label text-white/60">Partners</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-7xl">
                A private portal for clubs selling UTC shirts.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/78 sm:text-lg">
                Give every club a simple place to track orders, commission, and fulfilment progress without exposing the admin side of the business.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
              <NavLink
                to="/partners/login"
                className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-bold tracking-wider text-navy-900 transition-colors hover:bg-white/90"
              >
                Open partner portal
              </NavLink>
                <a
                  href="mailto:hello@upthecreekpadel.club?subject=UTC%20Partner%20Access"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-3 text-sm font-bold tracking-wider text-white hover:bg-white/10 transition-colors"
                >
                  Request access
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/8 p-6 backdrop-blur-xl shadow-2xl shadow-black/20">
              <div className="rounded-[1.5rem] border border-white/10 bg-navy-900/60 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-white/50">Built for</p>
                <div className="mt-4 space-y-4 text-sm text-white/85">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-brand-300" />
                    <p>Club captains who need a quick view of what has sold.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-brand-300" />
                    <p>Tournament organisers who want commission tracked per event drop.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-brand-300" />
                    <p>Partners who want a clean, mobile-friendly dashboard they can trust.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="-mt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid gap-6 md:grid-cols-3">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-[0_20px_70px_rgba(5,13,31,0.06)]">
                <h2 className="text-lg font-black text-navy-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-600">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-[2rem] border border-gray-200 bg-navy-900 p-8 text-white shadow-[0_25px_80px_rgba(5,13,31,0.12)]">
              <p className="label text-white/55">How it works</p>
              <ol className="mt-6 space-y-4">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8 text-sm font-black">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm leading-7 text-white/82">{step}</p>
                  </li>
                ))}
              </ol>
            </article>

            <article className="rounded-[2rem] border border-gray-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f7f8fb_100%)] p-8 shadow-[0_25px_80px_rgba(5,13,31,0.08)]">
              <p className="label">What the portal shows</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">Orders</p>
                  <p className="mt-3 text-3xl font-black text-navy-900">Live</p>
                  <p className="mt-2 text-sm text-gray-600">See the latest orders linked to your club code.</p>
                </div>
                <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">Commission</p>
                  <p className="mt-3 text-3xl font-black text-navy-900">Tracked</p>
                  <p className="mt-2 text-sm text-gray-600">Keep a running total of commission earned and pending.</p>
                </div>
                <div className="rounded-2xl bg-white p-5 ring-1 ring-gray-200 sm:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-400">Access</p>
                  <p className="mt-3 text-3xl font-black text-navy-900">Private</p>
                  <p className="mt-2 text-sm text-gray-600">Each club gets its own login and only sees its own sales.</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
