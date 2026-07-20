import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminCreateProduct, adminGetSettings } from '../../lib/api.js';
import { ColorMultiSelect } from '../../components/admin/ColorMultiSelect.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Button } from '../../components/ui/Button.js';
import { DEFAULT_CATALOG_OPTIONS, DEFAULT_SIZE_OPTIONS, findPricingPresetRow, parseCatalogSettings, type CatalogOptions } from '../../lib/catalog.js';

interface ImageRow {
  file: File;
  previewUrl: string;
  isDefault: boolean;
}

function uniquePrintSurfaces(catalog: CatalogOptions): string[] {
  return Array.from(new Set(catalog.pricingRows.map((row) => row.printSurface.trim()).filter(Boolean)));
}

export default function AdminProductCreatePage() {
  const { token } = useAdminToken();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATALOG_OPTIONS.audiences[0] ?? '');
  const [productType, setProductType] = useState(DEFAULT_CATALOG_OPTIONS.products[0] ?? '');
  const [garmentType, setGarmentType] = useState(DEFAULT_CATALOG_OPTIONS.garments[0] ?? '');
  const [printSurface, setPrintSurface] = useState('');
  const [catalog, setCatalog] = useState(DEFAULT_CATALOG_OPTIONS);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [images, setImages] = useState<ImageRow[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
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
        setPrintSurface((current) => current || nextCatalog.pricingRows[0]?.printSurface || '');
      } catch {
        // Leave defaults in place.
      }
    }

    void loadCatalog();
    return () => {
      mounted = false;
    };
  }, [token]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const newRows: ImageRow[] = Array.from(fileList).map((file, i) => ({
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
      const pricingPreset = findPricingPresetRow(catalog.pricingRows, category, productType, garmentType)
        ?? catalog.pricingRows[0]
        ?? null;
      const salePrice = pricingPreset?.salePrice?.trim() || catalog.pricingRows[0]?.salePrice?.trim() || '24.99';
      const selectedColorRows = selectedColors
        .map((name) => catalog.colors.find((color) => color.name === name))
        .filter((color): color is { name: string; hex: string } => Boolean(color));
      form.append('pricingMatrix', JSON.stringify(pricingPreset ? {
        audience: pricingPreset.audience.trim(),
        product: pricingPreset.product.trim(),
        garment: pricingPreset.garment.trim(),
        printSurface: pricingPreset.printSurface.trim(),
        manufacturingCost: pricingPreset.manufacturingCost.trim(),
        saleCost: pricingPreset.saleCost.trim(),
        delivery: pricingPreset.delivery.trim(),
        salePrice: pricingPreset.salePrice.trim(),
      } : {
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
      navigate('/admin/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  const printSurfaceOptions = uniquePrintSurfaces(catalog);

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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <select
              value={printSurface}
              onChange={(e) => setPrintSurface(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-navy-400 focus:outline-none"
            >
              <option value="">Print surface</option>
              {printSurfaceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-navy-400 focus:outline-none"
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
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            Select the colours you want, then save to publish the product to the shop immediately.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
        <ColorMultiSelect
          colors={catalog.colors}
          selected={selectedColors}
          onToggle={(color) => toggleColor(color.name)}
        />
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

      {error && (
        <p className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>
      )}

      <Button loading={submitting} onClick={handleSubmit}>
        Create product
      </Button>
    </div>
  );
}
