import { useState, useEffect, useCallback } from 'react';
import { adminGetSettings, adminUpdateSettings, adminGoogleStatus, adminGoogleConnect } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';

export default function AdminSettingsPage() {
  const { token } = useAdminToken();
  const [emailSubject,setEmailSubject]=useState('Thanks for your order | Up The Creek Padel');
  const [emailBody,setEmailBody]=useState("Hi {{first_name}},\n\nThanks for choosing Up The Creek Padel.\n\nWe've placed your order and everything is now being prepared.\n\nWe'll be in touch when your order is on its way.\n\nOrder reference: {{order_reference}}\n\nYour order:\n{{items}}\n\nThanks again for supporting UTC.\n\nUp The Creek Padel\npadel apparel\nupthecreekpadel.club");
  const [emailSaving,setEmailSaving]=useState(false);
  const [emailMessage,setEmailMessage]=useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleConnecting, setGoogleConnecting] = useState(false);
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
      const [settings, mail] = await Promise.all([adminGetSettings(token), adminGoogleStatus(token)]);
      setGoogleConnected(mail.connected);
      if(settings.confirmation_email_subject) setEmailSubject(settings.confirmation_email_subject);
      if(settings.confirmation_email_body) setEmailBody(settings.confirmation_email_body);
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

  async function connectGoogle() {
    if (!token) return;
    setGoogleConnecting(true);
    setGoogleError(null);
    try { const {url} = await adminGoogleConnect(token); window.location.assign(url); }
    catch(e) { setGoogleError(e instanceof Error ? e.message : 'Unable to connect Google'); setGoogleConnecting(false); }
  }

  async function saveEmailTemplate(){if(!token)return;setEmailSaving(true);setEmailMessage('');try{await adminUpdateSettings(token,{confirmation_email_subject:emailSubject,confirmation_email_body:emailBody});setEmailMessage('Email template saved');}catch(e){setEmailMessage(e instanceof Error?e.message:'Save failed');}finally{setEmailSaving(false);}}

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 space-y-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Customer order emails</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">From orders@upthecreekpadel.club, sent manually once the SellShirts order has been placed.</p>
        <p className="text-xs font-semibold">{googleConnected ? "Google Workspace connected" : "Google Workspace not connected"}</p>
        <button type="button" onClick={() => void connectGoogle()} disabled={googleConnecting} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{googleConnecting ? "Connecting…" : googleConnected ? "Reconnect Google Workspace" : "Connect Google Workspace"}</button>
        {googleError && <p className="text-xs text-red-600">{googleError}</p>}
        <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
          <p className="text-sm font-semibold">Order confirmation template</p>
          <label className="block text-xs font-semibold">Subject<input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} maxLength={180} className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm dark:bg-gray-950 dark:border-gray-700" /></label>
          <label className="block text-xs font-semibold">Message<textarea value={emailBody} onChange={e=>setEmailBody(e.target.value)} rows={12} className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm leading-relaxed dark:bg-gray-950 dark:border-gray-700" /></label>
          <p className="text-xs text-gray-500">Available fields: {'{{first_name}}'}, {'{{order_reference}}'}, {'{{items}}'}. UTC branding is applied automatically.</p>
          <button type="button" onClick={()=>void saveEmailTemplate()} disabled={emailSaving} className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{emailSaving?'Saving…':'Save email template'}</button>
          {emailMessage && <p className="text-xs">{emailMessage}</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fulfillment</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Orders are recorded for manual fulfilment only. The supplier import path is no longer part of the live chain.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 space-y-4">

        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Order Fulfilment Mode</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            When Live Orders is off, completed checkouts are held for manual action. Turn it on only when you're ready to process real orders.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Live Orders</p>
            <p className={`text-xs font-semibold mt-0.5 ${liveOrders ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {liveOrders ? '● Active — orders are being captured for fulfilment' : '● Draft mode — orders are NOT being fulfilled'}
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

      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 space-y-4">

        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Stripe Mode</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Force Stripe test mode on the live site. Enables testing with Stripe test cards on <strong>upthecreekpadel.club</strong> without real charges. Turn off when accepting real payments.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
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
