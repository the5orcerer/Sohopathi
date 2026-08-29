import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import {
  fetchSections,
  fetchAttendanceSheet,
  markAttendanceBatch,
  fetchAttendanceSummary,
  fetchAttendanceRecords,
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
} from 'lucide-react';
import { Button, Badge, EmptyState } from '../components/common';

export const AttendancePage: React.FC = () => {
  const { hasPermission } = useSession();
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sheetStudents, setSheetStudents] = useState<AttendanceSheetItem[]>([]);
  const [studentRecords, setStudentRecords] = useState<any[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceSavedSuccess, setAttendanceSavedSuccess] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canTakeAttendance = hasPermission('attendance.create') || hasPermission('classes.manage') || hasPermission('roles.manage');

  // Initial load
  useEffect(() => {
    if (canTakeAttendance) {
      fetchSections()
        .then((secs) => {
          setSections(secs);
          if (secs.length > 0) setSelectedSectionId(secs[0].id);
        })
        .catch(console.error);

      fetchAttendanceSummary().catch(console.error);
    } else {
      // Student: load own attendance history
      setLoadingSheet(true);
      fetchAttendanceRecords()
        .then((records) => setStudentRecords(records))
        .catch((err) => setError(err.message || 'Failed to load attendance records'))
        .finally(() => setLoadingSheet(false));
    }
  }, [canTakeAttendance]);

  // Load attendance sheet when section or date changes (Teacher/Admin)
  useEffect(() => {
    if (!canTakeAttendance || !selectedSectionId) return;
    setLoadingSheet(true);
    setError(null);
    setAttendanceSavedSuccess(false);

    fetchAttendanceSheet(selectedSectionId, selectedDate)
      .then((sheet) => {
        const defaulted = sheet.map((s) => ({
          ...s,
          status: s.status || 'present',
        }));
        setSheetStudents(defaulted);
      })
      .catch((err) => setError(err.message || 'Failed to load attendance sheet'))
      .finally(() => setLoadingSheet(false));
  }, [canTakeAttendance, selectedSectionId, selectedDate]);

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setSheetStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
    setAutoSaveStatus('Unsaved changes...');
  };

  const handleMarkAll = (status: 'present' | 'absent' | 'late' | 'excused') => {
    setSheetStudents((prev) => prev.map((s) => ({ ...s, status })));
    setAutoSaveStatus('Unsaved changes...');
  };

  const handleSaveAttendance = async () => {
    if (!selectedSectionId || sheetStudents.length === 0) return;
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
    if (canTakeAttendance) {
      exportToCsv(
        `Attendance_${selectedDate}_Section_${selectedSectionId}`,
        sheetStudents.map((s) => ({
          Date: selectedDate,
          RollNo: s.rollNo || '',
          StudentName: s.name,
          AdmissionNo: s.admissionNo,
          Status: (s.status || 'present').toUpperCase(),
        }))
      );
    } else {
      exportToCsv(
        `My_Attendance_Report`,
        studentRecords.map((r) => ({
          Date: r.date,
          Status: (r.status || 'present').toUpperCase(),
        }))
      );
    }
  };

  // Student metrics
  const studentPresent = studentRecords.filter((r) => r.status === 'present').length;
  const studentAbsent = studentRecords.filter((r) => r.status === 'absent').length;
  const studentRate = studentRecords.length > 0 ? Math.round((studentPresent / studentRecords.length) * 100) : 100;

  // Teacher metrics
  const presentCount = sheetStudents.filter((s) => s.status === 'present').length;
  const absentCount = sheetStudents.filter((s) => s.status === 'absent').length;
  const attendanceRate = sheetStudents.length > 0 ? Math.round((presentCount / sheetStudents.length) * 100) : 0;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <CalendarCheck size={26} style={{ color: 'var(--brand-primary)' }} /> {canTakeAttendance ? 'Student Attendance & Daily Registry' : 'My Attendance Record & History'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
            {canTakeAttendance ? 'Daily check-ins, section roll call sheets, analytics, and printable CSV registers.' : 'Track your personal daily attendance logs, presence rate, and verified check-ins.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" icon={<Download size={14} />} onClick={handleExportCsv} disabled={canTakeAttendance ? sheetStudents.length === 0 : studentRecords.length === 0}>
            Export Sheet (CSV)
          </Button>

          {canTakeAttendance && (
            <Button variant="primary" icon={<Save size={14} />} onClick={handleSaveAttendance} loading={savingAttendance} disabled={sheetStudents.length === 0}>
              Save Daily Attendance
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{canTakeAttendance ? 'Total Roster' : 'Total Days Marked'}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{canTakeAttendance ? sheetStudents.length : studentRecords.length}</div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(34, 197, 94, 0.15)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Present</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#16a34a' }}>{canTakeAttendance ? presentCount : studentPresent}</div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Absent</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#dc2626' }}>{canTakeAttendance ? absentCount : studentAbsent}</div>
          </div>
        </div>

        <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attendance Rate</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: (canTakeAttendance ? attendanceRate : studentRate) >= 75 ? 'var(--primary)' : '#dc2626' }}>
              {canTakeAttendance ? attendanceRate : studentRate}%
            </div>
          </div>
        </div>
      </div>

      {canTakeAttendance ? (
        <>
          {/* Filter and Date Bar (Teacher / Admin) */}
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

            {/* Quick Batch Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mark All As:</span>
              <button
                type="button"
                onClick={() => handleMarkAll('present')}
                style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(34, 197, 94, 0.3)', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Present
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('absent')}
                style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Absent
              </button>
              <button
                type="button"
                onClick={() => handleMarkAll('late')}
                style={{ padding: '0.35rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(234, 179, 8, 0.3)', background: 'rgba(234, 179, 8, 0.1)', color: '#ca8a04', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Late
              </button>
            </div>
          </div>

          {autoSaveStatus && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'right' }}>
              {autoSaveStatus}
            </div>
          )}

          {/* Attendance Sheet Table (Teacher / Admin) */}
          {loadingSheet ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading roll call sheet...</div>
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
                        <div style={{ display: 'inline-flex', gap: '0.35rem', background: 'var(--surface-sunken)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
                          {(['present', 'absent', 'late', 'excused'] as const).map((statusKey) => {
                            const isCurrent = st.status === statusKey;
                            const bgActive =
                              statusKey === 'present'
                                ? '#16a34a'
                                : statusKey === 'absent'
                                ? '#dc2626'
                                : statusKey === 'late'
                                ? '#ca8a04'
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Student Attendance History Table */
        <div className="table-container glass-panel" style={{ padding: '1rem' }}>
          <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} /> Verified Attendance Check-In History
          </div>
          {loadingSheet ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your attendance records...</div>
          ) : studentRecords.length === 0 ? (
            <EmptyState
              title="No attendance records recorded yet"
              description="Your attendance entries will appear here once marked by your class teachers."
            />
          ) : (
            <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Date</th>
                  <th style={{ padding: '0.65rem 0.75rem' }}>Day</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>Attendance Status</th>
                </tr>
              </thead>
              <tbody>
                {studentRecords.map((r, idx) => {
                  const dateObj = new Date(r.date);
                  const dayName = isNaN(dateObj.getTime()) ? '' : dateObj.toLocaleDateString(undefined, { weekday: 'long' });
                  return (
                    <tr key={r.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        {r.date}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>
                        {dayName}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <Badge tone={r.status === 'present' ? 'success' : r.status === 'absent' ? 'danger' : 'warning'}>
                          {(r.status || 'present').toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
