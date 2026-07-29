import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminToken } from '../../hooks/useAdmin.js';
import { adminFetchOrders } from '../../lib/api.js';

export default function AdminLoginPage() {
  const { setToken } = useAdminToken();
  const navigate = useNavigate();
  const [value,   setValue]   = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;

    setError(null);
    setLoading(true);

    try {
      await adminFetchOrders(value.trim());
      setToken(value.trim());
      navigate('/admin', { replace: true });
    } catch {
      setError('Invalid token. Please check your ADMIN_TOKEN.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#1d2a52_0%,_#0b1437_42%,_#050816_100%)] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-28 items-center justify-center">
            <img
              src="/UTC_WordMark_White_Trans_BG.png"
              alt="Up the Creek Padel"
              className="h-20 w-auto object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.35)]"
            />
          </div>
          <h1 className="mt-2 text-lg font-semibold text-white">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Enter your admin token to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="username"
            autoComplete="username"
            value="admin"
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="sr-only"
          />
          <div>
            <label
              htmlFor="token"
              className="block text-xs font-medium text-white/80 mb-1"
            >
              Admin Token
            </label>
            <input
              id="token"
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter token…"
              className="w-full rounded-xl border border-white/10 bg-white/95 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-lg shadow-black/10 focus:border-white/30 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-300">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="w-full rounded-full bg-white py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            {loading ? 'Verifying…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
