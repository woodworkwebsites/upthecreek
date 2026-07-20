import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import type { PrintifyVariant, Product, PrintifyColor } from '../../../types/index.js';
import { adminFetchProducts } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { Badge } from '../../components/ui/Badge.js';
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
  productType: string;
  color: string;
  colorHex: string;
  imageSrc: string;
  sizes: BasketSizeEntry[];
};

type DragPayload = {
  productId: string;
  color: string;
};

const STORAGE_KEY = 'utc_admin_partner_basket_v1';

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function visibleColors(product: Product): PrintifyColor[] {
  const seen = new Set<string>();
  return product.colors.filter((color) => {
    if (product.hiddenColors.includes(color.name)) return false;
    const key = color.name.trim().toLowerCase();
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
    .filter((variant) => variant.color === color)
    .sort((left, right) => {
      const sizes = getProductSizes(product);
      return sizes.indexOf(left.size) - sizes.indexOf(right.size);
    });
}

function getImageForColor(product: Product, color: string): string {
  const colorImage = product.images.find((image) => image.color === color);
  if (colorImage) return colorImage.src;

  const activeVariantIds = product.variants.filter((variant) => variant.color === color).map((variant) => variant.id);
  const variantImage = product.images.find(
    (image) => image.variantIds.length <= 10 && image.variantIds.some((id) => activeVariantIds.includes(id)),
  );
  if (variantImage) return variantImage.src;

  return product.images.find((image) => image.isDefault)?.src ?? product.images[0]?.src ?? '/UTC_Logo.png';
}

function buildBasketLine(product: Product, color: string): BasketLineItem {
  const colors = visibleColors(product);
  const colorMeta = colors.find((entry) => entry.name === color) ?? colors[0] ?? { name: color, hex: '#111827' };
  const sizes = getProductSizes(product);
  const variants = getColorVariants(product, color);
  const variantBySize = new Map(variants.map((variant) => [variant.size, variant]));
  const fallbackPrice = product.minPrice > 0 ? product.minPrice : product.maxPrice > 0 ? product.maxPrice : 0;

  return {
    id: `${product.id}:${color}`,
    productId: product.id,
    printifyId: product.printifyId,
    title: product.title,
    garment: product.garment,
    productType: product.productType,
    color: colorMeta.name,
    colorHex: colorMeta.hex,
    imageSrc: getImageForColor(product, colorMeta.name),
    sizes: sizes.map((size) => {
      const variant = variantBySize.get(size) ?? null;
      return {
        size,
        variantId: variant?.id ?? null,
        available: true,
        unitPrice: variant?.price ?? fallbackPrice,
        quantity: 0,
      };
    }),
  };
}

function mergeBasketLine(existing: BasketLineItem, incoming: BasketLineItem): BasketLineItem {
  const bySize = new Map(existing.sizes.map((entry) => [entry.size, entry]));
  return {
    ...existing,
    imageSrc: incoming.imageSrc || existing.imageSrc,
    sizes: incoming.sizes.map((entry) => {
      const current = bySize.get(entry.size);
      if (!current) return entry;
      return {
        ...entry,
        quantity: current.quantity,
      };
    }),
  };
}

function lineQuantity(line: BasketLineItem): number {
  return line.sizes.reduce((sum, entry) => sum + entry.quantity, 0);
}

function lineTotal(line: BasketLineItem): number {
  return line.sizes.reduce((sum, entry) => sum + (entry.unitPrice * entry.quantity), 0);
}

function basketTotal(basket: BasketLineItem[]): number {
  return basket.reduce((sum, line) => sum + lineTotal(line), 0);
}

function basketPieces(basket: BasketLineItem[]): number {
  return basket.reduce((sum, line) => sum + lineQuantity(line), 0);
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
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) =>
      item &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      Array.isArray(item.sizes),
    );
  } catch {
    return [];
  }
}

function CatalogTile({
  product,
  color,
  active,
  onAdd,
  onDragStart,
}: {
  product: Product;
  color: PrintifyColor;
  active?: boolean;
  onAdd: () => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
}) {
  const sizes = getProductSizes(product);
  const imageSrc = getImageForColor(product, color.name);
  const availableCount = sizes.length;

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onClick={onAdd}
      className={cn(
        'group relative overflow-hidden rounded-[1.5rem] border bg-white text-left transition-all duration-300',
        'shadow-[0_12px_34px_rgba(5,13,31,0.05)] hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(5,13,31,0.09)]',
        active ? 'border-brand-300 ring-2 ring-brand-400/40' : 'border-gray-200',
      )}
    >
      <div className="aspect-[4/5] overflow-hidden bg-gray-50">
        <img
          src={imageSrc}
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
          <Badge variant={availableCount > 0 ? 'success' : 'warning'} className="shrink-0">
            {availableCount > 0 ? `${availableCount}/${sizes.length} sizes` : 'No stock'}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="h-4 w-4 rounded-full border border-black/10"
              style={{ backgroundColor: color.hex }}
              aria-hidden
            />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              {color.name}
            </span>
          </div>
          <p className="text-xs font-semibold text-gray-500">{formatPriceRange(product.minPrice, product.maxPrice)}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Sizes</span>
          <div className="flex flex-wrap gap-1.5">
            {sizes.slice(0, 6).map((size) => (
              <span key={size} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {size}
              </span>
            ))}
            {sizes.length > 6 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                +{sizes.length - 6}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
            Drag or click to add
          </span>
          <span className="rounded-full bg-navy-900 px-3 py-1 text-[11px] font-semibold text-white">
            Add
          </span>
        </div>
      </div>
    </button>
  );
}

