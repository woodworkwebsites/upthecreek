import { cn } from '../../lib/utils.js';

interface SizeSelectorProps {
  sizes: string[];
  selected: string | null;
  onSelect: (size: string) => void;
  unavailable?: string[];
}

export function SizeSelector({
  sizes,
  selected,
  onSelect,
  unavailable = [],
}: SizeSelectorProps) {
  if (sizes.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Size
        </span>
        {selected && (
          <span className="text-xs font-semibold text-navy-800">— {selected}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const isUnavailable = unavailable.includes(size);
          const isSelected    = selected === size;

          return (
            <button
              key={size}
              onClick={() => !isUnavailable && onSelect(size)}
              disabled={isUnavailable}
              aria-pressed={isSelected}
              aria-label={`Size ${size}${isUnavailable ? ' (out of stock)' : ''}`}
              className={cn(
                'relative h-11 min-w-[2.75rem] rounded-lg border-2 px-3.5 text-sm font-bold',
                'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                isSelected
                  ? 'border-navy-800 bg-navy-800 text-white shadow-md shadow-navy-900/20'
                  : isUnavailable
                  ? 'cursor-not-allowed border-gray-100 text-gray-300'
                  : 'border-gray-200 text-gray-700 hover:border-navy-800 hover:text-navy-800',
              )}
            >
              {size}
              {isUnavailable && (
                <span
                  aria-hidden
                  className="absolute inset-0 overflow-hidden rounded-lg"
                  style={{
                    background:
                      'linear-gradient(to top right, transparent calc(50% - 0.5px), #d1d5db, transparent calc(50% + 0.5px))',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
