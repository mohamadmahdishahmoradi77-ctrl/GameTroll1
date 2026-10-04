import mysql from 'mysql2/promise';
import pg from 'pg';

const {Pool}=pg;
const tables=['users','user_settings','games','packs','pack_games','news','tutorials','images','favorites','orders','tickets','ticket_messages','reviews','pack_reviews','ratings','pack_ratings','review_reports','pack_review_reports','notifications','broken_links','audit_logs','site_status','site_settings','backups','sessions','password_resets'];
const batchSize=Math.max(100,Math.min(2000,Number(process.env.MIGRATION_BATCH_SIZE)||500));
const sourceUrl=process.env.SOURCE_DATABASE_URL||process.env.DATABASE_URL;
const targetUrl=process.env.MYSQL_URL;
const apply=process.env.MIGRATION_APPLY==='YES';
const backupConfirmed=process.env.BACKUP_CONFIRMED==='YES';
if(!sourceUrl||!targetUrl){console.error('Set SOURCE_DATABASE_URL and MYSQL_URL.');process.exit(2)}
if(apply&&!backupConfirmed){console.error('Refusing to modify MySQL: set BACKUP_CONFIRMED=YES only after a verified target backup.');process.exit(2)}
const source=new Pool({connectionString:sourceUrl,ssl:{rejectUnauthorized:false},max:2});
const target=mysql.createPool({uri:targetUrl,waitForConnections:true,connectionLimit:2,charset:'utf8mb4'});
async function sourceColumns(table){const r=await source.query('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position',[table]);return r.rows.map(x=>x.column_name)}
async function targetColumns(table){const [r]=await target.query('SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? ORDER BY ordinal_position',[table]);return r.map(x=>x.COLUMN_NAME||x.column_name)}
async function countSource(table){return Number((await source.query(`SELECT COUNT(*)::bigint c FROM "${table}"`)).rows[0].c)}
async function countTarget(table){const [r]=await target.query(`SELECT COUNT(*) c FROM \`${table}\``);return Number(r[0].c)}
async function migrateTable(table){
  const [sc,tc]=await Promise.all([sourceColumns(table),targetColumns(table)]);
  if(!sc.length||!tc.length){return {table,skipped:true,sourceColumns:sc.length,targetColumns:tc.length}}
  const columns=sc.filter(c=>tc.includes(c));
  if(!columns.includes('id')&&!['favorites','pack_games','ratings','pack_ratings','user_settings'].includes(table))return {table,skipped:true,reason:'no common primary-key column'};
  const quoted=columns.map(c=>'`'+c.replaceAll('`','``')+'`').join(',');
  const placeholders=columns.map(()=>'?').join(',');
  const updates=columns.filter(c=>c!=='id').map(c=>`\`${c.replaceAll('`','``')}\`=VALUES(\`${c.replaceAll('`','``')}\`)`).join(',');
  const sourceSelect=columns.map(c=>`"${c.replaceAll('"','""')}"`).join(',');
  let offset=0,inserted=0;
  while(true){
    const rows=(await source.query(`SELECT ${sourceSelect} FROM "${table}" ORDER BY 1 OFFSET $1 LIMIT $2`,[offset,batchSize])).rows;
    if(!rows.length)break;
    const values=[];for(const row of rows)for(const c of columns)values.push(row[c]);
    const sql=`INSERT INTO \`${table}\` (${quoted}) VALUES ${rows.map(()=>`(${placeholders})`).join(',')}${updates?` ON DUPLICATE KEY UPDATE ${updates}`:''}`;
    if(apply)await target.query(sql,values);
    inserted+=rows.length;offset+=rows.length;
    if(rows.length<batchSize)break;
  }
  return {table,rowsRead:inserted,sourceCount:await countSource(table),targetCountAfter:apply?await countTarget(table):null,applied:apply};
}
try{
 console.log(JSON.stringify({mode:apply?'APPLY':'DRY_RUN',backupConfirmed, batchSize},null,2));
 for(const table of tables){
   const r=await migrateTable(table);console.log(JSON.stringify(r));
 }
 console.log(apply?'Migration finished without deleting target-only rows. Run validate-migration.mjs now.':'Dry run finished. No database was modified.');
}finally{await source.end();await target.end()}
