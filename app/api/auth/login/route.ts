import { createHash } from 'node:crypto';
import { configured, passwordMatches, createSession, COOKIE_NAME, SESSION_SECONDS, sameOrigin } from '../../../../lib/auth';
import { getRawDb } from '../../../../db/index';
export const runtime='nodejs';
export async function POST(req:Request){
 if(!sameOrigin(req))return new Response('Origem não autorizada.',{status:403});
 if(!configured())return new Response('Configure a senha e o segredo de sessão.',{status:503});
 const url=new URL(req.headers.get('origin')!);const redirect=(error:string)=>Response.redirect(new URL('/login?error='+error,url),303);
 if(Number(req.headers.get('content-length')??0)>4096)return new Response('Pedido muito grande.',{status:413});
 try{
  const form=await req.formData();const password=form.get('password');if(typeof password!=='string'||password.length>256)return redirect('invalid');
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0].trim()??'unknown';
  const key=createHash('sha256').update(ip).digest('hex'),now=Date.now();const db=getRawDb();
  const limit=await db.prepare('INSERT INTO login_limits (key,attempts,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.reset_at<=? THEN 1 ELSE login_limits.attempts+1 END, reset_at=CASE WHEN login_limits.reset_at<=? THEN excluded.reset_at ELSE login_limits.reset_at END RETURNING attempts').bind(key,now+15*60*1000,now,now).first<{attempts:number}>();
  if(!limit||limit.attempts>30)return redirect('limit');
  if(!passwordMatches(password))return redirect('invalid');
  await db.prepare('DELETE FROM login_limits WHERE key = ?').bind(key).run();
  const response=new Response(null,{status:303,headers:{Location:new URL('/',url).href}});
  response.headers.set('Set-Cookie',`${COOKIE_NAME}=${createSession()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${url.protocol==='https:'?'; Secure':''}`);
  response.headers.set('Cache-Control','no-store');return response;
 }catch(e){console.error('login failed',e);return redirect('service');}
}
