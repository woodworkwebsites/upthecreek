import type { Env } from '../../types/env.js';
import type { Order } from '../../types/index.js';

const sender = 'orders@upthecreekpadel.club';
const callbackPath = '/api/google/callback';
const enc = new TextEncoder();

async function key(env: Env): Promise<CryptoKey> {
  if (!env.GOOGLE_CLIENT_SECRET) throw new Error('Google client secret missing');
  const material = await crypto.subtle.digest('SHA-256', enc.encode(env.GOOGLE_CLIENT_SECRET));
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt','decrypt']);
}
async function encrypt(env: Env, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),enc.encode(value));
  return JSON.stringify({iv:Array.from(iv),cipher:Array.from(new Uint8Array(bytes))});
}
async function decrypt(env: Env, stored: string): Promise<string> {
  const data = JSON.parse(stored) as {iv:number[];cipher:number[]};
  const bytes = await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(data.iv)},await key(env),new Uint8Array(data.cipher));
  return new TextDecoder().decode(bytes);
}
export async function ensureEmailTables(env: Env): Promise<void> {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS google_mail_auth (id INTEGER PRIMARY KEY CHECK(id=1), encrypted_token TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS google_oauth_states (state TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS order_confirmation_emails (order_id TEXT PRIMARY KEY, status TEXT NOT NULL, sent_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS order_dispatch_emails (order_id TEXT PRIMARY KEY, status TEXT NOT NULL, sent_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)').run();
}
export async function mailConnected(env: Env): Promise<boolean> {
  await ensureEmailTables(env);
  return !!(await env.DB.prepare('SELECT id FROM google_mail_auth WHERE id=1').first());
}
export async function startGoogleAuth(env: Env, origin: string): Promise<string> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new Error('Google OAuth credentials are not configured');
  await ensureEmailTables(env);
  const state=crypto.randomUUID()+crypto.randomUUID();
  await env.DB.prepare('DELETE FROM google_oauth_states WHERE expires_at < ?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO google_oauth_states(state,expires_at) VALUES (?,?)').bind(state,Date.now()+600000).run();
  const q=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:origin+callbackPath,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',state,login_hint:'ash@woodworkproductions.co.uk'});
  return 'https://accounts.google.com/o/oauth2/v2/auth?'+q.toString();
}
export async function completeGoogleAuth(env: Env, origin: string, state: string, code: string): Promise<void> {
  await ensureEmailTables(env);
  const result=await env.DB.prepare('DELETE FROM google_oauth_states WHERE state=? AND expires_at>?').bind(state,Date.now()).run();
  if (result.meta.changes!==1) throw new Error('Expired or invalid authorisation. Start again in UTC Settings.');
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,code,grant_type:'authorization_code',redirect_uri:origin+callbackPath})});
  const data=await res.json() as {refresh_token?:string;error?:string};
  if (!res.ok || !data.refresh_token) throw new Error('Google did not return a refresh token. Please reconnect with consent.');
  await env.DB.prepare('INSERT INTO google_mail_auth(id,encrypted_token) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET encrypted_token=excluded.encrypted_token,updated_at=CURRENT_TIMESTAMP').bind(await encrypt(env,data.refresh_token)).run();
}
function mimeBase64(value:string):string {
  const bytes=enc.encode(value);
  let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function safe(v:string):string {return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));}
export const DEFAULT_CONFIRMATION_SUBJECT = 'Thanks for your order | Up The Creek Padel';
export const DEFAULT_CONFIRMATION_BODY = "Hi {{first_name}},\n\nThanks for choosing Up The Creek Padel.\n\nWe've placed your order and everything is now being prepared.\n\nWe'll be in touch when your order is on its way.\n\nOrder reference: {{order_reference}}\n\nYour order:\n{{items}}\n\nThanks again for supporting UTC.\n\nUp The Creek Padel\npadel apparel\nupthecreekpadel.club";

export const DEFAULT_DISPATCH_SUBJECT = 'Your order is on its way | Up The Creek Padel';
export const DEFAULT_DISPATCH_BODY = "Hi {{first_name}},\n\nGood news — your Up The Creek Padel order has been dispatched.\n\nOrder reference: {{order_reference}}\n\nYour order:\n{{items}}\n\nThanks again for choosing UTC.\n\nUp The Creek Padel\npadel apparel\nupthecreekpadel.club";

