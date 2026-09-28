import type { Env } from '../../../types/env.js';
import { recoverCatalogueImages } from '../../../server/catalogue/recovery.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = await context.request.json().catch(() => ({})) as { apply?: boolean; ref?: string };
    const report = await recoverCatalogueImages(context.env, body.apply === true, body.ref?.trim() || undefined);
    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Catalogue recovery failed' }, { status: 500 });
  }
};
