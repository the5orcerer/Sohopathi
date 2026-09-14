import React, { useState, useEffect, useRef } from 'react';
import {
  createTemplate,
  updateTemplate,
  fetchInstitutionSettings,
} from '../services/api';
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
} from 'lucide-react';
import { Button } from '../components/common';
import { useSession } from '../context/SessionContext';

interface DocumentTemplateBuilderProps {
  initialTemplateId?: string;
  onNavigate?: (path: string) => void;
}

const VARIABLE_CATEGORIES = [
  {
    name: 'Student Info',
    icon: BookOpen,
    variables: [
      { key: '{{student.name}}', desc: 'Full Name' },
      { key: '{{student.admissionNo}}', desc: 'Admission ID' },
      { key: '{{student.rollNo}}', desc: 'Roll Number' },
      { key: '{{student.className}}', desc: 'Class Name' },
      { key: '{{student.sectionName}}', desc: 'Section Name' },
      { key: '{{student.dateOfBirth}}', desc: 'Date of Birth' },
      { key: '{{student.fatherName}}', desc: 'Father / Guardian Name' },
      { key: '{{student.motherName}}', desc: 'Mother Name' },
    ],
  },
  {
    name: 'Examinations & Marks',
    icon: Award,
    variables: [
      { key: '{{exam.name}}', desc: 'Examination Name' },
      { key: '{{exam.term}}', desc: 'Academic Term' },
      { key: '{{exam.date}}', desc: 'Exam Schedule Date' },
      { key: '{{marks.obtained}}', desc: 'Marks Obtained' },
      { key: '{{marks.max}}', desc: 'Maximum Total Marks' },
      { key: '{{marks.grade}}', desc: 'Letter Grade (e.g. A+)' },
      { key: '{{marks.percentage}}', desc: 'Calculated Percentage %' },
      { key: '{{marks.gpa}}', desc: 'GPA Point' },
      { key: '{{marks.remarks}}', desc: 'Evaluator Remarks' },
    ],
  },
  {
    name: 'Official Assets & Signatures',
    icon: Building2,
    variables: [
      { key: '{{institution.name}}', desc: 'Institute Legal Name' },
      { key: '{{institution.address}}', desc: 'Institute Campus Address' },
      { key: '{{institution.affiliationNo}}', desc: 'Affiliation / Code No.' },
      { key: '{{principalSignature}}', desc: 'Principal Official Signature (Img)' },
      { key: '{{officialSeal}}', desc: 'Official Institutional Seal (Img)' },
      { key: '{{examControllerSignature}}', desc: 'Exam Controller Signature (Img)' },
    ],
  },
  {
    name: 'Date & System',
    icon: Calendar,
    variables: [
      { key: '{{issueDate}}', desc: 'Document Issue Date' },
      { key: '{{academicYear}}', desc: 'Current Academic Session' },
      { key: '{{certificateNo}}', desc: 'Auto Unique Certificate Serial' },
    ],
  },
];

