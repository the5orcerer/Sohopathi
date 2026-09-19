import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchAssignments,
  createAssignment,
  deleteAssignment,
  fetchSections,
  fetchSubjects,
} from '../services/api';
import type { Assignment, SectionItem, SubjectItem } from '../types';
import { SearchBar, Badge, Button, Modal, EmptyState } from '../components/common';
import {
  Plus,
  Clock,
  BookOpen,
  Trash2,
  Eye,
  Calendar,
  Award,
} from 'lucide-react';

export const AssignmentsPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { t } = useLanguage();
  const { hasPermission } = useSession();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Permissions
  const canCreate = hasPermission('assignments.create') || hasPermission('assignments.write');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createInstructions, setCreateInstructions] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createMaxMarks, setCreateMaxMarks] = useState('100');
  const [createStatus, setCreateStatus] = useState<'draft' | 'published' | 'closed'>('published');
  const [createSectionId, setCreateSectionId] = useState('');
  const [createSubjectId, setCreateSubjectId] = useState('');
  const [saving, setSaving] = useState(false);

  // Detailed View Modal (Informational homework reader)
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [asgn, sec, sub] = await Promise.all([
        fetchAssignments(),
        fetchSections(),
        fetchSubjects(),
      ]);
      setAssignments(asgn);
      setSections(sec);
      setSubjects(sub);
      if (sec.length > 0 && !createSectionId) setCreateSectionId(sec[0].id);
      if (sub.length > 0 && !createSubjectId) setCreateSubjectId(sub[0].id);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim() || !createSectionId || !createSubjectId) return;
    setSaving(true);
    try {
      const created = await createAssignment({
        sectionId: createSectionId,
        subjectId: createSubjectId,
        title: createTitle.trim(),
        description: createDesc.trim() || undefined,
        instructions: createInstructions.trim() || undefined,
        dueDate: createDueDate || undefined,
        maxMarks: createMaxMarks ? Number(createMaxMarks) : 100,
        status: createStatus,
        allowLateSubmissions: false,
      });
      setAssignments([created, ...assignments]);
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateInstructions('');
      setCreateDueDate('');
      setCreateMaxMarks('100');
      setCreateStatus('published');
    } catch (err: any) {
      alert(err.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment notice?')) return;
    try {
      await deleteAssignment(id);
      setAssignments(assignments.filter((a) => a.id !== id));
      if (selectedAssignment?.id === id) {
        setSelectedAssignment(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete assignment');
    }
  };

  const filteredAssignments = assignments.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.subjectName && a.subjectName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (a.sectionName && a.sectionName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <ProtectedRoute requiredPermission="assignments.read" onNavigateHome={onNavigateHome}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={26} style={{ color: 'var(--brand-primary)' }} /> {t('assignments.title', 'Curriculum Assignments & Homework')}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {t('assignments.subtitle', 'Informational homework tasks, exercises, and study guidelines posted by faculty.')}
            </p>
          </div>

          {canCreate && (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowCreateModal(true)}>
              {t('assignments.create_button', 'Post Homework / Task')}
            </Button>
          )}
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: '1 1 250px', minWidth: '220px' }}>
            <SearchBar
              placeholder="Search tasks by title, subject, or section..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <Badge tone="info">{filteredAssignments.length} Assignments</Badge>
        </div>

        {/* Assignments Grid */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading assignments curriculum...
          </div>
        ) : filteredAssignments.length === 0 ? (
          <EmptyState
            title="No assignments posted yet"
            description="Faculty can post homework assignments, study guides, and laboratory exercises for students to view."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {filteredAssignments.map((item) => (
              <div
                key={item.id}
                className="glass-panel"
                style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge tone="primary">{item.subjectName || 'Academics'}</Badge>
                    {item.sectionName && <Badge tone="neutral">Section {item.sectionName}</Badge>}
                    {item.status === 'draft' && <Badge tone="neutral">Draft</Badge>}
                    {item.status === 'closed' && <Badge tone="danger">Closed</Badge>}
                    {item.status === 'published' && <Badge tone="success">Active</Badge>}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Open'}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.25rem' }}>{item.title}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {item.description || 'No detailed instructions provided.'}
                  </p>
                  {item.instructions && (
                    <div style={{ marginTop: '0.35rem', padding: '0.35rem 0.55rem', fontSize: '0.78rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <strong>Instructions:</strong> {item.instructions.length > 90 ? `${item.instructions.slice(0, 90)}...` : item.instructions}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Award size={13} style={{ color: 'var(--brand-primary)' }} />
                    <span>Max Marks: {item.maxMarks ?? 100}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Eye size={12} />}
                      onClick={() => setSelectedAssignment(item)}
                    >
                      View Details
                    </Button>

                    {canCreate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={13} style={{ color: 'var(--status-danger)' }} />}
                        onClick={() => handleDelete(item.id)}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: View Assignment Details (Informational Reader for Students & Teachers) */}
        <Modal
          isOpen={!!selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          title={selectedAssignment?.title || 'Assignment Details'}
          maxWidth="600px"
        >
          {selectedAssignment && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Meta header */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone="primary">{selectedAssignment.subjectName || 'Academics'}</Badge>
                {selectedAssignment.sectionName && <Badge tone="neutral">Section {selectedAssignment.sectionName}</Badge>}
                <Badge
                  tone={
                    selectedAssignment.status === 'published'
                      ? 'success'
                      : selectedAssignment.status === 'closed'
                      ? 'danger'
                      : 'neutral'
                  }
                >
                  {(selectedAssignment.status || 'published').toUpperCase()}
                </Badge>
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Due Date</div>
                    <div style={{ fontWeight: 600 }}>{selectedAssignment.dueDate ? new Date(selectedAssignment.dueDate).toLocaleDateString() : 'No deadline'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Award size={15} style={{ color: 'var(--brand-primary)' }} />
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Maximum Marks</div>
                    <div style={{ fontWeight: 600 }}>{selectedAssignment.maxMarks ?? 100} Marks</div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedAssignment.description && (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Summary / Overview
                  </h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                    {selectedAssignment.description}
                  </p>
                </div>
              )}

              {/* Instructions */}
              {selectedAssignment.instructions ? (
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Instructions & Homework Guidelines
                  </h4>
                  <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {selectedAssignment.instructions}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No extra rubric guidelines provided. Complete the assigned tasks and bring your coursework to class.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                <Button variant="secondary" onClick={() => setSelectedAssignment(null)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal: Create Assignment */}
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Post New Homework / Assignment">
          <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Assignment Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Chapter 4: Calculus Problem Set"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Target Section *</label>
                <select
                  required
                  value={createSectionId}
                  onChange={(e) => setCreateSectionId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>{sec.className} — {sec.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Subject *</label>
                <select
                  required
                  value={createSubjectId}
                  onChange={(e) => setCreateSubjectId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Due Date</label>
                <input
                  type="date"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Max Marks</label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={createMaxMarks}
                  onChange={(e) => setCreateMaxMarks(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Status</label>
                <select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as any)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft (Hidden)</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Description</label>
              <textarea
                rows={2}
                placeholder="Brief summary of assignment..."
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Instructions / Study Guidelines</label>
              <textarea
                rows={3}
                placeholder="Detailed homework guidelines, textbook exercises, questions to solve..."
                value={createInstructions}
                onChange={(e) => setCreateInstructions(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={saving}>Post Assignment</Button>
            </div>
          </form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
};
