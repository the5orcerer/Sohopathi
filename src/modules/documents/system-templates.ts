export interface SystemTemplateDefinition {
  id: string;
  name: string;
  type: string;
  context: string;
  description: string;
  pageSize: 'A4' | 'Letter' | 'Legal' | 'ID_CARD';
  orientation: 'portrait' | 'landscape';
  margins: { top: string; bottom: string; left: string; right: string };
  version: number;
  isSystem: boolean;
  isDefault: boolean;
  isArchived: boolean;
  content: string;
}

export const SYSTEM_TEMPLATES: SystemTemplateDefinition[] = [
  // 1. Student Marksheet
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Official Student Marksheet & Academic Transcript',
    type: 'marksheet',
    context: 'marksheet',
    description: 'Standard institutional academic transcript with subject marks, grade calculation, and authorized signatures.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
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
      <td style="padding: 6px 0;">{{guardian.name}}</td>
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
      </tr>
    </thead>
    <tbody>
      {{#subjects}}
      <tr>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1;">{{name}}</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center;">{{maxMarks}}</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">{{mark}}</td>
        <td style="padding: 9px 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a; font-weight: 700;">{{grade}}</td>
      </tr>
      {{/subjects}}
      <tr style="font-weight: 700; background: #e2e8f0;">
        <td style="padding: 10px; border: 1px solid #cbd5e1;">Cumulative Summary</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center;">{{result.maxTotal}}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #0284c7;">{{result.total}}</td>
        <td style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; color: #16a34a;">GPA: {{result.gpa}} ({{result.grade}})</td>
      </tr>
    </tbody>
  </table>

  <!-- Result Summary & Remarks -->
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; margin-bottom: 40px; font-size: 13px;">
    <p style="margin: 0; font-weight: 600;">Remarks: <span style="font-weight: 400; color: #334155;">{{result.remarks}}</span></p>
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

  // 2. Student ID Card
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Official Student ID Card (Pocket Card)',
    type: 'id_card',
    context: 'id_card',
    description: 'Compact student identification card with photo placeholder, roll, class, and emergency guardian contact.',
    pageSize: 'ID_CARD',
    orientation: 'landscape',
    margins: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="width: 85.6mm; height: 53.98mm; border: 2px solid #1e3a8a; border-radius: 8px; font-family: sans-serif; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
  <div style="background: #1e3a8a; color: #ffffff; padding: 6px 10px; text-align: center;">
    <h3 style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">{{institution.name}}</h3>
    <div style="font-size: 8px; opacity: 0.9;">STUDENT IDENTITY CARD &bull; {{academicYear}}</div>
  </div>
  <div style="display: flex; padding: 8px 10px; gap: 10px; align-items: center;">
    <div style="width: 60px; height: 75px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #64748b;">
      PHOTO
    </div>
    <div style="flex: 1; font-size: 9px; line-height: 1.4;">
      <div style="font-weight: 700; font-size: 11px; color: #0f172a; margin-bottom: 2px;">{{student.name}}</div>
      <div><strong>Roll:</strong> {{student.rollNo}} | <strong>Class:</strong> {{student.className}}</div>
      <div><strong>Sec:</strong> {{student.sectionName}} | <strong>ID:</strong> {{student.admissionNo}}</div>
      <div><strong>Blood:</strong> {{student.bloodGroup}}</div>
      <div><strong>Emergency:</strong> {{guardian.phone}}</div>
    </div>
  </div>
  <div style="position: absolute; bottom: 4px; left: 10px; right: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
    <span style="font-size: 7px; color: #94a3b8;">Issued: {{issueDate}}</span>
    <div style="text-align: center; border-top: 1px solid #000; width: 60px; font-size: 7px; font-weight: 600;">Authorized</div>
  </div>
</div>`,
  },

  // 3. Admission Form
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Institutional Admission Application Form',
    type: 'certificate',
    context: 'admission_form',
    description: 'Formal new student admission enrollment form with student, parent, address, and office verification sections.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: 'Times New Roman', Times, serif; color: #0f172a; padding: 15px; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">{{institution.name}}</h1>
    <p style="margin: 3px 0; font-size: 13px; font-family: sans-serif;">{{institution.address}}</p>
    <div style="display: inline-block; margin-top: 8px; padding: 4px 20px; border: 1px solid #0f172a; font-weight: bold; text-transform: uppercase;">
      Official Application For Admission (Session {{academicYear}})
    </div>
  </div>

  <table style="width: 100%; margin-bottom: 25px; border-collapse: collapse; font-size: 14px;">
    <tr>
      <td style="padding: 8px 4px; width: 25%;"><strong>Student Full Name:</strong></td>
      <td style="padding: 8px 4px; width: 75%; border-bottom: 1px dotted #000;">{{student.name}}</td>
    </tr>
    <tr>
      <td style="padding: 8px 4px;"><strong>Desired Class:</strong></td>
      <td style="padding: 8px 4px; border-bottom: 1px dotted #000;">{{student.className}}</td>
    </tr>
    <tr>
      <td style="padding: 8px 4px;"><strong>Date of Birth:</strong></td>
      <td style="padding: 8px 4px; border-bottom: 1px dotted #000;">{{student.dateOfBirth}} (Gender: {{student.gender}})</td>
    </tr>
    <tr>
      <td style="padding: 8px 4px;"><strong>Father / Guardian:</strong></td>
      <td style="padding: 8px 4px; border-bottom: 1px dotted #000;">{{guardian.name}} (Contact: {{guardian.phone}})</td>
    </tr>
    <tr>
      <td style="padding: 8px 4px;"><strong>Mother's Name:</strong></td>
      <td style="padding: 8px 4px; border-bottom: 1px dotted #000;">{{student.motherName}}</td>
    </tr>
    <tr>
      <td style="padding: 8px 4px;"><strong>Residential Address:</strong></td>
      <td style="padding: 8px 4px; border-bottom: 1px dotted #000;">{{student.address}}</td>
    </tr>
  </table>

  <div style="margin-top: 40px; font-size: 13px;">
    <p><strong>Declaration:</strong> I hereby certify that the particulars furnished above are true and accurate to the best of my knowledge.</p>
  </div>

  <div style="display: flex; justify-content: space-between; margin-top: 70px; padding: 0 20px;">
    <div style="text-align: center; border-top: 1px solid #000; width: 160px; font-size: 13px;">Signature of Guardian</div>
    <div style="text-align: center; border-top: 1px solid #000; width: 160px; font-size: 13px;">Admission Officer</div>
    <div style="text-align: center; border-top: 1px solid #000; width: 160px; font-size: 13px;">Head of Institution</div>
  </div>
</div>`,
  },

  // 4. Transfer Certificate (TC)
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Official Institutional Transfer Certificate (TC)',
    type: 'tc',
    context: 'tc',
    description: 'Legal school leaving and transfer certificate with clearance confirmation.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: 'Georgia', serif; color: #0f172a; padding: 25px; border: 3px double #1e3a8a; min-height: 250mm; box-sizing: border-box; position: relative;">
  <div style="text-align: center; margin-bottom: 25px;">
    <h1 style="margin: 0; font-size: 26px; color: #1e3a8a; text-transform: uppercase;">{{institution.name}}</h1>
    <p style="margin: 4px 0; font-size: 13px; font-family: sans-serif; color: #475569;">{{institution.address}}</p>
    <p style="margin: 2px 0; font-size: 12px; font-weight: bold; color: #0369a1;">Affiliation No: {{institution.affiliationNo}}</p>
    <div style="margin-top: 15px; display: inline-block; padding: 6px 24px; background: #e0f2fe; border: 1px solid #0284c7; font-weight: bold; font-size: 16px; text-transform: uppercase;">
      Transfer Certificate
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 13px;">
    <span><strong>Serial / TC No:</strong> {{certificateNo}}</span>
    <span><strong>Issue Date:</strong> {{issueDate}}</span>
  </div>

  <p style="font-size: 15px; line-height: 2.2; text-align: justify;">
    This is to certify that <strong>{{student.name}}</strong>, son/daughter of <strong>{{guardian.name}}</strong>, was a bonafide student of this institution in <strong>{{student.className}}</strong> (Roll No: <strong>{{student.rollNo}}</strong>, Admission No: <strong>{{student.admissionNo}}</strong>). He/She has cleared all institutional dues up to the current academic month. His/Her conduct and character during the period of stay in this institution were <strong>satisfactory</strong>. He/She is leaving the institution on account of parental transfer or relocation.
  </p>

  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 90px; padding: 0 10px;">
    <div style="text-align: center; width: 140px; border-top: 1px solid #000; font-size: 13px; padding-top: 4px;">Prepared By</div>
    <div style="text-align: center; width: 100px;">
      {{{officialSeal}}}
      <div style="font-size: 11px; color: #64748b;">Seal</div>
    </div>
    <div style="text-align: center; width: 180px;">
      {{{principalSignature}}}
      <div style="border-top: 1px solid #000; font-size: 13px; padding-top: 4px; font-weight: bold;">Head of Institution</div>
    </div>
  </div>
</div>`,
  },

  // 5. Character Certificate
  {
    id: '00000000-0000-0000-0000-000000000005',
    name: 'Student Character & Testimonial Certificate',
    type: 'certificate',
    context: 'certificate',
    description: 'Testimonial attesting to good conduct, moral integrity, and extracurricular achievements.',
    pageSize: 'A4',
    orientation: 'landscape',
    margins: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: 'Times New Roman', serif; padding: 35px; border: 4px double #1e3a8a; background: #fff; min-height: 170mm; box-sizing: border-box; text-align: center;">
  <h1 style="margin: 0; font-size: 28px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 1px;">{{institution.name}}</h1>
  <p style="margin: 5px 0 25px 0; font-size: 14px; color: #475569;">{{institution.address}}</p>
  <h2 style="font-size: 22px; text-transform: uppercase; text-decoration: underline; margin-bottom: 30px; letter-spacing: 2px;">Character Certificate & Testimonial</h2>

  <p style="font-size: 17px; line-height: 2.2; max-width: 800px; margin: 0 auto; text-align: justify;">
    This is to certify that <strong>{{student.name}}</strong>, son/daughter of <strong>{{guardian.name}}</strong>, bearing Admission ID <strong>{{student.admissionNo}}</strong>, was a student of Class <strong>{{student.className}}</strong> in this institution during the academic year <strong>{{academicYear}}</strong>. To the best of my knowledge and conviction, he/she bears an exemplary moral character and pleasant disposition. He/She took active interest in co-curricular activities and institutional programs. I wish him/her every success in all future scholastic pursuits.
  </p>

  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px; padding: 0 40px;">
    <div style="text-align: left; font-size: 14px;">
      <div>Date: {{issueDate}}</div>
      <div>Certificate No: {{certificateNo}}</div>
    </div>
    <div style="text-align: center; width: 120px;">
      {{{officialSeal}}}
    </div>
    <div style="text-align: center; width: 200px;">
      {{{principalSignature}}}
      <div style="border-top: 1px solid #000; padding-top: 4px; font-weight: bold; font-size: 14px;">Principal / Headmaster</div>
    </div>
  </div>
</div>`,
  },

  // 6. Employee ID Card
  {
    id: '00000000-0000-0000-0000-000000000006',
    name: 'Institutional Staff & Faculty ID Card',
    type: 'id_card',
    context: 'employee_id_card',
    description: 'Faculty and staff staff identification card with designation, department, and blood group.',
    pageSize: 'ID_CARD',
    orientation: 'landscape',
    margins: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="width: 85.6mm; height: 53.98mm; border: 2px solid #047857; border-radius: 8px; font-family: sans-serif; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
  <div style="background: #047857; color: #ffffff; padding: 6px 10px; text-align: center;">
    <h3 style="margin: 0; font-size: 11px; text-transform: uppercase;">{{institution.name}}</h3>
    <div style="font-size: 8px; opacity: 0.9;">FACULTY & STAFF IDENTITY CARD</div>
  </div>
  <div style="display: flex; padding: 8px 10px; gap: 10px; align-items: center;">
    <div style="width: 60px; height: 75px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #64748b;">
      PHOTO
    </div>
    <div style="flex: 1; font-size: 9px; line-height: 1.4;">
      <div style="font-weight: 700; font-size: 11px; color: #065f46; margin-bottom: 2px;">{{employee.name}}</div>
      <div><strong>Designation:</strong> {{employee.designation}}</div>
      <div><strong>Department:</strong> {{employee.department}}</div>
      <div><strong>ID No:</strong> {{employee.code}}</div>
      <div><strong>Joined:</strong> {{employee.joiningDate}}</div>
    </div>
  </div>
  <div style="position: absolute; bottom: 4px; left: 10px; right: 10px; display: flex; justify-content: space-between; align-items: flex-end;">
    <span style="font-size: 7px; color: #94a3b8;">Issued: {{issueDate}}</span>
    <div style="text-align: center; border-top: 1px solid #000; width: 60px; font-size: 7px; font-weight: 600;">Authorized</div>
  </div>
</div>`,
  },

  // 7. Appointment Letter
  {
    id: '00000000-0000-0000-0000-000000000007',
    name: 'Official Employee Appointment Letter',
    type: 'certificate',
    context: 'appointment_letter',
    description: 'Formal employment offer and appointment letter stating role, salary, and terms.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; padding: 20px; line-height: 1.6;">
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 25px;">
    <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">{{institution.name}}</h1>
    <p style="margin: 3px 0; font-size: 13px; color: #64748b;">{{institution.address}}</p>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px;">
    <div>Ref: APP-{{employee.code}}</div>
    <div>Date: {{issueDate}}</div>
  </div>

  <div style="margin-bottom: 20px; font-size: 14px;">
    <div>To: <strong>{{employee.name}}</strong></div>
    <div>Department of {{employee.department}}</div>
  </div>

  <h3 style="font-size: 15px; text-decoration: underline; margin-bottom: 15px;">Subject: Letter of Appointment for the position of {{employee.designation}}</h3>

  <p style="font-size: 14px; text-align: justify;">
    We are pleased to offer you an appointment as <strong>{{employee.designation}}</strong> at {{institution.name}} effective from <strong>{{employee.joiningDate}}</strong>. Your monthly consolidated remuneration will be <strong>{{employee.salary}}</strong> subject to institutional policies and statutory regulations.
  </p>
  <p style="font-size: 14px; text-align: justify;">
    You will be on probation for a period of six months from the date of joining. Upon successful completion of the probation period, your appointment may be confirmed in writing.
  </p>

  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 80px;">
    <div style="text-align: center; width: 160px; border-top: 1px solid #000; font-size: 13px; padding-top: 4px;">Candidate Acceptance</div>
    <div style="text-align: center; width: 180px;">
      {{{principalSignature}}}
      <div style="border-top: 1px solid #000; font-size: 13px; padding-top: 4px; font-weight: bold;">Head of Institution</div>
    </div>
  </div>
</div>`,
  },

  // 8. Salary Slip
  {
    id: '00000000-0000-0000-0000-000000000008',
    name: 'Monthly Employee Salary Slip / Payslip',
    type: 'certificate',
    context: 'salary_slip',
    description: 'Detailed monthly staff payroll slip with earnings, deductions, and net payable amount.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: sans-serif; color: #1e293b; padding: 15px;">
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; font-size: 22px; text-transform: uppercase;">{{institution.name}}</h2>
    <p style="margin: 3px 0; font-size: 12px; color: #64748b;">{{institution.address}}</p>
    <div style="font-weight: 700; font-size: 14px; margin-top: 6px;">SALARY PAYSLIP</div>
  </div>

  <table style="width: 100%; margin-bottom: 20px; font-size: 13px; border-collapse: collapse;">
    <tr>
      <td style="padding: 5px 0; width: 20%; font-weight: 600;">Employee Name:</td>
      <td style="padding: 5px 0; width: 30%;">{{employee.name}}</td>
      <td style="padding: 5px 0; width: 20%; font-weight: 600;">Employee ID:</td>
      <td style="padding: 5px 0; width: 30%;">{{employee.code}}</td>
    </tr>
    <tr>
      <td style="padding: 5px 0; font-weight: 600;">Designation:</td>
      <td style="padding: 5px 0;">{{employee.designation}}</td>
      <td style="padding: 5px 0; font-weight: 600;">Department:</td>
      <td style="padding: 5px 0;">{{employee.department}}</td>
    </tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
    <thead>
      <tr style="background: #f1f5f9; text-align: left;">
        <th style="padding: 8px 12px; border: 1px solid #cbd5e1;">Earnings Breakdown</th>
        <th style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">Basic Salary Remuneration</td>
        <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">{{employee.salary}}</td>
      </tr>
      <tr style="background: #f8fafc; font-weight: 700;">
        <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">Net Remuneration Disbursed</td>
        <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; color: #0284c7;">{{employee.salary}}</td>
      </tr>
    </tbody>
  </table>

  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px;">
    <div style="text-align: center; border-top: 1px solid #000; width: 140px; font-size: 12px;">Accounts Department</div>
    <div style="text-align: center; border-top: 1px solid #000; width: 140px; font-size: 12px;">Employee Signature</div>
  </div>
</div>`,
  },

  // 9. Invoice
  {
    id: '00000000-0000-0000-0000-000000000009',
    name: 'Official Student Tuition & Fee Invoice',
    type: 'certificate',
    context: 'invoice',
    description: 'Itemized fee invoice statement for student tuition, transport, and lab fees.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: sans-serif; color: #1e293b; padding: 15px;">
  <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px;">
    <div>
      <h2 style="margin: 0; font-size: 22px; color: #0f172a; text-transform: uppercase;">{{institution.name}}</h2>
      <p style="margin: 3px 0; font-size: 12px; color: #64748b;">{{institution.address}}</p>
    </div>
    <div style="text-align: right;">
      <h3 style="margin: 0; font-size: 20px; color: #0284c7;">INVOICE</h3>
      <div style="font-size: 12px; color: #475569;"># {{invoice.number}}</div>
      <div style="font-size: 12px; color: #475569;">Due Date: {{invoice.dueDate}}</div>
    </div>
  </div>

  <div style="margin-bottom: 20px; font-size: 13px;">
    <div><strong>Billed To:</strong></div>
    <div style="font-size: 15px; font-weight: 700; color: #0f172a;">{{student.name}} ({{student.admissionNo}})</div>
    <div>Class: {{student.className}} - {{student.sectionName}}</div>
    <div>Guardian: {{guardian.name}} ({{guardian.phone}})</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
    <thead>
      <tr style="background: #0f172a; color: #fff;">
        <th style="padding: 8px 12px; text-align: left;">Item Description</th>
        <th style="padding: 8px 12px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">Tuition / Academic Session Dues</td>
        <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">{{invoice.amount}}</td>
      </tr>
      <tr style="background: #f8fafc; font-weight: 700;">
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1;">Total Payable</td>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: right; color: #0284c7; font-size: 15px;">{{invoice.amount}}</td>
      </tr>
    </tbody>
  </table>
</div>`,
  },

  // 10. Payment Receipt
  {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Official Fee Payment Receipt (Money Receipt)',
    type: 'certificate',
    context: 'receipt',
    description: 'Instant official transaction money receipt acknowledging completed tuition payments.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: sans-serif; color: #1e293b; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
  <div style="text-align: center; border-bottom: 2px solid #047857; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; font-size: 22px; color: #047857; text-transform: uppercase;">{{institution.name}}</h2>
    <p style="margin: 3px 0; font-size: 12px; color: #64748b;">{{institution.address}}</p>
    <div style="display: inline-block; margin-top: 6px; padding: 2px 14px; background: #d1fae5; color: #065f46; border-radius: 12px; font-weight: 700; font-size: 12px;">
      MONEY RECEIPT &bull; PAID
    </div>
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px;">
    <div>Receipt No: <strong>{{receipt.number}}</strong></div>
    <div>Payment Date: <strong>{{receipt.date}}</strong></div>
  </div>

  <p style="font-size: 14px; line-height: 1.8;">
    Received with thanks from <strong>{{student.name}}</strong> (Roll: {{student.rollNo}}, Class: {{student.className}}), a sum of <strong>{{receipt.amount}}</strong> via {{receipt.method}} on account of institutional dues.
  </p>

  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px;">
    <div style="font-size: 11px; color: #94a3b8;">This is a system generated money receipt.</div>
    <div style="text-align: center; width: 140px; border-top: 1px solid #000; font-size: 12px; padding-top: 4px;">Cashier / Officer</div>
  </div>
</div>`,
  },

  // 11. Fee Statement
  {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Annual Student Fee Statement & Dues Summary',
    type: 'certificate',
    context: 'fee_statement',
    description: 'Comprehensive financial statement showing billed invoices, credits, and outstanding dues balance.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: sans-serif; color: #1e293b; padding: 15px;">
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; font-size: 22px; text-transform: uppercase;">{{institution.name}}</h2>
    <p style="margin: 3px 0; font-size: 12px; color: #64748b;">{{institution.address}}</p>
    <div style="font-weight: 700; font-size: 14px; margin-top: 6px;">STATEMENT OF ACCOUNT ({{academicYear}})</div>
  </div>

  <div style="margin-bottom: 20px; font-size: 13px;">
    <div><strong>Student:</strong> {{student.name}} (ID: {{student.admissionNo}})</div>
    <div><strong>Class:</strong> {{student.className}} - {{student.sectionName}}</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px;">
    <thead>
      <tr style="background: #f1f5f9; text-align: left;">
        <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Particulars</th>
        <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">Billed</th>
        <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">Paid</th>
        <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">Tuition & Term Dues</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">{{invoice.amount}}</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; color: #16a34a;">{{receipt.amount}}</td>
        <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">৳ 0.00</td>
      </tr>
    </tbody>
  </table>
</div>`,
  },

  // 12. Exam Attendance Sheet
  {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Examination Hall Attendance Register Sheet',
    type: 'admit_card',
    context: 'exam_attendance',
    description: 'Printable roll call register for exam invigilators to record student presence and signature.',
    pageSize: 'A4',
    orientation: 'landscape',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: sans-serif; color: #1e293b; padding: 10px;">
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 15px;">
    <h2 style="margin: 0; font-size: 20px; text-transform: uppercase;">{{institution.name}}</h2>
    <div style="font-weight: 700; font-size: 13px; margin-top: 4px;">EXAMINATION ATTENDANCE SHEET &bull; {{exam.name}}</div>
    <div style="font-size: 12px; color: #475569;">Class: {{class.name}} | Room: {{exam.room}} | Date: {{exam.date}}</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
    <thead>
      <tr style="background: #0f172a; color: #fff;">
        <th style="padding: 6px; border: 1px solid #0f172a; width: 8%;">Roll</th>
        <th style="padding: 6px; border: 1px solid #0f172a; width: 15%;">Admission ID</th>
        <th style="padding: 6px; border: 1px solid #0f172a; width: 32%;">Candidate Name</th>
        <th style="padding: 6px; border: 1px solid #0f172a; width: 25%;">Candidate Signature</th>
        <th style="padding: 6px; border: 1px solid #0f172a; width: 20%;">Invigilator Initials</th>
      </tr>
    </thead>
    <tbody>
      {{#students}}
      <tr>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">{{rollNo}}</td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1; text-align: center;">{{admissionNo}}</td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1;">{{name}}</td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1;"></td>
        <td style="padding: 8px 6px; border: 1px solid #cbd5e1;"></td>
      </tr>
      {{/students}}
    </tbody>
  </table>
</div>`,
  },

  // 13. Exam Room List
  {
    id: '00000000-0000-0000-0000-000000000013',
    name: 'Examination Room Seating Allocation List',
    type: 'admit_card',
    context: 'exam_room_list',
    description: 'Hall door notice listing allocated candidates, roll ranges, and invigilator details.',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: sans-serif; color: #1e293b; padding: 15px;">
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; font-size: 22px; text-transform: uppercase;">{{institution.name}}</h2>
    <div style="font-weight: 700; font-size: 15px; margin-top: 6px; color: #0284c7;">EXAM HALL SEATING PLAN</div>
    <div style="font-size: 13px; margin-top: 2px;">{{exam.name}} &bull; Room: {{exam.room}}</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 30px;">
    <thead>
      <tr style="background: #0f172a; color: #fff;">
        <th style="padding: 8px; border: 1px solid #0f172a; width: 15%;">Seat No</th>
        <th style="padding: 8px; border: 1px solid #0f172a; width: 15%;">Roll No</th>
        <th style="padding: 8px; border: 1px solid #0f172a; width: 45%;">Candidate Name</th>
        <th style="padding: 8px; border: 1px solid #0f172a; width: 25%;">Class / Section</th>
      </tr>
    </thead>
    <tbody>
      {{#students}}
      <tr>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">{{seatNo}}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">{{rollNo}}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">{{name}}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1;">{{className}} - {{sectionName}}</td>
      </tr>
      {{/students}}
    </tbody>
  </table>
</div>`,
  },

  // 14. Result Summary
  {
    id: '00000000-0000-0000-0000-000000000014',
    name: 'Class Academic Result & Performance Summary',
    type: 'marksheet',
    context: 'result_summary',
    description: 'Comprehensive tabulation sheet and merit list showing class performance and grade statistics.',
    pageSize: 'A4',
    orientation: 'landscape',
    margins: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
    version: 1,
    isSystem: true,
    isDefault: true,
    isArchived: false,
    content: `<div style="font-family: sans-serif; color: #1e293b; padding: 10px;">
  <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 15px;">
    <h2 style="margin: 0; font-size: 20px; text-transform: uppercase;">{{institution.name}}</h2>
    <div style="font-weight: 700; font-size: 14px; margin-top: 4px;">RESULT TABULATION SUMMARY &bull; {{exam.name}}</div>
    <div style="font-size: 12px; color: #475569;">Class: {{class.name}} | Academic Session: {{academicYear}}</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 25px;">
    <thead>
      <tr style="background: #0f172a; color: #fff;">
        <th style="padding: 6px; border: 1px solid #0f172a;">Rank</th>
        <th style="padding: 6px; border: 1px solid #0f172a;">Roll</th>
        <th style="padding: 6px; border: 1px solid #0f172a;">Student Name</th>
        <th style="padding: 6px; border: 1px solid #0f172a; text-align: center;">Total Score</th>
        <th style="padding: 6px; border: 1px solid #0f172a; text-align: center;">GPA</th>
        <th style="padding: 6px; border: 1px solid #0f172a; text-align: center;">Grade</th>
        <th style="padding: 6px; border: 1px solid #0f172a; text-align: center;">Status</th>
      </tr>
    </thead>
    <tbody>
      {{#results}}
      <tr>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700;">{{position}}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">{{rollNo}}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1;">{{name}}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 600;">{{totalMarks}}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">{{gpa}}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center; font-weight: 700; color: #16a34a;">{{grade}}</td>
        <td style="padding: 6px; border: 1px solid #cbd5e1; text-align: center;">{{status}}</td>
      </tr>
      {{/results}}
    </tbody>
  </table>
</div>`,
  },
];

