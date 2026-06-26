import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts.js';
import { ProductGrid } from '../components/product/ProductGrid.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';

export default function HomePage() {
  const { products, loading, error } = useProducts();
  const [search, setSearch] = useState('');

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Sticky header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center">
              <img
                src="/Up The Creek_Blue_Wordmark.svg"
                alt="Up the Creek Padel"
                className="h-9 w-auto object-contain"
              />
            </Link>
            <a
              href="#collection"
              className="text-xs font-bold tracking-widest uppercase text-navy-800 hover:text-brand-500 transition-colors"
            >
              Shop
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative bg-navy-800 min-h-[92vh] flex flex-col items-center justify-center text-center overflow-hidden px-4">

        {/* dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* corner brackets */}
        <div className="absolute inset-6 pointer-events-none hidden sm:block">
          <div className="absolute top-0 left-0 w-12 h-12 border-l-2 border-t-2 border-white/10" />
          <div className="absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2 border-white/10" />
          <div className="absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2 border-white/10" />
          <div className="absolute bottom-0 right-0 w-12 h-12 border-r-2 border-b-2 border-white/10" />
        </div>

        {/* content */}
        <div className="relative flex flex-col items-center gap-6 max-w-3xl animate-fade-up">

          {/* wordmark */}
          <img
            src="/UTC_WordMark_White_Trans_BG.png"
            alt="Up the Creek Padel"
            className="h-140 sm:h-120 w-auto mx-auto"
          />

          {/* headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] font-black text-white leading-[0.92] tracking-tight">
            Padel Gear with something to say
          </h1>

          <p className="text-base sm:text-lg text-white/55 max-w-md leading-relaxed">
            Original T-shirts for players who understand the game, the culture and the chaos that comes with both.
          </p>

        </div>

        {/* scroll cue — animated chevron pointing down */}
        <a
          href="#collection"
          aria-label="Scroll to collection"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
        >
          <span className="text-[10px] tracking-widest uppercase font-bold">Explore</span>
          <svg
            className="h-6 w-6 animate-bounce"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </a>
      </section>

      {/* ── Collection ──────────────────────────────────────────── */}
      <section id="collection" className="scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-14">
            <div>
              <p className="label mb-2">The Range</p>
              <h2 className="text-3xl sm:text-4xl font-black text-navy-800 tracking-tight">
                The Collection
              </h2>
            </div>
            {products.length > 4 && (
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full sm:w-64 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-navy-800 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition shadow-sm"
              />
            )}
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorMessage message={error} />
          ) : (
            <ProductGrid products={filtered} />
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-navy-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col items-center gap-6 text-center">
            <img
              src="/UTC_WordMark_White_Trans_BG.png"
              alt="Up the Creek Padel"
              className="h-40 w-auto opacity-70"
            />
            <p className="text-sm text-white/40 max-w-sm leading-relaxed">
              Premium padel apparel. <br />Designed for the court, worn everywhere.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold uppercase tracking-widest text-white/25">
              <span>Worldwide shipping</span>
              <span className="text-white/15">·</span>
              <span>Secure checkout</span>
              <span className="text-white/15">·</span>
              <span>5–10 day delivery</span>
            </div>
            <p className="text-[11px] text-white/15 mt-2">
              © {new Date().getFullYear()} Up the Creek Padel &amp; Social Club. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
