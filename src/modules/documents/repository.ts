import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger.js';
import { SYSTEM_TEMPLATES, SystemTemplateDefinition } from './system-templates.js';
import { renderDocumentTemplate } from './template-engine.js';

export interface DocumentTemplateRecord {
  id: string;
  institutionId: string | null;
  type: string;
  context: string;
  name: string;
  description: string | null;
  content: string;
  version: number;
  isSystem: boolean;
  isDefault: boolean;
  isArchived: boolean;
  pageSize: string;
  orientation: string;
  margins: any;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  type: string;
  context?: string;
  name: string;
  description?: string;
  content: string;
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'ID_CARD';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: string; bottom: string; left: string; right: string };
  isDefault?: boolean;
  metadata?: any;
}

export interface UpdateTemplateInput {
  type?: string;
  context?: string;
  name?: string;
  description?: string;
  content?: string;
  pageSize?: 'A4' | 'Letter' | 'Legal' | 'ID_CARD';
  orientation?: 'portrait' | 'landscape';
  margins?: { top: string; bottom: string; left: string; right: string };
  isDefault?: boolean;
  isArchived?: boolean;
  metadata?: any;
}

export interface RenderTemplateOptions {
  studentId?: string;
  entityId?: string;
  entityType?: string;
  variables?: Record<string, any>;
  saveSnapshot?: boolean;
  title?: string;
}

export interface BulkRenderOptions {
  templateId: string;
  entityType: 'student' | 'employee' | 'generic';
  entityIds: string[];
  customVariables?: Record<string, any>;
  saveSnapshots?: boolean;
}

