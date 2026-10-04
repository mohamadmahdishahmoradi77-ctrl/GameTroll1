import mysql from 'mysql2/promise';

const mysqlEnabled = Boolean(process.env.MYSQL_URL || process.env.MYSQL_HOST || process.env.MYSQL_DATABASE);
const postgresEnabled = Boolean(process.env.DATABASE_URL) && !mysqlEnabled;
// MySQL is optional; when it is not configured, the existing SQLite fallback is used.
let sqlite, pool;

// The schema uses VARCHAR for identifiers/short searchable fields so it works with
// MySQL primary keys and indexes, while long user content remains TEXT.
const schema = `
CREATE TABLE IF NOT EXISTS users (
 id VARCHAR(191) PRIMARY KEY, username VARCHAR(191) NOT NULL UNIQUE, email VARCHAR(191) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, role VARCHAR(30) NOT NULL DEFAULT 'user', status VARCHAR(30) NOT NULL DEFAULT 'active',
 avatar_url VARCHAR(1000), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL, expires_at TIMESTAMP NOT NULL, revoked_at TIMESTAMP NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS password_resets (
 id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL, token_hash VARCHAR(255) NOT NULL UNIQUE, expires_at TIMESTAMP NOT NULL,
 used_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_settings (
 user_id VARCHAR(191) PRIMARY KEY, support_notifications TINYINT NOT NULL DEFAULT 1,
 order_notifications TINYINT NOT NULL DEFAULT 1, content_notifications TINYINT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS games (
 id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) NOT NULL, short_description TEXT, description TEXT, img VARCHAR(1000),
 platform VARCHAR(100), console VARCHAR(100), genre VARCHAR(100), year INTEGER, version VARCHAR(100), tags VARCHAR(500), pack VARCHAR(191),
 link VARCHAR(2000), status VARCHAR(30) NOT NULL DEFAULT 'published', created_by VARCHAR(191), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS packs (
 id VARCHAR(191) PRIMARY KEY, name VARCHAR(255) NOT NULL, short TEXT, description TEXT, img VARCHAR(1000), price INTEGER DEFAULT 0,
 old_price INTEGER DEFAULT 0, status VARCHAR(30) NOT NULL DEFAULT 'published', link VARCHAR(2000), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pack_games (pack_id VARCHAR(191) NOT NULL, game_id VARCHAR(191) NOT NULL, PRIMARY KEY(pack_id,game_id));
CREATE INDEX IF NOT EXISTS idx_pack_games_game ON pack_games(game_id);
CREATE TABLE IF NOT EXISTS news (
 id VARCHAR(191) PRIMARY KEY, title VARCHAR(500) NOT NULL, summary TEXT, content TEXT, img VARCHAR(1000), published_at TIMESTAMP NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'published', created_by VARCHAR(191), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(status,published_at,created_at);
CREATE TABLE IF NOT EXISTS tutorials (
 id VARCHAR(191) PRIMARY KEY, title VARCHAR(500) NOT NULL, content TEXT, category VARCHAR(100), img VARCHAR(1000), published_at TIMESTAMP NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'published', created_by VARCHAR(191), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS favorites (user_id VARCHAR(191) NOT NULL, game_id VARCHAR(191) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,game_id));
CREATE TABLE IF NOT EXISTS orders (
 id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191), customer_name VARCHAR(255), customer_contact VARCHAR(500), item_type VARCHAR(100) NOT NULL, item_id VARCHAR(191) NOT NULL,
 item_name VARCHAR(500), amount INTEGER DEFAULT 0, status VARCHAR(30) NOT NULL DEFAULT 'pending', receipt VARCHAR(2000), note TEXT,
 approved_at TIMESTAMP NULL, approved_by VARCHAR(191), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tickets (
 id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL, subject VARCHAR(500) NOT NULL, type VARCHAR(100) NOT NULL, description TEXT NOT NULL,
 game_id VARCHAR(191), pack_id VARCHAR(191), priority VARCHAR(30) NOT NULL DEFAULT 'normal', status VARCHAR(30) NOT NULL DEFAULT 'investigating', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ticket_messages (id VARCHAR(191) PRIMARY KEY, ticket_id VARCHAR(191) NOT NULL, user_id VARCHAR(191), is_admin TINYINT NOT NULL DEFAULT 0, message TEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS broken_links (id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191), game_id VARCHAR(191), pack_id VARCHAR(191), url VARCHAR(2000), reason VARCHAR(1000) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'open', admin_note TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications (id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191), type VARCHAR(100) NOT NULL, title VARCHAR(500) NOT NULL, body TEXT, read_at TIMESTAMP NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ratings (user_id VARCHAR(191) NOT NULL, game_id VARCHAR(191) NOT NULL, rating INTEGER NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,game_id));
CREATE TABLE IF NOT EXISTS reviews (id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL, game_id VARCHAR(191) NOT NULL, body TEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS review_reports (id VARCHAR(191) PRIMARY KEY, review_id VARCHAR(191) NOT NULL, user_id VARCHAR(191) NOT NULL, reason VARCHAR(1000) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pack_ratings (user_id VARCHAR(191) NOT NULL, pack_id VARCHAR(191) NOT NULL, rating INTEGER NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,pack_id));
CREATE TABLE IF NOT EXISTS pack_reviews (id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL, pack_id VARCHAR(191) NOT NULL, body TEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pack_review_reports (id VARCHAR(191) PRIMARY KEY, review_id VARCHAR(191) NOT NULL, user_id VARCHAR(191) NOT NULL, reason VARCHAR(1000) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_pack_reviews_pack ON pack_reviews(pack_id,status);
CREATE INDEX IF NOT EXISTS idx_pack_review_reports_review ON pack_review_reports(review_id);
CREATE TABLE IF NOT EXISTS audit_logs (id VARCHAR(191) PRIMARY KEY, admin_user_id VARCHAR(191), action VARCHAR(100) NOT NULL, entity_type VARCHAR(100), entity_id VARCHAR(191), metadata TEXT, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS site_status (key VARCHAR(191) PRIMARY KEY, status VARCHAR(30) NOT NULL, message TEXT, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS site_settings (key VARCHAR(191) PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS images (id VARCHAR(191) PRIMARY KEY, owner_id VARCHAR(191), filename VARCHAR(500), mime_type VARCHAR(150), size INTEGER, path VARCHAR(2000), created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS backups (id VARCHAR(191) PRIMARY KEY, filename VARCHAR(500) NOT NULL, path VARCHAR(2000) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS achievements (id VARCHAR(191) PRIMARY KEY, code VARCHAR(100) NOT NULL UNIQUE, name VARCHAR(200) NOT NULL, description VARCHAR(500) NOT NULL, icon VARCHAR(20) NOT NULL DEFAULT '🏆', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS user_achievements (user_id VARCHAR(191) NOT NULL, achievement_id VARCHAR(191) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,achievement_id));
CREATE TABLE IF NOT EXISTS recently_viewed (user_id VARCHAR(191) NOT NULL, game_id VARCHAR(191) NOT NULL, viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id,game_id));
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user ON recently_viewed(user_id,viewed_at);

CREATE INDEX IF NOT EXISTS idx_games_advanced ON games(status,console,platform,genre,year,pack,created_at);
CREATE INDEX IF NOT EXISTS idx_images_created ON images(created_at,owner_id);
CREATE INDEX IF NOT EXISTS idx_images_owner ON images(owner_id,created_at);
CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);
CREATE INDEX IF NOT EXISTS idx_packs_name ON packs(name);
CREATE INDEX IF NOT EXISTS idx_news_title ON news(title);
CREATE INDEX IF NOT EXISTS idx_tutorials_title ON tutorials(title);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_pack_reviews_user ON pack_reviews(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_game ON reviews(game_id,status);
CREATE INDEX IF NOT EXISTS idx_games_status_created ON games(status,created_at);
CREATE INDEX IF NOT EXISTS idx_packs_status_created ON packs(status,created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON favorites(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_user_updated ON tickets(user_id,updated_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id,created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry ON sessions(user_id,expires_at,revoked_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_expiry ON password_resets(user_id,expires_at,used_at);
CREATE INDEX IF NOT EXISTS idx_reviews_game_created ON reviews(game_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_pack_reviews_pack_created ON pack_reviews(pack_id,status,created_at);

`;

