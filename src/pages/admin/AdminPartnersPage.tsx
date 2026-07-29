import { useCallback, useEffect, useState } from 'react';
import type { PartnerAdmin, PartnerCollaborationDesign } from '../../../types/index.js';
import {
  adminCreatePartner,
  adminDeletePartner,
  adminFetchPartners,
  adminUpdatePartner,
} from '../../lib/api.js';
import { DEFAULT_SIZE_OPTIONS } from '../../../types/catalog.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { formatDate } from '../../lib/utils.js';

type Draft = {
  slug: string;
  name: string;
  logoImage: CollaborationImageRow | null;
  discountCode: string;
  accessToken: string;
  commissionRate: string;
  description: string;
  active: boolean;
  collaborationEnabled: boolean;
  collaborationDesigns: CollaborationDesignDraft[];
};

interface CollaborationImageRow {
  file?: File;
  previewUrl: string;
  isDefault: boolean;
}

interface CollaborationDesignDraft {
  id: string;
  title: string;
  description: string;
  garment: string;
  colorName: string;
  colorHex: string;
  frontImage: CollaborationImageRow | null;
  backImage: CollaborationImageRow | null;
  sizes: string;
  wholesalePrice: string;
  rrp: string;
}

function emptyCollaborationDesignDraft(): CollaborationDesignDraft {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    garment: 'Collaboration Shirt',
    colorName: 'Collaboration',
    colorHex: '#111827',
    frontImage: null,
    backImage: null,
    sizes: DEFAULT_SIZE_OPTIONS.join(', '),
    wholesalePrice: '',
    rrp: '',
  };
}

function emptyDraft(): Draft {
  return {
    slug: '',
    name: '',
    logoImage: null,
    discountCode: '',
    accessToken: '',
    commissionRate: '10',
    description: '',
    active: true,
    collaborationEnabled: false,
    collaborationDesigns: [emptyCollaborationDesignDraft()],
  };
}

function formatPoundsInput(value: number | undefined | null): string {
  if (!Number.isFinite(value ?? NaN)) return '';
  return ((value ?? 0) / 100).toFixed(2);
}

function imageFromUrl(url: string | null | undefined, isDefault: boolean): CollaborationImageRow | null {
  const trimmed = url?.trim() || '';
  if (!trimmed) return null;
  return {
    previewUrl: trimmed,
    isDefault,
  };
}

function parseSizeList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function serializeSizeList(values: string[]): string {
  return values.join(', ');
}

