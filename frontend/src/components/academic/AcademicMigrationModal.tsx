import React, { useState } from 'react';
import { Modal, Button } from '../common';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { unifiedAcademicMigration, createSubject } from '../../services/api';
import type { AcademicMigrationSummary } from '../../types';

interface AcademicMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AcademicMigrationModal: React.FC<AcademicMigrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'spreadsheet'>('preset');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AcademicMigrationSummary | null>(null);

  // Preset Template State
  const [presetYear, setPresetYear] = useState<string>(`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);
  const [presetMinClass, setPresetMinClass] = useState<number>(1);
  const [presetMaxClass, setPresetMaxClass] = useState<number>(10);
  const [presetSections, setPresetSections] = useState<string>('A, B');

  // Spreadsheet Importer State
  const [csvText, setCsvText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);

  const sampleCsvData = `AcademicYear,Class,Section,RollNo,StudentName,AdmissionNo,GuardianName,GuardianPhone
2026-2027,Class 6,Section A,01,Tahmid Rahman,ADM-6001,Rahman Kabir,+8801711223344
2026-2027,Class 6,Section A,02,Nusrat Jahan,ADM-6002,Farhana Begum,+8801811223344
2026-2027,Class 6,Section B,01,Ayman Sadiq,ADM-6003,Sadiqul Islam,+8801911223344
2026-2027,Class 7,Section A,01,Samiul Alom,ADM-7001,Alomgir Hossain,+8801722334455
2026-2027,Class 7,Section A,02,Ayesha Siddika,ADM-7002,Siddiqur Rahman,+8801822334455
2026-2027,Class 8,Section A,01,Zubair Ahmed,ADM-8001,Ahmed Ali,+8801922334455`;

  const handleParseCsv = (text: string) => {
    setCsvText(text);
    setError(null);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    try {
      const lines = text.trim().split(/\r?\n/);
      if (lines.length <= 1) {
        setParsedRows([]);
        return;
      }

      // Check header or delimiter (tab or comma)
      const delimiter = lines[0].includes('\t') ? '\t' : ',';
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map((p) => p.trim().replace(/^"|"$/g, ''));
        if (parts.length >= 2 && parts.some((p) => p.length > 0)) {
          rows.push({
            academicYear: parts[0] || presetYear,
            className: parts[1] || 'Class 1',
            sectionName: parts[2] || 'A',
            rollNo: parts[3] || '',
            studentName: parts[4] || parts[1], // fallback if simple 2-col
            admissionNo: parts[5] || '',
            guardianName: parts[6] || '',
            guardianPhone: parts[7] || '',
          });
        }
      }
      setParsedRows(rows);
    } catch {
      setError('Could not parse sheet data. Please check formatting.');
    }
  };

  // 1-Click Fast Template Setup
  const handleGeneratePreset = async () => {
    try {
      setLoading(true);
      setError(null);
      setSummary(null);

      const standardSubjects = [
        { name: 'Bangla 1st Paper', code: 'BAN-101' },
        { name: 'Bangla 2nd Paper', code: 'BAN-102' },
        { name: 'English 1st Paper', code: 'ENG-101' },
        { name: 'English 2nd Paper', code: 'ENG-102' },
        { name: 'Mathematics', code: 'MATH-101' },
        { name: 'General Science', code: 'SCI-101' },
        { name: 'Social Studies & History', code: 'BGS-101' },
        { name: 'Information & Comm. Technology', code: 'ICT-101' },
        { name: 'Religion & Moral Education', code: 'REL-101' },
      ];

      // Auto-create standard subjects
      for (const subj of standardSubjects) {
        try {
          await createSubject(subj);
        } catch {}
      }

      // Build mock baseline roster for generated classes
      const rosterRecords: any[] = [];
      const secList = presetSections.split(',').map((s) => s.trim()).filter(Boolean);

      for (let c = presetMinClass; c <= presetMaxClass; c++) {
        const clsName = `Class ${c}`;
        for (const sec of secList) {
          const secName = `Section ${sec}`;
          // Generate sample baseline student per section
          rosterRecords.push({
            academicYear: presetYear,
            className: clsName,
            sectionName: secName,
            admissionNo: `ADM-${c}${sec}01`,
            rollNo: '01',
            studentName: `Student ${c}-${sec}`,
            guardianName: `Guardian ${c}-${sec}`,
            guardianPhone: '+8801700000000',
          });
        }
      }

      const res = await unifiedAcademicMigration(rosterRecords);
      setSummary(res);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to generate academic preset structure');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Importer Submit
  const handleImportSpreadsheet = async () => {
    if (parsedRows.length === 0) return;
    try {
      setLoading(true);
      setError(null);
      setSummary(null);

      const res = await unifiedAcademicMigration(parsedRows);
      setSummary(res);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to import roster spreadsheet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Academic Structure & Historical Roster Setup Wizard" maxWidth="720px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => { setActiveTab('preset'); setSummary(null); setError(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'preset' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'preset' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            <Sparkles size={16} />
            <span>1-Click School Preset Builder</span>
          </button>

          <button
            onClick={() => { setActiveTab('spreadsheet'); setSummary(null); setError(null); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'spreadsheet' ? 'var(--primary-subtle)' : 'transparent',
              color: activeTab === 'spreadsheet' ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            <FileSpreadsheet size={16} />
            <span>Multi-Class Spreadsheet Importer</span>
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Card */}
        {summary ? (
          <div
            style={{
              padding: '1.25rem',
              background: 'var(--success-bg)',
              border: '1px solid var(--success)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 700, fontSize: '1rem' }}>
              <CheckCircle2 size={20} />
              <span>Academic Data Provisioned & Migrated Successfully!</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ background: 'var(--surface)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Classes Created</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{summary.classesCreated}</div>
              </div>
              <div style={{ background: 'var(--surface)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sections Created</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{summary.sectionsCreated}</div>
              </div>
              <div style={{ background: 'var(--surface)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Students Ingested</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{summary.studentsCreated}</div>
              </div>
              <div style={{ background: 'var(--surface)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active Enrollments</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{summary.enrollmentsCreated}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="primary" onClick={onClose}>
                Done & View Academic Structure
              </Button>
            </div>
          </div>
        ) : activeTab === 'preset' ? (
          /* Preset Builder Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'var(--surface-sunken)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              💡 <strong>Instant School Setup:</strong> Automatically generates all classes, sections, national curriculum subjects (Bangla, English, Math, Science, ICT, etc.) and baseline rosters in 1 click so you don't need manual line-by-line entry.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Academic Session
                </label>
                <input
                  type="text"
                  value={presetYear}
                  onChange={(e) => setPresetYear(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Starting Class
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={presetMinClass}
                  onChange={(e) => setPresetMinClass(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Ending Class
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={presetMaxClass}
                  onChange={(e) => setPresetMaxClass(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Sections Per Class
                </label>
                <input
                  type="text"
                  placeholder="e.g. A, B"
                  value={presetSections}
                  onChange={(e) => setPresetSections(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleGeneratePreset} loading={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} />
                <span>Build Full Academic Hierarchy</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Multi-Class Spreadsheet Importer Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Paste tabular data directly from <strong>Excel</strong>, <strong>Google Sheets</strong>, or CSV:
              </span>
              <button
                type="button"
                onClick={() => handleParseCsv(sampleCsvData)}
                style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Load Sample Roster Data
              </button>
            </div>

            <textarea
              rows={6}
              placeholder={`AcademicYear,Class,Section,RollNo,StudentName,AdmissionNo,GuardianName,GuardianPhone\n2026-2027,Class 6,Section A,01,Student Name,ADM-001,Guardian Name,+8801700000000`}
              value={csvText}
              onChange={(e) => handleParseCsv(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            />

            {parsedRows.length > 0 && (
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Preview: {parsedRows.length} Students Ready to Ingest
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Class</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Section</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Roll</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Student Name</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Guardian</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Phone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 10).map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.className}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.sectionName}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.rollNo}</td>
                          <td style={{ padding: '0.35rem 0.6rem', fontWeight: 600 }}>{r.studentName}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.guardianName}</td>
                          <td style={{ padding: '0.35rem 0.6rem' }}>{r.guardianPhone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 10 && (
                    <div style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface)' }}>
                      + {parsedRows.length - 10} more rows...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImportSpreadsheet}
                loading={loading}
                disabled={parsedRows.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Upload size={16} />
                <span>Import {parsedRows.length > 0 ? `(${parsedRows.length} Students)` : ''}</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
