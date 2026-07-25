import { useCallback, useEffect, useState } from 'react';
import type { DiscountCode } from '../../../types/index.js';
import {
  adminCreateDiscountCode,
  adminDeleteDiscountCode,
  adminFetchDiscountCodes,
  adminUpdateDiscountCode,
} from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatDate } from '../../lib/utils.js';

type Draft = {
  code: string;
  kind: 'percent' | 'fixed';
  value: string;
  usageLimit: string;
  active: boolean;
  expiresAt: string;
  notes: string;
};

function emptyDraft(): Draft {
  return {
    code: '',
    kind: 'percent',
    value: '',
    usageLimit: '',
    active: true,
    expiresAt: '',
    notes: '',
  };
}

function formatDiscountValue(code: DiscountCode): string {
  return code.kind === 'percent' ? `${code.value}% off` : `£${(code.value / 100).toFixed(2)} off`;
}

export default function AdminDiscountCodesPage() {
  const { token } = useAdminToken();
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
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
      const data = await adminFetchDiscountCodes(token);
      setDiscountCodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discount codes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setSaved(null);
  }

  function startEdit(code: DiscountCode) {
    setEditingId(code.id);
    setDraft({
      code: code.code,
      kind: code.kind,
      value: String(code.value),
      usageLimit: code.usageLimit === null ? '' : String(code.usageLimit),
      active: code.active,
      expiresAt: code.expiresAt?.slice(0, 10) ?? '',
      notes: code.notes ?? '',
    });
    setSaved(null);
  }

  async function handleSubmit() {
    if (!token) return;
    const code = draft.code.trim();
    if (!code) {
      setError('Code is required');
      return;
    }

    const value = Number(draft.value);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Value must be greater than zero');
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const payload = {
        code,
        kind: draft.kind,
        value,
        usageLimit: draft.usageLimit.trim() ? Number(draft.usageLimit) : null,
        active: draft.active,
        expiresAt: draft.expiresAt.trim() || null,
        notes: draft.notes.trim() || null,
      };

      if (editingId) {
        await adminUpdateDiscountCode(token, editingId, payload);
        setSaved('Discount code updated');
      } else {
        await adminCreateDiscountCode(token, payload);
        setSaved('Discount code created');
      }

      await load();
      setEditingId(null);
      setDraft(emptyDraft());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save discount code');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!window.confirm('Delete this discount code?')) return;

    setSaving(true);
    setError(null);
    try {
      await adminDeleteDiscountCode(token, id);
      await load();
      if (editingId === id) {
        startCreate();
      }
      setSaved('Discount code deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete discount code');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Discount Codes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create and manage checkout discount codes from one place.
          </p>
        </div>
        <button
          onClick={load}
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 sm:p-6 dark:border-gray-800 dark:bg-gray-900">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {editingId ? 'Edit code' : 'New code'}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Percent codes reduce by a percentage. Fixed codes reduce by a currency amount in pence.
            </p>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code</span>
            <input
              value={draft.code}
              onChange={(e) => setDraft((current) => ({ ...current, code: e.target.value }))}
              placeholder="SUMMER20"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</span>
              <select
                value={draft.kind}
                onChange={(e) => setDraft((current) => ({ ...current, kind: e.target.value as Draft['kind'] }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {draft.kind === 'percent' ? 'Percent' : 'Pence'}
              </span>
              <input
                type="number"
                min="0"
                step={draft.kind === 'percent' ? '1' : '1'}
                value={draft.value}
                onChange={(e) => setDraft((current) => ({ ...current, value: e.target.value }))}
                placeholder={draft.kind === 'percent' ? '20' : '1500'}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Usage limit</span>
            <input
              type="number"
              min="1"
              step="1"
              value={draft.usageLimit}
              onChange={(e) => setDraft((current) => ({ ...current, usageLimit: e.target.value }))}
              placeholder="Optional"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expires at</span>
            <input
              type="date"
              value={draft.expiresAt}
              onChange={(e) => setDraft((current) => ({ ...current, expiresAt: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</span>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))}
              rows={4}
              placeholder="Optional internal notes"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>

          <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((current) => ({ ...current, active: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-navy-800 focus:ring-navy-800"
            />
            Active
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-xl bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : editingId ? 'Update code' : 'Create code'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={startCreate}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            )}
          </div>

          {saved && <p className="text-xs font-semibold text-green-600 dark:text-green-400">{saved}</p>}
          {error && <ErrorMessage message={error} onRetry={load} />}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
          {discountCodes.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">No discount codes yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] divide-y divide-gray-100 dark:divide-gray-800">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-950/50">
                    {['Code', 'Type', 'Value', 'Usage', 'Expiry', 'Status', 'Notes', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider first:pl-4"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {discountCodes.map((code) => (
                    <tr key={code.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 pl-4 pr-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{code.code}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{code.kind}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDiscountValue(code)}</td>
                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {code.usageCount}{code.usageLimit ? ` / ${code.usageLimit}` : ''}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {code.expiresAt ? formatDate(code.expiresAt) : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={code.active ? 'success' : 'default'}>
                          {code.active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                        {code.notes ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(code)}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(code.id)}
                            disabled={saving}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
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
