import type { Env } from '../../../../../types/env.js';
import { ensureEmailTables, sendGoogleOrderConfirmation, renderGoogleOrderConfirmation } from '../../../../../server/notifications/google.js';
import { getOrderWithItems } from '../../../../../server/orders/repository.js';

export const onRequestGet: PagesFunction<Env> = async ({env,params}) => {
 const order=await getOrderWithItems(env.DB,String(params.id));
 if(!order)return Response.json({error:'Order not found'},{status:404});
 const content=await renderGoogleOrderConfirmation(env,order);
 await ensureEmailTables(env);
 const sent=await env.DB.prepare("SELECT status,sent_at FROM order_confirmation_emails WHERE order_id=?").bind(order.id).first<{status:string;sent_at:string|null}>();
 return Response.json({...content,recipient:order.customerEmail,from:'orders@upthecreekpadel.club',sentAt:sent?.sent_at??null});
};

export const onRequestPost: PagesFunction<Env> = async ({ env, params, request }) => {
  const id = String(params.id);
  await ensureEmailTables(env);
  const order = await getOrderWithItems(env.DB, id);
  if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (!['ordered_sellshirts', 'dispatched', 'delivered'].includes(order.status)) return Response.json({ error: 'Order must be paid and awaiting supplier processing before confirmation' }, { status: 409 });
  const existing = await env.DB.prepare('SELECT status, sent_at FROM order_confirmation_emails WHERE order_id=?').bind(id).first<{status:string;sent_at:string|null}>();
  const input=await request.json().catch(()=>({})) as {recipient?:string};
  const recipient=(input.recipient || order.customerEmail).trim();
  const isTest=recipient.toLowerCase()!==order.customerEmail.toLowerCase();
  if (existing && !isTest) return Response.json({ error: 'Order confirmation already sent or in progress' }, { status: 409 });
  const claim = isTest ? null : await env.DB.prepare("INSERT OR IGNORE INTO order_confirmation_emails(order_id,status) VALUES(?,'sending')").bind(id).run();
  if (!isTest && claim?.meta.changes !== 1) return Response.json({ error: 'Order confirmation already in progress' }, { status: 409 });
  try {
    await sendGoogleOrderConfirmation(env, order, recipient);
    if(!isTest) await env.DB.prepare("UPDATE order_confirmation_emails SET status='sent', sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE order_id=?").bind(id).run();
    return Response.json({ sent: true });
  } catch (error) {
    if(!isTest) await env.DB.prepare("DELETE FROM order_confirmation_emails WHERE order_id=? AND status='sending'").bind(id).run();
    return Response.json({ error: error instanceof Error ? error.message : 'Email could not be sent' }, { status: 502 });
  }
};
