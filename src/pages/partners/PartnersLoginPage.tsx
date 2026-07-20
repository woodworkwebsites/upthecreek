import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.js';
import { partnerAuthenticate } from '../../lib/api.js';
import { usePartnerSession } from '../../hooks/usePartner.js';

const loginBenefits = [
  'View attributed orders and commission due.',
  'Open the full product matrix and move into checkout.',
  'Keep the club code and access token in one place.',
];

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(76,111,191,0.16),_transparent_30%),linear-gradient(180deg,_#06122c_0%,_#0b1437_34%,_#f8f7f3_34%,_#f8f7f3_100%)] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
          <section className="rounded-[2.25rem] border border-white/10 bg-navy-950/55 p-8 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-10">
            <img src="/UTC_WordMark_White_Trans_BG.png" alt="Up the Creek Padel" className="h-12 w-auto" />
            <p className="label mt-8 text-white/60">Partner access</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Sign in to the partner portal.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-white/75 sm:text-base">
              Use the club code and access token issued for your partner record. Once inside, you can check sales, commission and stock orders.
            </p>

            <div className="mt-8 grid gap-3">
              {loginBenefits.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/6 p-4 text-sm leading-7 text-white/80">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2.25rem] border border-gray-200 bg-white p-6 text-navy-900 shadow-[0_25px_80px_rgba(5,13,31,0.12)] sm:p-8">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-6">
              <div className="flex items-center gap-4">
                <img src="/UTC_Logo.png" alt="Up the Creek Padel" className="h-11 w-11 rounded-2xl object-contain" />
                <div>
                  <p className="label">Partner portal</p>
                  <p className="mt-1 text-lg font-black tracking-tight text-navy-900">Partner dashboard login</p>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-7 text-gray-600">
                If your club has already been set up, sign in below. If not, request access and we’ll create the partner record.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Club code</span>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="e.g. oxford-park"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Access token</span>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(event) => setAccessToken(event.target.value)}
                  placeholder="Enter partner token"
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none"
                />
              </label>

              {error ? (
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              ) : null}

              <Button
                type="submit"
                loading={loading}
                disabled={!slug.trim() || !accessToken.trim()}
                className="w-full"
              >
                Sign in
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 pt-6 text-xs text-gray-500">
              <a href="/partners" className="font-semibold uppercase tracking-[0.22em] hover:text-navy-900">
                Back
              </a>
              <a href="mailto:hello@upthecreekpadel.club?subject=Partner%20Access" className="font-semibold uppercase tracking-[0.22em] hover:text-navy-900">
                Request access
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
