import type { Env } from '../../../../../types/env.js';
import { handleBulkUploadProductImages, handleDeleteProductImage, handleUpdateProductImage, handleUploadProductImage } from '../../../../../server/admin/handlers.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const printifyId = context.params.printifyId as string;
  if (new URL(context.request.url).searchParams.get('bulk') === '1') {
    return handleBulkUploadProductImages(context.env, printifyId, context.request);
  }
  return handleUploadProductImage(context.env, printifyId, context.request);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const printifyId = context.params.printifyId as string;
  return handleDeleteProductImage(context.env, printifyId, context.request);
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const printifyId = context.params.printifyId as string;
  return handleUpdateProductImage(context.env, printifyId, context.request);
};
