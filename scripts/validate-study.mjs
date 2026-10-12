// Exercise the real route handlers against SQLite with the D1 interface.
// Test modules are temporary; no production source is replaced.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const root = new URL('../', import.meta.url);
const temp = await mkdtemp(join(tmpdir(), 'ses-study-qa-'));
try {
  const files = {'syllabus.js':'lib/syllabus.ts','questions.js':'lib/questions.ts','engine.js':'lib/engine.ts','essay.js':'lib/essay.ts','study-route.js':'app/api/study/route.ts','essay-route.js':'app/api/essay/route.ts'};
  for (const [name, path] of Object.entries(files)) {
    let source = await readFile(new URL(path, root), 'utf8');
    source = source.replace(/import\s*\{\s*getRawDb\s*\}\s*from\s*['"][^'"]+['"];?/, 'const getRawDb = () => globalThis.__qaDb;');
    source = source.replaceAll('import.meta.env.DEV','false');
    source = source.replace('import { authenticatedUser, sameOrigin } from "../../../lib/auth";', 'const authenticatedUser = async req => req.headers.get("oai-authenticated-user-id"); const sameOrigin = req => req.headers.get("origin") === new URL(req.url).origin;');
    source = source.replace(/(['"])(?:\.\/|\.\.\/\.\.\/\.\.\/lib\/)(syllabus|questions|engine|essay)\1/g, '"./$2.js"');
    source = source.replace("import bank from './question-bank.json';", 'import { readFileSync } from "node:fs"; const bank = JSON.parse(readFileSync(new URL("question-bank.json", import.meta.url), "utf8"));');
    await writeFile(join(temp,name), ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
  }
  await writeFile(join(temp,'package.json'),'{"type":"module"}');
  await writeFile(join(temp,'question-bank.json'),await readFile(new URL('lib/question-bank.json',root)));
  const {questions,questionMap,topics,matters} = await import(pathToFileURL(join(temp,'questions.js')));
  const {buildQueue,publicQuestion} = await import(pathToFileURL(join(temp,'engine.js')));
  const study = await import(pathToFileURL(join(temp,'study-route.js')));
  const essay = await import(pathToFileURL(join(temp,'essay-route.js')));
  const {essayPrompts,essayChecks} = await import(pathToFileURL(join(temp,'essay.js')));
  assert.equal(questions.length,1080); assert.equal(topics.length,108);
  assert.equal(new Set(questions.map(q=>q.stem)).size,1080);
  const notes = JSON.parse(await readFile(new URL('lib/study-notes.json',root),'utf8'));
  function checkQueue(queue,count) {
    assert.equal(queue.length,count); assert.equal(new Set(queue.map(q=>q.id)).size,count);
    const letters=[0,0,0,0]; let prev=-1,run=0;
    for(const item of queue){
      assert.deepEqual([...item.order].sort(),[0,1,2,3]);
      const letter=item.order.indexOf(0);letters[letter]++;
      run=prev===letter?run+1:1;prev=letter;assert.ok(run<3);
      const before=publicQuestion(item);assert.equal(before.correctIndex,undefined);assert.equal(before.review,undefined);
      assert.ok(before.options.every(o=>o.correct===undefined&&o.explanation===undefined));
      for(let choice=0;choice<4;choice++){
        const after=publicQuestion(item,choice);assert.equal(after.correct,choice===letter);
        assert.equal(after.correctIndex,letter);assert.ok(after.review.length>20);
        assert.ok(after.options.every(o=>o.explanation.length>20));
        assert.equal(after.options.filter(o=>o.correct).length,1);
      }
    }
    assert.ok(Math.max(...letters)-Math.min(...letters)<=1);
  }
  for(const topic of topics){
    assert.equal(notes[topic.id].length,10);
    const queue=buildQueue('train',topic.matter,[],[],topic.id);checkQueue(queue,10);
    assert.ok(queue.every(i=>questionMap.get(i.id).topicId===topic.id));
  }
  for(let i=0;i<120;i++){
    const exam=buildQueue('exam','all');checkQueue(exam,70);
    assert.deepEqual(matters.map(m=>exam.filter(i=>questionMap.get(i.id).matter===m.id).length),[10,5,5,50]);
    checkQueue(buildQueue('mini','all'),20);
  }
  for(const m of matters){
    checkQueue(buildQueue('mini',m.id),5);checkQueue(buildQueue('train',m.id),20);
    const existing=questions.filter(q=>q.matter===m.id),unseen=existing.slice(-20),seen=existing.slice(0,-20).map(q=>q.id);
    const queue=buildQueue('train',m.id,[],seen);assert.ok(queue.every(i=>unseen.some(q=>q.id===i.id)));
  }
  let closeDb;
  if(process.argv.includes('--postgres')){
    const {PGlite}=await import('@electric-sql/pglite');const pg=new PGlite();
    await pg.exec(await readFile(new URL('db/schema.sql',root),'utf8'));
    globalThis.__qaNeon=()=>({
      query(sql,params){return {sql,params,then(resolve,reject){return pg.query(sql,params).then(r=>r.rows).then(resolve,reject);}};},
      async transaction(statements){await pg.exec('BEGIN');try{const result=[];for(const s of statements)result.push((await pg.query(s.sql,s.params)).rows);await pg.exec('COMMIT');return result;}catch(e){await pg.exec('ROLLBACK');throw e;}}
    });
    let source=await readFile(new URL('db/index.ts',root),'utf8');
    source=source.replace("import { neon } from '@neondatabase/serverless';",'const neon=globalThis.__qaNeon;');
    await writeFile(join(temp,'postgres-db.js'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
    process.env.DATABASE_URL='postgresql://local-test-only';
    const adapter=await import(pathToFileURL(join(temp,'postgres-db.js')));globalThis.__qaDb=adapter.getRawDb();
    assert.equal(adapter.postgresSql('SELECT * FROM example WHERE id=? AND name=?'),'SELECT * FROM example WHERE id=$1 AND name=$2');
    closeDb=async()=>{await pg.close();delete globalThis.__qaNeon;delete process.env.DATABASE_URL;};
  }else{
    const sqlite = new DatabaseSync(':memory:');
    for(const name of ['0000_bent_switch.sql','0001_luxuriant_toad.sql']) sqlite.exec(await readFile(new URL('test-fixtures/sqlite/'+name,root),'utf8'));
    globalThis.__qaDb={prepare(sql){const s=sqlite.prepare(sql);return {bind(...args){return {async all(){return {results:s.all(...args)};},async first(){return s.get(...args)??null;},async run(){return s.run(...args);}};}};},async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
    closeDb=async()=>sqlite.close();
  }
  const user='qa-user-a';const other='qa-user-b';
  async function call(handler,body,who=user,origin){
    const headers={'Content-Type':'application/json'};if(who)headers['oai-authenticated-user-id']=who;if(origin)headers.origin=origin;
    const req=new Request('https://qa.invalid/api/study',{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});
    const result=await (body?handler.POST(req):handler.GET(req));return {status:result.status,data:await result.json()};
  }
  assert.equal((await call(study,null,null)).status,401);
  assert.equal((await call(essay,null,null)).status,401);
  assert.equal((await call(study,{action:'start'},user,'https://other.invalid')).status,403);
  assert.equal((await call(study,{action:'start',mode:'invalid'})).status,400);
  let started=await call(study,{action:'start',mode:'train',matter:'portugues',topic:'p-texto',requestId:crypto.randomUUID()});
  assert.equal(started.status,200);assert.equal(started.data.session.total,10);
  const firstSession=started.data.session;
  assert.equal((await call(study,{action:'next',sessionId:firstSession.id,cursor:0})).status,400);
  assert.equal((await call(study,{action:'answer',sessionId:firstSession.id,cursor:0,choice:4})).status,400);
  assert.equal((await call(study,{action:'answer',sessionId:firstSession.id,cursor:0,choice:0},other)).status,404);
  assert.equal((await call(study,{action:'start',mode:'train',matter:'portugues',topic:'p-texto',requestId:firstSession.id})).data.session.id,firstSession.id);
  const wrongIds=[];
  async function finish(session,makeWrong=false){
    const count=session.total;
    for(let cursor=0;cursor<count;cursor++){
      const raw=questionMap.get(session.question.id);
      const correct=session.question.options.findIndex(o=>o.text===raw.options[0].text);
      const choice=makeWrong&&cursor===0?(correct+1)%4:correct;
      if(makeWrong&&cursor===0)wrongIds.push(raw.id);
      const body={action:'answer',sessionId:session.id,cursor,choice};
      const answered=await call(study,body);assert.equal(answered.status,200);
      assert.equal(answered.data.session.question.correct,choice===correct);
      assert.ok(answered.data.session.question.options.every(o=>o.explanation));
      const duplicate=await call(study,{...body,choice:(choice+1)%4});assert.equal(duplicate.status,200);
      assert.deepEqual(duplicate.data.state.total,answered.data.state.total);
      assert.equal(duplicate.data.session.question.chosen,choice);
      const reloaded=await call(study);assert.equal(reloaded.data.active.question.chosen,choice);assert.equal(reloaded.data.active.cursor,cursor);
      const next=await call(study,{action:'next',sessionId:session.id,cursor});assert.equal(next.status,200);session=next.data.session;
      assert.equal((await call(study,{action:'next',sessionId:session.id,cursor})).status,409);
    }
    assert.equal(session.status,'completed');assert.equal(session.question,null);assert.equal(session.correct+session.wrong,count);
    assert.equal((await call(study)).data.active,null);return session;
  }
  await finish(firstSession,true);
  assert.equal((await call(study)).data.topics.find(t=>t.id==='p-texto').answered,10);
  assert.equal((await call(study)).data.review.length,1);
  started=await call(study,{action:'start',mode:'review',matter:'all',requestId:crypto.randomUUID()});assert.equal(started.data.session.total,1);
  await finish(started.data.session);
  assert.equal((await call(study)).data.review.length,0);
  assert.equal((await call(study)).data.topics.find(t=>t.id==='p-texto').answered,10);
  for(const [mode,matter,total] of [['mini','sus',5],['mini','all',20],['exam','all',70]]){
    started=await call(study,{action:'start',mode,matter,requestId:crypto.randomUUID()});assert.equal(started.status,200);assert.equal(started.data.session.total,total);
    await finish(started.data.session);
  }
  const state=(await call(study)).data;assert.equal(state.total.correct+state.total.wrong,106);
  assert.equal(state.matters.reduce((n,m)=>n+m.correct+m.wrong,0),106);
  assert.equal((await call(study,null,other)).data.total.correct,0);
  const draft={promptId:essayPrompts[0].id,text:'A organização do atendimento exige escuta, sigilo e informação clara.\nÉ necessário integrar equipes para melhorar o acesso.',checks:essayChecks.map(()=>false)};
  assert.equal((await call(essay,draft)).status,200);
  assert.deepEqual((await call(essay)).data.drafts[0].text,draft.text);
  assert.equal((await call(essay,null,other)).data.drafts.length,0);
  assert.equal((await call(essay,{...draft,text:'Revisão do rascunho',checks:essayChecks.map(()=>true)})).status,200);
  assert.equal((await call(essay)).data.drafts.length,1);
  assert.equal((await call(essay,{...draft,checks:[]})).status,400);
  assert.equal((await call(essay,draft,user,'https://other.invalid')).status,403);
  await closeDb();
  console.log(JSON.stringify({result:'passed',database:process.argv.includes('--postgres')?'PostgreSQL (PGlite)':'SQLite',questions:1080,topics:108,queues:108+240+8,completed_sessions:['topic-10','review-1','mini-5','mini-20','exam-70'],saved_attempts:106,checks:['balanced letters','no three repeated letters','unseen priority','hidden answers','idempotency','resume','error review','statistics','user isolation','essay persistence','auth and origin']}));
} finally { delete globalThis.__qaDb;await rm(temp,{recursive:true,force:true}); }
