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
    <div className="space-y-3 text-sm leading-relaxed text-gray-500 whitespace-pre-line">
      {clean.split(/\n\n+/).map((para, i) => (
        <p key={i}>{para}</p>
      ))}
    </div>
  );
});

interface ProductPageProps {
  channel?: 'storefront' | 'partner' | 'collabs';
  backHref?: string;
  backLabel?: string;
}

export default function ProductPage({
  channel = 'storefront',
  backHref = '/#collection',
  backLabel = 'Back to shop',
}: ProductPageProps) {
  const { id } = useParams<{ id: string }>();
  const productId = id ? decodeURIComponent(id) : undefined;
  const { product, loading, error } = useProduct(productId, channel);

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize,  setSelectedSize]  = useState<string | null>(null);
  const [quantity,      setQuantity]      = useState(1);
  const [personalization, setPersonalization] = useState('');
  const [basketMessage, setBasketMessage] = useState<string | null>(null);
  const [basketOptionsOpen, setBasketOptionsOpen] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const { addToBasket, itemCount } = useBasket();
  const displayColors = product
    ? product.colors.filter((color, index, list) => {
        if (product.hiddenColors.includes(color.name)) return false;
        return index === list.findIndex((entry) => entry.name === color.name);
      })
    : [];

  const availableVariants = useMemo<PrintifyVariant[]>(() => {
    if (!product) return [];
    return product.variants.filter((v) =>
      (!selectedColor || v.color === selectedColor) && v.available,
    );
  }, [product, selectedColor]);

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

  useEffect(() => {
    setPersonalization('');
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;

    const colorIsValid = selectedColor && displayColors.some((color) => color.name === selectedColor);
    const sizeIsValid = selectedSize && product.sizes.includes(selectedSize);

    if (displayColors.length > 0 && !colorIsValid) {
      setSelectedColor(displayColors[0].name);
      return;
    }

    if (product.sizes.length > 0 && !sizeIsValid) {
      setSelectedSize(product.sizes[0]);
    }
  }, [product, displayColors, selectedColor, selectedSize]);

  // Sticky mini-preview — shown on mobile once the hero image reaches the header.
  const previewTriggerRef = useRef<HTMLDivElement>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  useEffect(() => {
    const updateVisibility = () => {
      const el = previewTriggerRef.current;
      const isMobile = window.matchMedia('(max-width: 1023px)').matches;
      setStickyVisible(Boolean(isMobile && el && el.getBoundingClientRect().top <= 64));
    };

    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    window.addEventListener('resize', updateVisibility);
    return () => {
      window.removeEventListener('scroll', updateVisibility);
      window.removeEventListener('resize', updateVisibility);
    };
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

  function openBasketOptions() {
    setBasketMessage(null);
    setBasketOptionsOpen(true);
  }

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
      personalization: product.personalizationEnabled ? personalization.trim() : '',
    });
    setBasketMessage(`Added ${quantity} to basket.`);
    setBasketOptionsOpen(false);
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

            {/* Header identity swaps from the brand mark to the product preview on scroll. */}
            <div className="grid min-w-0 flex-1 items-center">
              <Link
                to="/"
                aria-hidden={stickyVisible}
                tabIndex={stickyVisible ? -1 : 0}
                className={`col-start-1 row-start-1 flex h-full min-w-0 w-full items-center transition-opacity duration-300 ${
                  stickyVisible ? 'pointer-events-none opacity-0' : 'opacity-100'
                }`}
              >
                <img
                  src="/UTC-Apparel-Black.png"
                  alt="Up the Creek Padel"
                  className="h-7 w-auto max-w-[8rem] object-contain"
                />
              </Link>

              <div
                aria-hidden={!stickyVisible}
                className={`col-start-1 row-start-1 flex h-full min-w-0 w-full items-center gap-2.5 overflow-hidden transition-opacity duration-300 ${
                  stickyVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                {miniPreviewSrc && (
                  <img
                    src={miniPreviewSrc}
                    alt=""
                    className="h-10 w-[30px] flex-shrink-0 rounded-lg object-cover object-top"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-navy-800 leading-tight">{product.title}</p>
                  <p className="text-xs font-semibold text-gray-500">{displayPrice}</p>
                </div>
              </div>
            </div>

            {/* Back link — always visible, pushed right */}
            <Link
              to={backHref}
              className="ml-auto flex-shrink-0 text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-navy-800 transition-colors"
            >
              ← {backLabel}
            </Link>

          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 lg:py-16">
        <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_440px] xl:grid-cols-[minmax(0,1.15fr)_480px] lg:gap-12 xl:gap-16">

          {/* gallery — sticky on desktop */}
          <div className="mb-3 lg:mb-0">
            <div className="lg:sticky lg:top-24">
              <ImageGallery
                images={product.images}
                activeVariantIds={activeVariantIds}
                selectedColor={selectedColor}
                previewTriggerRef={previewTriggerRef}
                personalizationEnabled={product.personalizationEnabled}
                title={product.title}
                priceLabel={!selectedVariant && product.minPrice !== product.maxPrice ? `From ${displayPrice}` : displayPrice}
              />
            </div>
          </div>

          {/* product details */}
          <div className="flex flex-col gap-5 sm:gap-6 lg:pt-2">

            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
              Free Delivery
            </p>

            {/* divider — desktop only; on mobile the tighter space-y is enough */}
            <div className="hidden sm:block h-px bg-gray-100" />

            {/* colour */}
            <div className="order-[-1] lg:order-none">
            <ColorSwatch
              colors={displayColors}
              selected={selectedColor}
              onSelect={(color) => {
                setSelectedColor(color);
                setSelectedSize(null);
              }}
            />
            </div>

            {product.personalizationEnabled && (
              <label className="block space-y-2">
                <span className="block text-xs font-bold uppercase tracking-widest text-gray-400">Personalisation (optional)</span>
                <textarea
                  value={personalization}
                  onChange={(event) => setPersonalization(event.target.value.slice(0, 300))}
                  maxLength={300}
                  rows={3}
                  placeholder="Add a name, message or other details"
                  className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-navy-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none"
                />
                <span className="block text-right text-[10px] text-gray-400">{personalization.length}/300</span>
              </label>
            )}

            {basketMessage && (
              <p className="text-sm font-semibold text-emerald-600">{basketMessage}</p>
            )}

            {/* CTA */}
            <Button
              size="lg"
              onClick={openBasketOptions}
              disabled={availableVariants.length === 0}
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
              <div className="trust-badge flex-col items-center text-center gap-1.5 col-span-3">
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

      {basketOptionsOpen && (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-navy-900/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setBasketOptionsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="basket-options-title"
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="basket-options-title" className="text-lg font-black text-navy-800">Choose size and quantity</h2>
                <p className="mt-1 truncate text-sm text-gray-500">{product.title} · {displayPrice}</p>
              </div>
              <button
                type="button"
                onClick={() => setBasketOptionsOpen(false)}
                aria-label="Close basket options"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Size</span>
              {product.sizeGuideImage && (
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="text-sm font-semibold text-navy-800 underline underline-offset-2"
                >
                  Size guide
                </button>
              )}
            </div>
            <div className="mt-3">
              <SizeSelector sizes={product.sizes} selected={selectedSize} onSelect={setSelectedSize} hideLabel />
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Quantity</span>
              <div className="inline-flex items-center overflow-hidden rounded-full border-2 border-gray-200">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  className="flex h-11 w-11 items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 hover:text-navy-800"
                  aria-label="Decrease quantity"
                >−</button>
                <span className="w-10 text-center text-sm font-black text-navy-800">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.min(10, current + 1))}
                  className="flex h-11 w-11 items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 hover:text-navy-800"
                  aria-label="Increase quantity"
                >+</button>
              </div>
            </div>

            {(needsColour || needsSize) && (
              <p className="mt-4 text-sm font-semibold text-amber-600">
                {needsColour ? 'Choose a colour on the product page to continue.' : 'Choose a size to continue.'}
              </p>
            )}

            <Button
              size="lg"
              onClick={handleAddToBasket}
              disabled={!canBuy}
              className="mt-6 w-full uppercase text-sm tracking-widest"
            >
              Add to basket
            </Button>
          </section>
        </div>
      )}

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
              src="/UTC-Apparel-White.png"
              alt="Up the Creek Padel"
              className="h-8 w-auto opacity-60"
            />
            <div className="flex flex-col items-center sm:items-end gap-1">
              <a href="mailto:hello@upthecreekpadel.club" className="text-[11px] text-white/30 hover:text-white/60">
                hello@upthecreekpadel.club
              </a>
              <p className="text-[11px] text-white/20">
                © {new Date().getFullYear()} Up the Creek Padel &amp; Social Club
              </p>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
