import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useBasket } from '../context/BasketContext.js';
import { createCheckout, validateDiscountCode } from '../lib/api.js';
import { formatPrice } from '../lib/utils.js';

export default function BasketPage() {
  const { items, updateQuantity, removeFromBasket, toCheckoutItems, itemCount } = useBasket();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState('');
  const [discountPreview, setDiscountPreview] = useState<{
    code: string;
    amount: number;
    total: number;
  } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const validationSeq = useRef(0);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = discountPreview?.total ?? subtotal;

  useEffect(() => {
    const code = discountCode.trim();
    const seq = ++validationSeq.current;

    if (!code) {
      setDiscountPreview(null);
      setDiscountError(null);
      setDiscountLoading(false);
      return;
    }

    setDiscountLoading(true);
    const timer = window.setTimeout(() => {
      void validateDiscountCode(code, subtotal)
        .then((discount) => {
          if (validationSeq.current !== seq) return;
          if (!discount) {
            setDiscountPreview(null);
            setDiscountError('Invalid voucher code');
            return;
          }

          setDiscountPreview({
            code: discount.code,
            amount: discount.amount,
            total: discount.total,
          });
          setDiscountError(null);
        })
        .catch((err) => {
          if (validationSeq.current !== seq) return;
          setDiscountPreview(null);
          setDiscountError(err instanceof Error ? err.message : 'Could not validate voucher code');
        })
        .finally(() => {
          if (validationSeq.current === seq) {
            setDiscountLoading(false);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [discountCode, subtotal]);

  async function handleCheckout() {
    if (items.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      const code = discountCode.trim();
      if (code) {
        const discount = await validateDiscountCode(code, subtotal);
        if (!discount) {
          setDiscountPreview(null);
          setDiscountError('Invalid voucher code');
          setLoading(false);
          return;
        }
        setDiscountPreview({
          code: discount.code,
          amount: discount.amount,
          total: discount.total,
        });
        setDiscountError(null);
      }
      const { url } = await createCheckout(toCheckoutItems(), discountCode);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">

      {/* header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center">
            <img
              src="/UTC_WORDMARK_BLACK_TRANS.png"
              alt="Up the Creek Padel"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <Link
            to="/"
            className="text-xs font-bold tracking-widest uppercase text-gray-400 hover:text-navy-800 transition-colors"
          >
            ← Shop
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">

        <h1 className="text-3xl sm:text-4xl font-black text-navy-800 tracking-tight mb-8">
          Your Basket
          {itemCount > 0 && (
            <span className="ml-3 text-base font-semibold text-gray-400">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
          )}
        </h1>

        {items.length === 0 ? (

          /* ── empty state ── */
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-white py-20 text-center shadow-sm ring-1 ring-black/5">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-7 w-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-black text-navy-800">Nothing here yet</p>
              <p className="mt-1 text-sm text-gray-400">Add something from the collection.</p>
            </div>
            <Link
              to="/#collection"
              className="inline-flex items-center gap-2 rounded-full bg-navy-800 px-7 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-navy-700 transition-colors"
            >
              Browse the collection
            </Link>
          </div>

        ) : (

          /* ── basket + summary ── */
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

            {/* items */}
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                  {item.imageSrc && (
                    <img
                      src={item.imageSrc}
                      alt={item.title}
                      className="h-24 w-[66px] flex-shrink-0 rounded-xl object-cover object-top"
                    />
                  )}
                  <div className="min-w-0 flex-1">

                    {/* title + remove */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-navy-800 leading-snug">{item.title}</p>
                        <p className="mt-0.5 text-sm text-gray-400">{item.color} · {item.size}</p>
                      </div>
                      <button
                        onClick={() => removeFromBasket(item.id)}
                        aria-label="Remove item"
                        className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* price + qty */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-full border border-gray-200 text-sm">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center font-bold text-gray-500 hover:text-navy-800 transition-colors"
                          aria-label="Decrease quantity"
                        >−</button>
                        <span className="w-8 text-center font-black text-navy-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center font-bold text-gray-500 hover:text-navy-800 transition-colors"
                          aria-label="Increase quantity"
                        >+</button>
                      </div>
                      <p className="font-black text-navy-800">{formatPrice(item.unitPrice * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* order summary */}
            <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Order Summary</p>

              <div className="space-y-2 text-sm">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-gray-500">
                    <span className="truncate pr-2">{item.title} ×{item.quantity}</span>
                    <span className="flex-shrink-0 font-semibold">{formatPrice(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="my-4 h-px bg-gray-100" />

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Discount code</span>
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="Enter code"
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-navy-800 outline-none transition-colors placeholder:text-gray-300 focus:border-navy-800"
                />
              </label>

              <p className="mt-2 text-[11px] text-gray-400">
                {discountLoading
                  ? 'Validating voucher code...'
                  : discountPreview
                    ? `Voucher applied: -${formatPrice(discountPreview.amount)}`
                    : 'Enter a voucher code to update the total before checkout.'}
              </p>

              {discountError && !discountLoading && (
                <p className="mt-2 text-xs font-semibold text-red-600">{discountError}</p>
              )}

              {discountPreview && (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span className="font-semibold">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>{discountPreview.code}</span>
                    <span className="font-semibold">-{formatPrice(discountPreview.amount)}</span>
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-between text-base font-black text-navy-800">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>

              {error && (
                <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>
              )}

              <button
                onClick={handleCheckout}
                disabled={loading || items.length === 0}
                className="mt-5 w-full rounded-full bg-navy-800 py-3.5 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-navy-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-navy-900/20"
              >
                {loading ? 'Redirecting…' : 'Proceed to Checkout'}
              </button>

              <Link
                to="/#collection"
                className="mt-3 block text-center text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-navy-800 transition-colors"
              >
                Continue shopping
              </Link>
            </aside>

          </div>
        )}
      </main>
    </div>
  );
}
