import type { PrintifyVariant, PrintifyColor } from '../../types/index.js';

const STANDARD_SIZE_ORDER = [
  'XS',
  'Extra Small',
  'S',
  'Small',
  'M',
  'Medium',
  'L',
  'Large',
  'XL',
  '2XL',
  '3XL',
  '4XL',
];

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
): ProductAggregates {
  const colors: PrintifyColor[] = [];
  const colorsSeen = new Set<string>();
  const sizesSeen = new Set<string>();

  for (const variant of variants) {
    if (variant.color && !colorsSeen.has(variant.color)) {
      colorsSeen.add(variant.color);
      colors.push({ name: variant.color, hex: colorHexByName.get(variant.color) ?? '#cccccc' });
    }
    if (variant.size) sizesSeen.add(variant.size);
  }

  const prices = variants.map((v) => v.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  const sizes = Array.from(sizesSeen).sort((a, b) => {
    const ai = STANDARD_SIZE_ORDER.indexOf(a);
    const bi = STANDARD_SIZE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return { colors, sizes, minPrice, maxPrice };
}
