import type { R2Bucket } from '@cloudflare/workers-types';

export type AssetKind = 'product-image' | 'size-guide';

export interface StoredAsset {
  key: string;
  url: string;
}

export async function storeRemoteAsset(
  bucket: R2Bucket,
  siteUrl: string,
  sourceUrl: string,
  options: {
    kind: AssetKind;
    keyPrefix: string;
    keySeed: string;
    metadata?: Record<string, string>;
  },
): Promise<StoredAsset> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset ${sourceUrl}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
  const body = await response.arrayBuffer();
  const ext = extensionFromContentType(contentType, sourceUrl);
  const key = `${options.keyPrefix}/${await stableHash(`${options.keySeed}|${sourceUrl}`)}.${ext}`;

  await bucket.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: {
      kind: options.kind,
      sourceUrl,
      ...options.metadata,
    },
  });

  return {
    key,
    url: buildAssetUrl(siteUrl, key),
  };
}

export async function storeAssetData(
  bucket: R2Bucket,
  siteUrl: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
  options: {
    kind: AssetKind;
    keyPrefix: string;
    keySeed: string;
    sourceHint?: string;
    metadata?: Record<string, string>;
  },
): Promise<StoredAsset> {
  const ext = extensionFromContentType(contentType, options.sourceHint ?? 'image');
  const key = `${options.keyPrefix}/${await stableHash(options.keySeed)}.${ext}`;

  await bucket.put(key, body, {
    httpMetadata: { contentType },
    customMetadata: {
      kind: options.kind,
      ...options.metadata,
    },
  });

  return {
    key,
    url: buildAssetUrl(siteUrl, key),
  };
}

export function buildAssetUrl(siteUrl: string, key: string): string {
  return `${new URL(siteUrl).origin}/api/images/${encodeURIComponent(key)}`;
}

export async function serveAsset(bucket: R2Bucket, key: string): Promise<Response> {
  const object = await bucket.get(key);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

function extensionFromContentType(contentType: string, sourceUrl: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';

  const urlExt = sourceUrl.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (urlExt && urlExt.length <= 5) return urlExt;

  return 'img';
}

async function stableHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24);
}
