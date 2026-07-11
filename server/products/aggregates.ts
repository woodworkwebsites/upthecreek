import type { PrintifyVariant, PrintifyColor } from '../../types/index.js';
import { DEFAULT_SIZE_OPTIONS } from '../../types/catalog.js';

export interface ProductAggregates {
  colors: PrintifyColor[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
}

/**
 * Derives the product-level colors/sizes/price-range summary from a finished
 * variant list. Shared by the Printify sync transform and manual product
 * creation so both stay consistent (e.g. size ordering).
 */
export function deriveProductAggregates(
  variants: PrintifyVariant[],
  colorHexByName: Map<string, string> = new Map(),
  fallbackPricePence = 0,
): ProductAggregates {
  const colors: PrintifyColor[] = [];
  const colorsSeen = new Set<string>();

  for (const variant of variants) {
    if (variant.color && !colorsSeen.has(variant.color)) {
      colorsSeen.add(variant.color);
      colors.push({ name: variant.color, hex: colorHexByName.get(variant.color) ?? '#cccccc' });
    }
  }

  const prices = variants.map((v) => v.price);
  const minPrice = prices.length ? Math.min(...prices) : fallbackPricePence;
  const maxPrice = prices.length ? Math.max(...prices) : fallbackPricePence;

  const sizes = [...DEFAULT_SIZE_OPTIONS];

  return { colors, sizes, minPrice, maxPrice };
}
