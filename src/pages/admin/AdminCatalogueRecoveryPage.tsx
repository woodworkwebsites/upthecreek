import { useMemo, useState } from 'react';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { adminFetchProducts, adminRunCatalogueRecovery } from '../../lib/api.js';
import type { Product } from '../../../types/index.js';

type RecoveryEntry = {
  d1Record?: string;
  productId?: string;
  title?: string;
  garment?: string;
  colour?: string;
  sellshirtsCatalogueRef?: string;
  creationId?: string;
  side?: string;
  sourceUrl?: string;
  targetR2Key?: string;
  status?: string;
  error?: string;
};

type RecoveryReport = {
  generatedAt?: string;
  dryRun?: boolean;
  imageSize?: string;
  d1CatalogueRecordsExamined?: number;
  uniqueSellshirtsRefs?: number;
  refsSuccessfullyResolved?: number;
  frontImagesFound?: number;
  backImagesFound?: number;
  existingR2Images?: number;
  missingR2ImagesRecoverable?: number;
  unresolvedProductsOrErrors?: number;
  manifest?: RecoveryEntry[];
};

function statusClasses(status: string) {
  if (status === 'existing') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (status === 'recoverable') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  if (status === 'recovered') return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
  return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300';
}

export default function AdminCatalogueRecoveryPage() {
  const { token } = useAdminToken();
  const [report, setReport] = useState<RecoveryReport | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [applyArmed, setApplyArmed] = useState(false);

  async function runRecovery(apply = false) {
    if (!token) return;
    setRunning(true);
    setError(null);
    try {
      const result = await adminRunCatalogueRecovery(token, { apply });
      setReport(result as RecoveryReport);
      setApplyArmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Catalogue recovery failed');
    } finally {
      setRunning(false);
    }
  }

  async function loadCurrentCatalogue() {
    if (!token) return;
    setLoadingProducts(true);
    setError(null);
    try {
      setProducts(await adminFetchProducts(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load current catalogue');
    } finally {
      setLoadingProducts(false);
    }
  }

  const entries = useMemo(() => {
    const rows = report?.manifest ?? [];
    return rows.filter((entry) => {
      const matchesStatus = filter === 'all' || entry.status === filter;
      const haystack = [entry.title, entry.colour, entry.garment, entry.sellshirtsCatalogueRef, entry.creationId]
        .join(' ').toLowerCase();
      return matchesStatus && haystack.includes(query.trim().toLowerCase());
    });
  }, [filter, query, report]);

  const existingRefs = useMemo(() => {
    const refs = new Set<string>();
    for (const product of products) {
      for (const color of product.colors) {
        const ref = color.orderUrl?.match(/\/product\/([^/?#]+)/)?.[1];
        if (ref) refs.add(ref);
      }
    }
    return refs;
  }, [products]);

  return (
    <section className="mx-auto max-w-7xl space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">Admin catalogue</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">Sellshirts recovery &amp; alignment</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
          Review the existing D1 garment/colour mappings against Sellshirts before recovering images. This tool does not change collection membership, live status, or catalogue classification.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Run recovery</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Cloudflare Browser Run now renders Sellshirts directly from the admin tool. The first button is always a dry-run.</p>
          <button type="button" onClick={() => void runRecovery(false)} disabled={running} className="mt-4 rounded-xl bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50">{running ? 'Scanning Sellshirts…' : 'Run dry-run recovery'}</button>
          {report && report.dryRun && <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800"><label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><input type="checkbox" checked={applyArmed} onChange={(event) => setApplyArmed(event.target.checked)} /> I have reviewed the mapping and want to write recoverable images.</label><button type="button" onClick={() => void runRecovery(true)} disabled={!applyArmed || running} className="mt-3 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Apply reviewed recovery</button></div>}         </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Current catalogue</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Load the current D1 catalogue to compare the existing Sellshirts refs while reviewing the scan.</p>
          <button type="button" onClick={() => void loadCurrentCatalogue()} disabled={loadingProducts} className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            {loadingProducts ? 'Loading current D1 catalogue…' : 'Load current D1 catalogue'}
          </button>
          {products.length > 0 && <p className="mt-2 text-xs text-gray-500">Loaded {products.length} products and {existingRefs.size} Sellshirts refs.</p>}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['D1 records', report.d1CatalogueRecordsExamined],
              ['Unique refs', report.uniqueSellshirtsRefs],
              ['Resolved refs', report.refsSuccessfullyResolved],
              ['Recoverable images', report.missingR2ImagesRecoverable],
              ['Front found', report.frontImagesFound],
              ['Back found', report.backImagesFound],
              ['Existing R2', report.existingR2Images],
              ['Errors', report.unresolvedProductsOrErrors],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{value ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 border-b border-gray-200 p-4 dark:border-gray-800 lg:flex-row lg:items-center">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, colour, ref…" className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="all">All statuses</option>
                <option value="recoverable">Recoverable</option>
                <option value="existing">Existing</option>
                <option value="error">Errors</option>
              </select>
              <span className="text-xs text-gray-500">{entries.length} of {report.manifest?.length ?? 0} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-950">
                  <tr>{['Product / colour', 'Sellshirts', 'Streetshirts', 'Side', 'Target R2 key', 'Status'].map((heading) => <th key={heading} className="px-3 py-3 font-bold">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={`${entry.productId}-${entry.sellshirtsCatalogueRef}-${entry.side}-${index}`} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-3"><div className="font-semibold text-gray-900 dark:text-gray-100">{entry.title || 'Unknown product'}</div><div className="text-gray-500">{entry.garment || 'Garment not set'} · {entry.colour}</div></td>
                      <td className="px-3 py-3"><a className="text-blue-600 hover:underline" href={`https://sellshirts.com/product/${entry.sellshirtsCatalogueRef}`} target="_blank" rel="noreferrer">{entry.sellshirtsCatalogueRef}</a></td>
                      <td className="max-w-[280px] break-all px-3 py-3 font-mono text-[10px] text-gray-500">{entry.creationId || entry.error || '—'}</td>
                      <td className="px-3 py-3 uppercase">{entry.side || '—'}</td>
                      <td className="max-w-[300px] break-all px-3 py-3 font-mono text-[10px] text-gray-500">{entry.targetR2Key || '—'}</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 font-semibold ${statusClasses(entry.status || 'error')}`}>{entry.status || 'error'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">Generate and load a dry-run manifest to begin reviewing catalogue alignment.</div>
      )}
    </section>
  );
}
