import type { Product } from '../../../types/index.js';
import { ProductCard } from './ProductCard.js';

interface ProductGridProps {
  products: Product[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center gap-3">
        <span className="text-5xl opacity-20">🏓</span>
        <p className="font-bold text-navy-800">No products found.</p>
        <p className="text-sm text-gray-400">Check back soon or sync products from the admin panel.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-8 lg:gap-y-14">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
