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
} from '../services/api';
import type {
  ExamItem,
  ExamPaperItem,
  AcademicYear,
  SectionItem,
  SubjectItem,
  StudentItem,
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
} from 'lucide-react';

export const ExaminationsPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { hasPermission } = useSession();
  const canManage = hasPermission('exams.manage') || hasPermission('marks.create');

  const [activeTab, setActiveTab] = useState<'sessions' | 'scoring' | 'report'>('sessions');

  // Academic dependencies
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);

  // Selected for Papers & Scoring
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [examPapers, setExamPapers] = useState<ExamPaperItem[]>([]);

  // Scoring Sheet State
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [marksSheet, setMarksSheet] = useState<Record<string, { marksObtained: number | string; maxMarks: number; grade: string }>>({});
  const [savingMarks, setSavingMarks] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Modals
  const [showCreateExamModal, setShowCreateExamModal] = useState<boolean>(false);
  const [showAddPaperModal, setShowAddPaperModal] = useState<boolean>(false);
  const [examForm, setExamForm] = useState({ academicYearId: '', name: '', term: '', startDate: '', endDate: '' });
  const [paperForm, setPaperForm] = useState({
    subjectId: '',
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

  const [studentMarks, setStudentMarks] = useState<any[]>([]);
  const [loadingStudentMarks, setLoadingStudentMarks] = useState<boolean>(false);

  const loadDependencies = async () => {
    try {
      if (canManage) {
        const [ay, sec, sub, ex] = await Promise.all([
          fetchAcademicYears().catch(() => []),
          fetchSections().catch(() => []),
          fetchSubjects().catch(() => []),
          fetchExams().catch(() => []),
        ]);
        setAcademicYears(ay);
        setSections(sec);
        setSubjects(sub);
        setExams(ex);
        if (ay.length > 0) setExamForm((prev) => ({ ...prev, academicYearId: ay[0].id }));
        if (ex.length > 0 && !selectedExamId) setSelectedExamId(ex[0].id);
      } else {
        setLoadingStudentMarks(true);
        const marks = await fetchMarks().catch(() => []);
        setStudentMarks(marks);
        setLoadingStudentMarks(false);
      }
    } catch (err) {
      console.error('Failed to load exam data:', err);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, [canManage]);

  useEffect(() => {
    if (selectedExamId) {
      fetchExamPapers(selectedExamId).then(setExamPapers).catch(console.error);
    } else {
      setExamPapers([]);
    }
  }, [selectedExamId]);

  // Load Scoring Sheet when Exam + Section + Subject selected
  useEffect(() => {
    if (activeTab === 'scoring' && selectedSectionId && selectedSubjectId && selectedExamId) {
      Promise.all([
        fetchStudents({ sectionId: selectedSectionId }).catch(() => []),
        fetchMarks({ examId: selectedExamId, subjectId: selectedSubjectId }).catch(() => []),
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
      setExamForm({ academicYearId: academicYears[0]?.id || '', name: '', term: '', startDate: '', endDate: '' });
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

  // Student report calculations
  const totalSubjects = studentMarks.length;
  const passedSubjects = studentMarks.filter((m) => (m.marksObtained / m.maxMarks) >= 0.33).length;
  const avgScore = totalSubjects > 0
    ? Math.round(studentMarks.reduce((acc, m) => acc + ((m.marksObtained / m.maxMarks) * 100), 0) / totalSubjects)
    : 0;

  return (
    <ProtectedRoute requiredPermission="marks.read" onNavigateHome={onNavigateHome}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={24} style={{ color: 'var(--brand-primary)' }} /> {canManage ? 'Examination & Assessment Control' : 'My Examination Results & Report Card'}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {canManage ? 'Configure examination schedules, paper mark distributions, and grade tabulation sheets.' : 'View your official examination scores, subject evaluations, letter grades, and academic reports.'}
            </p>
          </div>

          {canManage && (
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowCreateExamModal(true)}>
              Create Exam Session
            </Button>
          )}
        </div>

        {!canManage ? (
          /* Student Report Card View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Subjects Evaluated</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{totalSubjects}</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Passed Subjects</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#16a34a' }}>{passedSubjects} / {totalSubjects}</div>
              </div>
              <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Average Score</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--primary)' }}>{avgScore}%</div>
              </div>
            </div>

            {/* Results Table */}
            <div className="table-container glass-panel" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: 'var(--primary)' }} /> Grade Sheet & Official Tabulation
              </div>
              {loadingStudentMarks ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading examination results...</div>
              ) : studentMarks.length === 0 ? (
                <EmptyState
                  title="No examination results published yet"
                  description="Your marks and grades will be published here once evaluated by your course teachers."
                />
              ) : (
                <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Subject</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Marks Obtained</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Total Marks</th>
                      <th style={{ padding: '0.65rem 0.75rem' }}>Percentage</th>
                      <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Letter Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentMarks.map((m, idx) => {
                      const pct = m.maxMarks > 0 ? Math.round((m.marksObtained / m.maxMarks) * 100) : 0;
                      return (
                        <tr key={m.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                            {m.subjectName || 'Coursework'}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {m.marksObtained}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            {m.maxMarks}
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                            {pct}%
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                            <Badge tone={pct >= 80 ? 'success' : pct >= 50 ? 'info' : pct >= 33 ? 'warning' : 'danger'}>
                              {m.grade || (pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 33 ? 'D' : 'F')}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tab Controls for Teachers / Admins */}
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
                  <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddPaperModal(true)}>
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
                                icon={<Trash2 size={13} style={{ color: 'var(--status-danger)' }} />}
                              />
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

        {/* TAB 2: MARKS ENTRY SHEET */}
        {activeTab === 'scoring' && (
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
                  <Button variant="primary" icon={<Save size={14} />} onClick={handleSaveMarks} loading={savingMarks}>
                    Save Marks Sheet
                  </Button>
                </div>
              )}
            </div>

            {/* Students Marks Sheet */}
            {(!selectedSectionId || !selectedSubjectId || !selectedExamId) ? (
              <EmptyState
                title="Select Exam, Section and Subject"
                description="Choose criteria from the dropdown above to load the student marks entry roster."
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
      </>
    )}

        {/* Modal: Create Exam */}
        <Modal isOpen={showCreateExamModal} onClose={() => setShowCreateExamModal(false)} title="Create New Examination Session">
          <form onSubmit={handleCreateExam} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                placeholder="e.g. Mid-Term Examination 2026"
                value={examForm.name}
                onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Term / Phase</label>
              <input
                type="text"
                placeholder="e.g. 1st Term, Final Term"
                value={examForm.term}
                onChange={(e) => setExamForm({ ...examForm, term: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
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

            {/* Mark Distribution Breakdown */}
            <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Mark Distribution Breakdown</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem' }}>Theory</label>
                  <input
                    type="number"
                    value={paperForm.theoryWeight}
                    onChange={(e) => setPaperForm({ ...paperForm, theoryWeight: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem' }}>Practical</label>
                  <input
                    type="number"
                    value={paperForm.practicalWeight}
                    onChange={(e) => setPaperForm({ ...paperForm, practicalWeight: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem' }}>Viva</label>
                  <input
                    type="number"
                    value={paperForm.vivaWeight}
                    onChange={(e) => setPaperForm({ ...paperForm, vivaWeight: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setShowAddPaperModal(false)}>Cancel</Button>
              <Button variant="primary" type="submit">Add Paper Schedule</Button>
            </div>
          </form>
        </Modal>
      </div>
    </ProtectedRoute>
  );
};
