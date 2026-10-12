import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw new Error('Defina DATABASE_URL antes de inicializar.');
const sql=neon(process.env.DATABASE_URL);
const text=await readFile(new URL('../db/schema.sql',import.meta.url),'utf8');
const statements=text.split(';').map(s=>s.trim()).filter(Boolean);
await sql.transaction(statements.map(s=>sql.query(s,[])));
console.log('Estrutura inicializada. Nenhuma resposta importada.');
