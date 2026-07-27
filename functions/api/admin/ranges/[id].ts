import type { Env } from '../../../../types/env.js';
import {
  handleDeleteRange,
  handleUpdateRange,
} from '../../../../server/admin/handlers.js';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { id } = context.params;
  return handleUpdateRange(context.env, id, context.request);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { id } = context.params;
  return handleDeleteRange(context.env, id);
};
