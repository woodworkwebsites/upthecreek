import { Link } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts.js';
import { ProductGrid } from '../components/product/ProductGrid.js';
import { PageLoader } from '../components/ui/LoadingSpinner.js';
import { ErrorMessage } from '../components/ui/ErrorMessage.js';

export default function CollabsPage() {
  const { products, loading, error } = useProducts('collabs');

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(18,38,81,0.08),_transparent_28%),linear-gradient(180deg,_#f7f3ec_0%,_#fbfaf6_32%,_#ffffff_100%)] text-navy-900">
      <header className="relative overflow-hidden border-b border-navy-900/10 bg-navy-900 text-white">
        <div className="absolute inset-0 opacity-35" aria-hidden>
          <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-brand-400 blur-3xl" />
          <div className="absolute right-0 top-10 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-18">
          <div className="max-w-3xl space-y-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/50">Collabs</p>
            <h1 className="max-w-2xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Collaboration drops, direct to customers.
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
              Shop the full collaboration range from UTC and our partner clubs. Every sale is credited to the collaboration partner at their fixed commission rate.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/#collection"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.24em] text-navy-900 transition-transform hover:scale-[1.02]"
              >
                Shop main range
              </Link>
              <Link
                to="/partners"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.24em] text-white transition-colors hover:bg-white/10"
              >
                Partner portal
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : (
          <ProductGrid products={products} toPrefix="/collabs" />
        )}
      </main>
    </div>
  );
}
