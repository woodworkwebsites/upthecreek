import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'utc_admin_token';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

function notifySubscribers() {
  listeners.forEach((listener) => listener());
}

function setAdminToken(token: string) {
  sessionStorage.setItem(STORAGE_KEY, token);
  notifySubscribers();
}

function clearAdminToken() {
  sessionStorage.removeItem(STORAGE_KEY);
  notifySubscribers();
}

export function useAdminToken(): {
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
} {
  const token = useSyncExternalStore(subscribe, getSnapshot, () => null);

  return {
    token,
    setToken: setAdminToken,
    clearToken: clearAdminToken,
  };
}