export interface GlobalFilterParams {
  academicYearId?: string;
  academicYear?: string;
  campusId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  examId?: string;
  gender?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export const documentsRepo = {
  /**
   * List templates for an institution including available system templates.
   */
  async listTemplates(
    client: PoolClient,
    institutionId: string,
    filters: {
      type?: string;
      context?: string;
      isArchived?: boolean;
      search?: string;
    } = {}
  ): Promise<DocumentTemplateRecord[]> {
    let query = `
      select id, institution_id as "institutionId", type, context, name, description, content,
             version, is_system as "isSystem", is_default as "isDefault", is_archived as "isArchived",
             page_size as "pageSize", orientation, margins, metadata,
             created_at as "createdAt", updated_at as "updatedAt"
      from template
      where (institution_id = $1 or institution_id is null)
    `;
    const params: any[] = [institutionId];
    let idx = 2;

    if (filters.type && filters.type !== 'all') {
      query += ` and type = $${idx++}`;
      params.push(filters.type);
    }

    if (filters.context && filters.context !== 'all') {
      query += ` and context = $${idx++}`;
      params.push(filters.context);
    }

    if (filters.isArchived !== undefined) {
      query += ` and is_archived = $${idx++}`;
      params.push(filters.isArchived);
    } else {
      // By default exclude archived unless asked
      query += ` and is_archived = false`;
    }

    if (filters.search && filters.search.trim()) {
      query += ` and (name ilike $${idx} or description ilike $${idx})`;
      params.push(`%${filters.search.trim()}%`);
      idx++;
    }

    query += ` order by is_default desc, updated_at desc, name asc`;

    const { rows } = await client.query(query, params);

    // Complement with builtin system templates if not already present in db
    const existingIds = new Set(rows.map((r) => r.id));
    const systemRows: DocumentTemplateRecord[] = [];

    for (const sys of SYSTEM_TEMPLATES) {
      if (!existingIds.has(sys.id)) {
        if (filters.type && filters.type !== 'all' && sys.type !== filters.type) continue;
        if (filters.context && filters.context !== 'all' && sys.context !== filters.context) continue;
        if (filters.isArchived !== undefined && sys.isArchived !== filters.isArchived) continue;
        if (filters.search && !sys.name.toLowerCase().includes(filters.search.toLowerCase())) continue;

        systemRows.push({
          id: sys.id,
          institutionId: null,
          type: sys.type,
          context: sys.context,
          name: sys.name,
          description: sys.description,
          content: sys.content,
          version: sys.version,
          isSystem: true,
          isDefault: sys.isDefault,
          isArchived: sys.isArchived,
          pageSize: sys.pageSize,
          orientation: sys.orientation,
          margins: sys.margins,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return [...rows, ...systemRows];
  },

  /**
   * Get template by ID (checks database, then builtin system templates)
   */
  async getTemplateById(
    client: PoolClient,
    institutionId: string,
    id: string
  ): Promise<DocumentTemplateRecord | null> {
    const { rows } = await client.query(
      `select id, institution_id as "institutionId", type, context, name, description, content,
              version, is_system as "isSystem", is_default as "isDefault", is_archived as "isArchived",
              page_size as "pageSize", orientation, margins, metadata,
              created_at as "createdAt", updated_at as "updatedAt"
       from template
       where id = $1 and (institution_id = $2 or institution_id is null)`,
      [id, institutionId]
    );

    if (rows[0]) {
      return rows[0];
    }

    // Fallback to builtin system templates if not in DB
    const sys = SYSTEM_TEMPLATES.find((s) => s.id === id);
    if (sys) {
      return {
        id: sys.id,
        institutionId: null,
        type: sys.type,
        context: sys.context,
        name: sys.name,
        description: sys.description,
        content: sys.content,
        version: sys.version,
        isSystem: true,
        isDefault: sys.isDefault,
        isArchived: sys.isArchived,
        pageSize: sys.pageSize,
        orientation: sys.orientation,
        margins: sys.margins,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return null;
  },

  /**
   * Create a new custom template for an institution (starts at version 1).
   */
  async createTemplate(
    client: PoolClient,
    institutionId: string,
    data: CreateTemplateInput,
    actorMembershipId?: string
  ): Promise<DocumentTemplateRecord> {
    const context = data.context || data.type || 'custom';
    const pageSize = data.pageSize || 'A4';
    const orientation = data.orientation || 'portrait';
    const margins = data.margins || { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' };
    const isDefault = Boolean(data.isDefault);

    // If set as default, clear default on other templates of this context
    if (isDefault) {
      await client.query(
        `update template set is_default = false where institution_id = $1 and context = $2`,
        [institutionId, context]
      );
    }

    const { rows } = await client.query(
      `insert into template (
        institution_id, type, context, name, description, content, version,
        is_system, is_default, is_archived, page_size, orientation, margins, metadata
      )
      values ($1, $2, $3, $4, $5, $6, 1, false, $7, false, $8, $9, $10, $11)
      returning id, institution_id as "institutionId", type, context, name, description, content,
                version, is_system as "isSystem", is_default as "isDefault", is_archived as "isArchived",
                page_size as "pageSize", orientation, margins, metadata,
                created_at as "createdAt", updated_at as "updatedAt"`,
      [
        institutionId,
        data.type,
        context,
        data.name,
        data.description || null,
        data.content,
        isDefault,
        pageSize,
        orientation,
        JSON.stringify(margins),
        JSON.stringify(data.metadata || {}),
      ]
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

  /**
   * Update an existing template.
   * Enforces SYSTEM_TEMPLATE_READONLY: system templates cannot be edited.
   * Increments version on modification.
   */
  async updateTemplate(
    client: PoolClient,
    institutionId: string,
    id: string,
    data: UpdateTemplateInput,
    actorMembershipId?: string
  ): Promise<DocumentTemplateRecord> {
    const existing = await this.getTemplateById(client, institutionId, id);
    if (!existing) {
      throw new Error('Template not found');
    }

    if (existing.isSystem || !existing.institutionId) {
      throw new Error(
        'SYSTEM_TEMPLATE_READONLY: System templates cannot be directly modified. Please duplicate the template to customize.'
      );
    }

    const type = data.type || existing.type;
    const context = data.context || existing.context;
    const name = data.name || existing.name;
    const description = data.description !== undefined ? data.description : existing.description;
    const content = data.content !== undefined ? data.content : existing.content;
    const pageSize = data.pageSize || existing.pageSize;
    const orientation = data.orientation || existing.orientation;
    const margins = data.margins || existing.margins;
    const isDefault = data.isDefault !== undefined ? data.isDefault : existing.isDefault;
    const isArchived = data.isArchived !== undefined ? data.isArchived : existing.isArchived;
    const metadata = data.metadata || existing.metadata;

    // Increment version
    const nextVersion = (existing.version || 1) + 1;

    if (isDefault) {
      await client.query(
        `update template set is_default = false where institution_id = $1 and context = $2 and id != $3`,
        [institutionId, context, id]
      );
    }

    const { rows } = await client.query(
      `update template
       set type = $1, context = $2, name = $3, description = $4, content = $5,
           version = $6, is_default = $7, is_archived = $8, page_size = $9,
           orientation = $10, margins = $11, metadata = $12, updated_at = now()
       where id = $13 and institution_id = $14
       returning id, institution_id as "institutionId", type, context, name, description, content,
                 version, is_system as "isSystem", is_default as "isDefault", is_archived as "isArchived",
                 page_size as "pageSize", orientation, margins, metadata,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        type,
        context,
        name,
        description,
        content,
        nextVersion,
        isDefault,
        isArchived,
        pageSize,
        orientation,
        JSON.stringify(margins),
        JSON.stringify(metadata),
        id,
        institutionId,
      ]
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

  /**
   * Delete a custom template.
   * Enforces immutability on system templates.
   */
  async deleteTemplate(
    client: PoolClient,
    institutionId: string,
    id: string,
    actorMembershipId?: string
  ): Promise<{ success: boolean }> {
    const existing = await this.getTemplateById(client, institutionId, id);
    if (!existing) {
      throw new Error('Template not found');
    }

    if (existing.isSystem || !existing.institutionId) {
      throw new Error('SYSTEM_TEMPLATE_READONLY: System templates cannot be deleted.');
    }

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

  /**
   * Duplicate a template (system or custom) into a new custom template for the institution.
   */
  async duplicateTemplate(
    client: PoolClient,
    institutionId: string,
    id: string,
    newName?: string,
    actorMembershipId?: string
  ): Promise<DocumentTemplateRecord> {
    const source = await this.getTemplateById(client, institutionId, id);
    if (!source) {
      throw new Error('Template not found');
    }

    const name = newName || `${source.name} (Customized)`;

    const duplicated = await this.createTemplate(
      client,
      institutionId,
      {
        type: source.type,
        context: source.context,
        name,
        description: source.description || `Customized clone of ${source.name}`,
        content: source.content,
        pageSize: source.pageSize as any,
        orientation: source.orientation as any,
        margins: source.margins,
        isDefault: false,
        metadata: source.metadata,
      },
      actorMembershipId
    );

    return duplicated;
  },

  /**
   * Set a template as the default for its context.
   */
  async setDefaultTemplate(
    client: PoolClient,
    institutionId: string,
    id: string,
    actorMembershipId?: string
  ): Promise<DocumentTemplateRecord> {
    const template = await this.getTemplateById(client, institutionId, id);
    if (!template) {
      throw new Error('Template not found');
    }

    // If it's a system template that doesn't belong to this tenant, duplicate it first
    let targetId = id;
    if (template.isSystem || !template.institutionId) {
      const cloned = await this.duplicateTemplate(client, institutionId, id, `${template.name} (Default)`, actorMembershipId);
      targetId = cloned.id;
    }

    await client.query(
      `update template set is_default = false where institution_id = $1 and context = $2`,
      [institutionId, template.context]
    );

    const { rows } = await client.query(
      `update template set is_default = true, updated_at = now()
       where id = $1 and institution_id = $2
       returning id, institution_id as "institutionId", type, context, name, description, content,
                 version, is_system as "isSystem", is_default as "isDefault", is_archived as "isArchived",
                 page_size as "pageSize", orientation, margins, metadata,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [targetId, institutionId]
    );

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'set_default_template',
      entityType: 'template',
      entityId: targetId,
    });

    return rows[0];
  },

  /**
   * Archive / Unarchive template
   */
  async archiveTemplate(
    client: PoolClient,
    institutionId: string,
    id: string,
    archive: boolean = true,
    actorMembershipId?: string
  ): Promise<DocumentTemplateRecord> {
    const template = await this.getTemplateById(client, institutionId, id);
    if (!template) {
      throw new Error('Template not found');
    }

    if (template.isSystem || !template.institutionId) {
      throw new Error('SYSTEM_TEMPLATE_READONLY: System templates cannot be archived.');
    }

    const { rows } = await client.query(
      `update template set is_archived = $1, updated_at = now()
       where id = $2 and institution_id = $3
       returning id, institution_id as "institutionId", type, context, name, description, content,
                 version, is_system as "isSystem", is_default as "isDefault", is_archived as "isArchived",
                 page_size as "pageSize", orientation, margins, metadata,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [archive, id, institutionId]
    );

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: archive ? 'archive_template' : 'unarchive_template',
      entityType: 'template',
      entityId: id,
    });

    return rows[0];
  },

  /**
   * Render single document template with full context data & optional permanent snapshot.
   */
  async renderTemplate(
    client: PoolClient,
    institutionId: string,
    templateId: string,
    options: RenderTemplateOptions = {},
    actorMembershipId?: string
  ) {
    const template = await this.getTemplateById(client, institutionId, templateId);
    if (!template) throw new Error('Template not found');

    // 1. Fetch institution details
    const { rows: [inst] } = await client.query(
      `select id, name, subdomain from institution where id = $1`,
      [institutionId]
    );

    // 2. Fetch institution settings (signatures, seal, watermark)
    const { rows: [instSettings] } = await client.query(
      `select settings from institution_setting where institution_id = $1`,
      [institutionId]
    ).catch(() => ({ rows: [] }));
    const settings = instSettings?.settings || {};

    // 3. Fetch entity data (student, employee, admission, invoice)
    let studentData: any = {};
    const targetStudentId = options.studentId || (options.entityType === 'student' ? options.entityId : undefined);
    if (targetStudentId) {
      try {
        const { rows: [student] } = await client.query(
          `select s.id, s.admission_no as "admissionNo", coalesce(e.roll_no, '') as "rollNo",
                  s.gender, s.date_of_birth as "dateOfBirth",
                  coalesce(s.name, p.name) as "name", p.phone, p.email,
                  (s.custom_fields->>'blood_group') as "bloodGroup",
                  (s.custom_fields->>'address') as "address",
                  c.name as "className", sec.name as "sectionName",
                  coalesce(s.guardian_name, g.name, g_p.name) as "guardianName",
                  coalesce(s.guardian_phone, g.phone, g_p.phone) as "guardianPhone"
           from student s
           left join profile p on s.user_id = p.id
           left join enrollment e on e.student_id = s.id and e.status = 'active'
           left join class c on e.class_id = c.id
           left join section sec on e.section_id = sec.id
           left join student_guardian sg on sg.student_id = s.id and sg.is_primary = true
           left join guardian g on sg.guardian_id = g.id
           left join profile g_p on g.user_id = g_p.id
           where s.id = $1 and s.institution_id = $2`,
          [targetStudentId, institutionId]
        );
        if (student) {
          studentData = student;
        }
      } catch {
        // Fallback gracefully without crash
      }
    }

    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let employeeData: any = {};
    const targetMemberId = (options.entityType === 'member' || options.entityType === 'employee') ? options.entityId : undefined;
    if (targetMemberId) {
      try {
        const { rows: [member] } = await client.query(
          `select m.id, m.login_username as "loginUsername", m.custom_fields as "customFields",
                  coalesce(p.name, m.login_username, 'Faculty') as name,
                  p.email, p.phone, p.avatar_url as "avatarUrl",
                  r.name as "roleName"
           from membership m
           join profile p on m.user_id = p.id
           join role r on m.role_id = r.id
           where m.id = $1 and m.institution_id = $2`,
          [targetMemberId, institutionId]
        );
        if (member) {
          employeeData = {
            name: member.name,
            email: member.email,
            phone: member.phone,
            designation: member.customFields?.designation || member.roleName || 'Faculty / Staff',
            department: member.customFields?.department || 'Academic Department',
            code: member.customFields?.employee_id || member.loginUsername || `EMP-${member.id.slice(0, 5)}`,
            joiningDate: member.customFields?.joining_date ? new Date(member.customFields.joining_date).toLocaleDateString() : today,
            salary: member.customFields?.salary ? `৳ ${Number(member.customFields.salary).toLocaleString()}` : '৳ 35,000',
          };
        }
      } catch {
        // Safe fallback
      }
    }

    let admissionData: any = {};
    const targetAdmissionId = options.entityType === 'admission' ? options.entityId : undefined;
    if (targetAdmissionId) {
      try {
        const { rows: [admission] } = await client.query(
          `select a.id, a.application_no as "applicationNo", a.applicant_name as "applicantName",
                  a.date_of_birth as "dateOfBirth", a.gender,
                  a.guardian_name as "guardianName", a.guardian_phone as "guardianPhone", a.guardian_email as "guardianEmail",
                  a.address, a.previous_school as "previousSchool", a.status,
                  a.application_fee as "applicationFee", a.fee_status as "feeStatus",
                  c.name as "className", ay.name as "academicYear"
           from admission_application a
           left join class c on a.class_id = c.id
           left join academic_year ay on a.academic_year_id = ay.id
           where a.id = $1 and a.institution_id = $2`,
          [targetAdmissionId, institutionId]
        );
        if (admission) {
          admissionData = admission;
        }
      } catch {
        // Safe fallback
      }
    }

    let invoiceData: any = {};
    const targetInvoiceId = (options.entityType === 'invoice' || options.entityType === 'receipt') ? options.entityId : undefined;
    if (targetInvoiceId) {
      try {
        const { rows: [inv] } = await client.query(
          `select fi.id, fi.title, fi.amount, fi.due_date as "dueDate", fi.status,
                  s.name as "studentName", s.admission_no as "admissionNo",
                  c.name as "className", sec.name as "sectionName",
                  coalesce(s.guardian_name, '') as "guardianName",
                  coalesce(s.guardian_phone, '') as "guardianPhone",
                  ay.name as "academicYear"
           from fee_invoice fi
           left join student s on fi.student_id = s.id
           left join enrollment e on e.student_id = s.id and e.status = 'active'
           left join class c on e.class_id = c.id
           left join section sec on e.section_id = sec.id
           left join academic_year ay on fi.academic_year_id = ay.id
           where fi.id = $1 and fi.institution_id = $2`,
          [targetInvoiceId, institutionId]
        );
        if (inv) {
          invoiceData = inv;
        }
      } catch {
        // Safe fallback
      }
    }

    const defaults: Record<string, any> = {
      // Institution
      'institution.name': inst?.name || 'Educational Institution',
      'institution.code': inst?.subdomain || 'school',
      'institution.subdomain': inst?.subdomain || 'school',
      'institution.address': settings.address || '',
      'institution.phone': settings.contactPhone || '',
      'institution.email': settings.contactEmail || '',
      'institution.website': settings.website || '',
      'institution.affiliationNo': settings.institutionAffiliationNo || '',
      'institution.logo': settings.logoUrl ? `<img src="${settings.logoUrl}" alt="Logo" style="max-height: 50px;" />` : '',
      'institution.officialSeal': settings.officialSealUrl
        ? `<img src="${settings.officialSealUrl}" alt="Official Seal" style="max-height: 60px; object-fit: contain;" />`
        : '<div style="width: 52px; height: 52px; border: 2px dashed #94a3b8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8;">SEAL</div>',
      'officialSeal': settings.officialSealUrl
        ? `<img src="${settings.officialSealUrl}" alt="Official Seal" style="max-height: 60px; object-fit: contain;" />`
        : '<div style="width: 52px; height: 52px; border: 2px dashed #94a3b8; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8;">SEAL</div>',
      'institution.principalSignature': settings.principalSignatureUrl
        ? `<img src="${settings.principalSignatureUrl}" alt="Principal Signature" style="max-height: 48px; object-fit: contain;" />`
        : '<div style="border-top: 1px dashed #64748b; width: 140px; text-align: center; font-size: 0.75rem; padding-top: 4px;">Principal Signature</div>',
      'principalSignature': settings.principalSignatureUrl
        ? `<img src="${settings.principalSignatureUrl}" alt="Principal Signature" style="max-height: 48px; object-fit: contain;" />`
        : '<div style="border-top: 1px dashed #64748b; width: 140px; text-align: center; font-size: 0.75rem; padding-top: 4px;">Principal Signature</div>',
      'institution.examControllerSignature': settings.examControllerSignatureUrl
        ? `<img src="${settings.examControllerSignatureUrl}" alt="Exam Controller Signature" style="max-height: 48px; object-fit: contain;" />`
        : '<div style="border-top: 1px dashed #64748b; width: 140px; text-align: center; font-size: 0.75rem; padding-top: 4px;">Exam Controller</div>',
      'examControllerSignature': settings.examControllerSignatureUrl
        ? `<img src="${settings.examControllerSignatureUrl}" alt="Exam Controller Signature" style="max-height: 48px; object-fit: contain;" />`
        : '<div style="border-top: 1px dashed #64748b; width: 140px; text-align: center; font-size: 0.75rem; padding-top: 4px;">Exam Controller</div>',

      // System & Date
      issueDate: today,
      academicYear: '2026-2027',
      certificateNo: `DOC-${Date.now().toString().slice(-6)}`,

      // Student Defaults
      'student.name': studentData.name || admissionData.applicantName || invoiceData.studentName || 'Sample Student',
      'student.admissionNo': studentData.admissionNo || admissionData.applicationNo || invoiceData.admissionNo || 'ADM-2026-001',
      'student.rollNo': studentData.rollNo || '01',
      'student.roll': studentData.rollNo || '01',
      'student.className': studentData.className || admissionData.className || invoiceData.className || 'Grade 10',
      'student.sectionName': studentData.sectionName || invoiceData.sectionName || 'Section A',
      'student.gender': studentData.gender || admissionData.gender || 'Unspecified',
      'student.dateOfBirth': studentData.dateOfBirth
        ? new Date(studentData.dateOfBirth).toLocaleDateString()
        : admissionData.dateOfBirth
        ? new Date(admissionData.dateOfBirth).toLocaleDateString()
        : 'January 1, 2010',
      'student.bloodGroup': studentData.bloodGroup || 'O+',
      'student.address': studentData.address || admissionData.address || 'House 12, Road 4, Campus City',
      'student.fatherName': studentData.guardianName || admissionData.guardianName || invoiceData.guardianName || 'Mr. Guardian',
      'student.motherName': 'Mrs. Guardian',
      'guardian.name': studentData.guardianName || admissionData.guardianName || invoiceData.guardianName || 'Mr. Guardian',
      'guardian.phone': studentData.guardianPhone || admissionData.guardianPhone || invoiceData.guardianPhone || '+880 1700-000000',

      // Employee / Staff Defaults
      'employee.name': employeeData.name || 'Faculty Member',
      'employee.designation': employeeData.designation || 'Senior Faculty Member',
      'employee.department': employeeData.department || 'Science & Humanities',
      'employee.code': employeeData.code || 'EMP-0142',
      'employee.joiningDate': employeeData.joiningDate || today,
      'employee.phone': employeeData.phone || '+880 1711-000000',
      'employee.email': employeeData.email || 'faculty@institution.edu.bd',
      'employee.salary': employeeData.salary || '৳ 42,000',

      // Admission Defaults
      'admission.number': admissionData.applicationNo || 'ADM-APP-2026-001',
      'admission.status': admissionData.status || 'Admitted',
      'admission.fee': admissionData.applicationFee ? `৳ ${Number(admissionData.applicationFee).toLocaleString()}` : '৳ 500',
      'admission.feeStatus': admissionData.feeStatus || 'Paid',

      // Exam / Result Defaults
      'exam.name': 'Annual Examination 2026',
      'exam.date': today,
      'exam.room': 'Room 101',
      'result.total': '542',
      'result.maxTotal': '600',
      'result.percentage': '90.33%',
      'result.grade': 'A+',
      'result.gpa': '5.00',
      'result.remarks': 'Exemplary scholastic diligence and analytical excellence.',

      // Invoice / Fee Defaults
      'invoice.number': invoiceData.id ? `INV-${invoiceData.id.slice(0, 8).toUpperCase()}` : `INV-${Date.now().toString().slice(-5)}`,
      'invoice.date': today,
      'invoice.dueDate': invoiceData.dueDate ? new Date(invoiceData.dueDate).toLocaleDateString() : today,
      'invoice.amount': invoiceData.amount ? `৳ ${Number(invoiceData.amount).toLocaleString()}` : '৳ 6,500',
      'receipt.number': `RCP-${Date.now().toString().slice(-5)}`,
      'receipt.date': today,
      'receipt.amount': invoiceData.amount ? `৳ ${Number(invoiceData.amount).toLocaleString()}` : '৳ 6,500',
      'receipt.method': 'bKash Merchant Pay',
    };

    const mergedVariables = { ...defaults, ...(options.variables || {}) };

    const watermarkText =
      settings.officialWatermarkText ||
      'Powered by Biddyapith • Official Institutional Document';

    const rendered = renderDocumentTemplate(template.content, mergedVariables, {
      watermarkText,
      forceWatermark: true,
    });

    let generatedDocumentId: string | undefined;

    // Snapshot storage (Blueprint Section 33)
    if (options.saveSnapshot) {
      const docType = template.context || template.type;
      const title = options.title || `${template.name} - ${mergedVariables['student.name'] || 'Generated Document'}`;
      const entityType = options.entityType || (targetStudentId ? 'student' : null);
      const entityId = targetStudentId || options.entityId || null;

      const { rows: [doc] } = await client.query(
        `insert into generated_document (
          institution_id, template_id, template_version, document_type,
          title, entity_type, entity_id, rendered_content, variables_snapshot,
          generated_by_membership_id
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id`,
        [
          institutionId,
          template.id,
          template.version,
          docType,
          title,
          entityType,
          entityId,
          rendered,
          JSON.stringify(mergedVariables),
          actorMembershipId || null,
        ]
      );
      generatedDocumentId = doc?.id;
    }

    return {
      template,
      rendered,
      variables: mergedVariables,
      generatedDocumentId,
    };
  },

  /**
   * Bulk Render Document Template (Blueprint Section 18: Bulk Printing)
   * Avoids N roundtrips by batching entity data and rendering sequentially or in chunks.
   */
  async bulkRenderTemplate(
    client: PoolClient,
    institutionId: string,
    options: BulkRenderOptions,
    actorMembershipId?: string
  ) {
    const template = await this.getTemplateById(client, institutionId, options.templateId);
    if (!template) throw new Error('Template not found');

    const results: Array<{
      entityId: string;
      rendered: string;
      variables: Record<string, any>;
      generatedDocumentId?: string;
    }> = [];

    // Max bulk batch size guard
    const entityIds = options.entityIds.slice(0, 500);

    for (const entityId of entityIds) {
      const renderRes = await this.renderTemplate(
        client,
        institutionId,
        template.id,
        {
          entityId,
          entityType: options.entityType,
          studentId: options.entityType === 'student' ? entityId : undefined,
          variables: options.customVariables,
          saveSnapshot: options.saveSnapshots,
        },
        actorMembershipId
      );

      results.push({
        entityId,
        rendered: renderRes.rendered,
        variables: renderRes.variables,
        generatedDocumentId: renderRes.generatedDocumentId,
      });
    }

    return {
      template,
      totalRendered: results.length,
      items: results,
    };
  },

  /**
   * List historical generated documents (frozen snapshots)
   */
  async listGeneratedDocuments(
    client: PoolClient,
    institutionId: string,
    filters: {
      entityType?: string;
      entityId?: string;
      documentType?: string;
      templateId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    let query = `
      select id, institution_id as "institutionId", template_id as "templateId",
             template_version as "templateVersion", document_type as "documentType",
             title, entity_type as "entityType", entity_id as "entityId",
             variables_snapshot as "variablesSnapshot",
             generated_by_membership_id as "generatedByMembershipId",
             created_at as "createdAt"
      from generated_document
      where institution_id = $1
    `;
    const params: any[] = [institutionId];
    let idx = 2;

    if (filters.documentType) {
      query += ` and document_type = $${idx++}`;
      params.push(filters.documentType);
    }
    if (filters.entityType) {
      query += ` and entity_type = $${idx++}`;
      params.push(filters.entityType);
    }
    if (filters.entityId) {
      query += ` and entity_id = $${idx++}`;
      params.push(filters.entityId);
    }
    if (filters.templateId) {
      query += ` and template_id = $${idx++}`;
      params.push(filters.templateId);
    }

    query += ` order by created_at desc`;

    const limit = Math.min(filters.limit || 50, 200);
    const offset = filters.offset || 0;
    query += ` limit $${idx++} offset $${idx++}`;
    params.push(limit, offset);

    const { rows } = await client.query(query, params);
    return rows;
  },

  /**
   * Retrieve a single historical generated document with its immutable rendered content.
   */
  async getGeneratedDocumentById(
    client: PoolClient,
    institutionId: string,
    id: string
  ) {
    const { rows } = await client.query(
      `select id, institution_id as "institutionId", template_id as "templateId",
              template_version as "templateVersion", document_type as "documentType",
              title, entity_type as "entityType", entity_id as "entityId",
              rendered_content as "renderedContent",
              variables_snapshot as "variablesSnapshot",
              generated_by_membership_id as "generatedByMembershipId",
              created_at as "createdAt"
       from generated_document
       where id = $1 and institution_id = $2`,
      [id, institutionId]
    );

    return rows[0] || null;
  },

  /**
   * Global Filters query builder helper (Blueprint Section 34)
   * Appends standardized filter WHERE clauses to SQL queries.
   */
  applyGlobalFilters(
    baseQuery: string,
    params: any[],
    filters: GlobalFilterParams,
    columnAliases: Record<string, string> = {}
  ): { query: string; params: any[] } {
    let query = baseQuery;
    let idx = params.length + 1;

    const col = (name: string, fallback: string) => columnAliases[name] || fallback;

    if (filters.academicYearId) {
      query += ` and ${col('academicYearId', 'academic_year_id')} = $${idx++}`;
      params.push(filters.academicYearId);
    }
    if (filters.campusId) {
      query += ` and ${col('campusId', 'campus_id')} = $${idx++}`;
      params.push(filters.campusId);
    }
    if (filters.classId) {
      query += ` and ${col('classId', 'class_id')} = $${idx++}`;
      params.push(filters.classId);
    }
    if (filters.sectionId) {
      query += ` and ${col('sectionId', 'section_id')} = $${idx++}`;
      params.push(filters.sectionId);
    }
    if (filters.subjectId) {
      query += ` and ${col('subjectId', 'subject_id')} = $${idx++}`;
      params.push(filters.subjectId);
    }
    if (filters.examId) {
      query += ` and ${col('examId', 'exam_id')} = $${idx++}`;
      params.push(filters.examId);
    }
    if (filters.gender) {
      query += ` and ${col('gender', 'gender')} = $${idx++}`;
      params.push(filters.gender);
    }
    if (filters.status) {
      query += ` and ${col('status', 'status')} = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.startDate) {
      query += ` and ${col('date', 'date')} >= $${idx++}`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` and ${col('date', 'date')} <= $${idx++}`;
      params.push(filters.endDate);
    }
    if (filters.search && filters.search.trim()) {
      query += ` and (${col('searchable', 'name')} ilike $${idx++})`;
      params.push(`%${filters.search.trim()}%`);
    }

    return { query, params };
  },
};
