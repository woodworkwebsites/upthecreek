import type { Env } from '../../../types/env.js';
import {
  handleCreateRange,
  handleListRanges,
} from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleListRanges(context.env);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleCreateRange(context.env, context.request);
};
