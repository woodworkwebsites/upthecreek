import type { D1Database } from '@cloudflare/workers-types';
import type { Product } from '../../types/index.js';
import { buildCollaborationProducts, parseCollaborationProductId } from '../../src/lib/collaborations.js';
import { getPartnerById, listPartners } from '../partners/repository.js';

export async function getCollaborationProducts(db: D1Database): Promise<Product[]> {
  const partners = await listPartners(db);
  return partners
    .filter((partner) => partner.active && partner.collaborationEnabled)
    .flatMap((partner) => buildCollaborationProducts(partner));
}

export async function getCollaborationProductById(db: D1Database, id: string): Promise<Product | null> {
  const parsed = parseCollaborationProductId(id);
  if (!parsed) return null;

  const partner = await getPartnerById(db, parsed.partnerId);
  if (!partner || !partner.active || !partner.collaborationEnabled) return null;

  return buildCollaborationProducts(partner).find((product) => product.id === id) ?? null;
}
