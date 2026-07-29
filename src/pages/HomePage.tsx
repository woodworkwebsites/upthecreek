import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts.js';
import { ProductGrid } from '../components/product/ProductGrid.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { subscribeNewsletter } from '../lib/api.js';

export default function HomePage() {
  const { products, loading, error } = useProducts('storefront');
  const { hash } = useLocation();
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterError, setNewsletterError] = useState<string | null>(null);
  const [newsletterSuccess, setNewsletterSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (hash === '#collection') {
      const el = document.getElementById('collection');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hash]);

  useEffect(() => {
    if (!newsletterOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setNewsletterOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [newsletterOpen]);

  async function handleNewsletterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!email) {
      setNewsletterError('Enter your email address');
      return;
    }

    setNewsletterSubmitting(true);
    setNewsletterError(null);
    setNewsletterSuccess(null);

    try {
      const result = await subscribeNewsletter({ email, source: 'homepage-modal' });
      setNewsletterSuccess(
        result.alreadySubscribed
          ? 'You’re already on the list.'
          : 'You’re on the list. We’ll send offers and new drop updates.',
      );
      setNewsletterEmail('');
    } catch (err) {
      setNewsletterError(err instanceof Error ? err.message : 'Could not save your signup');
    } finally {
      setNewsletterSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative bg-navy-900 min-h-screen flex flex-col items-center justify-center text-center overflow-hidden">

        {/* background video — object-top keeps the top of the shot in frame */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover object-top"
          src="/UTCBGVid (1).mp4"
        />

        {/* dark overlay */}
        <div className="absolute inset-0 bg-navy-900/65" />

        {/* corner brackets */}
        <div className="absolute inset-6 pointer-events-none hidden sm:block">
          <div className="absolute top-0 left-0 w-12 h-12 border-l-2 border-t-2 border-white/10" />
          <div className="absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2 border-white/10" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2 border-white/10" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-r-2 border-b-2 border-white/10" />
        </div>

        {/* content — logo + single line of copy only */}
        <div className="relative flex flex-col items-center gap-0 w-full animate-fade-up">
          <img
            src="/UTC-Apparel-White.png"
            alt="Up the Creek Padel"
            className="w-[min(88vw,820px)] max-h-[32vh] h-auto object-contain"
          />
          <p className="mt-[50px] whitespace-nowrap text-xs sm:text-base text-white/85 tracking-wide leading-relaxed px-4">
            Original designs for life inside and outside the glass.
          </p>
        </div>

        {/* scroll cue */}
        <a
          href="#collection"
          aria-label="Scroll to collection"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
        >
          <span className="text-[10px] tracking-widest uppercase font-bold">Explore</span>
          <svg className="h-6 w-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          </a>
      </section>

      {/* ── Newsletter CTA ─────────────────────────────────────── */}
      <section className="relative z-10 -mt-10 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/20 bg-[linear-gradient(135deg,_#0b1437_0%,_#132552_52%,_#1e3a8a_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(5,13,31,0.22)] sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45">Drop list</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Get offers and first access to new drops.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-white/75">
                Join the email list for launch notices, limited releases, and occasional offers from Up the Creek.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setNewsletterOpen(true)}
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.24em] text-navy-900 transition-transform hover:scale-[1.02]"
              >
                Sign up for emails
              </button>
              <a
                href="#collection"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3 text-xs font-bold uppercase tracking-[0.24em] text-white transition-colors hover:bg-white/10"
              >
                View collection
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Collection ──────────────────────────────────────────── */}
      <section id="collection" className="scroll-mt-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-20 sm:pt-12 sm:pb-28">

          <div className="mb-14 flex justify-center">
            <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-end lg:gap-8">
              <h2 className="mt-0 flex flex-col items-center gap-1 sm:gap-2 text-3xl sm:text-4xl font-black font-sans text-navy-800 tracking-tight text-center">
                <span className="block">The</span>
                <img
                  src="/Up The Creek_Wordmark.png"
                  alt="Up the Creek"
                  className="h-16 w-auto object-contain sm:h-20 lg:h-24"
                />
                <span className="block">Collection</span>
              </h2>
            </div>
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorMessage message={error} />
          ) : (
            <ProductGrid products={products} />
          )}

          <div className="mt-12 flex justify-center">
            <Link
              to="/partners"
              className="inline-flex items-center justify-center rounded-full border-2 border-navy-800 px-6 py-3 text-xs font-bold uppercase tracking-[0.24em] text-navy-800 transition-colors hover:bg-navy-800 hover:text-white"
            >
              Interested in stocking UTC Apparel?
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-navy-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-0">
            <img
              src="/UTC-Apparel-White.png"
              alt="Up the Creek Padel"
              className="h-28 w-auto opacity-70 sm:h-32"
            />
            </div>
            <p className="text-sm text-white/40 max-w-sm leading-relaxed">
              Premium padel apparel. <br />Designed for the court, worn everywhere.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold uppercase tracking-widest text-white/25">
              <span>Secure checkout</span>
            </div>
            <a href="mailto:hello@upthecreekpadel.club" className="text-[11px] text-white/40 hover:text-white/70">
              hello@upthecreekpadel.club
            </a>
            <p className="text-[11px] text-white/15 mt-2">
              © {new Date().getFullYear()} Up the Creek Padel &amp; Social Club. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {newsletterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setNewsletterOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Email signup"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Drop list</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-navy-900">
                  Sign up for offers and updates
                </h2>
                <p className="mt-2 text-sm leading-7 text-gray-500">
                  We’ll only use this for UTC drops, offers, and club updates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewsletterOpen(false)}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleNewsletterSubmit} className="mt-6 space-y-4">
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Email address</span>
                <input
                  type="email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-navy-900 outline-none transition-colors placeholder:text-gray-400 focus:border-navy-800"
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={newsletterSubmitting}
                  className="inline-flex items-center justify-center rounded-full bg-navy-900 px-6 py-3 text-xs font-bold uppercase tracking-[0.24em] text-white transition-colors hover:bg-navy-800 disabled:opacity-50"
                >
                  {newsletterSubmitting ? 'Signing up…' : 'Join the list'}
                </button>
                <p className="text-xs leading-6 text-gray-400">
                  Unsubscribe anytime by replying to any email.
                </p>
              </div>

              {newsletterError && <p className="text-sm text-red-600">{newsletterError}</p>}
              {newsletterSuccess && <p className="text-sm text-emerald-600">{newsletterSuccess}</p>}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
