import { createHmac, timingSafeEqual } from 'node:crypto';
export const COOKIE_NAME='ses_session';
export const SESSION_SECONDS=7*24*60*60;
export function configured(){return (process.env.SITE_PASSWORD?.length??0)>=12&&(process.env.SESSION_SECRET?.length??0)>=32;}
function signature(value:string){if(!configured())throw new Error('Configure SITE_PASSWORD e SESSION_SECRET.');return createHmac('sha256',process.env.SESSION_SECRET!+':'+process.env.SITE_PASSWORD!).update(value).digest('base64url');}
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function passwordMatches(password:string){return configured()&&equal(createHmac('sha256',process.env.SESSION_SECRET!).update(password).digest('hex'),createHmac('sha256',process.env.SESSION_SECRET!).update(process.env.SITE_PASSWORD!).digest('hex'));}
export function createSession(now=Date.now()){const payload=Buffer.from(JSON.stringify({user:'owner',expires:now+SESSION_SECONDS*1000})).toString('base64url');return payload+'.'+signature(payload);}
export function sessionUser(token:string|undefined,now=Date.now()){
 if(!configured()||!token||token.length>1000)return null;
 try{const parts=token.split('.');if(parts.length!==2||!equal(signature(parts[0]),parts[1]))return null;const data=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));return data.user==='owner'&&typeof data.expires==='number'&&data.expires>now&&data.expires<=now+SESSION_SECONDS*1000+1000?'owner':null;}catch{return null;}
}
export async function authenticatedUser(req:Request){const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE_NAME+'='))?.slice(COOKIE_NAME.length+1);return sessionUser(token);}
export function sameOrigin(req:Request){try{const origin=new URL(req.headers.get('origin')??'');const url=new URL(req.url);const host=req.headers.get('host')??url.host;const protocol=req.headers.get('x-forwarded-proto')?.split(',')[0].trim()??url.protocol.slice(0,-1);return origin.host===host&&origin.protocol===protocol+':';}catch{return false;}}
