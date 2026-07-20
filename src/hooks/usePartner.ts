import { useCallback, useState } from 'react';
import type { Partner } from '../../types/index.js';

const STORAGE_KEY = 'utc_partner_session';

export interface PartnerSession {
  slug: string;
  accessToken: string;
  partner: Partner;
}

export function usePartnerSession(): {
  session: PartnerSession | null;
  setSession: (session: PartnerSession) => void;
  clearSession: () => void;
} {
  const [session, setSessionState] = useState<PartnerSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as PartnerSession : null;
    } catch {
      return null;
    }
  });

  const setSession = useCallback((next: PartnerSession) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSessionState(next);
  }, []);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSessionState(null);
  }, []);

  return { session, setSession, clearSession };
}
