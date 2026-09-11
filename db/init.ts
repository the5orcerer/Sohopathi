import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export async function runDatabaseInit(options: { reset?: boolean; connectionString?: string } = {}) {
  const dbUrl =
    options.connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@127.0.0.1:5433/biddyapith_dev';

  const cleanUrl = dbUrl.replace(/[\?&]sslmode=[^&]+/, '');
  const isLocal = cleanUrl.includes('127.0.0.1') || cleanUrl.includes('localhost');

  console.log(`🔌 Connecting to database for initialization: ${isLocal ? 'Local PostgreSQL' : 'Remote Cloud DB'}`);
  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
  });

  const client = await pool.connect();
  try {
    if (options.reset) {
      console.log('🧹 Clean reset requested: dropping existing public & auth schemas...');
      await client.query(`
        drop schema if exists public cascade;
        create schema public;
        grant all on schema public to postgres;
        grant all on schema public to public;

        drop schema if exists auth cascade;
        create schema auth;
        grant all on schema auth to postgres;
        grant all on schema auth to public;
      `);
    }

    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📐 Applying canonical schema (db/schema.sql)...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schemaSql);
      console.log('✅ Schema successfully applied.');
    } else {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const seedPath = path.resolve(__dirname, 'seed.sql');
    if (fs.existsSync(seedPath)) {
      console.log('🌱 Applying seed data (db/seed.sql)...');
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await client.query(seedSql);
      console.log('✅ Seed data successfully synchronized.');
    }

    console.log('🎉 Database initialization complete!');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const isReset = process.argv.includes('--reset') || process.argv.includes('--fresh');
  runDatabaseInit({ reset: isReset })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Database initialization error:', err);
      process.exit(1);
    });
}