function BasketLine({
  item,
  highlighted,
  onQuantityChange,
  onClear,
  onRemove,
}: {
  item: BasketLineItem;
  highlighted: boolean;
  onQuantityChange: (itemId: string, size: string, quantity: number) => void;
  onClear: (itemId: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const pieces = lineQuantity(item);
  const total = lineTotal(item);

  return (
    <article
      className={cn(
        'rounded-[1.5rem] border bg-white p-4 shadow-[0_12px_34px_rgba(5,13,31,0.05)] transition-all',
        highlighted ? 'border-brand-300 ring-2 ring-brand-400/25' : 'border-gray-200',
      )}
    >
      <div className="flex items-start gap-3">
        <img
          src={item.imageSrc}
          alt={`${item.title} ${item.color}`}
          className="h-24 w-20 flex-shrink-0 rounded-2xl object-cover object-top bg-gray-50"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-tight text-navy-900">{item.title}</p>
              <p className="mt-1 text-xs text-gray-500">{item.garment}</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5">
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10"
                style={{ backgroundColor: item.colorHex }}
                aria-hidden
              />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600">
                {item.color}
              </span>
            </div>
            <Badge variant="info">{pieces} pcs</Badge>
            <Badge variant={pieces > 0 ? 'success' : 'warning'}>{formatPrice(total)}</Badge>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
          Size quantities
        </p>
        <button
          type="button"
          onClick={() => onClear(item.id)}
          className="text-xs font-semibold text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-navy-900"
        >
          Clear sizes
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {item.sizes.map((entry) => {
          const disabled = !entry.available;
          return (
            <div
              key={entry.size}
              className={cn(
                'rounded-2xl border p-3',
                disabled ? 'border-dashed border-gray-200 bg-gray-50/80 opacity-70' : 'border-gray-200 bg-gray-50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-navy-900">{entry.size}</p>
                  <p className="text-[11px] text-gray-500">
                    {disabled ? 'Unavailable' : formatPrice(entry.unitPrice)}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500 ring-1 ring-gray-200">
                  {entry.quantity}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled || entry.quantity === 0}
                  onClick={() => onQuantityChange(item.id, entry.size, entry.quantity - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-black text-gray-500 transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-navy-900"
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
                  disabled={disabled}
                  onChange={(event) => onQuantityChange(item.id, entry.size, Number(event.target.value))}
                  className="h-8 w-full rounded-xl border border-gray-200 bg-white px-2 text-center text-sm font-semibold text-navy-900 outline-none transition-colors focus:border-navy-800 disabled:bg-gray-100"
                  aria-label={`${entry.size} quantity`}
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onQuantityChange(item.id, entry.size, entry.quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-black text-gray-500 transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-navy-900"
                  aria-label={`Increase ${entry.size}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function AdminPartnerBasketPage() {
  const { token } = useAdminToken();
  const [products, setProducts] = useState<Product[]>([]);
  const [basket, setBasket] = useState<BasketLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchProducts(token);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setBasket(readBasket());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
  }, [basket, hydrated]);

  useEffect(() => {
    if (!highlightedId) return;
    const timer = window.setTimeout(() => setHighlightedId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [highlightedId]);

  const catalogGroups = useMemo(() => {
    const search = query.trim().toLowerCase();

    return products
      .filter((product) => {
        if (!search) return true;
        const colors = visibleColors(product).map((color) => color.name).join(' ');
        return [product.title, product.garment, product.productType, product.category, colors]
          .join(' ')
          .toLowerCase()
          .includes(search);
      })
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((product) => ({
        product,
        colors: visibleColors(product),
      }))
      .filter((group) => group.colors.length > 0 || group.product.images.length > 0);
  }, [products, query]);

  const sizeSummary = useMemo(() => sizeTotals(basket), [basket]);
  const totalValue = useMemo(() => basketTotal(basket), [basket]);
  const totalPieces = useMemo(() => basketPieces(basket), [basket]);

  function addLine(product: Product, color: string) {
    const incoming = buildBasketLine(product, color);

    setBasket((current) => {
      const existingIndex = current.findIndex((item) => item.id === incoming.id);
      if (existingIndex >= 0) {
        return current.map((item) => (item.id === incoming.id ? mergeBasketLine(item, incoming) : item));
      }
      return [...current, incoming];
    });

    setHighlightedId(incoming.id);
  }

  function updateQuantity(itemId: string, size: string, quantity: number) {
    const nextQuantity = Number.isFinite(quantity) ? Math.max(0, Math.min(99, Math.round(quantity))) : 0;
    setBasket((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              sizes: item.sizes.map((entry) =>
                entry.size === size ? { ...entry, quantity: nextQuantity } : entry,
              ),
            }
          : item,
      ),
    );
  }

  function clearLine(itemId: string) {
    setBasket((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              sizes: item.sizes.map((entry) => ({ ...entry, quantity: 0 })),
            }
          : item,
      ),
    );
  }

  function removeLine(itemId: string) {
    setBasket((current) => current.filter((item) => item.id !== itemId));
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDropActive(false);

    const payloadRaw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    if (!payloadRaw) return;

    try {
      const payload = JSON.parse(payloadRaw) as DragPayload;
      const product = products.find((entry) => entry.id === payload.productId);
      if (!product) return;
      const colors = visibleColors(product);
      const color = colors.find((entry) => entry.name === payload.color)?.name ?? colors[0]?.name;
      if (!color) return;
      addLine(product, color);
    } catch {
      // Ignore malformed drag payloads.
    }
  }

  function handleDragStart(product: Product, color: string, event: DragEvent<HTMLButtonElement>) {
    const payload: DragPayload = { productId: product.id, color };
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
    setDraggingKey(`${product.id}:${color}`);
  }

  if (loading) return <PageLoader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#06122c_0%,_#0a1736_12%,_#f8f7f3_12%,_#f8f7f3_100%)] text-navy-900">
      <header className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <div className="absolute -left-24 top-6 h-72 w-72 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute right-0 top-14 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-white/55">Partner basket</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Drag catalog colours into a stock order pile</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-white/70">
                Add a garment colour from the catalog, then set the required quantities by size in the basket. The pile is saved locally so you can come back to it.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Badge variant="info" className="bg-white/10 text-white ring-1 ring-white/15">
                {catalogGroups.length} designs
              </Badge>
              <Badge variant="success" className="bg-white/10 text-white ring-1 ring-white/15">
                {totalPieces} pieces
              </Badge>
              <Badge variant="default" className="bg-white/10 text-white ring-1 ring-white/15">
                {formatPrice(totalValue)}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.22fr)_420px] xl:grid-cols-[minmax(0,1.25fr)_460px]">
          <section className="space-y-6">
            <div className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(5,13,31,0.06)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Catalog matrix</p>
                  <p className="mt-2 text-sm leading-7 text-gray-500">
                    Each card is a garment colour. Drag one into the basket or click it to add.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 md:w-auto md:min-w-[280px]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by design, garment or colour"
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-navy-900 outline-none transition-colors placeholder:text-gray-400 focus:border-navy-800"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {catalogGroups.length === 0 ? (
                <div className="rounded-[1.75rem] border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                  No products match this search.
                </div>
              ) : (
                catalogGroups.map(({ product, colors }) => (
                  <article
                    key={product.id}
                    className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(5,13,31,0.05)]"
                  >
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
                      {colors.map((color) => {
                        const dragKey = `${product.id}:${color.name}`;
                        return (
                          <CatalogTile
                            key={dragKey}
                            product={product}
                            color={color}
                            active={draggingKey === dragKey}
                            onAdd={() => addLine(product, color.name)}
                            onDragStart={(event) => handleDragStart(product, color.name, event)}
                          />
                        );
                      })}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="lg:sticky lg:top-8 h-fit">
            <div
              onDragEnter={() => setDropActive(true)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
                if (!dropActive) setDropActive(true);
              }}
              onDragLeave={() => setDropActive(false)}
              onDrop={handleDrop}
              className={cn(
                'rounded-[1.75rem] border bg-white p-5 shadow-[0_18px_50px_rgba(5,13,31,0.06)] transition-all',
                dropActive ? 'border-brand-300 ring-2 ring-brand-400/25' : 'border-gray-200',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Basket</p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight text-navy-900">Order pile</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Drop a colour here, then set the size quantities below.
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
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Lines</p>
                  <p className="mt-2 text-2xl font-black text-navy-900">{basket.length}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Pieces</p>
                  <p className="mt-2 text-2xl font-black text-navy-900">{totalPieces}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Value</p>
                  <p className="mt-2 text-2xl font-black text-navy-900">{formatPrice(totalValue)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">Sizes</p>
                  <p className="mt-2 text-2xl font-black text-navy-900">{Object.keys(sizeSummary).length}</p>
                </div>
              </div>

              {Object.keys(sizeSummary).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(sizeSummary).map(([size, quantity]) => (
                    <Badge key={size} variant="default" className="bg-gray-100 text-gray-700">
                      {size} {quantity}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                  Drop zone
                </p>
                <p className="mt-2 text-sm leading-7 text-gray-500">
                  Drag a colour card from the catalog or click it to add it to the basket.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {basket.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                    Basket is empty.
                  </div>
                ) : (
                  basket.map((item) => (
                    <BasketLine
                      key={item.id}
                      item={item}
                      highlighted={highlightedId === item.id}
                      onQuantityChange={updateQuantity}
                      onClear={clearLine}
                      onRemove={removeLine}
                    />
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
