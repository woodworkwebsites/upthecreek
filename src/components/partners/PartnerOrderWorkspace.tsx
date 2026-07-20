import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { PrintifyColor, PrintifyVariant, Product } from '../../../types/index.js';
import { Badge } from '../ui/Badge.js';
import { cn, formatPrice, formatPriceRange } from '../../lib/utils.js';

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
  sizes: BasketSizeEntry[];
};

type DragPayload = {
  productId: string;
  color: string;
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

function buildSizeEntries(product: Product, color: string): BasketSizeEntry[] {
  const sizes = getProductSizes(product);
  const variants = getColorVariants(product, color);
  const variantBySize = new Map(variants.map((variant) => [variant.size, variant]));
  const fallbackPrice = product.minPrice > 0 ? product.minPrice : product.maxPrice > 0 ? product.maxPrice : 0;

  return sizes.map((size) => {
    const variant = variantBySize.get(size) ?? null;
    return {
      size,
      variantId: variant?.id ?? null,
      available: true,
      unitPrice: variant?.price ?? fallbackPrice,
      quantity: 0,
    };
  });
}

function getImageForColor(product: Product, color: string): string {
  const colorImage = product.images.find((image) => normalizeName(image.color ?? '') === normalizeName(color));
  if (colorImage) return colorImage.src;

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

function sizeTotals(basket: BasketLineItem[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const line of basket) {
    for (const entry of line.sizes) {
      totals[entry.size] = (totals[entry.size] ?? 0) + entry.quantity;
    }
  }
  return totals;
}

function readBasket(): BasketLineItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BasketLineItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function PartnerOrderWorkspace({ products }: { products: Product[] }) {
  const [basket, setBasket] = useState<BasketLineItem[]>([]);
  const [query, setQuery] = useState('');
  const [dropActive, setDropActive] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activeDraft, setActiveDraft] = useState<BasketLineItem | null>(null);

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

  const totals = useMemo(() => sizeTotals(basket), [basket]);
  const pieceCount = useMemo(() => basketCount(basket), [basket]);
  const value = useMemo(() => basketTotal(basket), [basket]);

  function openDraft(product: Product, color: string) {
    setActiveDraft(buildLine(product, color));
  }

  function closeDraft() {
    setActiveDraft(null);
  }

  function commitDraft() {
    if (!activeDraft) return;
    if (lineCount(activeDraft) === 0) return;
    setBasket((current) => {
      const existingIndex = current.findIndex((item) => item.id === activeDraft.id);
      if (existingIndex >= 0) {
        return current.map((item) => (item.id === activeDraft.id ? mergeLine(item, activeDraft) : item));
      }
      return [...current, activeDraft];
    });
    setActiveDraft(null);
  }

  function updateDraftQuantity(size: string, quantity: number) {
    const next = Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0;
    setActiveDraft((current) =>
      current
        ? {
            ...current,
            sizes: current.sizes.map((entry) => (entry.size === size ? { ...entry, quantity: next } : entry)),
          }
        : current,
    );
  }

  function clearDraft() {
    setActiveDraft((current) =>
      current
        ? { ...current, sizes: current.sizes.map((entry) => ({ ...entry, quantity: 0 })) }
        : current,
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

  function clearLine(itemId: string) {
    setBasket((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, sizes: item.sizes.map((entry) => ({ ...entry, quantity: 0 })) } : item,
      ),
    );
  }

  function removeLine(itemId: string) {
    setBasket((current) => current.filter((item) => item.id !== itemId));
  }

  function handleDragStart(product: Product, color: string, event: DragEvent<HTMLButtonElement>) {
    const payload: DragPayload = { productId: product.id, color };
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDropActive(false);

    const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    if (!raw) return;

    try {
      const payload = JSON.parse(raw) as DragPayload;
      const product = products.find((entry) => entry.id === payload.productId);
      if (!product) return;
      const colors = visibleColors(product);
      const color = colors.find((entry) => entry.name === payload.color)?.name ?? colors[0]?.name;
      if (!color) return;
      openDraft(product, color);
    } catch {
      // Ignore malformed drag payloads.
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.22fr)_420px] xl:grid-cols-[minmax(0,1.25fr)_460px]">
      <section className="space-y-6">
        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(5,13,31,0.06)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Matrix</p>
              <p className="mt-2 text-sm leading-7 text-gray-500">
                Drag a garment colour into the order pile, or click to add it. The right-hand basket is where quantities are edited.
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

        <div className="space-y-6">
          {filteredProducts.map((product) => {
            const colors = visibleColors(product);
            return (
              <article key={product.id} className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(5,13,31,0.05)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-500">
                      {product.category || product.audience}
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-navy-900">{product.title}</h2>
                    <p className="mt-1 text-sm text-gray-500">{product.garment}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{colors.length} colours</Badge>
                    <Badge variant="default">{getProductSizes(product).length} sizes</Badge>
                    <Badge variant="success">{formatPriceRange(product.minPrice, product.maxPrice)}</Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {colors.map((color) => (
                    <button
                      key={`${product.id}:${color.name}`}
                      type="button"
                      draggable
                      onDragStart={(event) => handleDragStart(product, color.name, event)}
                    onClick={() => openDraft(product, color.name)}
                      className={cn(
                        'group relative overflow-hidden rounded-[1.5rem] border bg-white text-left transition-all duration-300',
                        'shadow-[0_12px_34px_rgba(5,13,31,0.05)] hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(5,13,31,0.09)] border-gray-200',
                      )}
                    >
                      <div className="aspect-[4/5] overflow-hidden bg-gray-50">
                        <img
                          src={getImageForColor(product, color.name)}
                          alt={`${product.title} ${color.name}`}
                          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      </div>
                      <div className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black tracking-tight text-navy-900">{product.title}</p>
                            <p className="mt-1 text-xs text-gray-500">{product.garment}</p>
                          </div>
                          <Badge variant="default" className="shrink-0">
                            {color.name}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} aria-hidden />
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              {color.name}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-gray-500">{formatPriceRange(product.minPrice, product.maxPrice)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Drag or click</span>
                          <span className="rounded-full bg-navy-900 px-3 py-1 text-[11px] font-semibold text-white">Add</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="lg:sticky lg:top-8 self-start">
        <div
          onDragEnter={() => setDropActive(true)}
          onDragLeave={() => setDropActive(false)}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handleDrop}
          className={cn(
            'flex max-h-[calc(100vh-4rem)] flex-col rounded-[1.75rem] border bg-white p-5 shadow-[0_18px_50px_rgba(5,13,31,0.06)] transition-all',
            dropActive ? 'border-brand-300 ring-2 ring-brand-400/25' : 'border-gray-200',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Order pile</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-navy-900">Basket</h2>
              <p className="mt-1 text-sm text-gray-500">
                Build the club order here. This is a working stock basket, not a storefront basket.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBasket([])}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
            >
              Clear all
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Lines</p>
              <p className="mt-1.5 text-xl font-black text-navy-900">{basket.length}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Pieces</p>
              <p className="mt-1.5 text-xl font-black text-navy-900">{pieceCount}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Value</p>
              <p className="mt-1.5 text-xl font-black text-navy-900">{formatPrice(value)}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Sizes</p>
              <p className="mt-1.5 text-xl font-black text-navy-900">{Object.keys(totals).length}</p>
            </div>
          </div>

          {Object.keys(totals).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(totals).map(([size, quantity]) => (
                <Badge key={size} variant="default" className="bg-gray-100 text-gray-700">
                  {size} {quantity}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Drop zone</p>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              Click a colour card to choose sizes and quantities. Dragging a card here opens the same selector.
            </p>
          </div>

          <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {basket.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                Basket is empty.
              </div>
            ) : (
              basket.map((item) => (
                <article key={item.id} className="rounded-[1.35rem] border border-gray-200 bg-white p-3.5 shadow-[0_12px_34px_rgba(5,13,31,0.05)]">
                  <div className="flex items-start gap-3">
                    <img
                      src={item.imageSrc}
                      alt={`${item.title} ${item.color}`}
                      className="h-16 w-14 flex-shrink-0 rounded-xl bg-gray-50 object-cover object-top"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black tracking-tight text-navy-900">{item.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{item.garment}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(item.id)}
                          className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full bg-gray-50 px-2.5 py-1">
                          <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: item.colorHex }} aria-hidden />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-600">{item.color}</span>
                        </div>
                        <Badge variant="info" className="text-[11px]">{lineCount(item)} pcs</Badge>
                        <Badge variant="success" className="text-[11px]">{formatPrice(lineTotal(item))}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Size quantities</p>
                    <button
                      type="button"
                      onClick={() => clearLine(item.id)}
                      className="text-xs font-semibold text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-navy-900"
                    >
                      Clear sizes
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {item.sizes.map((entry) => (
                      <div
                        key={entry.size}
                        className={cn(
                          'rounded-2xl border p-2.5',
                          entry.available ? 'border-gray-200 bg-gray-50' : 'border-dashed border-gray-200 bg-gray-50/80 opacity-70',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-black text-navy-900">{entry.size}</p>
                            <p className="text-[10px] text-gray-500">{entry.available ? formatPrice(entry.unitPrice) : 'Unavailable'}</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500 ring-1 ring-gray-200">
                            {entry.quantity}
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!entry.available || entry.quantity === 0}
                            onClick={() => updateQuantity(item.id, entry.size, entry.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-black text-gray-500 transition-colors hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-30"
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
                            disabled={!entry.available}
                            onChange={(event) => updateQuantity(item.id, entry.size, Number(event.target.value))}
                            className="h-7 w-full rounded-xl border border-gray-200 bg-white px-2 text-center text-xs font-semibold text-navy-900 outline-none transition-colors focus:border-navy-800 disabled:bg-gray-100"
                          />
                          <button
                            type="button"
                            disabled={!entry.available}
                            onClick={() => updateQuantity(item.id, entry.size, entry.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-black text-gray-500 transition-colors hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Increase ${entry.size}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </aside>

      {activeDraft && (
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
                      Set the quantities for this colour, then add it to the basket.
                    </p>
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
                      <Badge variant="info">{lineCount(activeDraft)} pcs</Badge>
                      <Badge variant="success">{formatPrice(lineTotal(activeDraft))}</Badge>
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
                        disabled={lineCount(activeDraft) === 0}
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
      )}
    </div>
  );
}
