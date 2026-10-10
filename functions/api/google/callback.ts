import type { Env } from '../../../types/env.js';
import { completeGoogleAuth } from '../../../server/notifications/google.js';
export const onRequestGet: PagesFunction<Env> = async ({request,env})=>{
 const u=new URL(request.url);const state=u.searchParams.get('state');const code=u.searchParams.get('code');
 if(!state||!code) return new Response('Google authorisation cancelled or missing parameters',{status:400});
 try {await completeGoogleAuth(env,u.origin,state,code);return Response.redirect(u.origin+'/admin/settings?google=connected',303);}
 catch(err){return new Response(err instanceof Error?err.message:'Could not connect Gmail',{status:400});}
};