export type OrderEmailKind = 'confirmation' | 'dispatch';
export async function renderGoogleOrderConfirmation(env: Env, order: Order, kind: OrderEmailKind = 'confirmation'): Promise<{subject:string;html:string;text:string}> {
  const {getSetting}=await import('../settings/repository.js');
  const subjectTemplate=(await getSetting(env.DB,kind === 'dispatch' ? 'dispatch_email_subject' : 'confirmation_email_subject')) || (kind === 'dispatch' ? DEFAULT_DISPATCH_SUBJECT : DEFAULT_CONFIRMATION_SUBJECT);
  const bodyTemplate=(await getSetting(env.DB,kind === 'dispatch' ? 'dispatch_email_body' : 'confirmation_email_body')) || (kind === 'dispatch' ? DEFAULT_DISPATCH_BODY : DEFAULT_CONFIRMATION_BODY);
  const variables: Record<string,string>={
    first_name: (order.customerName || order.shippingName || '').trim().split(/\s+/)[0] || 'there',
    order_reference: order.id.slice(0,8).toUpperCase(),
    items: (order.items || []).map(i => i.quantity+' × '+i.title+' ('+i.color+', '+i.size+')'+(i.personalization ? ' — Personalisation: '+i.personalization : '')).join('\n'),
  };
  const expand=(s:string)=>s.replace(/\{\{(first_name|order_reference|items)\}\}/g,(_m,key:string)=>variables[key] || '');
  const subject=expand(subjectTemplate).replace(/[\r\n]+/g,' ').trim();
  const text=expand(bodyTemplate);
  const wordmark='https://upthecreekpadel.club/Wordmark_White.png';
  const logo='https://upthecreekpadel.club/UTC_Logo_White_Trans_BG.png';
  const html='<div style="margin:0;padding:32px 16px;background:#f4f4f1;font-family:Arial,Helvetica,sans-serif;color:#222"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e6e6e1">'
  +'<div style="background:#202527;padding:26px 28px;text-align:center"><img src="'+wordmark+'" alt="Up The Creek Padel" width="320" style="display:block;width:100%;max-width:320px;height:auto;margin:0 auto;border:0"></div>'
  +'<div style="padding:30px 28px 34px"><div style="font-size:16px;line-height:1.7;white-space:pre-wrap;color:#222">'+safe(text)+'</div></div>'
  +'<div style="background:#d7f23b;height:6px"></div></div></div>';
  return {subject,html,text};
}

export async function sendGoogleOrderConfirmation(env:Env, order:Order, recipient?:string, kind: OrderEmailKind = 'confirmation'):Promise<void> {
  await ensureEmailTables(env);
  const saved=await env.DB.prepare('SELECT encrypted_token FROM google_mail_auth WHERE id=1').first<{encrypted_token:string}>();
  if(!saved) throw new Error('Connect Google Workspace in Admin Settings first');
  const to=(recipient || order.customerEmail).trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to) || /[\r\n]/.test(to)) throw new Error('Invalid recipient email address');
  const {html, text:message, subject}=await renderGoogleOrderConfirmation(env,order,kind);
  const refresh=await decrypt(env,saved.encrypted_token);
  const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,refresh_token:refresh,grant_type:'refresh_token'})});
  const token=await tokenRes.json() as {access_token?:string};
  if(!tokenRes.ok || !token.access_token) throw new Error('Google authorisation expired. Reconnect in Settings.');
  const boundary='utc-'+crypto.randomUUID();
  const mime=['From: Up The Creek Padel <'+sender+'>','To: '+to,'Reply-To: '+sender,'Subject: '+subject,'MIME-Version: 1.0','Content-Type: multipart/alternative; boundary="'+boundary+'"','','--'+boundary,'Content-Type: text/plain; charset=UTF-8','',''+message,'--'+boundary,'Content-Type: text/html; charset=UTF-8','',html,'--'+boundary+'--'].join('\r\n');
  const res=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({raw:mimeBase64(mime)})});
  if(!res.ok) throw new Error('Gmail rejected the message ('+res.status+'). Confirm the Orders sending alias in Gmail.');
}
