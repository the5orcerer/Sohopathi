import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface TargetDb {
  name: string;
  url: string;
  isCloud?: boolean;
}

async function migrateDatabase(target: TargetDb) {
  console.log(`\n============================================================`);
  console.log(`🚀 Migrating: ${target.name}`);
  console.log(`============================================================`);

  const cleanUrl = target.url.replace(/[\?&]sslmode=[^&]+/, '');
  const isLocal = cleanUrl.includes('127.0.0.1') || cleanUrl.includes('localhost');

  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 15000,
  });

  try {
    const client = await pool.connect();
    try {
      console.log(`🔌 Connected successfully to ${target.name}`);

      // 1. Create template table if not exists
      console.log(`📦 Ensuring public.template table and indexes exist...`);
      await client.query(`
        create table if not exists public.template (
          id uuid primary key default gen_random_uuid(),
          institution_id uuid references public.institution(id) on delete cascade,
          type text not null check (type in ('tc', 'marksheet', 'certificate', 'testimonial', 'admit_card', 'id_card')),
          name text not null,
          description text,
          content text not null,
          metadata jsonb default '{}'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create index if not exists idx_template_inst_type on public.template (institution_id, type);

        alter table public.template enable row level security;
        alter table public.template force row level security;
        drop policy if exists tenant_isolation on public.template;
        create policy tenant_isolation on public.template
          using (institution_id = public.current_institution_id() or institution_id is null or public.current_institution_id() is null);
      `);

      // 2. Grant permissions to app_user
      console.log(`🔑 Updating app_user permissions...`);
      await client.query(`
        do $$
        begin
          if exists (select 1 from pg_roles where rolname = 'app_user') then
            grant all on table public.template to app_user;
          end if;
        end $$;
      `);

      // 3. Ensure permissions exist in public.permission
      console.log(`🛡️ Registering template permissions...`);
      await client.query(`
        with m as (select id from public.module where key = 'core')
        insert into public.permission (key, module_id, description, scope_options)
        select p.key, m.id, p.description, p.scope_options
        from (values
          ('templates.read', 'View document templates and generated certificates', array['institution', 'assigned_sections', 'self']),
          ('templates.manage', 'Create and edit document certificates and print templates', array['institution'])
        ) as p(key, description, scope_options)
        cross join m
        on conflict (key) do update set description = excluded.description, scope_options = excluded.scope_options;
      `);

      // 4. Grant template permissions to Institution Admin and Teacher
      console.log(`👥 Assigning template permissions to system roles...`);
      await client.query(`
        with r as (select id, name from public.role where institution_id is null),
             p as (select id, key from public.permission)
        insert into public.role_permission (institution_id, role_id, permission_id, scope)
        select null, r.id, p.id, g.scope
        from (values
          ('Institution Admin', 'templates.read', 'institution'),
          ('Institution Admin', 'templates.manage', 'institution'),
          ('Teacher', 'templates.read', 'assigned_sections')
        ) as g(role_name, permission_key, scope)
        join r on r.name = g.role_name
        join p on p.key = g.permission_key
        on conflict (role_id, permission_id) do update set scope = excluded.scope;
      `);

      // 5. Seed templates for Dhaka Model or default institution
      console.log(`📄 Seeding canonical templates...`);
      const { rows: demoInst } = await client.query(`
        select id from public.institution where id = 'f2c10000-0000-0000-0000-000000000001' or subdomain = 'dhakamodel' limit 1
      `);

      const instId = demoInst.length > 0 ? demoInst[0].id : null;

      if (instId) {
        const seedPath = path.resolve(__dirname, '../db/seed.sql');
        const seedSql = fs.readFileSync(seedPath, 'utf8');

        const templateInsertIdx = seedSql.indexOf('-- Document & Certificate Templates');
        if (templateInsertIdx !== -1) {
          const templateSql = seedSql.substring(templateInsertIdx);
          await client.query(templateSql);
          console.log(`✅ Seeded canonical document templates for institution ${instId}`);
        }
      }

      // Verify row counts
      const { rows: tmplCount } = await client.query(`select count(*) as count from public.template`);
      const { rows: permCount } = await client.query(`select count(*) as count from public.permission where key like 'templates.%'`);
      console.log(`✨ Status on ${target.name}: ${tmplCount[0].count} templates present, ${permCount[0].count} template permissions configured.`);

    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error(`❌ Migration failed for ${target.name}:`, err);
    throw err;
  } finally {
    await pool.end();
  }
}

async function main() {
  const localUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5433/biddyapith_dev';

  let prodUrl: string | undefined;
  const prodEnvPath = path.resolve(__dirname, '../.env.production');
  if (fs.existsSync(prodEnvPath)) {
    const parsed = dotenv.parse(fs.readFileSync(prodEnvPath));
    prodUrl = parsed.DATABASE_URL;
  }

  const targets: TargetDb[] = [
    { name: 'Local PostgreSQL (Docker)', url: localUrl, isCloud: false },
  ];

  if (prodUrl) {
    targets.push({ name: 'Aiven Cloud PostgreSQL (Production)', url: prodUrl, isCloud: true });
  }

  console.log(`Starting dual-database migration across ${targets.length} target(s)...`);

  for (const target of targets) {
    try {
      await migrateDatabase(target);
    } catch (err) {
      console.error(`⚠️ Notice: Encountered issue with ${target.name}`);
      if (!target.isCloud) {
        process.exit(1);
      }
    }
  }

  console.log(`\n🎉 Dual-database migrations completed successfully!`);
}

main().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
