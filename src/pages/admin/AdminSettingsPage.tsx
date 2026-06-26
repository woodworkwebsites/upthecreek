import { useState, useEffect, useCallback } from 'react';
import { adminGetSettings, adminUpdateSettings } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';

export default function AdminSettingsPage() {
  const { token } = useAdminToken();
  const [liveOrders, setLiveOrders]       = useState(false);
  const [stripeTestMode, setStripeTestMode] = useState(false);
  const [loading, setLoading]              = useState(true);
  const [saving, setSaving]                = useState(false);
  const [saved, setSaved]                  = useState(false);
  const [error, setError]                  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const settings = await adminGetSettings(token);
      setLiveOrders(settings.live_orders_enabled === 'true');
      setStripeTestMode(settings.stripe_test_mode === 'true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function handleToggle(key: string, enabled: boolean) {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await adminUpdateSettings(token, { [key]: enabled ? 'true' : 'false' });
      if (key === 'live_orders_enabled') setLiveOrders(enabled);
      if (key === 'stripe_test_mode') setStripeTestMode(enabled);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">

        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Order Fulfilment Mode</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            When Live Orders is off, completed checkouts are submitted to Printify as <strong>drafts</strong> — no garments are printed or charged. Turn it on only when you're ready to fulfil real orders.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Live Orders</p>
            <p className={`text-xs font-semibold mt-0.5 ${liveOrders ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {liveOrders ? '● Active — orders are being sent to Printify' : '● Draft mode — orders are NOT being fulfilled'}
            </p>
          </div>
          <button
            onClick={() => handleToggle('live_orders_enabled', !liveOrders)}
            disabled={saving}
            aria-pressed={liveOrders}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
              liveOrders ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                liveOrders ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {saved && (
          <p className="text-xs font-semibold text-green-600 dark:text-green-400">✓ Saved</p>
        )}
        {error && (
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">

        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Stripe Mode</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Force Stripe test mode on the live site. Enables testing with Stripe test cards on <strong>upthecreekpadel.club</strong> without real charges. Turn off when accepting real payments.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Stripe Test Mode</p>
            <p className={`text-xs font-semibold mt-0.5 ${stripeTestMode ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
              {stripeTestMode ? '● Test mode — no real charges' : '● Live mode — real payments active'}
            </p>
          </div>
          <button
            onClick={() => handleToggle('stripe_test_mode', !stripeTestMode)}
            disabled={saving}
            aria-pressed={stripeTestMode}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
              stripeTestMode ? 'bg-amber-400' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                stripeTestMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
