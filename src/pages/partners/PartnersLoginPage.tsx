import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { partnerAuthenticate } from '../../lib/api.js';
import { usePartnerSession } from '../../hooks/usePartner.js';

export default function PartnersLoginPage() {
  const navigate = useNavigate();
  const { session, setSession } = usePartnerSession();
  const [slug, setSlug] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigate('/partners/dashboard', { replace: true });
    }
  }, [navigate, session]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextSlug = slug.trim().toLowerCase();
    const nextToken = accessToken.trim();

    if (!nextSlug || !nextToken) return;

    setError(null);
    setLoading(true);

    try {
      const response = await partnerAuthenticate(nextSlug, nextToken);
      setSession({
        slug: nextSlug,
        accessToken: nextToken,
        partner: response.partner,
      });
      navigate('/partners/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify partner access');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1d2a52_0%,_#0b1437_48%,_#050816_100%)] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center justify-center">
        <section className="w-full rounded-[2rem] border border-white/10 bg-white/96 p-6 text-navy-900 shadow-2xl shadow-black/20 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <img src="/UTC_WordMark_White_Trans_BG.png" alt="Up the Creek Padel" className="h-12 w-auto" />
            <p className="label mt-6">Partner access</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-navy-900">
              Sign in to your club portal.
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-7 text-gray-600">
              Use your club code and access token to open the private portal.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Club code</span>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="e.g. oxford-park"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Access token</span>
              <input
                type="password"
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                placeholder="Enter partner token"
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none"
              />
            </label>

            {error && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <Button
              type="submit"
              loading={loading}
              disabled={!slug.trim() || !accessToken.trim()}
              className="w-full"
            >
              Sign in
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-xs text-gray-500">
            <a href="/partners" className="font-semibold uppercase tracking-[0.22em] hover:text-navy-900">Back</a>
            <a href="mailto:hello@upthecreekpadel.club?subject=Partner%20Access" className="font-semibold uppercase tracking-[0.22em] hover:text-navy-900">Request access</a>
          </div>
        </section>
      </div>
    </div>
  );
}
