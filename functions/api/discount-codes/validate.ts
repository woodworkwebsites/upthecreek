import type { Env } from '../../../../types/env.js';
import type { DiscountCodePreview } from '../../../../types/index.js';
import { getDiscountCodeByCode } from '../../../server/discount-codes/repository.js';

interface ValidateRequest {
  code?: string;
  subtotal?: number;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: ValidateRequest;
  try {
    body = await context.request.json() as ValidateRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const code = body.code?.trim();
  const subtotal = typeof body.subtotal === 'number' ? Math.max(0, Math.round(body.subtotal)) : NaN;

  if (!code) {
    return json({ discount: null });
  }
  if (!Number.isFinite(subtotal)) {
    return json({ error: 'subtotal must be a number' }, 400);
  }

  const discountCode = await getDiscountCodeByCode(context.env.DB, code);
  if (!discountCode) {
    return json({ discount: null });
  }
  if (!discountCode.active) {
    return json({ discount: null });
  }
  if (discountCode.expiresAt && new Date(discountCode.expiresAt).getTime() <= Date.now()) {
    return json({ discount: null });
  }
  if (discountCode.usageLimit !== null && discountCode.usageCount >= discountCode.usageLimit) {
    return json({ discount: null });
  }

  const rawAmount =
    discountCode.kind === 'percent'
      ? Math.round((subtotal * discountCode.value) / 100)
      : discountCode.value;
  const amount = Math.min(Math.max(0, rawAmount), subtotal);
  const total = Math.max(0, subtotal - amount);

  const discount: DiscountCodePreview = {
    id: discountCode.id,
    code: discountCode.code,
    kind: discountCode.kind,
    value: discountCode.value,
    amount,
    subtotal,
    total,
  };

  return json({ discount });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
