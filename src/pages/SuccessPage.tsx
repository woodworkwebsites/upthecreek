import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useBasket } from '../context/BasketContext.js';
import type { Order } from '../../types/index.js';
import { formatPrice } from '../lib/utils.js';

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [visible, setVisible] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const { clearBasket } = useBasket();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (sessionId) {
      clearBasket();
    }
  }, [sessionId, clearBasket]);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    setOrderLoading(true);
    setOrderError(null);

    window.fetch(`/api/orders/${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<{ order: Order }>;
      })
      .then((data) => {
        if (!cancelled) {
          setOrder(data.order);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setOrderError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOrderLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-cream flex flex-col">

      {/* header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center">
          <Link to="/">
            <img
              src="/UTC-Apparel-Black.png"
              alt="Up the Creek Padel"
              className="h-9 w-auto object-contain"
            />
            </Link>
          </div>
        </div>
      </header>

      {/* content */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div
          className={`max-w-md w-full text-center transition-all duration-500 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* check circle */}
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-brand-500/10">
            <svg
              className="h-12 w-12 text-brand-500"
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

          <p className="label mb-3">Order Confirmed</p>
          <h1 className="text-4xl font-black text-navy-800 tracking-tight">
            You're all set.
          </h1>
          <p className="mt-4 text-gray-500 leading-relaxed">
            Thanks for your order — we're preparing it for printing and will send a shipping confirmation once it's on its way.
          </p>

          {sessionId && (
            <p className="mt-5 rounded-xl bg-white border border-gray-100 px-4 py-3 text-xs text-gray-400 font-mono shadow-sm">
              Ref: {sessionId}
            </p>
          )}

          {orderLoading && (
            <p className="mt-6 text-sm text-gray-400">Loading order details...</p>
          )}

          {!orderLoading && order?.items && order.items.length > 0 && (
            <div className="mt-8 space-y-3 text-left">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Items ordered</h2>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                    <div className="h-20 w-16 overflow-hidden rounded-xl bg-gray-50 ring-1 ring-black/5">
                      {item.imageSrc ? (
                        <img
                          src={item.imageSrc}
                          alt={item.title}
                          className="h-full w-full object-contain object-center"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-300">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-navy-800">{item.title}</p>
                      <p className="text-xs text-gray-400">{item.color} · {item.size}</p>
                      <p className="mt-1 text-xs font-semibold text-navy-800">
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orderError && (
            <p className="mt-6 text-sm font-semibold text-red-600">{orderError}</p>
          )}

          <div className="mt-10 space-y-3">
            <Link
              to="/"
              className="block rounded-full bg-navy-800 px-8 py-4 text-sm font-black tracking-widest uppercase text-white hover:bg-navy-700 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-navy-900/20"
            >
              Continue Shopping
            </Link>
          </div>

          <p className="mt-8 text-xs text-gray-400">
            Questions? We're a social club — drop us a message, we're friendly.
          </p>
        </div>
      </div>

      {/* footer */}
      <footer className="bg-navy-800 py-6 flex flex-col items-center gap-1">
        <a href="mailto:hello@upthecreekpadel.club" className="text-[11px] text-white/30 hover:text-white/60">
          hello@upthecreekpadel.club
        </a>
        <p className="text-center text-[11px] text-white/20">
          © {new Date().getFullYear()} Up the Creek Padel &amp; Social Club
        </p>
      </footer>

    </div>
  );
}
