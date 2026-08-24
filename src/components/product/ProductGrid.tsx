import type { Product } from '../../../types/index.js';
import { ProductCard } from './ProductCard.js';

interface ProductGridProps {
  products: Product[];
  priceLabel?: string;
  toPrefix?: string;
}

export function ProductGrid({ products, priceLabel, toPrefix }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center gap-3">
        <img
          src="/UTC_Logo.png"
          alt="UTC logo"
          className="h-24 w-24 object-contain opacity-20"
          loading="lazy"
        />
        <p className="font-bold text-navy-800">No products found.</p>
        <p className="text-sm text-gray-400">Check back soon or sync products from the admin panel.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-2 justify-items-center gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-14">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} priceLabel={priceLabel} toPrefix={toPrefix} />
      ))}
    </div>
  );
}
