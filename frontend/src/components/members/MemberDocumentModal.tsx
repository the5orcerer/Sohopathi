import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { fetchTemplates, renderTemplate } from '../../services/api';
import type { DocumentTemplateItem } from '../../services/api';
import type { Member } from '../../types';
import { useSession } from '../../context/SessionContext';
import { Printer, Copy, Check, FileBadge } from 'lucide-react';

interface MemberDocumentModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MemberDocumentModal: React.FC<MemberDocumentModalProps> = ({
  member,
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
  const [designation, setDesignation] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [salary, setSalary] = useState<string>('৳ 45,000');

  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      try {
        const data = await fetchTemplates();
        // Prioritize employee / certificate / id_card templates
        const employeeTemplates = data.filter(
          (t) =>
            t.context?.includes('employee') ||
            t.context?.includes('appointment') ||
            t.context?.includes('salary') ||
            t.type === 'id_card' ||
            t.type === 'certificate'
        );
        const listToUse = employeeTemplates.length > 0 ? employeeTemplates : data;
        setTemplates(listToUse);
        if (listToUse.length > 0 && !selectedTemplateId) {
          const defaultEmp = listToUse.find((t) => t.context === 'employee_id_card') || listToUse[0];
          setSelectedTemplateId(defaultEmp.id);
        }
      } catch (e) {
        console.error('Failed to load templates', e);
      }
    };

    loadTemplates();
  }, [isOpen]);

  useEffect(() => {
    if (member) {
      setDesignation(member.customFields?.designation || member.roleName || 'Faculty / Staff');
      setDepartment(member.customFields?.department || 'Academic Department');
      setSalary(member.customFields?.salary ? `৳ ${Number(member.customFields.salary).toLocaleString()}` : '৳ 45,000');
    }
  }, [member]);

  useEffect(() => {
    if (!isOpen || !member || !selectedTemplateId) return;

    const generatePreview = async () => {
      setRendering(true);
      try {
        const res = await renderTemplate(selectedTemplateId, {
          entityId: member.id,
          entityType: 'member',
          variables: {
            'institution.name': institutionName || 'Dhaka Model International Academy',
            'employee.name': member.name,
            'employee.designation': designation || member.roleName,
            'employee.department': department || 'Academic Department',
            'employee.code': member.username || `EMP-${member.id.slice(0, 6).toUpperCase()}`,
            'employee.joiningDate': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            'employee.salary': salary,
            'employee.phone': member.phone || '+880 1711-000000',
            'employee.email': member.email,
            'issueDate': new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            'certificateNo': `EMP-DOC-${member.id.slice(0, 6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            'academicYear': '2026-2027',
          },
        });
        setRenderedHtml(res.rendered);
      } catch (e) {
        console.error('Failed to render employee document', e);
      } finally {
        setRendering(false);
      }
    };

    generatePreview();
  }, [isOpen, member, selectedTemplateId, issueDate, designation, department, salary, institutionName]);

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

  if (!member) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Staff & Faculty Document: ${member.name} (${member.roleName})`}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Designation / Position
              </label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
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
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
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
                Remuneration / Salary
              </label>
              <input
                type="text"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
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
            <FileBadge size={15} style={{ color: 'var(--brand-primary)' }} />
            <span>Role: <strong>{member.roleName}</strong></span>
            <span>&bull;</span>
            <span>Email: <strong>{member.email}</strong></span>
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
              Generating employee official document...
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default MemberDocumentModal;

