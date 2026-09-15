import { describe, it, expect, vi, beforeEach } from 'vitest';
import { documentsManifest } from '../../src/modules/documents/manifest.js';
import {
  CANONICAL_VARIABLES,
  getVariablesForContext,
  getVariablesByCategory,
} from '../../src/modules/documents/variable-registry.js';
import { SYSTEM_TEMPLATES } from '../../src/modules/documents/system-templates.js';
import { renderDocumentTemplate } from '../../src/modules/documents/template-engine.js';
import { documentsRepo } from '../../src/modules/documents/repository.js';

describe('Chunk 5: Document Template Builder, Central Variable Registry, System Templates, Watermarking & Versioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. MANIFEST & ROUTE PERMISSIONS (Sections 28, 30, 31)
  // ==========================================================================
  describe('Manifest & Permissions', () => {
    it('declares templates.read, templates.manage, and documents.generate permissions', () => {
      const perms = documentsManifest.permissions.map((p) => p.key);
      expect(perms).toContain('templates.read');
      expect(perms).toContain('templates.manage');
      expect(perms).toContain('documents.generate');
    });

    it('validates template creation payload schema', () => {
      const createRoute = documentsManifest.routes.find((r) => r.method === 'POST' && r.path === '/templates');
      const validator = createRoute?.validation?.body;
      expect(validator).toBeDefined();

      const validPayload = {
        name: 'Official Term Marksheet',
        type: 'marksheet',
        context: 'marksheet',
        content: '<div>{{student.name}}</div>',
        pageSize: 'A4',
        orientation: 'portrait',
        margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
        isDefault: true,
      };

      const parsed = validator?.safeParse(validPayload);
      expect(parsed?.success).toBe(true);
    });

    it('rejects template creation when content or name is empty', () => {
      const createRoute = documentsManifest.routes.find((r) => r.method === 'POST' && r.path === '/templates');
      const validator = createRoute?.validation?.body;

      const invalidPayload = {
        name: '',
        type: 'marksheet',
        content: '',
      };

      const parsed = validator?.safeParse(invalidPayload);
      expect(parsed?.success).toBe(false);
    });
  });

  // ==========================================================================
  // 2. CENTRAL VARIABLE REGISTRY (Section 29 & 30)
  // ==========================================================================
  describe('Central Variable Registry', () => {
    it('defines canonical variables across all 15 required categories', () => {
      const categories = new Set(CANONICAL_VARIABLES.map((v) => v.category));
      const requiredCategories = [
        'institution',
        'academic',
        'student',
        'guardian',
        'employee',
        'teacher',
        'class',
        'section',
        'subject',
        'exam',
        'result',
        'finance',
        'invoice',
        'attendance',
        'assignment',
      ];

      for (const cat of requiredCategories) {
        expect(categories.has(cat as any), `Missing category: ${cat}`).toBe(true);
      }
    });

    it('verifies that each variable contains mandatory metadata (key, label, type, source, availability, description)', () => {
      for (const v of CANONICAL_VARIABLES) {
        expect(v.key).toBeTruthy();
        expect(v.label).toBeTruthy();
        expect(v.type).toMatch(/string|number|date|image|boolean|array/);
        expect(v.source).toBeTruthy();
        expect(Array.isArray(v.availability)).toBe(true);
        expect(v.availability.length).toBeGreaterThan(0);
        expect(v.description).toBeTruthy();
      }
    });

    it('dynamically scopes variables based on template context (Section 30)', () => {
      // Marksheet context should include student, exam, result, subjects, but not employee salary
      const marksheetVars = getVariablesForContext('marksheet');
      const keys = marksheetVars.map((v) => v.key);

      expect(keys).toContain('student.name');
      expect(keys).toContain('institution.name');
      expect(keys).toContain('result.grade');
      expect(keys).toContain('result.gpa');
      expect(keys).not.toContain('employee.salary');

      // Salary Slip context should include employee & salary variables
      const salaryVars = getVariablesForContext('salary_slip');
      const salaryKeys = salaryVars.map((v) => v.key);

      expect(salaryKeys).toContain('employee.name');
      expect(salaryKeys).toContain('employee.salary');
      expect(salaryKeys).toContain('employee.designation');
    });

    it('returns all variables for custom or unspecified context', () => {
      const customVars = getVariablesForContext('custom');
      expect(customVars.length).toBe(CANONICAL_VARIABLES.length);

      const defaultVars = getVariablesForContext();
      expect(defaultVars.length).toBe(CANONICAL_VARIABLES.length);
    });

    it('groups variables by category', () => {
      const grouped = getVariablesByCategory();
      expect(grouped['institution'].length).toBeGreaterThan(0);
      expect(grouped['student'].length).toBeGreaterThan(0);
      expect(grouped['result'].length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 3. TEMPLATE ENGINE & MANDATORY WATERMARK (Sections 16, 28, 32)
  // ==========================================================================
  describe('Document Template Engine', () => {
    it('interpolates simple variables and unescaped HTML values', () => {
      const template = '<h1>{{institution.name}}</h1><p>{{student.name}}</p><div>{{{officialSeal}}}</div>';
      const data = {
        institution: { name: 'Sylhet Government High School' },
        student: { name: 'Arafat Hossain' },
        officialSeal: '<img src="/seal.png" alt="Seal" />',
      };

      const rendered = renderDocumentTemplate(template, data);
      expect(rendered).toContain('<h1>Sylhet Government High School</h1>');
      expect(rendered).toContain('<p>Arafat Hossain</p>');
      expect(rendered).toContain('<img src="/seal.png" alt="Seal" />');
    });

    it('processes conditional blocks ({{#if}} ... {{else}} ... {{/if}})', () => {
      const template = '<div>{{#if honors}}<span>Passed with Honors</span>{{else}}<span>Standard Pass</span>{{/if}}</div>';

      const honorsRender = renderDocumentTemplate(template, { honors: true });
      expect(honorsRender).toContain('<span>Passed with Honors</span>');
      expect(honorsRender).not.toContain('<span>Standard Pass</span>');

      const regularRender = renderDocumentTemplate(template, { honors: false });
      expect(regularRender).toContain('<span>Standard Pass</span>');
      expect(regularRender).not.toContain('<span>Passed with Honors</span>');
    });

    it('processes repeating / loop blocks ({{#subjects}} ... {{/subjects}}) with loop counters', () => {
      const template = `
        <table>
          {{#subjects}}
          <tr>
            <td>{{@number}}</td>
            <td>{{name}}</td>
            <td>{{mark}}</td>
            <td>{{grade}}</td>
          </tr>
          {{/subjects}}
        </table>
      `;

      const data = {
        subjects: [
          { name: 'Physics', mark: 92, grade: 'A+' },
          { name: 'Chemistry', mark: 86, grade: 'A+' },
          { name: 'Mathematics', mark: 98, grade: 'A+' },
        ],
      };

      const rendered = renderDocumentTemplate(template, data);
      expect(rendered).toContain('Physics');
      expect(rendered).toContain('Chemistry');
      expect(rendered).toContain('Mathematics');
      expect(rendered).toContain('<td>1</td>');
      expect(rendered).toContain('<td>2</td>');
      expect(rendered).toContain('<td>3</td>');
    });

    it('architecturally enforces mandatory Biddyapith watermark layer (Section 32)', () => {
      const template = '<div class="content">Sample Institutional Certificate</div>';
      const rendered = renderDocumentTemplate(template, {});

      // Mandatory branding layer must be appended
      expect(rendered).toContain('biddyapith-footer-watermark');
      expect(rendered).toContain('Powered by Biddyapith • Official Institutional Document');
    });

    it('allows customized official watermark text while preserving non-removable layer', () => {
      const template = '<div>Document</div>';
      const rendered = renderDocumentTemplate(template, {}, {
        watermarkText: 'Powered by Biddyapith • Verified Institutional Academic Document',
      });

      expect(rendered).toContain('biddyapith-footer-watermark');
      expect(rendered).toContain('Powered by Biddyapith • Verified Institutional Academic Document');
    });
  });

  // ==========================================================================
  // 4. SYSTEM TEMPLATES & READ-ONLY PROTECTION (Section 31)
  // ==========================================================================
  describe('System Templates & Immutability', () => {
    it('provides all 14 pre-seeded default system templates', () => {
      expect(SYSTEM_TEMPLATES.length).toBe(14);

      const templateNames = SYSTEM_TEMPLATES.map((t) => t.name);
      expect(templateNames).toContain('Official Student Marksheet & Academic Transcript');
      expect(templateNames).toContain('Official Student ID Card (Pocket Card)');
      expect(templateNames).toContain('Institutional Admission Application Form');
      expect(templateNames).toContain('Official Institutional Transfer Certificate (TC)');
      expect(templateNames).toContain('Student Character & Testimonial Certificate');
      expect(templateNames).toContain('Institutional Staff & Faculty ID Card');
      expect(templateNames).toContain('Official Employee Appointment Letter');
      expect(templateNames).toContain('Monthly Employee Salary Slip / Payslip');
      expect(templateNames).toContain('Official Student Tuition & Fee Invoice');
      expect(templateNames).toContain('Official Fee Payment Receipt (Money Receipt)');
      expect(templateNames).toContain('Annual Student Fee Statement & Dues Summary');
      expect(templateNames).toContain('Examination Hall Attendance Register Sheet');
      expect(templateNames).toContain('Examination Room Seating Allocation List');
      expect(templateNames).toContain('Class Academic Result & Performance Summary');
    });

    it('sets system templates as isSystem: true, version: 1, and isDefault: true', () => {
      for (const sys of SYSTEM_TEMPLATES) {
        expect(sys.isSystem).toBe(true);
        expect(sys.version).toBe(1);
        expect(sys.isDefault).toBe(true);
        expect(sys.pageSize).toMatch(/A4|Letter|Legal|ID_CARD/);
        expect(sys.orientation).toMatch(/portrait|landscape/);
      }
    });

    it('prevents modifying or deleting system templates with SYSTEM_TEMPLATE_READONLY guard', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as any;

      const systemTemplate = SYSTEM_TEMPLATES[0]; // Marksheet

      // Attempt update
      await expect(
        documentsRepo.updateTemplate(mockClient, 'inst-123', systemTemplate.id, {
          name: 'Hacked System Template',
        })
      ).rejects.toThrow('SYSTEM_TEMPLATE_READONLY');

      // Attempt delete
      await expect(
        documentsRepo.deleteTemplate(mockClient, 'inst-123', systemTemplate.id)
      ).rejects.toThrow('SYSTEM_TEMPLATE_READONLY');

      // Attempt archive
      await expect(
        documentsRepo.archiveTemplate(mockClient, 'inst-123', systemTemplate.id, true)
      ).rejects.toThrow('SYSTEM_TEMPLATE_READONLY');
    });
  });

  // ==========================================================================
  // 5. TEMPLATE REPOSITORY & VERSIONING (Sections 31, 33)
  // ==========================================================================
  describe('Template CRUD & Auto-Incrementing Versioning', () => {
    it('creates a new custom template with version 1', async () => {
      const createdRecord = {
        id: 'cust-tmpl-1',
        institutionId: 'inst-1',
        type: 'marksheet',
        context: 'marksheet',
        name: 'Custom Marksheet',
        content: '<div>Marks</div>',
        version: 1,
        isSystem: false,
        isDefault: false,
        isArchived: false,
        pageSize: 'A4',
        orientation: 'portrait',
        margins: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [createdRecord] }),
      } as any;

      const res = await documentsRepo.createTemplate(mockClient, 'inst-1', {
        name: 'Custom Marksheet',
        type: 'marksheet',
        content: '<div>Marks</div>',
      });

      expect(res.version).toBe(1);
      expect(res.isSystem).toBe(false);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('insert into template'),
        expect.arrayContaining(['inst-1', 'marksheet', 'marksheet', 'Custom Marksheet'])
      );
    });

    it('auto-increments version when updating an existing custom template (Section 33)', async () => {
      const existing = {
        id: 'cust-tmpl-1',
        institutionId: 'inst-1',
        type: 'marksheet',
        context: 'marksheet',
        name: 'Custom Marksheet',
        content: '<div>Old</div>',
        version: 2,
        isSystem: false,
        isDefault: false,
        isArchived: false,
        pageSize: 'A4',
        orientation: 'portrait',
        margins: {},
        metadata: {},
      };

      const updated = {
        ...existing,
        name: 'Custom Marksheet v3',
        version: 3, // incremented
      };

      const mockClient = {
        query: vi
          .fn()
          // First query: getTemplateById
          .mockResolvedValueOnce({ rows: [existing] })
          // Second query: update template
          .mockResolvedValueOnce({ rows: [updated] })
          // Audit log
          .mockResolvedValueOnce({ rows: [] }),
      } as any;

      const res = await documentsRepo.updateTemplate(mockClient, 'inst-1', 'cust-tmpl-1', {
        name: 'Custom Marksheet v3',
      });

      expect(res.version).toBe(3);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('update template'),
        expect.arrayContaining([3]) // nextVersion = 3 passed to query
      );
    });

    it('duplicates a system template into a custom mutable template for the institution', async () => {
      const cloned = {
        id: 'new-cloned-id',
        institutionId: 'inst-1',
        type: 'marksheet',
        context: 'marksheet',
        name: 'Official Student Marksheet & Academic Transcript (Customized)',
        version: 1,
        isSystem: false,
      };

      const mockClient = {
        query: vi
          .fn()
          // getTemplateById (system template fallback returns in-memory)
          .mockResolvedValueOnce({ rows: [] })
          // createTemplate insert
          .mockResolvedValueOnce({ rows: [cloned] })
          // audit
          .mockResolvedValueOnce({ rows: [] }),
      } as any;

      const res = await documentsRepo.duplicateTemplate(
        mockClient,
        'inst-1',
        SYSTEM_TEMPLATES[0].id
      );

      expect(res.id).toBe('new-cloned-id');
      expect(res.isSystem).toBe(false);
      expect(res.version).toBe(1);
    });
  });

  // ==========================================================================
  // 6. HISTORICAL GENERATED DOCUMENTS & SNAPSHOTS (Section 33)
  // ==========================================================================
  describe('Generated Document Snapshots', () => {
    it('saves a frozen visual snapshot when renderTemplate has saveSnapshot: true', async () => {
      const template = {
        id: 'tmpl-1',
        institutionId: 'inst-1',
        type: 'certificate',
        context: 'certificate',
        name: 'Honor Certificate',
        content: '<div>Certificate for {{student.name}}</div>',
        version: 2,
        isSystem: false,
        isDefault: false,
        isArchived: false,
        pageSize: 'A4',
        orientation: 'portrait',
        margins: {},
        metadata: {},
      };

      const mockClient = {
        query: vi
          .fn()
          // getTemplateById
          .mockResolvedValueOnce({ rows: [template] })
          // institution name
          .mockResolvedValueOnce({ rows: [{ id: 'inst-1', name: 'Barisal Model Academy', subdomain: 'bma' }] })
          // institution settings
          .mockResolvedValueOnce({ rows: [{ settings: {} }] })
          // insert into generated_document snapshot
          .mockResolvedValueOnce({ rows: [{ id: 'gen-doc-123' }] }),
      } as any;

      const res = await documentsRepo.renderTemplate(
        mockClient,
        'inst-1',
        'tmpl-1',
        {
          variables: { 'student.name': 'Nabila Faruq' },
          saveSnapshot: true,
          title: 'Honor Certificate - Nabila Faruq',
        }
      );

      expect(res.generatedDocumentId).toBe('gen-doc-123');
      expect(res.rendered).toContain('Nabila Faruq');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('insert into generated_document'),
        expect.arrayContaining(['inst-1', 'tmpl-1', 2, 'certificate', 'Honor Certificate - Nabila Faruq'])
      );
    });
  });

  // ==========================================================================
  // 7. BULK RENDERING ENGINE (Section 18)
  // ==========================================================================
  describe('Bulk Rendering Engine', () => {
    it('bulk renders documents for multiple entities in a single call', async () => {
      const template = {
        id: 'tmpl-admit',
        institutionId: 'inst-1',
        type: 'admit_card',
        context: 'admit_card',
        name: 'Exam Admit Card',
        content: '<div>Admit Card for {{student.name}}</div>',
        version: 1,
        isSystem: false,
        isDefault: true,
        isArchived: false,
        pageSize: 'A4',
        orientation: 'portrait',
        margins: {},
        metadata: {},
      };

      const mockClient = {
        query: vi.fn().mockImplementation((q: string) => {
          if (q.includes('from template')) return Promise.resolve({ rows: [template] });
          if (q.includes('from institution where')) return Promise.resolve({ rows: [{ id: 'inst-1', name: 'Chittagong High' }] });
          if (q.includes('from institution_setting')) return Promise.resolve({ rows: [] });
          if (q.includes('from student s')) return Promise.resolve({ rows: [] });
          return Promise.resolve({ rows: [] });
        }),
      } as any;

      const bulkRes = await documentsRepo.bulkRenderTemplate(mockClient, 'inst-1', {
        templateId: 'tmpl-admit',
        entityType: 'student',
        entityIds: ['student-1', 'student-2', 'student-3'],
      });

      expect(bulkRes.totalRendered).toBe(3);
      expect(bulkRes.items.length).toBe(3);
      expect(bulkRes.items[0].rendered).toContain('biddyapith-footer-watermark');
    });
  });

  // ==========================================================================
  // 8. GLOBAL FILTER ENGINE (Section 34)
  // ==========================================================================
  describe('Global Filter Query Helper', () => {
    it('appends academic year, class, section, subject, exam, and date filters', () => {
      const baseQuery = 'select * from student where institution_id = $1';
      const baseParams = ['inst-1'];

      const filters = {
        academicYearId: 'ay-2026',
        classId: 'class-10',
        sectionId: 'sec-a',
        gender: 'Female',
        status: 'active',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        search: 'Tahmid',
      };

      const result = documentsRepo.applyGlobalFilters(baseQuery, baseParams, filters);

      expect(result.query).toContain('academic_year_id = $2');
      expect(result.query).toContain('class_id = $3');
      expect(result.query).toContain('section_id = $4');
      expect(result.query).toContain('gender = $5');
      expect(result.query).toContain('status = $6');
      expect(result.query).toContain('date >= $7');
      expect(result.query).toContain('date <= $8');
      expect(result.query).toContain('name ilike $9');

      expect(result.params).toEqual([
        'inst-1',
        'ay-2026',
        'class-10',
        'sec-a',
        'Female',
        'active',
        '2026-01-01',
        '2026-12-31',
        '%Tahmid%',
      ]);
    });
  });
});