async function mysqlQuery(sql, params=[]) { return pool.query(sql, params); }

function parseMysqlConfig(){
  if(process.env.MYSQL_URL){
    const u = new URL(process.env.MYSQL_URL);
    return {host:u.hostname,port:Number(u.port||3306),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.replace(/^\//,'')};
  }
  return {
    host:process.env.MYSQL_HOST||'127.0.0.1', port:Number(process.env.MYSQL_PORT||3306),
    user:process.env.MYSQL_USER||process.env.DB_USER||'root', password:process.env.MYSQL_PASSWORD||process.env.DB_PASSWORD||'',
    database:process.env.MYSQL_DATABASE||process.env.DB_NAME||'game_troll'
  };
}

async function ensureMysqlSchema(){
  // MySQL does not support CREATE INDEX IF NOT EXISTS on all versions.
  // Execute table creation first, then create indexes idempotently.
  const statements = schema.split(';').map(s=>s.trim()).filter(Boolean).map(s=>s.replace(/CREATE INDEX IF NOT EXISTS/ig,'CREATE INDEX'));
  for(const statement of statements){
    try { await pool.query(statement); }
    catch(e){
      if(/^CREATE INDEX\b/i.test(statement) && /already exists|duplicate key name|duplicate key/i.test(String(e.message))) continue;
      throw e;
    }
  }
}

if(mysqlEnabled){
  pool = mysql.createPool({...parseMysqlConfig(),waitForConnections:true,connectionLimit:Number(process.env.DB_POOL_SIZE||5),charset:'utf8mb4'});
  await pool.query('SELECT 1');
  await ensureMysqlSchema();
  const migrations = [
    'ALTER TABLE games ADD COLUMN short_description TEXT',
    'ALTER TABLE games ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT \'published\'',
    'ALTER TABLE games ADD COLUMN tags VARCHAR(500)',
    'ALTER TABLE games ADD COLUMN created_by VARCHAR(191)',
    'ALTER TABLE packs ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT \'published\'',
    'ALTER TABLE packs ADD COLUMN description TEXT',
    'ALTER TABLE packs ADD COLUMN old_price INTEGER DEFAULT 0',
    'ALTER TABLE news ADD COLUMN summary TEXT',
    'ALTER TABLE news ADD COLUMN content TEXT',
    'ALTER TABLE news ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT \'published\'',
    'ALTER TABLE tutorials ADD COLUMN content TEXT',
    'ALTER TABLE tutorials ADD COLUMN category VARCHAR(100)',
    'ALTER TABLE tutorials ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT \'published\''
  ];
  for(const q of migrations){ try{await pool.query(q)}catch(e){if(!/Duplicate column|already exists|duplicate key name|already exists/i.test(String(e.message)))throw e} }
} else if(postgresEnabled){
  // PostgreSQL support is retained only for controlled legacy-data migration/compatibility.
  const pgLib = await import('pg');
  const {Pool} = pgLib.default || pgLib;
  pool = new Pool({connectionString:process.env.DATABASE_URL,max:5,ssl:{rejectUnauthorized:false}});
  await pool.query(schema.replaceAll('VARCHAR(191)','TEXT').replaceAll('VARCHAR(255)','TEXT').replaceAll('VARCHAR(500)','TEXT').replaceAll('VARCHAR(100)','TEXT').replaceAll('VARCHAR(30)','TEXT').replaceAll('VARCHAR(1000)','TEXT').replaceAll('VARCHAR(2000)','TEXT').replaceAll('TINYINT','INTEGER'));
} else {
  const sqliteLib = await import('better-sqlite3');
  const Database = sqliteLib.default || sqliteLib;
  sqlite = new Database(process.env.DB_PATH || './game-troll.sqlite');
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(schema.replaceAll('TIMESTAMP','TEXT').replaceAll(/VARCHAR\(\d+\)/g,'TEXT').replaceAll('TINYINT','INTEGER'));
}

const isMysql = mysqlEnabled;
const isPg = postgresEnabled;

const achievementSeed=[['first_favorite','اولین علاقه‌مندی','اولین بازی را به علاقه‌مندی‌ها اضافه کردی.','❤️'],['first_review','اولین دیدگاه','اولین دیدگاهت را ثبت کردی.','⭐'],['first_order','اولین سفارش','اولین سفارش خودت را ثبت کردی.','🛒'],['explorer','کاوشگر','حداقل ۱۰ بازی را مشاهده کردی.','🧭']];

function normalizeMysqlSql(sql){
  let s = sql;
  // PostgreSQL/SQLite ON CONFLICT ... DO NOTHING -> MySQL INSERT IGNORE.
  if(/INSERT\s+INTO/i.test(s) && /ON CONFLICT(?:\([^)]*\))?\s+DO NOTHING/i.test(s)){
    s = s.replace(/INSERT\s+INTO/i,'INSERT IGNORE INTO');
    s = s.replace(/\s+ON CONFLICT(?:\([^)]*\))?\s+DO NOTHING\s*$/i,'');
    return s;
  }
  // PostgreSQL ON CONFLICT (...) DO UPDATE SET x=EXCLUDED.x -> MySQL duplicate-key update.
  s = s.replace(/\s+ON CONFLICT\s*\([^)]*\)\s+DO UPDATE SET\s+/i,' ON DUPLICATE KEY UPDATE ');
  s = s.replace(/\bEXCLUDED\.([A-Za-z_][A-Za-z0-9_]*)/gi,'VALUES($1)');
  return s;
}

