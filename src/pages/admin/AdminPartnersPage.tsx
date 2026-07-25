import { useCallback, useEffect, useState } from 'react';
import type { PartnerAdmin } from '../../../types/index.js';
import {
  adminCreatePartner,
  adminDeletePartner,
  adminFetchPartners,
  adminUpdatePartner,
} from '../../lib/api.js';
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

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setSaved(null);
  }

  function startEdit(partner: PartnerAdmin) {
    setEditingId(partner.id);
    setDraft({
      slug: partner.slug,
      name: partner.name,
      discountCode: partner.discountCode ?? '',
      accessToken: partner.accessToken ?? '',
      commissionRate: String(partner.commissionRate),
      description: partner.description ?? '',
      active: partner.active,
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {partners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
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
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(partner.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(partner)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(partner.id)}
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
      </div>
    </div>
  );
}
