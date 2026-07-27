import { Fragment, useCallback, useEffect, useState } from 'react';
import type { CatalogRange, Product } from '../../../types/index.js';
import {
  adminCreateRange,
  adminDeleteRange,
  adminFetchRanges,
  adminFetchProducts,
  adminUpdateRange,
} from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Button } from '../../components/ui/Button.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatDate } from '../../lib/utils.js';

type Draft = {
  name: string;
  storefrontEnabled: boolean;
  partnerEnabled: boolean;
  sortOrder: string;
};

function emptyDraft(): Draft {
  return {
    name: '',
    storefrontEnabled: true,
    partnerEnabled: true,
    sortOrder: '',
  };
}

function startDraft(range?: CatalogRange): Draft {
  if (!range) return emptyDraft();
  return {
    name: range.name,
    storefrontEnabled: range.storefrontEnabled,
    partnerEnabled: range.partnerEnabled,
    sortOrder: String(range.sortOrder),
  };
}

export default function AdminRangesPage() {
  const { token } = useAdminToken();
  const [ranges, setRanges] = useState<CatalogRange[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [rangeModalOpen, setRangeModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [rangeData, productData] = await Promise.all([
        adminFetchRanges(token),
        adminFetchProducts(token),
      ]);
      setRanges(rangeData);
      setProducts(productData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ranges');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function startCreate() {
    setEditingId(null);
    setDraft({
      ...emptyDraft(),
      sortOrder: String(ranges.length),
    });
    setSaved(null);
    setRangeModalOpen(true);
  }

  function startEdit(range: CatalogRange) {
    setEditingId(range.id);
    setDraft(startDraft(range));
    setSaved(null);
    setRangeModalOpen(true);
  }

  function closeRangeModal() {
    setRangeModalOpen(false);
  }

  async function handleSubmit() {
    if (!token) return;
    const name = draft.name.trim();
    if (!name) {
      setError('Range name is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const payload = {
        name,
        storefrontEnabled: draft.storefrontEnabled,
        partnerEnabled: draft.partnerEnabled,
        sortOrder: draft.sortOrder.trim() ? Number(draft.sortOrder) : ranges.length,
      };

      if (editingId) {
        await adminUpdateRange(token, editingId, payload);
        setSaved('Range updated');
      } else {
        await adminCreateRange(token, payload);
        setSaved('Range created');
      }

      await load();
      setEditingId(null);
      setDraft(emptyDraft());
      setRangeModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save range');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!window.confirm('Delete this range? Products must be moved off it first.')) return;

    setSaving(true);
    setError(null);
    try {
      await adminDeleteRange(token, id);
      await load();
      if (editingId === id) {
        setEditingId(null);
        setDraft({
          ...emptyDraft(),
          sortOrder: String(ranges.length),
        });
        setRangeModalOpen(false);
      }
      setSaved('Range deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete range');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleVisibility(
    range: CatalogRange,
    field: 'storefrontEnabled' | 'partnerEnabled',
  ) {
    if (!token) return;

    setSaving(true);
    setError(null);
    try {
      await adminUpdateRange(token, range.id, {
        name: range.name,
        storefrontEnabled: field === 'storefrontEnabled' ? !range.storefrontEnabled : range.storefrontEnabled,
        partnerEnabled: field === 'partnerEnabled' ? !range.partnerEnabled : range.partnerEnabled,
        sortOrder: range.sortOrder,
      });
      await load();
      setSaved(`${range.name} updated`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update range');
    } finally {
      setSaving(false);
    }
  }

  function getRangeThumbnail(rangeId: string): string | null {
    const product = products.find((item) => item.rangeId === rangeId && item.images.length > 0);
    if (!product) return null;
    return product.images.find((image) => image.isDefault)?.src ?? product.images[0]?.src ?? null;
  }

  function getRangeProducts(rangeId: string): Product[] {
    return products.filter((item) => item.rangeId === rangeId);
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Ranges</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create catalogue drops and control which range is visible on the storefront and partner portal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { void load(); }}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={startCreate}>
            + New range
          </Button>
        </div>
      </div>

      {saved && <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{saved}</p>}
      {error && <ErrorMessage message={error} />}

      <div className="grid gap-6">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-left dark:divide-gray-800">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 sm:px-6">Range</th>
                  <th className="px-4 py-3">Sort</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ranges.map((range) => (
                  <Fragment key={range.id}>
                    <tr className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-4 py-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                            {getRangeThumbnail(range.id) ? (
                              <img
                                src={getRangeThumbnail(range.id) ?? undefined}
                                alt={range.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400 dark:text-gray-500">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{range.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{range.sortOrder}</td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(range.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <RangeToggle
                            label="Storefront"
                            value={range.storefrontEnabled}
                            disabled={saving}
                            onToggle={() => { void handleToggleVisibility(range, 'storefrontEnabled'); }}
                          />
                          <RangeToggle
                            label="Partner"
                            value={range.partnerEnabled}
                            disabled={saving}
                            onToggle={() => { void handleToggleVisibility(range, 'partnerEnabled'); }}
                          />
                          <button
                            type="button"
                            onClick={() => startEdit(range)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { void handleDelete(range.id); }}
                            disabled={saving}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-950/40">
                      <td colSpan={4} className="px-4 pb-4 pt-2 sm:px-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                              Selected products
                            </p>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {getRangeProducts(range.id).length} product{getRangeProducts(range.id).length === 1 ? '' : 's'}
                            </span>
                          </div>
                          {getRangeProducts(range.id).length > 0 ? (
                            <div className="flex gap-3 overflow-x-auto pb-1">
                              {getRangeProducts(range.id).map((product) => (
                                <div
                                  key={product.id}
                                  className="w-40 flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
                                >
                                  <div className="aspect-[4/5] bg-gray-50 dark:bg-gray-950">
                                    {product.images[0]?.src ? (
                                      <img
                                        src={product.images[0].src}
                                        alt={product.title}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400 dark:text-gray-500">
                                        No image
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-1 p-3">
                                    <p className="line-clamp-2 text-xs font-semibold text-gray-900 dark:text-gray-100">
                                      {product.title}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                                      {product.garment || 'Product'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No products assigned to this range.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
                {ranges.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No ranges yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {rangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 max-h-[calc(100vh-2rem)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {editingId ? 'Edit range' : 'New range'}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Use this to group products into drops and decide where they are live.
                </p>
              </div>
              <button
                type="button"
                onClick={closeRangeModal}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto pr-1 space-y-4">
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Spring Drop 01"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
                <span>Storefront live</span>
                <input
                  type="checkbox"
                  checked={draft.storefrontEnabled}
                  onChange={(e) => setDraft((current) => ({ ...current, storefrontEnabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-navy-800 focus:ring-navy-500"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300">
                <span>Partner live</span>
                <input
                  type="checkbox"
                  checked={draft.partnerEnabled}
                  onChange={(e) => setDraft((current) => ({ ...current, partnerEnabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-navy-800 focus:ring-navy-500"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Sort order</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft((current) => ({ ...current, sortOrder: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeRangeModal}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <Button variant="primary" size="sm" onClick={() => { void handleSubmit(); }} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Update range' : 'Create range'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RangeToggle({
  label,
  value,
  disabled,
  onToggle,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        value
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      <span className="text-[10px] uppercase tracking-[0.14em]">{label}</span>
      <span className={`inline-flex h-4 w-8 items-center rounded-full p-0.5 ${value ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <span className={`h-3 w-3 rounded-full bg-white transition-transform ${value ? 'translate-x-3.5' : 'translate-x-0'}`} />
      </span>
    </button>
  );
}
