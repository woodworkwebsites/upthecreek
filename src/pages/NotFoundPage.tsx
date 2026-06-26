import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-gray-100 dark:text-gray-900">404</p>
      <h1 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        This page has gone up the creek without a paddle.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
      >
        Back to shop
      </Link>
    </div>
  );
}
