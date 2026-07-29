import type { Env } from '../types/env.js';
import { serveSpaShell } from './_spa.js';

export const onRequestGet: PagesFunction<Env> = async (context) => serveSpaShell(context.request, context.env);
export const onRequestHead: PagesFunction<Env> = async (context) => serveSpaShell(context.request, context.env);
