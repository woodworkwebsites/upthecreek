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
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-3xl">🏓</span>
          <h1 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Admin Panel
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter your admin token to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="token"
              className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1"
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
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="w-full rounded-full bg-gray-900 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {loading ? 'Verifying…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
