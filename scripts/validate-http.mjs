// Execute depois de npm run build, sem outro servidor usando a porta 3000.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
const child=spawn(process.execPath,[fileURLToPath(new URL('../node_modules/next/dist/bin/next',import.meta.url)),'start','--hostname','127.0.0.1','--port','3000'],{env:{...process.env,SITE_PASSWORD:'test-only-password-123',SESSION_SECRET:'test-only-session-secret-32-characters'},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server readiness timeout')),10000);child.on('exit',code=>reject(Error('Server exited '+code)));child.stderr.on('data',d=>process.stderr.write(d));child.stdout.on('data',d=>{if(d.toString().includes('Ready')){clearTimeout(timer);resolve();}});});
 const base='http://127.0.0.1:3000';let r=await fetch(base,{redirect:'manual'});assert.equal(r.status,307);assert.ok(r.headers.get('location').endsWith('/login'));
 r=await fetch(base+'/login');assert.equal(r.status,200);assert.ok((await r.text()).includes('Sua sala de estudo'));
 for(const path of ['/api/study','/api/essay']){r=await fetch(base+path,{headers:{'oai-authenticated-user-id':'owner'}});assert.equal(r.status,401);}
 r=await fetch(base+'/api/auth/login',{method:'POST',headers:{origin:'https://other.invalid','Content-Type':'application/x-www-form-urlencoded'},body:'password=wrong'});assert.equal(r.status,403);
 const payload=Buffer.from(JSON.stringify({user:'owner',expires:Date.now()+7*24*60*60*1000})).toString('base64url');const sig=createHmac('sha256','test-only-session-secret-32-characters:test-only-password-123').update(payload).digest('base64url');
 r=await fetch(base,{headers:{cookie:'ses_session='+payload+'.'+sig},redirect:'manual'});assert.equal(r.status,200);const body=await r.text();assert.ok(body.includes('Treino por tópico'));assert.ok(body.includes('10 POR TÓPICO'));assert.equal(r.headers.get('x-frame-options'),'DENY');
 r=await fetch(base+'/api/auth/logout',{method:'POST',headers:{origin:base},redirect:'manual'});assert.equal(r.status,303);assert.ok(r.headers.get('set-cookie').includes('Max-Age=0'));
 console.log('PASS: servidor de produção, tela de login, página/API protegidas, sessão assinada, origem e logout.');
}finally{child.kill('SIGTERM');}
