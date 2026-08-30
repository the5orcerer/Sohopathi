import { pool } from '../src/core/db';

async function cleanupDuplicateRoles() {
  const client = await pool.connect();
  try {
    console.log('🧹 Deduplicating roles and role_permissions in database...');

    await client.query('BEGIN');

    // 1. Find all distinct (coalesce(institution_id, '00000000-0000-0000-0000-000000000000'), name) groups
    const { rows: groups } = await client.query(`
      select 
        coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid) as inst_key,
        institution_id,
        name,
        array_agg(id order by id) as role_ids
      from role
      group by coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid), institution_id, name
      having count(*) > 1
    `);

    console.log(`Found ${groups.length} duplicate role groups.`);

    for (const g of groups) {
      const canonicalRoleId = g.role_ids[0];
      const duplicateRoleIds = g.role_ids.slice(1);

      console.log(`   Keeping canonical role "${g.name}" (${canonicalRoleId}), merging ${duplicateRoleIds.length} duplicates...`);

      // Update memberships pointing to duplicate roles
      await client.query(
        `update membership set role_id = $1 where role_id = any($2)`,
        [canonicalRoleId, duplicateRoleIds]
      );

      // Merge role_permissions: insert missing permissions to canonical role
      await client.query(
        `insert into role_permission (institution_id, role_id, permission_id, scope)
         select distinct on (rp.permission_id) rp.institution_id, $1, rp.permission_id, rp.scope
         from role_permission rp
         where rp.role_id = any($2)
         on conflict (role_id, permission_id) do update set scope = excluded.scope`,
        [canonicalRoleId, duplicateRoleIds]
      );

      // Delete role_permissions for duplicate roles
      await client.query(
        `delete from role_permission where role_id = any($1)`,
        [duplicateRoleIds]
      );

      // Delete duplicate roles
      await client.query(
        `delete from role where id = any($1)`,
        [duplicateRoleIds]
      );
    }

    // 2. Add Unique index to permanently prevent duplicate roles
    console.log('🔒 Creating unique index on role (institution_id, name)...');
    await client.query(`
      create unique index if not exists idx_role_institution_name_unique
      on role (coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
    `);

    await client.query('COMMIT');
    console.log('✅ Role deduplication complete! All duplicates cleaned up and unique constraint added.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('❌ Deduplication error:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

cleanupDuplicateRoles();
