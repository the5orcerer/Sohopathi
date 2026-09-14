import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { useSession } from '../context/SessionContext';
import {
  fetchAssignments,
  createAssignment,
  deleteAssignment,
  submitAssignment,
  reopenAssignmentSubmission,
  fetchAssignmentSubmissions,
  remindPendingAssignmentStudents,
  gradeSubmission,
  fetchSections,
  fetchSubjects,
} from '../services/api';
import type { Assignment, AssignmentSubmissionItem, SectionItem, SubjectItem } from '../types';
import { SearchBar, Badge, Button, Modal, EmptyState } from '../components/common';
import {
  Plus,
  Clock,
  Upload,
  BookOpen,
  Trash2,
  CheckCircle2,
  Bell,
  Eye,
  FileText,
  Image as ImageIcon,
  Check,
  AlertCircle,
  ExternalLink,
  Lock,
  RotateCcw,
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
  const canViewSubmissions = canCreate || hasPermission('assignments.read') || hasPermission('assignments.submission.read');
  const canGrade = hasPermission('assignments.grade') || canCreate;
  const canReopen = hasPermission('assignments.submission.reopen') || canCreate;

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createInstructions, setCreateInstructions] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createMaxMarks, setCreateMaxMarks] = useState('100');
  const [createStatus, setCreateStatus] = useState<'draft' | 'published' | 'closed'>('published');
  const [createAllowLateSubmissions, setCreateAllowLateSubmissions] = useState(true);
  const [createSectionId, setCreateSectionId] = useState('');
  const [createSubjectId, setCreateSubjectId] = useState('');
  const [saving, setSaving] = useState(false);

  // Student Submit Work Modal
  const [submitTargetAssignment, setSubmitTargetAssignment] = useState<Assignment | null>(null);
  const [submitFile, setSubmitFile] = useState<File | null>(null);
  const [submitFileKey, setSubmitFileKey] = useState('');
  const [submitFileUrl, setSubmitFileUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [submittingWork, setSubmittingWork] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Submissions Modal for Teachers
  const [viewAssignment, setViewAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmissionItem[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);
  const [gradingState, setGradingState] = useState<{ [id: string]: { grade: string; marksObtained?: string | number; feedback: string; saving?: boolean; success?: boolean } }>({});

  // Reopen Submission Modal
  const [reopenTargetSubmission, setReopenTargetSubmission] = useState<AssignmentSubmissionItem | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);

  // Remind Pending Students State
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindFeedback, setRemindFeedback] = useState<{ assignmentId: string; message: string; count: number } | null>(null);

  // Photo / Document Lightbox Modal
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

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
        allowLateSubmissions: createAllowLateSubmissions,
      });
      setAssignments([created, ...assignments]);
      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateInstructions('');
      setCreateDueDate('');
      setCreateMaxMarks('100');
      setCreateStatus('published');
      setCreateAllowLateSubmissions(true);
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSubmitFile(file);
      if (!submitFileKey) setSubmitFileKey(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setSubmitFileUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTargetAssignment) return;
    setSubmittingWork(true);
    try {
      await submitAssignment(submitTargetAssignment.id, {
        fileKey: submitFileKey.trim() || submitFile?.name || 'homework_solution.pdf',
        fileUrl: submitFileUrl.trim() || undefined,
        fileName: submitFile?.name || (submitFileKey.trim() ? submitFileKey.trim() : undefined),
        fileSize: submitFile?.size,
        mimeType: submitFile?.type,
        submissionNotes: submitNotes.trim() || undefined,
      });
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitTargetAssignment(null);
        setSubmitSuccess(false);
        setSubmitFile(null);
        setSubmitFileKey('');
        setSubmitFileUrl('');
        setSubmitNotes('');
        loadData();
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to submit assignment');
    } finally {
      setSubmittingWork(false);
    }
  };

  const handleOpenSubmissions = async (assignment: Assignment) => {
    setViewAssignment(assignment);
    setLoadingSubmissions(true);
    try {
      const subs = await fetchAssignmentSubmissions(assignment.id);
      setSubmissions(subs);
      const initialGrading: typeof gradingState = {};
      subs.forEach((s) => {
        initialGrading[s.id] = {
          grade: s.grade || '',
          marksObtained: s.marksObtained !== null && s.marksObtained !== undefined ? String(s.marksObtained) : '',
          feedback: s.feedback || '',
        };
      });
      setGradingState(initialGrading);
    } catch (err: any) {
      console.error('Failed to load submissions:', err);
      alert(err.message || 'Failed to load submissions');
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleGradeSubmission = async (submissionId: string) => {
    const state = gradingState[submissionId];
    if (!state || !state.grade) return;
    setGradingState((prev) => ({
      ...prev,
      [submissionId]: { ...prev[submissionId], saving: true },
    }));

    try {
      const marksNum = state.marksObtained !== undefined && state.marksObtained !== '' ? Number(state.marksObtained) : undefined;
      await gradeSubmission(submissionId, {
        grade: state.grade.trim(),
        marksObtained: marksNum,
        feedback: state.feedback.trim() || undefined,
      });
      setGradingState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: false, success: true },
      }));
      setTimeout(() => {
        setGradingState((prev) => ({
          ...prev,
          [submissionId]: { ...prev[submissionId], success: false },
        }));
      }, 2000);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === submissionId ? { ...s, grade: state.grade, marksObtained: marksNum, feedback: state.feedback, status: 'marked' } : s
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to record grade');
      setGradingState((prev) => ({
        ...prev,
        [submissionId]: { ...prev[submissionId], saving: false },
      }));
    }
  };

  const handleReopenSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewAssignment || !reopenTargetSubmission || !reopenReason.trim()) return;
    setReopening(true);
    try {
      await reopenAssignmentSubmission(viewAssignment.id, reopenTargetSubmission.id, reopenReason.trim());
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === reopenTargetSubmission.id
            ? { ...s, status: 'reopened', reopenReason: reopenReason.trim(), reopenedAt: new Date().toISOString() }
            : s
        )
      );
      setReopenTargetSubmission(null);
      setReopenReason('');
      alert('Submission successfully reopened for the student.');
    } catch (err: any) {
      alert(err.message || 'Failed to reopen submission');
    } finally {
      setReopening(false);
    }
  };

  const handleRemindPending = async (assignmentId: string) => {
    setRemindingId(assignmentId);
    try {
      const res = await remindPendingAssignmentStudents(assignmentId);
      setRemindFeedback({
        assignmentId,
        message: res.message,
        count: res.notifiedCount,
      });
      setTimeout(() => setRemindFeedback(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch reminder tasks');
    } finally {
      setRemindingId(null);
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
              <BookOpen size={26} style={{ color: 'var(--brand-primary)' }} /> Curriculum Assignments & Homework
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Manage homework deliverables, handwritten photo submissions, grading rubrics, and automated pending reminders.
            </p>
          </div>

          {canCreate && (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowCreateModal(true)}>
              Create Assignment
            </Button>
          )}
        </div>

        {/* Remind Feedback Alert */}
        {remindFeedback && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid var(--status-success)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--status-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.88rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} />
              <span>{remindFeedback.message}</span>
            </div>
            <Badge tone="success">{remindFeedback.count} Reminders Dispatched</Badge>
          </div>
        )}

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {filteredAssignments.map((item) => {
              const isLocked = item.submissionStatus === 'submitted' || item.submissionStatus === 'marked';
              const isReopened = item.submissionStatus === 'reopened';
              return (
                <div
                  key={item.id}
                  className="glass-panel"
                  style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge tone="primary">{item.subjectName || 'Academics'}</Badge>
                      {item.status === 'draft' && <Badge tone="neutral">Draft</Badge>}
                      {item.status === 'closed' && <Badge tone="danger">Closed</Badge>}
                      {item.status === 'published' && <Badge tone="success">Published</Badge>}
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
                        <strong>Instructions:</strong> {item.instructions}
                      </div>
                    )}
                  </div>

                  {/* Student Submission Status Badge / Reopen Note */}
                  {item.submissionStatus && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {isLocked && (
                          <Badge tone={item.submissionStatus === 'marked' ? 'success' : 'info'}>
                            <Lock size={11} style={{ marginRight: '0.25rem' }} />
                            {item.submissionStatus === 'marked'
                              ? `Marked (${item.marksObtained ?? '-'} / ${item.maxMarks ?? 100})`
                              : 'Submitted (Locked)'}
                          </Badge>
                        )}
                        {isReopened && (
                          <Badge tone="warning">
                            <RotateCcw size={11} style={{ marginRight: '0.25rem' }} /> Reopened for Revision
                          </Badge>
                        )}
                        {item.isLate && <Badge tone="danger">Late</Badge>}
                      </div>
                      {isReopened && item.reopenReason && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--status-warning)', background: 'rgba(245, 158, 11, 0.08)', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-xs)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          <strong>Teacher Note:</strong> {item.reopenReason}
                        </div>
                      )}
                    </div>
                  )}

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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Max Marks: {item.maxMarks ?? 100}</span>
                      {item.allowLateSubmissions === false && (
                        <span style={{ marginLeft: '0.4rem', color: 'var(--status-danger)' }}>• No late turn-in</span>
                      )}
                      {item.totalSubmissions !== undefined && (
                        <span style={{ marginLeft: '0.4rem' }}>• {item.totalSubmissions} Submissions</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      {canSubmit && (
                        <Button
                          variant={isReopened ? 'primary' : isLocked ? 'secondary' : 'primary'}
                          size="sm"
                          icon={isLocked ? <Lock size={12} /> : isReopened ? <RotateCcw size={12} /> : <Upload size={12} />}
                          onClick={() => setSubmitTargetAssignment(item)}
                        >
                          {isLocked ? 'View Submission' : isReopened ? 'Resubmit' : 'Submit'}
                        </Button>
                      )}

                      {canViewSubmissions && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye size={12} />}
                          onClick={() => handleOpenSubmissions(item)}
                        >
                          Submissions
                        </Button>
                      )}

                      {canCreate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Dispatch reminders and tasks to pending students"
                          icon={<Bell size={12} style={{ color: 'var(--brand-primary)' }} />}
                          loading={remindingId === item.id}
                          onClick={() => handleRemindPending(item.id)}
                        >
                          Remind
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
              );
            })}
          </div>
        )}

        {/* Modal: Create Assignment */}
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
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Instructions / Rubric Guidelines</label>
              <textarea
                rows={3}
                placeholder="Detailed instructions, formatting requirements, lab apparatus, or rubric criteria..."
                value={createInstructions}
                onChange={(e) => setCreateInstructions(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="allowLateCheck"
                checked={createAllowLateSubmissions}
                onChange={(e) => setCreateAllowLateSubmissions(e.target.checked)}
              />
              <label htmlFor="allowLateCheck" style={{ fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                Allow late turn-in after due date (marked as Late)
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit" loading={saving}>Create Assignment</Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Submit Work (Student) */}
        <Modal
          isOpen={!!submitTargetAssignment}
          onClose={() => setSubmitTargetAssignment(null)}
          title={`Submit Deliverable — ${submitTargetAssignment?.title}`}
        >
          {(() => {
            const isLocked =
              submitTargetAssignment &&
              (submitTargetAssignment.submissionStatus === 'submitted' || submitTargetAssignment.submissionStatus === 'marked');
            const isReopened = submitTargetAssignment && submitTargetAssignment.submissionStatus === 'reopened';

            return (
              <form onSubmit={handleSubmitWork} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {submitSuccess ? (
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CheckCircle2 size={16} /> Assignment deliverable and homework photos submitted successfully!
                  </div>
                ) : isLocked ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ padding: '0.85rem', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--status-danger)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                      <Lock size={18} style={{ color: 'var(--status-danger)', marginTop: '0.15rem', flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: 'var(--status-danger)', fontSize: '0.9rem' }}>Submission Locked</strong>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                          You have already submitted this assignment. Submissions are strictly locked against unauthorized overwrites. If you need to revise or re-upload your deliverable, contact your instructor to request reopening.
                        </p>
                      </div>
                    </div>

                    {submitTargetAssignment?.marksObtained !== null && submitTargetAssignment?.marksObtained !== undefined && (
                      <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid var(--status-success)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                        <strong>Grade Received:</strong> {submitTargetAssignment.grade || 'Marked'} ({submitTargetAssignment.marksObtained} / {submitTargetAssignment.maxMarks ?? 100} marks)
                        {submitTargetAssignment.feedback && (
                          <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <strong>Feedback:</strong> {submitTargetAssignment.feedback}
                          </div>
                        )}
                      </div>
                    )}

                    {submitTargetAssignment?.submissionNotes && (
                      <div style={{ fontSize: '0.82rem', background: 'var(--surface-sunken)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <strong>Your Submitted Notes:</strong> {submitTargetAssignment.submissionNotes}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <Button variant="secondary" onClick={() => setSubmitTargetAssignment(null)}>Close</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {isReopened && (
                      <div style={{ padding: '0.85rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid var(--status-warning)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                        <RotateCcw size={18} style={{ color: 'var(--status-warning)', marginTop: '0.15rem', flexShrink: 0 }} />
                        <div>
                          <strong style={{ color: 'var(--status-warning)', fontSize: '0.9rem' }}>Submission Reopened for Revision</strong>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
                            <strong>Instructor Note:</strong> {submitTargetAssignment?.reopenReason || 'Your teacher has reopened this submission so you can revise and resubmit.'}
                          </p>
                        </div>
                      </div>
                    )}

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Upload a photo of your handwritten homework, attach a document file, or provide notes for your teacher.
                    </p>

                    {/* Photo / File Upload */}
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                        <ImageIcon size={14} style={{ color: 'var(--brand-primary)' }} /> Handwritten Homework Photo / Document
                      </label>
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handlePhotoUpload}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}
                      />
                    </div>

                    {/* Photo Preview if loaded */}
                    {submitFileUrl && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Homework Photo Preview:</span>
                        <div style={{ position: 'relative', width: '100%', maxHeight: '160px', overflow: 'hidden', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: '#000' }}>
                          <img
                            src={submitFileUrl}
                            alt="Homework preview"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>File Identifier or Document Link</label>
                      <input
                        type="text"
                        placeholder="e.g. math_hw_ch4.jpg or Google Drive / OneDrive URL"
                        value={submitFileKey}
                        onChange={(e) => setSubmitFileKey(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Submission Notes / Remarks</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Solved exercises 1-12. Question 7 attempted with second method."
                        value={submitNotes}
                        onChange={(e) => setSubmitNotes(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <Button variant="secondary" onClick={() => setSubmitTargetAssignment(null)} disabled={submittingWork}>Cancel</Button>
                      <Button variant="primary" type="submit" loading={submittingWork}>
                        {isReopened ? 'Resubmit Deliverable' : 'Submit Assignment'}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            );
          })()}
        </Modal>

        {/* Modal: Teacher View Submissions & Grading */}
        <Modal
          isOpen={!!viewAssignment}
          onClose={() => setViewAssignment(null)}
          title={`Submissions — ${viewAssignment?.title || ''}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '600px', maxWidth: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Section: <strong>{viewAssignment?.sectionName || 'Assigned Section'}</strong> | Max Marks: <strong>{viewAssignment?.maxMarks ?? 100}</strong> | Total Submissions: <strong>{submissions.length}</strong>
              </div>

              {canCreate && viewAssignment && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Bell size={13} style={{ color: 'var(--brand-primary)' }} />}
                  loading={remindingId === viewAssignment.id}
                  onClick={() => handleRemindPending(viewAssignment.id)}
                >
                  Remind Pending Students
                </Button>
              )}
            </div>

            {loadingSubmissions ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading student submissions...
              </div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <AlertCircle size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p>No student submissions received yet for this assignment.</p>
                <div style={{ marginTop: '0.75rem' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Bell size={12} />}
                    onClick={() => viewAssignment && handleRemindPending(viewAssignment.id)}
                  >
                    Send Reminder to Enrolled Students
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '60vh', overflowY: 'auto' }}>
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      padding: '0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-sunken)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                          {sub.studentName || 'Student'} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roll #{sub.rollNumber || 'N/A'} (Adm: {sub.admissionNo || 'N/A'})</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Submitted on {new Date(sub.submittedAt).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {sub.status === 'reopened' ? (
                          <Badge tone="warning">
                            <RotateCcw size={10} style={{ marginRight: '0.2rem' }} /> Reopened
                          </Badge>
                        ) : sub.status === 'marked' || sub.status === 'graded' ? (
                          <Badge tone="success">
                            <CheckCircle2 size={10} style={{ marginRight: '0.2rem' }} /> Marked ({sub.marksObtained ?? '-'} / {viewAssignment?.maxMarks ?? 100})
                          </Badge>
                        ) : (
                          <Badge tone="primary">
                            <Lock size={10} style={{ marginRight: '0.2rem' }} /> Submitted (Locked)
                          </Badge>
                        )}
                        {sub.isLate && <Badge tone="danger">Late</Badge>}
                      </div>
                    </div>

                    {/* Submission notes */}
                    {sub.submissionNotes && (
                      <div style={{ fontSize: '0.8rem', background: 'var(--surface-base)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Notes: </strong>{sub.submissionNotes}
                      </div>
                    )}

                    {/* Reopened Note */}
                    {sub.reopenReason && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--status-warning)', background: 'rgba(245, 158, 11, 0.08)', padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-xs)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <strong>Reopened Reason:</strong> {sub.reopenReason} {sub.reopenedAt && `(${new Date(sub.reopenedAt).toLocaleDateString()})`}
                      </div>
                    )}

                    {/* Homework Photo / Attachment */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {sub.fileUrl ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {sub.fileUrl.startsWith('data:image') || sub.fileUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                            <div
                              onClick={() => setPreviewPhoto({ url: sub.fileUrl!, title: `${sub.studentName || 'Student'} Homework` })}
                              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 'var(--radius-xs)', color: 'var(--brand-primary)', fontSize: '0.78rem' }}
                            >
                              <ImageIcon size={14} /> View Homework Photo
                            </div>
                          ) : (
                            <a
                              href={sub.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--brand-primary)', fontSize: '0.78rem', textDecoration: 'none' }}
                            >
                              <ExternalLink size={14} /> Open Document File
                            </a>
                          )}
                        </div>
                      ) : sub.fileName || sub.fileKey ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <FileText size={13} /> {sub.fileName || sub.fileKey} {sub.fileSize ? `(${(sub.fileSize / 1024).toFixed(1)} KB)` : ''}
                        </span>
                      ) : null}
                    </div>

                    {/* Teacher Actions & Grading */}
                    <div style={{ marginTop: '0.25rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border-subtle)', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      {canGrade && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                          <div style={{ width: '85px' }}>
                            <input
                              type="number"
                              placeholder={`Marks (/${viewAssignment?.maxMarks || 100})`}
                              value={gradingState[sub.id]?.marksObtained ?? ''}
                              onChange={(e) =>
                                setGradingState((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...prev[sub.id], marksObtained: e.target.value },
                                }))
                              }
                              style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.8rem', borderRadius: 'var(--radius-xs)', background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                          </div>
                          <div style={{ width: '85px' }}>
                            <input
                              type="text"
                              placeholder="Grade (A+)"
                              value={gradingState[sub.id]?.grade ?? ''}
                              onChange={(e) =>
                                setGradingState((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...prev[sub.id], grade: e.target.value },
                                }))
                              }
                              style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.8rem', borderRadius: 'var(--radius-xs)', background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            <input
                              type="text"
                              placeholder="Teacher feedback..."
                              value={gradingState[sub.id]?.feedback ?? ''}
                              onChange={(e) =>
                                setGradingState((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...prev[sub.id], feedback: e.target.value },
                                }))
                              }
                              style={{ width: '100%', padding: '0.3rem 0.5rem', fontSize: '0.8rem', borderRadius: 'var(--radius-xs)', background: 'var(--surface-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={gradingState[sub.id]?.success ? <Check size={12} /> : undefined}
                            loading={gradingState[sub.id]?.saving}
                            onClick={() => handleGradeSubmission(sub.id)}
                          >
                            {gradingState[sub.id]?.success ? 'Saved' : 'Grade'}
                          </Button>
                        </div>
                      )}

                      {canReopen && sub.status !== 'reopened' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<RotateCcw size={12} />}
                          onClick={() => {
                            setReopenTargetSubmission(sub);
                            setReopenReason('');
                          }}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setViewAssignment(null)}>Close</Button>
            </div>
          </div>
        </Modal>

        {/* Modal: Reopen Submission (Teacher Reason Prompt) */}
        <Modal
          isOpen={!!reopenTargetSubmission}
          onClose={() => setReopenTargetSubmission(null)}
          title={`Reopen Submission — ${reopenTargetSubmission?.studentName || 'Student'}`}
        >
          <form onSubmit={handleReopenSubmission} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Reopening this submission unlocks it for the student, allowing them to revise or upload new homework deliverables. A reason is required and will be logged in the audit trail.
            </p>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Reason for Reopening *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Please re-upload page 2 of your handwritten solutions with clear lighting."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setReopenTargetSubmission(null)} disabled={reopening}>Cancel</Button>
              <Button variant="primary" type="submit" loading={reopening} icon={<RotateCcw size={13} />}>
                Confirm Reopen
              </Button>
            </div>
          </form>
        </Modal>

        {/* Lightbox / Modal: Photo Preview */}
        <Modal
          isOpen={!!previewPhoto}
          onClose={() => setPreviewPhoto(null)}
          title={previewPhoto?.title || 'Homework Submission Photo'}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            {previewPhoto && (
              <div style={{ maxWidth: '100%', maxHeight: '70vh', overflow: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: '#111' }}>
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.title}
                  style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto', objectFit: 'contain' }}
                />
              </div>
            )}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setPreviewPhoto(null)}>Close Preview</Button>
            </div>
          </div>
        </Modal>
      </div>
    </ProtectedRoute>
  );
};
