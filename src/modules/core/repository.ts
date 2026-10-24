import { PoolClient } from 'pg';
import { appCache } from '../../core/cache';
import { logAudit } from '../../core/audit/audit-logger';
import { invalidateContextCache } from '../../core/permissions/resolve-permissions';
import { invalidateFeatureCache } from '../../core/permissions/feature-guard';
import { assertContentLength, CONTENT_LIMITS } from '../../core/validation/content-limits';
import { dispatchNotificationAndTask } from './notification-task-service';

export interface Institution {
  id: string;
  name: string;
  subdomain: string;
  instituteCode?: string;
  branding: any;
  status: string;
  createdAt: string;
}

export interface PermissionDefinition {
  id: string;
  key: string;
  moduleKey: string;
  moduleName: string;
  description: string;
  scopeOptions: string[];
}

export interface Role {
  id: string;
  institutionId: string | null;
  name: string;
  isSystem: boolean;
  memberCount?: number;
}

export interface RolePermissionGrant {
  permissionKey: string;
  scope: string;
  description?: string;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  username: string | null;
  roleId: string;
  roleName: string;
  status: string;
  inviteStatus: string;
  customFields?: Record<string, any>;
  createdAt: string;
}

export interface Student {
  id: string;
  institutionId: string;
  userId: string | null;
  admissionNo: string;
  name: string;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  createdAt: string;
  className?: string;
  sectionName?: string;
  classId?: string;
  sectionId?: string;
  rollNo?: string;
  customFields?: Record<string, any>;
  guardianName?: string;
  guardianPhone?: string;
  username?: string;
}

export async function generateUniqueStudentUsername(
  client: PoolClient,
  institutionId: string,
  studentName: string,
  admissionNo?: string
): Promise<string> {
  const cleanName = studentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join('.');

  const baseCandidate = cleanName || 'student';

  const { rows: existing } = await client.query(
    `select login_username from membership where institution_id = $1 and lower(login_username) = lower($2)`,
    [institutionId, baseCandidate]
  );

  if (existing.length === 0) {
    return baseCandidate;
  }

  if (admissionNo) {
    const cleanAdm = admissionNo.toLowerCase().replace(/[^a-z0-9]/g, '');
    const admCandidate = `${baseCandidate}.${cleanAdm}`;
    const { rows: admExisting } = await client.query(
      `select login_username from membership where institution_id = $1 and lower(login_username) = lower($2)`,
      [institutionId, admCandidate]
    );
    if (admExisting.length === 0) {
      return admCandidate;
    }
  }

  let counter = 1;
  while (true) {
    const seqCandidate = `${baseCandidate}${counter}`;
    const { rows: seqExisting } = await client.query(
      `select login_username from membership where institution_id = $1 and lower(login_username) = lower($2)`,
      [institutionId, seqCandidate]
    );
    if (seqExisting.length === 0) {
      return seqCandidate;
    }
    counter++;
  }
}

export async function provisionStudentUserAccount(
  client: PoolClient,
  institutionId: string,
  studentName: string,
  admissionNo: string,
  email?: string
): Promise<{ userId: string; username: string }> {
  const username = await generateUniqueStudentUsername(client, institutionId, studentName, admissionNo);
  const studentEmail = email?.trim().toLowerCase() || `${username}.${institutionId.substring(0, 8)}@student.local`;

  // Create or resolve auth.users
  const { rows: existingAuth } = await client.query(
    `select id from auth.users where lower(email) = lower($1) limit 1`,
    [studentEmail]
  );
  let userId: string;
  if (existingAuth.length > 0) {
    userId = existingAuth[0].id;
  } else {
    const { rows: newAuth } = await client.query(
      `insert into auth.users (id, email, raw_user_meta_data, aud, role)
       values (gen_random_uuid(), $1, $2, 'authenticated', 'authenticated')
       returning id`,
      [studentEmail, JSON.stringify({ name: studentName })]
    );
    userId = newAuth[0].id;
  }

  // Create or update profile with password changeme
  await client.query(
    `insert into profile (id, name, email, must_change_password, password_hash)
     values ($1, $2, $3, true, 'changeme')
     on conflict (id) do update set name = excluded.name, email = excluded.email, password_hash = coalesce(profile.password_hash, 'changeme')`,
    [userId, studentName, studentEmail]
  );

  // Resolve Student role ID
  const { rows: sRoles } = await client.query(
    `select id from role where (institution_id = $1 or institution_id is null) and lower(name) = 'student' order by institution_id nulls last limit 1`,
    [institutionId]
  );
  const studentRoleId = sRoles[0]?.id || null;

  // Create membership
  await client.query(
    `insert into membership (user_id, institution_id, role_id, login_username, status, invite_status)
     values ($1, $2, $3, $4, 'active', 'active')
     on conflict (user_id, institution_id) do update set login_username = excluded.login_username`,
    [userId, institutionId, studentRoleId, username]
  );

  return { userId, username };
}

export interface AcademicYear {
  id: string;
  institutionId: string;
  label: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Class {
  id: string;
  institutionId: string;
  academicYearId: string;
  academicYearLabel?: string;
  name: string;
  sortOrder: number;
  sectionCount?: number;
}

export interface Section {
  id: string;
  institutionId: string;
  classId: string;
  className?: string;
  name: string;
  capacity: number | null;
  studentCount?: number;
}

export interface Subject {
  id: string;
  institutionId: string;
  name: string;
  code: string | null;
}

export interface ClassSubjectTeacher {
  id: string;
  institutionId: string;
  sectionId: string;
  sectionName?: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherMembershipId: string;
  teacherName?: string;
}

export interface Enrollment {
  id: string;
  institutionId: string;
  studentId: string;
  studentName?: string;
  admissionNo?: string;
  academicYearId: string;
  classId: string;
  className?: string;
  sectionId: string;
  sectionName?: string;
  rollNo: string | null;
  status: string;
  enrolledAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  institutionId: string;
  entityType: 'student' | 'member' | 'class' | 'section';
  label: string;
  fieldKey: string;
  fieldType: 'text' | 'number' | 'select' | 'date' | 'boolean' | 'tag';
  options: string[];
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ClassSchedule {
  id: string;
  institutionId: string;
  sectionId: string;
  sectionName?: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherMembershipId: string | null;
  teacherName?: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomNo: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  institutionId: string;
  actorMembershipId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  reason?: string | null;
  createdAt: string;
}

export interface StudentAcademicHistory {
  student: Student;
  enrollments: Array<{
    id: string;
    academicYearLabel: string;
    className: string;
    sectionName: string;
    rollNo: string | null;
    status: string;
    enrolledAt: string;
  }>;
  attendanceStats: {
    totalDays: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    attendanceRate: number;
    recentRecords: Array<{
      date: string;
      status: string;
    }>;
  };
  examMarks: Array<{
    examName: string;
    term: string | null;
    subjectName: string;
    marksObtained: number | null;
    maxMarks: number;
    grade: string | null;
  }>;
  guardians: Array<{
    id: string;
    name: string;
    phone: string | null;
    relation: string | null;
    isPrimary: boolean;
  }>;
}

export const coreRepository = {
  // --- Institutions ---
  async createInstitution(
    client: PoolClient,
    data: { name: string; subdomain: string; branding?: any }
  ): Promise<Institution> {
    const { rows } = await client.query(
      `insert into institution (name, subdomain, branding, status)
       values ($1, $2, $3, 'active')
       returning id, name, subdomain, branding, status, created_at as "createdAt"`,
      [data.name, data.subdomain.toLowerCase(), data.branding ? JSON.stringify(data.branding) : null]
    );
    const inst = rows[0];
    await logAudit(client, { institutionId: inst.id, action: 'create', entityType: 'institution', entityId: inst.id, after: inst });
    return inst;
  },

  async getInstitution(client: PoolClient, institutionId: string): Promise<Institution | null> {
    const { rows } = await client.query(
      `select id, name, subdomain, branding, status, created_at as "createdAt" from institution where id = $1`,
      [institutionId]
    );
    return rows[0] || null;
  },

  // --- Permissions Catalog & Dynamic Matrix ---
  async listPermissions(client: PoolClient): Promise<PermissionDefinition[]> {
    const { rows } = await client.query(`
      select 
        p.id,
        p.key,
        m.key as "moduleKey",
        m.name as "moduleName",
        p.description,
        p.scope_options as "scopeOptions"
      from permission p
      join module m on m.id = p.module_id
      order by m.name asc, p.key asc
    `);
    return rows;
  },

  async listRoles(
    client: PoolClient,
    institutionId: string,
    options?: { excludeNonEmployeeRoles?: boolean }
  ): Promise<Role[]> {
    let whereClause = `where (r.institution_id = $1 or r.institution_id is null)`;
    const params: any[] = [institutionId];

    if (options?.excludeNonEmployeeRoles) {
      whereClause += ` and lower(r.name) not in ('student', 'guardian')`;
    }

    const query = `
      with ranked_roles as (
        select distinct on (lower(r.name))
          r.id,
          r.institution_id as "institutionId",
          r.name,
          r.is_system as "isSystem",
          (select count(*)::int from membership m where m.role_id = r.id and m.institution_id = $1) as "memberCount"
        from role r
        ${whereClause}
        order by lower(r.name), r.institution_id nulls last
      )
      select * from ranked_roles order by name asc
    `;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async createRole(
    client: PoolClient,
    institutionId: string,
    data: { name: string; templateRoleId?: string },
    actorMembershipId?: string
  ): Promise<Role> {
    const { rows: [role] } = await client.query(
      `insert into role (institution_id, name, is_system)
       values ($1, $2, false)
       returning id, institution_id as "institutionId", name, is_system as "isSystem"`,
      [institutionId, data.name.trim()]
    );

    if (data.templateRoleId) {
      await client.query(
        `insert into role_permission (institution_id, role_id, permission_id, scope)
         select $1, $2, permission_id, scope
         from role_permission
         where role_id = $3
         on conflict (role_id, permission_id) do nothing`,
        [institutionId, role.id, data.templateRoleId]
      );
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create',
      entityType: 'role',
      entityId: role.id,
      after: role,
    });
    return role;
  },

  async getRolePermissions(client: PoolClient, roleId: string): Promise<RolePermissionGrant[]> {
    const { rows } = await client.query(
      `select 
        p.key as "permissionKey",
        rp.scope,
        p.description
       from role_permission rp
       join permission p on p.id = rp.permission_id
       where rp.role_id = $1
       order by p.key asc`,
      [roleId]
    );
    return rows;
  },

  async updateRolePermissions(
    client: PoolClient,
    institutionId: string,
    roleId: string,
    permissions: Array<{ permissionKey: string; scope: string }>,
    actorMembershipId?: string
  ): Promise<void> {
    const { rows: beforeRows } = await client.query(
      `select p.key, rp.scope from role_permission rp join permission p on p.id = rp.permission_id where rp.role_id = $1`,
      [roleId]
    );

    await client.query(`delete from role_permission where role_id = $1`, [roleId]);

    for (const p of permissions) {
      const { rows: pRows } = await client.query(`select id from permission where key = $1 limit 1`, [p.permissionKey]);
      if (pRows.length === 0) continue;
      await client.query(
        `insert into role_permission (institution_id, role_id, permission_id, scope)
         values ($1, $2, $3, $4)
         on conflict (role_id, permission_id) do update set scope = excluded.scope`,
        [institutionId, roleId, pRows[0].id, p.scope]
      );
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update_permissions',
      entityType: 'role_permission',
      entityId: roleId,
      before: beforeRows,
      after: permissions,
    });
  },

  // --- Memberships (Employees / Staff) ---
  async listMembers(client: PoolClient, institutionId: string): Promise<Member[]> {
    const { rows } = await client.query(
      `select distinct on (m.id)
        m.id,
        m.user_id as "userId",
        p.name,
        coalesce(u.email, p.email, '') as email,
        p.phone,
        m.login_username as "username",
        coalesce(r.id, m.role_id) as "roleId",
        coalesce(r.name, 'Member') as "roleName",
        m.status,
        m.invite_status as "inviteStatus",
        coalesce(m.custom_fields, '{}'::jsonb) as "customFields",
        m.created_at as "createdAt"
       from membership m
       join profile p on p.id = m.user_id
       left join auth.users u on u.id = m.user_id
       left join role r on r.id = m.role_id
       where m.institution_id = $1
         and lower(coalesce(r.name, '')) not in ('student', 'guardian')
       order by m.id, m.created_at desc`,
      [institutionId]
    );
    return rows;
  },

  async inviteMember(
    client: PoolClient,
    institutionId: string,
    data: { name: string; email: string; phone?: string; username?: string; roleId: string; temporaryPassword?: string; customFields?: Record<string, any> },
    actorMembershipId?: string
  ): Promise<Member> {
    const email = data.email.trim().toLowerCase();
    const tempPassword = data.temporaryPassword || 'password123';
    const username = (data.username || email.split('@')[0]).trim().toLowerCase();

    let userId: string;
    const { rows: authRows } = await client.query(`select id from auth.users where lower(email) = lower($1)`, [email]);
    if (authRows.length > 0) {
      userId = authRows[0].id;
    } else {
      const { rows: newAuth } = await client.query(
        `insert into auth.users (email, raw_user_meta_data)
         values ($1, $2)
         returning id`,
        [email, JSON.stringify({ name: data.name })]
      );
      userId = newAuth[0].id;
    }

    await client.query(
      `insert into profile (id, name, email, phone, must_change_password, password_hash, custom_fields)
       values ($1, $2, $3, $4, true, $5, $6)
       on conflict (id) do update 
       set name = excluded.name, 
           email = coalesce(excluded.email, profile.email),
           phone = coalesce(excluded.phone, profile.phone),
           must_change_password = true,
           password_hash = excluded.password_hash,
           custom_fields = coalesce(profile.custom_fields, '{}'::jsonb) || excluded.custom_fields`,
      [userId, data.name.trim(), email, data.phone || null, tempPassword, JSON.stringify(data.customFields || {})]
    );

    const { rows: memberRows } = await client.query(
      `insert into membership (user_id, institution_id, role_id, login_username, status, invite_status, custom_fields)
       values ($1, $2, $3, $4, 'active', 'invited', $5)
       on conflict (user_id, institution_id) do update 
       set role_id = excluded.role_id,
           login_username = excluded.login_username,
           status = 'active',
           custom_fields = coalesce(membership.custom_fields, '{}'::jsonb) || excluded.custom_fields
       returning id, created_at as "createdAt"`,
      [userId, institutionId, data.roleId, username, JSON.stringify(data.customFields || {})]
    );

    const { rows: roleRows } = await client.query(`select name from role where id = $1`, [data.roleId]);
    if (roleRows.length > 0 && ['guardian', 'student'].includes(roleRows[0].name.toLowerCase())) {
      throw new Error('Guardians and students cannot be invited as staff members. Use student/guardian management instead.');
    }

    const member: Member = {
      id: memberRows[0].id,
      userId,
      name: data.name.trim(),
      email,
      phone: data.phone || '',
      username,
      roleId: data.roleId,
      roleName: roleRows[0]?.name || 'Member',
      status: 'active',
      inviteStatus: 'invited',
      customFields: data.customFields || {},
      createdAt: memberRows[0].createdAt,
    };

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'invite',
      entityType: 'membership',
      entityId: member.id,
      after: member,
    });

