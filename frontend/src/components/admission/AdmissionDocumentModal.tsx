import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { fetchTemplates, renderTemplate } from '../../services/api';
import type { DocumentTemplateItem } from '../../services/api';
import type { AdmissionApplicationItem } from '../../types';
import { useSession } from '../../context/SessionContext';
import { Printer, Copy, Check, UserCheck } from 'lucide-react';

interface AdmissionDocumentModalProps {
  application: AdmissionApplicationItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AdmissionDocumentModal: React.FC<AdmissionDocumentModalProps> = ({
  application,
  isOpen,
  onClose,
}) => {
  const { institutionName } = useSession();
  const [templates, setTemplates] = useState<DocumentTemplateItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [rendering, setRendering] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Customization parameters
  const [issueDate, setIssueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      try {
        const data = await fetchTemplates();
        // Prioritize admission_form, admit_card, or certificate
        const admissionTemplates = data.filter(
          (t) =>
            t.context?.includes('admission') ||
            t.type === 'admit_card' ||
            t.type === 'certificate'
        );
        const listToUse = admissionTemplates.length > 0 ? admissionTemplates : data;
        setTemplates(listToUse);
        if (listToUse.length > 0 && !selectedTemplateId) {
          const defaultAdm = listToUse.find((t) => t.context === 'admission_form') || listToUse[0];
          setSelectedTemplateId(defaultAdm.id);
        }
      } catch (e) {
        console.error('Failed to load templates', e);
      }
    };

    loadTemplates();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !application || !selectedTemplateId) return;

    const generatePreview = async () => {
      setRendering(true);
      try {
        const applicantName = application.studentName || application.applicantName || 'Applicant';
        const res = await renderTemplate(selectedTemplateId, {
          entityId: application.id,
          entityType: 'admission',
          variables: {
            'institution.name': institutionName || 'Dhaka Model International Academy',
            'student.name': applicantName,
            'student.admissionNo': application.applicationNo,
            'student.className': application.className || 'Grade 10',
            'student.gender': application.gender || 'Unspecified',
            'student.dateOfBirth': application.dateOfBirth ? new Date(application.dateOfBirth).toLocaleDateString() : 'Unspecified',
            'student.guardianName': application.guardianName,
            'student.guardianPhone': application.guardianPhone,
            'guardian.name': application.guardianName,
            'guardian.phone': application.guardianPhone,
            'admission.number': application.applicationNo,
            'admission.status': application.status,
            'issueDate': new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            'academicYear': '2026-2027',
          },
        });
        setRenderedHtml(res.rendered);
      } catch (e) {
        console.error('Failed to render admission document', e);
      } finally {
        setRendering(false);
      }
    };

    generatePreview();
  }, [isOpen, application, selectedTemplateId, issueDate, institutionName]);

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

  if (!application) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Admission Document: ${application.studentName || application.applicantName} (${application.applicationNo})`}
      maxWidth="850px"
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
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
          }}
        >
          <div style={{ flex: '1 1 280px' }}>
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

          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Issue Date
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

        {/* Action Buttons Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <UserCheck size={15} style={{ color: 'var(--brand-primary)' }} />
            <span>Applicant: <strong>{application.studentName || application.applicantName}</strong></span>
            <span>&bull;</span>
            <span>Class: <strong>{application.className || 'N/A'}</strong></span>
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
              Rendering admission application document...
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AdmissionDocumentModal;

