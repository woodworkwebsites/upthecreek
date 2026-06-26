import { useState, useCallback } from 'react';

const STORAGE_KEY = 'utc_admin_token';

export function useAdminToken(): {
  token: string | null;
  setToken: (t: string) => void;
  clearToken: () => void;
} {
  const [token, setTokenState] = useState<string | null>(
    () => sessionStorage.getItem(STORAGE_KEY),
  );

  const setToken = useCallback((t: string) => {
    sessionStorage.setItem(STORAGE_KEY, t);
    setTokenState(t);
  }, []);

  const clearToken = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setTokenState(null);
  }, []);

  return { token, setToken, clearToken };
}
