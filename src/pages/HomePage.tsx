import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts.js';
import { ProductGrid } from '../components/product/ProductGrid.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { fetchHomepageReviews } from '../lib/api.js';

interface HomepageReview {
  id: string;
  src: string;
  alt: string;
}

function ReviewCarousel({ reviews }: { reviews: HomepageReview[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (reviews.length === 0) return null;
  const active = reviews[activeIndex];

  function move(offset: number) {
    setActiveIndex((index) => (index + offset + reviews.length) % reviews.length);
  }

  return (
    <section aria-label="Customer reviews" className="mt-12">
      <div className="relative mx-auto flex min-h-64 max-w-4xl items-center justify-center overflow-hidden rounded-[1.75rem] border border-navy-800/10 bg-white p-3 shadow-[0_18px_55px_rgba(5,13,31,0.12)] sm:p-6">
        <img
          src={active.src}
          alt={active.alt || 'Customer review'}
          className="max-h-[min(72vh,760px)] w-auto max-w-full object-contain"
        />
        {reviews.length > 1 && (
          <>
            <button type="button" onClick={() => move(-1)} aria-label="Previous review"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-navy-900/80 px-3 py-2 text-xl text-white shadow-lg hover:bg-navy-900">‹</button>
            <button type="button" onClick={() => move(1)} aria-label="Next review"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-navy-900/80 px-3 py-2 text-xl text-white shadow-lg hover:bg-navy-900">›</button>
          </>
        )}
      </div>
      {reviews.length > 1 && (
        <div className="mt-4 flex justify-center gap-2" aria-label="Choose a review">
          {reviews.map((review, index) => (
            <button key={review.id} type="button" onClick={() => setActiveIndex(index)}
              aria-label={`Show review ${index + 1}`} aria-current={index === activeIndex}
              className={`h-2.5 rounded-full transition-all ${index === activeIndex ? 'w-8 bg-navy-800' : 'w-2.5 bg-navy-800/25 hover:bg-navy-800/50'}`} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  const { products, loading, error } = useProducts('storefront');
  const { hash } = useLocation();
  const [reviews, setReviews] = useState<HomepageReview[]>([]);

  useEffect(() => {
    let current = true;
    void fetchHomepageReviews().then((items) => { if (current) setReviews(items); }).catch(() => {});
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (hash === '#collection') {
      const el = document.getElementById('collection');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [hash]);


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
            src="/Wordmark_White.png?v=dfc90b8"
            alt="Up the Creek Padel Apparel"
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

      {/* ── Collection ──────────────────────────────────────────── */}
      <section id="collection" className="scroll-mt-0">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-20 sm:pt-12 sm:pb-28">
          <div className="mb-14 flex justify-center">
            <h2 className="mt-0 flex flex-col items-center gap-1 text-center text-3xl font-black tracking-tight text-navy-800 sm:text-4xl">
              <span className="block">The</span>
              <img
                src="/Wordmark_Black.png"
                alt="Up the Creek"
                className="h-16 w-auto object-contain sm:h-20 lg:h-24"
              />
              <span className="block">Collection</span>
            </h2>
          </div>

          <div>
            {loading ? (
              <PageLoader />
            ) : error ? (
              <ErrorMessage message={error} />
            ) : (
              <ProductGrid products={products} />
            )}
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              to="/collabs"
              className="inline-flex items-center justify-center rounded-[1.5rem] border border-navy-800/15 bg-white px-5 py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-navy-800 transition-colors hover:bg-navy-800 hover:text-white"
            >
              Shop collaborations
            </Link>
          </div>

          <ReviewCarousel reviews={reviews} />

          <div className="mt-4 flex justify-center">
            <Link
              to="/partners"
              className="group flex w-full flex-col items-center justify-center gap-2 rounded-full border border-navy-800/15 bg-white px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.24em] text-navy-800 transition-colors hover:bg-navy-800 hover:text-white"
            >
              <span>Interested in stocking</span>
              <span className="flex w-full items-center justify-center">
                <img
                  src="/Wordmark_Black.png"
                  alt="Up the Creek Padel Apparel"
                  className="h-auto w-[50%] object-contain transition-[filter] group-hover:brightness-0 group-hover:invert"
                />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── UMP1RE Americano CTA ───────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8 sm:pb-14">
        <section
          aria-label="UMP1RE Americano scoring tool"
          className="rounded-[1.75rem] border border-[#24262e]/20 bg-[#dcff00] px-5 py-5 text-center text-[#24262e] shadow-[0_24px_70px_rgba(5,13,31,0.16)] sm:px-8 sm:py-6"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="min-w-0 text-center text-sm font-medium leading-snug sm:text-base">
              <p className="ump1re-americano-font whitespace-nowrap text-[clamp(24px,7.5vw,36px)] leading-tight sm:text-4xl">Running an Americano?</p>
              <p>Try out this free scoring tool from</p>
              <img
                src="https://ump1re-web.pages.dev/assets/logo-black.png"
                alt="UMP1RE"
                className="mx-auto mt-1 h-8 w-auto max-w-[9rem] object-contain sm:h-9 sm:max-w-[10rem]"
              />
            </div>
            <a
              href="https://ump1re-web.pages.dev/americano/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#0a090f] px-6 py-3 text-[#dcff00] transition-transform hover:scale-[1.02] sm:max-w-md"
            >
              <img
                src="https://ump1re-web.pages.dev/assets/icon-192.png"
                alt=""
                width="36"
                height="36"
                className="h-9 w-9"
              />
              <span className="ump1re-americano-font text-2xl leading-none sm:text-3xl">Americano</span>
            </a>
          </div>
        </section>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="bg-navy-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-0">
            <img
              src="/Wordmark_White.png?v=dfc90b8"
              alt="Up the Creek Padel Apparel"
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
              © {new Date().getFullYear()} Up the Creek Padel Apparel. All rights reserved.
            </p>
          </div>
        </div>
      </footer>



    </div>
  );
}
