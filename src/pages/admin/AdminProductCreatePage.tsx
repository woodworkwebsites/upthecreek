import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminCreateProduct, adminGetSettings } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Button } from '../../components/ui/Button.js';
import { DEFAULT_CATALOG_OPTIONS, parseCatalogSettings, type PricingRowOption } from '../../lib/catalog.js';

interface VariantRow {
  color: string;
  hex: string;
  size: string;
  manufacturingCost: string; // pounds, as typed
  delivery: string; // pounds, as typed
  salePrice: string; // pounds, as typed
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
  const [printSurface, setPrintSurface] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATALOG_OPTIONS.audiences[0] ?? '');
  const [productType, setProductType] = useState(DEFAULT_CATALOG_OPTIONS.products[0] ?? '');
  const [garmentType, setGarmentType] = useState(DEFAULT_CATALOG_OPTIONS.garments[0] ?? '');
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG_OPTIONS);
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [pricingTemplate, setPricingTemplate] = useState<VariantRow>(() => emptyVariant());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      if (!token) return;
      try {
        const settings = await adminGetSettings(token);
        if (!mounted) return;
        const nextCatalog = parseCatalogSettings(settings);
        setCatalog(nextCatalog);
        setCategory((current) => current || nextCatalog.audiences[0] || '');
        setProductType((current) => current || nextCatalog.products[0] || '');
        setGarmentType((current) => current || nextCatalog.garments[0] || '');
      } catch {
        // Leave defaults in place.
      }
    }

    void loadCatalog();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (catalog.pricingRows.length === 0) return;
    setPricingTemplate((current) => {
      if (current.manufacturingCost || current.delivery || current.salePrice) {
        return current;
      }
      const preset = catalog.pricingRows[0];
      return {
        ...emptyVariant(),
        manufacturingCost: preset.manufacturingCost,
        delivery: preset.delivery,
        salePrice: preset.salePrice,
      };
    });
  }, [catalog.pricingRows]);

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
    setVariants((prev) => [...prev, { ...emptyVariant(), ...pricingTemplate, ...template }]);
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

  function applyPreset(preset: PricingRowOption) {
    setCategory(preset.audience);
    setProductType(preset.product);
    setGarmentType(preset.garment);
    setPrintSurface(preset.printSurface);
    setPricingTemplate({
      ...emptyVariant(),
      manufacturingCost: preset.manufacturingCost,
      delivery: preset.delivery,
      salePrice: preset.salePrice,
    });
    setVariants((prev) =>
      prev.map((row) => ({
        ...row,
        manufacturingCost: preset.manufacturingCost,
        delivery: preset.delivery,
        salePrice: preset.salePrice,
      })),
    );
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
        productType.trim() && `Product type: ${productType.trim()}`,
        garmentType.trim() && `Garment fit: ${garmentType.trim()}`,
        printSurface.trim() && `Print surface: ${printSurface.trim()}`,
      ].filter(Boolean).join('\n');

      const form = new FormData();
      form.append('title', resolvedTitle);
      form.append('description', description.trim() || metadataDescription);
      form.append('category', category.trim() || catalog.audiences[0] || '');
      form.append('audience', category.trim() || catalog.audiences[0] || '');
      form.append('productType', productType.trim() || catalog.products[0] || '');
      form.append('garment', garmentType.trim() || catalog.garments[0] || '');
      form.append('variants', JSON.stringify(validVariants.map((v) => ({
        color: v.color.trim(),
        hex: v.hex,
        size: v.size.trim(),
        price: Math.round(parseMoney(v.salePrice) * 100),
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
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-navy-400 focus:outline-none"
            >
              <option value="">Audience</option>
              {catalog.audiences.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-navy-400 focus:outline-none"
            >
              <option value="">Product</option>
              {catalog.products.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={garmentType}
              onChange={(e) => setGarmentType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-navy-400 focus:outline-none"
            >
              <option value="">Garment</option>
              {catalog.garments.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={printSurface}
            onChange={(e) => setPrintSurface(e.target.value)}
            placeholder="Print surface"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
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

        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preset rows</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Load a standard row into the classification fields and pricing defaults.</p>
            </div>
            <button
              type="button"
              onClick={() => setPricingTemplate(emptyVariant())}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              Clear preset
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.pricingRows.map((preset) => {
              const margin = parseMoney(preset.salePrice) - parseMoney(preset.manufacturingCost) - parseMoney(preset.delivery);
              return (
                <button
                  key={`${preset.audience}-${preset.product}-${preset.garment}`}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-navy-300 hover:bg-navy-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-navy-700 dark:hover:bg-gray-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{preset.audience}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{preset.product} · {preset.garment}</div>
                    </div>
                    <div className="text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <div>{preset.printSurface}</div>
                      <div className={margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        £{margin.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                    MC £{preset.manufacturingCost} · Sell £{preset.salePrice} · Delivery £{preset.delivery}
                  </div>
                </button>
              );
            })}
          </div>
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
