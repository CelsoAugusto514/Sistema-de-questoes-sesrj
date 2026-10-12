import { matters, questions, questionMap } from "./questions";
export type QueueItem = { id:string; order:number[] };
export type SessionConfig = {mode:"train"|"mini"|"review"|"exam"; matter:string; topic?:string; queue:QueueItem[]};
export function shuffle<T>(items:T[]):T[] { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1); [a[i],a[j]]=[a[j],a[i]];} return a; }
export function buildQueue(mode:SessionConfig["mode"], matter:string, reviewIds:string[]=[], recentIds:string[]=[],topic='all'):QueueItem[] {
  const seen=new Set(recentIds);
  const preferNew=(pool:typeof questions)=>shuffle(pool.filter(q=>!seen.has(q.id))).concat(shuffle(pool.filter(q=>seen.has(q.id))));
  function spread(pool:typeof questions,limit:number){
    const topicIds=shuffle([...new Set(pool.map(q=>q.topicId))]);
    const groups=topicIds.map(id=>preferNew(pool.filter(q=>q.topicId===id)));
    const selected:typeof questions=[];
    // Prefer unattempted questions across topics before repeating old questions.
    for(const unseenOnly of [true,false]){
      let progressed=true;
      while(selected.length<limit&&progressed){
        progressed=false;
        for(const group of groups){
          if(selected.length>=limit)break;
          const index=group.findIndex(q=>!unseenOnly||!seen.has(q.id));
          if(index<0)continue;
          selected.push(group.splice(index,1)[0]);progressed=true;
        }
      }
    }
    return selected;
  }
  let pool=questions.filter(q=>(matter==="all"||q.matter===matter)&&(topic==='all'||q.topicId===topic));
  let selected:typeof questions;
  if(mode==="review")selected=shuffle(questions.filter(q=>reviewIds.includes(q.id)&&(matter==='all'||q.matter===matter))).slice(0,20);
  else if(mode==='exam')selected=matters.flatMap(m=>spread(questions.filter(q=>q.matter===m.id),m.id==='portugues'?10:m.id==='especificos'?50:5));
  else if(mode==='mini')selected=matter==='all'?matters.flatMap(m=>spread(questions.filter(q=>q.matter===m.id),5)):spread(pool,5);
  else selected=topic==='all'?spread(pool,20):preferNew(pool);
  selected=shuffle(selected);
  // A shuffled balanced position bag: letters vary, counts differ at most by 1.
  let positions:number[]=[];
  for(let attempt=0;attempt<100;attempt++){
    const offset=crypto.getRandomValues(new Uint32Array(1))[0]%4;
    positions=shuffle(selected.map((_,i)=>(i+offset)%4));
    if(!positions.some((p,i)=>i>1&&p===positions[i-1]&&p===positions[i-2])) break;
  }
  // Guaranteed completion if rejection sampling happens to exhaust its budget.
  if(positions.some((p,i)=>i>1&&p===positions[i-1]&&p===positions[i-2])){
    const remaining=[0,0,0,0];positions.forEach(p=>remaining[p]++);positions=[];
    while(positions.length<selected.length){const allowed=shuffle([0,1,2,3]).filter(p=>remaining[p]>0&&!(positions.length>1&&positions.at(-1)===p&&positions.at(-2)===p));allowed.sort((a,b)=>remaining[b]-remaining[a]);const p=allowed[0];if(p===undefined)throw new Error('Alternative allocation failed');positions.push(p);remaining[p]--;}
  }
  return selected.map((q,i)=>{const order=shuffle([1,2,3]);order.splice(positions[i],0,0);return {id:q.id,order};});
}
export function publicQuestion(item:QueueItem,chosen?:number){
  const q=questionMap.get(item.id)!;
  return {id:q.id,matter:q.matter,topic:q.topic,stem:q.stem,options:item.order.map((n,i)=>({id:i,text:q.options[n].text,...(chosen===undefined?{}:{explanation:q.options[n].explanation,correct:n===0})})),...(chosen===undefined?{}:{review:q.review,source:q.source,chosen,correct: item.order[chosen]===0,correctIndex:item.order.indexOf(0)})};
}