const STARTER_TEMPLATES: Record<string, { name: string; type: string; description: string; content: string }> = {
  marksheet: {
    name: 'Official Student Marksheet & Academic Transcript',
    type: 'marksheet',
    description: 'Standard term & examination marksheet with grades, GPA, and authorized signatures.',
    content: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 10px;">
  <!-- Institute Header -->
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 1px; color: #0f172a;">{{institution.name}}</h1>
    <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">{{institution.address}}</p>
    <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #3b82f6;">Affiliation / Board Code: {{institution.affiliationNo}}</p>
    <div style="display: inline-block; margin-top: 12px; padding: 4px 18px; background: #f1f5f9; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
      Academic Transcript &bull; {{exam.name}} ({{academicYear}})
    </div>
  </div>

  <!-- Student Meta Grid -->
  <table style="width: 100%; margin-bottom: 20px; font-size: 13px; border-collapse: collapse;">
    <tr>
      <td style="padding: 6px 0; width: 20%; font-weight: 600; color: #475569;">Student Name:</td>
      <td style="padding: 6px 0; width: 30%; font-weight: 700; color: #0f172a;">{{student.name}}</td>
      <td style="padding: 6px 0; width: 20%; font-weight: 600; color: #475569;">Admission No:</td>
      <td style="padding: 6px 0; width: 30%; font-weight: 700; color: #0f172a;">{{student.admissionNo}}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: 600; color: #475569;">Class & Section:</td>
      <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">{{student.className}} - {{student.sectionName}}</td>
      <td style="padding: 6px 0; font-weight: 600; color: #475569;">Roll Number:</td>
      <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">{{student.rollNo}}</td>
    </tr>
    <tr>
      <td style="padding: 6px 0; font-weight: 600; color: #475569;">Guardian Name:</td>
      <td style="padding: 6px 0;">{{student.fatherName}}</td>
      <td style="padding: 6px 0; font-weight: 600; color: #475569;">Date of Issue:</td>
      <td style="padding: 6px 0;">{{issueDate}}</td>
    </tr>
  </table>

  <!-- Performance Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
    <thead>
      <tr style="background: #0f172a; color: #ffffff; text-align: left;">
        <th style="padding: 10px; border: 1px solid #0f172a;">Subject / Paper</th>
        <th style="padding: 10px; border: 1px solid #0f172a; text-align: center;">Max Marks</th>
        <th style="padding: 10px; border: 1px solid #0f172a; text-align: center;">Marks Obtained</th>
        <th style="padding: 10px; border: 1px solid #0f172a; text-align: center;">Grade</th>
        <th style="padding: 10px; border: 1px solid #0f172a; text-align: center;">Grade Point</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1;">Bangla</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">88</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: 700;">A+</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">5.00</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1;">English</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">84</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: 700;">A+</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">5.00</td>
      </tr>
      <tr>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1;">Mathematics</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">95</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: 700;">A+</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">5.00</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1;">General Science</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">100</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">82</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: 700;">A+</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">5.00</td>
      </tr>
      <tr style="font-weight: 700; background: #e2e8f0;">
        <td style="padding: 10px; border: 1px solid #cbd5e1;">Cumulative Summary</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">{{marks.max}}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #0284c7;">{{marks.obtained}}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a;">{{marks.grade}}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">GPA: {{marks.gpa}}</td>
      </tr>
    </tbody>
  </table>

  <!-- Result Summary & Remarks -->
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 40px; font-size: 13px;">
    <p style="margin: 0; font-weight: 600;">Remarks: <span style="font-weight: 400; color: #334155;">{{marks.remarks}}</span></p>
  </div>

  <!-- Signatures Grid -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; padding: 0 10px;">
    <div style="text-align: center; width: 180px;">
      <div style="height: 55px; display: flex; align-items: center; justify-content: center;">
        {{{examControllerSignature}}}
      </div>
      <div style="border-top: 1px solid #64748b; padding-top: 6px; font-size: 12px; font-weight: 600;">
        Exam Controller
      </div>
    </div>

    <div style="text-align: center; width: 120px;">
      <div style="height: 65px; display: flex; align-items: center; justify-content: center;">
        {{{officialSeal}}}
      </div>
      <div style="font-size: 11px; color: #64748b; font-weight: 600;">Official Seal</div>
    </div>

    <div style="text-align: center; width: 180px;">
      <div style="height: 55px; display: flex; align-items: center; justify-content: center;">
        {{{principalSignature}}}
      </div>
      <div style="border-top: 1px solid #64748b; padding-top: 6px; font-size: 12px; font-weight: 600;">
        Head of Institution
      </div>
    </div>
  </div>
</div>`,
  },
  admit_card: {
    name: 'Examination Admit Card & Hall Ticket',
    type: 'admit_card',
    description: 'Student hall ticket with room assignment, roll number, and exam rules.',
    content: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 10px; border: 2px dashed #0284c7; border-radius: 8px;">
  <!-- Header -->
  <div style="text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 15px;">
    <h2 style="margin: 0; font-size: 22px; text-transform: uppercase; color: #0284c7;">{{institution.name}}</h2>
    <p style="margin: 3px 0 0 0; font-size: 12px; color: #64748b;">{{institution.address}}</p>
    <div style="display: inline-block; margin-top: 8px; padding: 3px 14px; background: #e0f2fe; color: #0369a1; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
      EXAM ADMIT CARD &bull; {{exam.name}}
    </div>
  </div>

  <!-- Student Info Card -->
  <table style="width: 100%; margin-bottom: 18px; font-size: 13px; border-collapse: collapse;">
    <tr>
      <td style="padding: 5px 0; font-weight: 600; color: #475569; width: 22%;">Candidate Name:</td>
      <td style="padding: 5px 0; font-weight: 700; width: 28%;">{{student.name}}</td>
      <td style="padding: 5px 0; font-weight: 600; color: #475569; width: 22%;">Roll Number:</td>
      <td style="padding: 5px 0; font-weight: 700; width: 28%; font-size: 16px; color: #0284c7;">{{student.rollNo}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 0; font-weight: 600; color: #475569;">Class & Section:</td>
      <td style="padding: 5px 0; font-weight: 700;">{{student.className}} - {{student.sectionName}}</td>
      <td style="padding: 5px 0; font-weight: 600; color: #475569;">Admission No:</td>
      <td style="padding: 5px 0; font-weight: 600;">{{student.admissionNo}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 0; font-weight: 600; color: #475569;">Exam Schedule:</td>
      <td style="padding: 5px 0;">{{exam.date}}</td>
      <td style="padding: 5px 0; font-weight: 600; color: #475569;">Academic Session:</td>
      <td style="padding: 5px 0;">{{academicYear}}</td>
    </tr>
  </table>

  <!-- Examination Instructions -->
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 25px; font-size: 12px;">
    <h4 style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #334155;">Candidate Instructions:</h4>
    <ol style="margin: 0; padding-left: 18px; color: #475569; line-height: 1.6;">
      <li>Candidate must bring this physical Admit Card and institutional ID to every examination.</li>
      <li>Electronic devices, smartphones, and programmable calculators are strictly prohibited.</li>
      <li>Students must be seated in their designated examination hall 15 minutes before the exam starts.</li>
    </ol>
  </div>

  <!-- Signatures -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding: 0 10px;">
    <div style="text-align: center; width: 140px;">
      <div style="border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 11px; font-weight: 600;">
        Student Signature
      </div>
    </div>
    <div style="text-align: center; width: 120px;">
      <div style="height: 50px; display: flex; align-items: center; justify-content: center;">
        {{{officialSeal}}}
      </div>
      <div style="font-size: 10px; color: #64748b; font-weight: 600;">Institution Seal</div>
    </div>
    <div style="text-align: center; width: 160px;">
      <div style="height: 45px; display: flex; align-items: center; justify-content: center;">
        {{{principalSignature}}}
      </div>
      <div style="border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 11px; font-weight: 600;">
        Principal / Controller
      </div>
    </div>
  </div>
</div>`,
  },
  tc: {
    name: 'Student Transfer Certificate (TC)',
    type: 'tc',
    description: 'Official academic departure and transfer certification document.',
    content: `<div style="font-family: 'Times New Roman', Times, serif; color: #1e293b; line-height: 1.6; padding: 15px;">
  <!-- Header -->
  <div style="text-align: center; border-bottom: 2px double #0f172a; padding-bottom: 14px; margin-bottom: 25px;">
    <h2 style="margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">{{institution.name}}</h2>
    <p style="margin: 4px 0 0 0; font-size: 13px;">{{institution.address}} &bull; Affiliation No: {{institution.affiliationNo}}</p>
    <h3 style="margin: 14px 0 0 0; font-size: 18px; text-decoration: underline; letter-spacing: 0.5px;">TRANSFER CERTIFICATE</h3>
    <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 10px;">
      <span><strong>Certificate No:</strong> {{certificateNo}}</span>
      <span><strong>Date:</strong> {{issueDate}}</span>
    </div>
  </div>

  <!-- Certificate Body Paragraphs -->
  <div style="font-size: 14px; text-align: justify; line-height: 1.8;">
    <p>This is to certify that <strong>{{student.name}}</strong>, Son/Daughter of <strong>{{student.fatherName}}</strong> and <strong>{{student.motherName}}</strong>, was a bona fide student of this institution holding Admission Number <strong>{{student.admissionNo}}</strong>.</p>
    
    <p>According to school records, the student was enrolled in <strong>{{student.className}} ({{student.sectionName}})</strong> with Roll Number <strong>{{student.rollNo}}</strong> during the academic session <strong>{{academicYear}}</strong>.</p>

    <p>All institutional dues, library books, and examination obligations have been fully satisfied. The student bears an exemplary moral character and active academic record during the tenure at this institution.</p>
  </div>

  <!-- Footer Signatures -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 70px; padding: 0 10px;">
    <div style="text-align: center; width: 160px;">
      <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 13px; font-weight: bold;">
        Prepared by
      </div>
    </div>
    <div style="text-align: center; width: 120px;">
      <div style="height: 60px; display: flex; align-items: center; justify-content: center;">
        {{{officialSeal}}}
      </div>
      <div style="font-size: 11px; font-weight: bold;">Official Seal</div>
    </div>
    <div style="text-align: center; width: 180px;">
      <div style="height: 50px; display: flex; align-items: center; justify-content: center;">
        {{{principalSignature}}}
      </div>
      <div style="border-top: 1px solid #000; padding-top: 6px; font-size: 13px; font-weight: bold;">
        Principal / Headmaster
      </div>
    </div>
  </div>
</div>`,
  },
};

