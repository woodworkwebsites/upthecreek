import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';
import {
  adminDeleteReviewImage,
  adminFetchReviews,
  adminUpdateReviews,
  adminUploadReviewImage,
} from '../../lib/api.js';
import type { ReviewImage } from '../../lib/api.js';

export default function AdminReviewsPage() {
  const { token } = useAdminToken();
  const [reviews, setReviews] = useState<ReviewImage[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const items = await adminFetchReviews(token);
      setReviews(items);
      setCaptions(Object.fromEntries(items.map((item) => [item.id, item.alt])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load reviews');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!token || files.length === 0) return;
    setUploading(true);
    setError('');
    setMessage('');
    try {
      let items = reviews;
      for (const file of files) items = await adminUploadReviewImage(token, file);
      setReviews(items);
      setCaptions((current) => ({
        ...current,
        ...Object.fromEntries(items.map((item) => [item.id, item.alt])),
      }));
      setMessage(files.length === 1 ? 'Review image uploaded.' : `${files.length} review images uploaded.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!token) return;
    const target = index + direction;
    if (target < 0 || target >= reviews.length) return;
    const reordered = [...reviews];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setReviews(reordered);
    setSaving(true);
    setError('');
    try {
      const saved = await adminUpdateReviews(token, reordered.map((item) => item.id), captions);
      setReviews(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save review order');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveCaptions() {
    if (!token) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await adminUpdateReviews(token, reviews.map((item) => item.id), captions);
      setReviews(saved);
      setMessage('Review image descriptions saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save descriptions');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ReviewImage) {
    if (!token || !window.confirm('Remove this review image from the carousel?')) return;
    setError('');
    try {
      const remaining = await adminDeleteReviewImage(token, item.id);
      setReviews(remaining);
      setCaptions(Object.fromEntries(remaining.map((entry) => [entry.id, entry.alt])));
      setMessage('Review image removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove review image');
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Reviews</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Upload review screenshots and set their order on the homepage.</p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-4 py-5 text-center transition hover:border-navy-600 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{uploading ? 'Uploading…' : 'Choose review screenshots'}</span>
          <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">PNG, JPG or WebP · up to 12 MB per image · select multiple</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={uploading} onChange={(event) => void handleUpload(event)} className="sr-only" />
        </label>
        {message && <p role="status" className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">{message}</p>}
        {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      </section>

      <section className="space-y-3" aria-label="Uploaded review images">
        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            No review images yet.
          </div>
        ) : (
          reviews.map((item, index) => (
            <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:p-4">
              <div className="flex h-44 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800 sm:w-32">
                <img src={item.src} alt="" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Homepage position {index + 1}</p>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                  Image description
                  <input value={captions[item.id] ?? item.alt} maxLength={180} onChange={(event) => setCaptions((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Customer review screenshot" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-navy-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100" />
                </label>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2 sm:flex-col">
                <button type="button" onClick={() => void move(index, -1)} disabled={index === 0 || saving} aria-label="Move review earlier" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200">↑</button>
                <button type="button" onClick={() => void move(index, 1)} disabled={index === reviews.length - 1 || saving} aria-label="Move review later" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200">↓</button>
                <button type="button" onClick={() => void remove(item)} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">Remove</button>
              </div>
            </article>
          ))
        )}
        {reviews.length > 0 && (
          <div className="flex justify-end">
            <button type="button" onClick={() => void saveCaptions()} disabled={saving} className="rounded-lg bg-navy-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save descriptions'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
