import React, { useState, useEffect } from 'react';
import {
  fetchTemplates,
  deleteTemplate,
  renderTemplate,
  duplicateTemplate,
  setDefaultTemplate,
  archiveTemplate,
  bulkRenderTemplate,
  fetchGeneratedDocuments,
  fetchGeneratedDocument,
} from '../services/api';
import type { DocumentTemplateItem, GeneratedDocumentItem } from '../services/api';
import {
  FileText,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Copy,
  Check,
  Sparkles,
  Lock,
  Star,
  Archive,
  Layers,
  History,
  Users,
} from 'lucide-react';
import { Button, Badge, Modal, GlobalFilterBar } from '../components/common';
import type { GlobalFilterValues } from '../components/common';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';

interface TemplatesPageProps {
  onNavigate?: (path: string) => void;
}

export const TemplatesPage: React.FC<TemplatesPageProps> = ({ onNavigate }) => {
  const { activeMembership, institutionName, hasPermission } = useSession();
  const { t } = useLanguage();
  const canManage = hasPermission('templates.manage') || activeMembership?.roleName?.toLowerCase().includes('admin');
  const canGenerate = hasPermission('templates.read') || canManage;

  // Navigation tab: 'templates' | 'archive'
  const [activeTab, setActiveTab] = useState<'templates' | 'archive'>('templates');

  const [templates, setTemplates] = useState<DocumentTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Global Filters for Templates
  const [filters, setFilters] = useState<GlobalFilterValues>({
    status: 'active',
  });
  const [selectedContext, setSelectedContext] = useState<string>('all');

  // Preview Modal State
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplateItem | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Bulk Generation Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState<DocumentTemplateItem | null>(null);
  const [bulkEntityType, setBulkEntityType] = useState<'student' | 'employee'>('student');
  const [bulkEntityIds, setBulkEntityIds] = useState<string>('ADM-2026-001, ADM-2026-002, ADM-2026-003');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkResults, setBulkResults] = useState<any[]>([]);

  // Generated Documents Archive State
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocumentItem[]>([]);
  const [selectedGenDoc, setSelectedGenDoc] = useState<GeneratedDocumentItem | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const loadTemplatesData = async () => {
    try {
      setLoading(true);
      const isArchived = filters.status === 'archived';
      const data = await fetchTemplates({
        isArchived,
        search: filters.search,
        context: selectedContext !== 'all' ? selectedContext : undefined,
      });
      setTemplates(data);
    } catch (e) {
      console.error('Failed to load templates', e);
    } finally {
      setLoading(false);
    }
  };

  const loadArchiveData = async () => {
    try {
      setArchiveLoading(true);
      const docs = await fetchGeneratedDocuments();
      setGeneratedDocs(docs);
    } catch (e) {
      console.error('Failed to load generated documents archive', e);
    } finally {
      setArchiveLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplatesData();
    } else {
      loadArchiveData();
    }
  }, [activeTab, filters.status, filters.search, selectedContext]);

  const handleOpenPreview = async (tmpl: DocumentTemplateItem) => {
    setPreviewTemplate(tmpl);
    setPreviewLoading(true);
    try {
      const res = await renderTemplate(tmpl.id, {
        variables: {
          'institution.name': institutionName || 'Dhaka Model International Academy',
          'student.name': 'Tahmid Rahman',
          'student.admissionNo': 'ADM-2026-001',
          'student.rollNo': '01',
          'student.className': 'Grade 10',
          'student.sectionName': 'Section A',
          'student.guardianName': 'Mr. Anisur Rahman',
          'student.guardianPhone': '+880 1711-234567',
          'academicYear': '2026-2027',
          'certificateNo': 'TC-2026-0842',
          'issueDate': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        },
      });
      setRenderedHtml(res.rendered);
    } catch (e) {
      console.error('Failed to render preview', e);
      setRenderedHtml(tmpl.content);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDuplicate = async (tmpl: DocumentTemplateItem) => {
    try {
      await duplicateTemplate(tmpl.id, `${tmpl.name} (Copy)`);
      await loadTemplatesData();
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate template');
    }
  };

  const handleSetDefault = async (tmpl: DocumentTemplateItem) => {
    try {
      await setDefaultTemplate(tmpl.id);
      await loadTemplatesData();
    } catch (err: any) {
      alert(err.message || 'Failed to set default template');
    }
  };

  const handleArchiveToggle = async (tmpl: DocumentTemplateItem) => {
    try {
      await archiveTemplate(tmpl.id, !tmpl.isArchived);
      await loadTemplatesData();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle archive');
    }
  };

  const handleDeleteTemplate = async (tmpl: DocumentTemplateItem) => {
    if (tmpl.isSystem || !tmpl.institutionId) {
      alert('System templates are read-only and protected from deletion.');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${tmpl.name}"?`)) return;
    try {
      await deleteTemplate(tmpl.id);
      setTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete template');
    }
  };

  const handleOpenBulk = (tmpl: DocumentTemplateItem) => {
    setBulkTemplate(tmpl);
    setBulkResults([]);
    setBulkModalOpen(true);
  };

  const handleExecuteBulkRender = async () => {
    if (!bulkTemplate) return;
    const ids = bulkEntityIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      alert('Please provide at least one ID');
      return;
    }

    try {
      setBulkGenerating(true);
      const res = await bulkRenderTemplate(bulkTemplate.id, {
        entityType: bulkEntityType,
        entityIds: ids,
        saveSnapshots: true,
      });
      setBulkResults(res.items || []);
    } catch (err: any) {
      alert(err.message || 'Failed to bulk render documents');
    } finally {
      setBulkGenerating(false);
    }
  };

  const handlePrintBatch = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const allPagesHtml = bulkResults
      .map(
        (b) => `
        <div class="page-container" style="page-break-after: always; min-height: 270mm; position: relative;">
          ${b.rendered}
        </div>
      `
      )
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bulk Print - ${bulkTemplate?.name}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
          </style>
        </head>
        <body>
          ${allPagesHtml}
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleViewArchiveDoc = async (docId: string) => {
    try {
      const doc = await fetchGeneratedDocument(docId);
      setSelectedGenDoc(doc);
    } catch (e) {
      console.error('Failed to load document snapshot', e);
    }
  };

  const CONTEXT_OPTIONS = [
    { value: 'all', label: 'All Document Categories' },
    { value: 'marksheet', label: 'Marksheets & Transcripts' },
    { value: 'id_card', label: 'Student ID Cards' },
    { value: 'employee_id_card', label: 'Employee ID Cards' },
    { value: 'tc', label: 'Transfer Certificates (TC)' },
    { value: 'certificate', label: 'Character & Testimonials' },
    { value: 'admission_form', label: 'Admission Applications' },
    { value: 'salary_slip', label: 'Staff Salary Slips' },
    { value: 'appointment_letter', label: 'Appointment Letters' },
    { value: 'invoice', label: 'Tuition & Fee Invoices' },
    { value: 'receipt', label: 'Payment Receipts' },
    { value: 'fee_statement', label: 'Fee Account Statements' },
    { value: 'exam_attendance', label: 'Exam Attendance Registers' },
    { value: 'exam_room_list', label: 'Exam Room Seating Plans' },
    { value: 'result_summary', label: 'Result Summaries' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'var(--surface, #ffffff)',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={24} style={{ color: 'var(--brand-primary, #6366f1)' }} />
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              {t('templates.title', 'Document Templates & Generator')}
            </h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', margin: '0.3rem 0 0' }}>
            {t('templates.subtitle', 'Centralized institutional templates, canonical variables, version-tracked snapshots, and high-volume client-side PDF rendering.')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {canManage && onNavigate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('/templates/builder')}
              icon={<Sparkles size={15} />}
            >
              {t('templates.open_builder', 'Open Template Builder')}
            </Button>
          )}
        </div>
      </div>

      {/* Primary Tab Selector */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'templates' ? '2px solid var(--brand-primary, #6366f1)' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === 'templates' ? 'var(--brand-primary, #6366f1)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          <Layers size={16} />
          {t('templates.library', 'Template Library')}
          <Badge tone="neutral">{templates.length}</Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('archive')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            border: 'none',
            borderBottom: activeTab === 'archive' ? '2px solid var(--brand-primary, #6366f1)' : '2px solid transparent',
            background: 'transparent',
            color: activeTab === 'archive' ? 'var(--brand-primary, #6366f1)' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          <History size={16} />
          {t('templates.historical', 'Historical Generated Documents')}
        </button>
      </div>

      {/* TAB 1: TEMPLATE LIBRARY */}
      {activeTab === 'templates' && (
        <>
          {/* Global Filter Bar */}
          <GlobalFilterBar
            filters={filters}
            onChange={setFilters}
            onReset={() => setFilters({ status: 'active' })}
            searchPlaceholder="Search template names and descriptions..."
            showStatus={true}
            statusOptions={[
              { value: 'active', label: 'Active Templates' },
              { value: 'archived', label: 'Archived Templates' },
            ]}
            extraControls={
              <select
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm, 6px)',
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.8rem',
                  background: 'var(--bg, #f8fafc)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                }}
              >
                {CONTEXT_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            }
          />

          {/* Templates Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Loading document templates...
            </div>
          ) : templates.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem',
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <FileText size={40} style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>No templates found</h3>
              <p style={{ margin: '0.5rem 0 1.25rem', fontSize: '0.85rem' }}>
                Try adjusting your search terms or category filters.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {templates.map((tmpl) => {
                const isSys = tmpl.isSystem || !tmpl.institutionId;
                return (
                  <div
                    key={tmpl.id}
                    style={{
                      background: 'var(--card-bg, var(--surface))',
                      border: isSys ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border)',
                      borderRadius: 'var(--radius, 8px)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)',
                      position: 'relative',
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {isSys ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: 'var(--brand-primary, #818cf8)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                borderRadius: '12px',
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                              }}
                            >
                              <Lock size={11} />
                              {t('templates.system_badge', 'System Template')}
                            </span>
                          ) : (
                            <Badge tone="neutral">Custom</Badge>
                          )}

                          {tmpl.isDefault && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                borderRadius: '12px',
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                              }}
                            >
                              <Star size={10} />
                              {t('templates.default_badge', 'Default')}
                            </span>
                          )}

                          <Badge tone="info">v{tmpl.version || 1}</Badge>
                        </div>

                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                          {tmpl.pageSize || 'A4'} &bull; {tmpl.orientation || 'portrait'}
                        </span>
                      </div>

                      {/* Template Title & Description */}
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
                        {tmpl.name}
                      </h3>
                      <p
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          margin: 0,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {tmpl.description || `Official ${tmpl.context || tmpl.type} template layout.`}
                      </p>
                    </div>

                    {/* Bottom Actions Toolbar */}
                    <div
                      style={{
                        marginTop: '1.25rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenPreview(tmpl)}
                          icon={<Eye size={14} />}
                          title="Preview document"
                        >
                          {t('common.preview', 'Preview')}
                        </Button>

                        {canGenerate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenBulk(tmpl)}
                            icon={<Users size={14} />}
                            title="Bulk Generate / Print"
                          >
                            {t('templates.bulk_generate', 'Bulk')}
                          </Button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(tmpl)}
                            icon={<Copy size={14} />}
                            title="Duplicate template"
                          >
                            {t('common.clone', 'Clone')}
                          </Button>
                        )}

                        {canManage && !isSys && !tmpl.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(tmpl)}
                            icon={<Star size={14} />}
                            title="Set as context default"
                          >
                            Default
                          </Button>
                        )}

                        {canManage && !isSys && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchiveToggle(tmpl)}
                            icon={<Archive size={14} />}
                            title={tmpl.isArchived ? 'Unarchive template' : 'Archive template'}
                          >
                            {tmpl.isArchived ? 'Restore' : 'Archive'}
                          </Button>
                        )}

                        {canManage && onNavigate && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onNavigate(`/templates/builder?id=${tmpl.id}`)}
                            icon={<Edit2 size={13} />}
                          >
                            {isSys ? t('common.customize', 'Customize') : t('common.edit', 'Edit')}
                          </Button>
                        )}

                        {canManage && !isSys && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tmpl)}
                            title="Delete custom template"
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#ef4444',
                              padding: '4px',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: HISTORICAL GENERATED DOCUMENTS */}
      {activeTab === 'archive' && (
        <div>
          <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            These immutable snapshots record the exact visual layout and values of previously generated documents at their historical moment of generation.
          </div>

          {archiveLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              Loading document archive...
            </div>
          ) : generatedDocs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '4rem',
                background: 'var(--surface)',
                borderRadius: 'var(--radius)',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <History size={40} style={{ opacity: 0.5, marginBottom: '0.75rem' }} />
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>No generated documents yet</h3>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                When you generate marksheets, ID cards, or certificates with "Save Snapshot", they appear here frozen forever.
              </p>
            </div>
          ) : (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px' }}>Document Title</th>
                    <th style={{ padding: '10px 14px' }}>Type</th>
                    <th style={{ padding: '10px 14px' }}>Template Version</th>
                    <th style={{ padding: '10px 14px' }}>Generated Date</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedDocs.map((doc) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {doc.title}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <Badge tone="neutral">{doc.documentType}</Badge>
                      </td>
                      <td style={{ padding: '12px 14px' }}>v{doc.templateVersion}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {new Date(doc.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewArchiveDoc(doc.id)}
                          icon={<Eye size={14} />}
                        >
                          View Frozen Snapshot
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SINGLE DOCUMENT PREVIEW MODAL */}
      <Modal
        isOpen={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        title={previewTemplate ? `Document Preview: ${previewTemplate.name}` : ''}
        maxWidth="900px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Mandatory Biddyapith footer watermark is permanently applied.
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(renderedHtml);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                icon={copied ? <Check size={14} /> : <Copy size={14} />}
              >
                {copied ? 'Copied HTML' : 'Copy HTML'}
              </Button>
              <Button variant="primary" size="sm" onClick={() => window.print()} icon={<Printer size={14} />}>
                Print Document
              </Button>
            </div>
          </div>

          <div
            style={{
              maxHeight: '65vh',
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '25px',
              background: '#ffffff',
              color: '#0f172a',
            }}
          >
            {previewLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Rendering document...</div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            )}
          </div>
        </div>
      </Modal>

      {/* BULK GENERATE & PRINT MODAL */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={bulkTemplate ? `Bulk Document Generation: ${bulkTemplate.name}` : ''}
        maxWidth="800px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Batch-render official documents for multiple students or employees without sending hundreds of individual requests.
          </p>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Target Entity Type:
            </label>
            <select
              value={bulkEntityType}
              onChange={(e) => setBulkEntityType(e.target.value as any)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
              }}
            >
              <option value="student">Students (Class Cohort / Admissions)</option>
              <option value="employee">Employees (Faculty / Staff)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
              Entity IDs / Admission Numbers (Comma separated):
            </label>
            <textarea
              value={bulkEntityIds}
              onChange={(e) => setBulkEntityIds(e.target.value)}
              placeholder="e.g. ADM-2026-001, ADM-2026-002, ADM-2026-003..."
              style={{
                width: '100%',
                height: '80px',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button
              variant="primary"
              onClick={handleExecuteBulkRender}
              disabled={bulkGenerating}
              icon={bulkGenerating ? <span className="animate-spin">&bull;</span> : <Sparkles size={14} />}
            >
              {bulkGenerating ? 'Generating Batch...' : 'Generate Batch'}
            </Button>
          </div>

          {bulkResults.length > 0 && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#16a34a' }}>
                  ✓ Successfully generated {bulkResults.length} documents!
                </span>
                <Button variant="secondary" size="sm" onClick={handlePrintBatch} icon={<Printer size={14} />}>
                  Print All {bulkResults.length} Pages
                </Button>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                {bulkResults.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>
                      Document #{idx + 1} &bull; Entity ID: {item.entityId}
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: item.rendered }} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* FROZEN HISTORICAL SNAPSHOT MODAL */}
      <Modal
        isOpen={Boolean(selectedGenDoc)}
        onClose={() => setSelectedGenDoc(null)}
        title={selectedGenDoc ? `Historical Snapshot: ${selectedGenDoc.title}` : ''}
        maxWidth="900px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Frozen Snapshot &bull; Template Version: {selectedGenDoc?.templateVersion} &bull; Generated: {selectedGenDoc?.createdAt ? new Date(selectedGenDoc.createdAt).toLocaleString() : ''}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;
                printWindow.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head><title>${selectedGenDoc?.title}</title></head>
                    <body>${selectedGenDoc?.renderedContent}</body>
                    <script>window.onload = function() { window.print(); window.close(); };</script>
                  </html>
                `);
                printWindow.document.close();
              }}
              icon={<Printer size={14} />}
            >
              Print Snapshot
            </Button>
          </div>

          <div
            style={{
              maxHeight: '65vh',
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '25px',
              background: '#ffffff',
              color: '#0f172a',
            }}
          >
            {selectedGenDoc?.renderedContent ? (
              <div dangerouslySetInnerHTML={{ __html: selectedGenDoc.renderedContent }} />
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No rendered content available</div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TemplatesPage;
