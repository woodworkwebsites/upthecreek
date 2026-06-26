import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BasketItem, CheckoutItem } from '../../types/index.js';

const STORAGE_KEY = 'up-the-creek-basket';

interface AddToBasketInput {
  printifyId: string;
  variantId: number;
  quantity: number;
  title: string;
  color: string;
  size: string;
  unitPrice: number;
  imageSrc: string;
}

interface BasketContextValue {
  items: BasketItem[];
  itemCount: number;
  addToBasket: (item: AddToBasketInput) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromBasket: (id: string) => void;
  clearBasket: () => void;
  toCheckoutItems: () => CheckoutItem[];
}

const BasketContext = createContext<BasketContextValue | undefined>(undefined);

function basketItemId(printifyId: string, variantId: number): string {
  return `${printifyId}:${variantId}`;
}

function normalizeQuantity(quantity: number): number {
  return Math.max(1, Math.min(10, quantity));
}

export function BasketProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BasketItem[];
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore malformed storage and start clean.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const value = useMemo<BasketContextValue>(() => {
    const addToBasket = (input: AddToBasketInput) => {
      const id = basketItemId(input.printifyId, input.variantId);
      const qty = normalizeQuantity(input.quantity);

      setItems((current) => {
        const existing = current.find((item) => item.id === id);
        if (existing) {
          return current.map((item) =>
            item.id === id
              ? { ...item, quantity: normalizeQuantity(item.quantity + qty) }
              : item,
          );
        }

        return [
          ...current,
          {
            id,
            printifyId: input.printifyId,
            variantId: input.variantId,
            quantity: qty,
            title: input.title,
            color: input.color,
            size: input.size,
            unitPrice: input.unitPrice,
            imageSrc: input.imageSrc,
          },
        ];
      });
    };

    const updateQuantity = (id: string, quantity: number) => {
      const qty = normalizeQuantity(quantity);
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, quantity: qty } : item)),
      );
    };

    const removeFromBasket = (id: string) => {
      setItems((current) => current.filter((item) => item.id !== id));
    };

    const clearBasket = () => setItems([]);

    const toCheckoutItems = () => items.map(({ printifyId, variantId, quantity }) => ({
      printifyId,
      variantId,
      quantity,
    }));

    return {
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      addToBasket,
      updateQuantity,
      removeFromBasket,
      clearBasket,
      toCheckoutItems,
    };
  }, [items]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket() {
  const context = useContext(BasketContext);
  if (!context) {
    throw new Error('useBasket must be used within a BasketProvider');
  }
  return context;
}
