import { useState, useEffect, useCallback } from 'react';
import type { Product } from '../../../types/index.js';
import { adminFetchProducts, adminSyncProducts, adminUpdateProduct, adminUploadSizeGuideImage } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Button } from '../../components/ui/Button.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatPriceRange, formatDate } from '../../lib/utils.js';

function ProductCard({ product, token }: { product: Product; token: string }) {
  const img = product.images.find((i) => i.isDefault) ?? product.images[0];
  const [sizeGuideUrl, setSizeGuideUrl] = useState(product.sizeGuideImage ?? '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setFilePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setFilePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);

  async function handleSaveSizeGuide() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await adminUpdateProduct(token, product.printifyId, {
        sizeGuideImage: sizeGuideUrl.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadSizeGuide() {
    if (!selectedFile) {
      setSaveError('Choose an image first');
      return;
    }

    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const result = await adminUploadSizeGuideImage(token, product.printifyId, selectedFile);
      setSizeGuideUrl(result.sizeGuideImage);
      setSelectedFile(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      {img ? (
        <div className="aspect-video overflow-hidden bg-gray-50 dark:bg-gray-800">
          <img src={img.src} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="aspect-video bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
          <span className="text-3xl opacity-30">🏓</span>
        </div>
      )}
      <div className="p-4 space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{product.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatPriceRange(product.minPrice, product.maxPrice)}
        </p>
        <div className="flex gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>{product.variants.length} variants</span>
          <span>·</span>
          <span>{product.colors.length} colours</span>
        </div>
        <div className="flex flex-wrap gap-1 pt-1">
          {product.colors.slice(0, 8).map((c) => (
            <span
              key={c.name}
              title={c.name}
              className="h-3 w-3 rounded-full border border-gray-200 dark:border-gray-700"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>

        {/* Size guide image */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Upload size guide image</p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700"
          />
          {selectedFile && (
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              Selected: {selectedFile.name}
            </div>
          )}
          {(filePreview || sizeGuideUrl) && (
            <div className="rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800">
              <img
                src={filePreview ?? sizeGuideUrl}
                alt="Size guide preview"
                className="w-full object-contain max-h-32"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUploadSizeGuide}
              disabled={saving || !selectedFile}
              className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Uploading…' : 'Upload & save'}
            </button>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">Stored in R2</span>
          </div>
          <p className="pt-1 text-[11px] text-gray-400 dark:text-gray-500">Or paste a URL manually</p>
          <input
            type="url"
            value={sizeGuideUrl}
            onChange={(e) => setSizeGuideUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSizeGuide}
              disabled={saving}
              className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {saved && <span className="text-xs text-green-600 dark:text-green-400">Saved</span>}
            {saveError && <span className="text-xs text-red-600 dark:text-red-400">{saveError}</span>}
          </div>
        </div>

        <p className="text-xs text-gray-300 dark:text-gray-600 font-mono truncate">{product.printifyId}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Synced {formatDate(product.syncedAt)}</p>
      </div>
    </div>
  );
}

export default function AdminProductsPage() {
  const { token } = useAdminToken();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [syncing,  setSyncing]  = useState(false);
  const [syncMsg,  setSyncMsg]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    productsFound: number;
    newProducts: Array<{ printifyId: string; title: string }>;
    updatedProducts: Array<{ printifyId: string; title: string }>;
    removedProducts: Array<{ printifyId: string; title: string }>;
  } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchProducts(token);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function handleApproveSync() {
    if (!token) return;
    if (!previewData) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const seenPrintifyIds: string[] = [];
      let page = 1;
      let productsFound = 0;
      let productsSynced = 0;
      let productsUnchanged = 0;
      let productsNew = 0;
      let productsUpdated = 0;
      let productsRemoved = previewData.removedProducts.length;
      const errors: string[] = [];

      while (true) {
        const result = await adminSyncProducts(token, { page, limit: 1 });
        productsFound += result.productsFound ?? 0;
        productsSynced += result.productsSynced ?? 0;
        productsUnchanged += result.productsUnchanged ?? 0;
        productsNew += result.productsNew ?? 0;
        productsUpdated += result.productsUpdated ?? 0;
        productsRemoved += result.productsRemoved ?? 0;
        errors.push(...(result.errors ?? []));
        seenPrintifyIds.push(...(result.seenPrintifyIds ?? []));

        if (!result.hasMore) break;
        page = (result.currentPage ?? page) + 1;
      }

      await adminSyncProducts(token, {
        finalize: true,
        syncedPrintifyIds: seenPrintifyIds,
      });

      setSyncMsg(
        `Synced ${productsSynced} of ${productsFound} products.` +
        ` New: ${productsNew}, updated: ${productsUpdated}, unchanged: ${productsUnchanged}, removed: ${productsRemoved}.` +
        (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : ''),
      );
      setPreviewOpen(false);
      setPreviewData(null);
      await load();
    } catch (err) {
      setSyncMsg(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handlePreviewSync() {
    if (!token) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await adminSyncProducts(token, { preview: true });
      setPreviewData({
        productsFound: result.productsFound ?? 0,
        newProducts: result.newProducts ?? [],
        updatedProducts: result.updatedProducts ?? [],
        removedProducts: result.removedProducts ?? [],
      });
      setPreviewOpen(true);
    } catch (err) {
      setSyncMsg(`Preview failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Products
        </h1>
        <Button
          variant="secondary"
          size="sm"
          loading={syncing}
          onClick={handlePreviewSync}
        >
          Sync from Printify
        </Button>
      </div>

      {syncMsg && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          syncMsg.includes('failed') || syncMsg.includes('Errors')
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
            : 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
        }`}>
          {syncMsg}
        </div>
      )}

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-3">No products cached yet.</p>
          <Button variant="secondary" size="sm" loading={syncing} onClick={handlePreviewSync}>
            Sync now
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} token={token!} />
          ))}
        </div>
      )}

      {previewOpen && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Approve sync changes</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Printify returned {previewData.productsFound} products. Import the delta into R2 and D1?
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="text-xs uppercase tracking-wide text-gray-500">New</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{previewData.newProducts.length}</div>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="text-xs uppercase tracking-wide text-gray-500">Updated</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{previewData.updatedProducts.length}</div>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="text-xs uppercase tracking-wide text-gray-500">Removed</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{previewData.removedProducts.length}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">New products</h3>
                <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  {previewData.newProducts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
                  ) : previewData.newProducts.map((product) => (
                    <div key={product.printifyId} className="text-sm text-gray-700 dark:text-gray-300">
                      {product.title}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Updated products</h3>
                <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  {previewData.updatedProducts.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
                  ) : previewData.updatedProducts.map((product) => (
                    <div key={product.printifyId} className="text-sm text-gray-700 dark:text-gray-300">
                      {product.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Removed products</h3>
              <div className="max-h-40 space-y-2 overflow-auto rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                {previewData.removedProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
                ) : previewData.removedProducts.map((product) => (
                  <div key={product.printifyId} className="text-sm text-gray-700 dark:text-gray-300">
                    {product.title}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewData(null);
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <Button loading={syncing} onClick={handleApproveSync}>
                Approve import
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
