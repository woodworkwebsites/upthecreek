import { cn } from '../../lib/utils.js';

export interface ColorOption {
  name: string;
  hex: string;
}

interface ColorMultiSelectProps {
  colors: ColorOption[];
  selected: string[];
  onToggle: (color: ColorOption) => void;
  label?: string;
}

export function ColorMultiSelect({
  colors,
  selected,
  onToggle,
  label = 'Colours',
}: ColorMultiSelectProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
          {label}
        </span>
        <span className="text-xs font-semibold text-gray-500">
          {selected.length > 0 ? `${selected.length} selected` : 'None selected'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => {
          const isSelected = selected.includes(color.name);

          return (
            <button
              key={color.name}
              type="button"
              onClick={() => onToggle(color)}
              aria-pressed={isSelected}
              title={color.name}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
                isSelected
                  ? 'border-navy-800 bg-navy-800 text-white shadow-md shadow-navy-900/20'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-navy-800 hover:text-navy-800',
              )}
            >
              <span
                className="h-4 w-4 rounded-full border border-black/10"
                style={{ backgroundColor: color.hex }}
              />
              {color.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
