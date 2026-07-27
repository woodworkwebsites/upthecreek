import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartnerAdmin } from '../../../types/index.js';
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
  discountCode: string;
  accessToken: string;
  commissionRate: string;
  description: string;
  active: boolean;
  collaborationEnabled: boolean;
  collaborationTitle: string;
  collaborationDescription: string;
  collaborationImages: CollaborationImageRow[];
  collaborationGarment: string;
  collaborationColorName: string;
  collaborationColorHex: string;
  collaborationSizes: string;
  collaborationPrice: string;
};

interface CollaborationImageRow {
  file?: File;
  previewUrl: string;
  isDefault: boolean;
}

function emptyDraft(): Draft {
  return {
    slug: '',
    name: '',
    discountCode: '',
    accessToken: '',
    commissionRate: '10',
    description: '',
    active: true,
    collaborationEnabled: false,
    collaborationTitle: '',
    collaborationDescription: '',
    collaborationImages: [],
    collaborationGarment: 'Collaboration Shirt',
    collaborationColorName: 'Collaboration',
    collaborationColorHex: '#111827',
    collaborationSizes: DEFAULT_SIZE_OPTIONS.join(', '),
    collaborationPrice: '',
  };
}

function formatPoundsInput(value: number | undefined | null): string {
  if (!Number.isFinite(value ?? NaN)) return '';
  return ((value ?? 0) / 100).toFixed(2);
}

function createCollaborationImageRows(urls: string[]): CollaborationImageRow[] {
  return urls.map((url, index) => ({
    previewUrl: url,
    isDefault: index === 0,
  }));
}