function CollaborationSizesEditor({
  sizes,
  onChange,
}: {
  sizes: string;
  onChange: (value: string) => void;
}) {
  const [draftSize, setDraftSize] = useState('');
  const parsedSizes = parseSizeList(sizes);

  function addSize() {
    const nextSize = draftSize.trim();
    if (!nextSize) return;

    const nextSizes = parseSizeList([...parsedSizes, nextSize].join(','));
    onChange(serializeSizeList(nextSizes));
    setDraftSize('');
  }

  function removeSize(size: string) {
    onChange(serializeSizeList(parsedSizes.filter((entry) => entry !== size)));
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        {parsedSizes.length > 0 ? (
          parsedSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => removeSize(size)}
              className="inline-flex items-center gap-1 rounded-full bg-navy-800 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-navy-700"
              aria-label={`Remove size ${size}`}
            >
              {size}
              <span aria-hidden className="text-[10px] leading-none">
                ×
              </span>
            </button>
          ))
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">Add sizes for this design</span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={draftSize}
          onChange={(event) => setDraftSize(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              addSize();
            }
          }}
          placeholder={DEFAULT_SIZE_OPTIONS.join(', ')}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={addSize}
          className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEFAULT_SIZE_OPTIONS.map((size) => {
          const isSelected = parsedSizes.includes(size);
          return (
            <button
              key={size}
              type="button"
              onClick={() => (isSelected ? removeSize(size) : onChange(serializeSizeList([...parsedSizes, size])))}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                isSelected
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function designDraftFromApi(design: PartnerCollaborationDesign | null | undefined): CollaborationDesignDraft {
  return {
    id: crypto.randomUUID(),
    title: design?.title ?? '',
    description: design?.description ?? '',
    garment: design?.garment ?? 'Collaboration Shirt',
    colorName: design?.colorName ?? 'Collaboration',
    colorHex: design?.colorHex ?? '#111827',
    frontImage: imageFromUrl(design?.imageUrls?.[0] ?? design?.imageUrl, true),
    backImage: imageFromUrl(design?.imageUrls?.[1] ?? null, false),
    sizes: (design?.sizes ?? DEFAULT_SIZE_OPTIONS).join(', '),
    wholesalePrice: formatPoundsInput(design?.partnerPrice),
    rrp: formatPoundsInput(design?.rrp ?? design?.partnerPrice),
  };
}

function logoImageFromUrl(url: string | null | undefined): CollaborationImageRow | null {
  return imageFromUrl(url, true);
}

export default function AdminPartnersPage() {
  const { token } = useAdminToken();
  const [partners, setPartners] = useState<PartnerAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saved, setSaved] = useState<string | null>(null);
  const [showAccessToken, setShowAccessToken] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchPartners(token);
      setPartners(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createModalOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCreateModalOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createModalOpen]);

  function resetDraft() {
    setDraft(emptyDraft());
    setError(null);
    setShowAccessToken(false);
  }

  function startCreate() {
    setEditingId(null);
    resetDraft();
  }

  function openCreateModal() {
    setEditingId(null);
    setSaved(null);
    resetDraft();
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    resetDraft();
  }

  function startEdit(partner: PartnerAdmin) {
    setError(null);
    const collaboration = partner.collaborationDesigns.length > 0
      ? partner.collaborationDesigns
      : partner.collaborationDesign
        ? [partner.collaborationDesign]
        : [];
    setEditingId(partner.id);
    setDraft({
      slug: partner.slug,
      name: partner.name,
      logoImage: logoImageFromUrl(partner.logoUrl),
      discountCode: partner.discountCode ?? '',
      accessToken: partner.accessToken ?? '',
      commissionRate: String(partner.commissionRate),
      description: partner.description ?? '',
      active: partner.active,
      collaborationEnabled: partner.collaborationEnabled,
      collaborationDesigns: collaboration.length > 0
        ? collaboration.map((entry) => designDraftFromApi(entry))
        : [emptyCollaborationDesignDraft()],
    });
    setSaved(null);
    setShowAccessToken(false);
    setCreateModalOpen(false);
  }

  function revokeCollaborationPreview(image: CollaborationImageRow | null) {
    if (image?.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(image.previewUrl);
    }
  }

  function handleLogoSelected(fileList: FileList | null) {
    if (!fileList) return;
    const file = fileList[0];
    if (!file) return;

    setDraft((current) => {
      revokeCollaborationPreview(current.logoImage);
      return {
        ...current,
        logoImage: {
          file,
          previewUrl: URL.createObjectURL(file),
          isDefault: true,
        },
      };
    });
  }

  function removeLogoImage() {
    setDraft((current) => {
      revokeCollaborationPreview(current.logoImage);
      return {
        ...current,
        logoImage: null,
      };
    });
  }

  function updateCollaborationDesign(
    designId: string,
    updater: (design: CollaborationDesignDraft) => CollaborationDesignDraft,
  ) {
    setDraft((current) => ({
      ...current,
      collaborationDesigns: current.collaborationDesigns.map((design) =>
        design.id === designId ? updater(design) : design,
      ),
    }));
  }

  function addCollaborationDesign() {
    setDraft((current) => ({
      ...current,
      collaborationEnabled: true,
      collaborationDesigns: [...current.collaborationDesigns, emptyCollaborationDesignDraft()],
    }));
  }

  function removeCollaborationDesign(designId: string) {
    setDraft((current) => {
      const target = current.collaborationDesigns.find((design) => design.id === designId);
      revokeCollaborationPreview(target?.frontImage ?? null);
      revokeCollaborationPreview(target?.backImage ?? null);
      const next = current.collaborationDesigns.filter((design) => design.id !== designId);
      return {
        ...current,
        collaborationDesigns: next.length > 0 ? next : [emptyCollaborationDesignDraft()],
      };
    });
  }

  function handleCollaborationFilesSelected(designId: string, side: 'front' | 'back', fileList: FileList | null) {
    if (!fileList) return;
    const file = fileList[0];
    if (!file) return;

    setDraft((current) => ({
      ...current,
      collaborationDesigns: current.collaborationDesigns.map((design) => {
        if (design.id !== designId) return design;
        const previous = side === 'front' ? design.frontImage : design.backImage;
        if (previous?.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previous.previewUrl);
        }

        const nextImage: CollaborationImageRow = {
          file,
          previewUrl: URL.createObjectURL(file),
          isDefault: side === 'front',
        };

        return side === 'front'
          ? { ...design, frontImage: nextImage }
          : { ...design, backImage: nextImage };
      }),
    }));
  }

  function removeCollaborationImage(designId: string, side: 'front' | 'back') {
    setDraft((current) => ({
      ...current,
      collaborationDesigns: current.collaborationDesigns.map((design) => {
        if (design.id !== designId) return design;
        const previous = side === 'front' ? design.frontImage : design.backImage;
        if (previous?.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previous.previewUrl);
        }

        return side === 'front'
          ? { ...design, frontImage: null }
          : { ...design, backImage: null };
      }),
    }));
  }

  async function handleSubmit() {
    if (!token) return;
    const slug = draft.slug.trim();
    const name = draft.name.trim();
    const accessToken = draft.accessToken.trim();
    const commissionRate = Number(draft.commissionRate);

    if (!slug) {
      setError('Partner code is required');
      return;
    }
    if (!name) {
      setError('Name is required');
      return;
    }
    if (!editingId && !accessToken) {
      setError('Access token is required');
      return;
    }
    if (!Number.isFinite(commissionRate) || commissionRate < 0) {
      setError('Commission rate must be zero or greater');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(null);

    try {
      const form = new FormData();
      form.append('slug', slug);
      form.append('name', name);
      if (draft.logoImage?.file) {
        form.append('logoFile', draft.logoImage.file, draft.logoImage.file.name);
      } else if (draft.logoImage?.previewUrl) {
        form.append('logoUrl', draft.logoImage.previewUrl);
      }
      form.append('discountCode', draft.discountCode.trim());
      form.append('commissionRate', String(commissionRate));
      form.append('description', draft.description.trim());
      form.append('active', String(draft.active));
      form.append('collaborationEnabled', String(draft.collaborationEnabled));
      const legacyDesign = draft.collaborationDesigns[0] ?? emptyCollaborationDesignDraft();
      const legacyImages: Array<
        | { type: 'file'; fileIndex: number; isDefault: boolean }
        | { type: 'url'; url: string; isDefault: boolean }
      > = [];
      const collaborationDesignsMeta: Array<{
        title: string;
        description: string;
        garment: string;
        colorName: string;
        colorHex: string;
        sizes: string[];
        wholesalePrice: number;
        rrp: number;
        images: Array<
          | { type: 'file'; fileIndex: number; isDefault: boolean }
          | { type: 'url'; url: string; isDefault: boolean }
        >;
      }> = [];
      let fileIndex = 0;
      draft.collaborationDesigns.forEach((design) => {
        const images: Array<
          | { type: 'file'; fileIndex: number; isDefault: boolean }
          | { type: 'url'; url: string; isDefault: boolean }
        > = [];

        const imageRows: Array<[CollaborationImageRow | null, boolean]> = [
          [design.frontImage, true],
          [design.backImage, false],
        ];

        imageRows.forEach(([image, isDefault]) => {
          if (image?.file) {
            form.append('collaborationDesignFiles', image.file, image.file.name);
            images.push({ type: 'file', fileIndex: fileIndex++, isDefault });
          } else if (image?.previewUrl) {
            images.push({ type: 'url', url: image.previewUrl, isDefault });
          }
        });

        collaborationDesignsMeta.push({
          title: design.title.trim(),
          description: design.description.trim(),
          garment: design.garment.trim(),
          colorName: design.colorName.trim(),
          colorHex: design.colorHex.trim(),
          sizes: design.sizes.split(',').map((size) => size.trim()).filter(Boolean),
          wholesalePrice: Math.max(0, Math.round((Number(design.wholesalePrice) || 0) * 100)),
          rrp: Math.max(0, Math.round((Number(design.rrp) || 0) * 100)),
          images,
        });
      });
      form.append('collaborationDesignsMeta', JSON.stringify(collaborationDesignsMeta));

      const legacyImageRows: Array<[CollaborationImageRow | null, boolean]> = [
        [legacyDesign.frontImage, true],
        [legacyDesign.backImage, false],
      ];
      legacyImageRows.forEach(([image, isDefault]) => {
        if (image?.file) {
          form.append('collaborationImages', image.file, image.file.name);
          legacyImages.push({ type: 'file', fileIndex: legacyImages.length, isDefault });
        } else if (image?.previewUrl) {
          legacyImages.push({ type: 'url', url: image.previewUrl, isDefault });
        }
      });

      form.append('collaborationTitle', legacyDesign.title.trim());
      form.append('collaborationDescription', legacyDesign.description.trim());
      form.append('collaborationGarment', legacyDesign.garment.trim());
      form.append('collaborationColorName', legacyDesign.colorName.trim());
      form.append('collaborationColorHex', legacyDesign.colorHex.trim());
      form.append('collaborationSizes', legacyDesign.sizes);
      form.append('collaborationPrice', legacyDesign.wholesalePrice);
      form.append('collaborationRrp', legacyDesign.rrp);
      form.append('collaborationImagesMeta', JSON.stringify(legacyImages));
      form.append(
        'collaborationImageUrls',
        legacyImages
          .filter((entry): entry is { type: 'url'; url: string; isDefault: boolean } => entry.type === 'url')
          .map((entry) => entry.url)
          .join(','),
      );

      if (editingId) {
        if (accessToken) form.append('accessToken', accessToken);
        await adminUpdatePartner(token, editingId, form);
        setSaved('Partner updated');
      } else {
        form.append('accessToken', accessToken);
        await adminCreatePartner(token, form);
        setSaved('Partner created');
        closeCreateModal();
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save partner');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!window.confirm('Delete this partner?')) return;

    setSaving(true);
    setError(null);
    try {
      await adminDeletePartner(token, id);
      await load();
      if (editingId === id) startCreate();
      setSaved('Partner deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete partner');
    } finally {
      setSaving(false);
    }
  }

  function clearCollaborationDraft() {
    draft.collaborationDesigns.forEach((design) => {
      revokeCollaborationPreview(design.frontImage);
      revokeCollaborationPreview(design.backImage);
    });
    setDraft((current) => ({
      ...current,
      collaborationEnabled: false,
      collaborationDesigns: [emptyCollaborationDesignDraft()],
    }));
  }

  const selectedPartner = editingId
    ? partners.find((partner) => partner.id === editingId) ?? null
    : null;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Partners</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create club access, assign discount codes, and manage commission rates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={load}
            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-full bg-navy-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-700"
          >
            Add partner
          </button>
        </div>
      </div>

      {saved && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
          {saved}
        </div>
      )}

      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          {partners.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">No partners yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-100 dark:divide-gray-800">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead className="bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Partner</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Code</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Commission</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Collab</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Updated</th>
                    <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {partners.map((partner) => (
                    <tr
                      key={partner.id}
                      onClick={() => startEdit(partner)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                        editingId === partner.id ? 'bg-gray-50 dark:bg-gray-800/40' : ''
                      }`}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                            {partner.logoUrl ? (
                              <img src={partner.logoUrl} alt="" className="h-full w-full object-contain p-1.5" />
                            ) : (
                              <span className="text-xs font-black uppercase text-gray-400">{partner.name.slice(0, 1)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{partner.name}</p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">Code {partner.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{partner.discountCode ?? '—'}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{partner.commissionRate}%</td>
                      <td className="px-3 py-3">
                        <Badge variant={partner.active ? 'success' : 'default'}>
                          {partner.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={partner.collaborationEnabled ? 'info' : 'default'}>
                          {partner.collaborationEnabled ? 'Live' : 'Off'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(partner.updatedAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEdit(partner);
                            }}
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDelete(partner.id);
                            }}
                            className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedPartner && (
          <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-[0_20px_70px_rgba(5,13,31,0.07)] dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Edit partner</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                  {selectedPartner.name}
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Update the club record and the collaboration products below. Changes save into D1 and appear on the partner dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setError(null);
                  setShowAccessToken(false);
                }}
                className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                Close editor
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Partner code</span>
                    <input
                      autoFocus
                      value={draft.slug}
                      onChange={(e) => setDraft((current) => ({ ...current, slug: e.target.value }))}
                      placeholder="oxford-park"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</span>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                      placeholder="Oxford Park Padel"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="block space-y-2 sm:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Club logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoSelected(e.target.files)}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-navy-800 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-wider file:text-white hover:file:bg-navy-700"
                    />
                    {draft.logoImage ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                        <img
                          src={draft.logoImage.previewUrl}
                          alt="Club logo preview"
                          className="h-14 w-14 rounded-xl object-contain bg-white p-1.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Logo selected</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {draft.logoImage.file?.name ?? 'Existing logo'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeLogoImage}
                          className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Upload the club badge or crest used across the portal and tables.
                      </p>
                    )}
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Discount code</span>
                    <input
                      value={draft.discountCode}
                      onChange={(e) => setDraft((current) => ({ ...current, discountCode: e.target.value }))}
                      placeholder="OXFORD10"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Commission %</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.commissionRate}
                      onChange={(e) => setDraft((current) => ({ ...current, commissionRate: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="block space-y-1 sm:col-span-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Access token</span>
                      <button
                        type="button"
                        onClick={() => setShowAccessToken((current) => !current)}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      >
                        {showAccessToken ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      type={showAccessToken ? 'text' : 'password'}
                      value={draft.accessToken}
                      onChange={(e) => setDraft((current) => ({ ...current, accessToken: e.target.value }))}
                      placeholder="partner token"
                      autoComplete="off"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="block space-y-1 sm:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</span>
                    <textarea
                      value={draft.description}
                      onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                      rows={4}
                      placeholder="Optional notes for this club"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(e) => setDraft((current) => ({ ...current, active: e.target.checked }))}
                    />
                    Active partner
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={saving}
                    className="rounded-full bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Update partner'}
                  </button>
                  <button
                    type="button"
                    onClick={startCreate}
                    className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                  >
                    Clear form
                  </button>
                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Partner-only products</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Each design card becomes a separate collaboration product on the partner dashboard.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addCollaborationDesign}
                      className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                    >
                      Create new design
                    </button>
                    <button
                      type="button"
                      onClick={clearCollaborationDraft}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Reset collab
                    </button>
                  </div>
                </div>

                <label className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                  <span className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${draft.collaborationEnabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}>
                    <span className={`h-4 w-4 rounded-full bg-white transition-transform ${draft.collaborationEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.collaborationEnabled}
                    onChange={(e) => setDraft((current) => ({ ...current, collaborationEnabled: e.target.checked }))}
                    className="sr-only"
                  />
                  Enabled
                </label>

                <div className="space-y-4">
                  {draft.collaborationDesigns.map((design, index) => (
                    <div key={design.id} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Design {index + 1}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Add the images and fields for this collaboration shirt.
                          </p>
                        </div>
                        {draft.collaborationDesigns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCollaborationDesign(design.id)}
                            className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Remove design
                          </button>
                        )}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        {[
                          { side: 'front' as const, label: 'Front image', image: design.frontImage, emptyCopy: 'Upload the front image.' },
                          { side: 'back' as const, label: 'Back image', image: design.backImage, emptyCopy: 'Upload the back image.' },
                        ].map(({ side, label, image, emptyCopy }) => (
                          <label
                            key={side}
                            className="relative block overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-950"
                          >
                            <input
                              type="file"
                              name="collaborationDesignFiles"
                              accept="image/*"
                              onChange={(e) => handleCollaborationFilesSelected(design.id, side, e.target.files)}
                              className="sr-only"
                            />
                            <div className="relative">
                              <div className="flex min-h-[15rem] w-full items-center justify-center bg-white p-4 dark:bg-gray-950">
                                {image ? (
                                  <img
                                    src={image.previewUrl}
                                    alt={label}
                                    className="h-[15rem] w-full rounded-xl object-contain"
                                  />
                                ) : (
                                  <div className="flex h-[15rem] w-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 text-center dark:border-gray-700">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{emptyCopy}</p>
                                  </div>
                                )}
                              </div>
                              {image && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    removeCollaborationImage(design.id, side);
                                  }}
                                  className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-black"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</span>
                          <input
                            value={design.title}
                            onChange={(e) => updateCollaborationDesign(design.id, (current) => ({ ...current, title: e.target.value }))}
                            placeholder="Oxford Park x UTC"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Garment</span>
                          <input
                            value={design.garment}
                            onChange={(e) => updateCollaborationDesign(design.id, (current) => ({ ...current, garment: e.target.value }))}
                            placeholder="Collaboration Shirt"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</span>
                        <textarea
                          value={design.description}
                          onChange={(e) => updateCollaborationDesign(design.id, (current) => ({ ...current, description: e.target.value }))}
                          rows={3}
                          placeholder="What makes the shirt special?"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Available sizes</span>
                          <CollaborationSizesEditor
                            sizes={design.sizes}
                            onChange={(value) => updateCollaborationDesign(design.id, (current) => ({ ...current, sizes: value }))}
                          />
                        </div>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Wholesale price</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={design.wholesalePrice}
                            onChange={(e) => updateCollaborationDesign(design.id, (current) => ({ ...current, wholesalePrice: e.target.value }))}
                            placeholder="18.00"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">RRP</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={design.rrp}
                            onChange={(e) => updateCollaborationDesign(design.id, (current) => ({ ...current, rrp: e.target.value }))}
                            placeholder="30.00"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-navy-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {createModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
          onClick={closeCreateModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add partner"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">New partner</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Create the club record first. Add collaboration products from the inline editor after it is saved.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Partner code</span>
                <input
                  autoFocus
                  value={draft.slug}
                  onChange={(e) => setDraft((current) => ({ ...current, slug: e.target.value }))}
                  placeholder="oxford-park"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Name</span>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                      placeholder="Oxford Park Padel"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="block space-y-2 sm:col-span-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Club logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleLogoSelected(e.target.files)}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-full file:border-0 file:bg-navy-800 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-wider file:text-white hover:file:bg-navy-700"
                    />
                    {draft.logoImage ? (
                      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                        <img
                          src={draft.logoImage.previewUrl}
                          alt="Club logo preview"
                          className="h-14 w-14 rounded-xl object-contain bg-white p-1.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Logo selected</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {draft.logoImage.file?.name ?? 'Existing logo'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeLogoImage}
                          className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Upload the club badge or crest used across the portal and tables.
                      </p>
                    )}
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Discount code</span>
                    <input
                  value={draft.discountCode}
                  onChange={(e) => setDraft((current) => ({ ...current, discountCode: e.target.value }))}
                  placeholder="OXFORD10"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Commission %</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.commissionRate}
                  onChange={(e) => setDraft((current) => ({ ...current, commissionRate: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>

              <label className="block space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Access token</span>
                  <button
                    type="button"
                    onClick={() => setShowAccessToken((current) => !current)}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                  >
                    {showAccessToken ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showAccessToken ? 'text' : 'password'}
                  value={draft.accessToken}
                  onChange={(e) => setDraft((current) => ({ ...current, accessToken: e.target.value }))}
                  placeholder="partner token"
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>

              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                  rows={4}
                  placeholder="Optional notes for this club"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                />
              </label>

              <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft((current) => ({ ...current, active: e.target.checked }))}
                />
                Active partner
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="rounded-full bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Create partner'}
                </button>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
