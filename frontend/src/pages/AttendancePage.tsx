import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import {
  fetchSections,
  fetchAttendanceSheet,
  markAttendanceBatch,
  fetchAttendanceSummary,
  fetchStudents,
  exportToCsv,
} from '../services/api';
import type {
  SectionItem,
  AttendanceSheetItem,
} from '../types';
import {
  CalendarCheck,
  Download,
  CheckCircle2,
  Calendar,
  Clock,
  AlertCircle,
  Users,
  Save,
  Loader2,
  UserCheck,
  UserX,
  UserMinus,
} from 'lucide-react';
import { Button, Badge } from '../components/common';

export const AttendancePage: React.FC = () => {
  const { activeMembership, user } = useSession();
  
  // Role detection
  const role = activeMembership?.roleName?.toLowerCase() || '';
  const isStudent = role.includes('student');
  const isTeacher = role.includes('teacher') || role.includes('faculty');
  const isAdmin = role.includes('admin') || role.includes('coordinator') || role.includes('principal');
  
  // Permissions
  const canTakeAttendance = isAdmin || isTeacher;

  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sheetStudents, setSheetStudents] = useState<AttendanceSheetItem[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceSavedSuccess, setAttendanceSavedSuccess] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Student own attendance
  const [ownStudentId, setOwnStudentId] = useState<string | null>(null);

  // ✅ Student Attendance Summary (for student view)
  const [studentSummary, setStudentSummary] = useState<{
    totalDays: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    attendanceRate: number;
  }>({
    totalDays: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    attendanceRate: 0,
  });

  // Initial load
  useEffect(() => {
    if (isStudent) {
      // Student: Load all students to find own ID
      fetchStudents()
        .then((students) => {
          const ownStudent = students.find(s => s.userId === user?.id);
          if (ownStudent) {
            setOwnStudentId(ownStudent.id);
            // Auto-select student's section
            if (ownStudent.sectionId) {
              setSelectedSectionId(ownStudent.sectionId);
            }
          }
        })
        .catch(console.error);
    } else {
      // Admin/Teacher: Load sections
      fetchSections()
        .then((secs) => {
          setSections(secs);
          if (secs.length > 0) setSelectedSectionId(secs[0].id);
        })
        .catch(console.error);
    }

    // Load attendance summary for student
    if (isStudent) {
      fetchAttendanceSummary()
        .then((summary) => {
          if (summary && summary.length > 0) {
            const data = summary[0];
            const total = data.totalStudents || 0;
            const present = data.presentCount || 0;
            const absent = data.absentCount || 0;
            const late = data.lateCount || 0;
            const rate = total > 0 ? Math.round((present / total) * 100) : 0;
            
            setStudentSummary({
              totalDays: total,
              presentCount: present,
              absentCount: absent,
              lateCount: late,
              attendanceRate: rate,
            });
          }
        })
        .catch(console.error);
    }
  }, [isStudent, user]);

  // Load attendance sheet when section or date changes
  useEffect(() => {
    if (!selectedSectionId) return;
    
    setLoadingSheet(true);
    setError(null);
    setAttendanceSavedSuccess(false);

    fetchAttendanceSheet(selectedSectionId, selectedDate)
      .then((sheet) => {
        let filteredSheet = sheet;
        
        // ✅ Student: শুধু নিজের Attendance দেখাবে
        if (isStudent && ownStudentId) {
          filteredSheet = sheet.filter(s => s.studentId === ownStudentId);
        }
        
        const defaulted = filteredSheet.map((s) => ({
          ...s,
          status: s.status || 'present',
        }));
        setSheetStudents(defaulted);
      })
      .catch((err) => setError(err.message || 'Failed to load attendance sheet'))
      .finally(() => setLoadingSheet(false));
  }, [selectedSectionId, selectedDate, isStudent, ownStudentId]);

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    // ✅ Student cannot change attendance status
    if (isStudent) return;
    
    setSheetStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
    setAutoSaveStatus('Unsaved changes...');
  };

  const handleMarkAll = (status: 'present' | 'absent' | 'late' | 'excused') => {
    // ✅ Student cannot mark all
    if (isStudent) return;
    
    setSheetStudents((prev) => prev.map((s) => ({ ...s, status })));
    setAutoSaveStatus('Unsaved changes...');
  };

  const handleSaveAttendance = async () => {
    if (!selectedSectionId || sheetStudents.length === 0 || isStudent) return;
    
    try {
      setSavingAttendance(true);
      setError(null);
      await markAttendanceBatch(
        sheetStudents.map((s) => ({
          studentId: s.studentId,
          sectionId: selectedSectionId,
          date: selectedDate,
          status: s.status || 'present',
        }))
      );

      setAttendanceSavedSuccess(true);
      setAutoSaveStatus('All changes saved to database');
      setTimeout(() => setAttendanceSavedSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to record attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      `Attendance_${selectedDate}_${isStudent ? 'My' : 'Section'}_${selectedSectionId}`,
      sheetStudents.map((s) => ({
        Date: selectedDate,
        RollNo: s.rollNo || '',
        StudentName: s.name,
        AdmissionNo: s.admissionNo,
        Status: (s.status || 'present').toUpperCase(),
      }))
    );
  };

  const presentCount = sheetStudents.filter((s) => s.status === 'present').length;
  const absentCount = sheetStudents.filter((s) => s.status === 'absent').length;
  const lateCount = sheetStudents.filter((s) => s.status === 'late').length;
  const attendanceRate = sheetStudents.length > 0 ? Math.round((presentCount / sheetStudents.length) * 100) : 0;

  // ✅ Student View
  if (isStudent) {
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <CalendarCheck size={26} style={{ color: 'var(--brand-primary)' }} /> My Attendance
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
              View your personal attendance records and history.
            </p>
          </div>
          <Badge tone="primary">Student View</Badge>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* ✅ Student Attendance Summary Cards - সম্পূর্ণ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Days</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{studentSummary.totalDays || sheetStudents.length}</div>
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Present</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--status-success)' }}>{studentSummary.presentCount || presentCount}</div>
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserX size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Absent</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--status-danger)' }}>{studentSummary.absentCount || absentCount}</div>
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(234, 179, 8, 0.15)', color: 'var(--status-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserMinus size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Late</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--status-warning)' }}>{studentSummary.lateCount || lateCount}</div>
            </div>
          </div>

          {/* ✅ Attendance Rate Card - যোগ করা হয়েছে */}
          <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attendance Rate</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: (studentSummary.attendanceRate || attendanceRate) >= 75 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                {studentSummary.attendanceRate || attendanceRate}%
              </div>
            </div>
          </div>
        </div>

        {/* Student Date Filter */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem', color: 'var(--text-muted)' }}>Select Date</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.85rem', minWidth: '180px' }}
                />
                <Calendar size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>
            <Badge tone="info">{sheetStudents.length} Record{sheetStudents.length > 1 ? 's' : ''}</Badge>
          </div>

          <Button variant="secondary" onClick={handleExportCsv} disabled={sheetStudents.length === 0}>
            <Download size={14} style={{ marginRight: '0.3rem' }} />
            Export CSV
          </Button>
        </div>

        {/* ✅ Student Attendance Table - তারিখ ও বার সহ */}
        {loadingSheet ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            Loading your attendance...
          </div>
        ) : sheetStudents.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
            No attendance records found for the selected date.
          </div>
        ) : (
          <div className="table-container glass-panel" style={{ padding: '0.5rem' }}>
            <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Date</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Day</th>
                  <th style={{ padding: '0.65rem 0.75rem', width: '80px' }}>Roll #</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Student Name</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Admission No</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sheetStudents.map((st, index) => {
                  // ✅ Date format and Day calculation
                  const dateObj = new Date(selectedDate);
                  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const dayName = dayNames[dateObj.getDay()];
                  const formattedDate = dateObj.toLocaleDateString('en-BD', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  });

                  return (
                    <tr key={st.studentId || index} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 500 }}>
                        {formattedDate}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>
                        {dayName}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {st.rollNo || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                        {st.name} {ownStudentId === st.studentId && <Badge tone="primary" style={{ fontSize: '0.6rem', marginLeft: '0.5rem' }}>You</Badge>}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {st.admissionNo}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <Badge tone={
                          st.status === 'present' ? 'success' :
                          st.status === 'late' ? 'warning' :
                          st.status === 'excused' ? 'neutral' : 'danger'
                        }>
                          {st.status?.toUpperCase() || 'ABSENT'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ✅ Admin/Teacher View
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <CalendarCheck size={26} style={{ color: 'var(--brand-primary)' }} /> Student Attendance & Daily Registry
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
            Daily check-ins, section roll call sheets, analytics, and printable CSV registers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleExportCsv} disabled={sheetStudents.length === 0}>
            <Download size={14} style={{ marginRight: '0.3rem' }} />
            Export Sheet (CSV)
          </Button>

          {canTakeAttendance && (
            <Button variant="primary" onClick={handleSaveAttendance} disabled={sheetStudents.length === 0 || savingAttendance}>
              <Save size={14} style={{ marginRight: '0.3rem' }} />
              {savingAttendance ? 'Saving...' : 'Save Daily Attendance'}
            </Button>
          )}
        </div>
      </div>

      {attendanceSavedSuccess && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid var(--status-success)', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} />
          <span>Attendance recorded successfully for {sheetStudents.length} students on {selectedDate}.</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total students</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{sheetStudents.length}</div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Present</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--status-success)' }}>{presentCount}</div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--status-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Absent</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--status-danger)' }}>{absentCount}</div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(234, 179, 8, 0.15)', color: 'var(--status-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attendance Rate</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: attendanceRate >= 75 ? 'var(--primary)' : 'var(--status-danger)' }}>{attendanceRate}%</div>
          </div>
        </div>
      </div>

      {/* Filter and Date Bar */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem', color: 'var(--text-muted)' }}>Class & Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.85rem', minWidth: '180px' }}
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.className} — {sec.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.2rem', color: 'var(--text-muted)' }}>Attendance Date</label>
            <div style={{ position: 'relative' }}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
              />
              <Calendar size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Quick Batch Actions - Teacher/Admin only */}
        {canTakeAttendance && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mark All As:</span>
            <button
              type="button"
              onClick={() => handleMarkAll('present')}
              style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--status-success)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Present
            </button>
            <button
              type="button"
              onClick={() => handleMarkAll('absent')}
              style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Absent
            </button>
            <button
              type="button"
              onClick={() => handleMarkAll('late')}
              style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.1)', color: 'var(--status-warning)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Late
            </button>
          </div>
        )}
      </div>

      {autoSaveStatus && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'right' }}>
          {autoSaveStatus}
        </div>
      )}

      {/* Attendance Sheet Table */}
      {loadingSheet ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
          Loading roll call sheet...
        </div>
      ) : sheetStudents.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          No enrolled students found in this section.
        </div>
      ) : (
        <div className="table-container glass-panel" style={{ padding: '0.5rem' }}>
          <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.65rem 0.75rem', width: '80px' }}>Roll #</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Student Name</th>
                <th style={{ padding: '0.65rem 0.75rem' }}>Admission No</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '320px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {sheetStudents.map((st) => (
                <tr key={st.studentId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {st.rollNo || '—'}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                    {st.name}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {st.admissionNo}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                    {canTakeAttendance ? (
                      <div style={{ display: 'inline-flex', gap: '0.35rem', background: 'var(--surface-sunken)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
                        {(['present', 'absent', 'late', 'excused'] as const).map((statusKey) => {
                          const isCurrent = st.status === statusKey;
                          const bgActive =
                            statusKey === 'present'
                              ? 'var(--status-success)'
                              : statusKey === 'absent'
                              ? 'var(--status-danger)'
                              : statusKey === 'late'
                              ? 'var(--status-warning)'
                              : 'var(--primary)';

                          return (
                            <button
                              key={statusKey}
                              type="button"
                              onClick={() => handleStatusChange(st.studentId, statusKey)}
                              style={{
                                padding: '0.25rem 0.65rem',
                                borderRadius: 'var(--radius-sm)',
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textTransform: 'capitalize',
                                cursor: 'pointer',
                                background: isCurrent ? bgActive : 'transparent',
                                color: isCurrent ? '#ffffff' : 'var(--text-secondary)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {statusKey}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <Badge tone={
                        st.status === 'present' ? 'success' :
                        st.status === 'late' ? 'warning' :
                        st.status === 'excused' ? 'neutral' : 'danger'
                      }>
                        {st.status?.toUpperCase() || 'ABSENT'}
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;