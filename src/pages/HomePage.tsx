import { useProducts } from '../hooks/useProducts.js';
import { ProductGrid } from '../components/product/ProductGrid.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';

export default function HomePage() {
  const { products, loading, error } = useProducts();

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
            src="/UTC-Wear-White.png"
            alt="Up the Creek Padel"
            className="w-full h-auto"
          />
          <p className="mt-[50px] text-sm sm:text-base text-white/85 tracking-wide leading-relaxed max-w-md px-4">
            Original T-shirts for life inside and outside the glass.
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

      {/* ── Collection ──────────────────────────────────────────── */}
      <section id="collection" className="scroll-mt-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-20 sm:pt-12 sm:pb-28">

          <div className="flex justify-center mb-14">
            <h2 className="mt-0 flex flex-col items-center gap-1 sm:gap-2 text-3xl sm:text-4xl font-black font-sans text-navy-800 tracking-tight text-center">
              <span className="block">The</span>
              <img
                src="/Up The Creek_Wordmark.png"
                alt="Up the Creek"
                className="h-24 sm:h-32 w-auto object-contain"
              />
              <span className="block">Collection</span>
            </h2>
          </div>

          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorMessage message={error} />
          ) : (
            <ProductGrid products={products} />
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-navy-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-0">
            <img
              src="/UTC-Wear-White.png"
              alt="Up the Creek Padel"
              className="h-40 w-auto opacity-70"
            />
            </div>
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
