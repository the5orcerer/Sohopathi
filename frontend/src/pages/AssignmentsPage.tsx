import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { useSession } from '../context/SessionContext';
import {
  fetchAssignments,
  createAssignment,
  deleteAssignment,
  submitAssignment,
  fetchSections,
  fetchSubjects,
} from '../services/api';
import type { Assignment, SectionItem, SubjectItem } from '../types';
import { SearchBar, Badge, Button, Modal, EmptyState } from '../components/common';
import {
  Plus,
  Clock,
  Upload,
  BookOpen,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

export const AssignmentsPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { hasPermission } = useSession();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Permissions
  const canCreate = hasPermission('assignments.create') || hasPermission('assignments.write');
  const canSubmit = hasPermission('assignments.submit');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createSectionId, setCreateSectionId] = useState('');
  const [createSubjectId, setCreateSubjectId] = useState('');
  const [saving, setSaving] = useState(false);

  // Submit Modal
  const [submitTargetAssignment, setSubmitTargetAssignment] = useState<Assignment | null>(null);
  const [submitFileKey, setSubmitFileKey] = useState('');
  const [submittingWork, setSubmittingWork] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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
        dueDate: createDueDate || undefined,
      });
      setAssignments([created, ...assignments]);
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateDueDate('');
    } catch (err: any) {
      alert(err.message || 'Failed to create assignment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await deleteAssignment(id);
      setAssignments(assignments.filter((a) => a.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete assignment');
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTargetAssignment) return;
    setSubmittingWork(true);
    try {
      await submitAssignment(submitTargetAssignment.id, { fileKey: submitFileKey.trim() || 'homework_solution.pdf' });
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitTargetAssignment(null);
        setSubmitSuccess(false);
        setSubmitFileKey('');
        loadData();
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to submit assignment');
    } finally {
      setSubmittingWork(false);
    }
  };

  const filteredAssignments = assignments.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.subjectName && a.subjectName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <ProtectedRoute requiredPermission="assignments.read" onNavigateHome={onNavigateHome}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={26} style={{ color: 'var(--brand-primary)' }} /> Curriculum Assignments & Submissions
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Manage homework deliverables, laboratory exercises, student submission queues, and grading rubrics.
            </p>
          </div>

          {canCreate && (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowCreateModal(true)}>
              Create Assignment
            </Button>
          )}
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ flex: '1 1 250px', minWidth: '220px' }}>
            <SearchBar
              placeholder="Search assignments by title or subject..."
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
            description="Create an assignment for a class section to assign homework, quizzes, and laboratory exercises."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {filteredAssignments.map((item) => (
              <div
                key={item.id}
                className="glass-panel"
                style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Badge tone="primary">{item.subjectName || 'Academics'}</Badge>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Open'}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.25rem' }}>{item.title}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {item.description || 'No detailed instructions provided.'}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {item.totalSubmissions !== undefined ? `${item.totalSubmissions} Submissions` : 'Active'}
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {canSubmit && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Upload size={12} />}
                        onClick={() => setSubmitTargetAssignment(item)}
                      >
                        Submit Work
                      </Button>
                    )}

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

        {/* Modal: Create Assignment */}
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Assignment">
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Due Date</label>
                <input
                  type="date"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Instructions / Description</label>
              <textarea
                rows={3}
                placeholder="Details of required problems, formatting guidelines, or lab apparatus..."
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={saving}>Create Assignment</Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Submit Work */}
        <Modal isOpen={!!submitTargetAssignment} onClose={() => setSubmitTargetAssignment(null)} title={`Submit Deliverable — ${submitTargetAssignment?.title}`}>
          <form onSubmit={handleSubmitWork} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {submitSuccess ? (
              <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} /> Assignment deliverable submitted successfully!
              </div>
            ) : (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Upload your completed work or provide file document identifier for submission.
                </p>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Submission File / Link Key</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. assignment_1_abrar.pdf or document URL"
                    value={submitFileKey}
                    onChange={(e) => setSubmitFileKey(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <Button variant="secondary" onClick={() => setSubmitTargetAssignment(null)} disabled={submittingWork}>Cancel</Button>
                  <Button variant="primary" type="submit" loading={submittingWork}>Submit Assignment</Button>
                </div>
              </>
            )}
          </form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
};
