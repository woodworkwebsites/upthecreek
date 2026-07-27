import { DEFAULT_SIZE_OPTIONS as SHARED_DEFAULT_SIZE_OPTIONS } from '../../types/catalog.js';

export interface CatalogColorOption {
  name: string;
  hex: string;
}

export interface PricingRowOption {
  audience: string;
  product: string;
  garment: string;
  printSurface: string;
  manufacturingCost: string;
  saleCost: string;
  deliveryRetail: string;
  deliveryPartner: string;
  deliveryOnlinePartnership: string;
  salePrice: string;
  partnerPrice: string;
}

export function createEmptyPricingRow(overrides: Partial<PricingRowOption> = {}): PricingRowOption {
  return {
    audience: '',
    product: '',
    garment: '',
    printSurface: '',
    manufacturingCost: '',
    saleCost: '',
    deliveryRetail: '',
    deliveryPartner: '',
    deliveryOnlinePartnership: '',
    salePrice: '',
    partnerPrice: '',
    ...overrides,
  };
}

export interface CatalogOptions {
  audiences: string[];
  products: string[];
  garments: string[];
  colors: CatalogColorOption[];
  pricingRows: PricingRowOption[];
}

export const DEFAULT_SIZE_OPTIONS = [...SHARED_DEFAULT_SIZE_OPTIONS];

export const DEFAULT_CATALOG_OPTIONS: CatalogOptions = {
  audiences: ['Men', 'Womens', 'Kids'],
  products: ['Tshirt', 'Hoody', 'Sweatshirt'],
  garments: [
    'Mens Heavyweight',
    "Women's Relaxed",
    'Kids Supersoft',
    'College Hoodie',
    'Zip Hoodie',
  ],
  colors: [
    { name: 'Black', hex: '#111827' },
    { name: 'Dark Grey', hex: '#374151' },
    { name: 'Navy', hex: '#1e3a8a' },
    { name: 'White', hex: '#f9fafb' },
    { name: 'Natural', hex: '#f5f1e8' },
    { name: 'True Royal', hex: '#1d4ed8' },
    { name: 'Military Green', hex: '#4b5d43' },
    { name: 'Mauve', hex: '#d48a8a' },
    { name: 'Sage', hex: '#b6c0a8' },
  ],
  pricingRows: [
    {
      audience: 'Mens/Unisex',
      product: 'Tshirt',
      garment: 'Mens Heavyweight',
      printSurface: 'Double',
      manufacturingCost: '8.30',
      saleCost: '22.00',
      deliveryRetail: '2.99',
      deliveryPartner: '2.99',
      deliveryOnlinePartnership: '2.99',
      salePrice: '24.99',
      partnerPrice: '11.29',
    },
    {
      audience: 'Ladies',
      product: 'Tshirt',
      garment: "Women's Relaxed Fit",
      printSurface: 'Double',
      manufacturingCost: '8.11',
      saleCost: '22.00',
      deliveryRetail: '2.99',
      deliveryPartner: '2.99',
      deliveryOnlinePartnership: '2.99',
      salePrice: '24.99',
      partnerPrice: '11.10',
    },
    {
      audience: 'Kids',
      product: 'Tshirt',
      garment: 'Kids Soft',
      printSurface: 'Single',
      manufacturingCost: '6.18',
      saleCost: '12.00',
      deliveryRetail: '2.99',
      deliveryPartner: '2.99',
      deliveryOnlinePartnership: '2.99',
      salePrice: '14.99',
      partnerPrice: '9.17',
    },
    {
      audience: 'Ladies',
      product: 'Sweatshirt',
      garment: "Women's Sweatshirt",
      printSurface: 'Double',
      manufacturingCost: '12.65',
      saleCost: '27.00',
      deliveryRetail: '2.99',
      deliveryPartner: '2.99',
      deliveryOnlinePartnership: '2.99',
      salePrice: '29.99',
      partnerPrice: '15.64',
    },
    {
      audience: 'Mens/Unisex',
      product: 'Sweatshirt',
      garment: 'Sweater',
      printSurface: 'Double',
      manufacturingCost: '12.65',
      saleCost: '27.00',
      deliveryRetail: '2.99',
      deliveryPartner: '2.99',
      deliveryOnlinePartnership: '2.99',
      salePrice: '29.99',
      partnerPrice: '15.64',
    },
    {
      audience: 'Mens/Unisex',
      product: 'Hoody',
      garment: 'College Hoodie',
      printSurface: 'Double',
      manufacturingCost: '12.69',
      saleCost: '29.00',
      deliveryRetail: '2.99',
      deliveryPartner: '2.99',
      deliveryOnlinePartnership: '2.99',
      salePrice: '31.99',
      partnerPrice: '15.68',
    },
    {
      audience: 'Mens/Unisex',
      product: 'Zip',
      garment: 'Zip Hoodie',
      printSurface: 'Double',
      manufacturingCost: '15.99',
      saleCost: '30.00',
      deliveryRetail: '2.99',
      deliveryPartner: '2.99',
      deliveryOnlinePartnership: '2.99',
      salePrice: '33.99',
      partnerPrice: '18.98',
    },
  ],
};

function normalizeLookupValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAudienceForPricing(value: string): string {
  const key = normalizeLookupValue(value);
  if (['men', 'mens', 'men unisex', 'mens unisex', 'mens/unisex'].includes(key)) {
    return 'mens/unisex';
  }
  if (['women', 'womens', 'woman', 'womans', 'ladies', 'lady'].includes(key)) {
    return 'ladies';
  }
  return key;
}

function normalizeProductForPricing(value: string): string {
  const key = normalizeLookupValue(value);
  if (key === 'hoodie') return 'hoody';
  return key;
}

