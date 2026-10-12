import bank from './question-bank.json';
import { topics } from './syllabus';
export { topics, matters } from './syllabus';
export type Question={id:string;matter:string;topic:string;topicId:string;stem:string;options:{text:string;explanation:string}[];review:string;source?:{label:string;url:string}};
export const questions:Question[]=bank;
export const questionMap=new Map(questions.map(q=>[q.id,q]));
if(questionMap.size!==questions.length||questions.some(q=>q.options.length!==4||!topics.some(t=>t.id===q.topicId&&t.matter===q.matter)))throw new Error('Banco inválido');

if (questions.length !== 1080 || topics.some(t => questions.filter(q => q.topicId === t.id).length !== 10)) throw new Error("Cobertura do banco inválida");
