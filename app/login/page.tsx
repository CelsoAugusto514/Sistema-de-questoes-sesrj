import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, configured, sessionUser } from '../../lib/auth';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 if(sessionUser((await cookies()).get(COOKIE_NAME)?.value))redirect('/');
 const query=await searchParams;
 return <main className="login-layout"><section className="panel login-panel"><p className="eyebrow">SES/RJ · ACESSO PRIVADO</p><h1>Sua sala de estudo</h1><p>Digite a senha para acessar suas questões e seu progresso.</p>{!configured()?<p role="alert">O responsável precisa configurar SITE_PASSWORD e SESSION_SECRET na hospedagem.</p>:<form action="/api/auth/login" method="post"><label className="field-label" htmlFor="password">Senha</label><input className="login-password" id="password" name="password" type="password" required maxLength={256} autoComplete="current-password"/>{query.error&&<p role="alert" className="bad-text">{query.error==='limit'?'Muitas tentativas. Aguarde 15 minutos.':query.error==='service'?'Confira o banco de dados e tente novamente.':'Senha incorreta. Tente novamente.'}</p>}<button type="submit" className="btn primary full">Entrar</button></form>}</section></main>;
}
