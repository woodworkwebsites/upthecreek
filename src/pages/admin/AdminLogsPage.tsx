import { useState, useEffect, useCallback } from 'react';
import type { SyncLogRow, WebhookLogRow, PrintifyLogRow } from '../../../types/index.js';
import { adminFetchLogs } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { Badge } from '../../components/ui/Badge.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../../components/ui/ErrorMessage.js';
import { formatDate } from '../../lib/utils.js';

type TabId = 'webhooks' | 'sync' | 'printify';

export default function AdminLogsPage() {
  const { token } = useAdminToken();
  const [activeTab,    setActiveTab]    = useState<TabId>('webhooks');
  const [syncLogs,     setSyncLogs]     = useState<SyncLogRow[]>([]);
  const [webhookLogs,  setWebhookLogs]  = useState<WebhookLogRow[]>([]);
  const [printifyLogs, setPrintifyLogs] = useState<PrintifyLogRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetchLogs(token);
      setSyncLogs(data.syncLogs);
      setWebhookLogs(data.webhookLogs);
      setPrintifyLogs(data.printifyLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'webhooks', label: 'Webhooks', count: webhookLogs.length },
    { id: 'sync',     label: 'Sync',     count: syncLogs.length },
    { id: 'printify', label: 'Printify', count: printifyLogs.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Logs</h1>
        <button
          onClick={load}
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : (
        <>
          {activeTab === 'webhooks' && (
            <LogTable
              headers={['Event', 'Session', 'Status', 'Error', 'Created']}
              rows={webhookLogs}
              renderRow={(log: WebhookLogRow) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pl-4 pr-3 text-xs font-mono text-gray-700 dark:text-gray-300">{log.event_type}</td>
                  <td className="px-3 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">{log.stripe_session_id?.slice(0, 20) ?? '—'}</td>
                  <td className="px-3 py-3">
                    <Badge variant={log.status === 'error' ? 'error' : log.status === 'processed' ? 'success' : 'default'}>
                      {log.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-red-500 dark:text-red-400">{log.error ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500">{formatDate(log.created_at)}</td>
                </tr>
              )}
              emptyMessage="No webhook logs yet."
            />
          )}

          {activeTab === 'sync' && (
            <LogTable
              headers={['Status', 'Products Synced', 'Message', 'Created']}
              rows={syncLogs}
              renderRow={(log: SyncLogRow) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pl-4 pr-3">
                    <Badge variant={log.status === 'error' ? 'error' : 'success'}>{log.status}</Badge>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300">{log.products_synced ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">{log.message ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500">{formatDate(log.created_at)}</td>
                </tr>
              )}
              emptyMessage="No sync logs yet. Try syncing products."
            />
          )}

          {activeTab === 'printify' && (
            <LogTable
              headers={['Order', 'Mode', 'Action', 'Status', 'Error', 'Created']}
              rows={printifyLogs}
              renderRow={(log: PrintifyLogRow) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 pl-4 pr-3 text-xs font-mono text-gray-500 dark:text-gray-400">{log.order_id?.slice(0, 16) ?? '—'}</td>
                  <td className="px-3 py-3">
                    <Badge variant={log.mode === 'live' ? 'default' : log.mode === 'draft' ? 'info' : 'warning'}>
                      {log.mode.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300">{log.action}</td>
                  <td className="px-3 py-3">
                    <Badge variant={log.status === 'error' ? 'error' : 'success'}>{log.status}</Badge>
                  </td>
                  <td className="px-3 py-3 text-xs text-red-500 dark:text-red-400">{log.error ?? '—'}</td>
                  <td className="px-3 py-3 text-xs text-gray-400 dark:text-gray-500">{formatDate(log.created_at)}</td>
                </tr>
              )}
              emptyMessage="No Printify logs yet."
            />
          )}
        </>
      )}
    </div>
  );
}

function LogTable<T>({
  headers,
  rows,
  renderRow,
  emptyMessage,
}: {
  headers: string[];
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 py-12 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider first:pl-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
            {rows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
