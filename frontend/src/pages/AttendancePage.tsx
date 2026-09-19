import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchSections,
  fetchAttendanceSheet,
  markAttendanceBatch,
  fetchEmployeeAttendance,
  markEmployeeAttendanceBatch,
  exportToCsv,
  dispatchReminder,
} from '../services/api';
import type { SectionItem, AttendanceSheetItem, EmployeeAttendanceItem } from '../types';
import {
  CalendarCheck,
  Download,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Users,
  Save,
  Loader2,
  Briefcase,
  Search,
  Bell,
  UserCheck,
} from 'lucide-react';
import { Button, Badge, Pagination } from '../components/common';

interface AttendancePageProps {
  initialTab?: 'students' | 'employees';
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ initialTab = 'students' }) => {
  const { t } = useLanguage();
  const { activeMembership } = useSession();

  // Active top-level tab: Students vs Employees
  const [activeTab, setActiveTab] = useState<'students' | 'employees'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Role & Permissions
  const role = activeMembership?.roleName?.toLowerCase() || '';
  const isStudent = role.includes('student');
  const canTakeAttendance = !isStudent;

  // -------------------------------------------------------------
  // 1. STUDENT ATTENDANCE STATE
  // -------------------------------------------------------------
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [sessionType, setSessionType] = useState<string>('daily');
  const [periodNumber, setPeriodNumber] = useState<number>(1);
  const [auditReason, setAuditReason] = useState<string>('');
  const [sheetStudents, setSheetStudents] = useState<AttendanceSheetItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(true);
  const [savingStudents, setSavingStudents] = useState<boolean>(false);
  const [studentSavedSuccess, setStudentSavedSuccess] = useState<boolean>(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  // Student Pagination
  const [studentPage, setStudentPage] = useState<number>(1);
  const [studentPageSize, setStudentPageSize] = useState<number>(15);

  // -------------------------------------------------------------
  // 2. EMPLOYEE ATTENDANCE STATE
  // -------------------------------------------------------------
  const [employeeDate, setEmployeeDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [employeeRecords, setEmployeeRecords] = useState<EmployeeAttendanceItem[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState<boolean>(false);
  const [savingEmployees, setSavingEmployees] = useState<boolean>(false);
  const [employeeSavedSuccess, setEmployeeSavedSuccess] = useState<boolean>(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [employeeAuditReason, setEmployeeAuditReason] = useState<string>('');

  // Employee Filters & Pagination
  const [employeeSearch, setEmployeeSearch] = useState<string>('');
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<string>('all');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<string>('all');
  const [employeePage, setEmployeePage] = useState<number>(1);
  const [employeePageSize, setEmployeePageSize] = useState<number>(15);

  // Absent Guardian Notification & Self Check-in State
  const [notifyingGuardians, setNotifyingGuardians] = useState(false);
  const [guardianNotifyMsg, setGuardianNotifyMsg] = useState<string | null>(null);
  const [selfCheckinLoading, setSelfCheckinLoading] = useState(false);
  const [selfCheckinMsg, setSelfCheckinMsg] = useState<string | null>(null);

  const handleNotifyAbsentGuardians = async () => {
    const absentStudents = sheetStudents.filter((s) => s.status === 'absent');
    if (absentStudents.length === 0) {
      alert(`No absent students found for ${selectedDate}`);
      return;
    }
    try {
      setNotifyingGuardians(true);
      await dispatchReminder({
        title: `Absence Notice: ${selectedDate}`,
        body: `Your student was marked absent today (${selectedDate}). Please review and submit a leave request if needed.`,
        priority: 'high',
        createTask: true,
      });
      setGuardianNotifyMsg(`Successfully notified guardians and created attendance tasks for ${absentStudents.length} absent student(s).`);
      setTimeout(() => setGuardianNotifyMsg(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch absence notifications');
    } finally {
      setNotifyingGuardians(false);
    }
  };

  const handleSelfCheckin = async (status: 'present' | 'absent') => {
    if (!activeMembership?.id) return;
    try {
      setSelfCheckinLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      await markEmployeeAttendanceBatch([
        {
          membershipId: activeMembership.id,
          date: today,
          status,
          checkInTime: status === 'present' ? timeStr : undefined,
          notes: 'Self check-in via web portal',
        },
      ]);
      setSelfCheckinMsg(`Self check-in recorded as ${status.toUpperCase()} successfully!`);
      setTimeout(() => setSelfCheckinMsg(null), 5000);
      loadEmployeeData(employeeDate);
    } catch (err: any) {
      alert(err.message || 'Failed to record self attendance');
    } finally {
      setSelfCheckinLoading(false);
    }
  };

  // Load sections on mount
  useEffect(() => {
    fetchSections()
      .then((data) => {
        const sectionList = data || [];
        setSections(sectionList);
        if (sectionList.length > 0 && !selectedSectionId) {
          setSelectedSectionId(sectionList[0].id);
        } else {
          setLoadingStudents(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load sections', err);
        setLoadingStudents(false);
      });
  }, []);

  // Load student attendance sheet
  const loadStudentSheet = async (
    sectionId: string,
    date: string,
    sType: string = sessionType,
    pNum: number = periodNumber
  ) => {
    if (!sectionId) {
      setLoadingStudents(false);
      return;
    }
    try {
      setLoadingStudents(true);
      setStudentError(null);
      setStudentSavedSuccess(false);
      const data = await fetchAttendanceSheet(sectionId, date, sType, pNum);
      setSheetStudents(data || []);
    } catch (err: any) {
      setStudentError(err.message || 'Failed to load student attendance records');
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (selectedSectionId) {
      loadStudentSheet(selectedSectionId, selectedDate, sessionType, periodNumber);
    }
  }, [selectedSectionId, selectedDate, sessionType, periodNumber]);

  // Load employee attendance records
  const loadEmployeeData = async (date: string) => {
    try {
      setLoadingEmployees(true);
      setEmployeeError(null);
      setEmployeeSavedSuccess(false);
      const data = await fetchEmployeeAttendance({ date });
      setEmployeeRecords(data.employees || []);
    } catch (err: any) {
      setEmployeeError(err.message || 'Failed to load employee attendance records');
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'employees') {
      loadEmployeeData(employeeDate);
    }
  }, [activeTab, employeeDate]);

  // Student Attendance Handlers
  const handleStudentStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setSheetStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
    setStudentSavedSuccess(false);
  };

  const handleMarkAllStudents = (status: 'present' | 'absent' | 'late' | 'excused') => {
    setSheetStudents((prev) => prev.map((s) => ({ ...s, status })));
    setStudentSavedSuccess(false);
  };

  const handleSaveStudentAttendance = async () => {
    if (!selectedSectionId || sheetStudents.length === 0) return;
    try {
      setSavingStudents(true);
      setStudentError(null);
      const records = sheetStudents.map((s) => ({
        studentId: s.studentId,
        sectionId: selectedSectionId,
        date: selectedDate,
        status: s.status || 'present',
        sessionType,
        periodNumber,
        reason: auditReason.trim() || undefined,
      }));
      await markAttendanceBatch(records);
      setStudentSavedSuccess(true);
      setAuditReason('');
      setTimeout(() => setStudentSavedSuccess(false), 4000);
    } catch (err: any) {
      setStudentError(err.message || 'Failed to save student attendance');
    } finally {
      setSavingStudents(false);
    }
  };

  const handleExportStudentCsv = () => {
    const activeSection = sections.find((s) => s.id === selectedSectionId);
    const rows = sheetStudents.map((s) => ({
      Date: selectedDate,
      SessionType: sessionType,
      Period: periodNumber,
      Class: activeSection?.className || '',
      Section: activeSection?.name || '',
      RollNo: s.rollNo,
      AdmissionNo: s.admissionNo,
      StudentName: s.name,
      Status: (s.status || 'present').toUpperCase(),
    }));
    exportToCsv(`student-attendance-${selectedDate}-${sessionType}-p${periodNumber}.csv`, rows);
  };

  // Employee Attendance Handlers
  const handleEmployeeFieldChange = (
    membershipId: string,
    field: 'status' | 'checkInTime' | 'checkOutTime' | 'notes',
    value: string
  ) => {
    setEmployeeRecords((prev) =>
      prev.map((rec) => (rec.membershipId === membershipId ? { ...rec, [field]: value } : rec))
    );
    setEmployeeSavedSuccess(false);
  };

  const handleMarkAllEmployees = (status: 'present' | 'absent' | 'late' | 'on_leave') => {
    setEmployeeRecords((prev) =>
      prev.map((rec) => ({
        ...rec,
        status,
        checkInTime: status === 'present' ? (rec.checkInTime || '09:00') : rec.checkInTime,
      }))
    );
    setEmployeeSavedSuccess(false);
  };

  const handleSaveEmployeeAttendance = async () => {
    if (employeeRecords.length === 0) return;
    try {
      setSavingEmployees(true);
      setEmployeeError(null);
      const records = employeeRecords.map((rec) => ({
        membershipId: rec.membershipId,
        date: employeeDate,
        status: rec.status,
        checkInTime: rec.checkInTime || undefined,
        checkOutTime: rec.checkOutTime || undefined,
        notes: rec.notes || undefined,
        reason: employeeAuditReason.trim() || undefined,
      }));
      await markEmployeeAttendanceBatch(records);
      setEmployeeSavedSuccess(true);
      setEmployeeAuditReason('');
      setTimeout(() => setEmployeeSavedSuccess(false), 4000);
    } catch (err: any) {
      setEmployeeError(err.message || 'Failed to save employee attendance');
    } finally {
      setSavingEmployees(false);
    }
  };

  const handleExportEmployeeCsv = () => {
    const rows = employeeRecords.map((rec) => ({
      Date: employeeDate,
      EmployeeName: rec.name,
      Role: rec.roleName,
      Status: rec.status.toUpperCase(),
      CheckIn: rec.checkInTime || '—',
      CheckOut: rec.checkOutTime || '—',
      Notes: rec.notes || '',
    }));
    exportToCsv(`employee-attendance-${employeeDate}.csv`, rows);
  };

  // Filtered & Paginated Employees
  const filteredEmployees = useMemo(() => {
    return employeeRecords.filter((rec) => {
      const matchesSearch =
        rec.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
        (rec.email && rec.email.toLowerCase().includes(employeeSearch.toLowerCase()));
      const matchesRole = employeeRoleFilter === 'all' || rec.roleName === employeeRoleFilter;
      const matchesStatus = employeeStatusFilter === 'all' || rec.status === employeeStatusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [employeeRecords, employeeSearch, employeeRoleFilter, employeeStatusFilter]);

  const paginatedEmployees = useMemo(() => {
    const start = (employeePage - 1) * employeePageSize;
    return filteredEmployees.slice(start, start + employeePageSize);
  }, [filteredEmployees, employeePage, employeePageSize]);

  // Paginated Students
  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * studentPageSize;
    return sheetStudents.slice(start, start + studentPageSize);
  }, [sheetStudents, studentPage, studentPageSize]);

  // Student KPI Computations
  const studentPresent = sheetStudents.filter((s) => s.status === 'present').length;
  const studentAbsent = sheetStudents.filter((s) => s.status === 'absent').length;
  const studentLate = sheetStudents.filter((s) => s.status === 'late').length;
  const studentExcused = sheetStudents.filter((s) => s.status === 'excused').length;
  const studentRate = sheetStudents.length > 0 ? Math.round((studentPresent / sheetStudents.length) * 100) : 0;

  // Employee KPI Computations
  const empPresent = employeeRecords.filter((e) => e.status === 'present').length;
  const empAbsent = employeeRecords.filter((e) => e.status === 'absent').length;
  const empLate = employeeRecords.filter((e) => e.status === 'late').length;
  const empExcused = employeeRecords.filter((e) => e.status === 'on_leave').length;
  const empRate = employeeRecords.length > 0 ? Math.round((empPresent / employeeRecords.length) * 100) : 0;

  // Distinct Employee Roles for filter
  const distinctRoles = useMemo(() => {
    const rolesSet = new Set<string>();
    employeeRecords.forEach((r) => {
      if (r.roleName) rolesSet.add(r.roleName);
    });
    return Array.from(rolesSet);
  }, [employeeRecords]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header & Tab Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, color: 'var(--text-primary)' }}>
            <CalendarCheck size={26} style={{ color: 'var(--brand-primary)' }} /> {t('attendance.title', 'Attendance & Presence Tracking')}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
            {t('attendance.subtitle', 'Daily attendance recording, roll call registers, and staff presence management.')}
          </p>
        </div>

        {/* Segmented Dual Tab Switcher */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-sunken)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('students')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'students' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'students' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'students' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={16} /> {t('attendance.student_tab', 'Students Roll Call')}
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'employees' ? 'var(--surface)' : 'transparent',
              color: activeTab === 'employees' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'employees' ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Briefcase size={16} /> {t('attendance.employee_tab', 'Employee & Staff Attendance')}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: STUDENTS ROLL CALL                                */}
      {/* ========================================================= */}
      {activeTab === 'students' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '1rem',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Section:</span>
                <select
                  value={selectedSectionId}
                  onChange={(e) => {
                    setSelectedSectionId(e.target.value);
                    setStudentPage(1);
                  }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    minWidth: '180px',
                  }}
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.className} - {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Model:</span>
                <select
                  value={sessionType}
                  onChange={(e) => {
                    setSessionType(e.target.value);
                    if (e.target.value === 'daily') setPeriodNumber(1);
                  }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="daily">Daily Attendance</option>
                  <option value="period">Period-wise</option>
                  <option value="start_end">Morning / Afternoon</option>
                </select>
              </div>

              {sessionType === 'period' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period:</span>
                  <select
                    value={periodNumber}
                    onChange={(e) => setPeriodNumber(parseInt(e.target.value, 10))}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-sunken)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                      <option key={p} value={p}>
                        Period {p}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sessionType === 'start_end' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Session:</span>
                  <select
                    value={periodNumber}
                    onChange={(e) => setPeriodNumber(parseInt(e.target.value, 10))}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-sunken)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <option value={1}>Morning Check-in</option>
                    <option value={2}>Afternoon Check-out</option>
                  </select>
                </div>
              )}

              {canTakeAttendance && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Audit reason (if modifying)..."
                    value={auditReason}
                    onChange={(e) => setAuditReason(e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--surface-sunken)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      width: '200px',
                    }}
                    title="Required by audit policy when modifying previously saved attendance"
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {canTakeAttendance && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => handleMarkAllStudents('present')}>
                    Mark All Present
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleMarkAllStudents('absent')}>
                    Mark All Absent
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveStudentAttendance}
                    disabled={savingStudents}
                    icon={savingStudents ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  >
                    {savingStudents ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </>
              )}
              <Button variant="secondary" size="sm" onClick={handleExportStudentCsv} icon={<Download size={14} />}>
                Export CSV
              </Button>
              {canTakeAttendance && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleNotifyAbsentGuardians}
                  disabled={notifyingGuardians}
                  icon={notifyingGuardians ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                >
                  Notify Absent Guardians
                </Button>
              )}
            </div>
          </div>

          {/* Feedback Banners */}
          {guardianNotifyMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid var(--primary)',
                color: 'var(--primary)',
                fontSize: '0.85rem',
              }}
            >
              <CheckCircle2 size={16} /> {guardianNotifyMsg}
            </div>
          )}
          {studentSavedSuccess && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid var(--status-success)',
                color: 'var(--status-success)',
                fontSize: '0.85rem',
              }}
            >
              <CheckCircle2 size={16} /> Student attendance saved successfully to database!
            </div>
          )}

          {studentError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={16} /> {studentError}
            </div>
          )}

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Enrolled</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{sheetStudents.length}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)', fontWeight: 600, textTransform: 'uppercase' }}>Present</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--status-success)', marginTop: '0.2rem' }}>{studentPresent}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', fontWeight: 600, textTransform: 'uppercase' }}>Absent</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--status-danger)', marginTop: '0.2rem' }}>{studentAbsent}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-warning)', fontWeight: 600, textTransform: 'uppercase' }}>Late / Excused</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--status-warning)', marginTop: '0.2rem' }}>{studentLate + studentExcused}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600, textTransform: 'uppercase' }}>Attendance Rate</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--brand-primary)', marginTop: '0.2rem' }}>{studentRate}%</div>
            </div>
          </div>

          {/* Student Roll Call Table */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {loadingStudents ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <span>Loading student records...</span>
              </div>
            ) : sections.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No class sections found. Please configure academic classes and sections first.
              </div>
            ) : !selectedSectionId ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Please select a section above to view the roll call sheet.
              </div>
            ) : sheetStudents.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No students enrolled in this section.
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem', width: '80px' }}>Roll</th>
                        <th style={{ padding: '0.75rem 1rem', width: '130px' }}>Admission No</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Student Name</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Attendance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedStudents.map((st) => (
                        <tr key={st.studentId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{st.rollNo || '—'}</td>
                          <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{st.admissionNo}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{st.name}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.25rem', background: 'var(--surface-sunken)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
                              {(['present', 'absent', 'late', 'excused'] as const).map((statusKey) => {
                                const isCurrent = st.status === statusKey;
                                const activeColor =
                                  statusKey === 'present' ? '#16a34a' : statusKey === 'absent' ? '#dc2626' : statusKey === 'late' ? '#ca8a04' : '#475569';
                                return (
                                  <button
                                    key={statusKey}
                                    type="button"
                                    onClick={() => handleStudentStatusChange(st.studentId, statusKey)}
                                    style={{
                                      padding: '0.25rem 0.65rem',
                                      borderRadius: 'var(--radius-sm)',
                                      border: 'none',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      textTransform: 'capitalize',
                                      cursor: 'pointer',
                                      background: isCurrent ? activeColor : 'transparent',
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

                <div style={{ padding: '0.75rem 1rem' }}>
                  <Pagination
                    currentPage={studentPage}
                    totalItems={sheetStudents.length}
                    pageSize={studentPageSize}
                    onPageChange={setStudentPage}
                    onPageSizeChange={(newSize) => {
                      setStudentPageSize(newSize);
                      setStudentPage(1);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: EMPLOYEE & STAFF ATTENDANCE                       */}
      {/* ========================================================= */}
      {activeTab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '1rem',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="date"
                  value={employeeDate}
                  onChange={(e) => setEmployeeDate(e.target.value)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
                  value={employeeSearch}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value);
                    setEmployeePage(1);
                  }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    minWidth: '220px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Role:</span>
                <select
                  value={employeeRoleFilter}
                  onChange={(e) => {
                    setEmployeeRoleFilter(e.target.value);
                    setEmployeePage(1);
                  }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="all">All Roles</option>
                  {distinctRoles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
                <select
                  value={employeeStatusFilter}
                  onChange={(e) => {
                    setEmployeeStatusFilter(e.target.value);
                    setEmployeePage(1);
                  }}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Audit reason (if modifying)..."
                  value={employeeAuditReason}
                  onChange={(e) => setEmployeeAuditReason(e.target.value)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    width: '200px',
                  }}
                  title="Required by audit policy when modifying previously saved employee attendance"
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button variant="secondary" size="sm" onClick={() => handleMarkAllEmployees('present')}>
                Mark All Present
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleMarkAllEmployees('late')}>
                Mark All Late
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEmployeeAttendance}
                disabled={savingEmployees}
                icon={savingEmployees ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              >
                {savingEmployees ? 'Saving...' : 'Save Staff Attendance'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportEmployeeCsv} icon={<Download size={14} />}>
                Export CSV
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSelfCheckin('present')}
                disabled={selfCheckinLoading}
                icon={selfCheckinLoading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
              >
                Self Check-in
              </Button>
            </div>
          </div>

          {/* Feedback Banners */}
          {selfCheckinMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid var(--primary)',
                color: 'var(--primary)',
                fontSize: '0.85rem',
              }}
            >
              <CheckCircle2 size={16} /> {selfCheckinMsg}
            </div>
          )}
          {employeeSavedSuccess && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid var(--status-success)',
                color: 'var(--status-success)',
                fontSize: '0.85rem',
              }}
            >
              <CheckCircle2 size={16} /> Staff attendance saved successfully to database!
            </div>
          )}

          {employeeError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--status-danger)',
                color: 'var(--status-danger)',
                fontSize: '0.85rem',
              }}
            >
              <AlertCircle size={16} /> {employeeError}
            </div>
          )}

          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Staff</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{employeeRecords.length}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-success)', fontWeight: 600, textTransform: 'uppercase' }}>Present</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--status-success)', marginTop: '0.2rem' }}>{empPresent}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-danger)', fontWeight: 600, textTransform: 'uppercase' }}>Absent</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--status-danger)', marginTop: '0.2rem' }}>{empAbsent}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--status-warning)', fontWeight: 600, textTransform: 'uppercase' }}>Late / Leave</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--status-warning)', marginTop: '0.2rem' }}>{empLate + empExcused}</div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600, textTransform: 'uppercase' }}>Staff Attendance Rate</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--brand-primary)', marginTop: '0.2rem' }}>{empRate}%</div>
            </div>
          </div>

          {/* Employee Attendance Table */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {loadingEmployees ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                <span>Loading staff attendance records...</span>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No staff members match the selected criteria.
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>Staff Member</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Role</th>
                        <th style={{ padding: '0.75rem 1rem', width: '110px' }}>Check In</th>
                        <th style={{ padding: '0.75rem 1rem', width: '110px' }}>Check Out</th>
                        <th style={{ padding: '0.75rem 1rem', width: '220px' }}>Notes / Remarks</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEmployees.map((rec) => (
                        <tr key={rec.membershipId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.name}</div>
                            {rec.email && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{rec.email}</div>}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <Badge tone={rec.roleName.toLowerCase().includes('admin') ? 'warning' : 'primary'}>
                              {rec.roleName}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <input
                              type="time"
                              value={rec.checkInTime || ''}
                              onChange={(e) => handleEmployeeFieldChange(rec.membershipId, 'checkInTime', e.target.value)}
                              style={{
                                padding: '0.25rem 0.4rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--surface-sunken)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                width: '100%',
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <input
                              type="time"
                              value={rec.checkOutTime || ''}
                              onChange={(e) => handleEmployeeFieldChange(rec.membershipId, 'checkOutTime', e.target.value)}
                              style={{
                                padding: '0.25rem 0.4rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--surface-sunken)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                width: '100%',
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <input
                              type="text"
                              placeholder="e.g. Leave approved"
                              value={rec.notes || ''}
                              onChange={(e) => handleEmployeeFieldChange(rec.membershipId, 'notes', e.target.value)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--surface-sunken)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8rem',
                                width: '100%',
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.25rem', background: 'var(--surface-sunken)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
                              {(['present', 'absent', 'late', 'on_leave'] as const).map((statusKey) => {
                                const isCurrent = rec.status === statusKey;
                                const activeColor =
                                  statusKey === 'present' ? '#16a34a' : statusKey === 'absent' ? '#dc2626' : statusKey === 'late' ? '#ca8a04' : '#475569';
                                return (
                                  <button
                                    key={statusKey}
                                    type="button"
                                    onClick={() => handleEmployeeFieldChange(rec.membershipId, 'status', statusKey)}
                                    style={{
                                      padding: '0.25rem 0.65rem',
                                      borderRadius: 'var(--radius-sm)',
                                      border: 'none',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      textTransform: 'capitalize',
                                      cursor: 'pointer',
                                      background: isCurrent ? activeColor : 'transparent',
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

                <div style={{ padding: '0.75rem 1rem' }}>
                  <Pagination
                    currentPage={employeePage}
                    totalItems={filteredEmployees.length}
                    pageSize={employeePageSize}
                    onPageChange={setEmployeePage}
                    onPageSizeChange={(newSize) => {
                      setEmployeePageSize(newSize);
                      setEmployeePage(1);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
