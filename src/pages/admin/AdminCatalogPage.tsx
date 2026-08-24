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
import { calculateCommissionFromGross, calculateNetProfitFromRrp, excludeVat } from '../../lib/pricing.js';

const emptyGarmentDraft = {
  name: '',
  audience: '',
  product: '',
  printSurface: '',
  manufacturingCost: '',
  saleCost: '',
  deliveryRetail: '',
  deliveryPartner: '',
  deliveryOnlinePartnership: '',
  salePrice: '',
  partnerPrice: '',
};

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
  const [garmentModalOpen, setGarmentModalOpen] = useState(false);
  const [garmentDraft, setGarmentDraft] = useState(emptyGarmentDraft);

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

  function openGarmentModal() {
    setGarmentDraft({
      ...emptyGarmentDraft,
      audience: audiences[0] ?? '',
      product: products[0] ?? '',
    });
    setGarmentModalOpen(true);
  }

  function updateGarmentDraft(patch: Partial<typeof emptyGarmentDraft>) {
    setGarmentDraft((current) => ({ ...current, ...patch }));
  }

  function handleCreateGarment() {
    const name = garmentDraft.name.trim();
    if (!name) return;

    setGarments((current) => (current.includes(name) ? current : [...current, name]));
    addPricingRow({
      audience: garmentDraft.audience.trim(),
      product: garmentDraft.product.trim(),
      garment: name,
      printSurface: garmentDraft.printSurface.trim(),
      manufacturingCost: garmentDraft.manufacturingCost.trim(),
      saleCost: garmentDraft.saleCost.trim(),
      deliveryRetail: garmentDraft.deliveryRetail.trim(),
      deliveryPartner: garmentDraft.deliveryPartner.trim(),
      deliveryOnlinePartnership: garmentDraft.deliveryOnlinePartnership.trim(),
      salePrice: garmentDraft.salePrice.trim(),
      partnerPrice: garmentDraft.partnerPrice.trim(),
    });
    setGarmentModalOpen(false);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Catalog options</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            These lists feed the product admin dropdowns.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
          onAdd={() => addListItem(setProducts)}
          onRemove={(index) => removeListItem(setProducts, index)}
        />

        <EditableListBox
          label="Garment"
          hint="Adding a garment opens the pricing matrix modal"
          items={garments}
          onUpdate={(index, value) => updateListItem(setGarments, index, value)}
          onAdd={openGarmentModal}
          onRemove={(index) => removeListItem(setGarments, index)}
        />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        hint="What customers pay on the storefront. Margin is Sale price minus manufacturing cost and delivery. New rows come from adding a garment above."
        pricingRows={pricingRows}
        onUpdateRow={updatePricingRow}
        onRemoveRow={removePricingRow}
        onAddRow={() => addPricingRow()}
        channel="retail"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <PricingMatrixTable
          title="Collaboration pricing (online)"
          hint="Club-code orders use sale cost plus online delivery. RRP is shown as the shared reference for both collaboration paths."
          pricingRows={pricingRows}
          onUpdateRow={updatePricingRow}
          onRemoveRow={removePricingRow}
          onAddRow={() => addPricingRow()}
          channel="collaboration"
          collaborationMode="online"
        />

        <PricingMatrixTable
          title="Collaboration pricing (in-store)"
          hint="Partner orders use partner price plus in-store delivery. RRP stays shared with the online table."
          pricingRows={pricingRows}
          onUpdateRow={updatePricingRow}
          onRemoveRow={removePricingRow}
          onAddRow={() => addPricingRow()}
          channel="collaboration"
          collaborationMode="instore"
        />
      </div>

      {garmentModalOpen && (
        <GarmentPricingModal
          draft={garmentDraft}
          audiences={audiences}
          products={products}
          onChange={updateGarmentDraft}
          onCancel={() => setGarmentModalOpen(false)}
          onSubmit={handleCreateGarment}
        />
      )}
    </div>
  );
}

