import { useState, useMemo, memo, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProduct } from '../hooks/useProduct.js';
import { ImageGallery } from '../components/product/ImageGallery.js';
import { ColorSwatch } from '../components/product/ColorSwatch.js';
import { SizeSelector } from '../components/product/SizeSelector.js';
import { Button } from '../components/ui/Button.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';
import { useBasket } from '../context/BasketContext.js';
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
  const [basketMessage, setBasketMessage] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const { addToBasket, itemCount } = useBasket();

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

  // Sticky mini-preview — shown on mobile once the main image has scrolled past.
  // Depends on `product` so the effect re-runs after the loading state resolves
  // and ImageGallery (which holds the sentinel ref) is actually in the DOM.
  const previewTriggerRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    const el = previewTriggerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product]);

  const miniPreviewSrc = useMemo(() => {
    if (!product) return '';
    const colorImages = selectedColor
      ? product.images.filter((img) => img.color === selectedColor)
      : [];
    if (colorImages.length > 0) {
      return colorImages[0]?.src ?? '';
    }
    if (activeVariantIds.length > 0) {
      const match = product.images.find(
        (img) => img.variantIds.length <= 10 && img.variantIds.some((id) => activeVariantIds.includes(id)),
      );
      if (match) return match.src;
    }
    return product.images.find((img) => img.isDefault)?.src ?? product.images[0]?.src ?? '';
  }, [product, activeVariantIds, selectedColor]);

  const unavailableSizes = useMemo(() => {
    if (!product || !selectedColor) return [];
    return product.sizes.filter((size) => !availableSizes.includes(size));
  }, [product, selectedColor, availableSizes]);

  function handleAddToBasket() {
    if (!product || !selectedVariant) return;
    setBasketMessage(null);
    addToBasket({
      printifyId: product.printifyId,
      variantId: selectedVariant.id,
      quantity,
      title: product.title,
      color: selectedVariant.color,
      size: selectedVariant.size,
      unitPrice: selectedVariant.price,
      imageSrc: miniPreviewSrc,
    });
    setBasketMessage(`Added ${quantity} to basket.`);
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
    <div id="top" className="min-h-screen bg-cream">

      {/* ── Header — integrates mini-preview on scroll (mobile) ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3">

            {/* Logo — sm+ only */}
            <Link to="/" className="hidden sm:flex items-center">
              <img
                src="/UTC-Wear-White.png"
                alt="Up the Creek Padel"
                className="h-9 w-auto object-contain"
              />
            </Link>

            {/* Mini-preview — mobile only, fades in once image scrolls past */}
            <div
              className={`lg:hidden flex flex-1 items-center gap-2.5 overflow-hidden transition-opacity duration-300 ${
                stickyVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {miniPreviewSrc && (
                <img
                  src={miniPreviewSrc}
                  alt={product.title}
                  className="h-10 w-[30px] flex-shrink-0 rounded-lg object-cover object-top"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-navy-800 leading-tight">{product.title}</p>
                <p className="text-xs font-semibold text-gray-500">{displayPrice}</p>
              </div>
            </div>

            {/* Back link — always visible, pushed right */}
            <Link
              to="/#collection"
              className="ml-auto flex-shrink-0 text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-navy-800 transition-colors"
            >
              ← Back to shop
            </Link>

          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 lg:py-16">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_440px] xl:grid-cols-[minmax(0,1.15fr)_480px] lg:gap-12 xl:gap-16">

          {/* gallery — sticky on desktop */}
          <div className="mb-10 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <ImageGallery
                images={product.images}
                activeVariantIds={activeVariantIds}
                selectedColor={selectedColor}
                previewTriggerRef={previewTriggerRef}
                title={product.title}
              />
            </div>
          </div>

          {/* product details */}
          <div className="space-y-5 sm:space-y-6 lg:pt-2">

            {/* title + price */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-navy-800 tracking-tight leading-tight max-w-[11ch]">
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
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Size</span>
                {product.sizeGuideImage && (
                  <button
                    onClick={() => setSizeGuideOpen(true)}
                    className="text-xs font-semibold text-navy-800 underline underline-offset-2 hover:text-brand-500 transition-colors"
                  >
                    Size guide
                  </button>
                )}
              </div>
              <SizeSelector
                sizes={product.sizes}
                selected={selectedSize}
                onSelect={setSelectedSize}
                unavailable={unavailableSizes}
                hideLabel
              />
            </div>

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

            {basketMessage && (
              <p className="text-sm font-semibold text-emerald-600">{basketMessage}</p>
            )}

            {/* CTA */}
            <Button
              size="lg"
              onClick={handleAddToBasket}
              disabled={!canBuy}
              className="w-full uppercase text-sm tracking-widest"
            >
              Add to basket
            </Button>

            <Link
              to="/checkout"
              className="block text-center text-sm font-bold uppercase tracking-widest text-navy-800 hover:text-brand-500 transition-colors"
            >
              View basket{itemCount > 0 ? ` (${itemCount})` : ''}
            </Link>

            {/* trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-2 lg:pt-4">
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
              <div className="border-t border-gray-100 pt-7 lg:pt-8">
                <p className="label mb-3">About this product</p>
                <ProductDescription html={product.description} />
              </div>
            )}

          </div>
        </div>
      </main>

      {/* ── Size guide modal ────────────────────────────────────── */}
      {sizeGuideOpen && product.sizeGuideImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-900/70 p-4 backdrop-blur-sm"
          onClick={() => setSizeGuideOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full rounded-3xl bg-white overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-black text-navy-800 uppercase tracking-widest">Size Guide</p>
              <button
                onClick={() => setSizeGuideOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-navy-800 transition-colors"
                aria-label="Close size guide"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <img
                src={product.sizeGuideImage}
                alt="Size guide"
                className="w-full object-contain max-h-[70vh]"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="mt-16 bg-navy-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <img
              src="/UTC-Wear-White.png"
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