    return member;
  },

  async updateMember(
    client: PoolClient,
    institutionId: string,
    memberId: string,
    data: { name?: string; phone?: string; email?: string; username?: string; roleId?: string; status?: string; customFields?: Record<string, any> },
    actorMembershipId?: string
  ): Promise<Member> {
    const { rows: beforeRows } = await client.query(
      `select m.id, m.user_id as "userId", p.name, coalesce(u.email, p.email, '') as email, p.phone, m.login_username as "username", m.role_id as "roleId", m.status
       from membership m
       join profile p on p.id = m.user_id
       left join auth.users u on u.id = m.user_id
       where m.id = $1 and m.institution_id = $2`,
      [memberId, institutionId]
    );
    if (beforeRows.length === 0) throw new Error('Member not found');
    const existing = beforeRows[0];

    if (data.roleId) {
      const { rows: roleRows } = await client.query(`select name from role where id = $1`, [data.roleId]);
      if (roleRows.length > 0 && ['guardian', 'student'].includes(roleRows[0].name.toLowerCase())) {
        throw new Error('Staff members cannot be assigned the Guardian or Student role.');
      }
    }

    if (data.name || data.phone !== undefined || data.email || data.customFields) {
      await client.query(
        `update profile set
           name = coalesce($1, name),
           phone = coalesce($2, phone),
           email = coalesce($3, email),
           custom_fields = coalesce(custom_fields, '{}'::jsonb) || $4::jsonb
         where id = $5`,
        [data.name?.trim() || null, data.phone ?? null, data.email?.trim() || null, JSON.stringify(data.customFields || {}), existing.userId]
      );
    }

    const { rows: updatedMemberRows } = await client.query(
      `update membership set
         role_id = coalesce($1, role_id),
         login_username = coalesce($2, login_username),
         status = coalesce($3, status),
         custom_fields = coalesce(custom_fields, '{}'::jsonb) || $4::jsonb
       where id = $5 and institution_id = $6
       returning id, user_id as "userId", role_id as "roleId", login_username as "username", status, invite_status as "inviteStatus", custom_fields as "customFields", created_at as "createdAt"`,
      [data.roleId || null, data.username?.trim().toLowerCase() || null, data.status || null, JSON.stringify(data.customFields || {}), memberId, institutionId]
    );

    const m = updatedMemberRows[0];
    const { rows: pRows } = await client.query(`select name, phone, email from profile where id = $1`, [existing.userId]);
    const { rows: rRows } = await client.query(`select name from role where id = $1`, [m.roleId]);

    const result: Member = {
      id: m.id,
      userId: m.userId,
      name: pRows[0]?.name || existing.name,
      email: pRows[0]?.email || existing.email,
      phone: pRows[0]?.phone ?? existing.phone,
      username: m.username,
      roleId: m.roleId,
      roleName: rRows[0]?.name || 'Member',
      status: m.status,
      inviteStatus: m.inviteStatus,
      customFields: m.customFields,
      createdAt: m.createdAt,
    };

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update',
      entityType: 'membership',
      entityId: memberId,
      before: existing,
      after: result,
    });

    return result;
  },

  async deleteMember(client: PoolClient, institutionId: string, memberId: string, actorMembershipId?: string): Promise<void> {
    await client.query(
      `update audit_log set actor_membership_id = null where actor_membership_id = $1 and institution_id = $2`,
      [memberId, institutionId]
    );
    const { rows } = await client.query(
      `delete from membership where id = $1 and institution_id = $2 returning id, user_id as "userId"`,
      [memberId, institutionId]
    );
    if (rows.length > 0) {
      await logAudit(client, {
        institutionId,
        actorMembershipId: actorMembershipId === memberId ? undefined : actorMembershipId,
        action: 'delete',
        entityType: 'membership',
        entityId: memberId,
        before: rows[0],
      });
    }
  },

  async bulkDeleteMembers(client: PoolClient, institutionId: string, memberIds: string[], actorMembershipId?: string): Promise<number> {
    await client.query(
      `update audit_log set actor_membership_id = null where actor_membership_id = any($1) and institution_id = $2`,
      [memberIds, institutionId]
    );
    const { rows } = await client.query(
      `delete from membership where id = any($1) and institution_id = $2 returning id`,
      [memberIds, institutionId]
    );
    if (rows.length > 0) {
      await logAudit(client, {
        institutionId,
        actorMembershipId,
        action: 'bulk_delete',
        entityType: 'membership',
        entityId: institutionId,
        after: { deletedCount: rows.length, ids: rows.map((r) => r.id) },
      });
    }
    return rows.length;
  },

  // --- Academic Structure ---
  async listAcademicYears(client: PoolClient, institutionId: string): Promise<AcademicYear[]> {
    const { rows } = await client.query(
      `select id, institution_id as "institutionId", label, start_date as "startDate", end_date as "endDate", is_current as "isCurrent"
       from academic_year where institution_id = $1 order by start_date desc`,
      [institutionId]
    );
    return rows;
  },

  async createAcademicYear(
    client: PoolClient,
    institutionId: string,
    data: { label: string; startDate: string; endDate: string; isCurrent?: boolean },
    actorMembershipId?: string
  ): Promise<AcademicYear> {
    if (data.isCurrent) {
      await client.query(`update academic_year set is_current = false where institution_id = $1`, [institutionId]);
    }
    const { rows } = await client.query(
      `insert into academic_year (institution_id, label, start_date, end_date, is_current)
       values ($1, $2, $3, $4, $5)
       returning id, institution_id as "institutionId", label, start_date as "startDate", end_date as "endDate", is_current as "isCurrent"`,
      [institutionId, data.label, data.startDate, data.endDate, !!data.isCurrent]
    );
    const ay = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'academic_year', entityId: ay.id, after: ay });
    return ay;
  },

  async listClasses(client: PoolClient, institutionId: string): Promise<Class[]> {
    const { rows } = await client.query(
      `select 
        c.id, 
        c.institution_id as "institutionId", 
        c.academic_year_id as "academicYearId", 
        ay.label as "academicYearLabel",
        c.name, 
        c.sort_order as "sortOrder",
        (select count(*)::int from section s where s.class_id = c.id) as "sectionCount"
       from class c
       left join academic_year ay on ay.id = c.academic_year_id
       where c.institution_id = $1
       order by c.sort_order asc, c.name asc`,
      [institutionId]
    );
    return rows;
  },

  async createClass(
    client: PoolClient,
    institutionId: string,
    data: { academicYearId: string; name: string; sortOrder?: number },
    actorMembershipId?: string
  ): Promise<Class> {
    const { rows } = await client.query(
      `insert into class (institution_id, academic_year_id, name, sort_order)
       values ($1, $2, $3, $4)
       returning id, institution_id as "institutionId", academic_year_id as "academicYearId", name, sort_order as "sortOrder"`,
      [institutionId, data.academicYearId, data.name.trim(), data.sortOrder ?? 10]
    );
    const cls = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'class', entityId: cls.id, after: cls });
    return cls;
  },

  async listSections(client: PoolClient, institutionId: string, classId?: string): Promise<Section[]> {
    let query = `
      select 
        s.id, 
        s.institution_id as "institutionId", 
        s.class_id as "classId", 
        c.name as "className",
        s.name, 
        s.capacity,
        s.class_teacher_membership_id as "classTeacherMembershipId",
        (select coalesce(p.name, p.email, 'Faculty') from membership m join profile p on p.id = m.user_id where m.id = s.class_teacher_membership_id limit 1) as "classTeacherName",
        (select count(*)::int from enrollment e where e.section_id = s.id and e.status = 'active') as "studentCount"
       from section s
       join class c on c.id = s.class_id
       where s.institution_id = $1
    `;
    const params: any[] = [institutionId];
    if (classId) {
      params.push(classId);
      query += ` and s.class_id = $2`;
    }
    query += ` order by c.sort_order asc, s.name asc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async createSection(
    client: PoolClient,
    institutionId: string,
    data: { classId: string; name: string; capacity?: number; classTeacherMembershipId?: string },
    actorMembershipId?: string
  ): Promise<Section> {
    const { rows } = await client.query(
      `insert into section (institution_id, class_id, name, capacity, class_teacher_membership_id)
       values ($1, $2, $3, $4, $5)
       returning id, institution_id as "institutionId", class_id as "classId", name, capacity, class_teacher_membership_id as "classTeacherMembershipId"`,
      [institutionId, data.classId, data.name.trim(), data.capacity || null, data.classTeacherMembershipId || null]
    );
    const section = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'section', entityId: section.id, after: section });
    return section;
  },

  async updateSection(
    client: PoolClient,
    institutionId: string,
    id: string,
    data: { name?: string; capacity?: number | null; classTeacherMembershipId?: string | null },
    actorMembershipId?: string
  ): Promise<Section> {
    const { rows: existingRows } = await client.query(
      `select id, institution_id as "institutionId", class_id as "classId", name, capacity, class_teacher_membership_id as "classTeacherMembershipId"
       from section where id = $1 and institution_id = $2`,
      [id, institutionId]
    );
    if (!existingRows[0]) {
      throw new Error('Section not found');
    }
    const existing = existingRows[0];

    const newName = data.name !== undefined ? data.name.trim() : existing.name;
    const newCapacity = data.capacity !== undefined ? data.capacity : existing.capacity;
    const newTeacher = data.classTeacherMembershipId !== undefined ? data.classTeacherMembershipId : existing.classTeacherMembershipId;

    const { rows } = await client.query(
      `update section
       set name = $1, capacity = $2, class_teacher_membership_id = $3
       where id = $4 and institution_id = $5
       returning id, institution_id as "institutionId", class_id as "classId", name, capacity, class_teacher_membership_id as "classTeacherMembershipId"`,
      [newName, newCapacity, newTeacher, id, institutionId]
    );
    const updated = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update',
      entityType: 'section',
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  },

  async listSubjects(client: PoolClient, institutionId: string): Promise<Subject[]> {
    const { rows } = await client.query(
      `select id, institution_id as "institutionId", name, code
       from subject where institution_id = $1 order by name asc`,
      [institutionId]
    );
    return rows;
  },

  async createSubject(
    client: PoolClient,
    institutionId: string,
    data: { name: string; code?: string },
    actorMembershipId?: string
  ): Promise<Subject> {
    const { rows } = await client.query(
      `insert into subject (institution_id, name, code)
       values ($1, $2, $3)
       returning id, institution_id as "institutionId", name, code`,
      [institutionId, data.name.trim(), data.code?.trim().toUpperCase() || null]
    );
    const subject = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'subject', entityId: subject.id, after: subject });
    return subject;
  },

  async listTeachers(client: PoolClient, institutionId: string): Promise<Array<{ membershipId: string; name: string; email: string }>> {
    const { rows } = await client.query(
      `select distinct on (m.id)
        m.id as "membershipId",
        p.name,
        coalesce(u.email, p.email, '') as email
       from membership m
       join profile p on p.id = m.user_id
       left join auth.users u on u.id = m.user_id
       join role r on r.id = m.role_id
       where m.institution_id = $1
         and m.status = 'active'
         and (lower(r.name) like '%teacher%' or lower(r.name) like '%admin%' or lower(r.name) like '%coordinator%' or lower(r.name) like '%faculty%')
       order by m.id, p.name asc`,
      [institutionId]
    );
    return rows;
  },

  async listClassSubjectTeachers(client: PoolClient, institutionId: string): Promise<ClassSubjectTeacher[]> {
    const { rows } = await client.query(
      `select 
        cst.id,
        cst.institution_id as "institutionId",
        cst.section_id as "sectionId",
        sec.name as "sectionName",
        cls.name as "className",
        cst.subject_id as "subjectId",
        sub.name as "subjectName",
        cst.teacher_membership_id as "teacherMembershipId",
        p.name as "teacherName"
       from class_subject_teacher cst
       join section sec on sec.id = cst.section_id
       join class cls on cls.id = sec.class_id
       join subject sub on sub.id = cst.subject_id
       join membership m on m.id = cst.teacher_membership_id
       join profile p on p.id = m.user_id
       where cst.institution_id = $1
       order by cls.sort_order asc, sec.name asc, sub.name asc`,
      [institutionId]
    );
    return rows;
  },

  async assignClassSubjectTeacher(
    client: PoolClient,
    institutionId: string,
    data: { sectionId: string; subjectId: string; teacherMembershipId: string },
    actorMembershipId?: string
  ): Promise<ClassSubjectTeacher> {
    const { rows } = await client.query(
      `insert into class_subject_teacher (institution_id, section_id, subject_id, teacher_membership_id)
       values ($1, $2, $3, $4)
       returning id, institution_id as "institutionId", section_id as "sectionId", subject_id as "subjectId", teacher_membership_id as "teacherMembershipId"`,
      [institutionId, data.sectionId, data.subjectId, data.teacherMembershipId]
    );
    const assignment = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'class_subject_teacher', entityId: assignment.id, after: assignment });
    return assignment;
  },

  // --- Students & Enrollments ---
  async listStudents(
    client: PoolClient,
    institutionId: string,
    filters?: {
      classId?: string;
      sectionId?: string;
      status?: string;
      grantedScope?: string;
      userId?: string;
      membershipId?: string;
    }
  ): Promise<Student[]> {
    let query = `
      select distinct on (s.id)
        s.id,
        s.institution_id as "institutionId",
        s.user_id as "userId",
        m.login_username as "username",
        s.admission_no as "admissionNo",
        s.name,
        s.date_of_birth as "dateOfBirth",
        s.gender,
        s.status,
        coalesce(s.custom_fields, '{}'::jsonb) as "customFields",
        s.created_at as "createdAt",
        cls.name as "className",
        sec.name as "sectionName",
        cls.id as "classId",
        sec.id as "sectionId",
        e.roll_no as "rollNo",
        g.name as "guardianName",
        g.phone as "guardianPhone"
       from student s
       left join membership m on m.user_id = s.user_id and m.institution_id = s.institution_id
       left join enrollment e on e.student_id = s.id and e.status = 'active'
       left join class cls on cls.id = e.class_id
       left join section sec on sec.id = e.section_id
       left join lateral (
         select sg.guardian_id
         from student_guardian sg
         where sg.student_id = s.id
         limit 1
       ) sg on true
       left join guardian g on g.id = sg.guardian_id
       where s.institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (filters?.grantedScope === 'self' && filters.userId) {
      params.push(filters.userId);
      query += ` and (s.user_id = $${params.length} or s.id in (select sg2.student_id from student_guardian sg2 join guardian g2 on g2.id = sg2.guardian_id where g2.user_id = $${params.length}))`;
    } else if (filters?.grantedScope === 'assigned_sections' && filters.membershipId) {
      const { rows: tSections } = await client.query(
        `select distinct section_id from class_subject_teacher where teacher_membership_id = $1 and institution_id = $2`,
        [filters.membershipId, institutionId]
      );
      const allowedSectionIds = tSections.map((r) => r.section_id);
      params.push(allowedSectionIds);
      query += ` and e.section_id = any($${params.length})`;
    }

    if (filters?.classId) {
      params.push(filters.classId);
      query += ` and e.class_id = $${params.length}`;
    }
    if (filters?.sectionId) {
      params.push(filters.sectionId);
      query += ` and e.section_id = $${params.length}`;
    }
    if (filters?.status) {
      params.push(filters.status);
      query += ` and s.status = $${params.length}`;
    }

    query += ` order by s.id, cls.sort_order asc, sec.name asc, e.roll_no asc, s.name asc`;

    const { rows } = await client.query(query, params);
    return rows;
  },

  async createStudent(
    client: PoolClient,
    institutionId: string,
    data: {
      admissionNo: string;
      name: string;
      dateOfBirth?: string;
      gender?: string;
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
      rollNo?: string;
      customFields?: Record<string, any>;
      guardianName?: string;
      guardianPhone?: string;
      guardianRelation?: string;
    },
    actorMembershipId?: string
  ): Promise<Student> {
    let studentUserId: string | null = null;
    let studentUsername: string | null = null;
    try {
      const provisioned = await provisionStudentUserAccount(
        client,
        institutionId,
        data.name.trim(),
        data.admissionNo.trim()
      );
      studentUserId = provisioned.userId;
      studentUsername = provisioned.username;
    } catch {
      // User account provisioning fallback
    }

    const { rows: studentRows } = await client.query(
      `insert into student (institution_id, admission_no, name, date_of_birth, gender, status, custom_fields, user_id)
       values ($1, $2, $3, $4, $5, 'active', $6, $7)
       returning id, institution_id as "institutionId", admission_no as "admissionNo", name, date_of_birth as "dateOfBirth", gender, status, custom_fields as "customFields", user_id as "userId", created_at as "createdAt"`,
      [institutionId, data.admissionNo.trim(), data.name.trim(), data.dateOfBirth || null, data.gender || 'Other', JSON.stringify(data.customFields || {}), studentUserId]
    );
    const student = {
      ...studentRows[0],
      username: studentUsername || undefined,
    };

    // Enroll in academic year if specified
    if (data.classId && data.sectionId) {
      let ayId = data.academicYearId;
      if (!ayId) {
        const { rows: ayRows } = await client.query(
          `select id from academic_year where institution_id = $1 and is_current = true limit 1`,
          [institutionId]
        );
        ayId = ayRows[0]?.id;
        if (ayRows.length > 0) ayId = ayRows[0].id;
      }

      if (ayId) {
        await client.query(
          `insert into enrollment (institution_id, student_id, academic_year_id, class_id, section_id, roll_no, status)
           values ($1, $2, $3, $4, $5, $6, 'active')
           on conflict (student_id, academic_year_id) do update 
           set class_id = excluded.class_id, section_id = excluded.section_id, roll_no = excluded.roll_no`,
          [institutionId, student.id, ayId, data.classId, data.sectionId, data.rollNo || null]
        );
      }
    }

    if (data.guardianName) {
      const { rows: gRows } = await client.query(
        `insert into guardian (institution_id, name, phone)
         values ($1, $2, $3)
         returning id`,
        [institutionId, data.guardianName.trim(), data.guardianPhone?.trim() || null]
      );
      await client.query(
        `insert into student_guardian (institution_id, student_id, guardian_id, relation_type, is_primary)
         values ($1, $2, $3, $4, true)
         on conflict do nothing`,
        [institutionId, student.id, gRows[0].id, data.guardianRelation?.trim() || 'Parent']
      );
    }

    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'student', entityId: student.id, after: student });
    return student;
  },

  async updateStudent(
    client: PoolClient,
    institutionId: string,
    studentId: string,
    data: {
      admissionNo?: string;
      name?: string;
      dateOfBirth?: string;
      gender?: string;
      status?: string;
      classId?: string;
      sectionId?: string;
      rollNo?: string;
      customFields?: Record<string, any>;
      guardianName?: string;
      guardianPhone?: string;
      guardianRelation?: string;
    },
    actorMembershipId?: string
  ): Promise<Student> {
    const { rows: beforeRows } = await client.query(
      `select s.id, s.admission_no as "admissionNo", s.name, s.date_of_birth as "dateOfBirth", s.gender, s.status, s.custom_fields as "customFields"
       from student s where s.id = $1 and s.institution_id = $2`,
      [studentId, institutionId]
    );
    if (beforeRows.length === 0) throw new Error('Student not found');
    const existing = beforeRows[0];

    const { rows: studentRows } = await client.query(
      `update student set
         admission_no = coalesce($1, admission_no),
         name = coalesce($2, name),
         date_of_birth = coalesce($3, date_of_birth),
         gender = coalesce($4, gender),
         status = coalesce($5, status),
         custom_fields = coalesce(custom_fields, '{}'::jsonb) || $6::jsonb
       where id = $7 and institution_id = $8
       returning id, institution_id as "institutionId", admission_no as "admissionNo", name, date_of_birth as "dateOfBirth", gender, status, custom_fields as "customFields", created_at as "createdAt"`,
      [
        data.admissionNo?.trim() || null,
        data.name?.trim() || null,
        data.dateOfBirth || null,
        data.gender || null,
        data.status || null,
        JSON.stringify(data.customFields || {}),
        studentId,
        institutionId,
      ]
    );
    const updated = studentRows[0];

    if (data.classId && data.sectionId) {
      const { rows: ayRows } = await client.query(
        `select id from academic_year where institution_id = $1 and is_current = true limit 1`,
        [institutionId]
      );
      if (ayRows.length > 0) {
        await client.query(
          `insert into enrollment (institution_id, student_id, academic_year_id, class_id, section_id, roll_no, status)
           values ($1, $2, $3, $4, $5, $6, 'active')
           on conflict (student_id, academic_year_id) do update 
           set class_id = excluded.class_id, section_id = excluded.section_id, roll_no = excluded.roll_no`,
          [institutionId, studentId, ayRows[0].id, data.classId, data.sectionId, data.rollNo || null]
        );
      }
    }

    if (data.guardianName) {
      const { rows: gLinkRows } = await client.query(
        `select guardian_id from student_guardian where student_id = $1 and is_primary = true limit 1`,
        [studentId]
      );
      if (gLinkRows.length > 0) {
        await client.query(
          `update guardian set name = $1, phone = $2 where id = $3`,
          [data.guardianName.trim(), data.guardianPhone?.trim() || null, gLinkRows[0].guardian_id]
        );
      } else {
        const { rows: newG } = await client.query(
          `insert into guardian (institution_id, name, phone) values ($1, $2, $3) returning id`,
          [institutionId, data.guardianName.trim(), data.guardianPhone?.trim() || null]
        );
        await client.query(
          `insert into student_guardian (institution_id, student_id, guardian_id, relation_type, is_primary)
           values ($1, $2, $3, $4, true) on conflict do nothing`,
          [institutionId, studentId, newG[0].id, data.guardianRelation?.trim() || 'Parent']
        );
      }
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update',
      entityType: 'student',
      entityId: studentId,
      before: existing,
      after: updated,
    });

    return updated;
  },

  async deleteStudent(client: PoolClient, institutionId: string, studentId: string, actorMembershipId?: string): Promise<void> {
    const { rows } = await client.query(
      `delete from student where id = $1 and institution_id = $2 returning id, name, admission_no as "admissionNo"`,
      [studentId, institutionId]
    );
    if (rows.length > 0) {
      await logAudit(client, {
        institutionId,
        actorMembershipId,
        action: 'delete',
        entityType: 'student',
        entityId: studentId,
        before: rows[0],
      });
    }
  },

  async bulkDeleteStudents(client: PoolClient, institutionId: string, studentIds: string[], actorMembershipId?: string): Promise<number> {
    const { rows } = await client.query(
      `delete from student where id = any($1) and institution_id = $2 returning id`,
      [studentIds, institutionId]
    );
    if (rows.length > 0) {
      await logAudit(client, {
        institutionId,
        actorMembershipId,
        action: 'bulk_delete',
        entityType: 'student',
        entityId: institutionId,
        after: { deletedCount: rows.length, ids: rows.map((r) => r.id) },
      });
    }
    return rows.length;
  },

  async getStudentAcademicHistory(
    client: PoolClient,
    institutionId: string,
    studentId: string,
    scopeContext?: { grantedScope?: string; userId?: string; membershipId?: string }
  ): Promise<StudentAcademicHistory> {
    if (scopeContext?.grantedScope === 'self' && scopeContext.userId) {
      const { rows: selfCheck } = await client.query(
        `select id from student where id = $1 and (user_id = $2 or id in (select sg.student_id from student_guardian sg join guardian g on g.id = sg.guardian_id where g.user_id = $2)) and institution_id = $3`,
        [studentId, scopeContext.userId, institutionId]
      );
      if (selfCheck.length === 0) {
        throw new Error('Access denied to student academic history');
      }
    }

    const { rows: sRows } = await client.query(
      `select 
        s.id,
        s.institution_id as "institutionId",
        s.user_id as "userId",
        s.admission_no as "admissionNo",
        s.name,
        s.date_of_birth as "dateOfBirth",
        s.gender,
        s.status,
        coalesce(s.custom_fields, '{}'::jsonb) as "customFields",
        s.created_at as "createdAt"
       from student s
       where s.id = $1 and s.institution_id = $2`,
      [studentId, institutionId]
    );
    if (sRows.length === 0) throw new Error('Student not found');
    const student = sRows[0];

    const { rows: enrollRows } = await client.query(
      `select 
        e.id,
        ay.label as "academicYearLabel",
        c.name as "className",
        sec.name as "sectionName",
        e.roll_no as "rollNo",
        e.status,
        e.enrolled_at as "enrolledAt"
       from enrollment e
       join academic_year ay on ay.id = e.academic_year_id
       join class c on c.id = e.class_id
       join section sec on sec.id = e.section_id
       where e.student_id = $1 and e.institution_id = $2
       order by ay.start_date desc, e.enrolled_at desc`,
      [studentId, institutionId]
    );

    const { rows: attRows } = await client.query(
      `select 
        count(*)::int as "totalDays",
        count(*) filter (where status = 'present')::int as "presentCount",
        count(*) filter (where status = 'absent')::int as "absentCount",
        count(*) filter (where status = 'late')::int as "lateCount",
        count(*) filter (where status = 'excused')::int as "excusedCount"
       from attendance
       where student_id = $1 and institution_id = $2`,
      [studentId, institutionId]
    );
    const totalDays = attRows[0]?.totalDays || 0;
    const presentCount = attRows[0]?.presentCount || 0;
    const absentCount = attRows[0]?.absentCount || 0;
    const lateCount = attRows[0]?.lateCount || 0;
    const excusedCount = attRows[0]?.excusedCount || 0;
    const rate = totalDays > 0 ? Number(((presentCount / totalDays) * 100).toFixed(1)) : 100;

    const { rows: recentAtt } = await client.query(
      `select date, status from attendance where student_id = $1 and institution_id = $2 order by date desc limit 20`,
      [studentId, institutionId]
    );

    const { rows: marksRows } = await client.query(
      `select 
        ex.name as "examName",
        ex.term,
        sub.name as "subjectName",
        m.marks_obtained as "marksObtained",
        m.max_marks as "maxMarks",
        m.grade
       from mark m
       join exam ex on ex.id = m.exam_id
       join subject sub on sub.id = m.subject_id
       where m.student_id = $1 and m.institution_id = $2
       order by ex.name asc, sub.name asc`,
      [studentId, institutionId]
    );

    const { rows: gRows } = await client.query(
      `select 
        g.id,
        g.name,
        g.phone,
        sg.relation_type as "relation",
        sg.is_primary as "isPrimary"
       from student_guardian sg
       join guardian g on g.id = sg.guardian_id
       where sg.student_id = $1 and sg.institution_id = $2
       order by sg.is_primary desc, g.name asc`,
      [studentId, institutionId]
    );

    return {
      student,
      enrollments: enrollRows,
      attendanceStats: {
        totalDays,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRate: rate,
        recentRecords: recentAtt,
      },
      examMarks: marksRows,
      guardians: gRows,
    };
  },

  // --- Class Timetables & Schedules ---
  async listSchedules(
    client: PoolClient,
    institutionId: string,
    filters?: {
      sectionId?: string;
      dayOfWeek?: string;
      grantedScope?: string;
      userId?: string;
      membershipId?: string;
    }
  ): Promise<ClassSchedule[]> {
    let query = `
      select 
        cs.id,
        cs.institution_id as "institutionId",
        cs.section_id as "sectionId",
        sec.name as "sectionName",
        cls.name as "className",
        cs.subject_id as "subjectId",
        sub.name as "subjectName",
        cs.teacher_membership_id as "teacherMembershipId",
        p.name as "teacherName",
        cs.day_of_week as "dayOfWeek",
        cs.start_time as "startTime",
        cs.end_time as "endTime",
        cs.room_no as "roomNo",
        cs.created_at as "createdAt"
       from class_schedule cs
       join section sec on sec.id = cs.section_id
       join class cls on cls.id = sec.class_id
       join subject sub on sub.id = cs.subject_id
       left join membership m on m.id = cs.teacher_membership_id
       left join profile p on p.id = m.user_id
       where cs.institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (filters?.grantedScope === 'self' && filters.userId) {
      params.push(filters.userId);
      query += ` and (
        cs.section_id in (select e.section_id from enrollment e join student s on s.id = e.student_id where s.user_id = $${params.length} and e.status = 'active')
        or cs.teacher_membership_id = (select m2.id from membership m2 where m2.user_id = $${params.length} and m2.institution_id = $1)
      )`;
    } else if (filters?.grantedScope === 'assigned_sections' && filters.membershipId) {
      const { rows: tSections } = await client.query(
        `select distinct section_id from class_subject_teacher where teacher_membership_id = $1 and institution_id = $2`,
        [filters.membershipId, institutionId]
      );
      const allowedSectionIds = tSections.map((r) => r.section_id);
      params.push(allowedSectionIds);
      query += ` and cs.section_id = any($${params.length})`;
    }
    if (filters?.sectionId) {
      params.push(filters.sectionId);
      query += ` and cs.section_id = $${params.length}`;
    }
    if (filters?.dayOfWeek) {
      params.push(filters.dayOfWeek);
      query += ` and lower(cs.day_of_week) = lower($${params.length})`;
    }
    query += ` order by case lower(cs.day_of_week)
      when 'sunday' then 1
      when 'monday' then 2
      when 'tuesday' then 3
      when 'wednesday' then 4
      when 'thursday' then 5
      when 'friday' then 6
      when 'saturday' then 7
      else 8 end, cs.start_time asc`;

    const { rows } = await client.query(query, params);
    return rows;
  },

  async createSchedule(
    client: PoolClient,
    institutionId: string,
    data: { sectionId: string; subjectId: string; teacherMembershipId?: string; dayOfWeek: string; startTime: string; endTime: string; roomNo?: string },
    actorMembershipId?: string
  ): Promise<ClassSchedule> {
    const { rows } = await client.query(
      `insert into class_schedule (institution_id, section_id, subject_id, teacher_membership_id, day_of_week, start_time, end_time, room_no)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, institution_id as "institutionId", section_id as "sectionId", subject_id as "subjectId", teacher_membership_id as "teacherMembershipId", day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime", room_no as "roomNo", created_at as "createdAt"`,
      [institutionId, data.sectionId, data.subjectId, data.teacherMembershipId || null, data.dayOfWeek, data.startTime, data.endTime, data.roomNo || null]
    );
    const schedule = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'class_schedule', entityId: schedule.id, after: schedule });
    return schedule;
  },

  async updateSchedule(
    client: PoolClient,
    institutionId: string,
    scheduleId: string,
    data: { subjectId?: string; teacherMembershipId?: string; dayOfWeek?: string; startTime?: string; endTime?: string; roomNo?: string },
    actorMembershipId?: string
  ): Promise<ClassSchedule> {
    const { rows } = await client.query(
      `update class_schedule set
         subject_id = coalesce($1, subject_id),
         teacher_membership_id = coalesce($2, teacher_membership_id),
         day_of_week = coalesce($3, day_of_week),
         start_time = coalesce($4, start_time),
         end_time = coalesce($5, end_time),
         room_no = coalesce($6, room_no)
       where id = $7 and institution_id = $8
       returning id, institution_id as "institutionId", section_id as "sectionId", subject_id as "subjectId", teacher_membership_id as "teacherMembershipId", day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime", room_no as "roomNo", created_at as "createdAt"`,
      [data.subjectId || null, data.teacherMembershipId || null, data.dayOfWeek || null, data.startTime || null, data.endTime || null, data.roomNo || null, scheduleId, institutionId]
    );
    const updated = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'update', entityType: 'class_schedule', entityId: scheduleId, after: updated });
    return updated;
  },

  async deleteSchedule(client: PoolClient, institutionId: string, scheduleId: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from class_schedule where id = $1 and institution_id = $2`, [scheduleId, institutionId]);
    await logAudit(client, { institutionId, actorMembershipId, action: 'delete', entityType: 'class_schedule', entityId: scheduleId });
  },

  // --- Dynamic Custom Fields Catalog ---
  async listCustomFields(client: PoolClient, institutionId: string, entityType?: string): Promise<CustomFieldDefinition[]> {
    let query = `
      select 
        id,
        institution_id as "institutionId",
        entity_type as "entityType",
        label,
        field_key as "fieldKey",
        field_type as "fieldType",
        options,
        is_required as "isRequired",
        sort_order as "sortOrder",
        created_at as "createdAt"
      from custom_field_definition
      where institution_id = $1
    `;
    const params: any[] = [institutionId];
    if (entityType) {
      params.push(entityType);
      query += ` and entity_type = $2`;
    }
    query += ` order by sort_order asc, label asc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async createCustomField(
    client: PoolClient,
    institutionId: string,
    data: { entityType: 'student' | 'member' | 'class' | 'section'; label: string; fieldKey?: string; fieldType?: string; options?: string[]; isRequired?: boolean; sortOrder?: number },
    actorMembershipId?: string
  ): Promise<CustomFieldDefinition> {
    const key = (data.fieldKey || data.label.toLowerCase().replace(/[^a-z0-9_]/g, '_')).trim();
    const { rows } = await client.query(
      `insert into custom_field_definition (institution_id, entity_type, label, field_key, field_type, options, is_required, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (institution_id, entity_type, field_key) do update 
       set label = excluded.label, field_type = excluded.field_type, options = excluded.options, is_required = excluded.is_required, sort_order = excluded.sort_order
       returning id, institution_id as "institutionId", entity_type as "entityType", label, field_key as "fieldKey", field_type as "fieldType", options, is_required as "isRequired", sort_order as "sortOrder", created_at as "createdAt"`,
      [institutionId, data.entityType, data.label.trim(), key, data.fieldType || 'text', JSON.stringify(data.options || []), !!data.isRequired, data.sortOrder ?? 0]
    );
    const field = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'custom_field_definition', entityId: field.id, after: field });
    return field;
  },

  async deleteCustomField(client: PoolClient, institutionId: string, fieldId: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from custom_field_definition where id = $1 and institution_id = $2`, [fieldId, institutionId]);
    await logAudit(client, { institutionId, actorMembershipId, action: 'delete', entityType: 'custom_field_definition', entityId: fieldId });
  },

  // --- Audit Trail & Activity Logs ---
  async listAuditLogs(
    client: PoolClient,
    institutionId: string,
    filters?: { action?: string; entityType?: string; actorMembershipId?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    let baseQuery = `
      from audit_log al
      left join membership m on m.id = al.actor_membership_id
      left join profile p on p.id = m.user_id
      left join role r on r.id = m.role_id
      where al.institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (filters?.action) {
      params.push(filters.action);
      baseQuery += ` and al.action = $${params.length}`;
    }
    if (filters?.entityType) {
      params.push(filters.entityType);
      baseQuery += ` and al.entity_type = $${params.length}`;
    }
    if (filters?.actorMembershipId) {
      params.push(filters.actorMembershipId);
      baseQuery += ` and al.actor_membership_id = $${params.length}`;
    }
    if (filters?.dateFrom) {
      params.push(filters.dateFrom);
      baseQuery += ` and al.created_at >= $${params.length}`;
    }
    if (filters?.dateTo) {
      params.push(filters.dateTo);
      baseQuery += ` and al.created_at <= $${params.length}`;
    }

    const { rows: countRows } = await client.query(`select count(*)::int as total ${baseQuery}`, params);
    const total = countRows[0]?.total || 0;

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    params.push(limit, offset);

    const query = `
      select 
        al.id,
        al.institution_id as "institutionId",
        al.actor_membership_id as "actorMembershipId",
        p.name as "actorName",
        r.name as "actorRole",
        al.action,
        al.entity_type as "entityType",
        al.entity_id as "entityId",
        al.before,
        al.after,
        al.reason,
        al.created_at as "createdAt"
      ${baseQuery}
      order by al.created_at desc
      limit $${params.length - 1} offset $${params.length}
    `;

    const { rows } = await client.query(query, params);
    return { logs: rows, total };
  },

  async bulkImportStudents(
    client: PoolClient,
    institutionId: string,
    students: Array<{
      admissionNo: string;
      name: string;
      gender?: string;
      dateOfBirth?: string;
      classId: string;
      sectionId: string;
      rollNo?: string;
      customFields?: Record<string, any>;
    }>,
    actorMembershipId?: string
  ): Promise<number> {
    let count = 0;
    const { rows: ayRows } = await client.query(
      `select id from academic_year where institution_id = $1 and is_current = true limit 1`,
      [institutionId]
    );
    const currentAyId = ayRows[0]?.id;

    for (const item of students) {
      const { rows: sRows } = await client.query(
        `insert into student (institution_id, admission_no, name, gender, date_of_birth, status, custom_fields)
         values ($1, $2, $3, $4, $5, 'active', $6)
         on conflict (institution_id, admission_no) do update set name = excluded.name, custom_fields = coalesce(student.custom_fields, '{}'::jsonb) || excluded.custom_fields
         returning id`,
        [institutionId, item.admissionNo.trim(), item.name.trim(), item.gender || 'Other', item.dateOfBirth || null, JSON.stringify(item.customFields || {})]
      );
      const studentId = sRows[0].id;

      if (currentAyId && item.classId && item.sectionId) {
        await client.query(
          `insert into enrollment (institution_id, student_id, academic_year_id, class_id, section_id, roll_no, status)
           values ($1, $2, $3, $4, $5, $6, 'active')
           on conflict (student_id, academic_year_id) do update 
           set class_id = excluded.class_id, section_id = excluded.section_id, roll_no = excluded.roll_no`,
          [institutionId, studentId, currentAyId, item.classId, item.sectionId, item.rollNo || null]
        );
      }
      count++;
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'bulk_import_students',
      entityType: 'student',
      entityId: institutionId,
      after: { importedCount: count },
    });

    return count;
  },

  async listEnrollments(client: PoolClient, institutionId: string, sectionId?: string): Promise<Enrollment[]> {
    let query = `
      select 
        e.id,
        e.institution_id as "institutionId",
        e.student_id as "studentId",
        s.name as "studentName",
        s.admission_no as "admissionNo",
        e.academic_year_id as "academicYearId",
        e.class_id as "classId",
        c.name as "className",
        e.section_id as "sectionId",
        sec.name as "sectionName",
        e.roll_no as "rollNo",
        e.status,
        e.enrolled_at as "enrolledAt"
       from enrollment e
       join student s on s.id = e.student_id
       join class c on c.id = e.class_id
       join section sec on sec.id = e.section_id
       where e.institution_id = $1
    `;
    const params: any[] = [institutionId];
    if (sectionId) {
      params.push(sectionId);
      query += ` and e.section_id = $2`;
    }
    query += ` order by c.sort_order asc, sec.name asc, e.roll_no asc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async createEnrollment(
    client: PoolClient,
    institutionId: string,
    data: { studentId: string; academicYearId: string; classId: string; sectionId: string; rollNo?: string },
    actorMembershipId?: string
  ): Promise<Enrollment> {
    const { rows } = await client.query(
      `insert into enrollment (institution_id, student_id, academic_year_id, class_id, section_id, roll_no, status)
       values ($1, $2, $3, $4, $5, $6, 'active')
       on conflict (student_id, academic_year_id) do update
       set class_id = excluded.class_id, section_id = excluded.section_id, roll_no = excluded.roll_no
       returning id, institution_id as "institutionId", student_id as "studentId", academic_year_id as "academicYearId", class_id as "classId", section_id as "sectionId", roll_no as "rollNo", status, enrolled_at as "enrolledAt"`,
      [institutionId, data.studentId, data.academicYearId, data.classId, data.sectionId, data.rollNo || null]
    );
    const enrollment = rows[0];
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'enrollment', entityId: enrollment.id, after: enrollment });
    return enrollment;
  },

  // --- In-App & Push Notifications Engine ---
  async listNotifications(
    client: PoolClient,
    institutionId: string,
    userId: string,
    membershipId: string,
    limit = 30
  ): Promise<{ notifications: any[]; unreadCount: number }> {
    const { rows: notifications } = await client.query(
      `select 
         id,
         institution_id as "institutionId",
         recipient_user_id as "recipientUserId",
         recipient_membership_id as "recipientMembershipId",
         title,
         body,
         type,
         coalesce(data, '{}'::jsonb) as data,
         is_read as "isRead",
         created_at as "createdAt"
       from notification
       where institution_id = $1
         and (recipient_membership_id = $2 or recipient_user_id = $3)
       order by created_at desc
       limit $4`,
      [institutionId, membershipId, userId, limit]
    );

    const cacheKey = `notif:unread:${institutionId}:${userId}:${membershipId}`;
    let unreadCount = appCache.get<number>(cacheKey);

    if (unreadCount === null) {
      const { rows: countRows } = await client.query(
        `select count(*)::int as "unreadCount"
         from notification
         where institution_id = $1
           and (recipient_membership_id = $2 or recipient_user_id = $3)
           and is_read = false`,
        [institutionId, membershipId, userId]
      );
      unreadCount = countRows[0]?.unreadCount || 0;
      appCache.set(cacheKey, unreadCount, 15);
    }

    return {
      notifications,
      unreadCount: unreadCount ?? 0,
    };
  },

  async createNotification(
    client: PoolClient,
    institutionId: string,
    data: {
      recipientUserId?: string;
      recipientMembershipId?: string;
      title: string;
      body: string;
      type?: string;
      data?: Record<string, any>;
    }
  ): Promise<any> {
    appCache.invalidatePrefix(`notif:unread:${institutionId}`);
    let targetUserId = data.recipientUserId;
    if (!targetUserId && data.recipientMembershipId) {
      const { rows } = await client.query(
        `select user_id from membership where id = $1 limit 1`,
        [data.recipientMembershipId]
      );
      if (rows.length > 0) targetUserId = rows[0].user_id;
    }

    const { rows } = await client.query(
      `insert into notification (institution_id, recipient_user_id, recipient_membership_id, title, body, type, data)
       values ($1, $2, $3, $4, $5, coalesce($6, 'general'), $7)
       returning id, institution_id as "institutionId", title, body, type, data, is_read as "isRead", created_at as "createdAt"`,
      [
        institutionId,
        targetUserId || null,
        data.recipientMembershipId || null,
        data.title,
        data.body,
        data.type || 'general',
        JSON.stringify(data.data || {}),
      ]
    );
    return rows[0];
  },

  async markNotificationRead(client: PoolClient, institutionId: string, notificationId: string): Promise<void> {
    appCache.invalidatePrefix(`notif:unread:${institutionId}`);
    await client.query(
      `update notification set is_read = true where id = $1 and institution_id = $2`,
      [notificationId, institutionId]
    );
  },

  async markAllNotificationsRead(
    client: PoolClient,
    institutionId: string,
    userId: string,
    membershipId: string
  ): Promise<void> {
    appCache.invalidatePrefix(`notif:unread:${institutionId}`);
    await client.query(
      `update notification set is_read = true 
       where institution_id = $1 and (recipient_membership_id = $2 or recipient_user_id = $3)`,
      [institutionId, membershipId, userId]
    );
  },

  // --- Task Management Engine ---
  async listTasks(
    client: PoolClient,
    institutionId: string,
    membershipId: string,
    filter: 'my_tasks' | 'assigned_by_me' | 'all' = 'all',
    grantedScope?: string
  ): Promise<any[]> {
    let query = `
      select 
        t.id,
        t.institution_id as "institutionId",
        t.creator_membership_id as "creatorMembershipId",
        t.assignee_membership_id as "assigneeMembershipId",
        t.assignee_student_id as "assigneeStudentId",
        t.title,
        t.description,
        t.priority,
        t.due_date as "dueDate",
        t.status,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        cp.name as "creatorName",
        coalesce(ap.name, st.name) as "assigneeName",
        coalesce(ar.name, case when st.id is not null then 'Student' else 'Member' end) as "assigneeRole",
        case when st.id is not null then 'student' else 'staff' end as "assigneeType"
      from user_task t
      left join membership cm on cm.id = t.creator_membership_id
      left join profile cp on cp.id = cm.user_id
      left join membership am on am.id = t.assignee_membership_id
      left join profile ap on ap.id = am.user_id
      left join role ar on ar.id = am.role_id
      left join student st on st.id = t.assignee_student_id
      where t.institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (grantedScope === 'self' || filter === 'my_tasks') {
      params.push(membershipId);
      query += ` and (t.assignee_membership_id = $${params.length} or t.assignee_student_id in (
        select s.id from student s
        join membership m on m.user_id = s.user_id and m.institution_id = s.institution_id
        where m.id = $${params.length}
      ))`;
    } else if (filter === 'assigned_by_me') {
      params.push(membershipId);
      query += ` and t.creator_membership_id = $${params.length}`;
    }

    query += ` order by case t.status when 'pending' then 1 when 'in_progress' then 2 else 3 end, t.due_date asc nulls last, t.created_at desc`;

    const { rows } = await client.query(query, params);
    return rows;
  },

  async createTask(
    client: PoolClient,
    institutionId: string,
    data: {
      creatorMembershipId?: string;
      assigneeMembershipId?: string;
      assigneeMembershipIds?: string[];
      assigneeStudentId?: string;
      assigneeStudentIds?: string[];
      title: string;
      description?: string;
      priority?: string;
      dueDate?: string;
    }
  ): Promise<any> {
    assertContentLength(data.title, 'title', CONTENT_LIMITS.TITLE_MAX, true);
    assertContentLength(data.description, 'taskDescription', CONTENT_LIMITS.TASK_DESCRIPTION_MAX);

    const staffAssignees = Array.from(new Set([
      ...(data.assigneeMembershipIds || []),
      ...(data.assigneeMembershipId ? [data.assigneeMembershipId] : []),
    ])).filter(Boolean);

    const studentAssignees = Array.from(new Set([
      ...(data.assigneeStudentIds || []),
      ...(data.assigneeStudentId ? [data.assigneeStudentId] : []),
    ])).filter(Boolean);

    if (staffAssignees.length === 0 && studentAssignees.length === 0) {
      throw new Error('At least one task assignee must be specified');
    }

    const createdTasks: any[] = [];
    for (const assigneeId of staffAssignees) {
      const { rows } = await client.query(
        `insert into user_task (institution_id, creator_membership_id, assignee_membership_id, title, description, priority, due_date, status)
         values ($1, $2, $3, $4, $5, coalesce($6, 'medium'), $7, 'pending')
         returning id, institution_id as "institutionId", creator_membership_id as "creatorMembershipId", assignee_membership_id as "assigneeMembershipId", title, description, priority, due_date as "dueDate", status, created_at as "createdAt"`,
        [
          institutionId,
          data.creatorMembershipId || null,
          assigneeId,
          data.title.trim(),
          data.description?.trim() || null,
          data.priority || 'medium',
          data.dueDate || null,
        ]
      );
      const task = rows[0];
      createdTasks.push(task);

      // Auto-dispatch notification to the assigned staff member
      try {
        await coreRepository.createNotification(client, institutionId, {
          recipientMembershipId: assigneeId,
          title: `New Task Assigned: ${task.title}`,
          body: data.description || 'You have been assigned a new academic work order.',
          type: 'task_assigned',
          data: { taskId: task.id },
        });
      } catch {
        // notification failure shouldn't block task creation
      }

      await logAudit(client, {
        institutionId,
        actorMembershipId: data.creatorMembershipId,
        action: 'create',
        entityType: 'task',
        entityId: task.id,
        after: task,
      });
    }

    for (const studentId of studentAssignees) {
      const { rows } = await client.query(
        `insert into user_task (institution_id, creator_membership_id, assignee_student_id, title, description, priority, due_date, status)
         values ($1, $2, $3, $4, $5, coalesce($6, 'medium'), $7, 'pending')
         returning id, institution_id as "institutionId", creator_membership_id as "creatorMembershipId", assignee_student_id as "assigneeStudentId", title, description, priority, due_date as "dueDate", status, created_at as "createdAt"`,
        [
          institutionId,
          data.creatorMembershipId || null,
          studentId,
          data.title.trim(),
          data.description?.trim() || null,
          data.priority || 'medium',
          data.dueDate || null,
        ]
      );
      const task = rows[0];
      createdTasks.push(task);

      try {
        const { rows: stRows } = await client.query(
          `select m.id as membership_id from student s join membership m on m.user_id = s.user_id and m.institution_id = s.institution_id where s.id = $1`,
          [studentId]
        );
        if (stRows.length > 0) {
          await coreRepository.createNotification(client, institutionId, {
            recipientMembershipId: stRows[0].membership_id,
            title: `New Task Assigned: ${task.title}`,
            body: data.description || 'Your faculty assigned you a coursework task.',
            type: 'task_assigned',
            data: { taskId: task.id },
          });
        }
      } catch {}

      await logAudit(client, {
        institutionId,
        actorMembershipId: data.creatorMembershipId,
        action: 'create',
        entityType: 'task',
        entityId: task.id,
        after: task,
      });
    }

    return createdTasks.length === 1 ? createdTasks[0] : createdTasks;
  },

  async updateTaskStatus(
    client: PoolClient,
    institutionId: string,
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
    actorMembershipId?: string
  ): Promise<any> {
    const { rows } = await client.query(
      `update user_task
       set status = $1, updated_at = now()
       where id = $2 and institution_id = $3
       returning id, institution_id as "institutionId", creator_membership_id as "creatorMembershipId", assignee_membership_id as "assigneeMembershipId", title, description, priority, due_date as "dueDate", status, updated_at as "updatedAt"`,
      [status, taskId, institutionId]
    );
    if (rows.length === 0) throw new Error('Task not found');
    const updated = rows[0];

    // If completed, notify creator
    if (status === 'completed' && updated.creatorMembershipId && updated.creatorMembershipId !== actorMembershipId) {
      try {
        await coreRepository.createNotification(client, institutionId, {
          recipientMembershipId: updated.creatorMembershipId,
          title: `Task Completed: ${updated.title}`,
          body: `Task was marked as completed.`,
          type: 'task_assigned',
          data: { taskId: updated.id, status: 'completed' },
        });
      } catch {}
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update_status',
      entityType: 'task',
      entityId: taskId,
      after: updated,
    });

    return updated;
  },

  async deleteTask(client: PoolClient, institutionId: string, taskId: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from user_task where id = $1 and institution_id = $2`, [taskId, institutionId]);
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'delete',
      entityType: 'task',
      entityId: taskId,
    });
  },

  // --- Institution Settings & Preferences ---
  async getInstitutionSettings(client: PoolClient, institutionId: string): Promise<any> {
    const { rows: instRows } = await client.query(
      `select id, name, subdomain, institute_code as "instituteCode", branding, status, created_at as "createdAt"
       from institution where id = $1`,
      [institutionId]
    );
    if (instRows.length === 0) throw new Error('Institution not found');

    const { rows: settingRows } = await client.query(
      `select settings from institution_setting where institution_id = $1`,
      [institutionId]
    );

    const defaultSettings = {
      address: '',
      contactPhone: '',
      contactEmail: '',
      website: '',
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      academicYearName: '2026-2027',
      attendanceThreshold: 75,
      instituteCode: instRows[0]?.instituteCode || '',
      enableExaminations: true,
      enableAssignments: true,
      enableTransport: false,
      enableFinance: true,
      enableTimetable: true,
      notificationSmsEnabled: false,
      featureLimitations: {
        examinations: { enabled: true, allowedRoles: [] },
        assignments: { enabled: true, allowedRoles: [] },
        finance: { enabled: true, allowedRoles: [] },
        timetable: { enabled: true, allowedRoles: [] },
        transport: { enabled: false, allowedRoles: [] },
        admissions: { enabled: true, allowedRoles: [] },
        attendance: { enabled: true, allowedRoles: [] },
        notices: { enabled: true, allowedRoles: [] },
        tasks: { enabled: true, allowedRoles: [] },
      },
      principalSignatureUrl: '',
      officialSealUrl: '',
      examControllerSignatureUrl: '',
      institutionAffiliationNo: '',
      officialWatermarkText: 'Powered by Biddyapith • Verified Official Institutional Document',
    };

    return {
      institution: instRows[0],
      settings: { ...defaultSettings, ...(settingRows[0]?.settings || {}) },
    };
  },

  async updateInstitutionSettings(
    client: PoolClient,
    institutionId: string,
    data: { name?: string; instituteCode?: string; branding?: any; settings?: Record<string, any> },
    actorMembershipId?: string
  ): Promise<any> {
    // 1. Subdomain is infrastructure-managed and strictly immutable via application settings (Blueprint Section 39)
    if ((data as any).subdomain !== undefined) {
      const { rows: currSub } = await client.query(`select subdomain from institution where id = $1`, [institutionId]);
      if (currSub.length > 0 && currSub[0].subdomain !== (data as any).subdomain) {
        throw new Error('Subdomain is infrastructure-managed and cannot be modified via institutional settings.');
      }
    }

    const effectiveInstituteCode = data.instituteCode ?? data.settings?.instituteCode;

    // 2. Validate content limits and EIIN code jurisdictional uniqueness
    if (data.name) {
      assertContentLength(data.name, 'name', CONTENT_LIMITS.NAME_MAX, true);
    }
    if (effectiveInstituteCode !== undefined && effectiveInstituteCode.trim() !== '') {
      assertContentLength(effectiveInstituteCode, 'instituteCode', CONTENT_LIMITS.CODE_MAX);
      const { rows: dupRows } = await client.query(
        `select id from institution where lower(institute_code) = lower($1) and id != $2 limit 1`,
        [effectiveInstituteCode.trim(), institutionId]
      );
      if (dupRows.length > 0) {
        throw new Error(`Institute Code (EIIN) "${effectiveInstituteCode.trim()}" is already in use by another institution.`);
      }
    }

    if (data.name || data.branding || effectiveInstituteCode !== undefined) {
      await client.query(
        `update institution set
           name = coalesce($1, name),
           institute_code = coalesce($2, institute_code),
           branding = coalesce($3, branding)
         where id = $4`,
        [
          data.name?.trim() || null,
          effectiveInstituteCode !== undefined ? effectiveInstituteCode.trim() : null,
          data.branding ? JSON.stringify(data.branding) : null,
          institutionId,
        ]
      );
    }

    if (data.settings) {
      await client.query(
        `insert into institution_setting (institution_id, settings, updated_at)
         values ($1, $2, now())
         on conflict (institution_id) do update
         set settings = coalesce(institution_setting.settings, '{}'::jsonb) || excluded.settings,
             updated_at = now()`,
        [institutionId, JSON.stringify(data.settings)]
      );

      // Invalidate feature availability cache
      invalidateFeatureCache(institutionId);
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update',
      entityType: 'institution_settings',
      entityId: institutionId,
      after: data,
    });

    return coreRepository.getInstitutionSettings(client, institutionId);
  },

  // --- 1-Click Academic Migration & Unified Bulk Roster Importer ---
  async bulkImportAcademicRoster(
    client: PoolClient,
    institutionId: string,
    records: Array<{
      academicYear?: string;
      className: string;
      sectionName: string;
      admissionNo?: string;
      rollNo?: string;
      studentName: string;
      dateOfBirth?: string;
      gender?: string;
      guardianName?: string;
      guardianPhone?: string;
    }>,
    actorMembershipId?: string
  ): Promise<{
    total: number;
    classesCreated: number;
    sectionsCreated: number;
    studentsCreated: number;
    enrollmentsCreated: number;
  }> {
    let classesCreated = 0;
    let sectionsCreated = 0;
    let studentsCreated = 0;
    let enrollmentsCreated = 0;

    // 1. Resolve or create current Academic Year
    const defaultYearName = records[0]?.academicYear?.trim() || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    let academicYearId: string;
    const { rows: ayRows } = await client.query(
      `select id from academic_year where institution_id = $1 and lower(name) = lower($2) limit 1`,
      [institutionId, defaultYearName]
    );
    if (ayRows.length > 0) {
      academicYearId = ayRows[0].id;
    } else {
      const { rows: newAy } = await client.query(
        `insert into academic_year (institution_id, name, start_date, end_date, is_current)
         values ($1, $2, '${new Date().getFullYear()}-01-01', '${new Date().getFullYear()}-12-31', true)
         returning id`,
        [institutionId, defaultYearName]
      );
      academicYearId = newAy[0].id;
    }

    // Cache existing classes and sections in memory for fast batch lookup
    const { rows: existingClasses } = await client.query(
      `select id, lower(name) as name_lower from class where institution_id = $1 and academic_year_id = $2`,
      [institutionId, academicYearId]
    );
    const classMap = new Map<string, string>();
    existingClasses.forEach((c) => classMap.set(c.name_lower, c.id));

    const { rows: existingSections } = await client.query(
      `select s.id, s.class_id, lower(s.name) as name_lower from section s where s.institution_id = $1`,
      [institutionId]
    );
    const sectionMap = new Map<string, string>(); // `${classId}_${secNameLower}` -> sectionId
    existingSections.forEach((s) => sectionMap.set(`${s.class_id}_${s.name_lower}`, s.id));

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      if (!row.className || !row.studentName) continue;

      const classNameClean = row.className.trim();
      const classKey = classNameClean.toLowerCase();
      const sectionNameClean = (row.sectionName || 'A').trim();
      const sectionKey = sectionNameClean.toLowerCase();

      // 2. Ensure Class exists
      let classId = classMap.get(classKey);
      if (!classId) {
        const { rows: newClassRows } = await client.query(
          `insert into class (institution_id, academic_year_id, name, sort_order)
           values ($1, $2, $3, $4)
           returning id`,
          [institutionId, academicYearId, classNameClean, classMap.size + 1]
        );
        classId = String(newClassRows[0].id);
        classMap.set(classKey, classId);
        classesCreated++;
      }

      // 3. Ensure Section exists
      const secCacheKey = `${classId}_${sectionKey}`;
      let sectionId = sectionMap.get(secCacheKey);
      if (!sectionId) {
        const { rows: newSecRows } = await client.query(
          `insert into section (institution_id, class_id, name)
           values ($1, $2, $3)
           returning id`,
          [institutionId, classId, sectionNameClean]
        );
        sectionId = String(newSecRows[0].id);
        sectionMap.set(secCacheKey, sectionId);
        sectionsCreated++;
      }

      // 4. Ensure Student exists or upsert
      const admNo = row.admissionNo?.trim() || `ADM-${Date.now().toString().slice(-4)}${i + 1}`;
      const { rows: sRows } = await client.query(
        `insert into student (institution_id, admission_no, name, date_of_birth, gender, status)
         values ($1, $2, $3, $4, $5, 'active')
         on conflict (institution_id, admission_no) do update
         set name = excluded.name, status = 'active'
         returning id`,
        [institutionId, admNo, row.studentName.trim(), row.dateOfBirth || null, row.gender || null]
      );
      const studentId = sRows[0].id;
      studentsCreated++;

      // 5. Enroll student
      await client.query(
        `insert into enrollment (institution_id, student_id, academic_year_id, class_id, section_id, roll_no, status)
         values ($1, $2, $3, $4, $5, $6, 'active')
         on conflict (student_id, academic_year_id) do update
         set class_id = excluded.class_id, section_id = excluded.section_id, roll_no = excluded.roll_no`,
        [institutionId, studentId, academicYearId, classId, sectionId, row.rollNo?.trim() || null]
      );
      enrollmentsCreated++;

      // 6. Guardian link if provided
      if (row.guardianName?.trim()) {
        const { rows: gRows } = await client.query(
          `insert into guardian (institution_id, name, phone)
           values ($1, $2, $3)
           returning id`,
          [institutionId, row.guardianName.trim(), row.guardianPhone?.trim() || null]
        );
        await client.query(
          `insert into student_guardian (institution_id, student_id, guardian_id, relation_type, is_primary)
           values ($1, $2, $3, 'Parent', true)
           on conflict do nothing`,
          [institutionId, studentId, gRows[0].id]
        );
      }
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'bulk_import_academic',
      entityType: 'academic_roster',
      entityId: institutionId,
      after: { totalRecords: records.length, classesCreated, sectionsCreated, studentsCreated, enrollmentsCreated },
    });

    return {
      total: records.length,
      classesCreated,
      sectionsCreated,
      studentsCreated,
      enrollmentsCreated,
    };
  },

  // --- Physical Classrooms & Facilities ---
  async listClassrooms(client: PoolClient, institutionId: string): Promise<any[]> {
    const { rows } = await client.query(
      `select 
        id, institution_id as "institutionId", room_number as "roomNumber", name,
        building, floor, capacity, coalesce(facilities, '{}') as facilities,
        status, created_at as "createdAt"
       from classroom
       where institution_id = $1
       order by room_number asc`,
      [institutionId]
    );
    return rows;
  },

  async createClassroom(
    client: PoolClient,
    institutionId: string,
    data: { roomNumber: string; name?: string; building?: string; floor?: string; capacity?: number; facilities?: string[] },
    actorMembershipId?: string
  ): Promise<any> {
    const { rows } = await client.query(
      `insert into classroom (institution_id, room_number, name, building, floor, capacity, facilities, status)
       values ($1, $2, $3, $4, $5, coalesce($6, 40), coalesce($7::text[], array[]::text[]), 'available')
       returning id, institution_id as "institutionId", room_number as "roomNumber", name, building, floor, capacity, facilities, status, created_at as "createdAt"`,
      [institutionId, data.roomNumber.trim(), data.name?.trim() || null, data.building?.trim() || null, data.floor?.trim() || null, data.capacity, data.facilities || []]
    );
    await logAudit(client, { institutionId, actorMembershipId, action: 'create', entityType: 'classroom', entityId: rows[0].id, after: rows[0] });
    return rows[0];
  },

  async updateClassroom(
    client: PoolClient,
    institutionId: string,
    id: string,
    data: Partial<{ roomNumber: string; name: string; building: string; floor: string; capacity: number; facilities: string[]; status: string }>,
    actorMembershipId?: string
  ): Promise<any> {
    const { rows } = await client.query(
      `update classroom set
         room_number = coalesce($1, room_number),
         name = coalesce($2, name),
         building = coalesce($3, building),
         floor = coalesce($4, floor),
         capacity = coalesce($5, capacity),
         facilities = coalesce($6::text[], facilities),
         status = coalesce($7, status)
       where id = $8 and institution_id = $9
       returning id, institution_id as "institutionId", room_number as "roomNumber", name, building, floor, capacity, facilities, status, created_at as "createdAt"`,
      [data.roomNumber?.trim() || null, data.name?.trim() || null, data.building?.trim() || null, data.floor?.trim() || null, data.capacity, data.facilities, data.status, id, institutionId]
    );
    if (rows.length === 0) throw new Error('Classroom not found');
    await logAudit(client, { institutionId, actorMembershipId, action: 'update', entityType: 'classroom', entityId: id, after: rows[0] });
    return rows[0];
  },

  async deleteClassroom(client: PoolClient, institutionId: string, id: string, actorMembershipId?: string): Promise<void> {
    await client.query(`delete from classroom where id = $1 and institution_id = $2`, [id, institutionId]);
    await logAudit(client, { institutionId, actorMembershipId, action: 'delete', entityType: 'classroom', entityId: id });
  },

  // --- Class Overview (Live Telemetry) ---
  async getClassOverview(client: PoolClient, institutionId: string, classId: string): Promise<any> {
    const { rows: [cls] } = await client.query(`select id, name from class where id = $1 and institution_id = $2`, [classId, institutionId]);
    if (!cls) throw new Error('Class not found');

    const { rows: sections } = await client.query(
      `select 
        s.id, s.name, s.capacity,
        s.class_teacher_membership_id as "classTeacherMembershipId",
        p.name as "classTeacherName",
        count(e.id)::int as "studentCount"
       from section s
       left join enrollment e on e.section_id = s.id and e.status = 'active'
       left join membership m on m.id = s.class_teacher_membership_id
       left join profile p on p.id = m.user_id
       where s.class_id = $1 and s.institution_id = $2
       group by s.id, s.name, s.capacity, s.class_teacher_membership_id, p.name
       order by s.name asc`,
      [classId, institutionId]
    );

    const totalStudents = sections.reduce((acc, s) => acc + (s.studentCount || 0), 0);

    // Today attendance for this class
    const today = new Date().toISOString().split('T')[0];
    const { rows: attRows } = await client.query(
      `select 
        count(a.id)::int as "markedCount",
        count(a.id) filter (where a.status = 'present')::int as "present",
        count(a.id) filter (where a.status = 'absent')::int as "absent",
        count(a.id) filter (where a.status = 'late')::int as "late",
        count(a.id) filter (where a.status = 'excused')::int as "excused"
       from attendance a
       join enrollment e on e.student_id = a.student_id and e.status = 'active'
       where e.class_id = $1 and a.date = $2 and a.institution_id = $3`,
      [classId, today, institutionId]
    );
    const marked = attRows[0]?.markedCount || 0;
    const present = attRows[0]?.present || 0;
    const absent = attRows[0]?.absent || 0;
    const late = attRows[0]?.late || 0;
    const excused = attRows[0]?.excused || 0;
    const rate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;

    // Current day and time for timetable
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Class schedules for this class today
    const { rows: schedRows } = await client.query(
      `select 
        cs.id, cs.section_id as "sectionId", sec.name as "sectionName",
        cs.subject_id as "subjectId", sub.name as "subjectName",
        cs.teacher_membership_id as "teacherMembershipId",
        p.name as "teacherName",
        cs.start_time as "startTime", cs.end_time as "endTime",
        coalesce(c.room_number, cs.room_no, 'Room 4022') as "roomNumber",
        subst.status as "subStatus", subst.reason as "subReason",
        subp.name as "substituteTeacherName"
       from class_schedule cs
       join section sec on sec.id = cs.section_id
       join subject sub on sub.id = cs.subject_id
       left join membership m on m.id = cs.teacher_membership_id
       left join profile p on p.id = m.user_id
       left join classroom c on c.id = cs.room_id
       left join schedule_substitution subst on subst.schedule_id = cs.id and subst.date = $3
       left join membership subm on subm.id = subst.substitute_teacher_membership_id
       left join profile subp on subp.id = subm.user_id
       where sec.class_id = $1 and lower(cs.day_of_week) = lower($2) and cs.institution_id = $4
       order by cs.start_time asc`,
      [classId, currentDay, today, institutionId]
    );

    let currentPeriod: any = null;
    let nextPeriod: any = null;

    for (const s of schedRows) {
      if (currentTimeStr >= s.startTime && currentTimeStr <= s.endTime) {
        currentPeriod = { ...s, isOngoing: true };
      } else if (currentTimeStr < s.startTime && !nextPeriod) {
        nextPeriod = s;
      }
    }
    if (!currentPeriod && schedRows.length > 0) {
      currentPeriod = { ...schedRows[0], isOngoing: false };
    }

    // Assigned Teachers
    const { rows: teachers } = await client.query(
      `select distinct 
        p.name as "teacherName",
        sub.name as "subjectName",
        sec.name as "sectionName"
       from class_subject_teacher cst
       join section sec on sec.id = cst.section_id
       join subject sub on sub.id = cst.subject_id
       join membership m on m.id = cst.teacher_membership_id
       join profile p on p.id = m.user_id
       where sec.class_id = $1 and cst.institution_id = $2
       order by sec.name, sub.name`,
      [classId, institutionId]
    );

    return {
      classId: cls.id,
      className: cls.name,
      totalStudents,
      sections,
      todayAttendance: {
        totalStudents,
        marked,
        present,
        absent,
        late,
        excused,
        attendanceRate: rate,
      },
      currentPeriod,
      nextPeriod,
      todaySchedules: schedRows,
      assignedTeachers: teachers,
    };
  },

  // --- Live Periods & Today's Schedule (For Student, Teacher, Admin Dashboards) ---
  async getLivePeriods(client: PoolClient, institutionId: string, ctx: any): Promise<any> {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const roleName = ctx.roleName?.toLowerCase() || '';
    const isGuardianOrStudent = roleName.includes('guardian') || roleName.includes('student');
    const isTeacher = roleName.includes('teacher');

    if (isGuardianOrStudent) {
      const { rows: sRows } = await client.query(
        `select s.id, s.name, e.section_id as "sectionId", c.name as "className", sec.name as "sectionName"
         from student s
         left join enrollment e on e.student_id = s.id and e.status = 'active'
         left join class c on c.id = e.class_id
         left join section sec on sec.id = e.section_id
         where (s.user_id = $1 or s.id in (select sg.student_id from student_guardian sg join guardian g on g.id = sg.guardian_id where g.user_id = $1))
           and s.institution_id = $2
         limit 1`,
        [ctx.userId, institutionId]
      );
      if (sRows.length === 0 || !sRows[0].sectionId) {
        return { role: 'student', currentPeriod: null, nextPeriod: null, todaySchedule: [] };
      }
      const student = sRows[0];

      const { rows: schedRows } = await client.query(
        `select 
          cs.id, cs.start_time as "startTime", cs.end_time as "endTime",
          sub.name as "subjectName",
          coalesce(subp.name, p.name, 'Faculty') as "teacherName",
          coalesce(c.room_number, cs.room_no, 'Room 4022') as "roomNumber",
          ss.status as "substitutionStatus",
          ss.reason as "substitutionReason"
         from class_schedule cs
         join subject sub on sub.id = cs.subject_id
         left join membership m on m.id = cs.teacher_membership_id
         left join profile p on p.id = m.user_id
         left join classroom c on c.id = cs.room_id
         left join schedule_substitution ss on ss.schedule_id = cs.id and ss.date = $3
         left join membership subm on subm.id = ss.substitute_teacher_membership_id
         left join profile subp on subp.id = subm.user_id
         where cs.section_id = $1 and lower(cs.day_of_week) = lower($2) and cs.institution_id = $4
         order by cs.start_time asc`,
        [student.sectionId, currentDay, today, institutionId]
      );

      let runningClass: any = null;
      const upcomingClasses: any[] = [];
      const previousClasses: any[] = [];

      for (const s of schedRows) {
        if (currentTimeStr >= s.startTime && currentTimeStr <= s.endTime) {
          runningClass = { ...s, isOngoing: true, status: 'running' };
        } else if (currentTimeStr < s.startTime) {
          upcomingClasses.push({ ...s, status: 'upcoming' });
        } else {
          previousClasses.push({ ...s, status: 'completed' });
        }
      }

      return {
        role: 'student',
        studentName: student.name,
        className: student.className,
        sectionName: student.sectionName,
        currentPeriod: runningClass,
        nextPeriod: upcomingClasses[0] || null,
        runningClass,
        upcomingClasses,
        previousClasses,
        todaySchedule: schedRows,
      };
    } else if (isTeacher) {
      const { rows: schedRows } = await client.query(
        `select 
          cs.id, cs.start_time as "startTime", cs.end_time as "endTime",
          c.name as "className", sec.name as "sectionName",
          sub.name as "subjectName",
          coalesce(rm.room_number, cs.room_no, 'Room 4022') as "roomNumber",
          ss.status as "substitutionStatus",
          ss.reason as "substitutionReason",
          subp.name as "substituteTeacherName"
         from class_schedule cs
         join section sec on sec.id = cs.section_id
         join class c on c.id = sec.class_id
         join subject sub on sub.id = cs.subject_id
         left join classroom rm on rm.id = cs.room_id
         left join schedule_substitution ss on ss.schedule_id = cs.id and ss.date = $3
         left join membership subm on subm.id = ss.substitute_teacher_membership_id
         left join profile subp on subp.id = subm.user_id
         where (cs.teacher_membership_id = $1 or ss.substitute_teacher_membership_id = $1)
           and lower(cs.day_of_week) = lower($2)
           and cs.institution_id = $4
         order by cs.start_time asc`,
        [ctx.membershipId, currentDay, today, institutionId]
      );

      let runningClass: any = null;
      const upcomingClasses: any[] = [];
      const previousClasses: any[] = [];

      for (const s of schedRows) {
        if (currentTimeStr >= s.startTime && currentTimeStr <= s.endTime) {
          runningClass = { ...s, isOngoing: true, status: 'running' };
        } else if (currentTimeStr < s.startTime) {
          upcomingClasses.push({ ...s, status: 'upcoming' });
        } else {
          previousClasses.push({ ...s, status: 'completed' });
        }
      }

      return {
        role: 'teacher',
        currentPeriod: runningClass,
        nextPeriod: upcomingClasses[0] || null,
        runningClass,
        upcomingClasses,
        previousClasses,
        todaySchedule: schedRows,
      };
    } else {
      const { rows: runningNow } = await client.query(
        `select 
          cs.id, cs.start_time as "startTime", cs.end_time as "endTime",
          c.name as "className", sec.name as "sectionName", sub.name as "subjectName",
          coalesce(subp.name, p.name, 'Unassigned') as "teacherName",
          coalesce(rm.room_number, cs.room_no, '4022') as "roomNumber"
         from class_schedule cs
         join section sec on sec.id = cs.section_id
         join class c on c.id = sec.class_id
         join subject sub on sub.id = cs.subject_id
         left join membership m on m.id = cs.teacher_membership_id
         left join profile p on p.id = m.user_id
         left join classroom rm on rm.id = cs.room_id
         left join schedule_substitution ss on ss.schedule_id = cs.id and ss.date = $3
         left join membership subm on subm.id = ss.substitute_teacher_membership_id
         left join profile subp on subp.id = subm.user_id
         where lower(cs.day_of_week) = lower($1)
           and cs.institution_id = $2
           and cs.start_time <= $4 and cs.end_time >= $4
         order by cs.start_time asc`,
        [currentDay, institutionId, today, currentTimeStr]
      );

      return {
        role: 'admin',
        runningNow,
        activeClassroomsCount: runningNow.length,
      };
    }
  },

  // --- Period Substitutions & Teacher History ---
  async recordPeriodSubstitution(
    client: PoolClient,
    institutionId: string,
    scheduleId: string,
    data: {
      date: string;
      substituteTeacherMembershipId?: string | null;
      status?: 'substituted' | 'cancelled' | 'rescheduled';
      reason?: string;
      roomId?: string;
    },
    actorMembershipId?: string
  ): Promise<any> {
    const { rows: [sched] } = await client.query(
      `select teacher_membership_id, room_id from class_schedule where id = $1 and institution_id = $2`,
      [scheduleId, institutionId]
    );
    if (!sched) throw new Error('Schedule slot not found');

    const originalTeacherId = sched.teacher_membership_id;
    const roomId = data.roomId || sched.room_id;
    const status = data.status || (data.substituteTeacherMembershipId ? 'substituted' : 'cancelled');

    const { rows } = await client.query(
      `insert into schedule_substitution (
         institution_id, schedule_id, date, original_teacher_membership_id,
         substitute_teacher_membership_id, room_id, status, reason, recorded_by_membership_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (institution_id, schedule_id, date) do update
       set substitute_teacher_membership_id = excluded.substitute_teacher_membership_id,
           status = excluded.status,
           reason = excluded.reason,
           room_id = coalesce(excluded.room_id, schedule_substitution.room_id),
           recorded_by_membership_id = excluded.recorded_by_membership_id,
           updated_at = now()
       returning id, schedule_id as "scheduleId", date, status, reason,
                 substitute_teacher_membership_id as "substituteTeacherMembershipId"`,
      [
        institutionId,
        scheduleId,
        data.date,
        originalTeacherId,
        data.substituteTeacherMembershipId || null,
        roomId,
        status,
        data.reason || null,
        actorMembershipId || null,
      ]
    );

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'record_substitution',
      entityType: 'schedule_substitution',
      entityId: rows[0].id,
      after: rows[0],
    });

    return rows[0];
  },

  async getTeacherHistory(client: PoolClient, institutionId: string, teacherMembershipId: string): Promise<any> {
    const { rows: [teacher] } = await client.query(
      `select m.id, p.name, p.email, coalesce(r.name, 'Teacher') as "roleName"
       from membership m
       join profile p on p.id = m.user_id
       join role r on r.id = m.role_id
       where m.id = $1 and m.institution_id = $2`,
      [teacherMembershipId, institutionId]
    );
    if (!teacher) throw new Error('Teacher not found');

    const { rows: [schedCount] } = await client.query(
      `select count(*)::int as count from class_schedule where teacher_membership_id = $1 and institution_id = $2`,
      [teacherMembershipId, institutionId]
    );

    const { rows: missedClasses } = await client.query(
      `select 
        ss.date, ss.status, ss.reason,
        subp.name as "substituteTeacherName",
        sub.name as "subjectName",
        sec.name as "sectionName",
        c.name as "className",
        cs.start_time as "startTime", cs.end_time as "endTime"
       from schedule_substitution ss
       join class_schedule cs on cs.id = ss.schedule_id
       join section sec on sec.id = cs.section_id
       join class c on c.id = sec.class_id
       join subject sub on sub.id = cs.subject_id
       left join membership subm on subm.id = ss.substitute_teacher_membership_id
       left join profile subp on subp.id = subm.user_id
       where ss.original_teacher_membership_id = $1 and ss.institution_id = $2
       order by ss.date desc`,
      [teacherMembershipId, institutionId]
    );

    const { rows: substitutedClasses } = await client.query(
      `select 
        ss.date, ss.reason,
        origp.name as "originalTeacherName",
        sub.name as "subjectName",
        sec.name as "sectionName",
        c.name as "className",
        cs.start_time as "startTime", cs.end_time as "endTime"
       from schedule_substitution ss
       join class_schedule cs on cs.id = ss.schedule_id
       join section sec on sec.id = cs.section_id
       join class c on c.id = sec.class_id
       join subject sub on sub.id = cs.subject_id
       left join membership origm on origm.id = ss.original_teacher_membership_id
       left join profile origp on origp.id = origm.user_id
       where ss.substitute_teacher_membership_id = $1 and ss.institution_id = $2
       order by ss.date desc`,
      [teacherMembershipId, institutionId]
    );

    const { rows: attStats } = await client.query(
      `select 
        count(*)::int as "totalDays",
        count(*) filter (where status = 'present')::int as "presentDays",
        count(*) filter (where status = 'absent')::int as "absentDays",
        count(*) filter (where status = 'late')::int as "lateDays",
        count(*) filter (where status = 'on_leave')::int as "leaveDays"
       from employee_attendance
       where membership_id = $1 and institution_id = $2`,
      [teacherMembershipId, institutionId]
    );
    const totalDays = attStats[0]?.totalDays || 0;
    const presentDays = attStats[0]?.presentDays || 0;
    const rate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    return {
      teacher,
      weeklyPeriods: schedCount?.count || 0,
      attendanceRate: rate,
      attendanceSummary: attStats[0] || { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, leaveDays: 0 },
      missedClasses,
      substitutedClasses,
    };
  },

  // --- Requests & Approvals Engine ---
  async createRequest(
    client: PoolClient,
    institutionId: string,
    data: {
      category: 'leave' | 'break' | 'schedule_change' | 'resource' | 'general';
      title: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      metadata?: Record<string, any>;
    },
    ctx: any
  ): Promise<any> {
    let requesterStudentId: string | null = null;
    let managerMembershipId: string | null = null;

    const roleName = ctx.roleName?.toLowerCase() || '';
    const isGuardianOrStudent = roleName.includes('guardian') || roleName.includes('student');

    if (isGuardianOrStudent) {
      const { rows: sRows } = await client.query(
        `select s.id, sec.class_teacher_membership_id
         from student s
         left join enrollment e on e.student_id = s.id and e.status = 'active'
         left join section sec on sec.id = e.section_id
         where (s.user_id = $1 or s.id in (select sg.student_id from student_guardian sg join guardian g on g.id = sg.guardian_id where g.user_id = $1))
           and s.institution_id = $2 limit 1`,
        [ctx.userId, institutionId]
      );
      if (sRows.length > 0) {
        requesterStudentId = sRows[0].id;
        managerMembershipId = sRows[0].class_teacher_membership_id;
      }
    } else {
      const { rows: mRows } = await client.query(
        `select manager_membership_id from membership where id = $1 and institution_id = $2`,
        [ctx.membershipId, institutionId]
      );
      if (mRows.length > 0) {
        managerMembershipId = mRows[0].manager_membership_id;
      }
    }

    if (!managerMembershipId) {
      const { rows: adminRows } = await client.query(
        `select m.id from membership m
         join role r on r.id = m.role_id
         where lower(r.name) in ('institution admin', 'admin') and m.institution_id = $1 limit 1`,
        [institutionId]
      );
      if (adminRows.length > 0) {
        managerMembershipId = adminRows[0].id;
      }
    }

    const { rows } = await client.query(
      `insert into member_request (
         institution_id, requester_membership_id, requester_student_id,
         manager_membership_id, category, title, description,
         start_date, end_date, status, metadata
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', coalesce($10, '{}'::jsonb))
       returning id, institution_id as "institutionId", category, title, description,
                 start_date as "startDate", end_date as "endDate", status, created_at as "createdAt"`,
      [
        institutionId,
        ctx.membershipId,
        requesterStudentId,
        managerMembershipId,
        data.category,
        data.title.trim(),
        data.description?.trim() || null,
        data.startDate || null,
        data.endDate || null,
        data.metadata ? JSON.stringify(data.metadata) : '{}',
      ]
    );

    await logAudit(client, {
      institutionId,
      actorMembershipId: ctx.membershipId,
      action: 'create_request',
      entityType: 'member_request',
      entityId: rows[0].id,
      after: rows[0],
    });

    return rows[0];
  },

  async listRequests(client: PoolClient, institutionId: string, ctx: any, filters?: { status?: string; category?: string }): Promise<any[]> {
    let query = `
      select 
        r.id, r.institution_id as "institutionId",
        r.requester_membership_id as "requesterMembershipId",
        rp.name as "requesterName",
        r.requester_student_id as "requesterStudentId",
        st.name as "requesterStudentName",
        r.manager_membership_id as "managerMembershipId",
        mp.name as "managerName",
        r.category, r.title, r.description,
        r.start_date as "startDate", r.end_date as "endDate",
        r.status, r.reviewer_notes as "reviewerNotes",
        r.reviewed_at as "reviewedAt", r.created_at as "createdAt"
      from member_request r
      left join membership req_m on req_m.id = r.requester_membership_id
      left join profile rp on rp.id = req_m.user_id
      left join student st on st.id = r.requester_student_id
      left join membership mgr_m on mgr_m.id = r.manager_membership_id
      left join profile mp on mp.id = mgr_m.user_id
      where r.institution_id = $1
    `;
    const params: any[] = [institutionId];

    const roleName = ctx.roleName?.toLowerCase() || '';
    const isGuardianOrStudent = roleName.includes('guardian') || roleName.includes('student');
    const isAdmin = roleName.includes('admin');

    if (isGuardianOrStudent) {
      params.push(ctx.userId);
      query += ` and (r.requester_membership_id = $${params.length} or r.requester_student_id in (
        select s.id from student s
        where s.user_id = $${params.length} or s.id in (select sg.student_id from student_guardian sg join guardian g on g.id = sg.guardian_id where g.user_id = $${params.length})
      ))`;
    } else if (!isAdmin) {
      params.push(ctx.membershipId);
      query += ` and (r.requester_membership_id = $${params.length} or r.manager_membership_id = $${params.length})`;
    }

    if (filters?.status) {
      params.push(filters.status);
      query += ` and r.status = $${params.length}`;
    }
    if (filters?.category) {
      params.push(filters.category);
      query += ` and r.category = $${params.length}`;
    }

    query += ` order by r.created_at desc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async updateRequestStatus(
    client: PoolClient,
    institutionId: string,
    requestId: string,
    data: { status: 'approved' | 'rejected' | 'cancelled'; reviewerNotes?: string },
    actorMembershipId?: string
  ): Promise<any> {
    const { rows } = await client.query(
      `update member_request set
         status = $1,
         reviewer_notes = coalesce($2, reviewer_notes),
         reviewed_at = now(),
         updated_at = now()
       where id = $3 and institution_id = $4
       returning 
         id, institution_id as "institutionId", category, title, description,
         start_date as "startDate", end_date as "endDate", status,
         reviewer_notes as "reviewerNotes", reviewed_at as "reviewedAt", updated_at as "updatedAt"`,
      [data.status, data.reviewerNotes || null, requestId, institutionId]
    );
    if (rows.length === 0) throw new Error('Request not found');
    const updated = rows[0];

    // If leave request was approved, record excused attendance for student or employee
    if (updated.status === 'approved' && updated.category === 'leave' && updated.start_date) {
      const start = new Date(updated.start_date);
      const end = updated.end_date ? new Date(updated.end_date) : start;
      const cur = new Date(start);

      while (cur <= end) {
        const curDateStr = cur.toISOString().split('T')[0];
        // 1. Student attendance
        if (updated.requester_student_id) {
          const { rows: enroll } = await client.query(
            `select section_id from enrollment where student_id = $1 and status = 'active' limit 1`,
            [updated.requester_student_id]
          );
          const sectionId = enroll[0]?.section_id;
          if (sectionId) {
            await client.query(
              `insert into attendance (institution_id, student_id, section_id, date, status, recorded_by_membership_id)
               values ($1, $2, $3, $4, 'excused', $5)
               on conflict (student_id, date) do update set status = 'excused'`,
              [institutionId, updated.requester_student_id, sectionId, curDateStr, actorMembershipId || null]
            );
          }
        }
        // 2. Employee attendance
        if (updated.requester_membership_id) {
          await client.query(
            `insert into employee_attendance (institution_id, membership_id, date, status, notes, recorded_by_membership_id)
             values ($1, $2, $3, 'excused', 'Approved Leave', $4)
             on conflict (institution_id, membership_id, date) do update set status = 'excused', notes = 'Approved Leave'`,
            [institutionId, updated.requester_membership_id, curDateStr, actorMembershipId || null]
          );
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // Notify requester of decision
    if (updated.requester_membership_id) {
      const statusTitle = `Request ${data.status.toUpperCase()}: ${updated.title}`;
      const statusBody = data.reviewerNotes
        ? `Your request was marked as ${data.status}. Manager remarks: "${data.reviewerNotes}"`
        : `Your request for "${updated.title}" has been ${data.status}.`;
      
      await dispatchNotificationAndTask({
        client,
        institutionId,
        creatorMembershipId: actorMembershipId,
        recipientMembershipIds: [updated.requester_membership_id],
        title: statusTitle,
        body: statusBody,
        type: 'request_update',
        createTask: false,
      }).catch(() => {});
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update_request_status',
      entityType: 'member_request',
      entityId: requestId,
      after: updated,
    });

    return updated;
  },

  async bulkUpdateRequestStatus(
    client: PoolClient,
    institutionId: string,
    requestIds: string[],
    status: 'approved' | 'rejected',
    notes?: string,
    actorMembershipId?: string
  ): Promise<number> {
    for (const reqId of requestIds) {
      await this.updateRequestStatus(client, institutionId, reqId, { status, reviewerNotes: notes }, actorMembershipId);
    }
    return requestIds.length;
  },

  async remindManager(
    client: PoolClient,
    institutionId: string,
    requestId: string,
    callerMembershipId?: string
  ): Promise<{ success: boolean; message: string }> {
    const { rows } = await client.query(
      `select id, title, category, status, target_manager_membership_id
       from member_request where id = $1 and institution_id = $2`,
      [requestId, institutionId]
    );
    if (rows.length === 0) throw new Error('Request not found');
    const req = rows[0];
    if (req.status !== 'pending') {
      throw new Error(`Cannot remind manager: request is already ${req.status}`);
    }
    if (!req.target_manager_membership_id) {
      throw new Error('No manager assigned to this request');
    }

    await dispatchNotificationAndTask({
      client,
      institutionId,
      creatorMembershipId: callerMembershipId,
      recipientMembershipIds: [req.target_manager_membership_id],
      title: `Action Required: Pending ${req.category.toUpperCase()} Request`,
      body: `A reminder has been dispatched regarding pending request: "${req.title}". Please review and take action.`,
      type: 'request_reminder',
      priority: 'high',
      createTask: true,
      metadata: { requestId: req.id, category: req.category },
    });

    return { success: true, message: 'Manager reminded successfully' };
  },

  async dispatchReminder(
    client: PoolClient,
    institutionId: string,
    data: {
      recipientMembershipIds?: string[];
      recipientUserIds?: string[];
      title: string;
      body: string;
      type?: string;
      priority?: 'low' | 'medium' | 'high';
      dueDate?: string;
      metadata?: Record<string, any>;
      createTask?: boolean;
    },
    callerMembershipId?: string
  ): Promise<{ success: boolean; count: number }> {
    const res = await dispatchNotificationAndTask({
      client,
      institutionId,
      creatorMembershipId: callerMembershipId,
      recipientMembershipIds: data.recipientMembershipIds,
      recipientUserIds: data.recipientUserIds,
      title: data.title,
      body: data.body,
      type: data.type || 'general_reminder',
      priority: data.priority || 'medium',
      dueDate: data.dueDate,
      metadata: data.metadata,
      createTask: data.createTask !== false,
    });
    return { success: true, count: res.notificationsSent };
  },

  // --- Universal Bulk Operations ---
  async bulkAssignManager(
    client: PoolClient,
    institutionId: string,
    membershipIds: string[],
    managerMembershipId: string,
    actorMembershipId?: string
  ): Promise<number> {
    const { rows } = await client.query(
      `update membership set manager_membership_id = $1
       where id = any($2) and institution_id = $3 returning id`,
      [managerMembershipId, membershipIds, institutionId]
    );
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'bulk_assign_manager',
      entityType: 'membership',
      entityId: institutionId,
      after: { updatedCount: rows.length, membershipIds },
    });
    return rows.length;
  },

  async bulkUpdateMemberRole(
    client: PoolClient,
    institutionId: string,
    membershipIds: string[],
    roleId: string,
    actorMembershipId?: string
  ): Promise<number> {
    const { rows } = await client.query(
      `update membership set role_id = $1
       where id = any($2) and institution_id = $3 returning id`,
      [roleId, membershipIds, institutionId]
    );
    invalidateContextCache(undefined, institutionId);
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'bulk_update_role',
      entityType: 'membership',
      entityId: institutionId,
      after: { updatedCount: rows.length, membershipIds, roleId },
    });
    return rows.length;
  },

  async bulkUpdateStudentStatus(
    client: PoolClient,
    institutionId: string,
    studentIds: string[],
    status: string,
    actorMembershipId?: string
  ): Promise<number> {
    const { rows } = await client.query(
      `update student set status = $1
       where id = any($2) and institution_id = $3 returning id`,
      [status, studentIds, institutionId]
    );
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'bulk_update_student_status',
      entityType: 'student',
      entityId: institutionId,
      after: { updatedCount: rows.length, studentIds, status },
    });
    return rows.length;
  },

  async bulkTransferStudentSection(
    client: PoolClient,
    institutionId: string,
    studentIds: string[],
    classId: string,
    sectionId: string,
    actorMembershipId?: string
  ): Promise<number> {
    const { rows: [curAy] } = await client.query(
      `select id from academic_year where institution_id = $1 and is_current = true limit 1`,
      [institutionId]
    );
    const ayId = curAy?.id;
    if (!ayId) throw new Error('No active academic year found');

    for (const sId of studentIds) {
      await client.query(
        `insert into enrollment (institution_id, student_id, academic_year_id, class_id, section_id, status)
         values ($1, $2, $3, $4, $5, 'active')
         on conflict (student_id, academic_year_id) do update
         set class_id = excluded.class_id, section_id = excluded.section_id`,
        [institutionId, sId, ayId, classId, sectionId]
      );
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'bulk_transfer_section',
      entityType: 'enrollment',
      entityId: institutionId,
      after: { updatedCount: studentIds.length, studentIds, classId, sectionId },
    });
    return studentIds.length;
  },

  // --- Document & Certificate Templates ---
  async listTemplates(
    client: PoolClient,
    institutionId: string,
    type?: string
  ) {
    let query = `
      select id, institution_id as "institutionId", type, name, description, content, metadata,
             created_at as "createdAt", updated_at as "updatedAt"
      from template
      where (institution_id = $1 or institution_id is null)
    `;
    const params: any[] = [institutionId];
    if (type) {
      params.push(type);
      query += ` and type = $2`;
    }
    query += ` order by updated_at desc, name asc`;
    const { rows } = await client.query(query, params);
    return rows;
  },

  async getTemplateById(
    client: PoolClient,
    institutionId: string,
    id: string
  ) {
    const { rows } = await client.query(
      `select id, institution_id as "institutionId", type, name, description, content, metadata,
              created_at as "createdAt", updated_at as "updatedAt"
       from template
       where id = $1 and (institution_id = $2 or institution_id is null)`,
      [id, institutionId]
    );
    return rows[0] || null;
  },

  async createTemplate(
    client: PoolClient,
    institutionId: string,
    data: {
      type: string;
      name: string;
      description?: string;
      content: string;
      metadata?: any;
    },
    actorMembershipId?: string
  ) {
    const { rows } = await client.query(
      `insert into template (institution_id, type, name, description, content, metadata)
       values ($1, $2, $3, $4, $5, $6)
       returning id, institution_id as "institutionId", type, name, description, content, metadata,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [institutionId, data.type, data.name, data.description || null, data.content, JSON.stringify(data.metadata || {})]
    );

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create_template',
      entityType: 'template',
      entityId: rows[0].id,
      after: rows[0],
    });

    return rows[0];
  },

  async updateTemplate(
    client: PoolClient,
    institutionId: string,
    id: string,
    data: {
      type?: string;
      name?: string;
      description?: string;
      content?: string;
      metadata?: any;
    },
    actorMembershipId?: string
  ) {
    const existing = await this.getTemplateById(client, institutionId, id);
    if (!existing) throw new Error('Template not found');

    const type = data.type || existing.type;
    const name = data.name || existing.name;
    const description = data.description !== undefined ? data.description : existing.description;
    const content = data.content || existing.content;
    const metadata = data.metadata || existing.metadata;

    const { rows } = await client.query(
      `update template
       set type = $1, name = $2, description = $3, content = $4, metadata = $5, updated_at = now()
       where id = $6 and institution_id = $7
       returning id, institution_id as "institutionId", type, name, description, content, metadata,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [type, name, description, content, JSON.stringify(metadata), id, institutionId]
    );

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update_template',
      entityType: 'template',
      entityId: id,
      before: existing,
      after: rows[0],
    });

    return rows[0];
  },

  async deleteTemplate(
    client: PoolClient,
    institutionId: string,
    id: string,
    actorMembershipId?: string
  ) {
    const existing = await this.getTemplateById(client, institutionId, id);
    if (!existing) throw new Error('Template not found');

    await client.query(`delete from template where id = $1 and institution_id = $2`, [id, institutionId]);

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'delete_template',
      entityType: 'template',
      entityId: id,
      before: existing,
    });

    return { success: true };
  },

  async renderTemplate(
    client: PoolClient,
    institutionId: string,
    templateId: string,
    studentId?: string,
    customVariables: Record<string, string> = {}
  ) {
    const template = await this.getTemplateById(client, institutionId, templateId);
    if (!template) throw new Error('Template not found');

    const { rows: [inst] } = await client.query(
      `select id, name, subdomain from institution where id = $1`,
      [institutionId]
    );

    let studentData: any = {};
    if (studentId) {
      const students = await this.listStudents(client, institutionId);
      const matched = students.find((s) => s.id === studentId);
      if (matched) {
        studentData = matched;
      }
    }

    const instSettings = await this.getInstitutionSettings(client, institutionId).catch(() => null);
    const settings = instSettings?.settings || {};

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const defaults: Record<string, string> = {
      'institution.name': inst?.name || 'Educational Institution',
      'institution.subdomain': inst?.subdomain || 'school',
      'institution.address': settings.address || '',
      'institution.phone': settings.contactPhone || '',
      'institution.email': settings.contactEmail || '',
      'institution.website': settings.website || '',
      'institution.affiliationNo': settings.institutionAffiliationNo || '',
      'principalSignature': settings.principalSignatureUrl
        ? `<img src="${settings.principalSignatureUrl}" alt="Principal Signature" style="max-height: 48px; object-fit: contain; vertical-align: middle;" />`
        : '<div style="border-top: 1px dashed #64748b; width: 140px; text-align: center; font-size: 0.75rem; padding-top: 4px; display: inline-block;">Principal Signature</div>',
      'institution.principalSignature': settings.principalSignatureUrl
        ? `<img src="${settings.principalSignatureUrl}" alt="Principal Signature" style="max-height: 48px; object-fit: contain; vertical-align: middle;" />`
        : '<div style="border-top: 1px dashed #64748b; width: 140px; text-align: center; font-size: 0.75rem; padding-top: 4px; display: inline-block;">Principal Signature</div>',
      'officialSeal': settings.officialSealUrl
        ? `<img src="${settings.officialSealUrl}" alt="Official Seal" style="max-height: 60px; object-fit: contain; vertical-align: middle;" />`
        : '<div style="width: 60px; height: 60px; border: 2px dashed #94a3b8; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; color: #94a3b8;">SEAL</div>',
      'institution.officialSeal': settings.officialSealUrl
        ? `<img src="${settings.officialSealUrl}" alt="Official Seal" style="max-height: 60px; object-fit: contain; vertical-align: middle;" />`
        : '<div style="width: 60px; height: 60px; border: 2px dashed #94a3b8; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; color: #94a3b8;">SEAL</div>',
      'examControllerSignature': settings.examControllerSignatureUrl
        ? `<img src="${settings.examControllerSignatureUrl}" alt="Exam Controller Signature" style="max-height: 48px; object-fit: contain; vertical-align: middle;" />`
        : '<div style="border-top: 1px dashed #64748b; width: 140px; text-align: center; font-size: 0.75rem; padding-top: 4px; display: inline-block;">Exam Controller</div>',
      'institution.examControllerSignature': settings.examControllerSignatureUrl
        ? `<img src="${settings.examControllerSignatureUrl}" alt="Exam Controller Signature" style="max-height: 48px; object-fit: contain; vertical-align: middle;" />`
        : '<div style="border-top: 1px dashed #64748b; width: 140px; text-align: center; font-size: 0.75rem; padding-top: 4px; display: inline-block;">Exam Controller</div>',
      'student.name': studentData.name || 'Sample Student',
      'student.admissionNo': studentData.admissionNo || 'ADM-2026-SAMPLE',
      'student.rollNo': studentData.rollNo || '01',
      'student.className': studentData.className || 'Grade 10',
      'student.sectionName': studentData.sectionName || 'Section A',
      'student.gender': studentData.gender || 'Unspecified',
      'student.dateOfBirth': studentData.dateOfBirth ? new Date(studentData.dateOfBirth).toLocaleDateString() : 'January 1, 2010',
      'student.guardianName': studentData.guardianName || 'Guardian Name',
      'student.guardianPhone': studentData.guardianPhone || '+880 1700-000000',
      'issueDate': today,
      'certificateNo': `CERT-${Date.now().toString().slice(-6)}`,
      'academicYear': '2026-2027',
      'conductRemarks': 'Exemplary conduct and sound moral character',
      'reasonForLeaving': 'Successful completion of academic term / Parental relocation',
      'examName': 'Annual Board / Term Examination',
    };

    const mergedVariables = { ...defaults, ...customVariables };

    let rendered = template.content;
    for (const [key, val] of Object.entries(mergedVariables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(regex, val || '');
    }

    // Enforce non-removable Biddyapith footer watermark
    const watermarkText = settings.officialWatermarkText || 'Powered by Biddyapith • Verified Official Institutional Document';
    const watermarkHtml = `<div class="biddyapith-footer-watermark" style="margin-top: 2rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.72rem; color: #94a3b8; font-family: sans-serif; letter-spacing: 0.05em; text-transform: uppercase;">${watermarkText}</div>`;
    if (!rendered.includes('biddyapith-footer-watermark')) {
      rendered += `\n${watermarkHtml}`;
    }

    return {
      template,
      rendered,
      variables: mergedVariables,
    };
  },
};
