from pathlib import Path
import json,random,hashlib
root=Path(__file__).resolve().parent.parent
s=(root/'lib/syllabus.ts').read_text();topics=json.loads(s.split('export const topics = ')[1].split(';\nexport const matters')[0]);profiles={}
for path in sorted((root/'content').glob('*.txt')):
 cur=None
 for line in path.read_text().splitlines():
  if line.startswith('@'):
   cur=line[1:]
   assert cur not in profiles,cur
   profiles[cur]=[]
  elif line.strip():
   row=line.split('|');assert len(row)==4,(cur,row)
   assert all(x.strip() for x in row),(cur,row)
   profiles[cur].append(row)
assert set(profiles)=={t['id'] for t in topics}
assert all(len(v)==10 for v in profiles.values())
bank=[]
def mark(text):return '**'+text+'**'
for ti,t in enumerate(topics):
 rows=profiles[t['id']];rng=random.Random(int(hashlib.sha256(t['id'].encode()).hexdigest()[:8],16))
 def explanation(idx,truth):
  label,good,bad,why=rows[idx]
  return (mark('Afirmação verdadeira.')+' '+why if truth else mark('Afirmação falsa.')+' Correção: '+mark(good)+' '+why)
 for i in range(10):
  q={'id':f"{t['id']}-q{i+1:02d}",'matter':t['matter'],'topicId':t['id'],'topic':t['title'],'source':t['source']}
  if i<6:
   ids=[i]+rng.sample([j for j in range(10) if j!=i],3)
   seek_false=i%2==1
   labels=', '.join(rows[j][0].lower() for j in ids)
   q['stem']=f"Analise as anotações sobre {t['title'].lower()}, envolvendo {labels}. Assinale a única afirmação {'INCORRETA' if seek_false else 'correta'}."
   options=[]
   for oi,j in enumerate(ids):
    truth=(oi!=0) if seek_false else (oi==0)
    text=rows[j][1 if truth else 2]
    note=explanation(j,truth)
    if seek_false: note=('Esta é a resposta pedida, porque a afirmação é falsa. ' if oi==0 else 'Não atende ao pedido de identificar a afirmação incorreta. ')+note
    options.append({'text':text,'explanation':note})
   q['options']=options;q['review']=mark(rows[i][1])+' '+rows[i][3]
  else:
   ids=[i,(i+3)%10,(i+7)%10]
   bits=[bool((ti+i*3)>>j&1) for j in range(3)]
   lines=[f"{'I'* (j+1) if j<2 else 'III'}. {rows[idx][1 if bits[j] else 2]}" for j,idx in enumerate(ids)]
   q['stem']='Julgue as afirmações sobre '+t['title'].lower()+':\n\n'+'\n\n'.join(lines)+'\n\nQuais estão corretas?'
   masks=[sum((1<<j) for j,b in enumerate(bits) if b)];masks+=rng.sample([m for m in range(8) if m!=masks[0]],3)
   def option_text(mask):
    names=[['I','II','III'][j] for j in range(3) if mask>>j&1]
    if not names:return 'Nenhuma das afirmações.'
    if len(names)==3:return 'I, II e III.'
    return 'Apenas '+(' e '.join(names))+'.'
   options=[]
   for mask in masks:
    mismatch=[j for j,b in enumerate(bits) if bool(mask>>j&1)!=b]
    verdict=mark('A combinação está correta.') if not mismatch else mark('A combinação está incorreta.')+' '+ '; '.join(f"{'I' if j==0 else 'II' if j==1 else 'III'} é {'verdadeira e foi excluída' if bits[j] else 'falsa e foi incluída'}" for j in mismatch)+'.'
    detail=' '.join(f"{'I' if j==0 else 'II' if j==1 else 'III'}: {explanation(ids[j],bits[j])}" for j in (range(3) if not mismatch else mismatch))
    options.append({'text':option_text(mask),'explanation':verdict+' '+detail})
   q['options']=options;q['review']=' '.join(mark(rows[idx][1]) for idx in ids)
  assert len(set(o['text'] for o in q['options']))==4,q['id']
  bank.append(q)
assert len(bank)==1080
assert len(set(q['id'] for q in bank))==1080
assert len(set(q['stem'] for q in bank))==1080
assert len(set(json.dumps([q['stem'],sorted(o['text'] for o in q['options'])],ensure_ascii=False) for q in bank))==1080
(root/'lib/study-notes.json').write_text(json.dumps({key:[{'label':r[0],'text':r[1],'why':r[3]} for r in rows] for key,rows in profiles.items()},ensure_ascii=False,separators=(',',':')))
(root/'lib/question-bank.json').write_text(json.dumps(bank,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'questions':len(bank),'topics':len(topics),'per_topic':10,'counts':{m:sum(q['matter']==m for q in bank) for m in ['portugues','sus','informatica','especificos']}},ensure_ascii=False))
