import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { fetchTemplates, renderTemplate } from '../../services/api';
import type { DocumentTemplateItem } from '../../services/api';
import type { Invoice } from '../../types';
import { useSession } from '../../context/SessionContext';
import { Printer, Copy, Check, Receipt } from 'lucide-react';

interface InvoiceDocumentModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceDocumentModal: React.FC<InvoiceDocumentModalProps> = ({
  invoice,
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
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash / Bank Transfer');

  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      try {
        const data = await fetchTemplates();
        const financeTemplates = data.filter(
          (t) =>
            t.context?.includes('invoice') ||
            t.context?.includes('receipt') ||
            t.context?.includes('fee') ||
            t.type === 'certificate'
        );
        const listToUse = financeTemplates.length > 0 ? financeTemplates : data;
        setTemplates(listToUse);
        if (listToUse.length > 0 && !selectedTemplateId) {
          const defaultTmpl =
            invoice?.status === 'paid'
              ? listToUse.find((t) => t.context === 'receipt') || listToUse[0]
              : listToUse.find((t) => t.context === 'invoice') || listToUse[0];
          setSelectedTemplateId(defaultTmpl.id);
        }
      } catch (e) {
        console.error('Failed to load templates', e);
      }
    };

    loadTemplates();
  }, [isOpen, invoice]);

  useEffect(() => {
    if (!isOpen || !invoice || !selectedTemplateId) return;

    const generatePreview = async () => {
      setRendering(true);
      try {
        const recipientName = invoice.studentName || invoice.employeeName || 'Billed Recipient';
        const formattedAmount = `৳ ${Number(invoice.totalAmount || invoice.amount || 0).toLocaleString()}`;
        const res = await renderTemplate(selectedTemplateId, {
          entityId: invoice.id,
          entityType: 'invoice',
          variables: {
            'institution.name': institutionName || 'Dhaka Model International Academy',
            'student.name': recipientName,
            'student.admissionNo': invoice.studentRollNo ? `ROLL-${invoice.studentRollNo}` : 'ADM-001',
            'student.className': invoice.className || 'General',
            'student.sectionName': invoice.sectionName || 'A',
            'invoice.number': invoice.invoiceNumber || `INV-${invoice.id.slice(0, 6).toUpperCase()}`,
            'invoice.dueDate': invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Upon receipt',
            'invoice.amount': formattedAmount,
            'receipt.number': `RCP-${invoice.id.slice(0, 6).toUpperCase()}`,
            'receipt.amount': formattedAmount,
            'receipt.date': invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : new Date(issueDate).toLocaleDateString(),
            'receipt.method': paymentMethod,
            'issueDate': new Date(issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            'academicYear': '2026-2027',
          },
        });
        setRenderedHtml(res.rendered);
      } catch (e) {
        console.error('Failed to render billing document', e);
      } finally {
        setRendering(false);
      }
    };

    generatePreview();
  }, [isOpen, invoice, selectedTemplateId, issueDate, paymentMethod, institutionName]);

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

  if (!invoice) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Financial Document: ${invoice.title} (${invoice.invoiceNumber || invoice.id.slice(0, 8)})`}
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
              Payment Method (for Receipt)
            </label>
            <input
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              placeholder="e.g. bKash / Bank / Cash"
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
            <Receipt size={15} style={{ color: 'var(--brand-primary)' }} />
            <span>Amount: <strong>৳ {Number(invoice.totalAmount || invoice.amount || 0).toLocaleString()}</strong></span>
            <span>&bull;</span>
            <span>Status: <strong style={{ textTransform: 'capitalize' }}>{invoice.status}</strong></span>
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
              Rendering financial document voucher...
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceDocumentModal;

