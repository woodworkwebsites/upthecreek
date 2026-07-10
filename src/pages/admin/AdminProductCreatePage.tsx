import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminCreateProduct } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Button } from '../../components/ui/Button.js';

interface VariantRow {
  color: string;
  hex: string;
  size: string;
  price: string; // pounds, as typed
  available: boolean;
}

interface ImageRow {
  file: File;
  previewUrl: string;
  color: string;
  isDefault: boolean;
}

function emptyVariant(): VariantRow {
  return { color: '', hex: '#333333', size: '', price: '', available: true };
}

export default function AdminProductCreatePage() {
  const { token } = useAdminToken();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('apparel');
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colorOptions = Array.from(new Set(variants.map((v) => v.color.trim()).filter(Boolean)));

  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()]);
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const newRows: ImageRow[] = Array.from(fileList).map((file, i) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      color: '',
      isDefault: images.length === 0 && i === 0,
    }));
    setImages((prev) => [...prev, ...newRows]);
  }

  function updateImage(index: number, patch: Partial<ImageRow>) {
    setImages((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function setDefaultImage(index: number) {
    setImages((prev) => prev.map((row, i) => ({ ...row, isDefault: i === index })));
  }

  async function handleSubmit() {
    if (!token) return;
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    const validVariants = variants.filter((v) => v.color.trim() && v.size.trim() && v.price.trim());
    if (validVariants.length === 0) {
      setError('At least one complete variant (colour, size, price) is required');
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('category', category.trim() || 'apparel');
      form.append('variants', JSON.stringify(validVariants.map((v) => ({
        color: v.color.trim(),
        hex: v.hex,
        size: v.size.trim(),
        price: Math.round(parseFloat(v.price) * 100),
        available: v.available,
      }))));
      form.append('imagesMeta', JSON.stringify(images.map((img) => ({
        color: img.color || undefined,
        isDefault: img.isDefault,
      }))));
      images.forEach((img) => form.append('images', img.file, img.file.name));

      await adminCreateProduct(token, form);
      navigate('/admin/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Add product</h1>
        <button
          onClick={() => navigate('/admin/products')}
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Details</p>
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Category (e.g. apparel)"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Variants</p>
          <button
            onClick={addVariant}
            className="text-xs font-semibold text-navy-800 dark:text-navy-300 hover:underline"
          >
            + Add variant
          </button>
        </div>

        <div className="space-y-2">
          {variants.map((row, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center rounded-xl border border-gray-100 dark:border-gray-800 p-2">
              <input
                type="text"
                value={row.color}
                onChange={(e) => updateVariant(index, { color: e.target.value })}
                placeholder="Colour name"
                className="col-span-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
              />
              <input
                type="color"
                value={row.hex}
                onChange={(e) => updateVariant(index, { hex: e.target.value })}
                className="col-span-1 h-8 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent"
              />
              <input
                type="text"
                value={row.size}
                onChange={(e) => updateVariant(index, { size: e.target.value })}
                placeholder="Size"
                className="col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
              />
              <div className="col-span-2 flex items-center gap-1">
                <span className="text-xs text-gray-400">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.price}
                  onChange={(e) => updateVariant(index, { price: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
                />
              </div>
              <label className="col-span-2 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={row.available}
                  onChange={(e) => updateVariant(index, { available: e.target.checked })}
                />
                Available
              </label>
              <button
                onClick={() => removeVariant(index)}
                disabled={variants.length === 1}
                className="col-span-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-30 disabled:no-underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Images</p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700"
        />

        {images.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {images.map((img, index) => (
              <div key={index} className="rounded-xl border border-gray-100 dark:border-gray-800 p-2 space-y-2">
                <img src={img.previewUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
                <div className="flex items-center gap-2">
                  <select
                    value={img.color}
                    onChange={(e) => updateImage(index, { color: e.target.value })}
                    className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-gray-100"
                  >
                    <option value="">All colours</option>
                    {colorOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button onClick={() => removeImage(index)} className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                    Remove
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

      {error && (
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
      )}

      <Button loading={submitting} onClick={handleSubmit}>
        Create product
      </Button>
    </div>
  );
}
