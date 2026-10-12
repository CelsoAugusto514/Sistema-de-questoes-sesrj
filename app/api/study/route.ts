import { authenticatedUser, sameOrigin } from "../../../lib/auth";
import { getRawDb } from "../../../db/index";
import { matters, questions, questionMap, topics } from "../../../lib/questions";
import { buildQueue, publicQuestion, type SessionConfig } from "../../../lib/engine";
export const dynamic="force-dynamic";
type SessionRow={id:string;user_id:string;state:string;cursor:number;status:string;created_at:number};
type AttemptRow={id:string;user_id:string;session_id:string;question_id:string;matter:string;chosen:number;correct:number;created_at:number};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function identity(req:Request){const user=await authenticatedUser(req);return user?{user,preview:false}:null;}
async function rows(user:string){return (await getRawDb().prepare("SELECT * FROM study_attempts WHERE user_id = ? ORDER BY created_at DESC, id DESC").bind(user).all<AttemptRow>()).results;}
function reviewRows(attempts:AttemptRow[]){const seen=new Set<string>();return attempts.filter(a=>{if(seen.has(a.question_id))return false;seen.add(a.question_id);return a.correct===0;}).map(a=>questionMap.get(a.question_id)).filter((q):q is NonNullable<typeof q>=>!!q).map(q=>({id:q.id,matter:q.matter,topic:q.topic,review:q.review}));}
async function sessionView(s:SessionRow){
  const config=JSON.parse(s.state) as SessionConfig;
  const attempts=(await getRawDb().prepare("SELECT * FROM study_attempts WHERE session_id = ? AND user_id = ?").bind(s.id,s.user_id).all<AttemptRow>()).results;
  const item=config.queue[s.cursor]; const answer=item?attempts.find(a=>a.question_id===item.id):undefined;
  return {id:s.id,mode:config.mode,matter:config.matter,cursor:s.cursor,total:config.queue.length,status:s.status,correct:attempts.filter(a=>a.correct).length,wrong:attempts.filter(a=>!a.correct).length,question:s.status==="completed"||!item?null:publicQuestion(item,answer?.chosen),summary:matters.map(m=>({matter:m.id,correct:attempts.filter(a=>a.matter===m.id&&a.correct).length,wrong:attempts.filter(a=>a.matter===m.id&&!a.correct).length}))};
}
async function state(user:string,preview:boolean){
  const attempts=await rows(user);
  const correct=attempts.filter(a=>a.correct).length,wrong=attempts.length-correct;
  const active=await getRawDb().prepare("SELECT * FROM study_sessions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1").bind(user).first<SessionRow>();
  const latest=new Map<string,AttemptRow>();for(const a of attempts)if(!latest.has(a.question_id))latest.set(a.question_id,a);
  return {preview,topics:topics.map(t=>{const bank=questions.filter(q=>q.topicId===t.id),answers=bank.map(q=>latest.get(q.id)).filter((a):a is AttemptRow=>!!a);return {...t,count:bank.length,answered:answers.length,correct:answers.filter(a=>a.correct).length,wrong:answers.filter(a=>!a.correct).length};}),matters:matters.map(m=>{const answers=attempts.filter(a=>a.matter===m.id),ok=answers.filter(a=>a.correct).length;return {...m,count:questions.filter(q=>q.matter===m.id).length,correct:ok,wrong:answers.length-ok,rate:answers.length?Math.round(ok/answers.length*100):null};}),total:{correct,wrong,rate:attempts.length?Math.round(correct/attempts.length*100):null},review:reviewRows(attempts),active:active?await sessionView(active):null};
}
export async function GET(req:Request){
 const id=await identity(req);if(!id)return response({error:"Entre com sua senha para acessar seu progresso.",auth:true},401);
 try{return response(await state(id.user,id.preview));}catch(e){console.error("study load",e);return response({error:"Não foi possível carregar seu progresso. Tente novamente."},503);}
}
export async function POST(req:Request){
 const id=await identity(req);if(!id)return response({error:"Entre com sua senha para acessar seu progresso.",auth:true},401);
 const origin=req.headers.get("origin");if(origin&&!sameOrigin(req))return response({error:"Origem não autorizada."},403);
 try{
  const body=await req.json() as Record<string,unknown>;const db=getRawDb();
  if(body.action==="start"){
    const {mode,matter,requestId}=body;const topic=typeof body.topic==='string'?body.topic:'all';
    if(!["train","mini","review","exam"].includes(String(mode))||!["all",...matters.map(m=>m.id)].includes(String(matter))||(topic!=='all'&&!topics.some(t=>t.id===topic&&t.matter===matter))||(mode!=='train'&&topic!=='all')||typeof requestId!=="string"||!/^[a-f0-9-]{36}$/.test(requestId))return response({error:"Seleção de treino inválida."},400);
    const old=await db.prepare("SELECT * FROM study_sessions WHERE id = ? AND user_id = ?").bind(requestId,id.user).first<SessionRow>();
    if(old)return response({session:await sessionView(old),state:await state(id.user,id.preview)});
    const attempts=await rows(id.user); const reviewIds=reviewRows(attempts).map(q=>q.id);
    const queue=buildQueue(mode as SessionConfig["mode"],String(matter),reviewIds,attempts.map(a=>a.question_id),topic);
    if(!queue.length)return response({error:"Você não tem questões pendentes para revisar."},400);
    const config:SessionConfig={mode:mode as SessionConfig["mode"],matter:mode==='exam'?'all':String(matter),topic,queue};
    await db.batch([
      db.prepare("UPDATE study_sessions SET status = 'abandoned' WHERE user_id = ? AND status = 'active'").bind(id.user),
      db.prepare("INSERT INTO study_sessions (id,user_id,state,cursor,status,created_at) VALUES (?,?,?,0,'active',?)").bind(requestId,id.user,JSON.stringify(config),Date.now()),
    ]);
    const s=await db.prepare("SELECT * FROM study_sessions WHERE id = ? AND user_id = ?").bind(requestId,id.user).first<SessionRow>();
    return response({session:await sessionView(s!),state:await state(id.user,id.preview)});
  }
  if(!["answer","next"].includes(String(body.action))||typeof body.sessionId!=="string")return response({error:"Ação inválida."},400);
  const s=await db.prepare("SELECT * FROM study_sessions WHERE id = ? AND user_id = ?").bind(body.sessionId,id.user).first<SessionRow>();
  if(!s)return response({error:"Treino não encontrado."},404);
  if(s.status!=="active"||body.cursor!==s.cursor)return response({error:"Este treino mudou. Recarregue para continuar."},409);
  const config=JSON.parse(s.state) as SessionConfig;const item=config.queue[s.cursor];
  if(body.action==="answer"){
    if(!Number.isInteger(body.choice)||Number(body.choice)<0||Number(body.choice)>3)return response({error:"Escolha uma alternativa válida."},400);
    const attemptId=s.id+":"+item.id;
    await db.prepare("INSERT INTO study_attempts (id,user_id,session_id,question_id,matter,chosen,correct,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(attemptId,id.user,s.id,item.id,questionMap.get(item.id)!.matter,Number(body.choice),item.order[Number(body.choice)]===0?1:0,Date.now()).run();
  } else {
    const a=await db.prepare("SELECT id FROM study_attempts WHERE id = ? AND user_id = ?").bind(s.id+":"+item.id,id.user).first();
    if(!a)return response({error:"Responda à questão antes de continuar."},400);
    await db.prepare("UPDATE study_sessions SET cursor = cursor + 1, status = ? WHERE id = ? AND user_id = ? AND cursor = ? AND status = 'active'").bind(s.cursor+1>=config.queue.length?"completed":"active",s.id,id.user,s.cursor).run();
  }
  const updated=await db.prepare("SELECT * FROM study_sessions WHERE id = ? AND user_id = ?").bind(s.id,id.user).first<SessionRow>();
  return response({session:await sessionView(updated!),state:await state(id.user,id.preview)});
 }catch(e){console.error("study write",e);return response({error:"Não foi possível salvar. Sua seleção foi mantida; tente novamente."},503);}
}
