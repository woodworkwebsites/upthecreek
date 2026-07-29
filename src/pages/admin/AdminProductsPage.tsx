import { useState, useEffect, useCallback, useRef, type ReactNode, type Ref } from 'react';
import type { Product, PricingMatrixRow, CatalogRange } from '../../../types/index.js';
import { adminCreateProduct, adminDeleteProduct, adminDeleteProductImage, adminFetchProducts, adminFetchRanges, adminGetSettings, adminReorderProductImages, adminUpdateProduct, adminUpdateProductImage, adminUpdateSettings, adminUploadProductImage, adminUploadSizeGuideImage } from '../../lib/api.js';
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

const SELLSHIRTS_PRODUCT_URL_STUB = 'https://sellshirts.com/product/';

function getDefaultRangeId(ranges: CatalogRange[]): string {
  return ranges.find((range) => range.partnerEnabled && range.id !== 'evergreen')?.id
    ?? ranges.find((range) => range.id !== 'evergreen')?.id
    ?? '';
}

function normalizeColorKey(value: string): string {
  return value.trim().toLowerCase();
}

function extractSellShirtsProductId(url: string | null | undefined): string {
  const value = url?.trim() || '';
  if (!value) return '';
  return value.startsWith(SELLSHIRTS_PRODUCT_URL_STUB)
    ? value.slice(SELLSHIRTS_PRODUCT_URL_STUB.length)
    : value;
}

function buildSellShirtsProductUrl(productId: string): string {
  return `${SELLSHIRTS_PRODUCT_URL_STUB}${productId.trim()}`;
}

function buildColorOrderUrlMap(colors: Product['colors']): Record<string, string> {
  const next: Record<string, string> = {};
  for (const color of colors) {
    const key = normalizeColorKey(color.name);
    const orderProductId = extractSellShirtsProductId(color.orderUrl);
    if (key && orderProductId) {
      next[key] = orderProductId;
    }
  }
  return next;
}

