import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-4">
      <div
        className={`max-w-md w-full text-center transition-all duration-500 ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20">
          <svg
            className="h-10 w-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Order confirmed!
        </h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400 leading-relaxed">
          Thanks for your order. We're preparing it for printing and will send you a shipping confirmation once it's on its way.
        </p>

        {sessionId && (
          <p className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-900 px-4 py-2 text-xs text-gray-400 dark:text-gray-500 font-mono">
            Ref: {sessionId}
          </p>
        )}

        <div className="mt-8 space-y-3">
          <Link
            to="/"
            className="block rounded-full bg-gray-900 px-8 py-3 text-sm font-medium text-white hover:bg-gray-700 transition-colors dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            Continue shopping
          </Link>
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-600">
          Questions? Drop us a message — we're a social club, we're friendly.
        </p>
      </div>
    </div>
  );
}
