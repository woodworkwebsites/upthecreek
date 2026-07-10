import { useCallback, useEffect, useState } from 'react';
import { adminGetSettings, adminUpdateSettings } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import {
  DEFAULT_CATALOG_OPTIONS,
  parseCatalogSettings,
  serializeCatalogSettings,
  type CatalogColorOption,
  type PricingRowOption,
} from '../../lib/catalog.js';

function linesToList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(values: string[]): string {
  return values.join('\n');
}

export default function AdminCatalogPage() {
  const { token } = useAdminToken();
  const [audiences, setAudiences] = useState(DEFAULT_CATALOG_OPTIONS.audiences);
  const [products, setProducts] = useState(DEFAULT_CATALOG_OPTIONS.products);
  const [garments, setGarments] = useState(DEFAULT_CATALOG_OPTIONS.garments);
  const [colors, setColors] = useState<CatalogColorOption[]>(DEFAULT_CATALOG_OPTIONS.colors);
  const [pricingRows, setPricingRows] = useState<PricingRowOption[]>(DEFAULT_CATALOG_OPTIONS.pricingRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const settings = await adminGetSettings(token);
      const catalog = parseCatalogSettings(settings);
      setAudiences(catalog.audiences);
      setProducts(catalog.products);
      setGarments(catalog.garments);
      setColors(catalog.colors);
      setPricingRows(catalog.pricingRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog options');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function updateColor(index: number, patch: Partial<CatalogColorOption>) {
    setColors((current) => current.map((color, i) => (i === index ? { ...color, ...patch } : color)));
  }

  function addColor() {
    setColors((current) => [...current, { name: '', hex: '#111827' }]);
  }

  function removeColor(index: number) {
    setColors((current) => current.filter((_, i) => i !== index));
  }

  function updatePricingRow(index: number, patch: Partial<PricingRowOption>) {
    setPricingRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addPricingRow() {
    setPricingRows((current) => [...current, {
      audience: '',
      product: '',
      garment: '',
      printSurface: '',
      manufacturingCost: '',
      saleCost: '',
      delivery: '',
      salePrice: '',
    }]);
  }

  function removePricingRow(index: number) {
    setPricingRows((current) => current.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await adminUpdateSettings(token, serializeCatalogSettings({
        audiences: linesToList(listToLines(audiences)),
        products: linesToList(listToLines(products)),
        garments: linesToList(listToLines(garments)),
        colors: colors
          .map((color) => ({ name: color.name.trim(), hex: color.hex.trim() || '#111827' }))
          .filter((color) => color.name.length > 0),
        pricingRows,
      }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save catalog options');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Catalog options</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            These lists feed the product admin dropdowns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAudiences(DEFAULT_CATALOG_OPTIONS.audiences);
              setProducts(DEFAULT_CATALOG_OPTIONS.products);
              setGarments(DEFAULT_CATALOG_OPTIONS.garments);
              setColors(DEFAULT_CATALOG_OPTIONS.colors);
              setPricingRows(DEFAULT_CATALOG_OPTIONS.pricingRows);
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Reset defaults
          </button>
          <button
            type="button"
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save options'}
          </button>
        </div>
      </div>

      {saved && <p className="text-sm font-semibold text-green-600 dark:text-green-400">Saved</p>}
      {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Audience</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Men / Womens / Kids</p>
          <textarea
            value={listToLines(audiences)}
            onChange={(e) => setAudiences(linesToList(e.target.value))}
            rows={8}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Product</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tshirt / Hoody / Sweatshirt</p>
          <textarea
            value={listToLines(products)}
            onChange={(e) => setProducts(linesToList(e.target.value))}
            rows={8}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Garment</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Mens Heavyweight and related fits</p>
          <textarea
            value={listToLines(garments)}
            onChange={(e) => setGarments(linesToList(e.target.value))}
            rows={8}
            className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Colours</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Name plus hex swatch for the admin table.</p>
          </div>
          <button
            type="button"
            onClick={addColor}
            className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white"
          >
            Add colour
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {colors.map((color, index) => (
            <div key={`${color.name}-${index}`} className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950 sm:grid-cols-[1fr_160px_auto] sm:items-center">
              <input
                value={color.name}
                onChange={(e) => updateColor(index, { name: e.target.value })}
                placeholder="Colour name"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => updateColor(index, { hex: e.target.value })}
                  className="h-10 w-14 rounded-lg border border-gray-200 bg-transparent p-1 dark:border-gray-700"
                />
                <input
                  value={color.hex}
                  onChange={(e) => updateColor(index, { hex: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                type="button"
                onClick={() => removeColor(index)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pricing Matrix Presets</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Default row templates for the matrix in the product creator.</p>
          </div>
          <button
            type="button"
            onClick={addPricingRow}
            className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white"
          >
            Add row
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1320px] w-full border-separate border-spacing-0 text-left">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                <th className="px-3 py-3">Audience</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">Garment</th>
                <th className="px-3 py-3">Print surface</th>
                <th className="px-3 py-3">Manufacturing</th>
                <th className="px-3 py-3">Sale cost</th>
                <th className="px-3 py-3">Delivery</th>
                <th className="px-3 py-3">Sale price</th>
                <th className="px-3 py-3">Margin</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pricingRows.map((row, index) => {
                const margin = Number.parseFloat(row.salePrice || '0') - Number.parseFloat(row.manufacturingCost || '0') - Number.parseFloat(row.delivery || '0');
                return (
                  <tr key={`${row.audience}-${row.product}-${row.garment}-${index}`} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">
                      <input value={row.audience} onChange={(e) => updatePricingRow(index, { audience: e.target.value })} className="w-32 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.product} onChange={(e) => updatePricingRow(index, { product: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.garment} onChange={(e) => updatePricingRow(index, { garment: e.target.value })} className="w-44 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.printSurface} onChange={(e) => updatePricingRow(index, { printSurface: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.manufacturingCost} onChange={(e) => updatePricingRow(index, { manufacturingCost: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.saleCost} onChange={(e) => updatePricingRow(index, { saleCost: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.delivery} onChange={(e) => updatePricingRow(index, { delivery: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={row.salePrice} onChange={(e) => updatePricingRow(index, { salePrice: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                    <td className="px-3 py-2">
                      <div className={`rounded-lg px-2 py-2 text-xs font-semibold ${margin >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                        £{margin.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removePricingRow(index)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
