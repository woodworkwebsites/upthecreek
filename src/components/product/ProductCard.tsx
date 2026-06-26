import { Link } from 'react-router-dom';
import type { Product } from '../../../types/index.js';
import { formatPriceRange } from '../../lib/utils.js';
import { cn } from '../../lib/utils.js';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const defaultImage = product.images.find((i) => i.isDefault) ?? product.images[0];
  const altImage     = product.images.find((i) => !i.isDefault && i !== defaultImage) ?? null;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group block focus:outline-none"
    >
      {/* Image container — portrait 3:4 */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100">
        {defaultImage ? (
          <>
            <img
              src={defaultImage.src}
              alt={product.title}
              className={cn(
                'absolute inset-0 h-full w-full object-cover object-center transition-all duration-700',
                altImage
                  ? 'group-hover:opacity-0'
                  : 'group-hover:scale-[1.04]',
              )}
              loading="lazy"
            />
            {altImage && (
              <img
                src={altImage.src}
                alt={`${product.title} alternate view`}
                className="absolute inset-0 h-full w-full object-cover object-center opacity-0 scale-[1.04] group-hover:opacity-100 group-hover:scale-100 transition-all duration-700"
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-5xl opacity-10">🏓</span>
          </div>
        )}

        {/* Colour count badge */}
        {product.colors.length > 1 && (
          <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 shadow-sm">
            <span className="text-[10px] font-bold text-navy-800 uppercase tracking-wide">
              {product.colors.length} colours
            </span>
          </div>
        )}

        {/* Hover CTA */}
        <div className="absolute bottom-0 inset-x-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
          <div className="bg-navy-800/90 backdrop-blur-sm py-3 text-center">
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">
              View Product →
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 space-y-1 px-0.5">
        <h3 className="text-sm font-bold text-navy-800 group-hover:text-brand-500 transition-colors leading-snug line-clamp-2">
          {product.title}
        </h3>
        <p className="text-sm font-semibold text-gray-400">
          {formatPriceRange(product.minPrice, product.maxPrice)}
        </p>
        {product.colors.length > 0 && (
          <div className="flex items-center gap-1.5 pt-1.5">
            {product.colors.slice(0, 7).map((c) => (
              <span
                key={c.name}
                title={c.name}
                className="h-3.5 w-3.5 rounded-full border border-black/10 flex-shrink-0"
                style={{ backgroundColor: c.hex }}
              />
            ))}
            {product.colors.length > 7 && (
              <span className="text-xs text-gray-400 font-semibold">+{product.colors.length - 7}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
