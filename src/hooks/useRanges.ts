import { useEffect, useState } from 'react';
import type { CatalogRange } from '../../types/index.js';
import { fetchRanges } from '../lib/api.js';

interface UseRangesResult {
  ranges: CatalogRange[];
  loading: boolean;
  error: string | null;
}

export function useRanges(channel: 'storefront' | 'partner' = 'storefront'): UseRangesResult {
  const [ranges, setRanges] = useState<CatalogRange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchRanges(channel)
      .then((data) => {
        if (!cancelled) {
          setRanges(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [channel]);

  return { ranges, loading, error };
}
