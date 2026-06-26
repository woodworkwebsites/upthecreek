import { useState, useMemo, memo } from 'react';
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
        className="description-body text-sm leading-relaxed text-gray-600 dark:text-gray-400"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    );
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
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
      (!selectedColor || v.color === selectedColor) &&
      v.available,
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
    return product.variants
      .filter((v) => v.color === selectedColor)
      .map((v) => v.id);
  }, [product, selectedColor]);

  const unavailableSizes = useMemo(() => {
    if (!product || !selectedColor) return [];
    return product.sizes.filter(
      (size) => !availableSizes.includes(size),
    );
  }, [product, selectedColor, availableSizes]);

  async function handleBuyNow() {
    if (!product || !selectedVariant) return;
    setBuyError(null);
    setBuying(true);
    try {
      const { url } = await createCheckout([
        {
          printifyId: product.printifyId,
          variantId:  selectedVariant.id,
          quantity,
        },
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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center group">
              <img
                src="/Up The Creek_Blue_Wordmark.svg"
                alt="Up the Creek Padel"
                className="h-9 w-auto object-contain group-hover:opacity-80 transition-opacity dark:hidden"
              />
              <img
                src="/UTC_WordMark_White_Trans_BG.png"
                alt="Up the Creek Padel"
                className="h-9 w-auto object-contain group-hover:opacity-80 transition-opacity hidden dark:block"
              />
            </Link>
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            >
              ← Back to shop
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 xl:gap-24">
          <div className="mb-8 lg:mb-0">
            <ImageGallery
              images={product.images}
              activeVariantIds={activeVariantIds}
              title={product.title}
            />
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                {product.title}
              </h1>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                {displayPrice}
              </p>
            </div>

            <ColorSwatch
              colors={product.colors}
              selected={selectedColor}
              onSelect={(color) => {
                setSelectedColor(color);
                setSelectedSize(null);
              }}
            />

            <SizeSelector
              sizes={product.sizes}
              selected={selectedSize}
              onSelect={setSelectedSize}
              unavailable={unavailableSizes}
            />

            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Quantity
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-lg font-medium text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300 transition-colors"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-lg font-medium text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300 transition-colors"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {!selectedColor && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Please select a colour to continue.
              </p>
            )}
            {selectedColor && !selectedSize && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Please select a size to continue.
              </p>
            )}

            {buyError && (
              <p className="text-sm text-red-600 dark:text-red-400">{buyError}</p>
            )}

            <Button
              size="lg"
              onClick={handleBuyNow}
              disabled={!canBuy}
              loading={buying}
              className="w-full"
            >
              {buying ? 'Redirecting to checkout…' : 'Buy Now'}
            </Button>

            <div className="space-y-2 text-xs text-gray-400 dark:text-gray-500">
              <p>🚚 Estimated delivery 5–10 working days</p>
              <p>🌍 Worldwide shipping available</p>
              <p>♻️ Printed on demand — no waste, no stock</p>
            </div>

            {product.description && (
              <div className="border-t border-gray-100 pt-6 dark:border-gray-800">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  About this product
                </h2>
                <ProductDescription html={product.description} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
