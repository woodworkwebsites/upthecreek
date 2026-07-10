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
  delivery: string;
  salePrice: string;
}

export interface CatalogOptions {
  audiences: string[];
  products: string[];
  garments: string[];
  colors: CatalogColorOption[];
  pricingRows: PricingRowOption[];
}

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
      delivery: '2.99',
      salePrice: '24.99',
    },
    {
      audience: 'Ladies',
      product: 'Tshirt',
      garment: "Women's Relaxed Fit",
      printSurface: 'Double',
      manufacturingCost: '8.11',
      saleCost: '22.00',
      delivery: '2.99',
      salePrice: '24.99',
    },
    {
      audience: 'Kids',
      product: 'Tshirt',
      garment: 'Kids Soft',
      printSurface: 'Single',
      manufacturingCost: '6.18',
      saleCost: '12.00',
      delivery: '2.99',
      salePrice: '14.99',
    },
    {
      audience: 'Ladies',
      product: 'Sweatshirt',
      garment: "Women's Sweatshirt",
      printSurface: 'Double',
      manufacturingCost: '12.65',
      saleCost: '27.00',
      delivery: '2.99',
      salePrice: '29.99',
    },
    {
      audience: 'Mens/Unisex',
      product: 'Sweatshirt',
      garment: 'Sweater',
      printSurface: 'Double',
      manufacturingCost: '12.65',
      saleCost: '27.00',
      delivery: '2.99',
      salePrice: '29.99',
    },
    {
      audience: 'Mens/Unisex',
      product: 'Hoody',
      garment: 'College Hoodie',
      printSurface: 'Double',
      manufacturingCost: '12.69',
      saleCost: '29.00',
      delivery: '2.99',
      salePrice: '31.99',
    },
    {
      audience: 'Mens/Unisex',
      product: 'Zip',
      garment: 'Zip Hoodie',
      printSurface: 'Double',
      manufacturingCost: '15.99',
      saleCost: '30.00',
      delivery: '2.99',
      salePrice: '33.99',
    },
  ],
};

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
        delivery: row.delivery.trim(),
        salePrice: row.salePrice.trim(),
      })).filter((row) => row.audience.length > 0 && row.product.length > 0 && row.garment.length > 0),
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
          typeof value.delivery === 'string' &&
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
        delivery: value.delivery.trim(),
        salePrice: value.salePrice.trim(),
      }))
      .filter((value) => value.audience.length > 0 && value.product.length > 0 && value.garment.length > 0);
    return rows.length > 0 ? rows : fallback;
  } catch {
    return fallback;
  }
}
