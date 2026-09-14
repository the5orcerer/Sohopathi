import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { useSession } from '../context/SessionContext';
import {
  fetchExams,
  createExam,
  fetchExamPapers,
  createExamPaper,
  deleteExamPaper,
  fetchAcademicYears,
  fetchSections,
  fetchSubjects,
  fetchStudents,
  fetchMarks,
  recordMarks,
  fetchExamRooms,
  createExamRoom,
  deleteExamRoom,
  fetchExamProgress,
  notifyPendingExamTeachers,
  publishExam,
  fetchMembers,
  fetchClasses,
} from '../services/api';
import type {
  ExamItem,
  ExamPaperItem,
  ExamRoomItem,
  ExamProgressData,
  AcademicYear,
  ClassItem,
  SectionItem,
  SubjectItem,
  StudentItem,
  MarkItem,
  Member,
} from '../types';
import { Button, Badge, Modal, EmptyState } from '../components/common';
import {
  Award,
  Plus,
  Calendar,
  Trash2,
  Save,
  CheckCircle2,
  FileText,
  GraduationCap,
  Loader2,
  Bell,
  Users,
  Building,
  CheckCircle,
  AlertTriangle,
  Printer,
} from 'lucide-react';

export const ExaminationsPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { activeMembership, user } = useSession();
  
  // Role detection
  const role = activeMembership?.roleName?.toLowerCase() || '';
  const isStudent = role.includes('student');
  const isTeacher = role.includes('teacher') || role.includes('faculty');
  const isAdmin = role.includes('admin') || role.includes('coordinator') || role.includes('principal');
  
  // Permissions
  const canManage = isAdmin || isTeacher;

  const [activeTab, setActiveTab] = useState<'sessions' | 'rooms' | 'scoring' | 'progress' | 'report'>('sessions');

  // Academic dependencies
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // Selected for Papers & Scoring & Tracking
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [examPapers, setExamPapers] = useState<ExamPaperItem[]>([]);

  // Rooms & Seating State
  const [rooms, setRooms] = useState<ExamRoomItem[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState<boolean>(false);
  const [roomForm, setRoomForm] = useState({
    roomNumber: '',
    capacity: 40,
    rollRangeStart: 1,
    rollRangeEnd: 30,
    guardMembershipIds: [] as string[],
    remarks: '',
  });

  // Progress & Missing Marks Tracker State
  const [progressData, setProgressData] = useState<ExamProgressData | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [notifyingTeachers, setNotifyingTeachers] = useState<boolean>(false);
  const [notifyFeedback, setNotifyFeedback] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishFeedback, setPublishFeedback] = useState<string | null>(null);

  // Scoring Sheet State
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [marksSheet, setMarksSheet] = useState<Record<string, { marksObtained: number | string; maxMarks: number; grade: string; remarks?: string }>>({});
  const [savingMarks, setSavingMarks] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // ✅ Student Result State
  const [ownStudentId, setOwnStudentId] = useState<string | null>(null);
  const [ownMarks, setOwnMarks] = useState<MarkItem[]>([]);
  const [loadingResult, setLoadingResult] = useState<boolean>(false);

  // Modals
  const [showCreateExamModal, setShowCreateExamModal] = useState<boolean>(false);
  const [showAddPaperModal, setShowAddPaperModal] = useState<boolean>(false);
  const [examForm, setExamForm] = useState({
    academicYearId: '',
    name: '',
    term: '',
    startDate: '',
    endDate: '',
    examType: 'term' as 'term' | 'class_test',
    examControllerMembershipId: '',
    classId: '',
    sectionId: '',
    syllabusRemarks: '',
  });
  const [paperForm, setPaperForm] = useState({
    subjectId: '',
    teacherMembershipId: '',
    syllabus: '',
    examDate: '',
    startTime: '09:00',
    endTime: '12:00',
    roomNo: '',
    maxMarks: 100,
    passMarks: 40,
    theoryWeight: 70,
    practicalWeight: 30,
    vivaWeight: 0,
  });

  const loadDependencies = async () => {
    try {
      const [ay, cls, sec, sub, ex, mem] = await Promise.all([
        fetchAcademicYears(),
        fetchClasses(),
        fetchSections(),
        fetchSubjects(),
        fetchExams(),
        fetchMembers(),
      ]);
      setAcademicYears(ay);
      setClasses(cls);
      setSections(sec);
      setSubjects(sub);
      setExams(ex);
      setMembers(mem);
      if (ay.length > 0) setExamForm((prev) => ({ ...prev, academicYearId: ay[0].id }));
      if (ex.length > 0 && !selectedExamId) setSelectedExamId(ex[0].id);
    } catch (err) {
      console.error('Failed to load exam data:', err);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchExamPapers(selectedExamId).then(setExamPapers).catch(console.error);
    } else {
      setExamPapers([]);
    }
  }, [selectedExamId]);

  // ✅ Student-এর নিজের ID বের করা
  useEffect(() => {
    if (isStudent) {
      fetchStudents()
        .then((allStudents) => {
          const ownStudent = allStudents.find(s => s.userId === user?.id);
          if (ownStudent) {
            setOwnStudentId(ownStudent.id);
          }
        })
        .catch(console.error);
    }
  }, [isStudent, user]);

  // ✅ Student-এর নিজের Marks load করা
  useEffect(() => {
    if (isStudent && ownStudentId && selectedExamId) {
      setLoadingResult(true);
      fetchMarks({ examId: selectedExamId, studentId: ownStudentId })
        .then((marksData) => {
          setOwnMarks(marksData);
        })
        .catch(console.error)
        .finally(() => setLoadingResult(false));
    }
  }, [isStudent, ownStudentId, selectedExamId]);

  // Load Scoring Sheet when Exam + Section + Subject selected
  useEffect(() => {
    if (activeTab === 'scoring' && selectedSectionId && selectedSubjectId && selectedExamId) {
      Promise.all([
        fetchStudents({ sectionId: selectedSectionId }),
        fetchMarks({ examId: selectedExamId, subjectId: selectedSubjectId }),
      ]).then(([stList, marksList]) => {
        setStudents(stList);
        const sheetMap: Record<string, { marksObtained: number | string; maxMarks: number; grade: string }> = {};
        const marksLookup = new Map(marksList.map((m) => [m.studentId, m]));

        stList.forEach((st) => {
          const existing = marksLookup.get(st.id);
          sheetMap[st.id] = {
            marksObtained: existing?.marksObtained ?? '',
            maxMarks: existing?.maxMarks ?? 100,
            grade: existing?.grade ?? '',
          };
        });
        setMarksSheet(sheetMap);
      }).catch(console.error);
    }
  }, [activeTab, selectedSectionId, selectedSubjectId, selectedExamId]);

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await createExam(examForm);
      setExams([created, ...exams]);
      setSelectedExamId(created.id);
      setShowCreateExamModal(false);
      setExamForm({
        academicYearId: academicYears[0]?.id || '',
        name: '',
        term: '',
        startDate: '',
        endDate: '',
        examType: 'term',
        examControllerMembershipId: '',
        classId: '',
        sectionId: '',
        syllabusRemarks: '',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to create exam');
    }
  };

  const handleCreatePaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;
    try {
      const paper = await createExamPaper(selectedExamId, paperForm);
      setExamPapers([...examPapers.filter((p) => p.subjectId !== paper.subjectId), paper]);
      setShowAddPaperModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add exam paper');
    }
  };

  const handleDeletePaper = async (paperId: string) => {
    if (!confirm('Are you sure you want to remove this paper schedule?')) return;
    try {
      await deleteExamPaper(selectedExamId, paperId);
      setExamPapers(examPapers.filter((p) => p.id !== paperId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete paper');
    }
  };

  // Load Exam Rooms
  const loadRooms = async (examId: string) => {
    if (!examId) return;
    try {
      setLoadingRooms(true);
      const data = await fetchExamRooms(examId);
      setRooms(data);
    } catch (err) {
      console.error('Failed to load exam rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (selectedExamId && activeTab === 'rooms') {
      loadRooms(selectedExamId);
    }
  }, [selectedExamId, activeTab]);

  // Load Exam Progress
  const loadProgress = async (examId: string) => {
    if (!examId) return;
    try {
      setLoadingProgress(true);
      const data = await fetchExamProgress(examId);
      setProgressData(data);
    } catch (err) {
      console.error('Failed to load exam progress:', err);
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    if (selectedExamId && activeTab === 'progress') {
      loadProgress(selectedExamId);
    }
  }, [selectedExamId, activeTab]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;
    try {
      await createExamRoom(selectedExamId, {
        roomNumber: roomForm.roomNumber,
        capacity: Number(roomForm.capacity),
        rollRangeStart: Number(roomForm.rollRangeStart),
        rollRangeEnd: Number(roomForm.rollRangeEnd),
        guardMembershipIds: roomForm.guardMembershipIds,
        remarks: roomForm.remarks,
      });
      setShowAddRoomModal(false);
      setRoomForm({ roomNumber: '', capacity: 40, rollRangeStart: 1, rollRangeEnd: 30, guardMembershipIds: [], remarks: '' });
      loadRooms(selectedExamId);
    } catch (err: any) {
      alert(err.message || 'Failed to create room assignment');
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!selectedExamId) return;
    if (confirm('Remove this room allocation?')) {
      try {
        await deleteExamRoom(selectedExamId, roomId);
        loadRooms(selectedExamId);
      } catch (err: any) {
        alert(err.message || 'Failed to delete room assignment');
      }
    }
  };

  const handleNotifyPendingTeachers = async () => {
    if (!selectedExamId) return;
    try {
      setNotifyingTeachers(true);
      setNotifyFeedback(null);
      const res = await notifyPendingExamTeachers(selectedExamId);
      setNotifyFeedback(res.message);
      setTimeout(() => setNotifyFeedback(null), 6000);
      loadProgress(selectedExamId);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch teacher notifications');
    } finally {
      setNotifyingTeachers(false);
    }
  };

  const handlePublishExam = async () => {
    if (!selectedExamId) return;
    if (confirm('Publish exam results? Once published, marks are locked against modifications by regular teachers, and student notifications are dispatched.')) {
      try {
        setPublishing(true);
        setPublishFeedback(null);
        const res = await publishExam(selectedExamId);
        setPublishFeedback(res.message);
        setTimeout(() => setPublishFeedback(null), 6000);
        setExams((prev) => prev.map((e) => (e.id === selectedExamId ? { ...e, isPublished: true } : e)));
        loadProgress(selectedExamId);
      } catch (err: any) {
        alert(err.message || 'Failed to publish exam');
      } finally {
        setPublishing(false);
      }
    }
  };

  const handleSaveMarks = async () => {
    if (!selectedExamId || !selectedSubjectId) return;
    try {
      setSavingMarks(true);
      setSaveSuccess(false);

      const payload = Object.entries(marksSheet)
        .filter(([_, data]) => data.marksObtained !== '' && data.marksObtained !== undefined)
        .map(([studentId, data]) => ({
          examId: selectedExamId,
          subjectId: selectedSubjectId,
          studentId,
          marksObtained: Number(data.marksObtained),
          maxMarks: data.maxMarks,
          grade: data.grade || undefined,
          remarks: data.remarks || undefined,
        }));

      if (payload.length === 0) {
        alert('Please enter marks for at least one student before saving.');
        setSavingMarks(false);
        return;
      }

      await recordMarks(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to record marks');
    } finally {
      setSavingMarks(false);
    }
  };

  // ✅ Student View - Exam Sessions + Result & Report Card
  if (isStudent) {
    const selectedExam = exams.find(e => e.id === selectedExamId);

    return (
      <ProtectedRoute requiredPermission="marks.read" onNavigateHome={onNavigateHome}>
        <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GraduationCap size={26} style={{ color: 'var(--brand-primary)' }} />
                My Examinations & Results
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                View exam schedules, your results and academic performance.
              </p>
            </div>
            <Badge tone="primary">Student View</Badge>
          </div>

          {/* Exam Sessions List - Student View */}
          <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} style={{ color: 'var(--brand-primary)' }} />
                Exam Sessions ({exams.length})
              </h3>
              <Badge tone="info">View Only</Badge>
            </div>

            {exams.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                No exam sessions available.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                {exams.map((ex) => {
                  const isSelected = selectedExamId === ex.id;
                  const papers = examPapers.filter(p => p.examId === ex.id);
                  
                  return (
                    <div
                      key={ex.id}
                      onClick={() => setSelectedExamId(ex.id)}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        background: isSelected ? 'var(--brand-primary)' : 'var(--surface-sunken)',
                        color: isSelected ? '#fff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-subtle)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{ex.name}</div>
                          <div style={{ fontSize: '0.75rem', opacity: isSelected ? 0.9 : 0.7, marginTop: '0.15rem' }}>
                            {ex.term || 'General Assessment'} 
                          </div>
                        </div>
                        <Badge tone={isSelected ? 'success' : 'neutral'} style={{ fontSize: '0.6rem' }}>
                          {papers.length} Papers
                        </Badge>
                      </div>
                      <div style={{ fontSize: '0.7rem', marginTop: '0.3rem', opacity: isSelected ? 0.85 : 0.6 }}>
                        {ex.academicYearLabel || 'Current Year'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Exam Papers / Schedule - Student View */}
          {selectedExam && (
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem', borderColor: 'var(--brand-primary)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--brand-primary)' }} />
                {selectedExam.name} - Paper Schedule
              </h3>

              {examPapers.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                  No papers scheduled for this exam yet.
                </p>
              ) : (
                <div className="table-responsive">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Subject</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Time</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Room</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Max Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {examPapers.map((paper) => (
                        <tr key={paper.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{paper.subjectName}</td>
                          <td style={{ padding: '0.5rem' }}>
                            {paper.examDate ? new Date(paper.examDate).toLocaleDateString() : 'TBD'}
                          </td>
                          <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                            {paper.startTime || '09:00'} - {paper.endTime || '12:00'}
                          </td>
                          <td style={{ padding: '0.5rem' }}>{paper.roomNo || 'Hall'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}>
                            {paper.maxMarks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Result Summary Card */}
          {loadingResult ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)' }}>Loading your results...</p>
            </div>
          ) : selectedExam && ownMarks.length > 0 ? (
            <div className="glass-panel" style={{ padding: '1.5rem', borderColor: '#10b981' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={20} style={{ color: '#10b981' }} />
                {selectedExam.name} - Your Result Summary
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Subjects</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{ownMarks.length}</div>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center', borderColor: '#10b981' }}>
                  <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Total Marks</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                    {ownMarks.reduce((sum, m) => sum + (m.marksObtained || 0), 0)}
                  </div>
                </div>
                <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center', borderColor: 'var(--brand-primary)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}>Average</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-primary)' }}>
                    {Math.round(ownMarks.reduce((sum, m) => sum + (m.marksObtained || 0), 0) / ownMarks.length)}
                  </div>
                </div>
              </div>

              {/* Report Card Table */}
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Subject</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Marks Obtained</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Max Marks</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Grade</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ownMarks.map((mark, index) => {
                      const isPassed = (mark.marksObtained || 0) >= (mark.maxMarks * 0.4);
                      return (
                        <tr key={index} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{mark.subjectName || 'Subject'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}>
                            {mark.marksObtained ?? '-'}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>{mark.maxMarks}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <Badge tone="neutral">{mark.grade || 'N/A'}</Badge>
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <Badge tone={isPassed ? 'success' : 'danger'}>
                              {isPassed ? 'PASS' : 'FAIL'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : selectedExam && ownMarks.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileText size={40} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>No Results Available</h4>
              <p style={{ fontSize: '0.85rem' }}>Your results for {selectedExam.name} have not been published yet.</p>
            </div>
          ) : null}
        </div>
      </ProtectedRoute>
    );
  }

  // ✅ Admin/Teacher Full View
  return (
    <ProtectedRoute requiredPermission="marks.read" onNavigateHome={onNavigateHome}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={24} style={{ color: 'var(--brand-primary)' }} /> Examination & Assessment Control
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Configure examination schedules, paper mark distributions, and grade tabulation sheets.
            </p>
          </div>

          {canManage && (
            <Button variant="primary" onClick={() => setShowCreateExamModal(true)}>
              <Plus size={15} style={{ marginRight: '0.3rem' }} />
              Create Exam Session
            </Button>
          )}
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('sessions')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'sessions' ? 'var(--brand-primary)' : 'transparent',
              color: activeTab === 'sessions' ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Calendar size={15} /> Exam Sessions & Papers
          </button>

          {canManage && (
            <>
              <button
                onClick={() => setActiveTab('rooms')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: activeTab === 'rooms' ? 'var(--brand-primary)' : 'transparent',
                  color: activeTab === 'rooms' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Building size={15} /> Room & Seating
              </button>

              <button
                onClick={() => setActiveTab('scoring')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: activeTab === 'scoring' ? 'var(--brand-primary)' : 'transparent',
                  color: activeTab === 'scoring' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <FileText size={15} /> Marks Entry Sheet
              </button>

              <button
                onClick={() => setActiveTab('progress')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: activeTab === 'progress' ? 'var(--brand-primary)' : 'transparent',
                  color: activeTab === 'progress' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <AlertTriangle size={15} /> Missing Marks & Tracking
              </button>

              <button
                onClick={() => setActiveTab('report')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: activeTab === 'report' ? 'var(--brand-primary)' : 'transparent',
                  color: activeTab === 'report' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Printer size={15} /> Marksheets & Transcripts
              </button>
            </>
          )}
        </div>

        {/* TAB 1: SESSIONS & PAPERS */}
        {activeTab === 'sessions' && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', alignItems: 'start' }}>
            {/* Exam Sessions List */}
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Exam Sessions ({exams.length})
              </div>

              {exams.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No exam sessions created yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {exams.map((ex) => (
                    <div
                      key={ex.id}
                      onClick={() => setSelectedExamId(ex.id)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: selectedExamId === ex.id ? 'var(--brand-primary)' : 'var(--surface-sunken)',
                        color: selectedExamId === ex.id ? '#fff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ex.name}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: '0.15rem' }}>
                        {ex.term || 'General Assessment'} • {ex.paperCount || 0} Papers
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Exam Paper Schedules */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    {exams.find((e) => e.id === selectedExamId)?.name || 'Select an Exam Session'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Subject-wise date schedule, room allocations, and mark weightages.
                  </p>
                </div>

                {selectedExamId && canManage && (
                  <Button variant="primary" size="sm" onClick={() => setShowAddPaperModal(true)}>
                    <Plus size={14} style={{ marginRight: '0.2rem' }} />
                    Add Subject Paper
                  </Button>
                )}
              </div>

              {examPapers.length === 0 ? (
                <EmptyState
                  title="No subject papers scheduled"
                  description="Add subject exam dates, start/end times, and mark distributions for this session."
                />
              ) : (
                <div className="table-container">
                  <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.6rem' }}>Subject</th>
                        <th style={{ padding: '0.6rem' }}>Date & Timing</th>
                        <th style={{ padding: '0.6rem' }}>Room</th>
                        <th style={{ padding: '0.6rem' }}>Max / Pass</th>
                        <th style={{ padding: '0.6rem' }}>Distribution</th>
                        {canManage && <th style={{ padding: '0.6rem', textAlign: 'right' }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {examPapers.map((paper) => (
                        <tr key={paper.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{paper.subjectName}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <div>{paper.examDate ? new Date(paper.examDate).toLocaleDateString() : 'TBD'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {paper.startTime || '09:00'} - {paper.endTime || '12:00'}
                            </div>
                          </td>
                          <td style={{ padding: '0.6rem' }}>{paper.roomNo || 'Hall'}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <strong>{paper.maxMarks}</strong> / <span style={{ color: 'var(--status-danger)' }}>{paper.passMarks}</span>
                          </td>
                          <td style={{ padding: '0.6rem', fontSize: '0.78rem' }}>
                            Theory: {paper.theoryWeight} | Prac: {paper.practicalWeight} | Viva: {paper.vivaWeight}
                          </td>
                          {canManage && (
                            <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePaper(paper.id)}
                              >
                                <Trash2 size={13} style={{ color: 'var(--status-danger)' }} />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MARKS ENTRY SHEET - Admin/Teacher only */}
        {activeTab === 'scoring' && canManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Filter Bar */}
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exam Session</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  style={{ padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                >
                  <option value="">Select Exam...</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  style={{ padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                >
                  <option value="">Select Section...</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>{sec.className} — {sec.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  style={{ padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                >
                  <option value="">Select Subject...</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>{sub.name} ({sub.code || 'SUB'})</option>
                  ))}
                </select>
              </div>

              {canManage && selectedSectionId && selectedSubjectId && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {saveSuccess && (
                    <span style={{ fontSize: '0.82rem', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CheckCircle2 size={15} /> Marks Saved!
                    </span>
                  )}
                  <Button variant="primary" onClick={handleSaveMarks} loading={savingMarks}>
                    <Save size={14} style={{ marginRight: '0.3rem' }} />
                    Save Marks Sheet
                  </Button>
                </div>
              )}
            </div>

            {/* Students Marks Sheet */}
            {(!selectedSectionId || !selectedSubjectId || !selectedExamId) ? (
              <EmptyState
                title="Select Exam, Section and Subject"
                description="Choose criteria from the dropdown above to load the student marks entry sheet."
              />
            ) : students.length === 0 ? (
              <EmptyState title="No students enrolled in this section" />
            ) : (
              <div className="table-container glass-panel" style={{ padding: '1rem' }}>
                <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem' }}>Roll #</th>
                      <th style={{ padding: '0.6rem' }}>Admission No</th>
                      <th style={{ padding: '0.6rem' }}>Student Name</th>
                      <th style={{ padding: '0.6rem', width: '160px' }}>Marks Obtained</th>
                      <th style={{ padding: '0.6rem' }}>Max Marks</th>
                      <th style={{ padding: '0.6rem' }}>Calculated Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st) => {
                      const cur = marksSheet[st.id] || { marksObtained: '', maxMarks: 100, grade: '' };
                      const pct = typeof cur.marksObtained === 'number' ? (cur.marksObtained / cur.maxMarks) * 100 : null;

                      return (
                        <tr key={st.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{st.rollNo || '—'}</td>
                          <td style={{ padding: '0.6rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{st.admissionNo}</td>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{st.name}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <input
                              type="number"
                              min={0}
                              max={cur.maxMarks}
                              value={cur.marksObtained}
                              placeholder="0-100"
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                setMarksSheet({
                                  ...marksSheet,
                                  [st.id]: {
                                    ...cur,
                                    marksObtained: val,
                                    grade:
                                      val === ''
                                        ? ''
                                        : val >= 80
                                        ? 'A+'
                                        : val >= 70
                                        ? 'A'
                                        : val >= 60
                                        ? 'A-'
                                        : val >= 50
                                        ? 'B'
                                        : val >= 40
                                        ? 'C'
                                        : val >= 33
                                        ? 'D'
                                        : 'F',
                                  },
                                });
                              }}
                              style={{
                                width: '100%',
                                padding: '0.45rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--surface-sunken)',
                                color: 'var(--text-primary)',
                                fontWeight: 700,
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.6rem', color: 'var(--text-muted)' }}>{cur.maxMarks}</td>
                          <td style={{ padding: '0.6rem' }}>
                            {cur.grade ? (
                              <Badge tone={cur.grade === 'F' ? 'danger' : 'success'}>
                                {cur.grade} {pct !== null && `(${pct.toFixed(0)}%)`}
                              </Badge>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ROOM & SEATING ALLOCATION */}
        {activeTab === 'rooms' && canManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Top Toolbar */}
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Exam Session:</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <option value="">Select Exam Session...</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
                <Badge tone="info">{rooms.length} Rooms Allocated</Badge>
              </div>

              {selectedExamId && (
                <Button variant="primary" size="sm" onClick={() => setShowAddRoomModal(true)} icon={<Plus size={14} />}>
                  Add Room Allocation
                </Button>
              )}
            </div>

            {/* Room Allocation Grid */}
            {!selectedExamId ? (
              <EmptyState title="Select an Exam Session" description="Choose an exam session above to view or configure room and seating allocations." />
            ) : loadingRooms ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading room assignments...</div>
            ) : rooms.length === 0 ? (
              <EmptyState
                title="No rooms assigned yet"
                description="Click 'Add Room Allocation' to assign examination halls (e.g. Room 704 with Rolls 1–30 and invigilator guards)."
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                {rooms.map((rm) => (
                  <div
                    key={rm.id}
                    className="glass-panel"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      borderLeft: '4px solid var(--brand-primary)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {rm.roomNumber}
                        </h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Capacity: {rm.capacity || 40} Seats
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRoom(rm.id)}
                        icon={<Trash2 size={14} style={{ color: 'var(--status-danger)' }} />}
                        title="Delete Room Allocation"
                      />
                    </div>

                    {/* Roll Range Badge */}
                    <div style={{ padding: '0.45rem 0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Roll Range:</span>
                      <Badge tone="primary" style={{ fontWeight: 700 }}>
                        {rm.rollRangeStart && rm.rollRangeEnd ? `Rolls ${rm.rollRangeStart} – ${rm.rollRangeEnd}` : 'Open Seating'}
                      </Badge>
                    </div>

                    {/* Invigilator Guards */}
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Users size={12} /> Assigned Invigilator Guards:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {rm.guardNames && rm.guardNames.length > 0 ? (
                          rm.guardNames.map((gName, idx) => (
                            <Badge key={idx} tone="neutral" style={{ fontSize: '0.72rem' }}>
                              {gName}
                            </Badge>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No guards designated</span>
                        )}
                      </div>
                    </div>

                    {rm.remarks && (
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {rm.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MISSING MARKS & PROGRESS TRACKER */}
        {activeTab === 'progress' && canManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header / Selector */}
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Exam Session:</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem', fontWeight: 600 }}
                >
                  <option value="">Select Exam Session...</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNotifyPendingTeachers}
                  disabled={notifyingTeachers || !selectedExamId}
                  icon={notifyingTeachers ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                >
                  {notifyingTeachers ? 'Dispatching...' : 'Notify Pending Teachers / Create Task'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePublishExam}
                  disabled={publishing || !selectedExamId || progressData?.isPublished}
                  icon={publishing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                >
                  {progressData?.isPublished ? 'Results Published (Locked)' : 'Publish & Release Results'}
                </Button>
              </div>
            </div>

            {/* Notification & Publish Banners */}
            {notifyFeedback && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} /> {notifyFeedback}
              </div>
            )}
            {publishFeedback && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--status-success)', color: 'var(--status-success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} /> {publishFeedback}
              </div>
            )}

            {/* Overall Progress Statistics Card */}
            {!selectedExamId ? (
              <EmptyState title="Select an Exam Session" description="Choose an exam session above to review marks entry completion and missing submissions." />
            ) : loadingProgress ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Calculating real-time marks progress...</div>
            ) : (
              <>
                <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                        {progressData?.examName || 'Exam Session'}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {progressData?.totalEligibleStudents || 0} Total Eligible Candidates &bull; {progressData?.papers?.length || 0} Scheduled Subject Papers
                      </span>
                    </div>
                    <Badge tone={progressData?.isPublished ? 'success' : 'warning'}>
                      {progressData?.isPublished ? 'PUBLISHED & LOCKED' : 'IN PROGRESS (OPEN)'}
                    </Badge>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      <span>Overall Marks Entry Completion</span>
                      <span>{progressData?.overallCompletionPercentage || 0}%</span>
                    </div>
                    <div style={{ height: '10px', background: 'var(--surface-sunken)', borderRadius: '5px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${progressData?.overallCompletionPercentage || 0}%`,
                          background: (progressData?.overallCompletionPercentage || 0) === 100 ? 'var(--status-success)' : 'var(--brand-primary)',
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Per-Paper Missing Marks Breakdown Table */}
                <div className="table-container glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    Subject Papers & Missing Evaluator Submissions
                  </div>
                  <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.6rem' }}>Subject Paper</th>
                        <th style={{ padding: '0.6rem' }}>Assigned Evaluator / Teacher</th>
                        <th style={{ padding: '0.6rem' }}>Entered / Total</th>
                        <th style={{ padding: '0.6rem' }}>Status</th>
                        <th style={{ padding: '0.6rem' }}>Missing Student Rolls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressData?.papers?.map((p) => (
                        <tr key={p.paperId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.6rem', fontWeight: 600 }}>{p.subjectName}</td>
                          <td style={{ padding: '0.6rem' }}>{p.teacherName || 'Not Designated'}</td>
                          <td style={{ padding: '0.6rem' }}>
                            <strong>{p.enteredMarks}</strong> / {p.totalEligible}
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <Badge tone={p.isComplete ? 'success' : 'danger'}>
                              {p.isComplete ? 'COMPLETE' : `${p.missingCount} MISSING`}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            {p.missingStudents && p.missingStudents.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                {p.missingStudents.slice(0, 10).map((st) => (
                                  <Badge key={st.studentId} tone="neutral" style={{ fontSize: '0.7rem' }}>
                                    Roll {st.rollNumber || '—'}
                                  </Badge>
                                ))}
                                {p.missingStudents.length > 10 && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    +{p.missingStudents.length - 10} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--status-success)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <CheckCircle size={13} /> All Marks Recorded
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 5: OFFICIAL TRANSCRIPTS & MARKSHEETS */}
        {activeTab === 'report' && canManage && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Filter / Student Selector */}
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exam Session</label>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    style={{ padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                  >
                    <option value="">Select Exam...</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>{ex.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Section</label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => {
                      setSelectedSectionId(e.target.value);
                      fetchStudents({ sectionId: e.target.value }).then(setStudents).catch(console.error);
                    }}
                    style={{ padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                  >
                    <option value="">Select Section...</option>
                    {sections.map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.className} — {sec.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Student</label>
                  <select
                    value={ownStudentId || ''}
                    onChange={(e) => {
                      const sId = e.target.value;
                      setOwnStudentId(sId);
                      if (sId && selectedExamId) {
                        fetchMarks({ examId: selectedExamId, studentId: sId }).then(setOwnMarks).catch(console.error);
                      }
                    }}
                    style={{ padding: '0.45rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                  >
                    <option value="">Select Candidate...</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>Roll {st.rollNo || '—'}: {st.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {ownStudentId && ownMarks.length > 0 && (
                <Button variant="primary" size="sm" onClick={() => window.print()} icon={<Printer size={15} />}>
                  Print Official Marksheet (PDF)
                </Button>
              )}
            </div>

            {/* Marksheet Document Canvas */}
            {!ownStudentId || ownMarks.length === 0 ? (
              <EmptyState title="Select Exam & Student" description="Select an examination session, section, and candidate student to generate their official transcript." />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                <div
                  style={{
                    width: '210mm',
                    minHeight: '260mm',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    padding: '20mm 15mm 20mm 15mm',
                    boxSizing: 'border-box',
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    position: 'relative',
                  }}
                >
                  {/* Marksheet Content */}
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '16px' }}>
                    <h1 style={{ margin: 0, fontSize: '24px', textTransform: 'uppercase' }}>Dhaka Model International Academy</h1>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>House 42, Road 11, Dhanmondi, Dhaka 1209</p>
                    <div style={{ display: 'inline-block', marginTop: '8px', padding: '3px 14px', background: '#f1f5f9', borderRadius: '12px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                      Official Academic Transcript &bull; {exams.find(e => e.id === selectedExamId)?.name}
                    </div>
                  </div>

                  {/* Student Details */}
                  <table style={{ width: '100%', marginBottom: '16px', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <tr>
                      <td style={{ padding: '4px 0', fontWeight: 600, color: '#475569', width: '20%' }}>Student Name:</td>
                      <td style={{ padding: '4px 0', fontWeight: 700, width: '30%' }}>{students.find(s => s.id === ownStudentId)?.name}</td>
                      <td style={{ padding: '4px 0', fontWeight: 600, color: '#475569', width: '20%' }}>Roll Number:</td>
                      <td style={{ padding: '4px 0', fontWeight: 700, width: '30%' }}>{students.find(s => s.id === ownStudentId)?.rollNo || '—'}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', fontWeight: 600, color: '#475569' }}>Admission No:</td>
                      <td style={{ padding: '4px 0' }}>{students.find(s => s.id === ownStudentId)?.admissionNo}</td>
                      <td style={{ padding: '4px 0', fontWeight: 600, color: '#475569' }}>Date of Issue:</td>
                      <td style={{ padding: '4px 0' }}>{new Date().toLocaleDateString()}</td>
                    </tr>
                  </table>

                  {/* Marks Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '25px', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px', border: '1px solid #0f172a' }}>Subject</th>
                        <th style={{ padding: '8px 10px', border: '1px solid #0f172a', textAlign: 'center' }}>Max Marks</th>
                        <th style={{ padding: '8px 10px', border: '1px solid #0f172a', textAlign: 'center' }}>Marks Obtained</th>
                        <th style={{ padding: '8px 10px', border: '1px solid #0f172a', textAlign: 'center' }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownMarks.map((m) => (
                        <tr key={m.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                          <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{m.subjectName}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{m.maxMarks}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}>{m.marksObtained ?? '—'}</td>
                          <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: m.grade === 'F' ? '#ef4444' : '#16a34a' }}>
                            {m.grade || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Signatures */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px', padding: '0 10px' }}>
                    <div style={{ textAlign: 'center', width: '150px' }}>
                      <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '12px', fontWeight: 600 }}>
                        Exam Controller
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', width: '100px' }}>
                      <div style={{ width: '50px', height: '50px', margin: '0 auto', border: '2px dashed #0284c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', color: '#0284c7' }}>
                        OFFICIAL SEAL
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', width: '150px' }}>
                      <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '12px', fontWeight: 600 }}>
                        Principal
                      </div>
                    </div>
                  </div>

                  {/* Non-removable Biddyapith Watermark */}
                  <div className="biddyapith-footer-watermark" style={{ position: 'absolute', bottom: '8mm', left: 0, right: 0, textAlign: 'center', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                    Powered by Sohopathi &bull; Verified Academic Document
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Create Exam */}
        <Modal isOpen={showCreateExamModal} onClose={() => setShowCreateExamModal(false)} title="Create New Examination Session">
          <form onSubmit={handleCreateExam} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Exam Category</label>
              <select
                value={examForm.examType}
                onChange={(e) => setExamForm({ ...examForm, examType: e.target.value as any })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="term">Term / Institutional Assessment (Multi-Class)</option>
                <option value="class_test">Single Class / Section Test (e.g. 9B Bangla)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Academic Year</label>
              <select
                required
                value={examForm.academicYearId}
                onChange={(e) => setExamForm({ ...examForm, academicYearId: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>{ay.label} {ay.isCurrent ? '(Current)' : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Exam Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Class 9B Bangla Chapter 1-5 Test"
                value={examForm.name}
                onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            {/* If Class Test: show class, section, and syllabus remarks */}
            {examForm.examType === 'class_test' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Class</label>
                    <select
                      value={examForm.classId}
                      onChange={(e) => setExamForm({ ...examForm, classId: e.target.value, sectionId: '' })}
                      style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                    >
                      <option value="">Select Class...</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Section</label>
                    <select
                      value={examForm.sectionId}
                      onChange={(e) => setExamForm({ ...examForm, sectionId: e.target.value })}
                      style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                    >
                      <option value="">Select Section...</option>
                      {sections
                        .filter((s) => !examForm.classId || s.classId === examForm.classId)
                        .map((sec) => (
                          <option key={sec.id} value={sec.id}>{sec.className} - {sec.name}</option>
                        ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Syllabus Coverage / Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Chapters 1 to 5 - Poetry & Grammar"
                    value={examForm.syllabusRemarks}
                    onChange={(e) => setExamForm({ ...examForm, syllabusRemarks: e.target.value })}
                    style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Exam Controller / In-Charge</label>
              <select
                value={examForm.examControllerMembershipId}
                onChange={(e) => setExamForm({ ...examForm, examControllerMembershipId: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">Select Controller (Default: Principal / Admin)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.roleName})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Date</label>
                <input
                  type="date"
                  value={examForm.startDate}
                  onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Date</label>
                <input
                  type="date"
                  value={examForm.endDate}
                  onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setShowCreateExamModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Create Exam</Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Add Subject Paper Schedule */}
        <Modal isOpen={showAddPaperModal} onClose={() => setShowAddPaperModal(false)} title="Schedule Subject Exam Paper">
          <form onSubmit={handleCreatePaper} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Subject</label>
              <select
                required
                value={paperForm.subjectId}
                onChange={(e) => setPaperForm({ ...paperForm, subjectId: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">Select Subject...</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name} ({sub.code || 'SUB'})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Assigned Teacher / Evaluator</label>
              <select
                value={paperForm.teacherMembershipId}
                onChange={(e) => setPaperForm({ ...paperForm, teacherMembershipId: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">Select Subject Teacher...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.roleName})</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Paper Syllabus / Chapters</label>
              <input
                type="text"
                placeholder="e.g. Chapters 1-5"
                value={paperForm.syllabus}
                onChange={(e) => setPaperForm({ ...paperForm, syllabus: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Exam Date</label>
                <input
                  type="date"
                  required
                  value={paperForm.examDate}
                  onChange={(e) => setPaperForm({ ...paperForm, examDate: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Room Allocation</label>
                <input
                  type="text"
                  placeholder="e.g. Room 204"
                  value={paperForm.roomNo}
                  onChange={(e) => setPaperForm({ ...paperForm, roomNo: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Time</label>
                <input
                  type="time"
                  value={paperForm.startTime}
                  onChange={(e) => setPaperForm({ ...paperForm, startTime: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Time</label>
                <input
                  type="time"
                  value={paperForm.endTime}
                  onChange={(e) => setPaperForm({ ...paperForm, endTime: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Max Marks</label>
                <input
                  type="number"
                  value={paperForm.maxMarks}
                  onChange={(e) => setPaperForm({ ...paperForm, maxMarks: Number(e.target.value) })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Pass Marks</label>
                <input
                  type="number"
                  value={paperForm.passMarks}
                  onChange={(e) => setPaperForm({ ...paperForm, passMarks: Number(e.target.value) })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setShowAddPaperModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Add Paper Schedule</Button>
            </div>
          </form>
        </Modal>

        {/* Modal: Add Room Allocation */}
        <Modal isOpen={showAddRoomModal} onClose={() => setShowAddRoomModal(false)} title="Add Examination Room & Seating Allocation">
          <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Room Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room 704"
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Seating Capacity</label>
                <input
                  type="number"
                  required
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Roll Range Start</label>
                <input
                  type="number"
                  value={roomForm.rollRangeStart}
                  onChange={(e) => setRoomForm({ ...roomForm, rollRangeStart: Number(e.target.value) })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Roll Range End</label>
                <input
                  type="number"
                  value={roomForm.rollRangeEnd}
                  onChange={(e) => setRoomForm({ ...roomForm, rollRangeEnd: Number(e.target.value) })}
                  style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Invigilator Guards (Teachers)</label>
              <select
                multiple
                value={roomForm.guardMembershipIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (option) => option.value);
                  setRoomForm({ ...roomForm, guardMembershipIds: selected });
                }}
                style={{ height: '100px', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.roleName})</option>
                ))}
              </select>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hold Ctrl / Cmd to select multiple teachers (e.g. Teacher 07, Teacher 10)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Seating Remarks / Arrangement</label>
              <input
                type="text"
                placeholder="e.g. Odd rolls Column A, Even rolls Column B"
                value={roomForm.remarks}
                onChange={(e) => setRoomForm({ ...roomForm, remarks: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setShowAddRoomModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Allocate Room</Button>
            </div>
          </form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
};

export default ExaminationsPage;