function toPg(sql){let n=0;return sql.replaceAll('?',()=>`$${++n}`)}

export const db={
 async all(sql,params=[]){
   if(isMysql){const [rows]=await mysqlQuery(normalizeMysqlSql(sql),params);return rows}
   if(isPg)return (await pool.query(toPg(sql),params)).rows;
   return sqlite.prepare(sql).all(...params)
 },
 async get(sql,params=[]){
   if(isMysql){const [rows]=await mysqlQuery(normalizeMysqlSql(sql),params);return rows[0]}
   if(isPg)return (await pool.query(toPg(sql),params)).rows[0];
   return sqlite.prepare(sql).get(...params)
 },
 async run(sql,params=[]){
   if(isMysql){const [result]=await mysqlQuery(normalizeMysqlSql(sql),params);return result}
   if(isPg)return pool.query(toPg(sql),params);
   return sqlite.prepare(sql).run(...params)
 },
 async upsert(table,columns,values){
   const ph=columns.map(()=>'?').join(',');
   const up=columns.filter(c=>c!=='id').map(c=>`${c}=VALUES(${c})`).join(',');
   if(isMysql){
     const [rows]=await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${ph}) ON DUPLICATE KEY UPDATE ${up}, updated_at=CURRENT_TIMESTAMP`,values);
     return await db.get(`SELECT * FROM ${table} WHERE id=?`,[values[columns.indexOf('id')]]);
   }
   if(isPg){
     const pgPh=columns.map((_,i)=>`$${i+1}`).join(',');
     const pgUp=columns.filter(c=>c!=='id').map(c=>`${c}=EXCLUDED.${c}`).join(',');
     return (await pool.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${pgPh}) ON CONFLICT(id) DO UPDATE SET ${pgUp}, updated_at=CURRENT_TIMESTAMP RETURNING *`,values)).rows[0]
   }
   const sqliteUp=columns.filter(c=>c!=='id').map(c=>`${c}=excluded.${c}`).join(',');
   sqlite.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${ph}) ON CONFLICT(id) DO UPDATE SET ${sqliteUp}, updated_at=CURRENT_TIMESTAMP`).run(...values);
   return sqlite.prepare(`SELECT * FROM ${table} WHERE id=?`).get(values[columns.indexOf('id')]);
 },
 async close(){if(isMysql&&pool)await pool.end();else if(isPg&&pool)await pool.end();else if(sqlite)sqlite.close()},
 async transaction(fn){
   if(isMysql){
     const c=await pool.getConnection();
     try{await c.beginTransaction();const tx={all:async(s,p=[])=>{const [r]=await c.query(normalizeMysqlSql(s),p);return r},get:async(s,p=[])=>{const [r]=await c.query(normalizeMysqlSql(s),p);return r[0]},run:async(s,p=[])=>{const [r]=await c.query(normalizeMysqlSql(s),p);return r}};const r=await fn(tx);await c.commit();return r}catch(e){await c.rollback();throw e}finally{c.release()}
   }
   if(isPg){const c=await pool.connect();try{await c.query('BEGIN');const tx={all:async(s,p=[])=> (await c.query(toPg(s),p)).rows,get:async(s,p=[])=> (await c.query(toPg(s),p)).rows[0],run:async(s,p=[])=>c.query(toPg(s),p)};const r=await fn(tx);await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
   const tx={all:async(s,p=[])=>sqlite.prepare(s).all(...p),get:async(s,p=[])=>sqlite.prepare(s).get(...p),run:async(s,p=[])=>sqlite.prepare(s).run(...p)};return fn(tx)
 }
};


// Seed achievements only after the db adapter has been initialized.
for(const [code,name,description,icon] of achievementSeed){if(isMysql)await db.run('INSERT IGNORE INTO achievements (id,code,name,description,icon) VALUES (?,?,?,?,?)',['ach-'+code,code,name,description,icon]);else if(isPg)await db.run('INSERT INTO achievements (id,code,name,description,icon) VALUES (?,?,?,?,?) ON CONFLICT(code) DO NOTHING',['ach-'+code,code,name,description,icon]);else await db.run('INSERT OR IGNORE INTO achievements (id,code,name,description,icon) VALUES (?,?,?,?,?)',['ach-'+code,code,name,description,icon]);}

// Backfill existing game-to-pack links without deleting or changing records.
if(isMysql){await db.run("INSERT IGNORE INTO pack_games (pack_id,game_id) SELECT pack,id FROM games WHERE COALESCE(pack,'')<>''");}
else if(isPg){await db.run("INSERT INTO pack_games (pack_id,game_id) SELECT pack,id FROM games WHERE COALESCE(pack,'')<>'' ON CONFLICT DO NOTHING");}
else {db.run("INSERT INTO pack_games (pack_id,game_id) SELECT pack,id FROM games WHERE COALESCE(pack,'')<>'' ON CONFLICT DO NOTHING");}

// Normalize legacy ticket statuses. The ticket workflow intentionally has only three states.
await db.run("UPDATE tickets SET status='investigating' WHERE status IN ('new','open','pending','resolved')");