function normalizeGarmentForPricing(value: string): string {
  const key = normalizeLookupValue(value);
  if (['womens relaxed', 'womens relaxed fit', 'women relaxed', 'women relaxed fit'].includes(key)) {
    return 'womens relaxed fit';
  }
  if (['kids soft', 'kids supersoft'].includes(key)) {
    return 'kids soft';
  }
  return key.replace(/\bfit\b/g, '').replace(/\s+/g, ' ').trim();
}

function matchesPricingText(left: string, right: string, normalizer: (value: string) => string): boolean {
  return normalizer(left) === normalizer(right);
}

export function findPricingPresetRow(
  rows: PricingRowOption[],
  audience: string,
  product: string,
  garment: string,
): PricingRowOption | null {
  const exact = rows.find(
    (row) =>
      matchesPricingText(row.audience, audience, normalizeAudienceForPricing) &&
      matchesPricingText(row.product, product, normalizeProductForPricing) &&
      matchesPricingText(row.garment, garment, normalizeGarmentForPricing),
  );
  if (exact) return exact;

  const byGarment = rows.find((row) => matchesPricingText(row.garment, garment, normalizeGarmentForPricing));
  if (byGarment) return byGarment;

  const byProduct = rows.find(
    (row) =>
      matchesPricingText(row.audience, audience, normalizeAudienceForPricing) &&
      matchesPricingText(row.product, product, normalizeProductForPricing),
  );
  return byProduct ?? null;
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function parseStringList(raw: string | null | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return dedupeStrings(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return fallback;
  }
}

export function parseColorList(raw: string | null | undefined, fallback: CatalogColorOption[]): CatalogColorOption[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const colors = parsed
      .filter((value): value is CatalogColorOption => {
        return Boolean(
          value &&
          typeof value === 'object' &&
          typeof value.name === 'string' &&
          typeof value.hex === 'string',
        );
      })
      .map((value) => ({
        name: value.name.trim(),
        hex: value.hex.trim() || '#111827',
      }))
      .filter((value) => value.name.length > 0);
    return colors.length > 0 ? colors : fallback;
  } catch {
    return fallback;
  }
}

export function parseCatalogSettings(settings: Record<string, string>): CatalogOptions {
  return {
    audiences: parseStringList(settings.catalog_audience_options, DEFAULT_CATALOG_OPTIONS.audiences),
    products: parseStringList(settings.catalog_product_options, DEFAULT_CATALOG_OPTIONS.products),
    garments: parseStringList(settings.catalog_garment_options, DEFAULT_CATALOG_OPTIONS.garments),
    colors: parseColorList(settings.catalog_color_options, DEFAULT_CATALOG_OPTIONS.colors),
    pricingRows: parsePricingRows(settings.catalog_pricing_rows, DEFAULT_CATALOG_OPTIONS.pricingRows),
  };
}

export function serializeCatalogSettings(options: CatalogOptions): Record<string, string> {
  return {
    catalog_audience_options: JSON.stringify(dedupeStrings(options.audiences)),
    catalog_product_options: JSON.stringify(dedupeStrings(options.products)),
    catalog_garment_options: JSON.stringify(dedupeStrings(options.garments)),
    catalog_color_options: JSON.stringify(
      options.colors
        .map((color) => ({ name: color.name.trim(), hex: color.hex.trim() || '#111827' }))
        .filter((color) => color.name.length > 0),
    ),
    catalog_pricing_rows: JSON.stringify(
      options.pricingRows.map((row) => ({
        audience: row.audience.trim(),
        product: row.product.trim(),
        garment: row.garment.trim(),
        printSurface: row.printSurface.trim(),
        manufacturingCost: row.manufacturingCost.trim(),
        saleCost: row.saleCost.trim(),
        deliveryRetail: row.deliveryRetail.trim(),
        deliveryPartner: row.deliveryPartner.trim(),
        deliveryOnlinePartnership: row.deliveryOnlinePartnership.trim(),
        salePrice: row.salePrice.trim(),
        partnerPrice: row.partnerPrice.trim(),
      })),
    ),
  };
}

function parsePricingRows(raw: string | null | undefined, fallback: PricingRowOption[]): PricingRowOption[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const rows = parsed
      .filter((value): value is PricingRowOption => {
        return Boolean(
          value &&
          typeof value === 'object' &&
          typeof value.audience === 'string' &&
          typeof value.product === 'string' &&
          typeof value.garment === 'string' &&
      typeof value.printSurface === 'string' &&
      typeof value.manufacturingCost === 'string' &&
      typeof value.saleCost === 'string' &&
      typeof value.salePrice === 'string',
      );
      })
      .map((value) => ({
        audience: value.audience.trim(),
        product: value.product.trim(),
        garment: value.garment.trim(),
        printSurface: value.printSurface.trim(),
        manufacturingCost: value.manufacturingCost.trim(),
        saleCost: value.saleCost.trim(),
        deliveryRetail: typeof value.deliveryRetail === 'string' ? value.deliveryRetail.trim() : typeof value.delivery === 'string' ? value.delivery.trim() : '',
        deliveryPartner: typeof value.deliveryPartner === 'string' ? value.deliveryPartner.trim() : typeof value.delivery === 'string' ? value.delivery.trim() : '',
        deliveryOnlinePartnership: typeof value.deliveryOnlinePartnership === 'string' ? value.deliveryOnlinePartnership.trim() : typeof value.delivery === 'string' ? value.delivery.trim() : '',
        salePrice: value.salePrice.trim(),
        partnerPrice: typeof value.partnerPrice === 'string' ? value.partnerPrice.trim() : '',
      }));
    return rows.length > 0 ? rows : fallback;
  } catch {
    return fallback;
  }
}
