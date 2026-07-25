import { useState, useEffect, useCallback, useRef, useLayoutEffect, type Ref } from 'react';
import type { Product } from '../../../types/index.js';
import { adminCreateProduct, adminDeleteProduct, adminDeleteProductImage, adminFetchProducts, adminGetSettings, adminReorderProductImages, adminUpdateProduct, adminUpdateProductImage, adminUpdateSettings, adminUploadProductImage, adminUploadSizeGuideImage } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Button } from '../../components/ui/Button.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatPriceRange, formatDate } from '../../lib/utils.js';
import { ColorMultiSelect } from '../../components/admin/ColorMultiSelect.js';
import { DEFAULT_CATALOG_OPTIONS, DEFAULT_SIZE_OPTIONS, findPricingPresetRow, parseCatalogSettings, serializeCatalogSettings, type CatalogOptions } from '../../lib/catalog.js';

interface DraftImageRow {
  file: File;
  previewUrl: string;
  isDefault: boolean;
}

function InlineDraftProductRow({
  token,
  catalog,
  onCreated,
  onCancel,
  rowRef,
}: {
  token: string;
  catalog: CatalogOptions;
  onCreated: () => Promise<void> | void;
  onCancel: () => void;
  rowRef?: Ref<HTMLTableRowElement>;
}) {
  const [printSurface, setPrintSurface] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(catalog.audiences[0] ?? '');
  const [productType, setProductType] = useState(catalog.products[0] ?? '');
  const [garmentType, setGarmentType] = useState(catalog.garments[0] ?? '');
  const [isEnabled, setIsEnabled] = useState(true);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [images, setImages] = useState<DraftImageRow[]>([]);
  const imagesRef = useRef<DraftImageRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const newRows: DraftImageRow[] = Array.from(fileList).map((file, i) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isDefault: images.length === 0 && i === 0,
    }));
    setImages((current) => [...current, ...newRows]);
  }

  function removeImage(index: number) {
    setImages((current) => {
      URL.revokeObjectURL(current[index].previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }

  function setDefaultImage(index: number) {
    setImages((current) => current.map((row, i) => ({ ...row, isDefault: i === index })));
  }

  function toggleColor(colorName: string) {
    setSelectedColors((current) => (
      current.includes(colorName)
        ? current.filter((value) => value !== colorName)
        : [...current, colorName]
    ));
  }

  async function handleSubmit() {
    if (!token) return;
    setError(null);

    const resolvedTitle = title.trim();
    if (!resolvedTitle) {
      setError('Title is required');
      return;
    }

    if (selectedColors.length === 0) {
      setError('Select at least one colour');
      return;
    }

    setSubmitting(true);
    try {
      const metadataDescription = [
        category.trim() && `Audience: ${category.trim()}`,
        productType.trim() && `Product: ${productType.trim()}`,
        garmentType.trim() && `Garment: ${garmentType.trim()}`,
        printSurface.trim() && `Print surface: ${printSurface.trim()}`,
      ].filter(Boolean).join('\n');

      const form = new FormData();
      form.append('title', resolvedTitle);
      form.append('description', description.trim() || metadataDescription);
      form.append('category', category.trim() || catalog.audiences[0] || '');
      form.append('audience', category.trim() || catalog.audiences[0] || '');
      form.append('productType', productType.trim() || catalog.products[0] || '');
      form.append('garment', garmentType.trim() || catalog.garments[0] || '');
      const pricingPreset = matchPricingPresetBySelection(category, productType, garmentType, catalog)
        ?? catalog.pricingRows[0]
        ?? null;
      const salePrice = pricingPreset?.salePrice?.trim() || catalog.pricingRows[0]?.salePrice?.trim() || '24.99';
      const selectedColorRows = selectedColors
        .map((name) => catalog.colors.find((color) => color.name === name))
        .filter((color): color is { name: string; hex: string } => Boolean(color));
      form.append('pricingMatrix', JSON.stringify(pricingPreset ?? {
        audience: '',
        product: '',
        garment: '',
        printSurface: printSurface.trim(),
        manufacturingCost: '',
        saleCost: '',
        delivery: '',
        salePrice,
      }));
      form.append('isEnabled', String(isEnabled));
      form.append('variants', JSON.stringify(
        selectedColorRows.flatMap((color, colorIndex) =>
          DEFAULT_SIZE_OPTIONS.map((size, sizeIndex) => ({
            id: colorIndex * DEFAULT_SIZE_OPTIONS.length + sizeIndex + 1,
            color: color.name,
            hex: color.hex,
            size,
            price: Math.round(parseFloat(salePrice) * 100) || 0,
            available: true,
          })),
        ),
      ));
      form.append('imagesMeta', JSON.stringify(images.map((img) => ({
        isDefault: img.isDefault,
      }))));
      images.forEach((img) => form.append('images', img.file, img.file.name));

      await adminCreateProduct(token, form);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <tr ref={rowRef} className="border-t border-dashed border-gray-200 bg-cream/20 dark:border-gray-700 dark:bg-gray-950/40">
      <td colSpan={6} className="p-0">
        <div className="space-y-6 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">New product</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Use the dropdowns below to create the row directly in the table.</p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            >
              Cancel
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Identity</p>
              <div className="mt-3 space-y-3">
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                    <option value="">Audience</option>
                    {catalog.audiences.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <select value={productType} onChange={(e) => setProductType(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                    <option value="">Product</option>
                    {catalog.products.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <select value={garmentType} onChange={(e) => setGarmentType(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                    <option value="">Garment</option>
                    {catalog.garments.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <select value={printSurface} onChange={(e) => setPrintSurface(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                    <option value="">Print surface</option>
                    {Array.from(new Set(catalog.pricingRows.map((row) => row.printSurface.trim()).filter(Boolean))).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={4} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Publication</p>
              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  onClick={() => setIsEnabled((current) => !current)}
                  className={`inline-flex items-center gap-3 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isEnabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-200'
                      : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200'
                  }`}
                >
                  <span className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                    <span className={`h-4 w-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                  Enabled
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <ColorMultiSelect
              colors={catalog.colors}
              selected={selectedColors}
              onToggle={(color) => toggleColor(color.name)}
            />
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Publish on save</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Select the colours you want, then save to publish the product to the shop immediately.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Images</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Upload product imagery and choose the default.</p>
              </div>
              <input type="file" accept="image/*" multiple onChange={(e) => handleFilesSelected(e.target.files)} className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700" />
            </div>
            {images.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {images.map((img, index) => (
                  <div key={index} className="rounded-xl border border-gray-100 p-2 space-y-2 dark:border-gray-800">
                    <img src={img.previewUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">No colour selection</span>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        aria-label="Remove image"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        X
                      </button>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                      <input type="radio" name="default-image" checked={img.isDefault} onChange={() => setDefaultImage(index)} />
                      Default image
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { void handleSubmit(); }} disabled={submitting} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create product'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function pricingMatrixSignature(matrix: {
  audience: string;
  product: string;
  garment: string;
  printSurface: string;
  manufacturingCost: string;
  saleCost: string;
  delivery: string;
  salePrice: string;
  partnerPrice: string;
} | null): string {
  return JSON.stringify(matrix ?? null);
}

function normalizePricingMatrix(matrix: {
  audience: string;
  product: string;
  garment: string;
  printSurface: string;
  manufacturingCost: string;
  saleCost: string;
  delivery: string;
  salePrice: string;
  partnerPrice: string;
}) {
  return {
    audience: matrix.audience.trim(),
    product: matrix.product.trim(),
    garment: matrix.garment.trim(),
    printSurface: matrix.printSurface.trim(),
    manufacturingCost: matrix.manufacturingCost.trim(),
    saleCost: matrix.saleCost.trim(),
    delivery: matrix.delivery.trim(),
    salePrice: matrix.salePrice.trim(),
    partnerPrice: matrix.partnerPrice.trim(),
  };
}

function emptyPricingMatrix() {
  return {
    audience: '',
    product: '',
    garment: '',
    printSurface: '',
    manufacturingCost: '',
    saleCost: '',
    delivery: '',
    salePrice: '',
    partnerPrice: '',
  };
}

function matchPricingPreset(
  product: Product,
  catalog: CatalogOptions,
): {
  audience: string;
  product: string;
  garment: string;
  printSurface: string;
  manufacturingCost: string;
  saleCost: string;
  delivery: string;
  salePrice: string;
  partnerPrice: string;
} | null {
  const preset = findPricingPresetRow(catalog.pricingRows, product.audience, product.productType, product.garment)
    ?? catalog.pricingRows[0];
  if (!preset) return null;
  return normalizePricingMatrix(preset);
}

function matchPricingPresetBySelection(
  audience: string,
  productType: string,
  garment: string,
  catalog: CatalogOptions,
): {
  audience: string;
  product: string;
  garment: string;
  printSurface: string;
  manufacturingCost: string;
  saleCost: string;
  delivery: string;
  salePrice: string;
  partnerPrice: string;
} | null {
  const preset = findPricingPresetRow(catalog.pricingRows, audience, productType, garment);
  return preset ? normalizePricingMatrix(preset) : null;
}

function ProductRow({
  product,
  token,
  catalog,
  onCatalogRefreshed,
  onDeleted,
}: {
  product: Product;
  token: string;
  catalog: CatalogOptions;
  onCatalogRefreshed: () => Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const [images, setImages] = useState(product.images);
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? '');
  const [category, setCategory] = useState(product.audience || '');
  const [productType, setProductType] = useState(product.productType || '');
  const [garmentType, setGarmentType] = useState(product.garment || '');
  const initialPricingMatrix = {
    ...emptyPricingMatrix(),
    ...(product.pricingMatrix ?? matchPricingPreset(product, catalog) ?? {}),
  };
  const [pricingMatrix, setPricingMatrix] = useState(initialPricingMatrix);
  const [hiddenColors, setHiddenColors] = useState<string[]>(product.hiddenColors ?? []);
  const [isEnabled, setIsEnabled] = useState(product.isEnabled);
  const [sizeGuideUploadFile, setSizeGuideUploadFile] = useState<File | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUploadFiles, setImageUploadFiles] = useState<File[]>([]);
  const [imageUploadPreviews, setImageUploadPreviews] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [imageUploadColor, setImageUploadColor] = useState('');
  const [imageUploadDefault, setImageUploadDefault] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [draggingImageKey, setDraggingImageKey] = useState<string | null>(null);
  const [dropTargetImageKey, setDropTargetImageKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricingRowSaving, setPricingRowSaving] = useState(false);
  const [pricingRowSaved, setPricingRowSaved] = useState(false);
  const [pricingRowError, setPricingRowError] = useState<string | null>(null);
  const [sizeGuideUploading, setSizeGuideUploading] = useState(false);
  const [sizeGuideUploadError, setSizeGuideUploadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pricingCustomRef = useRef(Boolean(product.pricingMatrix));
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const nextPreset = matchPricingPreset(product, catalog) ?? emptyPricingMatrix();
    setTitle(product.title);
    setDescription(product.description ?? '');
    setCategory(product.audience || '');
    setProductType(product.productType || '');
    setGarmentType(product.garment || '');
    setPricingMatrix(product.pricingMatrix ?? nextPreset);
    pricingCustomRef.current = Boolean(product.pricingMatrix);
    setHiddenColors(product.hiddenColors ?? []);
    setIsEnabled(product.isEnabled);
    setImages(product.images);
  }, [product]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const img = images.find((i) => i.isDefault) ?? images[0];

  useEffect(() => {
    if (imageUploadFiles.length === 0) {
      setImageUploadPreviews([]);
      return;
    }

    const previews = imageUploadFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImageUploadPreviews(previews);
    return () => {
      previews.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
    };
  }, [imageUploadFiles]);

  useEffect(() => {
      const preset = matchPricingPresetBySelection(category, productType, garmentType, catalog)
        ?? catalog.pricingRows[0]
        ?? null;
      if (!preset) {
        return;
      }

    setPricingMatrix((current) => (
      pricingMatrixSignature(current) === pricingMatrixSignature(preset) ? current : preset
    ));
    pricingCustomRef.current = false;
  }, [category, productType, garmentType, catalog]);

  function updatePricingMatrix(patch: Partial<typeof pricingMatrix>) {
    pricingCustomRef.current = true;
    setPricingMatrix((current) => ({ ...current, ...patch }));
  }

  function resetPricingToCatalog() {
    const preset = matchPricingPresetBySelection(category, productType, garmentType, catalog)
      ?? catalog.pricingRows[0]
      ?? emptyPricingMatrix();
    pricingCustomRef.current = false;
    setPricingMatrix(preset);
  }

  async function addPricingRowToCatalog() {
    if (pricingRowSaving) return;

    setPricingRowSaving(true);
    setPricingRowSaved(false);
    setPricingRowError(null);
    try {
      const nextRows = [...catalog.pricingRows, normalizePricingMatrix(pricingMatrix)];
      await adminUpdateSettings(token, serializeCatalogSettings({
        ...catalog,
        pricingRows: nextRows,
      }));
      await onCatalogRefreshed();
      setPricingRowSaved(true);
      setTimeout(() => setPricingRowSaved(false), 2000);
    } catch (err) {
      setPricingRowError(err instanceof Error ? err.message : 'Failed to add row');
    } finally {
      setPricingRowSaving(false);
    }
  }

  function toggleColor(colorName: string) {
    setHiddenColors((current) =>
      current.includes(colorName)
        ? current.filter((value) => value !== colorName)
        : [...current, colorName],
    );
  }

  async function handleUploadSizeGuide() {
    if (!sizeGuideUploadFile) {
      setSizeGuideUploadError('Choose an image first');
      return;
    }

    setSizeGuideUploading(true);
    setSizeGuideUploadError(null);
    try {
      await adminUploadSizeGuideImage(token, product.printifyId, sizeGuideUploadFile);
      setSizeGuideUploadFile(null);
    } catch (err) {
      setSizeGuideUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setSizeGuideUploading(false);
    }
  }

  async function handleUploadProductImage() {
    if (imageUploadFiles.length === 0) {
      setImageError('Choose at least one image first');
      return;
    }

    setImageSaving(true);
    setImageError(null);
    try {
      const uploads = await Promise.all(
        imageUploadFiles.map((file, index) => adminUploadProductImage(
          token,
          product.printifyId,
          file,
          imageUploadColor.trim() || undefined,
          imageUploadDefault && index === 0,
        )),
      );
      setImages((current) => {
        let next = imageUploadDefault
          ? current.map((entry) => ({ ...entry, isDefault: false }))
          : [...current];
        for (const result of uploads) {
          next.push(result.image);
        }
        return next;
      });
      setImageUploadFiles([]);
      setImageUploadColor('');
      setImageUploadDefault(false);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setImageSaving(false);
    }
  }

  async function handleUpdateImage(storageKey: string, patch: { color?: string | null; isDefault?: boolean }) {
    setImageSaving(true);
    setImageError(null);
    try {
      const result = await adminUpdateProductImage(token, product.printifyId, storageKey, patch);
      setImages(result.images);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setImageSaving(false);
    }
  }

  async function handleReorderImages(nextImages: typeof images) {
    const previousImages = images;
    setImages(nextImages);
    setImageSaving(true);
    setImageError(null);
    try {
      const order = nextImages
        .map((image) => image.storageKey)
        .filter((key): key is string => Boolean(key));
      const result = await adminReorderProductImages(token, product.printifyId, order);
      setImages(result.images);
    } catch (err) {
      setImages(previousImages);
      setImageError(err instanceof Error ? err.message : 'Reorder failed');
    } finally {
      setDraggingImageKey(null);
      setDropTargetImageKey(null);
      setImageSaving(false);
    }
  }

  const allColors = (() => {
    const combined = [...catalog.colors];
    const seen = new Set<string>();
    return combined.filter((color) => {
      const key = color.name.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();
  const visibleColors = allColors.filter((color) => !hiddenColors.includes(color.name));
  const hiddenCount = hiddenColors.length;
  const colorOrder = new Map(allColors.map((color, index) => [color.name, index] as const));
  const sortedVisibleColors = [...visibleColors].sort(
    (a, b) => (colorOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER) - (colorOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER),
  );
  const sortedHiddenColors = [...allColors.filter((color) => hiddenColors.includes(color.name))].sort(
    (a, b) => (colorOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER) - (colorOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER),
  );
  const currentPricingSignature = pricingMatrixSignature(pricingMatrix);
  const originalPricingSignature = pricingMatrixSignature({
    ...emptyPricingMatrix(),
    ...(product.pricingMatrix ?? matchPricingPreset(product, catalog) ?? {}),
  });
  const hasChanges = title.trim() !== product.title
    || description.trim() !== (product.description ?? '').trim()
    || category.trim() !== (product.audience || '').trim()
    || productType.trim() !== (product.productType || '').trim()
    || garmentType.trim() !== (product.garment || '').trim()
    || isEnabled !== product.isEnabled
    || currentPricingSignature !== originalPricingSignature
    || hiddenColors.length !== (product.hiddenColors ?? []).length
    || hiddenColors.some((color) => !(product.hiddenColors ?? []).includes(color));

  async function handleSaveRow(closeDetails = false) {
    if (saving) return false;

    if (title.trim().length === 0) {
      setError('Title cannot be empty');
      return false;
    }

    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await adminUpdateProduct(token, product.printifyId, {
        title: title.trim(),
        description: description.trim(),
        audience: category.trim(),
        productType: productType.trim(),
        garment: garmentType.trim(),
        pricingMatrix: normalizePricingMatrix(pricingMatrix),
        colors: visibleColors,
        hiddenColors,
        isEnabled,
      });
      setSaved(true);
      if (closeDetails) {
        setDetailOpen(false);
      }
      setTimeout(() => setSaved(false), 2000);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProductRow() {
    const confirmed = window.confirm(`Delete ${product.title}? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await adminDeleteProduct(token, product.printifyId);
      onDeleted(product.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <tr className="border-b border-gray-100 bg-white transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 align-top">
        <td className="px-4 py-4 sm:px-6">
          <div className="flex max-w-[240px] flex-col gap-3">
            <div className="mx-auto flex h-32 w-24 items-center justify-center overflow-hidden flex-shrink-0">
              {img ? (
                <img src={img.src} alt={product.title} className="h-full w-full object-contain object-center" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No img</div>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                ref={titleRef}
                rows={2}
                className="w-full resize-none overflow-hidden rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold leading-snug text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <div className="flex justify-center">
                <label className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                  <span className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                    <span className={`h-4 w-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="sr-only"
                  />
                  Enabled
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Shop product</p>
              <p className="font-mono text-[11px] text-gray-400 dark:text-gray-500 truncate">{product.id}</p>
            </div>
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="space-y-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="">Audience</option>
              {catalog.audiences.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="">Product</option>
              {catalog.products.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={garmentType}
              onChange={(e) => setGarmentType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="">Garment</option>
              {catalog.garments.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Edit description
              </button>
              <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${
                description
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400'
              }`}>
                {description ? 'Description set' : 'No description yet'}
              </span>
            </div>
          </div>
        </td>

        <td className="w-[200px] px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="space-y-2 max-w-[200px]">
            <div className="flex flex-wrap gap-1.5 max-w-[240px]">
              {sortedVisibleColors.map((color) => {
                const isHidden = hiddenColors.includes(color.name);
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => toggleColor(color.name)}
                    aria-pressed={!isHidden}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      isHidden
                        ? 'border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
                        : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200'
                    }`}
                    title={isHidden ? `${color.name} hidden` : color.name}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span>{color.name}</span>
                  </button>
                );
              })}
            </div>
            {sortedHiddenColors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                {sortedHiddenColors.map((color) => (
                  <button
                    key={`hidden-${color.name}`}
                    type="button"
                    onClick={() => toggleColor(color.name)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                    title={`${color.name} hidden`}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full border border-black/10 opacity-60"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {visibleColors.length} visible, {hiddenCount} hidden
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 dark:border-amber-900/40 dark:bg-amber-900/10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">
              Pricing
            </p>
            <p className="mt-1 inline-flex items-center rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950 dark:text-amber-200">
              {pricingMatrix.salePrice ? `£${pricingMatrix.salePrice}` : formatPriceRange(product.minPrice, product.maxPrice)}
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Surface</span>
                <input
                  value={pricingMatrix.printSurface}
                  onChange={(e) => updatePricingMatrix({ printSurface: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Cost</span>
                <input
                  value={pricingMatrix.manufacturingCost}
                  onChange={(e) => updatePricingMatrix({ manufacturingCost: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Pricing</span>
                <input
                  value={pricingMatrix.saleCost}
                  onChange={(e) => updatePricingMatrix({ saleCost: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Retail</span>
                <input
                  value={pricingMatrix.salePrice}
                  onChange={(e) => updatePricingMatrix({ salePrice: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">Partner</span>
                <input
                  value={pricingMatrix.partnerPrice}
                  onChange={(e) => updatePricingMatrix({ partnerPrice: e.target.value })}
                  className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-[10px] text-gray-900 dark:border-amber-900/40 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                {pricingCustomRef.current ? 'Custom pricing' : 'Catalog pricing'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addPricingRowToCatalog}
                  disabled={pricingRowSaving}
                  className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {pricingRowSaving ? 'Adding…' : 'Add row'}
                </button>
                <button
                  type="button"
                  onClick={resetPricingToCatalog}
                  className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Use catalog
                </button>
              </div>
            </div>
            {pricingRowSaved && (
              <p className="mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Added to catalog
              </p>
            )}
            {pricingRowError && (
              <p className="mt-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                {pricingRowError}
              </p>
            )}
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1 max-w-[180px]">
              {product.sizes.map((size) => (
                <span
                  key={size}
                  className="inline-flex items-center rounded-full border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  {size}
                </span>
              ))}
            </div>
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setImageModalOpen(true)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Manage images
            </button>
            <div className="max-h-72 overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-2">
                {(images.length > 0 ? images : []).map((image, index) => (
                  <button
                    key={`${image.src}-${index}`}
                    type="button"
                    onClick={() => setImageModalOpen(true)}
                    className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-950"
                    title="Open image manager"
                  >
                    <div className="aspect-square">
                      <img src={image.src} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    {image.isDefault && (
                      <span className="absolute left-1 top-1 rounded-full bg-navy-800 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        Main
                      </span>
                    )}
                  </button>
                ))}
                {images.length === 0 && (
                  <div className="col-span-3 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                    No images uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="space-y-3">
            <button
              onClick={() => void handleSaveRow()}
              className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 transition-colors"
            >
              {saving ? 'Saving…' : 'Save row'}
              </button>
            <button
              type="button"
              onClick={() => void handleDeleteProductRow()}
              disabled={saving || deleting}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
            >
              {deleting ? 'Deleting…' : 'Delete row'}
            </button>
            {saved && <div className="text-xs text-green-600 dark:text-green-400">Saved</div>}
            {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Published {formatDate(product.syncedAt)}
            </p>
          </div>
        </td>
      </tr>

      {detailOpen && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
              <div className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit description</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{product.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailOpen(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-5 flex-1 overflow-y-auto pr-1">
                  <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={10}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDetailOpen(false)}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleSaveRow(true); }}
                    className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

      {imageModalOpen && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
              <div className="flex w-full max-w-6xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage images</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{product.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImageModalOpen(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-5 grid flex-1 min-h-0 gap-6 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="space-y-3 overflow-y-auto pr-1">
                    <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload image</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setImageUploadFiles(Array.from(e.target.files ?? []))}
                      className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700"
                    />
                    <select
                      value={imageUploadColor}
                      onChange={(e) => setImageUploadColor(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                      <option value="">No colour selection</option>
                      {visibleColors.map((color) => (
                        <option key={color.name} value={color.name}>{color.name}</option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                      <span className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${imageUploadDefault ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                        <span className={`h-4 w-4 rounded-full bg-white transition-transform ${imageUploadDefault ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                      <input
                        type="checkbox"
                        checked={imageUploadDefault}
                        onChange={(e) => setImageUploadDefault(e.target.checked)}
                        className="sr-only"
                      />
                      Default image
                    </label>
                    {imageUploadPreviews.length > 0 && (
                      <div className="space-y-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                          {imageUploadPreviews.length} selected
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {imageUploadPreviews.map(({ file, previewUrl }) => (
                            <div key={`${file.name}-${file.size}`} className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800">
                              <img src={previewUrl} alt={file.name} className="h-32 w-full object-contain bg-white dark:bg-gray-950" />
                              <div className="px-2 py-1 text-[11px] text-gray-500 dark:text-gray-400 truncate">{file.name}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleUploadProductImage}
                      disabled={imageSaving}
                      className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
                    >
                      {imageSaving ? 'Uploading…' : 'Upload image'}
                    </button>
                    {imageError && <div className="text-xs text-red-600 dark:text-red-400">{imageError}</div>}

                    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-3 space-y-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Size guide</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setSizeGuideUploadFile(e.target.files?.[0] ?? null)}
                          className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700 dark:text-gray-400"
                        />
                        <button
                          type="button"
                          onClick={handleUploadSizeGuide}
                          disabled={sizeGuideUploading}
                          className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
                        >
                          {sizeGuideUploading ? 'Uploading…' : 'Upload'}
                        </button>
                      </div>
                      {sizeGuideUploadFile && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Selected: {sizeGuideUploadFile.name}
                        </div>
                      )}
                      {sizeGuideUploadError && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {sizeGuideUploadError}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Current images</div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {images.map((image, index) => (
                        <div
                          key={`${image.src}-${index}`}
                          draggable={!imageSaving}
                          onDragStart={(event) => {
                            if (!image.storageKey || imageSaving) return;
                            event.dataTransfer.effectAllowed = 'move';
                            event.dataTransfer.setData('text/plain', image.storageKey);
                            setDraggingImageKey(image.storageKey);
                          }}
                          onDragOver={(event) => {
                            if (!draggingImageKey || draggingImageKey === image.storageKey) return;
                            event.preventDefault();
                            setDropTargetImageKey(image.storageKey ?? null);
                          }}
                          onDragLeave={() => {
                            if (dropTargetImageKey === image.storageKey) {
                              setDropTargetImageKey(null);
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const fromKey = draggingImageKey ?? event.dataTransfer.getData('text/plain');
                            const targetKey = image.storageKey;
                            if (!fromKey || !targetKey || fromKey === targetKey) {
                              setDraggingImageKey(null);
                              setDropTargetImageKey(null);
                              return;
                            }

                            const fromIndex = images.findIndex((entry) => entry.storageKey === fromKey);
                            const targetIndex = images.findIndex((entry) => entry.storageKey === targetKey);
                            if (fromIndex < 0 || targetIndex < 0) {
                              setDraggingImageKey(null);
                              setDropTargetImageKey(null);
                              return;
                            }

                            const next = [...images];
                            const [moved] = next.splice(fromIndex, 1);
                            const insertIndex = fromIndex < targetIndex ? targetIndex - 1 : targetIndex;
                            next.splice(insertIndex, 0, moved);
                            void handleReorderImages(next);
                          }}
                          onDragEnd={() => {
                            setDraggingImageKey(null);
                            setDropTargetImageKey(null);
                          }}
                          className={`relative rounded-xl border p-2 transition-colors ${
                            dropTargetImageKey === image.storageKey
                              ? 'border-navy-400 bg-navy-50 dark:border-navy-700 dark:bg-navy-950/40'
                              : 'border-gray-100 dark:border-gray-800'
                          } ${draggingImageKey === image.storageKey ? 'opacity-60' : ''}`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                            <span>Drag to reorder</span>
                            <span>{index + 1}</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!image.storageKey) return;
                              try {
                                await adminDeleteProductImage(token, product.printifyId, image.storageKey);
                                setImages((current) => {
                                  const next = current.filter((entry) => entry.storageKey !== image.storageKey);
                                  if (next.length > 0 && !next.some((entry) => entry.isDefault)) {
                                    next[0].isDefault = true;
                                  }
                                  return next;
                                });
                              } catch (err) {
                                setImageError(err instanceof Error ? err.message : 'Delete failed');
                              }
                            }}
                            className="absolute right-3 top-3 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black"
                            aria-label="Delete image"
                            >
                            Delete
                          </button>
                          <div className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                            <img src={image.src} alt={product.title} className="h-40 w-full object-contain" />
                          </div>
                          <div className="mt-2 space-y-2 text-xs text-gray-500 dark:text-gray-400">
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Row colours</p>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  disabled={imageSaving}
                                  onClick={() => {
                                    if (!image.storageKey) return;
                                    void handleUpdateImage(image.storageKey, { color: null });
                                  }}
                                  className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                    !image.color
                                      ? 'border-navy-800 bg-navy-800 text-white'
                                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  No colour selection
                                </button>
                                {visibleColors.map((color) => {
                                  const selected = image.color === color.name;
                                  return (
                                    <button
                                      key={color.name}
                                      type="button"
                                      disabled={imageSaving}
                                      onClick={() => {
                                        if (!image.storageKey) return;
                                        void handleUpdateImage(image.storageKey, { color: color.name });
                                      }}
                                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${
                                        selected
                                          ? 'border-navy-800 bg-navy-800 text-white'
                                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                                      }`}
                                    >
                                      <span
                                        className="inline-block h-3 w-3 rounded-full border border-black/10"
                                        style={{ backgroundColor: color.hex }}
                                      />
                                      {color.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              {image.isDefault ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Default image</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!image.storageKey) return;
                                    void handleUpdateImage(image.storageKey, { isDefault: true });
                                  }}
                                  disabled={imageSaving}
                                  className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                  Set default
                                </button>
                              )}
                              <span>{image.color || 'No colour selection'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminProductsPage() {
  const { token } = useAdminToken();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const draftRowRef = useRef<HTMLTableRowElement | null>(null);
  const [catalog, setCatalog] = useState<CatalogOptions>(DEFAULT_CATALOG_OPTIONS);

  const refreshCatalog = useCallback(async () => {
    if (!token) return;
    const settings = await adminGetSettings(token);
    setCatalog(parseCatalogSettings(settings));
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [data] = await Promise.all([
        adminFetchProducts(token),
        refreshCatalog(),
      ]);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [refreshCatalog, token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!draftOpen) return;
    draftRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [draftOpen]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Products
        </h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="primary" size="sm" onClick={() => setDraftOpen(true)}>
            + Add product
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
          >
            Reload products
          </Button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-3">No products cached yet.</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Reload products
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-[1540px] w-full table-fixed border-separate border-spacing-0">
              <colgroup>
                <col className="w-[250px]" />
                <col className="w-[290px]" />
                <col className="w-[170px]" />
                <col className="w-[280px]" />
                <col className="w-[230px]" />
                <col className="w-[260px]" />
                <col className="w-[140px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3 sm:px-6">Product</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">Colours</th>
                  <th className="px-4 py-3">Pricing</th>
                  <th className="px-4 py-3">Sizes</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3">Inventory</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    token={token!}
                    catalog={catalog}
                    onCatalogRefreshed={refreshCatalog}
                    onDeleted={(id) => setProducts((current) => current.filter((item) => item.id !== id))}
                  />
                ))}
                {draftOpen && (
                  <InlineDraftProductRow
                    token={token!}
                    catalog={catalog}
                    rowRef={draftRowRef}
                    onCancel={() => setDraftOpen(false)}
                    onCreated={async () => {
                      setDraftOpen(false);
                      await load();
                    }}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
