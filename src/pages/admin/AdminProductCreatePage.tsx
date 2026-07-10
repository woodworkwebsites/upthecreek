import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminCreateProduct } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Button } from '../../components/ui/Button.js';

interface VariantRow {
  color: string;
  hex: string;
  size: string;
  manufacturingCost: string; // pounds, as typed
  delivery: string; // pounds, as typed
  salePrice: string; // pounds, as typed
  available: boolean;
}

interface ImageRow {
  file: File;
  previewUrl: string;
  color: string;
  isDefault: boolean;
}

function emptyVariant(): VariantRow {
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

function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

function parseMoney(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function AdminProductCreatePage() {
  const { token } = useAdminToken();
  const navigate = useNavigate();

  const [design, setDesign] = useState('');
  const [productName, setProductName] = useState('');
  const [garment, setGarment] = useState('');
  const [gender, setGender] = useState('');
  const [type, setType] = useState('');
  const [printSurface, setPrintSurface] = useState('');
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

  useEffect(() => {
    const parts = [design.trim(), garment.trim(), productName.trim(), gender.trim()].filter(Boolean);
    if (parts.length > 0) {
      setTitle(parts.join(' / '));
    }
  }, [design, garment, productName, gender]);

  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addVariant(template: Partial<VariantRow> = {}) {
    setVariants((prev) => [...prev, { ...emptyVariant(), ...template }]);
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function duplicateVariant(index: number) {
    const source = variants[index];
    if (!source) return;
    addVariant({ ...source, color: `${source.color} copy` });
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

    const resolvedTitle = title.trim() || design.trim();
    if (!resolvedTitle) {
      setError('Design or title is required');
      return;
    }
    const validVariants = variants.filter((v) => v.color.trim() && v.size.trim() && v.salePrice.trim());
    if (validVariants.length === 0) {
      setError('At least one complete row (colour, size, sale price) is required');
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
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Identity</p>
        <div className="space-y-3">
          <input
            type="text"
            value={design}
            onChange={(e) => setDesign(e.target.value)}
            placeholder="Design"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Product"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
            />
            <input
              type="text"
              value={garment}
              onChange={(e) => setGarment(e.target.value)}
              placeholder="Garment"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
            />
            <input
              type="text"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              placeholder="Gender"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
            />
            <input
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Type"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
            />
            <input
              type="text"
              value={printSurface}
              onChange={(e) => setPrintSurface(e.target.value)}
              placeholder="Print surface"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none sm:col-span-2"
            />
          </div>
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
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            The matrix below drives the product variants. Use it to set colour, size and pricing in one pass.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pricing Matrix</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Edit rows like a spreadsheet. Sale price is what the customer sees.</p>
          </div>
          <button
            onClick={() => addVariant()}
            className="text-xs font-semibold text-navy-800 dark:text-navy-300 hover:underline"
          >
            + Add row
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
          <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
              <tr className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                <th className="px-3 py-3">Colour</th>
                <th className="px-3 py-3">Hex</th>
                <th className="px-3 py-3">Size</th>
                <th className="px-3 py-3">Manufacturing</th>
                <th className="px-3 py-3">Delivery</th>
                <th className="px-3 py-3">Sale price</th>
                <th className="px-3 py-3">Margin</th>
                <th className="px-3 py-3">Available</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((row, index) => {
                const manufacturing = parseMoney(row.manufacturingCost);
                const delivery = parseMoney(row.delivery);
                const salePrice = parseMoney(row.salePrice);
                const margin = salePrice - manufacturing - delivery;

                return (
                  <tr key={index} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="text"
                        value={row.color}
                        onChange={(e) => updateVariant(index, { color: e.target.value })}
                        placeholder="Mens Golden Point"
                        className="w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="color"
                        value={row.hex}
                        onChange={(e) => updateVariant(index, { hex: e.target.value })}
                        className="h-10 w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent p-1"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="text"
                        value={row.size}
                        onChange={(e) => updateVariant(index, { size: e.target.value })}
                        placeholder="M"
                        className="w-24 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">£</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.manufacturingCost}
                          onChange={(e) => updateVariant(index, { manufacturingCost: e.target.value })}
                          placeholder="0.00"
                          className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">£</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.delivery}
                          onChange={(e) => updateVariant(index, { delivery: e.target.value })}
                          placeholder="0.00"
                          className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">£</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.salePrice}
                          onChange={(e) => updateVariant(index, { salePrice: e.target.value })}
                          placeholder="0.00"
                          className="w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className={`rounded-lg px-2 py-2 text-xs font-semibold ${margin >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
                        {formatMoney(margin)}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={row.available}
                          onChange={(e) => updateVariant(index, { available: e.target.checked })}
                        />
                        In stock
                      </label>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => duplicateVariant(index)}
                          className="text-xs font-semibold text-navy-800 dark:text-navy-300 hover:underline"
                        >
                          Duplicate
                        </button>
                        <button
                          onClick={() => removeVariant(index)}
                          disabled={variants.length === 1}
                          className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-30 disabled:no-underline"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
