import React, { useState, useEffect, useRef } from 'react';
import {
  fetchTemplate,
  createTemplate,
  updateTemplate,
  duplicateTemplate,
  fetchVariables,
  fetchInstitutionSettings,
} from '../services/api';
import type { VariableItem } from '../services/api';
import {
  ArrowLeft,
  Save,
  Printer,
  Eye,
  FileCode,
  BookOpen,
  Award,
  Building2,
  Calendar,
  Users,
  Briefcase,
  DollarSign,
  ClipboardList,
  Layers,
  Settings,
  ShieldCheck,
  Check,
  Search,
} from 'lucide-react';
import { Button, Badge } from '../components/common';
import { useSession } from '../context/SessionContext';

interface DocumentTemplateBuilderProps {
  initialTemplateId?: string;
  onNavigate?: (path: string) => void;
}

const TEMPLATE_CONTEXTS = [
  { value: 'marksheet', label: 'Student Marksheet & Transcript', defaultType: 'marksheet' },
  { value: 'id_card', label: 'Student ID Card (Pocket)', defaultType: 'id_card' },
  { value: 'admission_form', label: 'Admission Application Form', defaultType: 'certificate' },
  { value: 'tc', label: 'Transfer Certificate (TC)', defaultType: 'tc' },
  { value: 'certificate', label: 'Character / Testimonial Certificate', defaultType: 'certificate' },
  { value: 'employee_id_card', label: 'Staff & Faculty ID Card', defaultType: 'id_card' },
  { value: 'appointment_letter', label: 'Employee Appointment Letter', defaultType: 'certificate' },
  { value: 'salary_slip', label: 'Monthly Employee Salary Slip', defaultType: 'certificate' },
  { value: 'invoice', label: 'Student Tuition & Fee Invoice', defaultType: 'certificate' },
  { value: 'receipt', label: 'Official Payment / Money Receipt', defaultType: 'certificate' },
  { value: 'fee_statement', label: 'Annual Fee Account Statement', defaultType: 'certificate' },
  { value: 'exam_attendance', label: 'Exam Hall Attendance Sheet', defaultType: 'admit_card' },
  { value: 'exam_room_list', label: 'Exam Room Seating List', defaultType: 'admit_card' },
  { value: 'result_summary', label: 'Result Tabulation Summary', defaultType: 'marksheet' },
  { value: 'custom', label: 'Custom Institutional Document', defaultType: 'custom' },
];

const CATEGORY_ICONS: Record<string, any> = {
  institution: Building2,
  academic: Calendar,
  student: BookOpen,
  guardian: Users,
  employee: Briefcase,
  teacher: Award,
  class: Layers,
  section: Layers,
  subject: BookOpen,
  exam: Award,
  result: Award,
  finance: DollarSign,
  invoice: DollarSign,
  attendance: ClipboardList,
  assignment: ClipboardList,
};

