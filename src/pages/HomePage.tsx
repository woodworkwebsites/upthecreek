import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts.js';
import { ProductGrid } from '../components/product/ProductGrid.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';

export default function HomePage() {
  const { products, loading, error } = useProducts();
  const [search, setSearch] = useState('');

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center group">
              <img
                src="/Up The Creek_Blue_Wordmark.svg"
                alt="Up the Creek Padel"
                className="h-10 w-auto object-contain group-hover:opacity-80 transition-opacity dark:hidden"
              />
              <img
                src="/UTC_WordMark_White_Trans_BG.png"
                alt="Up the Creek Padel"
                className="h-10 w-auto object-contain group-hover:opacity-80 transition-opacity hidden dark:block"
              />
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-xl">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
              Premium Padel Apparel
            </h1>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
              Humorous, high-quality padel clothing for players who take the sport less seriously than the gear.
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {products.length > 0 && (
          <div className="mb-8">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              className="w-full max-w-sm rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <ProductGrid products={filtered} />
        )}
      </main>

      <footer className="mt-16 border-t border-gray-100 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
            © {new Date().getFullYear()} Up the Creek Padel & Social Club. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
