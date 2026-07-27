import { useState, useEffect } from 'react';
import type { Product } from '../../types/index.js';
import { fetchProducts } from '../lib/api.js';

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
}

export function useProducts(channel: 'storefront' | 'partner' = 'storefront'): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchProducts(channel)
      .then((data) => {
        if (!cancelled) {
          setProducts(data);
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
  }, [channel]);

  return { products, loading, error };
}
