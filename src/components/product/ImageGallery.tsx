import type { RefObject } from 'react';
import { useState, useEffect, useRef } from 'react';
import type { PrintifyProductImage } from '../../../types/index.js';
import { cn } from '../../lib/utils.js';

interface ImageGalleryProps {
  images: PrintifyProductImage[];
  activeVariantIds?: number[];
  selectedColor?: string | null;
  previewTriggerRef?: RefObject<HTMLDivElement | null>;
  personalizationEnabled?: boolean;
  title: string;
  priceLabel: string;
}

export function ImageGallery({
  images,
  activeVariantIds,
  selectedColor,
  previewTriggerRef,
  personalizationEnabled = false,
  title,
  priceLabel,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Colour tags are the source of truth when a colour is selected.
  // Variant matching is only used when no specific colour is active.
  const colorImages = selectedColor
    ? images.filter((img) => img.color === selectedColor)
    : activeVariantIds && activeVariantIds.length > 0
    ? images.filter((img) =>
        img.variantIds.length <= 10 &&
        img.variantIds.some((id) => activeVariantIds.includes(id))
      )
    : [];

  const imageSource = colorImages.length > 0 ? colorImages : images;
  const defaultImage = images.find((image) => image.isDefault);
  // The default image is a product-level hero and may not be tagged to the
  // currently selected colour, so keep it visible before colour-specific images.
  const displayImages = [
    ...(defaultImage ? [defaultImage] : []),
    ...imageSource.filter((image) => image !== defaultImage),
  ];

  useEffect(() => {
    setActiveIndex(0);
  }, [activeVariantIds, selectedColor]);

  useEffect(() => {
    if (activeIndex >= displayImages.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, displayImages.length]);

  function goPrevious() {
    setActiveIndex((index) => (index - 1 + displayImages.length) % displayImages.length);
  }

  function goNext() {
    setActiveIndex((index) => (index + 1) % displayImages.length);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) setActiveIndex((i) => Math.min(i + 1, displayImages.length - 1));
    else        setActiveIndex((i) => Math.max(i - 1, 0));
  }

  const current = displayImages[activeIndex] ?? displayImages[0];
  if (!current) {
    return (
      <div className="aspect-[3/4] w-full rounded-2xl bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400 text-sm">No image</span>
      </div>
    );
  }

  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)_64px] gap-x-2 sm:grid-cols-[minmax(0,1fr)_76px] sm:gap-x-3 lg:grid-cols-[minmax(0,1fr)_88px] lg:gap-x-4">
      {/* Main image — portrait 3:4 matches the shop card ratio */}
      <div
        className="relative flex aspect-[4/5] w-full min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-xl shadow-navy-900/5 ring-1 ring-black/5 lg:aspect-[3/4]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <img
            src={current.src}
            alt={title}
            className="h-full w-full object-contain object-center transition-opacity duration-200"
            loading="eager"
          />
          {personalizationEnabled && (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-navy-800 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-md sm:left-4 sm:top-4 sm:px-3.5 sm:text-xs">
              Personalise This
            </span>
          )}
          {displayImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrevious}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-gray-950/70 p-2 text-white shadow-lg shadow-black/20 backdrop-blur-sm transition hover:bg-gray-950"
              >
                <span className="block text-lg leading-none">‹</span>
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-gray-950/70 p-2 text-white shadow-lg shadow-black/20 backdrop-blur-sm transition hover:bg-gray-950"
              >
                <span className="block text-lg leading-none">›</span>
              </button>
            </>
          )}
          {/* Dot indicators — mobile only */}
          {displayImages.length > 1 && (
            <div className="lg:hidden absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {displayImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Image ${i + 1}`}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50',
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex h-12 flex-shrink-0 items-center gap-3 bg-navy-800 px-4 text-white sm:h-14 sm:px-5" aria-label={`${title}, ${priceLabel}`}>
          <span className="min-w-0 flex-1 truncate text-sm font-bold sm:text-base">{title}</span>
          <span className="flex-shrink-0 whitespace-nowrap text-sm font-black sm:text-base">{priceLabel}</span>
        </div>
        <div ref={previewTriggerRef} aria-hidden className="absolute left-0 top-0 h-px w-px" />
      </div>

      {displayImages.length > 1 && (
        <div aria-label="Product images" className="absolute inset-y-0 right-0 flex min-h-0 w-16 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-1 touch-pan-y sm:w-[4.75rem] lg:w-[5.5rem]">
          {displayImages.map((img, i) => (
            <button
              key={img.src}
              onClick={() => setActiveIndex(i)}
              className={cn(
                'aspect-[3/4] w-full flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all',
                i === activeIndex
                  ? 'border-navy-800 shadow-md shadow-navy-900/10'
                  : 'border-transparent opacity-50 hover:opacity-80',
              )}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={img.src}
                alt={`${title} ${i + 1}`}
                className="h-full w-full object-contain object-center bg-white"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
