import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../../../types/index.js';
import { formatPriceRange, cn } from '../../lib/utils.js';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const defaultImage = product.images.find((i) => i.isDefault) ?? product.images[0];
  const altImage     = product.images.find((i) => !i.isDefault && i !== defaultImage) ?? null;
  const [isHovered, setIsHovered] = useState(false);
  const showAltImage = !!altImage && isHovered;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group block focus:outline-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      {/* Image — portrait 3:4 */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100">
        {defaultImage ? (
          <>
            <img
              src={defaultImage.src}
              alt={product.title}
              className={cn(
                'absolute inset-0 h-full w-full object-cover object-center transition-all duration-700',
                showAltImage
                  ? 'opacity-0 scale-[1.04]'
                  : 'opacity-100 scale-100',
              )}
              loading="lazy"
            />
            {altImage && (
              <img
                src={altImage.src}
                alt={`${product.title} alternate view`}
                className={cn(
                  'absolute inset-0 h-full w-full object-cover object-center transition-all duration-700',
                  showAltImage
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-[1.04]',
                )}
                loading="lazy"
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-5xl opacity-10">🏓</span>
          </div>
        )}

        {/* "View Product" — desktop only */}
        <div className={cn(
          'absolute bottom-0 inset-x-0 transition-transform duration-300 ease-out',
          showAltImage ? 'translate-y-0' : 'translate-y-full',
        )}>
          <div className="bg-navy-800/90 backdrop-blur-sm py-3 text-center">
            <span className="text-[11px] font-bold text-white uppercase tracking-widest">
              View Product →
            </span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 space-y-1 px-0.5">
        <h3 className={cn(
          'text-sm font-bold text-navy-800 transition-colors leading-snug line-clamp-2',
          showAltImage ? 'text-brand-500' : '',
        )}>
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
              <span className="text-xs text-gray-400 font-semibold">
                +{product.colors.length - 7}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
