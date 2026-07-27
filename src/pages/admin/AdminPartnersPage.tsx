import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
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
  collaborationImageUrls: string;
  collaborationGarment: string;
  collaborationColorName: string;
  collaborationColorHex: string;
  collaborationSizes: string;
  collaborationPrice: string;
};

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
    collaborationImageUrls: '',
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

function parseCollaborationImages(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function buildCollaborationDesign(draft: Draft): PartnerCollaborationDesign | null {
  const imageUrls = parseCollaborationImages(draft.collaborationImageUrls);
  const hasCustomContent =
    draft.collaborationTitle.trim().length > 0 ||
    draft.collaborationDescription.trim().length > 0 ||
    imageUrls.length > 0 ||
    draft.collaborationGarment.trim() !== 'Collaboration Shirt' ||
    draft.collaborationColorName.trim() !== 'Collaboration' ||
    draft.collaborationColorHex.trim() !== '#111827' ||
    draft.collaborationSizes.trim() !== DEFAULT_SIZE_OPTIONS.join(', ') ||
    draft.collaborationPrice.trim().length > 0;

  if (!draft.collaborationEnabled && !hasCustomContent) return null;

  const pounds = Number(draft.collaborationPrice);
  if (!Number.isFinite(pounds) || pounds < 0) {
    throw new Error('Collaboration shirt price must be zero or greater');
  }

  const sizes = Array.from(
    new Set(
      draft.collaborationSizes
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );

  return {
    title: draft.collaborationTitle.trim() || 'Collaboration Shirt',
    description: draft.collaborationDescription.trim() || null,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    garment: draft.collaborationGarment.trim() || null,
    colorName: draft.collaborationColorName.trim() || 'Collaboration',
    colorHex: draft.collaborationColorHex.trim() || '#111827',
    sizes: sizes.length > 0 ? sizes : DEFAULT_SIZE_OPTIONS.slice(),
    partnerPrice: Math.round(pounds * 100),
  };
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
      collaborationImageUrls: (collaboration?.imageUrls?.length ? collaboration.imageUrls : collaboration?.imageUrl ? [collaboration.imageUrl] : []).join('\n'),
      collaborationGarment: collaboration?.garment ?? 'Collaboration Shirt',
      collaborationColorName: collaboration?.colorName ?? 'Collaboration',
      collaborationColorHex: collaboration?.colorHex ?? '#111827',
      collaborationSizes: (collaboration?.sizes ?? DEFAULT_SIZE_OPTIONS).join(', '),
      collaborationPrice: formatPoundsInput(collaboration?.partnerPrice),
    });
    setSaved(null);
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

    let collaborationDesign: PartnerCollaborationDesign | null;
    try {
      collaborationDesign = buildCollaborationDesign(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid collaboration shirt');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(null);

    try {
      const basePayload = {
        slug,
        name,
        discountCode: draft.discountCode.trim() || null,
        commissionRate,
        description: draft.description.trim() || null,
        active: draft.active,
        collaborationEnabled: draft.collaborationEnabled,
        collaborationDesign,
      };

      if (editingId) {
        await adminUpdatePartner(token, editingId, {
          ...basePayload,
          accessToken: accessToken || undefined,
        });
        setSaved('Partner updated');
      } else {
        await adminCreatePartner(token, {
          ...basePayload,
          accessToken,
        });
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
    setDraft((current) => ({
      ...current,
      collaborationEnabled: false,
      collaborationTitle: '',
      collaborationDescription: '',
      collaborationImageUrls: '',
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
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Identity</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Match the same top-to-bottom flow as manual product creation.</p>
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

                  <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={draft.collaborationEnabled}
                      onChange={(e) => setDraft((current) => ({ ...current, collaborationEnabled: e.target.checked }))}
                    />
                    Show collaboration shirt in partner ordering
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Colours</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Set the single visible colour token and the size split for the shirt.</p>
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
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Images</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Paste image URLs in the same spirit as uploading images on the product create page.</p>
                </div>

                <label className="mt-4 block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Image URLs</span>
                  <textarea
                    value={draft.collaborationImageUrls}
                    onChange={(e) => setDraft((current) => ({ ...current, collaborationImageUrls: e.target.value }))}
                    placeholder="/partner-collab-front.jpg\n/partner-collab-back.jpg"
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    Add one URL per line or separate them with commas. The first image is used as the default.
                  </p>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
