import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useBasket } from '../../context/BasketContext.js';
import { formatPrice } from '../../lib/utils.js';

export function BasketBar() {
  const { items, itemCount } = useBasket();
  const location = useLocation();
  const [visible, setVisible] = useState(location.pathname !== '/');

  useEffect(() => {
    if (location.pathname !== '/') {
      setVisible(true);
      return;
    }
    const section = document.getElementById('collection');
    if (!section) { setVisible(false); return; }
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [location.pathname]);

  // Hide on admin pages, when no items, or when already on the basket page
  if (location.pathname.startsWith('/admin')) return null;
  if (location.pathname === '/checkout') return null;
  if (!visible || itemCount === 0) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-2xl px-3 pb-4 sm:px-4">
        <div className="pointer-events-auto flex items-center justify-between gap-4 rounded-2xl bg-navy-900 px-5 py-3.5 shadow-2xl shadow-navy-950/50">

          {/* left — count + price */}
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-[11px] font-black text-white">
              {itemCount}
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Basket</p>
              <p className="text-sm font-black text-white">{formatPrice(subtotal)}</p>
            </div>
          </div>

          {/* right — single CTA */}
          <Link
            to="/checkout"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[11px] font-black uppercase tracking-widest text-navy-900 transition-all hover:bg-cream active:scale-95"
          >
            View Basket
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
