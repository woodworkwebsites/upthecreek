import { useEffect, useMemo, useState, type DragEvent } from 'react';
import type { PrintifyColor, PrintifyVariant, Product } from '../../../types/index.js';
import { Badge } from '../ui/Badge.js';
import { cn, formatPrice } from '../../lib/utils.js';
import { DEFAULT_SIZE_OPTIONS } from '../../../types/catalog.js';

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

function getProductLabel(product: Product): string {
  const parts = [product.audience, product.productType].map((value) => value?.trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(' / ');
  return product.garment || product.title;
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

function sizeTotals(basket: BasketLineItem[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const line of basket) {
    for (const entry of line.sizes) {
      if (entry.quantity <= 0) continue;
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
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({ ...item, rrp: Number.isFinite(item.rrp) ? item.rrp : 0 }));
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
  const orderedSizes = useMemo(
    () => DEFAULT_SIZE_OPTIONS.filter((size) => (totals[size] ?? 0) > 0),
    [totals],
  );
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
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Product matrix</p>
              <p className="mt-2 text-sm leading-7 text-gray-500">
                Choose a product, then click a colour to set sizes and quantities.
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

        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const colors = visibleColors(product);
            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-[0_14px_40px_rgba(5,13,31,0.05)]"
              >
                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
                  <div className="border-b border-gray-100 px-5 py-4 lg:border-b-0 lg:border-r">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand-500">
                      {getProductLabel(product)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                      <h2 className="text-xl font-black tracking-tight text-navy-900">{product.title}</h2>
                      <span className="text-sm font-semibold text-gray-500">{product.garment}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="info">{colors.length} colours</Badge>
                      <Badge variant="default">{getProductSizes(product).length} sizes</Badge>
                      <Badge variant="success">{formatPrice(getPartnerUnitPrice(product, product.minPrice))} partner</Badge>
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                      {colors.map((color) => (
                        <button
                          key={`${product.id}:${color.name}`}
                          type="button"
                          draggable
                          onDragStart={(event) => handleDragStart(product, color.name, event)}
                          onClick={() => openDraft(product, color.name)}
                          className={cn(
                            'group flex flex-col overflow-hidden rounded-2xl border bg-white text-left transition-all duration-200',
                            'border-gray-200 hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-[0_12px_30px_rgba(5,13,31,0.08)]',
                          )}
                        >
                          <span className="aspect-square w-full overflow-hidden bg-gray-50">
                            <img
                              src={getImageForColor(product, color.name)}
                              alt={`${product.title} ${color.name}`}
                              className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                              loading="lazy"
                            />
                          </span>
                          <span className="flex items-center gap-1.5 px-2.5 py-2">
                            <span
                              className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-black/10"
                              style={{ backgroundColor: color.hex }}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-navy-900">{color.name}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
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
                Build the club order here. This basket is for stock orders, not public checkout.
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

          <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Drop zone</p>
            <p className="mt-2 text-sm leading-7 text-gray-500">
              Click a colour card to choose sizes and quantities. Dragging a card here opens the same selector.
            </p>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-auto pr-1">
            {basket.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                Basket is empty.
              </div>
            ) : (
              <table className="w-full min-w-[420px] border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    <th className="px-2 py-1 text-left">Garment / Colour</th>
                    {orderedSizes.map((size) => (
                      <th key={size} className="px-1 py-1 text-center">{size}</th>
                    ))}
                    <th className="px-2 py-1 text-right">Pcs</th>
                    <th className="px-2 py-1 text-right">Value</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {basket.map((item) => (
                    <tr key={item.id}>
                      <td className="rounded-l-xl border-y border-l border-gray-200 bg-white px-2.5 py-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={item.imageSrc}
                            alt={`${item.title} ${item.color}`}
                            className="h-11 w-9 flex-shrink-0 rounded-lg bg-gray-50 object-cover object-top"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black tracking-tight text-navy-900">{item.title}</p>
                            <p className="mt-0.5 truncate text-[10px] text-gray-500">{item.garment}</p>
                            <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                              {item.color}
                            </p>
                          </div>
                        </div>
                      </td>
                      {orderedSizes.map((size) => {
                        const entry = item.sizes.find((candidate) => candidate.size === size);
                        return (
                          <td key={size} className="border-y border-gray-200 bg-white px-1 py-2 text-center">
                            {entry?.available ? (
                              <input
                                type="number"
                                min="0"
                                max="99"
                                step="1"
                                value={entry.quantity}
                                onChange={(event) => updateQuantity(item.id, size, Number(event.target.value))}
                                className="h-8 w-12 rounded-lg border border-gray-200 bg-gray-50 text-center text-xs font-semibold text-navy-900 outline-none transition-colors focus:border-navy-800"
                              />
                            ) : (
                              <span className="text-gray-300">–</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="border-y border-gray-200 bg-white px-2.5 py-2 text-right text-xs font-black text-navy-900">
                        {lineCount(item)}
                      </td>
                      <td className="border-y border-gray-200 bg-white px-2.5 py-2 text-right text-xs font-black text-navy-900">
                        {formatPrice(lineTotal(item))}
                      </td>
                      <td className="rounded-r-xl border-y border-r border-gray-200 bg-white px-2.5 py-2">
                        <div className="flex flex-col items-end gap-1">
                          <button
                            type="button"
                            onClick={() => removeLine(item.id)}
                            className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => clearLine(item.id)}
                            className="text-[10px] font-semibold text-gray-400 underline decoration-gray-300 underline-offset-2 hover:text-navy-900"
                          >
                            Clear
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="success">Partner {formatPrice(activeDraft.sizes[0]?.unitPrice ?? 0)}</Badge>
                      <Badge variant="default">RRP {formatPrice(activeDraft.rrp)}</Badge>
                    </div>
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
