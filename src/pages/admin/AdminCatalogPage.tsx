import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { adminGetSettings, adminUpdateSettings } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import {
  DEFAULT_CATALOG_OPTIONS,
  createEmptyPricingRow,
  parseCatalogSettings,
  serializeCatalogSettings,
  type CatalogColorOption,
  type PricingRowOption,
} from '../../lib/catalog.js';

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

  function updateListItem(
    setter: Dispatch<SetStateAction<string[]>>,
    index: number,
    value: string,
  ) {
    setter((current) => current.map((item, i) => (i === index ? value : item)));
  }

  function addListItem(setter: Dispatch<SetStateAction<string[]>>) {
    setter((current) => [...current, '']);
  }

  function addPricingRow(patch: Partial<PricingRowOption> = {}) {
    setPricingRows((current) => [...current, createEmptyPricingRow(patch)]);
  }

  function removeListItem(setter: Dispatch<SetStateAction<string[]>>, index: number) {
    setter((current) => current.filter((_, i) => i !== index));
  }

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
        audiences: audiences.map((v) => v.trim()).filter(Boolean),
        products: products.map((v) => v.trim()).filter(Boolean),
        garments: garments.map((v) => v.trim()).filter(Boolean),
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
        <EditableListBox
          label="Audience"
          hint="Men / Womens / Kids"
          items={audiences}
          onUpdate={(index, value) => updateListItem(setAudiences, index, value)}
          onAdd={() => addListItem(setAudiences)}
          onRemove={(index) => removeListItem(setAudiences, index)}
        />

        <EditableListBox
          label="Product"
          hint="Tshirt / Hoody / Sweatshirt"
          items={products}
          onUpdate={(index, value) => updateListItem(setProducts, index, value)}
          onAdd={() => {
            addListItem(setProducts);
            addPricingRow({ product: '' });
          }}
          onRemove={(index) => removeListItem(setProducts, index)}
        />

        <EditableListBox
          label="Garment"
          hint="Mens Heavyweight and related fits"
          items={garments}
          onUpdate={(index, value) => updateListItem(setGarments, index, value)}
          onAdd={() => {
            addListItem(setGarments);
            addPricingRow({ garment: '' });
          }}
          onRemove={(index) => removeListItem(setGarments, index)}
        />
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {colors.map((color, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-100 bg-gray-50 p-3 shadow-sm dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    aria-label={`Colour swatch for ${color.name || 'untitled colour'}`}
                    className="h-10 w-10 flex-shrink-0 rounded-full border border-black/10 shadow-inner"
                    style={{ backgroundColor: color.hex }}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                      Colour
                    </p>
                    <input
                      value={color.name}
                      onChange={(e) => updateColor(index, { name: e.target.value })}
                      placeholder="Colour name"
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeColor(index)}
                  className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-red-400"
                >
                  X
                </button>
              </div>
              <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)] gap-2">
                <input
                  type="color"
                  value={color.hex}
                  onChange={(e) => updateColor(index, { hex: e.target.value })}
                  className="h-11 w-11 rounded-lg border border-gray-200 bg-transparent p-1 dark:border-gray-700"
                />
                <input
                  value={color.hex}
                  onChange={(e) => updateColor(index, { hex: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <PricingMatrixTable
        title="Online pricing (retail)"
        hint="What customers pay on the storefront. Margin is Sale price minus manufacturing cost and delivery."
        pricingRows={pricingRows}
        onAddRow={() => addPricingRow()}
        onUpdateRow={updatePricingRow}
        onRemoveRow={removePricingRow}
        channel="retail"
      />

      <PricingMatrixTable
        title="In-store pricing (partners)"
        hint="What clubs pay per garment for stock they sell in the clubhouse. Partner margin is Sale price (RRP) minus partner price — what you're giving up versus a retail sale. Net profit is partner price minus manufacturing cost and delivery — what you actually keep."
        pricingRows={pricingRows}
        onAddRow={() => addPricingRow()}
        onUpdateRow={updatePricingRow}
        onRemoveRow={removePricingRow}
        channel="partner"
      />
    </div>
  );
}

function PricingIdentityCells({
  row,
  onChange,
}: {
  row: PricingRowOption;
  onChange: (patch: Partial<PricingRowOption>) => void;
}) {
  return (
    <>
      <td className="px-2 py-1.5">
        <input value={row.audience} onChange={(e) => onChange({ audience: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
      </td>
      <td className="px-2 py-1.5">
        <input value={row.product} onChange={(e) => onChange({ product: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
      </td>
      <td className="px-2 py-1.5">
        <input value={row.garment} onChange={(e) => onChange({ garment: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
      </td>
      <td className="px-2 py-1.5">
        <input value={row.printSurface} onChange={(e) => onChange({ printSurface: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
      </td>
    </>
  );
}

function PricingMatrixTable({
  title,
  hint,
  pricingRows,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  channel,
}: {
  title: string;
  hint: string;
  pricingRows: PricingRowOption[];
  onAddRow: () => void;
  onUpdateRow: (index: number, patch: Partial<PricingRowOption>) => void;
  onRemoveRow: (index: number) => void;
  channel: 'partner' | 'retail';
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onAddRow}
          className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white"
        >
          Add row
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full table-fixed border-separate border-spacing-x-1 border-spacing-y-0 text-left">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              <th className="px-2 py-2">Audience</th>
              <th className="px-2 py-2">Product</th>
              <th className="px-2 py-2">Garment</th>
              <th className="px-2 py-2">Print surface</th>
              <th className="px-2 py-2">Manufacturing</th>
              {channel === 'retail' && <th className="px-2 py-2">Sale cost</th>}
              <th className="px-2 py-2">Delivery</th>
              {channel === 'partner' ? (
                <>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="Your income per garment on the partner order page">Partner price</th>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="Sale price (RRP) minus partner price">Partner margin</th>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="Partner price minus manufacturing cost and delivery — your actual profit on a partner order">Net profit</th>
                </>
              ) : (
                <>
                  <th className="px-2 py-2">Sale price</th>
                  <th className="px-2 py-2">Margin</th>
                </>
              )}
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pricingRows.map((row, index) => {
              const margin = Number.parseFloat(row.salePrice || '0') - Number.parseFloat(row.manufacturingCost || '0') - Number.parseFloat(row.delivery || '0');
              const partnerMargin = Number.parseFloat(row.salePrice || '0') - Number.parseFloat(row.partnerPrice || '0');
              const partnerNetProfit = Number.parseFloat(row.partnerPrice || '0') - Number.parseFloat(row.manufacturingCost || '0') - Number.parseFloat(row.delivery || '0');
              return (
                <tr key={index} className="border-t border-gray-100 dark:border-gray-800">
                  <PricingIdentityCells row={row} onChange={(patch) => onUpdateRow(index, patch)} />
                  <td className="px-2 py-1.5">
                    <input value={row.manufacturingCost} onChange={(e) => onUpdateRow(index, { manufacturingCost: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  </td>
                  {channel === 'retail' && (
                    <td className="px-2 py-1.5">
                      <input value={row.saleCost} onChange={(e) => onUpdateRow(index, { saleCost: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    </td>
                  )}
                  <td className="px-2 py-1.5">
                    <input value={row.delivery} onChange={(e) => onUpdateRow(index, { delivery: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  </td>
                  {channel === 'partner' ? (
                    <>
                      <td className="px-2 py-1.5">
                        <input value={row.partnerPrice} onChange={(e) => onUpdateRow(index, { partnerPrice: e.target.value })} placeholder="e.g. 11.29" className="w-full min-w-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-gray-100" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${partnerMargin >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{partnerMargin.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${partnerNetProfit >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{partnerNetProfit.toFixed(2)}
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1.5">
                        <input value={row.salePrice} onChange={(e) => onUpdateRow(index, { salePrice: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${margin >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{margin.toFixed(2)}
                        </div>
                      </td>
                    </>
                  )}
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(index)}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-red-400"
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
  );
}

function EditableListBox({
  label,
  hint,
  items,
  onUpdate,
  onAdd,
  onRemove,
}: {
  label: string;
  hint: string;
  items: string[];
  onUpdate: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white"
        >
          Add
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => onUpdate(index, e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-red-400"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
