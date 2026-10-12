import { neon } from '@neondatabase/serverless';
function client(){const url=process.env.DATABASE_URL;if(!url)throw new Error('Configure DATABASE_URL com um banco Neon novo.');return neon(url);}
export function postgresSql(sql:string){let i=0;return sql.replace(/\?/g,()=>'$'+(++i));}
class Statement {
 constructor(readonly sql:string,readonly params:unknown[]=[]){ }
 bind(...params:unknown[]){return new Statement(this.sql,params);}
 async all<T=Record<string,unknown>>(){const results=await client().query(postgresSql(this.sql),this.params);return {results:results as T[]};}
 async first<T=Record<string,unknown>>(){return (await this.all<T>()).results[0]??null;}
 async run(){await this.all();return {success:true};}
}
export function getRawDb(){return {prepare(sql:string){return new Statement(sql);},async batch(statements:Statement[]){const sql=client();return sql.transaction(statements.map(s=>sql.query(postgresSql(s.sql),s.params)));}};}
