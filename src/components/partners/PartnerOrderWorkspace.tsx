import { useEffect, useMemo, useState } from 'react';
import type { PrintifyColor, PrintifyVariant, Product } from '../../../types/index.js';
import { Badge } from '../ui/Badge.js';
import { cn, formatPrice } from '../../lib/utils.js';

const priceChipClass = 'inline-flex items-center rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white';

type BasketSizeEntry = {
  size: string;
  variantId: number | null;
  available: boolean;
  unitPrice: number;
  quantity: number;
};

type BasketLineItem = {
  id: string;
  productId: string;
  printifyId: string;
  title: string;
  garment: string;
  color: string;
  colorHex: string;
  imageSrc: string;
  rrp: number;
  sizes: BasketSizeEntry[];
};

const STORAGE_KEY = 'utc_partner_console_basket_v1';

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function visibleColors(product: Product): PrintifyColor[] {
  const seen = new Set<string>();
  return product.colors.filter((color) => {
    if (product.hiddenColors.includes(color.name)) return false;
    const key = normalizeName(color.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getProductSizes(product: Product): string[] {
  return uniqueStrings(product.sizes);
}

function getColorVariants(product: Product, color: string): PrintifyVariant[] {
  return product.variants
    .filter((variant) => normalizeName(variant.color) === normalizeName(color))
    .sort((left, right) => getProductSizes(product).indexOf(left.size) - getProductSizes(product).indexOf(right.size));
}

function getPartnerUnitPrice(product: Product, fallback: number): number {
  const raw = product.pricingMatrix?.partnerPrice?.trim();
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : fallback;
}

function getRrp(product: Product): number {
  return product.minPrice > 0 ? product.minPrice : product.maxPrice > 0 ? product.maxPrice : 0;
}

function buildSizeEntries(product: Product, color: string): BasketSizeEntry[] {
  const sizes = getProductSizes(product);
  const variants = getColorVariants(product, color);
  const variantBySize = new Map(variants.map((variant) => [variant.size, variant]));
  const fallbackPrice = product.minPrice > 0 ? product.minPrice : product.maxPrice > 0 ? product.maxPrice : 0;
  const unitPrice = getPartnerUnitPrice(product, fallbackPrice);

  return sizes.map((size) => {
    const variant = variantBySize.get(size) ?? null;
    return {
      size,
      variantId: variant?.id ?? null,
      available: true,
      unitPrice: variant ? getPartnerUnitPrice(product, variant.price) : unitPrice,
      quantity: 0,
    };
  });
}

function getImageForColor(product: Product, color: string): string {
  const colorImages = product.images.filter((image) => normalizeName(image.color ?? '') === normalizeName(color));
  // The default image is consistently a lifestyle/model shot; other tagged images are flat product shots.
  const flatImage = colorImages.find((image) => !image.isDefault) ?? colorImages[0];
  if (flatImage) return flatImage.src;

  const activeVariantIds = product.variants
    .filter((variant) => normalizeName(variant.color) === normalizeName(color))
    .map((variant) => variant.id);
  const variantImage = product.images.find(
    (image) => image.variantIds.length <= 10 && image.variantIds.some((id) => activeVariantIds.includes(id)),
  );
  if (variantImage) return variantImage.src;

  return product.images.find((image) => image.isDefault)?.src ?? product.images[0]?.src ?? '/UTC_Logo.png';
}

function buildLine(product: Product, color: string): BasketLineItem {
  const colors = visibleColors(product);
  const colorMeta = colors.find((entry) => entry.name === color) ?? colors[0] ?? { name: color, hex: '#111827' };

  return {
    id: `${product.id}:${colorMeta.name}`,
    productId: product.id,
    printifyId: product.printifyId,
    title: product.title,
    garment: product.garment,
    color: colorMeta.name,
    colorHex: colorMeta.hex,
    imageSrc: getImageForColor(product, colorMeta.name),
    rrp: getRrp(product),
    sizes: buildSizeEntries(product, colorMeta.name),
  };
}

function mergeLine(existing: BasketLineItem, incoming: BasketLineItem): BasketLineItem {
  const bySize = new Map(existing.sizes.map((entry) => [entry.size, entry.quantity]));
  return {
    ...existing,
    sizes: incoming.sizes.map((entry) => ({
      ...entry,
      quantity: bySize.get(entry.size) ?? entry.quantity,
    })),
  };
}

function lineTotal(line: BasketLineItem): number {
  return line.sizes.reduce((sum, entry) => sum + (entry.unitPrice * entry.quantity), 0);
}

function lineCount(line: BasketLineItem): number {
  return line.sizes.reduce((sum, entry) => sum + entry.quantity, 0);
}

function basketTotal(basket: BasketLineItem[]): number {
  return basket.reduce((sum, line) => sum + lineTotal(line), 0);
}

function basketCount(basket: BasketLineItem[]): number {
  return basket.reduce((sum, line) => sum + lineCount(line), 0);
}

function readBasket(): BasketLineItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BasketLineItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({ ...item, rrp: Number.isFinite(item.rrp) ? item.rrp : 0 }));
  } catch {
    return [];
  }
}

function ProductMatrixCard({
  product,
  onOpenDraft,
}: {
  product: Product;
  onOpenDraft: (product: Product, color: string) => void;
}) {
  const colors = visibleColors(product);
  const [selectedColorName, setSelectedColorName] = useState(colors[0]?.name ?? '');
  const activeColor = colors.find((color) => color.name === selectedColorName) ?? colors[0];

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-[0_14px_40px_rgba(5,13,31,0.05)]">
      {activeColor && (
        <button
          type="button"
          onClick={() => onOpenDraft(product, activeColor.name)}
          className="group block w-full overflow-hidden text-left"
        >
          <span className="block aspect-[4/3] w-full overflow-hidden bg-gray-50">
            <img
              src={getImageForColor(product, activeColor.name)}
              alt={`${product.title} ${activeColor.name}`}
              className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          </span>
        </button>
      )}

      <div className="p-4">
        <h2 className="text-base font-black leading-snug tracking-tight text-navy-900">{product.title}</h2>
        <p className="mt-0.5 text-xs font-semibold text-gray-500">{product.garment}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={priceChipClass}>
            {formatPrice(getPartnerUnitPrice(product, product.minPrice))} partner
          </span>
          <span className="text-xs text-gray-400">
            {colors.length} colours · {getProductSizes(product).length} sizes
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {colors.map((color) => (
            <button
              key={color.name}
              type="button"
              onClick={() => setSelectedColorName(color.name)}
              aria-pressed={color.name === activeColor?.name}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                color.name === activeColor?.name
                  ? 'border-navy-800 bg-navy-800 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              {color.name}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

export function PartnerOrderWorkspace({ products }: { products: Product[] }) {
  const [basket, setBasket] = useState<BasketLineItem[]>([]);
  const [query, setQuery] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [draftLines, setDraftLines] = useState<BasketLineItem[]>([]);
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const activeDraft = draftLines.find((line) => line.color === draftColor) ?? null;

  useEffect(() => {
    setBasket(readBasket());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
  }, [basket, hydrated]);

  const filteredProducts = useMemo(() => {
    const search = query.trim().toLowerCase();
    return products.filter((product) => {
      if (!search) return true;
      const colorText = visibleColors(product).map((color) => color.name).join(' ');
      return [product.title, product.garment, product.productType, product.category, colorText]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
  }, [products, query]);

  const pieceCount = useMemo(() => basketCount(basket), [basket]);
  const value = useMemo(() => basketTotal(basket), [basket]);

  function openDraft(product: Product, color: string) {
    setDraftLines([buildLine(product, color)]);
    setDraftColor(color);
  }

  function switchDraftColor(color: string) {
    setDraftLines((current) => {
      if (current.some((line) => line.color === color)) return current;
      const sourceProductId = current[0]?.productId;
      const product = products.find((entry) => entry.id === sourceProductId);
      if (!product) return current;
      return [...current, buildLine(product, color)];
    });
    setDraftColor(color);
  }

  function closeDraft() {
    setDraftLines([]);
    setDraftColor(null);
  }

  function commitDraft() {
    const linesToCommit = draftLines.filter((line) => lineCount(line) > 0);
    if (linesToCommit.length === 0) return;
    setBasket((current) => {
      let next = current;
      for (const draftLine of linesToCommit) {
        const existingIndex = next.findIndex((item) => item.id === draftLine.id);
        next = existingIndex >= 0
          ? next.map((item) => (item.id === draftLine.id ? mergeLine(item, draftLine) : item))
          : [...next, draftLine];
      }
      return next;
    });
    closeDraft();
  }

  function updateDraftQuantity(size: string, quantity: number) {
    const next = Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0;
    setDraftLines((current) =>
      current.map((line) =>
        line.color === draftColor
          ? { ...line, sizes: line.sizes.map((entry) => (entry.size === size ? { ...entry, quantity: next } : entry)) }
          : line,
      ),
    );
  }

  function clearDraft() {
    setDraftLines((current) =>
      current.map((line) =>
        line.color === draftColor
          ? { ...line, sizes: line.sizes.map((entry) => ({ ...entry, quantity: 0 })) }
          : line,
      ),
    );
  }

  function updateQuantity(itemId: string, size: string, quantity: number) {
    const next = Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0;
    setBasket((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, sizes: item.sizes.map((entry) => (entry.size === size ? { ...entry, quantity: next } : entry)) }
          : item,
      ),
    );
  }

  function removeLine(itemId: string) {
    setBasket((current) => current.filter((item) => item.id !== itemId));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.22fr)_420px] xl:grid-cols-[minmax(0,1.25fr)_460px]">
      <section className="space-y-6">
        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(5,13,31,0.06)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Product matrix</p>
              <p className="mt-2 text-sm leading-7 text-gray-500">
                Click a colour chip to preview it, then click the photo to set sizes and quantities.
              </p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search design, garment or colour"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-navy-900 outline-none transition-colors placeholder:text-gray-400 focus:border-navy-800 md:max-w-[320px]"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductMatrixCard
              key={product.id}
              product={product}
              onOpenDraft={openDraft}
            />
          ))}
        </div>
      </section>

      <aside className="lg:sticky lg:top-8 self-start">
        <div className="flex max-h-[calc(100vh-4rem)] flex-col rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(5,13,31,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Basket</p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-navy-900">
                Your order
                {pieceCount > 0 && (
                  <span className="ml-2 text-sm font-semibold text-gray-400">
                    {pieceCount} piece{pieceCount === 1 ? '' : 's'}
                  </span>
                )}
              </h2>
            </div>
            {basket.length > 0 && (
              <button
                type="button"
                onClick={() => setBasket([])}
                className="text-xs font-semibold text-gray-400 hover:text-red-600"
              >
                Clear all
              </button>
            )}
          </div>

          {basket.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-gray-50 px-4 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white ring-1 ring-gray-200">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-black text-navy-900">Nothing here yet</p>
                <p className="mt-1 text-xs text-gray-400">Click a product photo to add sizes.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {basket.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-black/5">
                    <img
                      src={item.imageSrc}
                      alt={`${item.title} ${item.color}`}
                      className="h-16 w-14 flex-shrink-0 rounded-xl object-cover object-top"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-navy-900">{item.title}</p>
                          <p className="text-xs text-gray-500">{item.color}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(item.id)}
                          aria-label="Remove item"
                          className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-red-500"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.sizes.filter((entry) => entry.quantity > 0).map((entry) => (
                          <div key={entry.size} className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-2 pr-1 ring-1 ring-gray-200">
                            <span className="text-[11px] font-bold text-navy-900">{entry.size}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, entry.size, entry.quantity - 1)}
                              aria-label={`Decrease ${entry.size}`}
                              className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-gray-400 hover:text-navy-900"
                            >
                              −
                            </button>
                            <span className="w-4 text-center text-[11px] font-semibold text-navy-900">{entry.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, entry.size, entry.quantity + 1)}
                              aria-label={`Increase ${entry.size}`}
                              className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-gray-400 hover:text-navy-900"
                            >
                              +
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-gray-400">{lineCount(item)} pcs</span>
                        <span className="text-sm font-black text-navy-900">{formatPrice(lineTotal(item))}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Total pieces</span>
                  <span className="font-semibold text-navy-900">{pieceCount}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-base font-black text-navy-900">
                  <span>Total value</span>
                  <span>{formatPrice(value)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {activeDraft && (() => {
        const draftProduct = products.find((entry) => entry.id === activeDraft.productId);
        const draftColors = draftProduct ? visibleColors(draftProduct) : [];
        const draftTotalPieces = draftLines.reduce((sum, line) => sum + lineCount(line), 0);
        const draftTotalValue = draftLines.reduce((sum, line) => sum + lineTotal(line), 0);
        return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm"
          onClick={closeDraft}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${activeDraft.title} ${activeDraft.color}`}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_90px_rgba(0,0,0,0.35)]"
          >
            <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="relative bg-gray-950">
                <img
                  src={activeDraft.imageSrc}
                  alt={`${activeDraft.title} ${activeDraft.color}`}
                  className="h-full w-full object-cover object-top"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-white/70">{activeDraft.garment}</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight">{activeDraft.title}</h3>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: activeDraft.colorHex }} aria-hidden />
                    <span className="text-sm font-semibold uppercase tracking-[0.18em]">{activeDraft.color}</span>
                  </div>
                </div>
              </div>

              <div className="flex max-h-[88vh] min-h-0 flex-col">
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Select sizes</p>
                    <p className="mt-2 text-sm leading-7 text-gray-500">
                      Set quantities for this colour. Switch colours above to add more, then add everything to the basket at once.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={priceChipClass}>Partner {formatPrice(activeDraft.sizes[0]?.unitPrice ?? 0)}</span>
                      <Badge variant="default">RRP {formatPrice(activeDraft.rrp)}</Badge>
                    </div>
                    {draftColors.length > 1 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {draftColors.map((color) => {
                          const queuedLine = draftLines.find((line) => line.color === color.name);
                          const queuedPieces = queuedLine ? lineCount(queuedLine) : 0;
                          return (
                            <button
                              key={color.name}
                              type="button"
                              onClick={() => switchDraftColor(color.name)}
                              aria-pressed={color.name === activeDraft.color}
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                                color.name === activeDraft.color
                                  ? 'border-navy-800 bg-navy-800 text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                              )}
                            >
                              <span
                                className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-black/10"
                                style={{ backgroundColor: color.hex }}
                                aria-hidden
                              />
                              {color.name}
                              {queuedPieces > 0 && (
                                <span
                                  className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                                    color.name === activeDraft.color ? 'bg-white/20 text-white' : 'bg-emerald-700 text-white',
                                  )}
                                >
                                  {queuedPieces}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeDraft}
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {activeDraft.sizes.map((entry) => (
                      <div
                        key={entry.size}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-black text-navy-900">{entry.size}</p>
                            <p className="text-[11px] text-gray-500">{formatPrice(entry.unitPrice)}</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500 ring-1 ring-gray-200">
                            {entry.quantity}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(entry.size, entry.quantity - 1)}
                            disabled={entry.quantity === 0}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-black text-gray-500 transition-colors hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Decrease ${entry.size}`}
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0"
                            max="99"
                            step="1"
                            value={entry.quantity}
                            onChange={(event) => updateDraftQuantity(entry.size, Number(event.target.value))}
                            className="h-8 w-full rounded-xl border border-gray-200 bg-white px-2 text-center text-sm font-semibold text-navy-900 outline-none transition-colors focus:border-navy-800"
                          />
                          <button
                            type="button"
                            onClick={() => updateDraftQuantity(entry.size, entry.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-black text-gray-500 transition-colors hover:text-navy-900"
                            aria-label={`Increase ${entry.size}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="info">{lineCount(activeDraft)} pcs this colour</Badge>
                      {draftLines.length > 1 && (
                        <Badge variant="default">{draftTotalPieces} pcs total</Badge>
                      )}
                      <span className={priceChipClass}>{formatPrice(draftTotalValue)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={clearDraft}
                        className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Clear quantities
                      </button>
                      <button
                        type="button"
                        onClick={commitDraft}
                        disabled={draftTotalPieces === 0}
                        className="rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Add to basket
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
