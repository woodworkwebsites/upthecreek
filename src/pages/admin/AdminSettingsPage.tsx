import { useState, useEffect, useCallback } from 'react';
import { adminGetSettings, adminUpdateSettings, adminGoogleStatus, adminGoogleConnect } from '../../lib/api.js';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { PageLoader } from '../../components/ui/LoadingSpinner.js';

export default function AdminSettingsPage() {
  const { token } = useAdminToken();
  const [emailSubject,setEmailSubject]=useState('Thanks for your order | Up The Creek Padel');
  const [emailBody,setEmailBody]=useState("Hi {{first_name}},\n\nThanks for choosing Up The Creek Padel.\n\nWe've placed your order and everything is now being prepared.\n\nWe'll be in touch when your order is on its way.\n\nOrder reference: {{order_reference}}\n\nYour order:\n{{items}}\n\nThanks again for supporting UTC.\n\nUp The Creek Padel\npadel apparel\nupthecreekpadel.club");
  const [emailKind,setEmailKind]=useState<'confirmation'|'dispatch'>('confirmation');
  const [dispatchSubject,setDispatchSubject]=useState('Your order is on its way | Up The Creek Padel');
  const [dispatchBody,setDispatchBody]=useState("Hi {{first_name}},\n\nGood news — your Up The Creek Padel order has been dispatched.\n\nOrder reference: {{order_reference}}\n\nYour order:\n{{items}}\n\nRoyal Mail tracking: {{royal_mail_tracking}}\nTrack your parcel: {{tracking_url}}\n\nThanks again for choosing UTC.\n\nUp The Creek Padel\npadel apparel\nupthecreekpadel.club");
  const [savedDispatchSubject,setSavedDispatchSubject]=useState('');
  const [savedDispatchBody,setSavedDispatchBody]=useState('');
  const [emailModalOpen,setEmailModalOpen]=useState(false);
  const [savedEmailSubject,setSavedEmailSubject]=useState('');
  const [savedEmailBody,setSavedEmailBody]=useState('');
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
      setSavedEmailSubject(settings.confirmation_email_subject || 'Thanks for your order | Up The Creek Padel');
      setSavedEmailBody(settings.confirmation_email_body || "Hi {{first_name}},\n\nThanks for choosing Up The Creek Padel.\n\nWe've placed your order and everything is now being prepared.\n\nWe'll be in touch when your order is on its way.\n\nOrder reference: {{order_reference}}\n\nYour order:\n{{items}}\n\nThanks again for supporting UTC.\n\nUp The Creek Padel\npadel apparel\nupthecreekpadel.club");
      if(settings.dispatch_email_subject) setDispatchSubject(settings.dispatch_email_subject);
      if(settings.dispatch_email_body) setDispatchBody(settings.dispatch_email_body);
      setSavedDispatchSubject(settings.dispatch_email_subject || 'Your order is on its way | Up The Creek Padel');
      setSavedDispatchBody(settings.dispatch_email_body || "Hi {{first_name}},\n\nGood news — your Up The Creek Padel order has been dispatched.\n\nOrder reference: {{order_reference}}\n\nYour order:\n{{items}}\n\nThanks again for choosing UTC.\n\nUp The Creek Padel\npadel apparel\nupthecreekpadel.club");
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

  async function saveEmailTemplate(){
    if(!token)return;setEmailSaving(true);setEmailMessage('');
    try {
      if(emailKind==='dispatch'){
        await adminUpdateSettings(token,{dispatch_email_subject:dispatchSubject,dispatch_email_body:dispatchBody});
        setSavedDispatchSubject(dispatchSubject);setSavedDispatchBody(dispatchBody);
      }else{
        await adminUpdateSettings(token,{confirmation_email_subject:emailSubject,confirmation_email_body:emailBody});
        setSavedEmailSubject(emailSubject);setSavedEmailBody(emailBody);
      }
      setEmailModalOpen(false);setEmailMessage('Email template saved');
    }catch(e){setEmailMessage(e instanceof Error?e.message:'Save failed');}
    finally{setEmailSaving(false);}
  }
  function closeEmailModal(){
    if(emailSaving)return;
    setEmailSubject(savedEmailSubject);setEmailBody(savedEmailBody);
    setDispatchSubject(savedDispatchSubject);setDispatchBody(savedDispatchBody);
    setEmailMessage('');setEmailModalOpen(false);
  }

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
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Order confirmation template</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Edit the subject and message customers receive.</p>
            </div>
            <button type="button" onClick={()=>{setEmailKind('confirmation');setEmailMessage('');setEmailModalOpen(true);}} className="shrink-0 rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Edit template</button>
          </div>
          {emailMessage && <p className="mt-2 text-xs font-semibold text-green-600">{emailMessage}</p>}
        </div>
        <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Order dispatched template</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Sent manually when SellShirts dispatches the order.</p></div>
            <button type="button" onClick={()=>{setEmailKind('dispatch');setEmailMessage('');setEmailModalOpen(true);}} className="shrink-0 rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Edit template</button>
          </div>
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
      {emailModalOpen && (
        <div role="presentation" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-6" onClick={closeEmailModal}>
          <div role="dialog" aria-modal="true" aria-label="Edit order confirmation email" style={{backgroundColor:'#fff',color:'#202527',colorScheme:'light'}} className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-4">
              <h2 className="text-lg font-semibold">{emailKind==='dispatch'?'Edit dispatched email':'Edit confirmation email'}</h2>
              <button type="button" disabled={emailSaving} onClick={closeEmailModal} style={{color:'#202527'}} className="rounded-lg px-2 py-1 text-sm font-semibold">Close</button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <label className="block text-sm font-semibold" style={{color:'#202527'}}>Subject
                <input value={emailKind==='dispatch'?dispatchSubject:emailSubject} onChange={e=>emailKind==='dispatch'?setDispatchSubject(e.target.value):setEmailSubject(e.target.value)} maxLength={180} style={{backgroundColor:'#fff',color:'#202527',WebkitTextFillColor:'#202527'}} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"/>
              </label>
              <label className="block text-sm font-semibold" style={{color:'#202527'}}>Message
                <textarea value={emailKind==='dispatch'?dispatchBody:emailBody} onChange={e=>emailKind==='dispatch'?setDispatchBody(e.target.value):setEmailBody(e.target.value)} rows={13} maxLength={10000} style={{backgroundColor:'#fff',color:'#202527',WebkitTextFillColor:'#202527'}} className="mt-1 block min-h-[260px] w-full resize-y rounded-lg border border-gray-300 px-3 py-3 text-sm leading-relaxed"/>
              </label>
              <p className="text-xs" style={{color:'#56606a'}}>Available fields: {'{{first_name}}'}, {'{{order_reference}}'}, {'{{items}}'}, {'{{royal_mail_tracking}}'}, {'{{tracking_url}}'}. UTC branding is applied automatically.</p>
              {emailMessage && <p className="text-sm text-red-600">{emailMessage}</p>}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-3" style={{backgroundColor:'#fff'}}>
              <button type="button" onClick={closeEmailModal} disabled={emailSaving} style={{backgroundColor:'#fff',color:'#202527'}} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={()=>void saveEmailTemplate()} disabled={emailSaving || !(emailKind==='dispatch'?dispatchSubject:emailSubject).trim() || !(emailKind==='dispatch'?dispatchBody:emailBody).trim()} style={{backgroundColor:'#202527',color:'#fff'}} className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">{emailSaving?'Saving…':'Save template'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
