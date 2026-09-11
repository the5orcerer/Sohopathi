import React, { useState, useEffect } from 'react';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplate,
} from '../services/api';
import type { DocumentTemplateItem } from '../services/api';
import {
  FileText,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Copy,
  Check,
  Award,
  Sparkles,
  CreditCard,
  CalendarCheck,
  Search,
} from 'lucide-react';
import { Button, Badge, Modal } from '../components/common';
import { useSession } from '../context/SessionContext';

export const TemplatesPage: React.FC = () => {
  const { activeMembership, institutionName } = useSession();
  const canManage = activeMembership?.roleName?.toLowerCase().includes('admin');

  const [templates, setTemplates] = useState<DocumentTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Preview Modal State
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplateItem | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit / Create Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplateItem | null>(null);
  const [formData, setFormData] = useState({
    type: 'tc' as any,
    name: '',
    description: '',
    content: '',
  });
  const [saving, setSaving] = useState(false);

  const loadTemplatesData = async () => {
    try {
      setLoading(true);
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (e) {
      console.error('Failed to load templates', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplatesData();
  }, []);

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
          'student.dateOfBirth': 'May 14, 2010',
          'academicYear': '2026-2027',
          'certificateNo': 'TC-2026-0842',
          'issueDate': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          'conductRemarks': 'Exemplary moral discipline, scholastic diligence, and active leadership',
          'reasonForLeaving': 'Parental transfer of residence',
          'examName': 'Annual Board / Term Assessment 2026',
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

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormData({
      type: 'tc',
      name: '',
      description: '',
      content: `<div class="custom-certificate" style="font-family: serif; padding: 40px; border: 3px double #0f172a;">
  <h1 style="text-align: center; color: #1e3a8a;">{{institution.name}}</h1>
  <h2 style="text-align: center; text-transform: uppercase;">Official Certificate</h2>
  <p style="line-height: 2; font-size: 16px;">This is to certify that <strong>{{student.name}}</strong>, Admission No: <strong>{{student.admissionNo}}</strong>, has successfully met all institutional standards.</p>
  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <span>Date: {{issueDate}}</span>
    <span>Head of Institution</span>
  </div>
</div>`,
    });
    setShowEditModal(true);
  };

  const handleOpenEdit = (tmpl: DocumentTemplateItem) => {
    setEditingTemplate(tmpl);
    setFormData({
      type: tmpl.type,
      name: tmpl.name,
      description: tmpl.description || '',
      content: tmpl.content,
    });
    setShowEditModal(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.content.trim()) return;

    try {
      setSaving(true);
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, formData);
      } else {
        await createTemplate(formData);
      }
      setShowEditModal(false);
      await loadTemplatesData();
    } catch (err) {
      console.error('Failed to save template', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document template?')) return;
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete template', err);
    }
  };

  const handlePrintDocument = () => {
    window.print();
  };

  const handleCopyHtml = () => {
    if (renderedHtml) {
      navigator.clipboard.writeText(renderedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTypeBadgeTone = (type: string) => {
    switch (type) {
      case 'tc': return 'primary';
      case 'marksheet': return 'info';
      case 'testimonial': return 'warning';
      case 'admit_card': return 'neutral';
      case 'id_card': return 'success';
      default: return 'neutral';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tc': return <FileText size={18} style={{ color: '#3b82f6' }} />;
      case 'marksheet': return <Award size={18} style={{ color: '#10b981' }} />;
      case 'testimonial': return <Sparkles size={18} style={{ color: '#f59e0b' }} />;
      case 'admit_card': return <CalendarCheck size={18} style={{ color: '#8b5cf6' }} />;
      case 'id_card': return <CreditCard size={18} style={{ color: '#ec4899' }} />;
      default: return <FileText size={18} />;
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesType = activeType === 'all' || t.type === activeType;
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

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
          background: 'var(--surface)',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={24} style={{ color: 'var(--brand-primary)' }} />
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Document & Certificate Templates
            </h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0' }}>
            Standard government, board, and institutional templates for Transfer Certificates (TC), Academic Marksheets, Admit Cards, and Testimonials.
          </p>
        </div>

        {canManage && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            icon={<Plus size={15} />}
          >
            Create New Template
          </Button>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '0.35rem',
            background: 'var(--surface-sunken)',
            padding: '0.3rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'all', label: 'All Templates' },
            { id: 'tc', label: 'Transfer Certificates (TC)' },
            { id: 'marksheet', label: 'Marksheets / Transcripts' },
            { id: 'testimonial', label: 'Character Testimonials' },
            { id: 'admit_card', label: 'Admit Cards' },
            { id: 'id_card', label: 'ID Badges' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveType(tab.id)}
              style={{
                padding: '0.35rem 0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontWeight: activeType === tab.id ? 600 : 450,
                background: activeType === tab.id ? 'var(--brand-primary)' : 'transparent',
                color: activeType === tab.id ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.1rem',
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

      {/* Templates Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading document templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            padding: '3rem',
            textAlign: 'center',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border)',
          }}
        >
          <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>No templates found</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.35rem 0 1.25rem' }}>
            No document templates match the selected criteria.
          </p>
          {canManage && (
            <Button variant="primary" size="sm" onClick={handleOpenCreate} icon={<Plus size={14} />}>
              Create Template
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredTemplates.map((tmpl) => (
            <div
              key={tmpl.id}
              style={{
                background: 'var(--surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '8px', background: 'var(--surface-sunken)' }}>
                      {getTypeIcon(tmpl.type)}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {tmpl.name}
                      </h3>
                      <div style={{ marginTop: '0.2rem' }}>
                        <Badge tone={getTypeBadgeTone(tmpl.type)}>{tmpl.type.toUpperCase()}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.85rem 0 1rem 0', minHeight: '38px' }}>
                  {tmpl.description || 'Pre-configured institutional certificate template with dynamic placeholder tokens.'}
                </p>

                {/* Tokens pill box */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
                  {['student.name', 'student.admissionNo', 'student.rollNo', 'issueDate'].map((token) => (
                    <span
                      key={token}
                      style={{
                        fontSize: '0.68rem',
                        fontFamily: 'monospace',
                        padding: '0.2rem 0.45rem',
                        background: 'var(--surface-sunken)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      &#123;&#123;{token}&#125;&#125;
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenPreview(tmpl)}
                  icon={<Eye size={14} />}
                >
                  Preview Document
                </Button>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(tmpl)}
                      title="Edit Template"
                    >
                      <Edit2 size={14} />
                    </Button>
                  )}
                  {canManage && tmpl.institutionId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      title="Delete Template"
                    >
                      <Trash2 size={14} style={{ color: 'var(--status-danger)' }} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Preview Modal */}
      {previewTemplate && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewTemplate(null)}
          title={`Document Preview: ${previewTemplate.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Rendered with live institutional variables & sample student data.
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyHtml}
                  icon={copied ? <Check size={14} /> : <Copy size={14} />}
                >
                  {copied ? 'Copied HTML!' : 'Copy HTML'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePrintDocument}
                  icon={<Printer size={14} />}
                >
                  Print / Save PDF
                </Button>
              </div>
            </div>

            {/* Document Render Container */}
            <div
              className="printable-document-area"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '1.5rem',
                maxHeight: '65vh',
                overflowY: 'auto',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)',
              }}
            >
              {previewLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  Generating live certificate preview...
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Create / Edit Template Modal */}
      {showEditModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowEditModal(false)}
          title={editingTemplate ? 'Edit Document Template' : 'Create Document Template'}
        >
          <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Template Type
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="tc">Transfer Certificate (TC)</option>
                  <option value="marksheet">Marksheet / Transcript</option>
                  <option value="testimonial">Testimonial / Character</option>
                  <option value="admit_card">Examination Admit Card</option>
                  <option value="id_card">Student ID Card</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Official School Leaving Certificate"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief purpose and usage of this document"
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-sunken)',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  HTML Template & Interpolation Tokens
                </label>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Use &#123;&#123;student.name&#125;&#125;, &#123;&#123;institution.name&#125;&#125;, &#123;&#123;issueDate&#125;&#125;, etc.
                </span>
              </div>
              <textarea
                rows={12}
                required
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-sunken)',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" size="sm" onClick={() => setShowEditModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default TemplatesPage;
