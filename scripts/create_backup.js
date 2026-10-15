const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function backup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  console.log('Connected to PostgreSQL successfully!');

  // Get all table names in public schema
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map(r => r.table_name);
  console.log(`Found ${tables.length} tables in public schema.`);

  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup_${timestamp}.sql`);
  const stream = fs.createWriteStream(backupFile, { flags: 'w' });

  stream.write('-- QUE ERP PostgreSQL Backup\n');
  stream.write(`-- Date: ${new Date().toISOString()}\n\n`);
  stream.write('SET statement_timeout = 0;\nSET client_encoding = \'UTF8\';\n\n');

  let totalRows = 0;
  for (const table of tables) {
    const res = await client.query(`SELECT * FROM public."${table}"`);
    totalRows += res.rows.length;
    stream.write(`-- Table: ${table} (${res.rows.length} rows)\n`);
    for (const row of res.rows) {
      const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
      const vals = Object.values(row).map(val => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'number' || typeof val === 'boolean') return val;
        if (val instanceof Date) return `'${val.toISOString()}'`;
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return `'${String(val).replace(/'/g, "''")}'`;
      }).join(', ');
      stream.write(`INSERT INTO public."${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`);
    }
    stream.write('\n');
  }

  stream.end();
  client.release();
  await pool.end();
  console.log(`Backup completed successfully!`);
  console.log(`Tables: ${tables.length}, Total Rows: ${totalRows}`);
  console.log(`Backup file: ${backupFile}`);
}

backup().catch(err => {
  console.error('Backup error:', err);
  process.exit(1);
});