export default function AdminPartnersPage() {
  const { token } = useAdminToken();
  const [partners, setPartners] = useState<PartnerAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saved, setSaved] = useState<string | null>(null);
  const collaborationSectionRef = useRef<HTMLDivElement | null>(null);
  const collaborationImagesRef = useRef<CollaborationImageRow[]>([]);

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
    if (!editingId) return;
    collaborationSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editingId]);

  useEffect(() => {
    collaborationImagesRef.current = draft.collaborationImages;
  }, [draft.collaborationImages]);

  useEffect(() => {
    return () => {
      collaborationImagesRef.current.forEach((image) => {
        if (image.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, []);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setSaved(null);
  }

  function startEdit(partner: PartnerAdmin) {
    const collaboration = partner.collaborationDesign;
    setEditingId(partner.id);
    setDraft({
      slug: partner.slug,
      name: partner.name,
      discountCode: partner.discountCode ?? '',
      accessToken: partner.accessToken ?? '',
      commissionRate: String(partner.commissionRate),
      description: partner.description ?? '',
      active: partner.active,
      collaborationEnabled: partner.collaborationEnabled,
      collaborationTitle: collaboration?.title ?? '',
      collaborationDescription: collaboration?.description ?? '',
      collaborationImages: createCollaborationImageRows(
        collaboration?.imageUrls?.length ? collaboration.imageUrls : collaboration?.imageUrl ? [collaboration.imageUrl] : [],
      ),
      collaborationGarment: collaboration?.garment ?? 'Collaboration Shirt',
      collaborationColorName: collaboration?.colorName ?? 'Collaboration',
      collaborationColorHex: collaboration?.colorHex ?? '#111827',
      collaborationSizes: (collaboration?.sizes ?? DEFAULT_SIZE_OPTIONS).join(', '),
      collaborationPrice: formatPoundsInput(collaboration?.partnerPrice),
    });
    setSaved(null);
  }

  function handleCollaborationFilesSelected(fileList: FileList | null) {
    if (!fileList) return;

    const hasDefault = draft.collaborationImages.some((image) => image.isDefault);
    const newRows: CollaborationImageRow[] = Array.from(fileList).map((file, index) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      isDefault: !hasDefault && draft.collaborationImages.length === 0 && index === 0,
    }));

    setDraft((current) => ({
      ...current,
      collaborationImages: [...current.collaborationImages, ...newRows],
    }));
  }

  function removeCollaborationImage(index: number) {
    setDraft((current) => {
      const row = current.collaborationImages[index];
      if (row?.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(row.previewUrl);
      }

      const next = current.collaborationImages.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((image) => image.isDefault)) {
        next[0].isDefault = true;
      }

      return {
        ...current,
        collaborationImages: next,
      };
    });
  }

  function setDefaultCollaborationImage(index: number) {
    setDraft((current) => ({
      ...current,
      collaborationImages: current.collaborationImages.map((image, i) => ({
        ...image,
        isDefault: i === index,
      })),
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
      form.append('discountCode', draft.discountCode.trim());
      form.append('commissionRate', String(commissionRate));
      form.append('description', draft.description.trim());
      form.append('active', String(draft.active));
      form.append('collaborationEnabled', String(draft.collaborationEnabled));
      form.append('collaborationTitle', draft.collaborationTitle.trim());
      form.append('collaborationDescription', draft.collaborationDescription.trim());
      form.append('collaborationGarment', draft.collaborationGarment.trim());
      form.append('collaborationColorName', draft.collaborationColorName.trim());
      form.append('collaborationColorHex', draft.collaborationColorHex.trim());
      form.append('collaborationSizes', draft.collaborationSizes.trim());
      form.append('collaborationPrice', draft.collaborationPrice.trim());

      const collaborationImagesMeta: Array<
        | { type: 'file'; fileIndex: number; isDefault?: boolean }
        | { type: 'url'; url: string; isDefault?: boolean }
      > = [];
      let fileIndex = 0;

      draft.collaborationImages.forEach((image) => {
        if (image.file) {
          form.append('collaborationImages', image.file, image.file.name);
          collaborationImagesMeta.push({
            type: 'file',
            fileIndex,
            isDefault: image.isDefault,
          });
          fileIndex += 1;
          return;
        }

        collaborationImagesMeta.push({
          type: 'url',
          url: image.previewUrl,
          isDefault: image.isDefault,
        });
      });

      form.append('collaborationImagesMeta', JSON.stringify(collaborationImagesMeta));

      if (editingId) {
        if (accessToken) form.append('accessToken', accessToken);
        await adminUpdatePartner(token, editingId, form);
        setSaved('Partner updated');
      } else {
        form.append('accessToken', accessToken);
        await adminCreatePartner(token, form);
        setSaved('Partner created');
      }

      await load();
      startCreate();
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
    collaborationImagesRef.current.forEach((image) => {
      if (image.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
    setDraft((current) => ({
      ...current,
      collaborationEnabled: false,
      collaborationTitle: '',
      collaborationDescription: '',
      collaborationImages: [],
      collaborationGarment: 'Collaboration Shirt',
      collaborationColorName: 'Collaboration',
      collaborationColorHex: '#111827',
      collaborationSizes: DEFAULT_SIZE_OPTIONS.join(', '),
      collaborationPrice: '',
    }));
  }

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
        <button
          onClick={load}
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          Refresh
        </button>
      </div>

      {saved && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300">
          {saved}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-gray-900">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {editingId ? 'Edit partner' : 'New partner'}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Clubs use the access token to open their portal. Leave it blank while editing to keep the current token.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Partner code</span>
              <input
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Access token</span>
              <input
                value={draft.accessToken}
                onChange={(e) => setDraft((current) => ({ ...current, accessToken: e.target.value }))}
                placeholder={editingId ? 'Leave blank to keep current token' : 'partner token'}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</span>
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))}
                rows={4}
                placeholder="Optional notes for this club"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </label>

            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft((current) => ({ ...current, active: e.target.checked }))}
              />
              Active partner
            </label>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving}
                className="rounded-full bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Update partner' : 'Create partner'}
              </button>
              <button
                type="button"
                onClick={startCreate}
                className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
            {partners.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">No partners yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[820px] divide-y divide-gray-100 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-950">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Partner</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Collab</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Updated</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
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
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{partner.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Code {partner.slug}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{partner.discountCode ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{partner.commissionRate}%</td>
                        <td className="px-4 py-3">
                          <Badge variant={partner.active ? 'success' : 'default'}>
                            {partner.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={partner.collaborationEnabled ? 'info' : 'default'}>
                            {partner.collaborationEnabled ? 'Live' : 'Off'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(partner.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                startEdit(partner);
                              }}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleDelete(partner.id);
                              }}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
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

          <div ref={collaborationSectionRef} className="space-y-4 rounded-2xl border border-dashed border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Partner-only product
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This uses the same sectioned workflow as manual catalog creation, but stays attached to this club.
                </p>
              </div>
              <button
                type="button"
                onClick={clearCollaborationDraft}
                className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Reset collab
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Identity</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Keep the club-only product aligned with the same workflow as manual catalog creation.</p>
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
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Title</span>
                    <input
                      value={draft.collaborationTitle}
                      onChange={(e) => setDraft((current) => ({ ...current, collaborationTitle: e.target.value }))}
                      placeholder="Oxford Park x UTC"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Description</span>
                    <textarea
                      value={draft.collaborationDescription}
                      onChange={(e) => setDraft((current) => ({ ...current, collaborationDescription: e.target.value }))}
                      rows={3}
                      placeholder="What makes the shirt special?"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Garment</span>
                      <input
                        value={draft.collaborationGarment}
                        onChange={(e) => setDraft((current) => ({ ...current, collaborationGarment: e.target.value }))}
                        placeholder="Performance T-Shirt"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Partner price</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.collaborationPrice}
                        onChange={(e) => setDraft((current) => ({ ...current, collaborationPrice: e.target.value }))}
                        placeholder="18.00"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Colours</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Set the colour token and size split for the club-only shirt.</p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Colour name</span>
                    <input
                      value={draft.collaborationColorName}
                      onChange={(e) => setDraft((current) => ({ ...current, collaborationColorName: e.target.value }))}
                      placeholder="Collaboration"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Colour hex</span>
                    <input
                      value={draft.collaborationColorHex}
                      onChange={(e) => setDraft((current) => ({ ...current, collaborationColorHex: e.target.value }))}
                      placeholder="#111827"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Sizes</span>
                    <input
                      value={draft.collaborationSizes}
                      onChange={(e) => setDraft((current) => ({ ...current, collaborationSizes: e.target.value }))}
                      placeholder={DEFAULT_SIZE_OPTIONS.join(', ')}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Images</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Upload the club shirt images here. The default image sits first.</p>
                  </div>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleCollaborationFilesSelected(e.target.files)}
                  className="mt-4 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700"
                />

                {draft.collaborationImages.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {draft.collaborationImages.map((image, index) => (
                      <div key={`${image.previewUrl}-${index}`} className="rounded-xl border border-gray-100 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
                        <img src={image.previewUrl} alt="" className="h-32 w-full rounded-lg object-cover" />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setDefaultCollaborationImage(index)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              image.isDefault
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                            }`}
                          >
                            {image.isDefault ? 'Default' : 'Set default'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCollaborationImage(index)}
                            aria-label="Remove image"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            X
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Add one or more images to match the main product card layout.
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="rounded-full bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : editingId ? 'Update partner' : 'Create partner'}
                </button>
                <button
                  type="button"
                  onClick={startCreate}
                  className="rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
