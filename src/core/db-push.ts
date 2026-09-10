import { pool, ensureTenantRLS } from './db';
import { logger } from './logger';

export async function pushDatabaseSchema() {
  const client = await pool.connect();
  try {
    logger.info('Connecting to PostgreSQL database for non-destructive schema synchronization...');

    // 1. Apply table definitions and ensure RLS policies
    logger.info('Applying extension tables and tenant Row Level Security (RLS) policies...');
    await ensureTenantRLS(client);

    // 2. Ensure new permissions are seeded
    logger.info('Synchronizing granular permissions catalog...');
    const permissions = [
      ['attendance.employee.read', 'attendance', 'View staff and employee attendance records', ['institution', 'self']],
      ['attendance.employee.create', 'attendance', 'Record daily staff and employee attendance', ['institution']],
      ['users.impersonate', 'core', 'Impersonate institutional members for support and administration', ['institution']],
    ];

    for (const [key, moduleKey, desc, scopes] of permissions) {
      await client.query(
        `insert into public.permission (key, module_id, description, scope_options)
         values ($1, (select id from public.module where key = $2), $3, $4)
         on conflict (key) do update set description = excluded.description, scope_options = excluded.scope_options`,
        [key, moduleKey, desc, scopes]
      );
    }

    // 3. Ensure Institution Admin has the new permissions
    logger.info('Ensuring administrative role grants for newly registered permissions...');
    const adminPermKeys = ['attendance.employee.read', 'attendance.employee.create', 'users.impersonate'];
    
    // Find all Institution Admin roles (system template + tenant instances)
    const { rows: adminRoles } = await client.query(
      `select id, institution_id from public.role where lower(name) = 'institution admin'`
    );

    for (const role of adminRoles) {
      for (const permKey of adminPermKeys) {
        await client.query(
          `insert into public.role_permission (institution_id, role_id, permission_id, scope)
           values ($1, $2, (select id from public.permission where key = $3), 'institution')
           on conflict (role_id, permission_id) do update set scope = 'institution'`,
          [role.institution_id, role.id, permKey]
        );
      }
    }

    logger.info('Database schema push complete! All tables, policies, and permissions are synchronized.');
  } finally {
    client.release();
  }
}

if (require.main === module) {
  pushDatabaseSchema()
    .then(() => {
      console.log('Database push succeeded.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Database push failed:', err);
      process.exit(1);
    });
}
