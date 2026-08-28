import React, { useState, useEffect } from 'react';
import {
  fetchAcademicYears,
  createAcademicYear,
  fetchClasses,
  createClass,
  fetchSections,
  createSection,
  fetchSubjects,
  createSubject,
  fetchTeacherAssignments,
  assignTeacher,
  fetchTeachers,
  fetchSchedules,
  createSchedule,
  deleteSchedule,
} from '../services/api';
import type {
  AcademicYear,
  ClassItem,
  SectionItem,
  SubjectItem,
  TeacherAssignment,
  ClassScheduleItem,
} from '../types';
import { Layers, Plus, Calendar, BookOpen, UserCheck, AlertCircle, Clock, Trash2, MapPin } from 'lucide-react';
import { Button, Badge, Modal } from '../components/common';
import { AcademicMigrationModal } from '../components/academic/AcademicMigrationModal';

export const AcademicPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'classes' | 'years' | 'subjects' | 'assignments' | 'timetable'>('classes');
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [teachers, setTeachers] = useState<Array<{ membershipId: string; name: string; email: string }>>([]);

  // Migration Modal State
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  // Timetable State
  const [schedules, setSchedules] = useState<ClassScheduleItem[]>([]);
  const [selectedTimetableSectionId, setSelectedTimetableSectionId] = useState<string>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedSubjectId, setSchedSubjectId] = useState('');
  const [schedTeacherId, setSchedTeacherId] = useState('');
  const [schedDay, setSchedDay] = useState('Monday');
  const [schedStart, setSchedStart] = useState('09:00');
  const [schedEnd, setSchedEnd] = useState('09:45');
  const [schedRoom, setSchedRoom] = useState('Room 101');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Creation Modals
  const [showYearModal, setShowYearModal] = useState(false);
  const [yearLabel, setYearLabel] = useState('2026-2027');
  const [yearStart, setYearStart] = useState('2026-01-01');
  const [yearEnd, setYearEnd] = useState('2026-12-31');

  const [showClassModal, setShowClassModal] = useState(false);
  const [className, setClassName] = useState('');
  const [classYearId, setClassYearId] = useState('');
  const [classSortOrder, setClassSortOrder] = useState(1);

  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionClassId, setSectionClassId] = useState('');
  const [sectionCapacity, setSectionCapacity] = useState(40);

  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSectionId, setAssignSectionId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [y, c, s, sub, a, t] = await Promise.all([
        fetchAcademicYears(),
        fetchClasses(),
        fetchSections(),
        fetchSubjects(),
        fetchTeacherAssignments(),
        fetchTeachers(),
      ]);
      setYears(y);
      setClasses(c);
      setSections(s);
      setSubjects(sub);
      setAssignments(a);
      setTeachers(t);

      if (y.length > 0 && !classYearId) setClassYearId(y[0].id);
      if (c.length > 0 && !sectionClassId) setSectionClassId(c[0].id);
      if (s.length > 0 && !assignSectionId) {
        setAssignSectionId(s[0].id);
        setSelectedTimetableSectionId(s[0].id);
      }
      if (sub.length > 0 && !assignSubjectId) {
        setAssignSubjectId(sub[0].id);
        setSchedSubjectId(sub[0].id);
      }
      if (t.length > 0 && !assignTeacherId) {
        setAssignTeacherId(t[0].membershipId);
        setSchedTeacherId(t[0].membershipId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load academic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedTimetableSectionId) {
      fetchSchedules({ sectionId: selectedTimetableSectionId })
        .then(setSchedules)
        .catch(console.error);
    } else {
      setSchedules([]);
    }
  }, [selectedTimetableSectionId]);

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAcademicYear({
        label: yearLabel.trim(),
        startDate: yearStart,
        endDate: yearEnd,
        isCurrent: true,
      });
      setShowYearModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create academic year');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim() || !classYearId) return;
    setSubmitting(true);
    try {
      await createClass({
        name: className.trim(),
        academicYearId: classYearId,
        sortOrder: Number(classSortOrder),
      });
      setShowClassModal(false);
      setClassName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create class');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName.trim() || !sectionClassId) return;
    setSubmitting(true);
    try {
      await createSection({
        name: sectionName.trim(),
        classId: sectionClassId,
        capacity: Number(sectionCapacity),
      });
      setShowSectionModal(false);
      setSectionName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create section');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    setSubmitting(true);
    try {
      await createSubject({
        name: subjectName.trim(),
        code: subjectCode.trim() || undefined,
      });
      setShowSubjectModal(false);
      setSubjectName('');
      setSubjectCode('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create subject');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignSectionId || !assignSubjectId || !assignTeacherId) return;
    setSubmitting(true);
    try {
      await assignTeacher({
        sectionId: assignSectionId,
        subjectId: assignSubjectId,
        teacherMembershipId: assignTeacherId,
      });
      setShowAssignModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to assign teacher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTimetableSectionId || !schedSubjectId) return;
    setSubmitting(true);
    try {
      const created = await createSchedule({
        sectionId: selectedTimetableSectionId,
        subjectId: schedSubjectId,
        teacherMembershipId: schedTeacherId || undefined,
        dayOfWeek: schedDay,
        startTime: schedStart,
        endTime: schedEnd,
        roomNo: schedRoom.trim() || undefined,
      });
      setSchedules([...schedules, created]);
      setShowScheduleModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add schedule period');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Remove this timetable slot?')) return;
    try {
      await deleteSchedule(id);
      setSchedules(schedules.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete schedule slot');
    }
  };

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={26} style={{ color: 'var(--brand-primary)' }} /> Academic Structure & Timetable
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Configure academic sessions, class tiers, section divisions, curriculum subjects, and weekly timetable schedules.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => setShowMigrationModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <span>✨ Setup & Migration Wizard</span>
        </Button>
      </div>

      <AcademicMigrationModal
        isOpen={showMigrationModal}
        onClose={() => setShowMigrationModal(false)}
        onSuccess={loadData}
      />

      {error && (
        <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { id: 'classes', label: 'Classes & Sections', icon: <Layers size={14} /> },
          { id: 'timetable', label: 'Class Timetable & Periods', icon: <Clock size={14} /> },
          { id: 'subjects', label: 'Curriculum Subjects', icon: <BookOpen size={14} /> },
          { id: 'assignments', label: 'Teacher Allocations', icon: <UserCheck size={14} /> },
          { id: 'years', label: 'Academic Sessions', icon: <Calendar size={14} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === tab.id ? 'var(--brand-primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading academic structures...
        </div>
      ) : (
        <>

      {/* TAB 1: CLASSES & SECTIONS */}
      {activeTab === 'classes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setShowSectionModal(true)}>
              Add Section
            </Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowClassModal(true)}>
              Add Class
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {classes.map((cls) => {
              const clsSections = sections.filter((s) => s.classId === cls.id);
              return (
                <div key={cls.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{cls.name}</h3>
                    <Badge tone="primary">{clsSections.length} Sections</Badge>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {clsSections.map((sec) => (
                      <div key={sec.id} style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                        <span>Section {sec.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Cap: {sec.capacity || 40}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: TIMETABLE & PERIODS */}
      {activeTab === 'timetable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Section Selector */}
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Class Section:</label>
              <select
                value={selectedTimetableSectionId}
                onChange={(e) => setSelectedTimetableSectionId(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
              >
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>{sec.className} — {sec.name}</option>
                ))}
              </select>
            </div>

            {selectedTimetableSectionId && (
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowScheduleModal(true)}>
                Add Period Slot
              </Button>
            )}
          </div>

          {/* Timetable Grid by Day */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {daysOfWeek.map((day) => {
              const daySlots = schedules.filter((s) => s.dayOfWeek.toLowerCase() === day.toLowerCase());
              return (
                <div key={day} className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{day}</span>
                    <Badge tone={daySlots.length > 0 ? 'primary' : 'neutral'}>{daySlots.length} Periods</Badge>
                  </div>

                  {daySlots.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      No periods scheduled
                    </div>
                  ) : (
                    daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        style={{
                          padding: '0.6rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-sunken)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{slot.subjectName}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                            <Clock size={11} /> {slot.startTime} - {slot.endTime}
                            {slot.roomNo && <><span>•</span> <MapPin size={11} /> {slot.roomNo}</>}
                          </div>
                          {slot.teacherName && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--brand-primary)', marginTop: '0.1rem' }}>
                              Teacher: {slot.teacherName}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchedule(slot.id)}
                          icon={<Trash2 size={12} style={{ color: 'var(--status-danger)' }} />}
                        />
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SUBJECTS */}
      {activeTab === 'subjects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowSubjectModal(true)}>
              Add Subject
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {subjects.map((sub) => (
              <div key={sub.id} className="glass-panel" style={{ padding: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{sub.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                  Code: {sub.code || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TEACHER ALLOCATIONS */}
      {activeTab === 'assignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowAssignModal(true)}>
              Assign Teacher to Subject
            </Button>
          </div>

          <div className="table-container glass-panel" style={{ padding: '0.5rem' }}>
            <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.6rem' }}>Class & Section</th>
                  <th style={{ padding: '0.6rem' }}>Subject</th>
                  <th style={{ padding: '0.6rem' }}>Assigned Teacher</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 600 }}>{a.className} — {a.sectionName}</td>
                    <td style={{ padding: '0.6rem' }}>{a.subjectName}</td>
                    <td style={{ padding: '0.6rem', color: 'var(--brand-primary)', fontWeight: 600 }}>{a.teacherName || 'Faculty'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: ACADEMIC YEARS */}
      {activeTab === 'years' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowYearModal(true)}>
              Create Academic Session
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {years.map((y) => (
              <div key={y.id} className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{y.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {new Date(y.startDate).toLocaleDateString()} — {new Date(y.endDate).toLocaleDateString()}
                  </div>
                </div>
                {y.isCurrent && <Badge tone="success">Active Session</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}
      </>
      )}

      {/* Modal: Schedule Period */}
      <Modal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} title="Schedule Class Period">
        <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Subject *</label>
              <select
                required
                value={schedSubjectId}
                onChange={(e) => setSchedSubjectId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Day of Week *</label>
              <select
                required
                value={schedDay}
                onChange={(e) => setSchedDay(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                {daysOfWeek.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Time *</label>
              <input
                type="time"
                required
                value={schedStart}
                onChange={(e) => setSchedStart(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Time *</label>
              <input
                type="time"
                required
                value={schedEnd}
                onChange={(e) => setSchedEnd(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Teacher (Optional)</label>
              <select
                value={schedTeacherId}
                onChange={(e) => setSchedTeacherId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="">Unassigned</option>
                {teachers.map((t) => (
                  <option key={t.membershipId} value={t.membershipId}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Room / Lab Number</label>
              <input
                type="text"
                value={schedRoom}
                onChange={(e) => setSchedRoom(e.target.value)}
                placeholder="e.g. Physics Lab 1"
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Save Period Slot</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Academic Year */}
      <Modal isOpen={showYearModal} onClose={() => setShowYearModal(false)} title="Create Academic Session">
        <form onSubmit={handleCreateYear} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Session Label</label>
            <input type="text" required value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Date</label>
              <input type="date" required value={yearStart} onChange={(e) => setYearStart(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Date</label>
              <input type="date" required value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowYearModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Create Session</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Class */}
      <Modal isOpen={showClassModal} onClose={() => setShowClassModal(false)} title="Add Class / Grade Level">
        <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Class Name</label>
            <input type="text" required placeholder="e.g. Class 10" value={className} onChange={(e) => setClassName(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Academic Session</label>
            <select value={classYearId} onChange={(e) => setClassYearId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Display Order / Sequence</label>
            <input type="number" value={classSortOrder} onChange={(e) => setClassSortOrder(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowClassModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Create Class</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Section */}
      <Modal isOpen={showSectionModal} onClose={() => setShowSectionModal(false)} title="Add Class Section">
        <form onSubmit={handleCreateSection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Target Class</label>
            <select value={sectionClassId} onChange={(e) => setSectionClassId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Section Name</label>
              <input type="text" required placeholder="e.g. A, Science, Blue" value={sectionName} onChange={(e) => setSectionName(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Capacity</label>
              <input type="number" value={sectionCapacity} onChange={(e) => setSectionCapacity(Number(e.target.value))} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowSectionModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Create Section</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create Subject */}
      <Modal isOpen={showSubjectModal} onClose={() => setShowSubjectModal(false)} title="Add Curriculum Subject">
        <form onSubmit={handleCreateSubject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Subject Name</label>
            <input type="text" required placeholder="e.g. Higher Mathematics" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Subject Code</label>
            <input type="text" placeholder="e.g. HM-101" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowSubjectModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Create Subject</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Teacher */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Teacher to Subject">
        <form onSubmit={handleAssignTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Section</label>
            <select value={assignSectionId} onChange={(e) => setAssignSectionId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>{sec.className} — {sec.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Subject</label>
            <select value={assignSubjectId} onChange={(e) => setAssignSubjectId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Teacher</label>
            <select value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
              {teachers.map((t) => (
                <option key={t.membershipId} value={t.membershipId}>{t.name} ({t.email})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={submitting}>Assign Teacher</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
