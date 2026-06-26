import { useState, useMemo, memo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProduct } from '../hooks/useProduct.js';
import { ImageGallery } from '../components/product/ImageGallery.js';
import { ColorSwatch } from '../components/product/ColorSwatch.js';
import { SizeSelector } from '../components/product/SizeSelector.js';
import { Button } from '../components/ui/Button.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { createCheckout } from '../lib/api.js';
import { formatPrice } from '../lib/utils.js';
import type { PrintifyVariant } from '../../types/index.js';

function cleanDescription(html: string): string {
  return html
    .replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
    .replace(/(<br\s*\/?>\s*){2,}/gi, '<br />')
    .trim();
}

const ProductDescription = memo(function ProductDescription({ html }: { html: string }) {
  const clean = cleanDescription(html);
  if (!clean) return null;

  const isHtml = /<[a-z][\s\S]*>/i.test(clean);

  if (isHtml) {
    return (
      <div
        className="description-body text-sm leading-relaxed text-gray-500"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-500">
      {clean.split(/\n\n+/).map((para, i) => (
        <p key={i}>{para.replace(/\n/g, ' ')}</p>
      ))}
    </div>
  );
});

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { product, loading, error } = useProduct(id);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize,  setSelectedSize]  = useState<string | null>(null);
  const [quantity,      setQuantity]      = useState(1);
  const [buying,        setBuying]        = useState(false);
  const [buyError,      setBuyError]      = useState<string | null>(null);

  const availableVariants = useMemo<PrintifyVariant[]>(() => {
    if (!product) return [];
    return product.variants.filter((v) =>
      (!selectedColor || v.color === selectedColor) && v.available,
    );
  }, [product, selectedColor]);

  const availableSizes = useMemo(
    () => Array.from(new Set(availableVariants.map((v) => v.size))),
    [availableVariants],
  );

  const selectedVariant = useMemo(() => {
    if (!product || !selectedColor || !selectedSize) return null;
    return product.variants.find(
      (v) => v.color === selectedColor && v.size === selectedSize && v.available,
    ) ?? null;
  }, [product, selectedColor, selectedSize]);

  const activeVariantIds = useMemo(() => {
    if (!product || !selectedColor) return [];
    return product.variants.filter((v) => v.color === selectedColor).map((v) => v.id);
  }, [product, selectedColor]);

  // Sticky mini-preview — shown on mobile once the gallery scrolls out of view
  const galleryRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const miniPreviewSrc = useMemo(() => {
    if (!product) return '';
    if (activeVariantIds.length > 0) {
      const match = product.images.find(
        (img) => img.variantIds.length <= 10 && img.variantIds.some((id) => activeVariantIds.includes(id)),
      );
      if (match) return match.src;
    }
    return product.images.find((img) => img.isDefault)?.src ?? product.images[0]?.src ?? '';
  }, [product, activeVariantIds]);

  const unavailableSizes = useMemo(() => {
    if (!product || !selectedColor) return [];
    return product.sizes.filter((size) => !availableSizes.includes(size));
  }, [product, selectedColor, availableSizes]);

  async function handleBuyNow() {
    if (!product || !selectedVariant) return;
    setBuyError(null);
    setBuying(true);
    try {
      const { url } = await createCheckout([
        { printifyId: product.printifyId, variantId: selectedVariant.id, quantity },
      ]);
      window.location.href = url;
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setBuying(false);
    }
  }

  if (loading) return <PageLoader />;
  if (error || !product) {
    return <ErrorMessage message={error ?? 'Product not found'} />;
  }

  const displayPrice = selectedVariant
    ? formatPrice(selectedVariant.price)
    : formatPrice(product.minPrice);

  const canBuy = !!selectedVariant && quantity >= 1;

  const needsColour = !selectedColor;
  const needsSize   = selectedColor && !selectedSize;

  return (
    <div className="min-h-screen bg-cream">

      {/* ── Header ──────────────────────────────────────────────── */}
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
            <Link
              to="/"
              className="text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-navy-800 transition-colors"
            >
              ← Back to shop
            </Link>
          </div>
        </div>
      </header>

      {/* ── Sticky mini-preview — mobile only ───────────────────── */}
      <div
        className={`lg:hidden fixed top-16 left-0 right-0 z-40 bg-white border-b border-gray-100 shadow-md transition-transform duration-300 ${
          stickyVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          {miniPreviewSrc && (
            <img
              src={miniPreviewSrc}
              alt={product.title}
              className="h-14 w-[42px] flex-shrink-0 rounded-md object-cover object-top"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-navy-800">{product.title}</p>
            <p className="text-sm font-semibold text-navy-800">{displayPrice}</p>
          </div>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 lg:py-16">
        <div className="lg:grid lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px] lg:gap-16 xl:gap-24">

          {/* gallery — sticky on desktop */}
          <div ref={galleryRef} className="mb-10 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <ImageGallery
                images={product.images}
                activeVariantIds={activeVariantIds}
                title={product.title}
              />
            </div>
          </div>

          {/* product details */}
          <div className="space-y-4 sm:space-y-8">

            {/* title + price */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-navy-800 tracking-tight leading-tight">
                {product.title}
              </h1>
              <p className="text-2xl font-black text-navy-800 mt-2">
                {!selectedVariant && product.minPrice !== product.maxPrice && (
                  <span className="text-sm font-semibold text-gray-400 mr-2">from</span>
                )}
                {displayPrice}
              </p>
            </div>

            {/* divider — desktop only; on mobile the tighter space-y is enough */}
            <div className="hidden sm:block h-px bg-gray-100" />

            {/* colour */}
            <ColorSwatch
              colors={product.colors}
              selected={selectedColor}
              onSelect={(color) => {
                setSelectedColor(color);
                setSelectedSize(null);
              }}
            />

            {/* size */}
            <SizeSelector
              sizes={product.sizes}
              selected={selectedSize}
              onSelect={setSelectedSize}
              unavailable={unavailableSizes}
            />

            {/* quantity */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Quantity
              </span>
              <div className="inline-flex items-center rounded-full border-2 border-gray-200 overflow-hidden">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 hover:text-navy-800 transition-colors"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-black text-navy-800">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  className="flex h-11 w-11 items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 hover:text-navy-800 transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* selection prompts */}
            {needsColour && (
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Select a colour to continue
              </p>
            )}
            {needsSize && (
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Select a size to continue
              </p>
            )}

            {buyError && (
              <p className="text-sm font-semibold text-red-600">{buyError}</p>
            )}

            {/* CTA */}
            <Button
              size="lg"
              onClick={handleBuyNow}
              disabled={!canBuy}
              loading={buying}
              className="w-full uppercase text-sm tracking-widest"
            >
              {buying ? 'Redirecting to checkout…' : 'Buy Now'}
            </Button>

            {/* trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="trust-badge flex-col items-center text-center gap-1.5">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span>5–10 day delivery</span>
              </div>
              <div className="trust-badge flex-col items-center text-center gap-1.5">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                <span>Worldwide shipping</span>
              </div>
              <div className="trust-badge flex-col items-center text-center gap-1.5">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Secure checkout</span>
              </div>
            </div>

            {/* description */}
            {product.description && (
              <div className="border-t border-gray-100 pt-8">
                <p className="label mb-3">About this product</p>
                <ProductDescription html={product.description} />
              </div>
            )}

          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="mt-16 bg-navy-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <img
              src="/UTC_WordMark_White_Trans_BG.png"
              alt="Up the Creek Padel"
              className="h-8 w-auto opacity-60"
            />
            <p className="text-[11px] text-white/20">
              © {new Date().getFullYear()} Up the Creek Padel &amp; Social Club
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
