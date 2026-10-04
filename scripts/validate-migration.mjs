import mysql from 'mysql2/promise';
import pg from 'pg';

const {Pool}=pg;
const tables=['users','user_settings','games','packs','pack_games','news','tutorials','images','favorites','orders','tickets','ticket_messages','reviews','pack_reviews','ratings','pack_ratings','review_reports','pack_review_reports','notifications','broken_links','audit_logs','site_status','site_settings','backups','sessions','password_resets'];
const idTables=['users','games','packs','news','tutorials','images','orders','tickets','ticket_messages','reviews','pack_reviews','review_reports','pack_review_reports','notifications','broken_links','audit_logs','site_status','site_settings','backups','sessions','password_resets'];
const orphanChecks=[
 ['favorites','user_id','users','id'],['favorites','game_id','games','id'],['pack_games','pack_id','packs','id'],['pack_games','game_id','games','id'],
 ['user_settings','user_id','users','id'],['sessions','user_id','users','id'],['password_resets','user_id','users','id'],['orders','user_id','users','id'],
 ['tickets','user_id','users','id'],['ticket_messages','ticket_id','tickets','id'],['ticket_messages','user_id','users','id'],['reviews','user_id','users','id'],
 ['reviews','game_id','games','id'],['pack_reviews','user_id','users','id'],['pack_reviews','pack_id','packs','id'],['ratings','user_id','users','id'],['ratings','game_id','games','id'],
 ['pack_ratings','user_id','users','id'],['pack_ratings','pack_id','packs','id'],['review_reports','review_id','reviews','id'],['review_reports','user_id','users','id'],
 ['pack_review_reports','review_id','pack_reviews','id'],['pack_review_reports','user_id','users','id'],['notifications','user_id','users','id'],['broken_links','user_id','users','id'],
 ['broken_links','game_id','games','id'],['broken_links','pack_id','packs','id'],['audit_logs','admin_user_id','users','id']
];
const idRegex=/^[^\\x00-\\x1F]{1,191}$/;

async function countSql(db,kind,table){const q=`SELECT COUNT(*) AS c FROM ${table}`;const r=kind==='pg'?await db.query(q):await db.query(q);return Number((kind==='pg'?r.rows[0]:r[0][0]).c||0)}
async function rowsSql(db,kind,sql,params=[]){const r=kind==='pg'?await db.query(sql,params):await db.query(sql,params);return kind==='pg'?r.rows:r[0]}
async function tableExists(db,kind,table){if(kind==='pg'){const r=await db.query('SELECT 1 FROM information_schema.tables WHERE table_schema=current_schema() AND table_name=$1',[table]);return r.rowCount>0}const [r]=await db.query('SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?',[table]);return r.length>0}
async function columns(db,kind,table){if(kind==='pg'){const r=await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position',[table]);return r.rows.map(x=>x.column_name)}const [r]=await db.query('SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? ORDER BY ordinal_position',[table]);return r.map(x=>x.COLUMN_NAME||x.column_name)}

const sourceUrl=process.env.SOURCE_DATABASE_URL||process.env.DATABASE_URL;
const mysqlUrl=process.env.MYSQL_URL;
if(!sourceUrl||!mysqlUrl){console.error('Set SOURCE_DATABASE_URL (PostgreSQL) and MYSQL_URL before running migration validation. No data is modified.');process.exit(2)}
const source=new Pool({connectionString:sourceUrl,ssl:{rejectUnauthorized:false},max:2});
const target=mysql.createPool({uri:mysqlUrl,waitForConnections:true,connectionLimit:2,charset:'utf8mb4'});
let failed=false;
try{
 const report={tables:{},orphanRows:{},schema:{}};
 for(const table of tables){
   const [se,te]=await Promise.all([tableExists(source,'pg',table),tableExists(target,'mysql',table)]);
   if(!se||!te){report.schema[table]={source:se,target:te};failed=true;continue}
   const [sc,tc]=await Promise.all([countSql(source,'pg',table),countSql(target,'mysql',table)]);
   report.tables[table]={source:sc,target:tc,diff:tc-sc};
   if(sc!==tc)failed=true;
 }
 for(const table of idTables){
   if(!(await tableExists(target,'mysql',table)))continue;
   const bad=await rowsSql(target,'mysql',`SELECT id FROM ${table} WHERE id IS NULL OR CHAR_LENGTH(id)=0 OR CHAR_LENGTH(id)>191 LIMIT 10`);
   if(bad.length){report.schema[`${table}.id`]={invalidIds:bad};failed=true}
 }
 for(const [child,cc,parent,pc] of orphanChecks){
   if(!(await tableExists(target,'mysql',child))||!(await tableExists(target,'mysql',parent)))continue;
   const rows=await rowsSql(target,'mysql',`SELECT c.${cc} AS value FROM ${child} c LEFT JOIN ${parent} p ON p.${pc}=c.${cc} WHERE c.${cc} IS NOT NULL AND p.${pc} IS NULL LIMIT 10`);
   if(rows.length){report.orphanRows[`${child}.${cc}->${parent}.${pc}`]=rows;failed=true}
 }
 const required={users:['id','username','email','password_hash','role','status'],games:['id','name','status'],packs:['id','name','price','status'],orders:['id','user_id','item_type','item_id','amount','status'],tickets:['id','user_id','subject','description'],reviews:['id','user_id','game_id','body','status'],pack_reviews:['id','user_id','pack_id','body','status'],notifications:['id','user_id','type','title']};
 for(const [table,want] of Object.entries(required)){const got=new Set(await columns(target,'mysql',table));const missing=want.filter(x=>!got.has(x));if(missing.length){report.schema[table]={missing};failed=true}}
 const [charsetRows]=await target.query("SELECT DEFAULT_CHARACTER_SET_NAME charset_name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=DATABASE()");
 if(charsetRows[0]?.charset_name?.toLowerCase()!=='utf8mb4'){report.schema.database_charset=charsetRows[0]?.charset_name||null;failed=true}
 console.log(JSON.stringify({ok:!failed,report},null,2));
}finally{await source.end();await target.end()}
process.exit(failed?1:0);
