const DEFAULT_VAT_RATE = 0.2;
const DEFAULT_COMMISSION_RATE = 0.1;

export function excludeVat(amount: number, vatRate = DEFAULT_VAT_RATE): number {
  if (!Number.isFinite(amount)) return 0;
  return amount / (1 + vatRate);
}

export function vatAmount(amount: number, vatRate = DEFAULT_VAT_RATE): number {
  if (!Number.isFinite(amount)) return 0;
  return amount * vatRate;
}

export function calculateNetProfitFromRrp(
  rrp: number,
  wholesalePrice: number,
  vatRate = DEFAULT_VAT_RATE,
): number {
  if (!Number.isFinite(rrp) || !Number.isFinite(wholesalePrice)) return 0;
  return rrp - wholesalePrice - vatAmount(rrp, vatRate);
}

export function calculateCommissionFromGross(
  grossAmount: number,
  commissionRate = DEFAULT_COMMISSION_RATE,
  vatRate = DEFAULT_VAT_RATE,
): number {
  if (!Number.isFinite(grossAmount)) return 0;
  return excludeVat(grossAmount, vatRate) * commissionRate;
}
