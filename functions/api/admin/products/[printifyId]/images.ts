import type { Env } from '../../../../../types/env.js';
import { handleDeleteProductImage, handleUploadProductImage } from '../../../../../server/admin/handlers.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const printifyId = context.params.printifyId as string;
  return handleUploadProductImage(context.env, printifyId, context.request);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const printifyId = context.params.printifyId as string;
  return handleDeleteProductImage(context.env, printifyId, context.request);
};
