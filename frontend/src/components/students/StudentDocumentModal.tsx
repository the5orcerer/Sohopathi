import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  fetchTemplates,
  renderTemplate,
} from '../../services/api';
import type { DocumentTemplateItem } from '../../services/api';
import type { StudentItem } from '../../types';
import { useSession } from '../../context/SessionContext';
import { Printer, Copy, Check } from 'lucide-react';

interface StudentDocumentModalProps {
  student: StudentItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const StudentDocumentModal: React.FC<StudentDocumentModalProps> = ({
  student,
  isOpen,
  onClose,
}) => {
  const { institutionName } = useSession();
  const [templates, setTemplates] = useState<DocumentTemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [rendering, setRendering] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Document customization parameters
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reasonForLeaving, setReasonForLeaving] = useState<string>('Successful completion of grade / Parental transfer of residence');
  const [conductRemarks, setConductRemarks] = useState<string>('Exemplary academic discipline and sound moral character');
  const [examName, setExamName] = useState<string>('Annual Board / Term Examination 2026');

  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      try {
        const data = await fetchTemplates();
        setTemplates(data);
        if (data.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(data[0].id);
        }
      } catch (e) {
        console.error('Failed to load templates', e);
      }
    };

    loadTemplates();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !student || !selectedTemplateId) return;

    const generatePreview = async () => {
      setRendering(true);
      try {
        const res = await renderTemplate(selectedTemplateId, {
          studentId: student.id,
          variables: {
            'institution.name': institutionName || 'Dhaka Model International Academy',
            'student.name': student.name,
            'student.admissionNo': student.admissionNo,
            'student.rollNo': student.rollNo || '01',
            'student.className': student.className || 'Grade 10',
            'student.sectionName': student.sectionName || 'Section A',
            'student.gender': student.gender || 'Unspecified',
            'student.dateOfBirth': student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : 'Unspecified',
            'student.guardianName': student.guardianName || 'Guardian',
            'student.guardianPhone': student.guardianPhone || '+880 1700-000000',
            'issueDate': new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            'certificateNo': `CERT-${student.admissionNo.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`,
            'reasonForLeaving': reasonForLeaving,
            'conductRemarks': conductRemarks,
            'examName': examName,
            'academicYear': '2026-2027',
          },
        });
        setRenderedHtml(res.rendered);
      } catch (e) {
        console.error('Failed to render document', e);
      } finally {
        setRendering(false);
      }
    };

    generatePreview();
  }, [isOpen, student, selectedTemplateId, issueDate, reasonForLeaving, conductRemarks, examName, institutionName]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    if (renderedHtml) {
      navigator.clipboard.writeText(renderedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!student) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Generate Certificate / Document: ${student.name} (${student.admissionNo})`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Top Options Bar */}
        <div
          style={{
            background: 'var(--surface-sunken)',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {/* Template Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Select Document Template
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface)',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                }}
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    [{tmpl.type.toUpperCase()}] {tmpl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Issue Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Official Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface)',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Conditional Custom Context Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Reason for Leaving / Withdrawal (for TC)
              </label>
              <input
                type="text"
                value={reasonForLeaving}
                onChange={(e) => setReasonForLeaving(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface)',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                General Conduct & Remarks
              </label>
              <input
                type="text"
                value={conductRemarks}
                onChange={(e) => setConductRemarks(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface)',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Exam / Term Name (for Marksheet/Admit)
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface)',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span>Class: <strong>{student.className || 'N/A'} ({student.sectionName || 'N/A'})</strong></span>
            <span>&bull;</span>
            <span>Roll: <strong>{student.rollNo || 'N/A'}</strong></span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
            >
              {copied ? 'Copied HTML' : 'Copy HTML'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              icon={<Printer size={14} />}
            >
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Live Document Preview Box */}
        <div
          className="printable-document-area"
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '1.75rem',
            maxHeight: '60vh',
            overflowY: 'auto',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          {rendering ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
              Interpolating student document...
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default StudentDocumentModal;
