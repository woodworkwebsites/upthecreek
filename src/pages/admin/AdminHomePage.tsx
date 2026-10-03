import { Link } from 'react-router-dom';

const adminSections = [
  {
    path: '/admin/products',
    label: 'Products',
    tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  },
  {
    path: '/admin/ranges',
    label: 'Ranges',
    tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  },
  {
    path: '/admin/orders',
    label: 'Orders',
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  {
    path: '/admin/partners',
    label: 'Partners',
    tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  {
    path: '/admin/stock-orders',
    label: 'Stock Orders',
    tone: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
  },
  {
    path: '/admin/discount-codes',
    label: 'Discount Codes',
    tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  },
  {
    path: '/admin/catalog',
    label: 'Catalog',
    tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  {
    path: '/admin/catalogue-recovery',
    label: 'Image Recovery',
    tone: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  },
  {
    path: '/admin/logs',
    label: 'Logs',
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    path: '/admin/settings',
    label: 'Settings',
    tone: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
];

export default function AdminHomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400 dark:text-gray-500">
          Up The Creek Padel
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
          Admin
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          Choose an area to manage the store.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => (
          <Link
            key={section.path}
            to={section.path}
            className="group flex min-h-28 flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-navy-500 focus:ring-offset-2 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:focus:ring-offset-gray-950"
          >
            <div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${section.tone}`}>
                {section.label}
              </span>
            </div>
            <span className="mt-6 inline-flex items-center gap-1 text-xs font-semibold text-gray-400 transition group-hover:gap-2 group-hover:text-gray-700 dark:text-gray-500 dark:group-hover:text-gray-200">
              Open section <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
