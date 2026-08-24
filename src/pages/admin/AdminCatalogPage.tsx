import { useCallback, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
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

const sheetTableClass = 'w-full min-w-[1150px] border-collapse text-left';
const sheetHeaderClass = 'sticky top-0 z-20 border-b border-gray-200 bg-gray-50 px-2 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400';
const sheetBodyRowClass = 'border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950/40';
const sheetCellClass = 'border-b border-gray-200 px-2 py-1 align-middle dark:border-gray-800';
const sheetInputClass = 'w-full min-w-0 border border-transparent bg-transparent px-2 py-1.5 text-xs text-gray-900 outline-none transition-colors focus:border-navy-300 focus:bg-white dark:text-gray-100 dark:focus:bg-gray-950';
const sheetMetricClass = 'flex min-h-[2.25rem] items-center border-b border-gray-200 bg-transparent px-2 py-1.5 text-xs font-semibold dark:border-gray-800 dark:text-gray-100';
const sheetActionButtonClass = 'inline-flex items-center justify-center rounded-none border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-gray-950 dark:text-red-400';
const frozenAudienceWidthClass = 'w-[120px] min-w-[120px]';
const frozenProductWidthClass = 'w-[130px] min-w-[130px]';
const frozenGarmentWidthClass = 'w-[170px] min-w-[170px]';
const frozenAudienceCellClass = `${sheetCellClass} sticky left-0 z-20 bg-white dark:bg-gray-900`;
const frozenProductCellClass = `${sheetCellClass} sticky left-[120px] z-20 bg-white dark:bg-gray-900`;
const frozenGarmentCellClass = `${sheetCellClass} sticky left-[250px] z-20 border-r border-gray-200 bg-white shadow-[2px_0_0_rgba(15,23,42,0.06)] dark:border-gray-800 dark:bg-gray-900 dark:shadow-[2px_0_0_rgba(255,255,255,0.08)]`;
const frozenAudienceHeaderClass = `${sheetHeaderClass} sticky left-0 z-30 bg-gray-50 dark:bg-gray-950`;
const frozenProductHeaderClass = `${sheetHeaderClass} sticky left-[120px] z-30 bg-gray-50 dark:bg-gray-950`;
const frozenGarmentHeaderClass = `${sheetHeaderClass} sticky left-[250px] z-30 border-r border-gray-200 bg-gray-50 shadow-[2px_0_0_rgba(15,23,42,0.06)] dark:border-gray-800 dark:bg-gray-950 dark:shadow-[2px_0_0_rgba(255,255,255,0.08)]`;

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
  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [garmentListModalOpen, setGarmentListModalOpen] = useState(false);
  const [colorsModalOpen, setColorsModalOpen] = useState(false);
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

      <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Catalog option lists</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Audience, product, garment and colour editors are tucked away in modals so the page stays focused on the pricing sheets.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setAudienceModalOpen(true)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-900"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Audience</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{audiences.length} options</p>
          </button>
          <button
            type="button"
            onClick={() => setProductModalOpen(true)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-900"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Product</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{products.length} options</p>
          </button>
          <button
            type="button"
            onClick={() => setGarmentListModalOpen(true)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-900"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Garment</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{garments.length} options</p>
          </button>
          <button
            type="button"
            onClick={() => setColorsModalOpen(true)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-900"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Colours</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{colors.length} swatches</p>
          </button>
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

      <div className="space-y-4">
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

      {audienceModalOpen && (
        <CatalogListModal
          title="Audience options"
          hint="These values feed the audience dropdowns across admin and product flows."
          items={audiences}
          addButtonLabel="Add audience"
          onUpdate={(index, value) => updateListItem(setAudiences, index, value)}
          onAdd={() => addListItem(setAudiences)}
          onRemove={(index) => removeListItem(setAudiences, index)}
          onClose={() => setAudienceModalOpen(false)}
        />
      )}

      {productModalOpen && (
        <CatalogListModal
          title="Product options"
          hint="These values feed the product dropdowns across admin and product flows."
          items={products}
          addButtonLabel="Add product"
          onUpdate={(index, value) => updateListItem(setProducts, index, value)}
          onAdd={() => addListItem(setProducts)}
          onRemove={(index) => removeListItem(setProducts, index)}
          onClose={() => setProductModalOpen(false)}
        />
      )}

      {garmentListModalOpen && (
        <CatalogListModal
          title="Garment options"
          hint="These values are used by the pricing matrix and the product creation flow."
          items={garments}
          addButtonLabel="Add garment row"
          onUpdate={(index, value) => updateListItem(setGarments, index, value)}
          onAdd={() => {
            setGarmentListModalOpen(false);
            openGarmentModal();
          }}
          onRemove={(index) => removeListItem(setGarments, index)}
          onClose={() => setGarmentListModalOpen(false)}
        />
      )}

      {colorsModalOpen && (
        <ColorListModal
          colors={colors}
          onAdd={addColor}
          onUpdate={updateColor}
          onRemove={removeColor}
          onClose={() => setColorsModalOpen(false)}
        />
      )}

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

function ModalFrame({
  title,
  hint,
  onClose,
  children,
  actions,
}: {
  title: string;
  hint: string;
  onClose: () => void;
  children: ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">{title}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        <div className="mt-4">{children}</div>

        {actions && <div className="mt-5 flex items-center justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function CatalogListModal({
  title,
  hint,
  items,
  addButtonLabel,
  onUpdate,
  onAdd,
  onRemove,
  onClose,
}: {
  title: string;
  hint: string;
  items: string[];
  addButtonLabel: string;
  onUpdate: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <ModalFrame
      title={title}
      hint={hint}
      onClose={onClose}
      actions={(
        <>
          <button
            type="button"
            onClick={onAdd}
            className="rounded-lg bg-navy-800 px-3 py-2 text-sm font-semibold text-white"
          >
            {addButtonLabel}
          </button>
        </>
      )}
    >
      <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(event) => onUpdate(index, event.target.value)}
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
    </ModalFrame>
  );
}

function ColorListModal({
  colors,
  onAdd,
  onUpdate,
  onRemove,
  onClose,
}: {
  colors: CatalogColorOption[];
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<CatalogColorOption>) => void;
  onRemove: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <ModalFrame
      title="Colour options"
      hint="Name plus hex swatch for the admin table."
      onClose={onClose}
      actions={(
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-navy-800 px-3 py-2 text-sm font-semibold text-white"
        >
          Add colour
        </button>
      )}
    >
      <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
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
                    onChange={(event) => onUpdate(index, { name: event.target.value })}
                    placeholder="Colour name"
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-red-400"
              >
                X
              </button>
            </div>
            <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)] gap-2">
              <input
                type="color"
                value={color.hex}
                onChange={(event) => onUpdate(index, { hex: event.target.value })}
                className="h-11 w-11 rounded-lg border border-gray-200 bg-transparent p-1 dark:border-gray-700"
              />
              <input
                value={color.hex}
                onChange={(event) => onUpdate(index, { hex: event.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        ))}
      </div>
    </ModalFrame>
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
      <td className={`${frozenAudienceCellClass} ${frozenAudienceWidthClass}`}>
        <input value={row.audience} onChange={(e) => onChange({ audience: e.target.value })} className={sheetInputClass} />
      </td>
      <td className={`${frozenProductCellClass} ${frozenProductWidthClass}`}>
        <input value={row.product} onChange={(e) => onChange({ product: e.target.value })} className={sheetInputClass} />
      </td>
      <td className={`${frozenGarmentCellClass} ${frozenGarmentWidthClass}`}>
        <input value={row.garment} onChange={(e) => onChange({ garment: e.target.value })} className={sheetInputClass} />
      </td>
      <td className={sheetCellClass}>
        <input value={row.printSurface} onChange={(e) => onChange({ printSurface: e.target.value })} className={sheetInputClass} />
      </td>
    </>
  );
}

function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

function getPricingRowMetrics(
  row: PricingRowOption,
  channel: 'partner' | 'retail' | 'online-partnership' | 'collaboration',
  collaborationMode?: 'online' | 'instore',
) {
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

  return {
    salePrice,
    saleCost,
    manufacturingCost,
    deliveryValue,
    delivery,
    onlineDelivery,
    margin,
    partnerMargin,
    partnerNetProfit,
    purchaserPrice,
    clubCommission,
    onlinePartnershipMargin,
    isCollaborationOnline: channel === 'collaboration' && collaborationMode === 'online',
    isCollaborationInStore: channel === 'collaboration' && collaborationMode === 'instore',
  };
}

function PricingValue({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative' | 'warning';
}) {
  const toneClass = tone === 'positive'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
    : tone === 'negative'
      ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
        : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100';

  return (
    <div className={`rounded-xl px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function PricingInput({
  label,
  value,
  onChange,
  placeholder,
  tone = 'default',
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  tone?: 'default' | 'warning';
  type?: 'text' | 'number';
}) {
  return (
    <label className="block space-y-1.5">
      <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 dark:text-gray-100 ${
          tone === 'warning'
            ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950'
        }`}
      />
    </label>
  );
}

function PricingRowMobileCard({
  row,
  index,
  channel,
  collaborationMode,
  onUpdateRow,
  onRemoveRow,
}: {
  row: PricingRowOption;
  index: number;
  channel: 'partner' | 'retail' | 'online-partnership' | 'collaboration';
  collaborationMode?: 'online' | 'instore';
  onUpdateRow: (index: number, patch: Partial<PricingRowOption>) => void;
  onRemoveRow: (index: number) => void;
}) {
  const metrics = getPricingRowMetrics(row, channel, collaborationMode);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Row {index + 1}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {row.audience || 'Audience'} / {row.product || 'Product'} / {row.garment || 'Garment'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemoveRow(index)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-red-400"
        >
          Remove
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PricingInput label="Audience" value={row.audience} onChange={(value) => onUpdateRow(index, { audience: value })} />
        <PricingInput label="Product" value={row.product} onChange={(value) => onUpdateRow(index, { product: value })} />
        <PricingInput label="Garment" value={row.garment} onChange={(value) => onUpdateRow(index, { garment: value })} />
        <PricingInput label="Print surface" value={row.printSurface} onChange={(value) => onUpdateRow(index, { printSurface: value })} />
        <PricingInput label="Manufacturing" value={row.manufacturingCost} onChange={(value) => onUpdateRow(index, { manufacturingCost: value })} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {channel === 'retail' && (
          <>
            <PricingInput label="Sale cost" value={row.saleCost} onChange={(value) => onUpdateRow(index, { saleCost: value })} />
            <PricingInput label="Delivery" value={row.deliveryRetail} onChange={(value) => onUpdateRow(index, { deliveryRetail: value })} />
            <PricingInput label="Sale price" value={row.salePrice} onChange={(value) => onUpdateRow(index, { salePrice: value })} />
            <PricingValue label="Margin" value={formatMoney(metrics.margin)} tone={metrics.margin >= 0 ? 'positive' : 'negative'} />
          </>
        )}

        {channel === 'partner' && (
          <>
            <PricingInput label="Partner delivery" value={row.deliveryPartner} onChange={(value) => onUpdateRow(index, { deliveryPartner: value })} />
            <PricingInput label="Partner price" value={row.partnerPrice} onChange={(value) => onUpdateRow(index, { partnerPrice: value })} tone="warning" />
            <PricingInput label="Sale price" value={row.salePrice} onChange={(value) => onUpdateRow(index, { salePrice: value })} />
            <PricingValue label="Partner margin" value={formatMoney(metrics.partnerMargin)} tone={metrics.partnerMargin >= 0 ? 'positive' : 'negative'} />
            <PricingValue label="Net profit" value={formatMoney(metrics.partnerNetProfit)} tone={metrics.partnerNetProfit >= 0 ? 'positive' : 'negative'} />
          </>
        )}

        {channel === 'online-partnership' && (
          <>
            <PricingInput label="Sale cost" value={row.saleCost} onChange={(value) => onUpdateRow(index, { saleCost: value })} />
            <PricingInput label="Delivery" value={row.deliveryOnlinePartnership} onChange={(value) => onUpdateRow(index, { deliveryOnlinePartnership: value })} />
            <PricingValue label="Purchaser price" value={formatMoney(metrics.purchaserPrice)} />
            <PricingValue label="Club commission" value={formatMoney(metrics.clubCommission)} />
            <PricingValue label="My margin" value={formatMoney(metrics.onlinePartnershipMargin)} tone={metrics.onlinePartnershipMargin >= 0 ? 'positive' : 'negative'} />
          </>
        )}

        {channel === 'collaboration' && metrics.isCollaborationOnline && (
          <>
            <PricingInput label="Sale cost" value={row.saleCost} onChange={(value) => onUpdateRow(index, { saleCost: value })} />
            <PricingInput label="Online delivery" value={row.deliveryOnlinePartnership} onChange={(value) => onUpdateRow(index, { deliveryOnlinePartnership: value })} />
            <PricingInput label="Sale price (RRP)" value={row.salePrice} onChange={(value) => onUpdateRow(index, { salePrice: value })} />
            <PricingValue label="Purchaser price" value={formatMoney(metrics.purchaserPrice)} />
            <PricingValue label="Club commission" value={formatMoney(metrics.clubCommission)} />
            <PricingValue label="My margin" value={formatMoney(metrics.onlinePartnershipMargin)} tone={metrics.onlinePartnershipMargin >= 0 ? 'positive' : 'negative'} />
          </>
        )}

        {channel === 'collaboration' && metrics.isCollaborationInStore && (
          <>
            <PricingInput label="In-store delivery" value={row.deliveryPartner} onChange={(value) => onUpdateRow(index, { deliveryPartner: value })} />
            <PricingInput label="Partner price" value={row.partnerPrice} onChange={(value) => onUpdateRow(index, { partnerPrice: value })} tone="warning" />
            <PricingInput label="Sale price (RRP)" value={row.salePrice} onChange={(value) => onUpdateRow(index, { salePrice: value })} />
            <PricingValue label="Partner margin" value={formatMoney(metrics.partnerMargin)} tone={metrics.partnerMargin >= 0 ? 'positive' : 'negative'} />
            <PricingValue label="Net profit" value={formatMoney(metrics.partnerNetProfit)} tone={metrics.partnerNetProfit >= 0 ? 'positive' : 'negative'} />
          </>
        )}
      </div>
    </div>
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
  const isCollaboration = channel === 'collaboration';

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

      <div className="mt-4 hidden overflow-x-auto pb-2 md:block">
        <table
          className={`${sheetTableClass} ${
            isCollaboration
              ? 'min-w-[1280px]'
              : ''
          }`}
        >
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-[10px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
              <th className={`${frozenAudienceHeaderClass} ${frozenAudienceWidthClass}`}>Audience</th>
              <th className={`${frozenProductHeaderClass} ${frozenProductWidthClass}`}>Product</th>
              <th className={`${frozenGarmentHeaderClass} ${frozenGarmentWidthClass}`}>Garment</th>
              <th className={sheetHeaderClass}>Print surface</th>
              <th className={sheetHeaderClass}>Manufacturing</th>
              {channel === 'retail' && <th className={sheetHeaderClass}>Sale cost</th>}
              {(channel === 'retail' || channel === 'online-partnership') && <th className={sheetHeaderClass}>Delivery</th>}
              {channel === 'partner' && <th className={sheetHeaderClass}>In-store delivery</th>}
              {channel === 'collaboration' && isCollaborationOnline && (
                <>
                  <th className={sheetHeaderClass}>Sale cost</th>
                  <th className={sheetHeaderClass}>Online delivery</th>
                  <th className={sheetHeaderClass}>Sale price (RRP)</th>
                  <th className={sheetHeaderClass} title="Sale cost plus online delivery, less the purchaser's 10% club discount and VAT">Purchaser price</th>
                  <th className={sheetHeaderClass} title="10% of the discounted purchaser price, excluding VAT">Club commission</th>
                  <th className={sheetHeaderClass} title="Post-discount purchaser price excluding VAT, minus commission, manufacturing cost and online delivery">My margin</th>
                </>
              )}
              {channel === 'collaboration' && isCollaborationInStore && (
                <>
                  <th className={sheetHeaderClass}>In-store delivery</th>
                  <th className={sheetHeaderClass + ' text-amber-700 dark:text-amber-400'} title="Your income per garment on the partner order page">Partner price</th>
                  <th className={sheetHeaderClass}>Sale price (RRP)</th>
                  <th className={sheetHeaderClass + ' text-amber-700 dark:text-amber-400'} title="Sale price (RRP) minus partner price">Partner margin</th>
                  <th className={sheetHeaderClass + ' text-amber-700 dark:text-amber-400'} title="RRP minus wholesale price minus 20% VAT on RRP">Net profit</th>
                </>
              )}
              {channel === 'partner' && (
                <>
                  <th className={sheetHeaderClass + ' text-amber-700 dark:text-amber-400'} title="Your income per garment on the partner order page">Partner price</th>
                  <th className={sheetHeaderClass + ' text-amber-700 dark:text-amber-400'} title="Sale price (RRP) minus partner price">Partner margin</th>
                  <th className={sheetHeaderClass + ' text-amber-700 dark:text-amber-400'} title="RRP minus wholesale price minus 20% VAT on RRP">Net profit</th>
                </>
              )}
              {channel === 'retail' && (
                <>
                  <th className={sheetHeaderClass}>Sale price</th>
                  <th className={sheetHeaderClass}>Margin</th>
                </>
              )}
              {channel === 'online-partnership' && (
                <>
                  <th className={sheetHeaderClass}>Sale cost</th>
                  <th className={sheetHeaderClass} title="Sale cost plus delivery, less the purchaser's 10% club discount and VAT">Purchaser price</th>
                  <th className={sheetHeaderClass} title="10% of the discounted purchaser price, excluding VAT">Club commission</th>
                  <th className={sheetHeaderClass} title="Post-discount purchaser price excluding VAT, minus commission, manufacturing cost and delivery">My margin</th>
                </>
              )}
              <th className={sheetHeaderClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pricingRows.map((row, index) => {
              const metrics = getPricingRowMetrics(row, channel, collaborationMode);
              return (
                <tr key={index} className={sheetBodyRowClass}>
                  <PricingIdentityCells row={row} onChange={(patch) => onUpdateRow(index, patch)} />
                  <td className={sheetCellClass}>
                    <input value={row.manufacturingCost} onChange={(e) => onUpdateRow(index, { manufacturingCost: e.target.value })} className={sheetInputClass} />
                  </td>
                  {channel === 'retail' && (
                    <td className={sheetCellClass}>
                      <input value={row.saleCost} onChange={(e) => onUpdateRow(index, { saleCost: e.target.value })} className={sheetInputClass} />
                    </td>
                  )}
                  {channel !== 'collaboration' && (
                    <td className={sheetCellClass}>
                      <input
                        value={metrics.deliveryValue}
                        onChange={(e) => onUpdateRow(index, channel === 'retail'
                          ? { deliveryRetail: e.target.value }
                          : channel === 'partner'
                            ? { deliveryPartner: e.target.value }
                            : { deliveryOnlinePartnership: e.target.value })}
                        className={sheetInputClass}
                      />
                    </td>
                  )}
                  {channel === 'partner' && (
                    <>
                      <td className={sheetCellClass}>
                        <input value={row.partnerPrice} onChange={(e) => onUpdateRow(index, { partnerPrice: e.target.value })} placeholder="e.g. 11.29" className={sheetInputClass + ' border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'} />
                      </td>
                      <td className={sheetCellClass}>
                        <div className={`${sheetMetricClass} ${metrics.partnerMargin >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-300'}`}>
                          {formatMoney(metrics.partnerMargin)}
                        </div>
                      </td>
                      <td className={sheetCellClass}>
                        <div className={`${sheetMetricClass} ${metrics.partnerNetProfit >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-300'}`}>
                          {formatMoney(metrics.partnerNetProfit)}
                        </div>
                      </td>
                    </>
                  )}
                  {channel === 'retail' && (
                    <>
                      <td className={sheetCellClass}>
                        <input value={row.salePrice} onChange={(e) => onUpdateRow(index, { salePrice: e.target.value })} className={sheetInputClass} />
                      </td>
                      <td className={sheetCellClass}>
                        <div className={`${sheetMetricClass} ${metrics.margin >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-300'}`}>
                          {formatMoney(metrics.margin)}
                        </div>
                      </td>
                    </>
                  )}
                  {channel === 'online-partnership' && (
                    <>
                      <td className={sheetCellClass}>
                        <div className={sheetMetricClass + ' text-gray-600 dark:text-gray-300'}>
                          {formatMoney(metrics.saleCost)}
                        </div>
                      </td>
                      <td className={sheetCellClass}>
                        <div className={sheetMetricClass}>
                          {formatMoney(metrics.purchaserPrice)}
                        </div>
                      </td>
                      <td className={sheetCellClass}>
                        <div className={sheetMetricClass}>
                          {formatMoney(metrics.clubCommission)}
                        </div>
                      </td>
                      <td className={sheetCellClass}>
                        <div className={`${sheetMetricClass} ${metrics.onlinePartnershipMargin >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-300'}`}>
                          {formatMoney(metrics.onlinePartnershipMargin)}
                        </div>
                      </td>
                    </>
                  )}
                  {channel === 'collaboration' && isCollaborationOnline && (
                    <>
                      <td className={sheetCellClass}>
                        <input
                          value={row.saleCost}
                          onChange={(e) => onUpdateRow(index, { saleCost: e.target.value })}
                          className={sheetInputClass}
                        />
                      </td>
                      <td className={sheetCellClass}>
                        <input
                          value={row.deliveryOnlinePartnership}
                          onChange={(e) => onUpdateRow(index, { deliveryOnlinePartnership: e.target.value })}
                          className={sheetInputClass}
                        />
                      </td>
                      <td className={sheetCellClass}>
                        <input
                          value={row.salePrice}
                          onChange={(e) => onUpdateRow(index, { salePrice: e.target.value })}
                          className={sheetInputClass}
                        />
                      </td>
                      <td className={sheetCellClass}>
                        <div className={sheetMetricClass}>
                          {formatMoney(metrics.purchaserPrice)}
                        </div>
                      </td>
                      <td className={sheetCellClass}>
                        <div className={sheetMetricClass}>
                          {formatMoney(metrics.clubCommission)}
                        </div>
                      </td>
                      <td className={sheetCellClass}>
                        <div className={`${sheetMetricClass} ${metrics.onlinePartnershipMargin >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-300'}`}>
                          {formatMoney(metrics.onlinePartnershipMargin)}
                        </div>
                      </td>
                    </>
                  )}
                  {channel === 'collaboration' && isCollaborationInStore && (
                    <>
                      <td className={sheetCellClass}>
                        <input
                          value={row.deliveryPartner}
                          onChange={(e) => onUpdateRow(index, { deliveryPartner: e.target.value })}
                          className={sheetInputClass}
                        />
                      </td>
                      <td className={sheetCellClass}>
                        <input
                          value={row.partnerPrice}
                          onChange={(e) => onUpdateRow(index, { partnerPrice: e.target.value })}
                          placeholder="e.g. 11.29"
                          className={sheetInputClass + ' border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'}
                        />
                      </td>
                      <td className={sheetCellClass}>
                        <input
                          value={row.salePrice}
                          onChange={(e) => onUpdateRow(index, { salePrice: e.target.value })}
                          className={sheetInputClass}
                        />
                      </td>
                      <td className={sheetCellClass}>
                        <div className={`${sheetMetricClass} ${metrics.partnerMargin >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-300'}`}>
                          {formatMoney(metrics.partnerMargin)}
                        </div>
                      </td>
                      <td className={sheetCellClass}>
                        <div className={`${sheetMetricClass} ${metrics.partnerNetProfit >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-700 dark:text-red-300'}`}>
                          {formatMoney(metrics.partnerNetProfit)}
                        </div>
                      </td>
                    </>
                  )}
                  <td className={sheetCellClass}>
                    <button
                      type="button"
                      onClick={() => onRemoveRow(index)}
                      className={sheetActionButtonClass}
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

      <div className="mt-4 space-y-3 md:hidden">
        {pricingRows.map((row, index) => (
          <PricingRowMobileCard
            key={index}
            row={row}
            index={index}
            channel={channel}
            collaborationMode={collaborationMode}
            onUpdateRow={onUpdateRow}
            onRemoveRow={onRemoveRow}
          />
        ))}
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
