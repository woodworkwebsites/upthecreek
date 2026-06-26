import { useState, useEffect } from 'react';
import type { PrintifyProductImage } from '../../../types/index.js';
import { cn } from '../../lib/utils.js';

interface ImageGalleryProps {
  images: PrintifyProductImage[];
  activeVariantIds?: number[];
  title: string;
}

export function ImageGallery({ images, activeVariantIds, title }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const relevantImages = activeVariantIds && activeVariantIds.length > 0
    ? images.filter((img) =>
        img.isDefault || img.variantIds.some((id) => activeVariantIds.includes(id))
      )
    : images;

  const displayImages = relevantImages.length > 0 ? relevantImages : images;

  useEffect(() => {
    setActiveIndex(0);
  }, [activeVariantIds]);

  const current = displayImages[activeIndex] ?? displayImages[0];
  if (!current) {
    return (
      <div className="aspect-square w-full rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <span className="text-gray-400 text-sm">No image</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-gray-50 dark:bg-gray-900">
        <img
          src={current.src}
          alt={title}
          className="h-full w-full object-cover object-center transition-opacity duration-200"
          loading="eager"
        />
      </div>

      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {displayImages.map((img, i) => (
            <button
              key={img.src}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'flex-shrink-0 h-16 w-16 overflow-hidden rounded-lg border-2 transition-all',
                i === activeIndex
                  ? 'border-gray-900 dark:border-white'
                  : 'border-transparent opacity-60 hover:opacity-90',
              )}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={img.src}
                alt={`${title} ${i + 1}`}
                className="h-full w-full object-cover object-center"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
