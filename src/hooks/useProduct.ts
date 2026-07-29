import { useState, useEffect } from 'react';
import type { Product } from '../../types/index.js';
import { fetchProduct } from '../lib/api.js';

interface UseProductResult {
  product: Product | null;
  loading: boolean;
  error: string | null;
}

export function useProduct(
  id: string | undefined,
  channel: 'storefront' | 'partner' | 'collabs' = 'storefront',
): UseProductResult {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProduct(id, channel)
      .then((data) => {
        if (!cancelled) {
          setProduct(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [channel, id]);

  return { product, loading, error };
}