function InlineDraftProductRow({
  token,
  catalog,
  ranges,
  onCreated,
  onCancel,
  rowRef,
}: {
  token: string;
  catalog: CatalogOptions;
  ranges: CatalogRange[];
  onCreated: () => Promise<void> | void;
  onCancel: () => void;
  rowRef?: Ref<HTMLDivElement>;
}) {
  const [printSurface, setPrintSurface] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(catalog.audiences[0] ?? '');
  const [productType, setProductType] = useState(catalog.products[0] ?? '');
  const [garmentType, setGarmentType] = useState(catalog.garments[0] ?? '');
  const [rangeId, setRangeId] = useState(getDefaultRangeId(ranges));
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
      form.append('rangeId', rangeId.trim() || getDefaultRangeId(ranges));
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
        deliveryRetail: '',
        deliveryPartner: '',
        deliveryOnlinePartnership: '',
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
    <div ref={rowRef} className="overflow-hidden rounded-[1.75rem] border border-dashed border-gray-200 bg-cream/20 shadow-[0_18px_50px_rgba(5,13,31,0.04)] dark:border-gray-700 dark:bg-gray-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-6">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">New product</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Create a garment card with the essentials visible and the heavier edit actions tucked away.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
        >
          Cancel
        </button>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                <span className={`inline-flex h-4 w-8 items-center rounded-full p-0.5 transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                  <span className={`h-3 w-3 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                </span>
                <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="sr-only" />
                Enabled
              </label>
              <select value={rangeId} onChange={(e) => setRangeId(e.target.value)} className="min-w-[140px] rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="">Range</option>
                {ranges.map((range) => (
                  <option key={range.id} value={range.id}>{range.name}</option>
                ))}
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="min-w-[120px] rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="">Audience</option>
                {catalog.audiences.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select value={productType} onChange={(e) => setProductType(e.target.value)} className="min-w-[120px] rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="">Product</option>
                {catalog.products.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select value={garmentType} onChange={(e) => setGarmentType(e.target.value)} className="min-w-[140px] rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="">Garment</option>
                {catalog.garments.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select value={printSurface} onChange={(e) => setPrintSurface(e.target.value)} className="min-w-[160px] rounded-full border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="">Print surface</option>
                {Array.from(new Set(catalog.pricingRows.map((row) => row.printSurface.trim()).filter(Boolean))).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setDetailOpen(true)}
                className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                Description
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <ColorMultiSelect colors={catalog.colors} selected={selectedColors} onToggle={(color) => toggleColor(color.name)} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Images</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Upload imagery and choose the default.</p>
              </div>
              <input type="file" accept="image/*" multiple onChange={(e) => handleFilesSelected(e.target.files)} className="max-w-[240px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700" />
            </div>
            {images.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {images.map((img, index) => (
                  <div key={index} className="rounded-xl border border-gray-100 p-2 dark:border-gray-800">
                    <img src={img.previewUrl} alt="" className="h-28 w-full rounded-lg object-cover" />
                    <div className="mt-2 flex items-center justify-between gap-2">
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
                    <label className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                      <input type="radio" name="default-image" checked={img.isDefault} onChange={() => setDefaultImage(index)} />
                      Default image
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 px-3 py-4 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                No images uploaded
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Publish on save</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Select the colours you want, then save to publish the product immediately.</p>
          </div>

          {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => { void handleSubmit(); }} disabled={submitting} className="rounded-full bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create product'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function pricingMatrixSignature(matrix: {
  audience: string;
  product: string;
  garment: string;
  printSurface: string;
  manufacturingCost: string;
  saleCost: string;
  deliveryRetail: string;
  deliveryPartner: string;
  deliveryOnlinePartnership: string;
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
  deliveryRetail: string;
  deliveryPartner: string;
  deliveryOnlinePartnership: string;
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
    deliveryRetail: matrix.deliveryRetail.trim(),
    deliveryPartner: matrix.deliveryPartner.trim(),
    deliveryOnlinePartnership: matrix.deliveryOnlinePartnership.trim(),
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
    deliveryRetail: '',
    deliveryPartner: '',
    deliveryOnlinePartnership: '',
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
  deliveryRetail: string;
  deliveryPartner: string;
  deliveryOnlinePartnership: string;
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
  deliveryRetail: string;
  deliveryPartner: string;
  deliveryOnlinePartnership: string;
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
  ranges,
  onCatalogRefreshed,
  onDeleted,
  onRegisterSave,
}: {
  product: Product;
  token: string;
  catalog: CatalogOptions;
  ranges: CatalogRange[];
  onCatalogRefreshed: () => Promise<void>;
  onDeleted: (id: string) => void;
  onRegisterSave: (id: string, save: (() => Promise<boolean>) | null) => void;
}) {
  const [images, setImages] = useState(product.images);
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? '');
  const [category, setCategory] = useState(product.audience || '');
  const [productType, setProductType] = useState(product.productType || '');
  const [garmentType, setGarmentType] = useState(product.garment || '');
  const [rangeId, setRangeId] = useState(product.rangeId ?? getDefaultRangeId(ranges));
  const initialPricingMatrix = {
    ...emptyPricingMatrix(),
    ...(product.pricingMatrix ?? matchPricingPreset(product, catalog) ?? {}),
  };
  const [pricingMatrix, setPricingMatrix] = useState(initialPricingMatrix);
  const [hiddenColors, setHiddenColors] = useState<string[]>(product.hiddenColors ?? []);
  const [colorOrderUrls, setColorOrderUrls] = useState<Record<string, string>>(() => buildColorOrderUrlMap(product.colors));
  const [selectedSizes, setSelectedSizes] = useState<string[]>(product.sizes.length > 0 ? product.sizes : DEFAULT_SIZE_OPTIONS);
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
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [sizeGuideUploading, setSizeGuideUploading] = useState(false);
  const [sizeGuideUploadError, setSizeGuideUploadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const pricingCustomRef = useRef(Boolean(product.pricingMatrix));
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const nextPreset = matchPricingPreset(product, catalog) ?? emptyPricingMatrix();
    setTitle(product.title);
    setDescription(product.description ?? '');
    setCategory(product.audience || '');
    setProductType(product.productType || '');
    setGarmentType(product.garment || '');
    setRangeId(product.rangeId ?? getDefaultRangeId(ranges));
    setPricingMatrix(product.pricingMatrix ?? nextPreset);
    pricingCustomRef.current = Boolean(product.pricingMatrix);
    setHiddenColors(product.hiddenColors ?? []);
    setColorOrderUrls(buildColorOrderUrlMap(product.colors));
    setSelectedSizes(product.sizes.length > 0 ? product.sizes : DEFAULT_SIZE_OPTIONS);
    setIsEnabled(product.isEnabled);
    setImages(product.images);
  }, [product, ranges]);

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

  function toggleColor(colorName: string) {
    setHiddenColors((current) =>
      current.includes(colorName)
        ? current.filter((value) => value !== colorName)
        : [...current, colorName],
    );
  }

  function toggleSize(size: string) {
    setSelectedSizes((current) => {
      const isSelected = current.includes(size);
      if (isSelected && current.length === 1) {
        return current;
      }
      return isSelected
        ? current.filter((value) => value !== size)
        : [...current.filter((value) => value !== size), size];
    });
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
      const key = normalizeColorKey(color.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();
  const visibleColors = allColors
    .filter((color) => !hiddenColors.includes(color.name))
    .map((color) => {
      const key = normalizeColorKey(color.name);
      return {
        ...color,
        orderProductId: colorOrderUrls[key] ?? extractSellShirtsProductId(product.colors.find((entry) => normalizeColorKey(entry.name) === key)?.orderUrl),
      };
    });
  const currentColorSignature = JSON.stringify(visibleColors.map((color) => ({
    name: color.name,
    hex: color.hex,
    orderProductId: color.orderProductId?.trim() ?? '',
  })));
  const originalColorSignature = JSON.stringify(
    visibleColors.map((color) => {
      const original = product.colors.find((entry) => normalizeColorKey(entry.name) === normalizeColorKey(color.name));
      return {
        name: color.name,
        hex: color.hex,
        orderProductId: extractSellShirtsProductId(original?.orderUrl),
      };
    }),
  );
  const currentPricingSignature = pricingMatrixSignature(pricingMatrix);
  const originalPricingSignature = pricingMatrixSignature({
    ...emptyPricingMatrix(),
    ...(product.pricingMatrix ?? matchPricingPreset(product, catalog) ?? {}),
  });
  const currentSizeSignature = JSON.stringify(selectedSizes);
  const originalSizeSignature = JSON.stringify(product.sizes.length > 0 ? product.sizes : DEFAULT_SIZE_OPTIONS);
  const hasChanges = title.trim() !== product.title
    || description.trim() !== (product.description ?? '').trim()
    || category.trim() !== (product.audience || '').trim()
    || productType.trim() !== (product.productType || '').trim()
    || garmentType.trim() !== (product.garment || '').trim()
    || rangeId.trim() !== (product.rangeId ?? '').trim()
    || isEnabled !== product.isEnabled
    || currentPricingSignature !== originalPricingSignature
    || currentSizeSignature !== originalSizeSignature
    || currentColorSignature !== originalColorSignature
    || hiddenColors.length !== (product.hiddenColors ?? []).length
    || hiddenColors.some((color) => !(product.hiddenColors ?? []).includes(color));

  async function handleSaveRow(closeDetails = false) {
    if (saving) return false;
    if (!hasChanges) return true;

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
        rangeId: rangeId.trim() || null,
        pricingMatrix: normalizePricingMatrix(pricingMatrix),
        sizes: selectedSizes,
        colors: visibleColors.map((color) => ({
          name: color.name,
          hex: color.hex,
          orderUrl: color.orderProductId?.trim() ? buildSellShirtsProductUrl(color.orderProductId) : undefined,
        })),
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

  useEffect(() => {
    onRegisterSave(product.id, handleSaveRow);
    return () => onRegisterSave(product.id, null);
  }, [handleSaveRow, onRegisterSave, product.id]);

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
      <article className="h-full min-w-0 overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-[0_14px_34px_rgba(5,13,31,0.05)] transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
        <div className="grid gap-0 min-w-0 lg:grid-cols-[160px_minmax(0,1fr)]">
          <div className="flex flex-col border-b border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950">
              <div className="aspect-[4/5]">
                {img ? (
                  <img src={img.src} alt={product.title} className="h-full w-full object-cover object-center" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No image</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setImageModalOpen(true)}
              className="mt-3 w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Images
            </button>
            <label className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
              <span className={`inline-flex h-4 w-8 items-center rounded-full p-0.5 transition-colors ${isEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                <span className={`h-3 w-3 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
              </span>
              <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="sr-only" />
              Enabled
            </label>

            <div className="mt-auto w-full rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/60">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Published</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{formatDate(product.syncedAt)}</p>
            </div>
          </div>

          <div className="min-w-0 space-y-3 p-4 sm:p-5">
            <div className="space-y-3 min-w-0">
              <div className="min-w-0 space-y-3">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    ref={titleRef}
                    className="w-full max-w-[42rem] rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                </div>

                <div className="grid gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60 xl:grid-cols-[minmax(220px,240px)_minmax(0,1fr)] xl:items-start">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Range</p>
                      {isEnabled ? (
                        <select value={rangeId} onChange={(e) => setRangeId(e.target.value)} className="w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                          <option value="">Select range</option>
                          {ranges.map((range) => (
                            <option key={range.id} value={range.id}>{range.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex w-full items-center rounded-full border border-dashed border-gray-200 px-3 py-1.5 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">Hidden until live</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Catalog</p>
                      <button type="button" onClick={() => setDetailOpen(true)} className="inline-flex w-full items-center justify-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                        Edit description
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Classification</p>
                    <div className="grid gap-2">
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full min-w-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                        <option value="">Audience</option>
                        {catalog.audiences.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <select value={productType} onChange={(e) => setProductType(e.target.value)} className="w-full min-w-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                        <option value="">Product</option>
                        {catalog.products.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      <select value={garmentType} onChange={(e) => setGarmentType(e.target.value)} className="w-full min-w-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                        <option value="">Garment</option>
                        {catalog.garments.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60">
                  <ColorMultiSelect colors={allColors} selected={visibleColors.map((color) => color.name)} onToggle={(color) => toggleColor(color.name)} />
                  <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                        Order links
                      </p>
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                        {visibleColors.length} colours
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {visibleColors.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                          Select at least one colour to add its SellShirts product id.
                        </p>
                      ) : visibleColors.map((color) => {
                        const key = normalizeColorKey(color.name);
                        return (
                          <label key={color.name} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-950">
                            <span className="flex min-w-0 items-center gap-2 font-semibold text-gray-700 dark:text-gray-200">
                              <span className="inline-block h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                              <span className="truncate">{color.name}</span>
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={color.orderProductId ?? ''}
                              onChange={(e) => setColorOrderUrls((current) => ({
                                ...current,
                                [key]: e.target.value,
                              }))}
                              placeholder="16653"
                              className="w-24 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-right text-xs text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">Sizes</p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{selectedSizes.length} selected</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(product.sizes.length > 0 ? product.sizes : DEFAULT_SIZE_OPTIONS).map((size) => {
                      const isSelected = selectedSizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => toggleSize(size)}
                          aria-pressed={isSelected}
                          className={`inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-lg border-2 px-3.5 text-sm font-bold shadow-md shadow-navy-900/20 transition-colors ${
                            isSelected
                              ? 'border-navy-800 bg-navy-800 text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-navy-800 hover:text-navy-800'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="w-full max-w-[28rem] rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-900/10">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Pricing</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950 dark:text-amber-200">
                      {pricingMatrix.salePrice ? `£${pricingMatrix.salePrice}` : formatPriceRange(product.minPrice, product.maxPrice)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPricingModalOpen(true)}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 dark:border-gray-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="flex min-w-0 flex-col gap-1 sm:mr-auto">
                {saved && <span className="text-[11px] text-green-600 dark:text-green-400">Saved</span>}
                {error && <span className="text-[11px] text-red-600 dark:text-red-400">{error}</span>}
              </div>
              <button onClick={() => void handleSaveRow()} className="w-full rounded-full bg-navy-800 px-3.5 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-navy-700 sm:w-auto">
                {saving ? 'Saving…' : 'Save card'}
              </button>
              <button type="button" onClick={() => void handleDeleteProductRow()} disabled={saving || deleting} className="w-full rounded-full border border-red-200 bg-red-50 px-3.5 py-2 text-[11px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50 sm:w-auto">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </article>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
          <div className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit description</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{product.title}</p>
              </div>
              <button type="button" onClick={() => setDetailOpen(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
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
              <button type="button" onClick={() => setDetailOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button type="button" onClick={() => { void handleSaveRow(true); }} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 transition-colors">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {imageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
          <div className="flex w-full max-w-6xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manage images</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{product.title}</p>
              </div>
              <button type="button" onClick={() => setImageModalOpen(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                Close
              </button>
            </div>

            <div className="mt-5 grid flex-1 min-h-0 gap-6 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-3 overflow-y-auto pr-1">
                <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload image</label>
                <input type="file" accept="image/*" multiple onChange={(e) => setImageUploadFiles(Array.from(e.target.files ?? []))} className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700" />
                <select value={imageUploadColor} onChange={(e) => setImageUploadColor(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                  <option value="">No colour selection</option>
                  {visibleColors.map((color) => (
                    <option key={color.name} value={color.name}>{color.name}</option>
                  ))}
                </select>
                <label className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                  <span className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${imageUploadDefault ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                    <span className={`h-4 w-4 rounded-full bg-white transition-transform ${imageUploadDefault ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                  <input type="checkbox" checked={imageUploadDefault} onChange={(e) => setImageUploadDefault(e.target.checked)} className="sr-only" />
                  Default image
                </label>
                {imageUploadPreviews.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{imageUploadPreviews.length} selected</div>
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
                <button type="button" onClick={handleUploadProductImage} disabled={imageSaving} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors">
                  {imageSaving ? 'Uploading…' : 'Upload image'}
                </button>
                {imageError && <div className="text-xs text-red-600 dark:text-red-400">{imageError}</div>}

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Size guide</p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input type="file" accept="image/*" onChange={(e) => setSizeGuideUploadFile(e.target.files?.[0] ?? null)} className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700 dark:text-gray-400" />
                    <button type="button" onClick={handleUploadSizeGuide} disabled={sizeGuideUploading} className="w-full rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50 sm:w-auto">
                      {sizeGuideUploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                  {sizeGuideUploadFile && <div className="text-[11px] text-gray-500 dark:text-gray-400">Selected: {sizeGuideUploadFile.name}</div>}
                  {sizeGuideUploadError && <div className="text-xs text-red-600 dark:text-red-400">{sizeGuideUploadError}</div>}
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
                        if (dropTargetImageKey === image.storageKey) setDropTargetImageKey(null);
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
                            <button type="button" disabled={imageSaving} onClick={() => { if (!image.storageKey) return; void handleUpdateImage(image.storageKey, { color: null }); }} className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${!image.color ? 'border-navy-800 bg-navy-800 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
                              No colour selection
                            </button>
                            {visibleColors.map((color) => {
                              const selected = image.color === color.name;
                              return (
                                <button key={color.name} type="button" disabled={imageSaving} onClick={() => { if (!image.storageKey) return; void handleUpdateImage(image.storageKey, { color: color.name }); }} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors ${selected ? 'border-navy-800 bg-navy-800 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'}`}>
                                  <span className="inline-block h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
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
                            <button type="button" onClick={() => { if (!image.storageKey) return; void handleUpdateImage(image.storageKey, { isDefault: true }); }} disabled={imageSaving} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800">
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
      )}

      {pricingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
          <div className="flex w-full max-w-3xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Edit pricing</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{product.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPricingModalOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">Pricing matrix</p>
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950 dark:text-amber-200">
                    {pricingMatrix.salePrice ? `£${pricingMatrix.salePrice}` : formatPriceRange(product.minPrice, product.maxPrice)}
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Print surface">
                      <input value={pricingMatrix.printSurface} onChange={(e) => updatePricingMatrix({ printSurface: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    </Field>
                    <Field label="Manufacturing cost">
                      <input value={pricingMatrix.manufacturingCost} onChange={(e) => updatePricingMatrix({ manufacturingCost: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    </Field>
                    <Field label="Sale cost">
                      <input value={pricingMatrix.saleCost} onChange={(e) => updatePricingMatrix({ saleCost: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    </Field>
                    <Field label="Retail delivery">
                      <input value={pricingMatrix.deliveryRetail} onChange={(e) => updatePricingMatrix({ deliveryRetail: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    </Field>
                    <Field label="Partner delivery">
                      <input value={pricingMatrix.deliveryPartner} onChange={(e) => updatePricingMatrix({ deliveryPartner: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    </Field>
                    <Field label="Online partnership delivery">
                      <input value={pricingMatrix.deliveryOnlinePartnership} onChange={(e) => updatePricingMatrix({ deliveryOnlinePartnership: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    </Field>
                    <Field label="Retail price">
                      <input value={pricingMatrix.salePrice} onChange={(e) => updatePricingMatrix({ salePrice: e.target.value })} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                    </Field>
                    <Field label="Partner price">
                      <input value={pricingMatrix.partnerPrice} onChange={(e) => updatePricingMatrix({ partnerPrice: e.target.value })} className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-gray-900 dark:border-amber-900/40 dark:bg-gray-900 dark:text-gray-100" />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 pt-3 dark:border-amber-900/40">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                      {pricingCustomRef.current ? 'Custom pricing' : 'Catalog pricing'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={resetPricingToCatalog}
                        className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        Use catalog
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPricingModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => { setPricingModalOpen(false); void handleSaveRow(true); }}
                className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 transition-colors"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function AdminProductsPage() {
  const { token } = useAdminToken();
  const [products, setProducts] = useState<Product[]>([]);
  const [ranges, setRanges] = useState<CatalogRange[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const draftRowRef = useRef<HTMLDivElement | null>(null);
  const [catalog, setCatalog] = useState<CatalogOptions>(DEFAULT_CATALOG_OPTIONS);
  const saveHandlersRef = useRef(new Map<string, () => Promise<boolean>>());
  const saveAllInProgressRef = useRef(false);
  const [savingAll, setSavingAll] = useState(false);

  const registerRowSave = useCallback((id: string, save: (() => Promise<boolean>) | null) => {
    if (save) {
      saveHandlersRef.current.set(id, save);
    } else {
      saveHandlersRef.current.delete(id);
    }
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (saveAllInProgressRef.current) return;
    saveAllInProgressRef.current = true;
    setSavingAll(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        Array.from(saveHandlersRef.current.values()).map((save) => save()),
      );
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failures.length > 0) {
        setError(`Saved with ${failures.length} row${failures.length === 1 ? '' : 's'} failing`);
      }
    } finally {
      saveAllInProgressRef.current = false;
      setSavingAll(false);
    }
  }, []);

  const refreshCatalog = useCallback(async () => {
    if (!token) return;
    const settings = await adminGetSettings(token);
    setCatalog(parseCatalogSettings(settings));
  }, [token]);

  const refreshRanges = useCallback(async () => {
    if (!token) return;
    const data = await adminFetchRanges(token);
    setRanges(data);
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [data] = await Promise.all([
        adminFetchProducts(token),
        refreshCatalog(),
        refreshRanges(),
      ]);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [refreshCatalog, refreshRanges, token]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!draftOpen) return;
    draftRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [draftOpen]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Products
        </h1>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row sm:items-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleSaveAll()}
            disabled={savingAll || products.length === 0}
            className="w-full sm:w-auto"
          >
            {savingAll ? 'Saving all…' : 'Save all changes'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setDraftOpen(true)} className="w-full sm:w-auto">
            + Add product
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            className="w-full sm:w-auto"
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
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-1 xl:[grid-template-columns:repeat(auto-fit,minmax(38rem,1fr))]">
          {products.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              token={token!}
              catalog={catalog}
              ranges={ranges}
              onCatalogRefreshed={refreshCatalog}
              onDeleted={(id) => setProducts((current) => current.filter((item) => item.id !== id))}
              onRegisterSave={registerRowSave}
            />
          ))}
          {draftOpen && (
            <InlineDraftProductRow
              token={token!}
              catalog={catalog}
              ranges={ranges}
              rowRef={draftRowRef}
              onCancel={() => setDraftOpen(false)}
              onCreated={async () => {
                setDraftOpen(false);
                await load();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