export const DocumentTemplateBuilder: React.FC<DocumentTemplateBuilderProps> = ({
  initialTemplateId,
  onNavigate,
}) => {
  const { institutionName } = useSession();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId || null);
  const [name, setName] = useState('New Document Template');
  const [type, setType] = useState('marksheet');
  const [context, setContext] = useState('marksheet');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [version, setVersion] = useState<number>(1);
  const [isSystem, setIsSystem] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  // Page Controls
  const [pageSize, setPageSize] = useState<'A4' | 'Letter' | 'Legal' | 'ID_CARD'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margins, setMargins] = useState({
    top: '20mm',
    bottom: '20mm',
    left: '20mm',
    right: '20mm',
  });

  const [showPageSettings, setShowPageSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [officialSignatures, setOfficialSignatures] = useState<any>({});

  // Variable Registry State
  const [groupedVariables, setGroupedVariables] = useState<Record<string, VariableItem[]>>({});
  const [activeCategory, setActiveCategory] = useState<string>('student');
  const [tokenSearch, setTokenSearch] = useState('');

  // Load existing template if ID provided
  useEffect(() => {
    if (initialTemplateId) {
      fetchTemplate(initialTemplateId)
        .then((tmpl) => {
          setName(tmpl.name);
          setType(tmpl.type);
          setContext(tmpl.context || tmpl.type || 'marksheet');
          setDescription(tmpl.description || '');
          setContent(tmpl.content);
          setVersion(tmpl.version || 1);
          setIsSystem(Boolean(tmpl.isSystem || !tmpl.institutionId));
          setIsDefault(Boolean(tmpl.isDefault));
          if (tmpl.pageSize) setPageSize(tmpl.pageSize as any);
          if (tmpl.orientation) setOrientation(tmpl.orientation as any);
          if (tmpl.margins) setMargins(tmpl.margins);
        })
        .catch((e) => console.error('Failed to load template', e));
    }
  }, [initialTemplateId]);

  // Load variables dynamically based on current context
  useEffect(() => {
    fetchVariables(context)
      .then((res) => {
        setGroupedVariables(res.grouped || {});
        const catKeys = Object.keys(res.grouped || {});
        if (catKeys.length > 0 && !res.grouped[activeCategory]) {
          setActiveCategory(catKeys[0]);
        }
      })
      .catch((e) => console.error('Failed to load variables', e));
  }, [context]);

  // Load institutional settings (signatures / seals / watermark)
  useEffect(() => {
    fetchInstitutionSettings()
      .then((data) => setOfficialSignatures(data || {}))
      .catch(() => {});
  }, []);

  // Update live preview whenever content, variables, or layout settings change
  useEffect(() => {
    generatePreview(content);
  }, [content, officialSignatures, pageSize, orientation, margins]);

  const generatePreview = (rawContent: string) => {
    if (!rawContent) {
      setPreviewHtml('<p style="color:#94a3b8; text-align:center; padding: 40px;">Template is empty. Write or paste HTML to preview.</p>');
      return;
    }

    let rendered = rawContent;

    // 1. Process Repeating Blocks mock
    const loopRegex = /\{\{#([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
    rendered = rendered.replace(loopRegex, (_match, _key, innerContent) => {
      const mockItems: any[] = [
        { name: 'Bangla Language', maxMarks: '100', mark: '88', grade: 'A+', rollNo: '01', admissionNo: 'ADM-001', seatNo: 'A-12', totalMarks: '540', gpa: '5.00', position: '1st', status: 'Passed' },
        { name: 'English Literature', maxMarks: '100', mark: '84', grade: 'A+', rollNo: '02', admissionNo: 'ADM-002', seatNo: 'A-13', totalMarks: '520', gpa: '4.85', position: '2nd', status: 'Passed' },
        { name: 'Mathematics', maxMarks: '100', mark: '95', grade: 'A+', rollNo: '03', admissionNo: 'ADM-003', seatNo: 'A-14', totalMarks: '512', gpa: '4.75', position: '3rd', status: 'Passed' },
        { name: 'General Science', maxMarks: '100', mark: '82', grade: 'A+', rollNo: '04', admissionNo: 'ADM-004', seatNo: 'A-15', totalMarks: '490', gpa: '4.50', position: '4th', status: 'Passed' },
      ];
      return mockItems
        .map((item, idx) => {
          let row = innerContent
            .replace(/\{\{@number\}\}/g, String(idx + 1))
            .replace(/\{\{@index\}\}/g, String(idx));
          for (const [p, v] of Object.entries(item)) {
            row = row
              .replace(new RegExp(`\\{\\{\\{\\s*${p}\\s*\\}\\}\\}`, 'g'), String(v))
              .replace(new RegExp(`\\{\\{\\s*${p}\\s*\\}\\}`, 'g'), String(v));
          }
          return row;
        })
        .join('');
    });

    // 2. Process Conditionals mock
    const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
    rendered = rendered.replace(ifRegex, (_match, _key, truthy) => truthy);

    // 3. Inject standard preview variables
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const mockVals: Record<string, string> = {
      'institution.name': institutionName || 'Dhaka Model International Academy',
      'institution.code': 'DMIA-2026',
      'institution.address': 'House 42, Road 11, Dhanmondi, Dhaka 1209',
      'institution.phone': '+880 2 9876543',
      'institution.email': 'info@dmia.edu.bd',
      'institution.affiliationNo': officialSignatures.institutionAffiliationNo || 'BD-EDU-10492',
      'student.name': 'Tahmid Rahman',
      'student.admissionNo': 'ADM-2026-0841',
      'student.rollNo': '07',
      'student.roll': '07',
      'student.className': 'Class 10',
      'student.sectionName': 'Section A',
      'student.gender': 'Male',
      'student.dateOfBirth': 'October 12, 2010',
      'student.bloodGroup': 'B+ Positive',
      'student.address': 'Flat 4B, Green Road, Dhanmondi, Dhaka',
      'guardian.name': 'Mr. Anisur Rahman',
      'guardian.phone': '+880 1711-234567',
      'student.fatherName': 'Mr. Anisur Rahman',
      'student.motherName': 'Mrs. Shamima Rahman',
      'employee.name': 'Dr. Shahab Uddin',
      'employee.code': 'EMP-4019',
      'employee.designation': 'Senior Lecturer in Physics',
      'employee.department': 'Faculty of Natural Sciences',
      'employee.joiningDate': 'January 15, 2022',
      'employee.salary': '৳ 55,000',
      'teacher.name': 'Prof. Farhana Haque',
      'class.name': 'Class 10',
      'section.name': 'Section A',
      'exam.name': 'Annual Examination 2026',
      'exam.term': 'Final Term',
      'exam.date': 'November 15, 2026',
      'exam.room': 'Hall 304',
      'result.total': '542',
      'result.maxTotal': '600',
      'result.percentage': '90.33%',
      'result.grade': 'A+',
      'result.gpa': '5.00',
      'result.remarks': 'Exemplary scholastic diligence and analytical excellence.',
      'invoice.number': 'INV-2026-0924',
      'invoice.date': today,
      'invoice.dueDate': 'September 30, 2026',
      'invoice.amount': '৳ 6,500',
      'receipt.number': 'RCP-2026-0819',
      'receipt.date': today,
      'receipt.amount': '৳ 6,500',
      'receipt.method': 'bKash Merchant Pay',
      'attendance.presentDays': '194',
      'attendance.totalDays': '205',
      'attendance.percentage': '94.63%',
      issueDate: today,
      academicYear: '2026-2027',
      certificateNo: 'CERT-2026-894102',
    };

    for (const [k, v] of Object.entries(mockVals)) {
      const reg3 = new RegExp(`\\{\\{\\{\\s*${k}\\s*\\}\\}\\}`, 'g');
      const reg2 = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      rendered = rendered.replace(reg3, v).replace(reg2, v);
    }

    // Signatures & Seals
    const sigImg = officialSignatures.principalSignatureUrl
      ? `<img src="${officialSignatures.principalSignatureUrl}" alt="Principal Signature" style="max-height: 48px; max-width: 140px; object-fit: contain;" />`
      : `<span style="font-family: cursive; font-size: 18px; color: #1e3a8a; font-weight: bold;">Dr. M. Rahman</span>`;
    const sealImg = officialSignatures.officialSealUrl
      ? `<img src="${officialSignatures.officialSealUrl}" alt="Official Seal" style="max-height: 60px; max-width: 60px; object-fit: contain;" />`
      : `<div style="width: 52px; height: 52px; border: 2px dashed #0284c7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; text-transform: uppercase; font-weight: bold; color: #0284c7;">SEAL</div>`;
    const controllerImg = officialSignatures.examControllerSignatureUrl
      ? `<img src="${officialSignatures.examControllerSignatureUrl}" alt="Exam Controller Signature" style="max-height: 48px; max-width: 140px; object-fit: contain;" />`
      : `<span style="font-family: cursive; font-size: 16px; color: #334155; font-weight: bold;">K. H. Faruk</span>`;

    rendered = rendered
      .replace(/\{\{\{?principalSignature\}\}\}?/g, sigImg)
      .replace(/\{\{\{?institution\.principalSignature\}\}\}?/g, sigImg)
      .replace(/\{\{\{?officialSeal\}\}\}?/g, sealImg)
      .replace(/\{\{\{?institution\.officialSeal\}\}\}?/g, sealImg)
      .replace(/\{\{\{?examControllerSignature\}\}\}?/g, controllerImg)
      .replace(/\{\{\{?institution\.examControllerSignature\}\}\}?/g, controllerImg);

    // Mandatory System Watermark Layer (Blueprint Section 32)
    const watermarkText =
      officialSignatures.officialWatermarkText ||
      'Powered by Biddyapith • Official Institutional Document';
    const watermarkHtml = `<div class="biddyapith-footer-watermark" style="margin-top: 2rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.72rem; color: #94a3b8; font-family: sans-serif; letter-spacing: 0.05em; text-transform: uppercase;">${watermarkText}</div>`;

    if (!rendered.includes('biddyapith-footer-watermark')) {
      rendered += `\n${watermarkHtml}`;
    }

    setPreviewHtml(rendered);
  };

  const insertVariable = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + textToInsert);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const updated = current.substring(0, start) + textToInsert + current.substring(end);
    setContent(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    try {
      setSaving(true);

      // If viewing a system template, duplicate it to customize
      if (isSystem && templateId) {
        const cloned = await duplicateTemplate(templateId, name);
        // Apply updated content, context, margins, page size to the newly cloned template
        const updated = await updateTemplate(cloned.id, {
          name,
          type,
          context,
          description,
          content,
          pageSize,
          orientation,
          margins,
          isDefault,
        });
        setTemplateId(updated.id);
        setIsSystem(false);
        setVersion(updated.version || 1);
      } else if (templateId) {
        const updated = await updateTemplate(templateId, {
          name,
          type,
          context,
          description,
          content,
          pageSize,
          orientation,
          margins,
          isDefault,
        });
        setVersion(updated.version || version + 1);
      } else {
        const created = await createTemplate({
          name,
          type,
          context,
          description,
          content,
          pageSize,
          orientation,
          margins,
          isDefault,
        });
        setTemplateId(created.id);
        setIsSystem(false);
        setVersion(1);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const pageCssSize =
      pageSize === 'ID_CARD'
        ? orientation === 'landscape'
          ? '85.6mm 54mm'
          : '54mm 85.6mm'
        : `${pageSize} ${orientation}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${name}</title>
          <style>
            @page {
              size: ${pageCssSize};
              margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .document-container {
              width: 100%;
              position: relative;
            }
          </style>
        </head>
        <body>
          <div class="document-container">
            ${previewHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Dimensions for live preview container
  const getCanvasDimensions = () => {
    if (pageSize === 'ID_CARD') {
      return orientation === 'landscape'
        ? { width: '85.6mm', minHeight: '54mm', scale: 1.2 }
        : { width: '54mm', minHeight: '85.6mm', scale: 1.2 };
    }
    if (pageSize === 'Letter') {
      return orientation === 'landscape'
        ? { width: '279.4mm', minHeight: '215.9mm', scale: 0.8 }
        : { width: '215.9mm', minHeight: '279.4mm', scale: 0.85 };
    }
    if (pageSize === 'Legal') {
      return orientation === 'landscape'
        ? { width: '355.6mm', minHeight: '215.9mm', scale: 0.7 }
        : { width: '215.9mm', minHeight: '355.6mm', scale: 0.8 };
    }
    // Default A4
    return orientation === 'landscape'
      ? { width: '297mm', minHeight: '210mm', scale: 0.78 }
      : { width: '210mm', minHeight: '297mm', scale: 0.88 };
  };

  const canvasDims = getCanvasDimensions();

  // Filtered variables in active category
  const filteredCategoryVars = (groupedVariables[activeCategory] || []).filter(
    (v) =>
      !tokenSearch ||
      v.key.toLowerCase().includes(tokenSearch.toLowerCase()) ||
      v.label.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', background: 'var(--bg)' }}>
      {/* System Template Readonly Warning Banner */}
      {isSystem && (
        <div
          style={{
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            color: '#1e40af',
            padding: '6px 1.5rem',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={16} />
            <span>
              <strong>System Template (Protected):</strong> Built-in system templates are read-only. Modifying and clicking "Save" will create a customized clone for your institution.
            </span>
          </div>
          <Badge tone="info">System Template</Badge>
        </div>
      )}

      {/* Top Action Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.5rem',
          background: 'var(--card-bg)',
          borderBottom: '1px solid var(--border)',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (onNavigate ? onNavigate('/templates') : window.history.back())}
            icon={<ArrowLeft size={16} />}
          >
            Back
          </Button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template Name..."
                style={{
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px dashed var(--border)',
                  padding: '2px 4px',
                  minWidth: '260px',
                  outline: 'none',
                }}
              />

              {/* Context Selector */}
              <select
                value={context}
                onChange={(e) => {
                  const newCtx = e.target.value;
                  setContext(newCtx);
                  const matched = TEMPLATE_CONTEXTS.find((c) => c.value === newCtx);
                  if (matched) setType(matched.defaultType);
                }}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                }}
              >
                {TEMPLATE_CONTEXTS.map((ctx) => (
                  <option key={ctx.value} value={ctx.value}>
                    Context: {ctx.label}
                  </option>
                ))}
              </select>

              <Badge tone="neutral">v{version}</Badge>
            </div>
            <p style={{ margin: '2px 0 0 4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Context determines available variables &bull; Immutable branding layer applied automatically
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPageSettings(!showPageSettings)}
            icon={<Settings size={15} />}
          >
            Page: {pageSize} ({orientation})
          </Button>

          <Button variant="secondary" size="sm" onClick={handlePrint} icon={<Printer size={15} />}>
            Print / PDF
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            icon={saving ? <span className="animate-spin">&bull;</span> : saveSuccess ? <Check size={15} /> : <Save size={15} />}
          >
            {saving ? 'Saving...' : saveSuccess ? 'Saved!' : isSystem ? 'Duplicate & Save' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* Page Setup Drawer */}
      {showPageSettings && (
        <div
          style={{
            background: 'var(--card-bg)',
            borderBottom: '1px solid var(--border)',
            padding: '0.75rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap',
            fontSize: '0.85rem',
          }}
        >
          <div>
            <label style={{ fontWeight: 600, marginRight: '6px' }}>Paper Size:</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as any)}
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="A4">A4 (210 x 297 mm)</option>
              <option value="Letter">Letter (8.5 x 11 in)</option>
              <option value="Legal">Legal (8.5 x 14 in)</option>
              <option value="ID_CARD">Standard ID Card (85.6 x 54 mm)</option>
            </select>
          </div>

          <div>
            <label style={{ fontWeight: 600, marginRight: '6px' }}>Orientation:</label>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as any)}
              style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 600 }}>Margins:</label>
            <input
              type="text"
              value={margins.top}
              onChange={(e) => setMargins({ ...margins, top: e.target.value })}
              placeholder="Top (e.g. 15mm)"
              style={{ width: '65px', padding: '3px 6px', fontSize: '0.8rem', border: '1px solid var(--border)' }}
            />
            <input
              type="text"
              value={margins.bottom}
              onChange={(e) => setMargins({ ...margins, bottom: e.target.value })}
              placeholder="Bottom"
              style={{ width: '65px', padding: '3px 6px', fontSize: '0.8rem', border: '1px solid var(--border)' }}
            />
            <input
              type="text"
              value={margins.left}
              onChange={(e) => setMargins({ ...margins, left: e.target.value })}
              placeholder="Left"
              style={{ width: '65px', padding: '3px 6px', fontSize: '0.8rem', border: '1px solid var(--border)' }}
            />
            <input
              type="text"
              value={margins.right}
              onChange={(e) => setMargins({ ...margins, right: e.target.value })}
              placeholder="Right"
              style={{ width: '65px', padding: '3px 6px', fontSize: '0.8rem', border: '1px solid var(--border)' }}
            />
          </div>

          <Button variant="ghost" size="sm" onClick={() => setShowPageSettings(false)}>
            Done
          </Button>
        </div>
      )}

      {/* Split Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT PANE: Editor & Variable Registry */}
        <div
          style={{
            flex: '0 0 50%',
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border)',
            background: 'var(--card-bg)',
            overflow: 'hidden',
          }}
        >
          {/* Quick Snippet Insert Bar */}
          <div
            style={{
              padding: '0.4rem 1rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Insert Logic:</span>
            <button
              type="button"
              onClick={() => insertVariable('{{#subjects}}\n  <tr>\n    <td>{{name}}</td>\n    <td>{{mark}}</td>\n  </tr>\n{{/subjects}}')}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              + Loop Block (&#123;&#123;#subjects&#125;&#125;)
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{{#if result.grade}}\n  <span>Grade: {{result.grade}}</span>\n{{/if}}')}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              + If Block (&#123;&#123;#if&#125;&#125;)
            </button>
            <button
              type="button"
              onClick={() => insertVariable('<div style="page-break-before: always;"></div>\n')}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              + Page Break
            </button>
          </div>

          {/* Variable Category Pills */}
          <div
            style={{
              padding: '0.5rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              overflowX: 'auto',
              background: 'var(--card-bg)',
            }}
          >
            {Object.keys(groupedVariables).map((catKey) => {
              const Icon = CATEGORY_ICONS[catKey] || Layers;
              const isSelected = activeCategory === catKey;
              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setActiveCategory(catKey)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '3px 8px',
                    borderRadius: '16px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--primary-subtle, #e0f2fe)' : 'var(--bg)',
                    color: isSelected ? 'var(--primary, #0284c7)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    textTransform: 'capitalize',
                  }}
                >
                  <Icon size={12} />
                  {catKey} ({groupedVariables[catKey]?.length || 0})
                </button>
              );
            })}
          </div>

          {/* Variable Search Bar */}
          <div
            style={{
              padding: '0.35rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--bg)',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              placeholder="Search variables in category..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.75rem',
                width: '100%',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Active Category Tokens Strip */}
          <div
            style={{
              padding: '0.5rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              maxHeight: '120px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.015)',
            }}
          >
            {filteredCategoryVars.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(`{{${v.key}}}`)}
                title={`${v.label} (${v.type}) - ${v.description}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '3px 7px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: 'var(--primary, #0284c7)', fontWeight: 700 }}>+</span>
                <span>{`{{${v.key}}}`}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({v.label})</span>
              </button>
            ))}
          </div>

          {/* HTML Code Editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 12px',
                background: 'var(--bg)',
                borderBottom: '1px solid var(--border)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileCode size={13} />
                <span>HTML & CSS Template Markup</span>
              </div>
              <span>Click any token above to insert at cursor</span>
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write or paste your HTML document template here..."
              style={{
                flex: 1,
                width: '100%',
                padding: '1rem',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.85rem',
                lineHeight: '1.5',
                border: 'none',
                outline: 'none',
                resize: 'none',
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                tabSize: 2,
              }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* RIGHT PANE: Scaled Live Canvas Preview */}
        <div
          style={{
            flex: '0 0 50%',
            display: 'flex',
            flexDirection: 'column',
            background: '#334155',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.5rem 1rem',
              background: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={15} />
              <span style={{ fontWeight: 600 }}>
                Live Canvas Preview &bull; {pageSize} ({orientation})
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Watermark injected at final rendering
            </span>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '2rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
            }}
          >
            {/* Canvas Page matching configured paper size & margins */}
            <div
              style={{
                width: canvasDims.width,
                minHeight: canvasDims.minHeight,
                background: '#ffffff',
                color: '#1e293b',
                boxShadow: '0 10px 35px rgba(0,0,0,0.4)',
                padding: `${margins.top} ${margins.right} ${margins.bottom} ${margins.left}`,
                position: 'relative',
                boxSizing: 'border-box',
                transformOrigin: 'top center',
                transform: `scale(${canvasDims.scale})`,
                transition: 'all 0.2s ease',
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentTemplateBuilder;
