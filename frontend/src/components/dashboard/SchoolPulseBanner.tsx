import React, { useState, useEffect } from 'react';
import {
  fetchAdmissionStats,
  fetchAttendanceSummary,
  fetchClasses,
  fetchStudents,
  fetchMembers,
  exportToCsv,
} from '../../services/api';
import {
  GraduationCap,
  Users,
  CalendarCheck,
  UserPlus,
  BookOpen,
  TrendingUp,
  BarChart3,
  Download,
  ArrowUpRight,
  Layers,
  Receipt,
  Bell,
  FileCheck,
  Award,
} from 'lucide-react';
import { Button, Badge } from '../common';
import { useSession } from '../../context/SessionContext';
import { useLanguage } from '../../context/LanguageContext';

interface SchoolPulseBannerProps {
  onNavigate: (path: string) => void;
}

export const SchoolPulseBanner: React.FC<SchoolPulseBannerProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { activeMembership, hasPermission } = useSession();
  const role = (activeMembership?.roleName || '').toLowerCase();
  const isStudent = role.includes('student');
  const isGuardian = role.includes('guardian');
  const isTeacher = role.includes('teacher');
  const isAdmin = role.includes('admin') || (!isStudent && !isGuardian && !isTeacher);

  const canReadStudents = (hasPermission('students.read') || isAdmin) && !isStudent && !isGuardian;
  const canReadMembers = (hasPermission('members.read') || hasPermission('roles.manage') || isAdmin) && !isStudent && !isGuardian;
  const canReadClasses = hasPermission('classes.manage') || hasPermission('academic.read') || isTeacher || isAdmin;
  const canReadAttendance = hasPermission('attendance.read') || hasPermission('attendance.create') || isStudent || isTeacher || isAdmin;
  const canReadAdmissions = (hasPermission('admissions.read') || hasPermission('admissions.manage') || isAdmin) && !isStudent && !isGuardian;
  const canReadReports = (hasPermission('reports.read') || isAdmin) && !isStudent && !isGuardian;

  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [classCount, setClassCount] = useState<number>(0);
  const [attendanceRate, setAttendanceRate] = useState<number>(0);
  const [pendingAdmissions, setPendingAdmissions] = useState<number>(0);
  const [admittedCount, setAdmittedCount] = useState<number>(0);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadPulseData = async () => {
      try {
        const promises: Promise<any>[] = [];
        if (canReadStudents) {
          promises.push(fetchStudents().then((res) => ({ type: 'students', res })).catch(() => null));
        }
        if (canReadMembers) {
          promises.push(fetchMembers().then((res) => ({ type: 'members', res })).catch(() => null));
        }
        if (canReadClasses) {
          promises.push(fetchClasses().then((res) => ({ type: 'classes', res })).catch(() => null));
        }
        if (canReadAdmissions) {
          promises.push(fetchAdmissionStats().then((res) => ({ type: 'admissions', res })).catch(() => null));
        }
        if (canReadAttendance) {
          promises.push(fetchAttendanceSummary().then((res) => ({ type: 'attendance', res })).catch(() => null));
        }

        const results = await Promise.all(promises);
        if (!isMounted) return;

        for (const item of results) {
          if (!item) continue;
          if (item.type === 'students' && Array.isArray(item.res)) {
            setStudentCount(item.res.length);
          } else if (item.type === 'members' && Array.isArray(item.res)) {
            setMemberCount(item.res.length);
          } else if (item.type === 'classes' && Array.isArray(item.res)) {
            setClassCount(item.res.length);
          } else if (item.type === 'admissions' && item.res?.summary) {
            setPendingAdmissions(item.res.summary.under_review || item.res.summary.submitted || 0);
            setAdmittedCount(item.res.summary.admitted || 0);
          } else if (item.type === 'attendance' && Array.isArray(item.res) && item.res.length > 0) {
            const total = item.res.reduce((acc: number, curr: any) => acc + (curr.totalStudents || 0), 0);
            const present = item.res.reduce((acc: number, curr: any) => acc + (curr.presentCount || 0), 0);
            if (total > 0) {
              setAttendanceRate(Math.round((present / total) * 100));
            }
          }
        }
      } catch (e) {
        console.error('Failed to load pulse data', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPulseData();
    return () => {
      isMounted = false;
    };
  }, [canReadStudents, canReadMembers, canReadClasses, canReadAdmissions, canReadAttendance]);

  const handleExportFullSchoolReport = () => {
    const reportData = [
      { Metric: 'Total Enrolled Students', Value: studentCount },
      { Metric: 'Faculty & Administrative Staff', Value: memberCount },
      { Metric: 'Active Academic Classes', Value: classCount },
      { Metric: "Average Daily Attendance Rate", Value: `${attendanceRate}%` },
      { Metric: 'Pending Admission Applications', Value: pendingAdmissions },
      { Metric: 'Admitted This Term', Value: admittedCount },
      { Metric: 'Generated Timestamp', Value: new Date().toISOString() },
    ];
    exportToCsv(`School_Overview_Report_${new Date().toISOString().split('T')[0]}`, reportData);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '1rem',
        }}
      >
        {isStudent || isGuardian ? (
          <>
            {/* Student: Daily Attendance */}
            <div
              onClick={() => onNavigate('/attendance')}
              className="glass-panel"
              style={{
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('dashboard.attendance_rate', 'Daily Attendance')}
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(30, 95, 91, 0.15)',
                    color: 'var(--brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CalendarCheck size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {loading ? '...' : `${attendanceRate}%`}
                </span>
                <span style={{ fontSize: '0.75rem', color: attendanceRate >= 80 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                  {attendanceRate >= 80 ? t('dashboard.healthy', 'Present') : t('dashboard.below_target', 'Below Target')}
                </span>
              </div>
            </div>

            {/* Student: Active Classes & Courses */}
            <div
              onClick={() => onNavigate('/academic')}
              className="glass-panel"
              style={{
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('dashboard.active_classes', 'Academic Classes')}
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: 'var(--status-warning)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookOpen size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {loading ? '...' : classCount}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('dashboard.active_status', 'Enrolled')}</span>
              </div>
            </div>

            {/* Student: Coursework & Homework */}
            <div
              onClick={() => onNavigate('/assignments')}
              className="glass-panel"
              style={{
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('nav.assignments', 'Assignments')}
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(99, 102, 241, 0.12)',
                    color: 'var(--brand-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileCheck size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {t('common.active', 'Active')}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--status-success)', display: 'flex', alignItems: 'center' }}>
                  <ArrowUpRight size={12} /> View Tasks
                </span>
              </div>
            </div>

            {/* Student: Examination Marks */}
            <div
              onClick={() => onNavigate('/examinations')}
              className="glass-panel"
              style={{
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('nav.examinations', 'Examinations')}
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(147, 51, 234, 0.12)',
                    color: '#9333ea',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Award size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Published
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}>Mark sheets</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Total Students */}
            {canReadStudents && (
              <div
                onClick={() => onNavigate('/students')}
                className="glass-panel"
                style={{
                  padding: '1rem 1.15rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('dashboard.students_enrolled', 'Enrolled Students')}
                  </span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(99, 102, 241, 0.12)',
                      color: 'var(--brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GraduationCap size={18} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {loading ? '...' : studentCount}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--status-success)', display: 'flex', alignItems: 'center' }}>
                    <ArrowUpRight size={12} /> {t('dashboard.active_status', 'Active')}
                  </span>
                </div>
              </div>
            )}

            {/* Faculty & Staff */}
            {canReadMembers && (
              <div
                onClick={() => onNavigate('/members')}
                className="glass-panel"
                style={{
                  padding: '1rem 1.15rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('dashboard.faculty_staff', 'Faculty & Staff')}
                  </span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: 'var(--status-success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Users size={18} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {loading ? '...' : memberCount}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('dashboard.members_label', 'Members')}</span>
                </div>
              </div>
            )}

            {/* Classes & Sections */}
            {canReadClasses && (
              <div
                onClick={() => onNavigate('/academic')}
                className="glass-panel"
                style={{
                  padding: '1rem 1.15rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('dashboard.active_classes', 'Academic Classes')}
                  </span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: 'var(--status-warning)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BookOpen size={18} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {loading ? '...' : classCount}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('dashboard.active_status', 'Active')}</span>
                </div>
              </div>
            )}

            {/* Attendance Rate */}
            {canReadAttendance && (
              <div
                onClick={() => onNavigate('/attendance')}
                className="glass-panel"
                style={{
                  padding: '1rem 1.15rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('dashboard.attendance_rate', 'Daily Attendance')}
                  </span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(30, 95, 91, 0.15)',
                      color: 'var(--brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CalendarCheck size={18} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {loading ? '...' : `${attendanceRate}%`}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: attendanceRate >= 80 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    {attendanceRate >= 80 ? t('dashboard.healthy', 'Healthy') : t('dashboard.below_target', 'Below Target')}
                  </span>
                </div>
              </div>
            )}

            {/* Prospective Admissions */}
            {canReadAdmissions && (
              <div
                onClick={() => onNavigate('/admissions')}
                className="glass-panel"
                style={{
                  padding: '1rem 1.15rem',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('dashboard.pending_admissions', 'New Admissions')}
                  </span>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(147, 51, 234, 0.12)',
                      color: '#9333ea',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UserPlus size={18} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {loading ? '...' : pendingAdmissions}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--status-warning)' }}>{t('dashboard.pending_review', 'Pending Review')}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Action Shortcuts & Analytics Toggle */}
      <div
        className="glass-panel"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>
            {t('dashboard.quick_actions', 'Quick Operational Shortcuts')}:
          </span>

          {/* Role & Permission-based dynamic action buttons */}
          {isStudent || isGuardian ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/attendance')}>
                <CalendarCheck size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.attendance', 'My Attendance')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/assignments')}>
                <BookOpen size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.assignments', 'Assignments')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/examinations')}>
                <Award size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.examinations', 'Examinations')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/notices')}>
                <Bell size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.notices', 'Notice Board')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/requests')}>
                <FileCheck size={13} style={{ marginRight: '0.35rem' }} /> {t('requests.new_request', 'Submit Request')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/fees')}>
                <Receipt size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.finance', 'Fee Invoices')}
              </Button>
            </>
          ) : isTeacher ? (
            <>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/attendance')}>
                <CalendarCheck size={13} style={{ marginRight: '0.35rem' }} /> {t('dashboard.take_attendance', 'Class Attendance')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/assignments')}>
                <BookOpen size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.assignments', 'Assignments')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/examinations')}>
                <Award size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.examinations', 'Examinations & Marks')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/academic')}>
                <Layers size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.academic', 'Classes & Sections')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/notices')}>
                <Bell size={13} style={{ marginRight: '0.35rem' }} /> {t('dashboard.create_notice', 'New Notice')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onNavigate('/requests')}>
                <FileCheck size={13} style={{ marginRight: '0.35rem' }} /> {t('dashboard.review_requests', 'Review Requests')}
              </Button>
            </>
          ) : (
            <>
              {(hasPermission('attendance.create') || hasPermission('attendance.read') || isAdmin) && (
                <Button variant="secondary" size="sm" onClick={() => onNavigate('/attendance')}>
                  <CalendarCheck size={13} style={{ marginRight: '0.35rem' }} /> {t('dashboard.take_attendance', 'Take Attendance')}
                </Button>
              )}
              {(hasPermission('fees.manage') || hasPermission('fees.read') || isAdmin) && (
                <Button variant="secondary" size="sm" onClick={() => onNavigate('/fees')}>
                  <Receipt size={13} style={{ marginRight: '0.35rem' }} /> {t('dashboard.collect_fees', 'Collect Fees')}
                </Button>
              )}
              {(hasPermission('admissions.manage') || hasPermission('admissions.read') || isAdmin) && (
                <Button variant="secondary" size="sm" onClick={() => onNavigate('/admissions')}>
                  <UserPlus size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.admissions', 'Admissions')}
                </Button>
              )}
              {(hasPermission('notices.create') || hasPermission('notices.read') || isAdmin) && (
                <Button variant="secondary" size="sm" onClick={() => onNavigate('/notices')}>
                  <Bell size={13} style={{ marginRight: '0.35rem' }} /> {t('dashboard.create_notice', 'New Notice')}
                </Button>
              )}
              {(hasPermission('requests.create') || hasPermission('requests.read') || isAdmin) && (
                <Button variant="secondary" size="sm" onClick={() => onNavigate('/requests')}>
                  <FileCheck size={13} style={{ marginRight: '0.35rem' }} /> {t('dashboard.review_requests', 'Review Requests')}
                </Button>
              )}
              {(hasPermission('students.read') || isAdmin) && (
                <Button variant="secondary" size="sm" onClick={() => onNavigate('/students')}>
                  <GraduationCap size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.students', 'Students')}
                </Button>
              )}
              {(hasPermission('classes.manage') || isAdmin) && (
                <Button variant="secondary" size="sm" onClick={() => onNavigate('/academic')}>
                  <Layers size={13} style={{ marginRight: '0.35rem' }} /> {t('nav.academic', 'Classes & Sections')}
                </Button>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {canReadReports && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('/reports')}
            >
              <BarChart3 size={13} style={{ marginRight: '0.35rem' }} />
              {t('dashboard.reports_center', 'Reports Center')}
            </Button>
          )}
          {!isStudent && !isGuardian && (
            <Button
              variant={showAnalytics ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              <TrendingUp size={13} style={{ marginRight: '0.35rem' }} />
              {showAnalytics ? t('dashboard.hide_stats', 'Hide Quick Stats') : t('dashboard.quick_stats', 'Quick Stats')}
            </Button>
          )}
          {canReadReports && (
            <Button variant="ghost" size="sm" onClick={handleExportFullSchoolReport} title={t('dashboard.export_report', 'Download Executive Report')}>
              <Download size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Interactive School Analytics & Operational Report Panel */}
      {showAnalytics && !isStudent && !isGuardian && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingUp size={18} style={{ color: 'var(--brand-primary)' }} />
                Institutional Operations & Academic Health Summary
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Synchronized institutional management across Admissions, Academic Enrollment, Attendance, and Performance.
              </p>
            </div>
            <Badge tone="success">Active & Synchronized</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Admissions Conversion Funnel */}
            <div style={{ padding: '1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                Admissions Conversion Funnel
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Pending Review</span>
                  <span style={{ fontWeight: 600 }}>{pendingAdmissions}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '35%', height: '100%', background: 'var(--status-warning)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Admitted & Enrolled</span>
                  <span style={{ fontWeight: 600, color: 'var(--status-success)' }}>{admittedCount || studentCount}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '85%', height: '100%', background: 'var(--status-success)' }} />
                </div>
              </div>
            </div>

            {/* Attendance & Engagement Pulse */}
            <div style={{ padding: '1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                Daily Engagement Pulse
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Student Attendance Rate</span>
                  <span style={{ fontWeight: 600 }}>{attendanceRate}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${attendanceRate}%`, height: '100%', background: 'var(--brand-primary)' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Faculty Staff Presence</span>
                  <span style={{ fontWeight: 600 }}>98%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '98%', height: '100%', background: 'var(--status-success)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolPulseBanner;