export const DocumentTemplateBuilder: React.FC<DocumentTemplateBuilderProps> = ({
  initialTemplateId,
  onNavigate,
}) => {
  const { institutionName } = useSession();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState('Official Student Marksheet');
  const [type, setType] = useState('marksheet');
  const [description, setDescription] = useState('Official term marksheet template');
  const [content, setContent] = useState(STARTER_TEMPLATES.marksheet.content);
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId || null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [activeCategory, setActiveCategory] = useState(VARIABLE_CATEGORIES[0].name);

  // Settings for signatures / official seal
  const [officialSignatures, setOfficialSignatures] = useState<any>({});

  useEffect(() => {
    fetchInstitutionSettings()
      .then((data) => {
        setOfficialSignatures(data || {});
      })
      .catch(() => {});
  }, []);

  // Update live preview whenever content or templateId changes
  useEffect(() => {
    generatePreview(content);
  }, [content, officialSignatures]);

  const generatePreview = (rawContent: string) => {
    // Inject mock preview variables
    let rendered = rawContent
      .replace(/\{\{student\.name\}\}/g, 'Tahmid Rahman')
      .replace(/\{\{student\.admissionNo\}\}/g, 'ADM-2026-0841')
      .replace(/\{\{student\.rollNo\}\}/g, '12')
      .replace(/\{\{student\.className\}\}/g, 'Class 10')
      .replace(/\{\{student\.sectionName\}\}/g, 'Section B')
      .replace(/\{\{student\.dateOfBirth\}\}/g, '14 May 2010')
      .replace(/\{\{student\.fatherName\}\}/g, 'Mr. Anisur Rahman')
      .replace(/\{\{student\.motherName\}\}/g, 'Mrs. Shamima Rahman')
      .replace(/\{\{exam\.name\}\}/g, 'Annual Final Examination 2026')
      .replace(/\{\{exam\.term\}\}/g, 'Final Term')
      .replace(/\{\{exam\.date\}\}/g, 'October 15, 2026')
      .replace(/\{\{marks\.obtained\}\}/g, '349')
      .replace(/\{\{marks\.max\}\}/g, '400')
      .replace(/\{\{marks\.grade\}\}/g, 'A+')
      .replace(/\{\{marks\.percentage\}\}/g, '87.25%')
      .replace(/\{\{marks\.gpa\}\}/g, '5.00')
      .replace(/\{\{marks\.remarks\}\}/g, 'Exemplary scholastic diligence and analytical excellence.')
      .replace(/\{\{institution\.name\}\}/g, institutionName || 'Dhaka Model International Academy')
      .replace(/\{\{institution\.address\}\}/g, 'House 42, Road 11, Dhanmondi, Dhaka 1209')
      .replace(/\{\{institution\.affiliationNo\}\}/g, officialSignatures.institutionAffiliationNo || 'AFF-8942-BD')
      .replace(/\{\{issueDate\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))
      .replace(/\{\{academicYear\}\}/g, '2026-2027')
      .replace(/\{\{certificateNo\}\}/g, 'CERT-2026-0924');

    // Signatures
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
      .replace(/\{\{\{principalSignature\}\}\}/g, sigImg)
      .replace(/\{\{principalSignature\}\}/g, sigImg)
      .replace(/\{\{\{officialSeal\}\}\}/g, sealImg)
      .replace(/\{\{officialSeal\}\}/g, sealImg)
      .replace(/\{\{\{examControllerSignature\}\}\}/g, controllerImg)
      .replace(/\{\{examControllerSignature\}\}/g, controllerImg);

    // Enforce mandatory non-removable Biddyapith watermark
    const watermark = `<div class="biddyapith-footer-watermark" style="position: absolute; bottom: 8mm; left: 0; right: 0; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; font-family: sans-serif; letter-spacing: 0.5px;">Powered by Sohopathi &bull; Verified Academic Document</div>`;

    if (!rendered.includes('biddyapith-footer-watermark')) {
      rendered += `\n${watermark}`;
    }

    setPreviewHtml(rendered);
  };

  const insertVariable = (varKey: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + varKey);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const updated = current.substring(0, start) + varKey + current.substring(end);
    setContent(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varKey.length, start + varKey.length);
    }, 50);
  };

  const handleLoadStarter = (starterKey: string) => {
    const starter = STARTER_TEMPLATES[starterKey];
    if (!starter) return;
    if (confirm(`Load starter template for "${starter.name}"? This will overwrite the current editor content.`)) {
      setName(starter.name);
      setType(starter.type);
      setDescription(starter.description);
      setContent(starter.content);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }
    try {
      setSaving(true);
      if (templateId) {
        await updateTemplate(templateId, { name, type, description, content });
      } else {
        const created = await createTemplate({ name, type, description, content });
        setTemplateId(created.id);
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
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${name}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              margin: 0;
              padding: 0;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .a4-container {
              width: 100%;
              position: relative;
              min-height: 260mm;
            }
          </style>
        </head>
        <body>
          <div class="a4-container">
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', background: 'var(--bg)' }}>
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
                  minWidth: '280px',
                  outline: 'none',
                }}
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="marksheet">Marksheet & Transcript</option>
                <option value="admit_card">Exam Admit Card</option>
                <option value="tc">Transfer Certificate (TC)</option>
                <option value="id_card">Student ID Card</option>
                <option value="receipt">Fee Receipt</option>
                <option value="custom">Custom Document</option>
              </select>
            </div>
            <p style={{ margin: '2px 0 0 4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Full-Page Split Screen Document Template Builder with Live A4 Preview
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Starter Template Preset Dropdown */}
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleLoadStarter(e.target.value);
                e.target.value = '';
              }
            }}
            defaultValue=""
            style={{
              fontSize: '0.85rem',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="" disabled>
              Load Starter Template...
            </option>
            <option value="marksheet">Academic Marksheet & Transcript</option>
            <option value="admit_card">Exam Admit Card / Hall Ticket</option>
            <option value="tc">Transfer Certificate (TC)</option>
          </select>

          <Button variant="secondary" size="sm" onClick={handlePrint} icon={<Printer size={15} />}>
            Print / Export PDF
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            icon={saving ? <span className="animate-spin">&bull;</span> : <Save size={15} />}
          >
            {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* Split Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* LEFT PANE: Editor & Variable Chips */}
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
          {/* Variable Category Pills */}
          <div
            style={{
              padding: '0.65rem 1rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              overflowX: 'auto',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Tokens:
            </span>
            {VARIABLE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = activeCategory === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setActiveCategory(cat.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--primary-subtle)' : 'var(--card-bg)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Icon size={13} />
                  {cat.name}
                </button>
              );
            })}
          </div>

          {/* Active Chips Strip */}
          <div
            style={{
              padding: '0.6rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
              maxHeight: '110px',
              overflowY: 'auto',
              background: 'rgba(0,0,0,0.02)',
            }}
          >
            {VARIABLE_CATEGORIES.find((c) => c.name === activeCategory)?.variables.map((v) => (
              <button
                key={v.key}
                onClick={() => insertVariable(v.key)}
                title={`Click to insert: ${v.desc}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>+</span>
                <span>{v.key}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({v.desc})</span>
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
                <span>HTML & CSS Template Code</span>
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

        {/* RIGHT PANE: Live A4 Document Preview */}
        <div
          style={{
            flex: '0 0 50%',
            display: 'flex',
            flexDirection: 'column',
            background: '#475569',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.5rem 1rem',
              background: '#334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={15} />
              <span style={{ fontWeight: 600 }}>Live A4 Preview (Standard Document Dimensions)</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Official Signatures & Watermark injected automatically
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
            {/* A4 Canvas Page */}
            <div
              style={{
                width: '210mm',
                minHeight: '297mm',
                background: '#ffffff',
                color: '#1e293b',
                boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                padding: '20mm 15mm 25mm 15mm',
                position: 'relative',
                boxSizing: 'border-box',
                transformOrigin: 'top center',
                transform: 'scale(0.88)',
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
