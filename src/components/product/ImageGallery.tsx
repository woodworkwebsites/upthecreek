import type { RefObject } from 'react';
import { useState, useEffect } from 'react';
import type { PrintifyProductImage } from '../../../types/index.js';
import { cn } from '../../lib/utils.js';

interface ImageGalleryProps {
  images: PrintifyProductImage[];
  activeVariantIds?: number[];
  selectedColor?: string | null;
  previewTriggerRef?: RefObject<HTMLDivElement | null>;
  title: string;
}

export function ImageGallery({
  images,
  activeVariantIds,
  selectedColor,
  previewTriggerRef,
  title,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedColorImages = selectedColor
    ? images.filter((img) => img.color === selectedColor)
    : [];

  // When a colour is selected, only show images that are colour-specific.
  // After sync, Printify mockup images have exactly 1 variantId (extracted from
  // the URL). Lifestyle/studio shots that couldn't be mapped keep all ~55 variantIds.
  // Anything with more than 10 variantIds is treated as a "global" image and excluded
  // when a specific colour is active, so they don't swamp the colour-matched results.
  const colorImages = selectedColorImages.length > 0
    ? selectedColorImages
    : activeVariantIds && activeVariantIds.length > 0
    ? images.filter((img) =>
        img.variantIds.length <= 10 &&
        img.variantIds.some((id) => activeVariantIds.includes(id))
      )
    : [];

  const displayImages = colorImages.length > 0 ? colorImages : images;

  useEffect(() => {
    setActiveIndex(0);
  }, [activeVariantIds, selectedColor]);

  const current = displayImages[activeIndex] ?? displayImages[0];
  if (!current) {
    return (
      <div className="aspect-[3/4] w-full rounded-2xl bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400 text-sm">No image</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:flex lg:items-start lg:gap-4 lg:space-y-0">
      {/* Main image — portrait 3:4 matches the shop card ratio */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-white shadow-xl shadow-navy-900/5 ring-1 ring-black/5 lg:flex-1">
        <img
          src={current.src}
          alt={title}
          className="h-full w-full object-cover object-top transition-opacity duration-200"
          loading="eager"
        />
        <div ref={previewTriggerRef} aria-hidden className="absolute bottom-0 left-0 right-0 h-px" />
      </div>

      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pb-0 lg:max-h-[calc(100vh-12rem)]">
          {displayImages.map((img, i) => (
            <button
              key={img.src}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'flex-shrink-0 aspect-[3/4] w-[72px] overflow-hidden rounded-xl border-2 transition-all lg:w-[88px]',
                i === activeIndex
                  ? 'border-navy-800 shadow-md shadow-navy-900/10'
                  : 'border-transparent opacity-50 hover:opacity-80',
              )}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={img.src}
                alt={`${title} ${i + 1}`}
                className="h-full w-full object-cover object-top"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
