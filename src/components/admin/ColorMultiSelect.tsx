import { useMemo } from 'react';
import { cn } from '../../lib/utils.js';

export interface ColorOption {
  name: string;
  hex: string;
  orderUrl?: string | null;
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
  const selectedColors = useMemo(
    () => colors.filter((color) => selected.includes(color.name)),
    [colors, selected],
  );
  const remainingColors = useMemo(
    () => colors.filter((color) => !selected.includes(color.name)),
    [colors, selected],
  );

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
      <div className="flex flex-wrap items-center gap-2">
        {selectedColors.map((color) => (
          <button
            key={color.name}
            type="button"
            onClick={() => onToggle(color)}
            aria-pressed="true"
            title={`Remove ${color.name}`}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors',
              'border-navy-800 bg-navy-800 text-white shadow-md shadow-navy-900/20',
            )}
          >
            <span
              className="h-3.5 w-3.5 rounded-full border border-white/20"
              style={{ backgroundColor: color.hex }}
            />
          </button>
        ))}
        <details className="group relative">
          <summary
            className={cn(
              'list-none inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-full border px-2 text-xs font-black transition-colors',
              remainingColors.length > 0
                ? 'border-gray-200 bg-white text-gray-700 hover:border-navy-800 hover:text-navy-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:border-navy-500 dark:hover:text-navy-300'
                : 'border-dashed border-gray-200 bg-gray-50 text-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-600',
            )}
          >
            +
          </summary>
          <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                Remaining colours
              </span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                {remainingColors.length}
              </span>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {remainingColors.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                  No unused colours.
                </p>
              ) : (
                remainingColors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => onToggle(color)}
                    className="flex w-full items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-xs font-semibold text-gray-700 hover:border-gray-200 hover:bg-gray-50 dark:text-gray-200 dark:hover:border-gray-700 dark:hover:bg-gray-800/70"
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="truncate">{color.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