function GarmentPricingModal({
  draft,
  audiences,
  products,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: typeof emptyGarmentDraft;
  audiences: string[];
  products: string[];
  onChange: (patch: Partial<typeof emptyGarmentDraft>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = draft.name.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add garment"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">New garment</p>
        <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Add garment &amp; pricing</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          This adds the garment to the list and creates one pricing row with separate delivery values per sale path.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Garment name</span>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. Mens Heavyweight"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Audience</span>
            <input
              list="garment-modal-audiences"
              value={draft.audience}
              onChange={(e) => onChange({ audience: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <datalist id="garment-modal-audiences">
              {audiences.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Product</span>
            <input
              list="garment-modal-products"
              value={draft.product}
              onChange={(e) => onChange({ product: e.target.value })}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <datalist id="garment-modal-products">
              {products.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Print surface</span>
            <input
              value={draft.printSurface}
              onChange={(e) => onChange({ printSurface: e.target.value })}
              placeholder="e.g. Double"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Manufacturing cost</span>
            <input
              value={draft.manufacturingCost}
              onChange={(e) => onChange({ manufacturingCost: e.target.value })}
              placeholder="e.g. 8.30"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Retail delivery</span>
            <input
              value={draft.deliveryRetail}
              onChange={(e) => onChange({ deliveryRetail: e.target.value })}
              placeholder="e.g. 2.99"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Partner delivery</span>
            <input
              value={draft.deliveryPartner}
              onChange={(e) => onChange({ deliveryPartner: e.target.value })}
              placeholder="e.g. 2.99"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Online partnership delivery</span>
            <input
              value={draft.deliveryOnlinePartnership}
              onChange={(e) => onChange({ deliveryOnlinePartnership: e.target.value })}
              placeholder="e.g. 2.99"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Sale cost</span>
            <input
              value={draft.saleCost}
              onChange={(e) => onChange({ saleCost: e.target.value })}
              placeholder="e.g. 22.00"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Sale price (RRP)</span>
            <input
              value={draft.salePrice}
              onChange={(e) => onChange({ salePrice: e.target.value })}
              placeholder="e.g. 24.99"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-amber-600 dark:text-amber-400">Partner price</span>
            <input
              value={draft.partnerPrice}
              onChange={(e) => onChange({ partnerPrice: e.target.value })}
              placeholder="e.g. 11.29"
              className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-gray-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-gray-100"
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Create garment
          </button>
        </div>
      </div>
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
  onUpdateRow,
  onRemoveRow,
  onAddRow,
  channel,
  collaborationMode,
}: {
  title: string;
  hint: string;
  pricingRows: PricingRowOption[];
  onUpdateRow: (index: number, patch: Partial<PricingRowOption>) => void;
  onRemoveRow: (index: number) => void;
  onAddRow: () => void;
  channel: 'partner' | 'retail' | 'online-partnership' | 'collaboration';
  collaborationMode?: 'online' | 'instore';
}) {
  const isCollaborationOnline = channel === 'collaboration' && collaborationMode === 'online';
  const isCollaborationInStore = channel === 'collaboration' && collaborationMode === 'instore';

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
        </div>
        <button
          type="button"
          onClick={onAddRow}
          className="inline-flex items-center justify-center rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-700"
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
              {(channel === 'retail' || channel === 'online-partnership') && <th className="px-2 py-2">Delivery</th>}
              {channel === 'partner' && <th className="px-2 py-2">In-store delivery</th>}
              {channel === 'collaboration' && isCollaborationOnline && (
                <>
                  <th className="px-2 py-2">Sale cost</th>
                  <th className="px-2 py-2">Online delivery</th>
                  <th className="px-2 py-2">Sale price (RRP)</th>
                  <th className="px-2 py-2" title="Sale cost plus online delivery, less the purchaser's 10% club discount and VAT">Purchaser price (−10%)</th>
                  <th className="px-2 py-2" title="10% of the discounted purchaser price, excluding VAT">Club commission (10%)</th>
                  <th className="px-2 py-2" title="Post-discount purchaser price excluding VAT, minus commission, manufacturing cost and online delivery">My margin</th>
                </>
              )}
              {channel === 'collaboration' && isCollaborationInStore && (
                <>
                  <th className="px-2 py-2">In-store delivery</th>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="Your income per garment on the partner order page">Partner price</th>
                  <th className="px-2 py-2">Sale price (RRP)</th>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="Sale price (RRP) minus partner price">Partner margin</th>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="RRP minus wholesale price minus 20% VAT on RRP">Net profit</th>
                </>
              )}
              {channel === 'partner' && (
                <>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="Your income per garment on the partner order page">Partner price</th>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="Sale price (RRP) minus partner price">Partner margin</th>
                  <th className="px-2 py-2 text-amber-700 dark:text-amber-400" title="RRP minus wholesale price minus 20% VAT on RRP">Net profit</th>
                </>
              )}
              {channel === 'retail' && (
                <>
                  <th className="px-2 py-2">Sale price</th>
                  <th className="px-2 py-2">Margin</th>
                </>
              )}
              {channel === 'online-partnership' && (
                <>
                  <th className="px-2 py-2">Sale cost</th>
                  <th className="px-2 py-2" title="Sale cost plus delivery, less the purchaser's 10% club discount and VAT">Purchaser price (−10%)</th>
                  <th className="px-2 py-2" title="10% of the discounted purchaser price, excluding VAT">Club commission (10%)</th>
                  <th className="px-2 py-2" title="Post-discount purchaser price excluding VAT, minus commission, manufacturing cost and delivery">My margin</th>
                </>
              )}
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pricingRows.map((row, index) => {
              const salePrice = Number.parseFloat(row.salePrice || '0');
              const saleCost = Number.parseFloat(row.saleCost || '0');
              const manufacturingCost = Number.parseFloat(row.manufacturingCost || '0');
              const deliveryValue = channel === 'retail'
                ? row.deliveryRetail
                : channel === 'partner'
                  ? row.deliveryPartner
                  : row.deliveryOnlinePartnership;
              const delivery = Number.parseFloat(deliveryValue || '0');
              const onlineDelivery = Number.parseFloat(row.deliveryOnlinePartnership || '0');
              const margin = salePrice - manufacturingCost - delivery;
              const partnerMargin = salePrice - Number.parseFloat(row.partnerPrice || '0');
              const partnerNetProfit = calculateNetProfitFromRrp(salePrice, Number.parseFloat(row.partnerPrice || '0'));
              const purchaserPrice = (saleCost + onlineDelivery) * 0.9;
              const netPurchaserPrice = excludeVat(purchaserPrice);
              const clubCommission = calculateCommissionFromGross(purchaserPrice);
              const onlinePartnershipMargin = netPurchaserPrice - clubCommission - manufacturingCost - onlineDelivery;
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
                  {channel !== 'collaboration' && (
                    <td className="px-2 py-1.5">
                      <input
                        value={deliveryValue}
                        onChange={(e) => onUpdateRow(index, channel === 'retail'
                          ? { deliveryRetail: e.target.value }
                          : channel === 'partner'
                            ? { deliveryPartner: e.target.value }
                            : { deliveryOnlinePartnership: e.target.value })}
                        className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                    </td>
                  )}
                  {channel === 'partner' && (
                    <>
                      <td className="px-2 py-1.5">
                        <input value={row.partnerPrice} onChange={(e) => onUpdateRow(index, { partnerPrice: e.target.value })} placeholder="e.g. 11.29" className="w-full min-w-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-gray-100" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${partnerMargin >= 0 ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{partnerMargin.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${partnerNetProfit >= 0 ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{partnerNetProfit.toFixed(2)}
                        </div>
                      </td>
                    </>
                  )}
                  {channel === 'retail' && (
                    <>
                      <td className="px-2 py-1.5">
                        <input value={row.salePrice} onChange={(e) => onUpdateRow(index, { salePrice: e.target.value })} className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${margin >= 0 ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{margin.toFixed(2)}
                        </div>
                      </td>
                    </>
                  )}
                  {channel === 'online-partnership' && (
                    <>
                      <td className="px-2 py-1.5">
                        <div className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          £{saleCost.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                          £{purchaserPrice.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                          £{clubCommission.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${onlinePartnershipMargin >= 0 ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{onlinePartnershipMargin.toFixed(2)}
                        </div>
                      </td>
                    </>
                  )}
                  {channel === 'collaboration' && isCollaborationOnline && (
                    <>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.saleCost}
                          onChange={(e) => onUpdateRow(index, { saleCost: e.target.value })}
                          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.deliveryOnlinePartnership}
                          onChange={(e) => onUpdateRow(index, { deliveryOnlinePartnership: e.target.value })}
                          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.salePrice}
                          onChange={(e) => onUpdateRow(index, { salePrice: e.target.value })}
                          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                          £{purchaserPrice.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="rounded-lg bg-gray-100 px-2 py-1.5 text-xs font-semibold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                          £{clubCommission.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${onlinePartnershipMargin >= 0 ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{onlinePartnershipMargin.toFixed(2)}
                        </div>
                      </td>
                    </>
                  )}
                  {channel === 'collaboration' && isCollaborationInStore && (
                    <>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.deliveryPartner}
                          onChange={(e) => onUpdateRow(index, { deliveryPartner: e.target.value })}
                          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.partnerPrice}
                          onChange={(e) => onUpdateRow(index, { partnerPrice: e.target.value })}
                          placeholder="e.g. 11.29"
                          className="w-full min-w-0 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.salePrice}
                          onChange={(e) => onUpdateRow(index, { salePrice: e.target.value })}
                          className="w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${partnerMargin >= 0 ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{partnerMargin.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${partnerNetProfit >= 0 ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                          £{partnerNetProfit.toFixed(2)}
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
