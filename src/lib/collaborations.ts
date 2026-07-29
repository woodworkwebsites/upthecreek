import type { Partner, PartnerCollaborationDesign, PrintifyColor, PrintifyProductImage, PrintifyVariant, Product } from '../../types/index.js';
import { DEFAULT_SIZE_OPTIONS } from '../../types/catalog.js';

const COLLABORATION_PREFIX = 'collab';

function buildSyntheticVariantId(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const signed = hash | 0;
  return signed === 0 ? -1 : (signed > 0 ? -signed : signed);
}

function buildCollaborationVariants(
  design: PartnerCollaborationDesign,
  seedPrefix: string,
): PrintifyVariant[] {
  const sizes = design.sizes.length > 0 ? design.sizes : DEFAULT_SIZE_OPTIONS;
  const price = Math.max(0, Math.round(design.rrp));

  return sizes.map((size) => ({
    id: buildSyntheticVariantId(`${seedPrefix}:${design.colorName}:${size}`),
    color: design.colorName,
    size,
    price,
    available: true,
  }));
}

function buildCollaborationImages(
  design: PartnerCollaborationDesign,
  variantIds: number[],
): PrintifyProductImage[] {
  const imageUrls = design.imageUrls.length > 0
    ? design.imageUrls
    : design.imageUrl
      ? [design.imageUrl]
      : [];

  if (imageUrls.length === 0) {
    return [
      {
        src: '/UTC_Logo.png',
        isDefault: true,
        variantIds,
        color: design.colorName,
      },
    ];
  }

  return imageUrls.map((src, index) => ({
    src: src.trim() || '/UTC_Logo.png',
    isDefault: index === 0,
    variantIds,
    color: design.colorName,
  }));
}

function buildCollaborationColors(design: PartnerCollaborationDesign): PrintifyColor[] {
  return [{
    name: design.colorName,
    hex: design.colorHex || '#111827',
    orderUrl: design.orderUrl ?? null,
  }];
}

export function buildCollaborationProductId(partnerId: string, designIndex: number): string {
  return `${COLLABORATION_PREFIX}:${partnerId}:${designIndex}`;
}

export function parseCollaborationProductId(productId: string): { partnerId: string; designIndex: number } | null {
  const parts = productId.split(':');
  if (parts.length !== 3 || parts[0] !== COLLABORATION_PREFIX) return null;

  const partnerId = parts[1]?.trim() || '';
  const designIndex = Number.parseInt(parts[2] ?? '', 10);
  if (!partnerId || !Number.isInteger(designIndex) || designIndex < 0) return null;

  return { partnerId, designIndex };
}

export function buildCollaborationProduct(
  partner: Pick<Partner, 'id' | 'slug' | 'name' | 'createdAt' | 'updatedAt'>,
  design: PartnerCollaborationDesign,
  designIndex: number,
): Product {
  const sizes = design.sizes.length > 0 ? design.sizes : DEFAULT_SIZE_OPTIONS;
  const price = Math.max(0, Math.round(design.rrp));
  const productId = buildCollaborationProductId(partner.id, designIndex);
  const variants = buildCollaborationVariants(design, productId);
  const variantIds = variants.map((variant) => variant.id);

  return {
    id: productId,
    printifyId: productId,
    title: design.title.trim() || `${partner.name} collaboration`,
    description: design.description ?? '',
    category: 'collaboration',
    rangeId: 'collabs',
    audience: 'Collaboration',
    productType: 'Collaboration',
    garment: design.garment?.trim() || 'Collaboration Shirt',
    pricingMatrix: {
      audience: 'Collaboration',
      product: 'Collaboration',
      garment: design.garment?.trim() || 'Collaboration Shirt',
      printSurface: 'Partner collaboration',
      manufacturingCost: '',
      saleCost: '',
      deliveryRetail: '',
      deliveryPartner: '',
      deliveryOnlinePartnership: '',
      salePrice: (price / 100).toFixed(2),
      partnerPrice: (Math.max(0, Math.round(design.partnerPrice)) / 100).toFixed(2),
    },
    images: buildCollaborationImages(design, variantIds),
    variants,
    colors: buildCollaborationColors(design),
    hiddenColors: [],
    sizes,
    minPrice: price,
    maxPrice: price,
    isEnabled: true,
    sizeGuideImage: null,
    syncedAt: partner.updatedAt,
    createdAt: partner.createdAt,
    updatedAt: partner.updatedAt,
  };
}

export function buildCollaborationProducts(
  partner: Pick<Partner, 'id' | 'slug' | 'name' | 'createdAt' | 'updatedAt' | 'collaborationEnabled' | 'collaborationDesign' | 'collaborationDesigns'>,
): Product[] {
  if (!partner.collaborationEnabled) return [];

  const designs = partner.collaborationDesigns.length > 0
    ? partner.collaborationDesigns
    : partner.collaborationDesign
      ? [partner.collaborationDesign]
      : [];

  return designs.map((design, index) => buildCollaborationProduct(partner, design, index));
}
