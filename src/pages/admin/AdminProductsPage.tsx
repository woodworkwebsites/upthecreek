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

  async function handleSync() {
    if (!token) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await adminSyncProducts(token);
      setSyncMsg(
        `Synced ${result.productsSynced} of ${result.productsFound} products.` +
        (result.errors.length > 0 ? ` Errors: ${result.errors.join(', ')}` : ''),
      );
      await load();
    } catch (err) {
      setSyncMsg(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
          onClick={handleSync}
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
          <Button variant="secondary" size="sm" loading={syncing} onClick={handleSync}>
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
    </div>
  );
}
