import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=new URL('../',import.meta.url),temp=await mkdtemp(join(tmpdir(),'ses-auth-'));
const previous={password:process.env.SITE_PASSWORD,secret:process.env.SESSION_SECRET};
try{
 for(const [file,path] of [['auth.js','lib/auth.ts'],['login.js','app/api/auth/login/route.ts'],['logout.js','app/api/auth/logout/route.ts']]){
  let source=await readFile(new URL(path,root),'utf8');
  source=source.replace("from '../../../../lib/auth'","from './auth.js'").replace("import { getRawDb } from '../../../../db/index';",'const getRawDb=()=>globalThis.__loginDb;');
  await writeFile(join(temp,file),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
 }
 await writeFile(join(temp,'package.json'),'{"type":"module"}');
 process.env.SITE_PASSWORD='test-only-password-123';process.env.SESSION_SECRET='test-only-session-secret-32-characters';
 const auth=await import(pathToFileURL(join(temp,'auth.js')));
 const login=await import(pathToFileURL(join(temp,'login.js')));
 const logout=await import(pathToFileURL(join(temp,'logout.js')));
 assert.ok(auth.passwordMatches(process.env.SITE_PASSWORD));assert.ok(!auth.passwordMatches('wrong'));
 const token=auth.createSession();assert.equal(auth.sessionUser(token),'owner');
 assert.equal(auth.sessionUser(token+'x'),null);assert.equal(auth.sessionUser(undefined),null);
 assert.equal(auth.sessionUser(auth.createSession(Date.now()-8*24*60*60*1000)),null);
 assert.equal(await auth.authenticatedUser(new Request('https://test.invalid',{headers:{'oai-authenticated-user-id':'owner'}})),null);
 assert.equal(await auth.authenticatedUser(new Request('https://test.invalid',{headers:{cookie:'ses_session='+token}})),'owner');
 process.env.SITE_PASSWORD+='changed';assert.equal(auth.sessionUser(token),null);process.env.SITE_PASSWORD='test-only-password-123';
 let attempts=0;
 globalThis.__loginDb={prepare(){return {bind(){return {async first(){return {attempts:++attempts};},async run(){attempts=0;}};}};}};
 function request(password,origin='https://test.invalid'){return new Request('https://test.invalid/api/auth/login',{method:'POST',headers:{origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password})});}
 assert.equal((await login.POST(request('wrong','https://other.invalid'))).status,403);
 const wrong=await login.POST(request('wrong'));assert.ok(wrong.headers.get('location').includes('invalid'));assert.equal(wrong.headers.get('set-cookie'),null);
 const ok=await login.POST(request(process.env.SITE_PASSWORD));assert.equal(ok.status,303);assert.equal(ok.headers.get('location'),'https://test.invalid/');
 const cookie=ok.headers.get('set-cookie');assert.ok(cookie.includes('HttpOnly')&&cookie.includes('Secure')&&cookie.includes('SameSite=Strict'));
 assert.equal(await auth.authenticatedUser(new Request('https://test.invalid',{headers:{cookie:cookie.split(';')[0]}})),'owner');
 attempts=30;assert.ok((await login.POST(request('wrong'))).headers.get('location').includes('limit'));
 const {PGlite}=await import('@electric-sql/pglite');const pg=new PGlite();await pg.exec(await readFile(new URL('db/schema.sql',root),'utf8'));
 globalThis.__loginDb={prepare(sql){let index=0;sql=sql.replace(/\?/g,()=>'$'+(++index));return {bind(...params){return {async first(){return (await pg.query(sql,params)).rows[0]??null;},async run(){await pg.query(sql,params);}};}};}};
 assert.ok((await login.POST(request('wrong'))).headers.get('location').includes('invalid'));
 assert.equal((await pg.query('SELECT attempts FROM login_limits')).rows[0].attempts,1);
 await pg.exec('UPDATE login_limits SET attempts=30');
 assert.ok((await login.POST(request('wrong'))).headers.get('location').includes('limit'));
 await pg.exec('UPDATE login_limits SET reset_at=0');
 assert.ok((await login.POST(request('wrong'))).headers.get('location').includes('invalid'));
 const pgLogin=await login.POST(request(process.env.SITE_PASSWORD));assert.ok(pgLogin.headers.get('set-cookie'));
 assert.equal((await pg.query('SELECT * FROM login_limits')).rows.length,0);await pg.close();
 const out=await logout.POST(new Request('https://test.invalid/api/auth/logout',{method:'POST',headers:{origin:'https://test.invalid'}}));assert.equal(out.status,303);assert.ok(out.headers.get('set-cookie').includes('Max-Age=0'));
 delete process.env.SESSION_SECRET;assert.equal((await login.POST(request('wrong'))).status,503);assert.equal(auth.sessionUser(token),null);
 console.log('PASS: senha, assinatura, expiração, rotação, bloqueio de cabeçalho forjado, origem, limite, login e logout.');
}finally{delete globalThis.__loginDb;if(previous.password===undefined)delete process.env.SITE_PASSWORD;else process.env.SITE_PASSWORD=previous.password;if(previous.secret===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=previous.secret;await rm(temp,{recursive:true,force:true});}
