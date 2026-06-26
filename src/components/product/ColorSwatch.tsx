import type { PrintifyColor } from '../../../types/index.js';
import { cn } from '../../lib/utils.js';

interface ColorSwatchProps {
  colors: PrintifyColor[];
  selected: string | null;
  onSelect: (color: string) => void;
}

export function ColorSwatch({ colors, selected, onSelect }: ColorSwatchProps) {
  if (colors.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Colour
        </span>
        {selected && (
          <span className="text-xs font-semibold text-navy-800">— {selected}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {colors.map((color) => (
          <button
            key={color.name}
            onClick={() => onSelect(color.name)}
            title={color.name}
            aria-label={`Select ${color.name}`}
            aria-pressed={selected === color.name}
            className={cn(
              'relative h-10 w-10 rounded-full transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
              selected === color.name
                ? 'ring-2 ring-navy-800 ring-offset-[3px] scale-110'
                : 'ring-1 ring-black/10 hover:scale-110 hover:ring-black/20',
            )}
            style={{ backgroundColor: color.hex }}
          >
            {selected === color.name && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full">
                <svg
                  className="h-4 w-4 drop-shadow"
                  style={{ color: isLight(color.hex) ? '#0B1437' : '#ffffff' }}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}
