import { useState, useEffect, useCallback, useRef } from 'react';
import type { Product } from '../../../types/index.js';
import { adminCreateProduct, adminFetchProducts, adminSyncProducts, adminUpdateProduct, adminUploadProductImage, adminUploadSizeGuideImage } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Button } from '../../components/ui/Button.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatPriceRange, formatDate } from '../../lib/utils.js';

interface DraftVariantRow {
  color: string;
  hex: string;
  size: string;
  manufacturingCost: string;
  delivery: string;
  salePrice: string;
  available: boolean;
}

interface DraftImageRow {
  file: File;
  previewUrl: string;
  color: string;
  isDefault: boolean;
}

function emptyDraftVariant(): DraftVariantRow {
  return {
    color: '',
    hex: '#333333',
    size: '',
    manufacturingCost: '',
    delivery: '2.99',
    salePrice: '24.99',
    available: true,
  };
}

function parseMoney(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

function InlineDraftProductRow({
  token,
  onCreated,
  onCancel,
}: {
  token: string;
  onCreated: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [design, setDesign] = useState('');
  const [productName, setProductName] = useState('');
  const [garment, setGarment] = useState('');
  const [gender, setGender] = useState('');
  const [type, setType] = useState('');
  const [printSurface, setPrintSurface] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('apparel');
  const [isEnabled, setIsEnabled] = useState(true);
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#333333');
  const [colors, setColors] = useState<Array<{ name: string; hex: string }>>([]);
  const [sizeValue, setSizeValue] = useState('');
  const [sizes, setSizes] = useState<string[]>([]);
  const [variantRows, setVariantRows] = useState<Record<string, DraftVariantRow>>({});
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

  useEffect(() => {
    const parts = [design.trim(), garment.trim(), productName.trim(), gender.trim()].filter(Boolean);
    if (parts.length > 0) {
      setTitle(parts.join(' / '));
    }
  }, [design, garment, productName, gender]);

  useEffect(() => {
    setVariantRows((current) => {
      const next: Record<string, DraftVariantRow> = {};
      for (const color of colors) {
        for (const size of sizes) {
          const key = `${color.name}||${size}`;
          const existing = current[key] ?? emptyDraftVariant();
          next[key] = {
            ...existing,
            color: color.name,
            hex: color.hex,
            size,
          };
        }
      }
      return next;
    });
  }, [colors, sizes]);

  function addColor() {
    const name = colorName.trim();
    if (!name) return;
    setColors((current) => {
      if (current.some((color) => color.name.toLowerCase() === name.toLowerCase())) return current;
      return [...current, { name, hex: colorHex }];
    });
    setColorName('');
    setColorHex('#333333');
  }

  function removeColor(name: string) {
    setColors((current) => current.filter((color) => color.name !== name));
  }

  function addSize() {
    const size = sizeValue.trim();
    if (!size) return;
    setSizes((current) => (current.includes(size) ? current : [...current, size]));
    setSizeValue('');
  }

  function removeSize(size: string) {
    setSizes((current) => current.filter((value) => value !== size));
  }

  function updateVariant(key: string, patch: Partial<DraftVariantRow>) {
    setVariantRows((current) => ({
      ...current,
      [key]: { ...current[key], ...patch },
    }));
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const newRows: DraftImageRow[] = Array.from(fileList).map((file, i) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      color: '',
      isDefault: images.length === 0 && i === 0,
    }));
    setImages((current) => [...current, ...newRows]);
  }

  function updateImage(index: number, patch: Partial<DraftImageRow>) {
    setImages((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
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

  async function handleSubmit() {
    if (!token) return;
    setError(null);

    const resolvedTitle = title.trim() || design.trim();
    if (!resolvedTitle) {
      setError('Design or title is required');
      return;
    }
    if (colors.length === 0 || sizes.length === 0) {
      setError('Add at least one colour and one size');
      return;
    }

    const validVariants = Object.values(variantRows).filter((row) => row.color.trim() && row.size.trim() && row.salePrice.trim());
    if (validVariants.length === 0) {
      setError('At least one complete variant row is required');
      return;
    }

    setSubmitting(true);
    try {
      const metadataDescription = [
        design.trim() && `Design: ${design.trim()}`,
        productName.trim() && `Product: ${productName.trim()}`,
        garment.trim() && `Garment: ${garment.trim()}`,
        gender.trim() && `Gender: ${gender.trim()}`,
        type.trim() && `Type: ${type.trim()}`,
        printSurface.trim() && `Print surface: ${printSurface.trim()}`,
      ].filter(Boolean).join('\n');

      const form = new FormData();
      form.append('title', resolvedTitle);
      form.append('description', description.trim() || metadataDescription);
      form.append('category', category.trim() || 'apparel');
      form.append('variants', JSON.stringify(validVariants.map((v) => ({
        color: v.color.trim(),
        hex: v.hex,
        size: v.size.trim(),
        price: Math.round(parseMoney(v.salePrice) * 100),
        available: v.available,
        manufacturingCost: Math.round(parseMoney(v.manufacturingCost) * 100),
        delivery: Math.round(parseMoney(v.delivery) * 100),
        salePrice: Math.round(parseMoney(v.salePrice) * 100),
      }))));
      form.append('imagesMeta', JSON.stringify(images.map((img) => ({
        color: img.color || undefined,
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
    <tr className="border-t border-dashed border-gray-200 bg-cream/20 dark:border-gray-700 dark:bg-gray-950/40">
      <td colSpan={6} className="p-0">
        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">New product</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Fill each stage, then save the row into the table.</p>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStage(value as 1 | 2 | 3)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    stage === value
                      ? 'bg-navy-800 text-white'
                      : 'border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200'
                  }`}
                >
                  Stage {value}
                </button>
              ))}
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>

          {stage === 1 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Identity</p>
                <div className="mt-3 space-y-3">
                  <input type="text" value={design} onChange={(e) => setDesign(e.target.value)} placeholder="Design" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    <input type="text" value={garment} onChange={(e) => setGarment(e.target.value)} placeholder="Garment" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    <input type="text" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Gender" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    <input type="text" value={type} onChange={(e) => setType(e.target.value)} placeholder="Type" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  </div>
                  <input type="text" value={printSurface} onChange={(e) => setPrintSurface(e.target.value)} placeholder="Print surface" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={4} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Publication</p>
                <div className="mt-3 space-y-3">
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                    <option value="apparel">Apparel</option>
                    <option value="accessories">Accessories</option>
                    <option value="other">Other</option>
                  </select>
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
          )}

          {stage === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Colours</p>
                  <div className="mt-3 flex gap-2">
                    <input value={colorName} onChange={(e) => setColorName(e.target.value)} placeholder="Add colour" className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="h-10 w-14 rounded-lg border border-gray-200 bg-transparent p-1 dark:border-gray-700" />
                    <button type="button" onClick={addColor} className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white">Add</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {colors.map((color) => (
                      <button key={color.name} type="button" onClick={() => removeColor(color.name)} className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                        <span className="mr-1 inline-block h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                        {color.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sizes</p>
                  <div className="mt-3 flex gap-2">
                    <input value={sizeValue} onChange={(e) => setSizeValue(e.target.value)} placeholder="Add size" className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                    <button type="button" onClick={addSize} className="rounded-lg bg-navy-800 px-3 py-2 text-xs font-semibold text-white">Add</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sizes.map((size) => (
                      <button key={size} type="button" onClick={() => removeSize(size)} className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
                <table className="min-w-[960px] w-full border-separate border-spacing-0 text-left">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                    <tr className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-3">Colour</th>
                      <th className="px-3 py-3">Size</th>
                      <th className="px-3 py-3">Manufacturing</th>
                      <th className="px-3 py-3">Delivery</th>
                      <th className="px-3 py-3">Sale price</th>
                      <th className="px-3 py-3">Margin</th>
                      <th className="px-3 py-3">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(variantRows).map(([key, row]) => {
                      const margin = parseMoney(row.salePrice) - parseMoney(row.manufacturingCost) - parseMoney(row.delivery);
                      return (
                        <tr key={key} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                              {row.color}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                              {row.size}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <input value={row.manufacturingCost} onChange={(e) => updateVariant(key, { manufacturingCost: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={row.delivery} onChange={(e) => updateVariant(key, { delivery: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={row.salePrice} onChange={(e) => updateVariant(key, { salePrice: e.target.value })} className="w-28 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                          </td>
                          <td className="px-3 py-2">
                            <div className={`rounded-lg px-2 py-2 text-xs font-semibold ${margin >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                              {formatMoney(margin)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                              <input type="checkbox" checked={row.available} onChange={(e) => updateVariant(key, { available: e.target.checked })} />
                              In stock
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stage === 3 && (
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
                      <div className="flex items-center gap-2">
                        <select value={img.color} onChange={(e) => updateImage(index, { color: e.target.value })} className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                          <option value="">All colours</option>
                          {colors.map((color) => (
                            <option key={color.name} value={color.name}>{color.name}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => removeImage(index)} className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400">Remove</button>
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
          )}

          {error && <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-3">
            {stage > 1 && (
              <button type="button" onClick={() => setStage((current) => Math.max(1, current - 1) as 1 | 2 | 3)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                Back
              </button>
            )}
            {stage < 3 ? (
              <button type="button" onClick={() => setStage((current) => (current + 1) as 1 | 2 | 3)} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">
                Next
              </button>
            ) : (
              <button type="button" onClick={() => { void handleSubmit(); }} disabled={submitting} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {submitting ? 'Creating…' : 'Create product'}
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

function ProductRow({ product, token }: { product: Product; token: string }) {
  const img = product.images.find((i) => i.isDefault) ?? product.images[0];
  const [images, setImages] = useState(product.images);
  const [title, setTitle] = useState(product.title);
  const [description, setDescription] = useState(product.description ?? '');
  const [category, setCategory] = useState(product.category ?? 'apparel');
  const [sizeGuideUrl, setSizeGuideUrl] = useState(product.sizeGuideImage ?? '');
  const [hiddenColors, setHiddenColors] = useState<string[]>(product.hiddenColors ?? []);
  const [isEnabled, setIsEnabled] = useState(product.isEnabled);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUploadFile, setImageUploadFile] = useState<File | null>(null);
  const [imageUploadPreview, setImageUploadPreview] = useState<string | null>(null);
  const [imageUploadColor, setImageUploadColor] = useState('');
  const [imageUploadDefault, setImageUploadDefault] = useState(false);
  const [imageSaving, setImageSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(product.title);
    setDescription(product.description ?? '');
    setCategory(product.category ?? 'apparel');
    setSizeGuideUrl(product.sizeGuideImage ?? '');
    setHiddenColors(product.hiddenColors ?? []);
    setIsEnabled(product.isEnabled);
    setImages(product.images);
  }, [product]);

  useEffect(() => {
    if (!selectedFile) {
      setFilePreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setFilePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (!imageUploadFile) {
      setImageUploadPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(imageUploadFile);
    setImageUploadPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageUploadFile]);

  function toggleColor(colorName: string) {
    setHiddenColors((current) =>
      current.includes(colorName)
        ? current.filter((value) => value !== colorName)
        : [...current, colorName],
    );
  }

  async function handleUploadProductImage() {
    if (!imageUploadFile) {
      setImageError('Choose an image first');
      return;
    }

    setImageSaving(true);
    setImageError(null);
    try {
      const result = await adminUploadProductImage(
        token,
        product.printifyId,
        imageUploadFile,
        imageUploadColor.trim() || undefined,
        imageUploadDefault,
      );
      setImages((current) => {
        const next = imageUploadDefault
          ? current.map((entry) => ({ ...entry, isDefault: false }))
          : [...current];
        next.push(result.image);
        return next;
      });
      setImageUploadFile(null);
      setImageUploadColor('');
      setImageUploadDefault(false);
      setImageModalOpen(false);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setImageSaving(false);
    }
  }

  const visibleColors = product.colors.filter((color) => !hiddenColors.includes(color.name));
  const hiddenCount = hiddenColors.length;
  const hasChanges = title.trim() !== product.title
    || description.trim() !== (product.description ?? '').trim()
    || category.trim() !== (product.category ?? 'apparel').trim()
    || sizeGuideUrl.trim() !== (product.sizeGuideImage ?? '').trim()
    || isEnabled !== product.isEnabled
    || hiddenColors.length !== (product.hiddenColors ?? []).length
    || hiddenColors.some((color) => !(product.hiddenColors ?? []).includes(color));

  const priceBand = formatPriceRange(product.minPrice, product.maxPrice);

  async function handleSaveRow(closeDetails = false) {
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
        category: category.trim() || 'apparel',
        sizeGuideImage: sizeGuideUrl.trim() || null,
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

  async function handleUploadSizeGuide() {
    if (!selectedFile) {
      setUploadError('Choose an image first');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const result = await adminUploadSizeGuideImage(token, product.printifyId, selectedFile);
      setSizeGuideUrl(result.sizeGuideImage);
      setSelectedFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <tr className="border-b border-gray-100 bg-white transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/50 align-top">
        <td className="px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="h-16 w-12 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0">
              {img ? (
                <img src={img.src} alt={product.title} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No img</div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
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
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {product.printifyId.startsWith('manual_') ? 'Manual product' : 'Synced'}
              </p>
              <p className="font-mono text-[11px] text-gray-400 dark:text-gray-500 truncate">{product.printifyId}</p>
            </div>
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="space-y-2">
            <p className="font-medium text-gray-900 dark:text-gray-100">{priceBand}</p>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            >
              <option value="apparel">Apparel</option>
              <option value="accessories">Accessories</option>
              <option value="other">Other</option>
            </select>
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Edit description
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {description ? 'Description set' : 'No description yet'}
            </div>
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="flex flex-wrap gap-1.5">
            {product.colors.map((color) => {
              const isHidden = hiddenColors.includes(color.name);
              return (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => toggleColor(color.name)}
                  aria-pressed={!isHidden}
                  className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${
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
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {visibleColors.length} visible, {hiddenCount} hidden
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="flex flex-wrap gap-1.5">
            {product.sizes.map((size) => (
              <span
                key={size}
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                {size}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{product.variants.length} variants</p>
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
            <input
              type="url"
              value={sizeGuideUrl}
              onChange={(e) => setSizeGuideUrl(e.target.value)}
              placeholder="Size guide URL"
              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700 dark:text-gray-400"
              />
              <button
                type="button"
                onClick={handleUploadSizeGuide}
                disabled={uploading}
                className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            {selectedFile && <div className="text-[11px] text-gray-500 dark:text-gray-400">Selected: {selectedFile.name}</div>}
            {(filePreview || sizeGuideUrl) && (
              <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <img src={filePreview ?? sizeGuideUrl} alt="Size guide preview" className="max-h-20 w-full object-contain" />
              </div>
            )}
            {uploadError && <div className="text-xs text-red-600 dark:text-red-400">{uploadError}</div>}
          </div>
        </td>

        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
          <div className="space-y-2">
            <button
              onClick={() => void handleSaveRow()}
              disabled={saving || !hasChanges}
              className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save row'}
            </button>
            {saved && <div className="text-xs text-green-600 dark:text-green-400">Saved</div>}
            {error && <div className="text-xs text-red-600 dark:text-red-400">{error}</div>}
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {product.printifyId.startsWith('manual_')
                ? `Added manually ${formatDate(product.syncedAt)}`
                : `Synced ${formatDate(product.syncedAt)}`}
            </p>
          </div>
        </td>
      </tr>

      {detailOpen && (
        <tr>
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
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

                <div className="mt-5">
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
                    disabled={saving || !hasChanges}
                    className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50 transition-colors"
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
          <td colSpan={6} className="p-0">
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
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

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageUploadFile(e.target.files?.[0] ?? null)}
                      className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700"
                    />
                    <select
                      value={imageUploadColor}
                      onChange={(e) => setImageUploadColor(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    >
                      <option value="">All colours</option>
                      {product.colors.map((color) => (
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
                    {imageUploadPreview && (
                      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                        <img src={imageUploadPreview} alt="Upload preview" className="max-h-56 w-full object-contain" />
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
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Current images</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {images.map((image, index) => (
                        <div key={`${image.src}-${index}`} className="rounded-xl border border-gray-100 p-2 dark:border-gray-800">
                          <img src={image.src} alt={product.title} className="h-28 w-full rounded-lg object-cover" />
                          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>{image.color || 'All colours'}</span>
                            {image.isDefault && <span className="font-semibold text-emerald-600 dark:text-emerald-400">Default</span>}
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
  const [syncing,  setSyncing]  = useState(false);
  const [syncMsg,  setSyncMsg]  = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
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
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => setDraftOpen(true)}>
            + Add product
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={syncing}
            onClick={handlePreviewSync}
          >
            Sync from Printify
          </Button>
        </div>
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
        <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
                <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-3 sm:px-6">Product</th>
                  <th className="px-4 py-3">Design</th>
                  <th className="px-4 py-3">Colours</th>
                  <th className="px-4 py-3">Size guide</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3">Inventory</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <ProductRow key={product.id} product={product} token={token!} />
                ))}
                {draftOpen && (
                  <InlineDraftProductRow
                    token={token!}
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
