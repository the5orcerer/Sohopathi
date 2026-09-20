import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAdmissionStats,
  fetchAttendanceSummary,
  fetchClasses,
  fetchStudents,
  fetchMembers,
  fetchTasks,
  fetchMemberRequests,
  fetchMyEmployeeAttendanceHistory,
  fetchMyStudentAttendanceHistory,
  fetchLivePeriods,
  fetchFinanceSummary,
  fetchInvoices,
  recordInvoicePayment,
  exportToCsv,
} from '../../services/api';
import type {
  UserTaskItem,
  MemberRequestItem,
  PersonalAttendanceHistory,
  LivePeriodData,
  FinanceSummaryData,
  Invoice,
} from '../../types';
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
  Bell,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Clock,
  CheckCircle2,
  CreditCard,
  Wallet,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { Button, Badge, Modal } from '../common';
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
  const isTeacher = role.includes('teacher') || role.includes('faculty') || role.includes('instructor') || role.includes('professor');
  const isAdmin = role.includes('admin') || role.includes('principal') || role.includes('headmaster') || role.includes('director') || role.includes('super');
  const isEmployee = !isStudent && !isGuardian && !isTeacher && !isAdmin;

  const canReadStudents = (hasPermission('students.read') || isAdmin) && !isStudent && !isGuardian;
  const canReadMembers = (hasPermission('members.read') || hasPermission('roles.manage') || isAdmin) && !isStudent && !isGuardian;
  const canReadClasses = hasPermission('classes.manage') || hasPermission('academic.read') || isTeacher || isAdmin;
  const canReadAttendance = hasPermission('attendance.read') || hasPermission('attendance.create') || isStudent || isTeacher || isAdmin;
  const canReadAdmissions = (hasPermission('admissions.read') || hasPermission('admissions.manage') || isAdmin) && !isStudent && !isGuardian;
  const canReadReports = (hasPermission('reports.read') || isAdmin) && !isStudent && !isGuardian;

  // Admin / Institutional Metrics
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [classCount, setClassCount] = useState<number>(0);
  const [attendanceRate, setAttendanceRate] = useState<number>(0);
  const [pendingAdmissions, setPendingAdmissions] = useState<number>(0);
  const [admittedCount, setAdmittedCount] = useState<number>(0);
  const [pendingApprovalRequestsCount, setPendingApprovalRequestsCount] = useState<number>(0);
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Personal / Dynamic Metrics for Teachers, Employees, and Students
  const [personalAttendance, setPersonalAttendance] = useState<PersonalAttendanceHistory | null>(null);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [tasks, setTasks] = useState<UserTaskItem[]>([]);
  const [requests, setRequests] = useState<MemberRequestItem[]>([]);

  // Live Timetable Telemetry
  const [livePeriods, setLivePeriods] = useState<LivePeriodData | null>(null);

  // Student Billing / Dues Telemetry & Pay Modal
  const [studentFinance, setStudentFinance] = useState<FinanceSummaryData | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<Invoice[]>([]);
  const [showPayDueModal, setShowPayDueModal] = useState<boolean>(false);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<Invoice | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<number>(0);
  const [payMethodInput, setPayMethodInput] = useState<string>('bKash');
  const [payTrxIdInput, setPayTrxIdInput] = useState<string>('');
  const [payingDue, setPayingDue] = useState<boolean>(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null);

  const loadPersonalAttendance = useCallback(async (targetDate: Date) => {
    try {
      setCalendarLoading(true);
      const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
      if (isTeacher || isEmployee) {
        const data = await fetchMyEmployeeAttendanceHistory(monthStr);
        setPersonalAttendance(data);
      } else if (isStudent || isGuardian) {
        const data = await fetchMyStudentAttendanceHistory(monthStr);
        setPersonalAttendance(data);
      }
    } catch (err) {
      console.error('Failed to load personal attendance history', err);
    } finally {
      setCalendarLoading(false);
    }
  }, [isTeacher, isEmployee, isStudent, isGuardian]);

  const handleQuickPayDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceToPay) return;
    if (payAmountInput <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }
    try {
      setPayingDue(true);
      await recordInvoicePayment(selectedInvoiceToPay.id, {
        amount: payAmountInput,
        method: payMethodInput,
        transactionId: payTrxIdInput.trim() || undefined,
        notes: `Paid online via Student Portal (${payMethodInput})`,
      });
      setPaySuccessMsg(`Successfully paid ৳${payAmountInput}! Dues updated.`);
      const [newSum, newInv] = await Promise.all([
        fetchFinanceSummary().catch(() => null),
        fetchInvoices({ status: 'pending' }).catch(() => null),
      ]);
      if (newSum) setStudentFinance(newSum);
      if (newInv) setStudentInvoices(newInv.invoices || []);
      setTimeout(() => {
        setShowPayDueModal(false);
        setPaySuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Payment failed. Please try again.');
    } finally {
      setPayingDue(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadPulseData = async () => {
      try {
        setLoading(true);
        const promises: Promise<any>[] = [];

        if (isAdmin) {
          if (canReadStudents) promises.push(fetchStudents().then((res) => ({ type: 'students', res })).catch(() => null));
          if (canReadMembers) promises.push(fetchMembers().then((res) => ({ type: 'members', res })).catch(() => null));
          if (canReadClasses) promises.push(fetchClasses().then((res) => ({ type: 'classes', res })).catch(() => null));
          if (canReadAdmissions) promises.push(fetchAdmissionStats().then((res) => ({ type: 'admissions', res })).catch(() => null));
          if (canReadAttendance) promises.push(fetchAttendanceSummary().then((res) => ({ type: 'attendance', res })).catch(() => null));
          promises.push(fetchMemberRequests('to_approve').then((res) => ({ type: 'admin_requests', res })).catch(() => null));
        } else {
          // Personal tasks and requests for all other roles
          promises.push(fetchTasks('my_tasks').then((res) => ({ type: 'tasks', res })).catch(() => null));
          promises.push(fetchMemberRequests('my_requests').then((res) => ({ type: 'my_requests', res })).catch(() => null));

          if (isTeacher || isStudent || isGuardian) {
            promises.push(fetchClasses().then((res) => ({ type: 'classes', res })).catch(() => null));
            promises.push(fetchLivePeriods().then((res) => ({ type: 'live_periods', res })).catch(() => null));
          }

          if (isStudent || isGuardian) {
            promises.push(fetchFinanceSummary().then((res) => ({ type: 'student_finance', res })).catch(() => null));
            promises.push(fetchInvoices({ status: 'pending' }).then((res) => ({ type: 'student_invoices', res })).catch(() => null));
          }

          // Personal monthly attendance
          const monthStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}`;
          if (isTeacher || isEmployee) {
            promises.push(fetchMyEmployeeAttendanceHistory(monthStr).then((res) => ({ type: 'personal_attendance', res })).catch(() => null));
          } else if (isStudent || isGuardian) {
            promises.push(fetchMyStudentAttendanceHistory(monthStr).then((res) => ({ type: 'personal_attendance', res })).catch(() => null));
          }
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
          } else if (item.type === 'admin_requests' && Array.isArray(item.res)) {
            const pending = item.res.filter((r: any) => r.status === 'pending').length;
            setPendingApprovalRequestsCount(pending);
          } else if (item.type === 'tasks' && Array.isArray(item.res)) {
            setTasks(item.res);
          } else if (item.type === 'my_requests' && Array.isArray(item.res)) {
            setRequests(item.res);
          } else if (item.type === 'personal_attendance' && item.res?.summary) {
            setPersonalAttendance(item.res);
          } else if (item.type === 'live_periods' && item.res) {
            setLivePeriods(item.res);
          } else if (item.type === 'student_finance' && item.res) {
            setStudentFinance(item.res);
          } else if (item.type === 'student_invoices' && item.res) {
            setStudentInvoices(item.res.invoices || []);
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
  }, [isAdmin, isTeacher, isEmployee, isStudent, isGuardian, canReadStudents, canReadMembers, canReadClasses, canReadAdmissions, canReadAttendance]);

  const handlePrevMonth = () => {
    const nextDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    setCalendarDate(nextDate);
    loadPersonalAttendance(nextDate);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    setCalendarDate(nextDate);
    loadPersonalAttendance(nextDate);
  };

  const handleExportFullSchoolReport = () => {
    const reportData = [
      { Metric: 'Total Enrolled Students', Value: studentCount },
      { Metric: 'Faculty & Administrative Staff', Value: memberCount },
      { Metric: 'Active Academic Classes', Value: classCount },
      { Metric: 'Average Daily Attendance Rate', Value: `${attendanceRate}%` },
      { Metric: 'Pending Admission Applications', Value: pendingAdmissions },
      { Metric: 'Admitted This Term', Value: admittedCount },
      { Metric: 'Pending Requests For Approval', Value: pendingApprovalRequestsCount },
      { Metric: 'Generated Timestamp', Value: new Date().toISOString() },
    ];
    exportToCsv(`School_Overview_Report_${new Date().toISOString().split('T')[0]}`, reportData);
  };

  const pendingTasksCount = tasks.filter((t) => t.status !== 'completed').length;
  const myPendingRequestsCount = requests.filter((r) => r.status === 'pending').length;

  const renderAttendanceCalendar = () => {
    if (!personalAttendance) return null;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const todayStr = new Date().toISOString().split('T')[0];

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= totalDaysInMonth; i++) {
      days.push(i);
    }

    const { summary, records } = personalAttendance;

    return (
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background: 'var(--surface)',
        }}
      >
        {/* Calendar Header with Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarCheck size={18} style={{ color: 'var(--brand-primary)' }} />
              {isTeacher
                ? 'Teacher Attendance Calendar & Log'
                : isEmployee
                ? 'Staff Monthly Attendance Log'
                : 'My Monthly Attendance Record'}
            </h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Official biometric and session attendance verification for {monthName}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handlePrevMonth}
              disabled={calendarLoading}
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 600, fontSize: '0.88rem', minWidth: '130px', textAlign: 'center' }}>
              {calendarLoading ? 'Loading...' : monthName}
            </span>
            <button
              onClick={handleNextMonth}
              disabled={calendarLoading}
              style={{
                padding: '0.35rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Attendance Summary Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem' }}>
          <div style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Attendance Rate</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: summary.attendanceRate >= 85 ? 'var(--status-success)' : summary.attendanceRate >= 75 ? '#f59e0b' : '#ef4444' }}>
              {summary.attendanceRate}%
            </div>
          </div>

          <div style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Present Days</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>
              {summary.presentDays} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {summary.totalDays}</span>
            </div>
          </div>

          <div style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>Absent Days</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>
              {summary.absentDays}
            </div>
          </div>

          <div style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>Late Arrivals</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>
              {summary.lateDays}
            </div>
          </div>

          <div style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            <div style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600 }}>Approved Leaves</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>
              {summary.leaveDays}
            </div>
          </div>
        </div>

        {/* Visual Monthly Calendar Grid */}
        <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', textAlign: 'center', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
            {days.map((dayNum, idx) => {
              if (dayNum === null) {
                return <div key={`empty-${idx}`} style={{ height: '44px' }} />;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const record = records.find((r) => r.date?.startsWith(dateStr));
              const isToday = dateStr === todayStr;

              let bgColor = 'var(--surface)';
              let textColor = 'var(--text-secondary)';
              let borderColor = 'var(--border-subtle)';
              let statusLabel = 'Unmarked / Off';

              if (record) {
                const st = record.status?.toLowerCase();
                if (st === 'present') {
                  bgColor = 'rgba(16, 185, 129, 0.18)';
                  textColor = '#10b981';
                  borderColor = 'rgba(16, 185, 129, 0.5)';
                  statusLabel = `Present${record.checkInTime ? ` (${record.checkInTime.slice(0, 5)})` : ''}`;
                } else if (st === 'late') {
                  bgColor = 'rgba(245, 158, 11, 0.18)';
                  textColor = '#f59e0b';
                  borderColor = 'rgba(245, 158, 11, 0.5)';
                  statusLabel = `Late${record.checkInTime ? ` (${record.checkInTime.slice(0, 5)})` : ''}`;
                } else if (st === 'absent') {
                  bgColor = 'rgba(239, 68, 68, 0.18)';
                  textColor = '#ef4444';
                  borderColor = 'rgba(239, 68, 68, 0.5)';
                  statusLabel = 'Absent';
                } else if (st.includes('leave') || st === 'excused' || st === 'half_day') {
                  bgColor = 'rgba(59, 130, 246, 0.18)';
                  textColor = '#3b82f6';
                  borderColor = 'rgba(59, 130, 246, 0.5)';
                  statusLabel = 'Leave / Excused';
                }
              }

              return (
                <div
                  key={dateStr}
                  title={`${dateStr}: ${statusLabel}`}
                  style={{
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    background: bgColor,
                    border: isToday ? '2px solid var(--brand-primary)' : `1px solid ${borderColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'transform 0.1s ease',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: isToday ? 700 : 600, color: textColor }}>
                    {dayNum}
                  </span>
                  {record && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 600, color: textColor, textTransform: 'capitalize' }}>
                      {record.status === 'present' ? 'P' : record.status === 'late' ? 'L' : record.status === 'absent' ? 'A' : 'Lv'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
              <span>Present</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
              <span>Absent</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
              <span>Late</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }} />
              <span>Leave</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', border: '1px solid var(--border-subtle)', background: 'var(--surface)' }} />
              <span>Off / Unmarked</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLiveTimetable = () => {
    if (!livePeriods) return null;

    const isStu = isStudent || isGuardian;
    const running = livePeriods.runningClass;
    const upcoming = livePeriods.upcomingClasses || [];
    const previous = livePeriods.previousClasses || [];

    return (
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          background: 'var(--surface)',
        }}
      >
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(30, 95, 91, 0.15)',
                color: 'var(--brand-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isStu ? "Today's Academic Timetable & Live Classes" : "My Teaching Schedule & Assigned Periods Today"}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {isStu
                  ? (livePeriods.className ? `${livePeriods.className} • ${livePeriods.sectionName || 'Enrolled Section'}` : 'Daily Schedule Telemetry')
                  : 'Real-time lecture schedule and period allocations'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: running ? '#10b981' : 'var(--text-muted)',
                background: running ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-sunken)',
                padding: '0.25rem 0.65rem',
                borderRadius: '999px',
                border: running ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-subtle)',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: running ? '#10b981' : 'var(--text-muted)',
                  boxShadow: running ? '0 0 8px #10b981' : 'none',
                }}
              />
              {running ? 'Class In Session' : 'No Active Class Right Now'}
            </span>
          </div>
        </div>

        {/* 3-Column Timetable Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Card 1: Running Class (Live Now) */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              background: running ? 'rgba(16, 185, 129, 0.05)' : 'var(--surface-sunken)',
              border: running ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.75rem',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {running && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                }}
              />
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: running ? '#10b981' : 'var(--text-muted)' }}>
                  {running ? '🔴 Running Class (Live Now)' : 'Current Period'}
                </span>
                {running && (
                  <Badge tone="success">
                    {running.startTime} - {running.endTime}
                  </Badge>
                )}
              </div>

              {running ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {running.subjectName}
                  </div>
                  {isStu ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <UserCheck size={14} style={{ color: 'var(--brand-primary)' }} />
                      Instructor: <strong style={{ color: 'var(--text-primary)' }}>{running.teacherName}</strong>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Layers size={14} style={{ color: 'var(--brand-primary)' }} />
                      Teaching: <strong style={{ color: 'var(--text-primary)' }}>{running.className} ({running.sectionName})</strong>
                    </div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={13} />
                    Classroom: {running.roomNumber}
                  </div>

                  {running.substitutionStatus === 'substitute' && (
                    <div style={{ marginTop: '0.3rem', padding: '0.3rem 0.5rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontSize: '0.72rem', fontWeight: 600 }}>
                      ⚠️ Substitute Period: {running.substitutionReason || 'Covering teacher'}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '1.25rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>No Class in Session</div>
                  <div style={{ fontSize: '0.76rem', marginTop: '0.2rem' }}>
                    {upcoming.length > 0 ? `Next period begins at ${upcoming[0].startTime}` : 'No further classes scheduled for today'}
                  </div>
                </div>
              )}
            </div>

            {running && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                <span className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                Active Attendance & Period Progress Synchronized
              </div>
            )}
          </div>

          {/* Card 2: Upcoming Classes Today */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                ⏳ Upcoming Classes Today ({upcoming.length})
              </span>
            </div>

            {upcoming.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                {upcoming.map((u: any, i: number) => (
                  <div
                    key={u.id || i}
                    style={{
                      padding: '0.5rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {u.subjectName}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {isStu ? u.teacherName : `${u.className} (${u.sectionName})`} &bull; {u.roomNumber}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.73rem',
                          fontWeight: 700,
                          color: 'var(--brand-primary)',
                          background: 'rgba(30, 95, 91, 0.1)',
                          padding: '0.2rem 0.45rem',
                          borderRadius: '4px',
                        }}
                      >
                        {u.startTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1.25rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <CheckCircle2 size={24} style={{ color: '#10b981', margin: '0 auto 0.4rem' }} />
                <div>All scheduled classes for today have concluded.</div>
              </div>
            )}
          </div>

          {/* Card 3: Previous Classes Today */}
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                ✅ Previous Classes Today ({previous.length})
              </span>
            </div>

            {previous.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                {previous.map((p: any, i: number) => (
                  <div
                    key={p.id || i}
                    style={{
                      padding: '0.5rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      opacity: 0.85,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'line-through var(--text-muted)' }}>
                        {p.subjectName}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {isStu ? p.teacherName : `${p.className} (${p.sectionName})`} &bull; {p.roomNumber}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {p.startTime} - {p.endTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1.25rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <div>No periods have finished yet today.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPayDueModal = () => {
    if (!showPayDueModal || !selectedInvoiceToPay) return null;

    return (
      <Modal
        isOpen={showPayDueModal}
        title={`Settle Fee Invoice #${selectedInvoiceToPay.invoiceNumber || selectedInvoiceToPay.id.slice(0, 8)}`}
        onClose={() => {
          setShowPayDueModal(false);
          setPaySuccessMsg(null);
        }}
      >
        <form onSubmit={handleQuickPayDue} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedInvoiceToPay.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Category: {selectedInvoiceToPay.category || 'Tuition Fee'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Outstanding Due:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>
                ৳{(selectedInvoiceToPay.dueAmount ?? selectedInvoiceToPay.totalAmount ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          {paySuccessMsg && (
            <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontWeight: 600 }}>
              ✓ {paySuccessMsg}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
              Select Pending Invoice
            </label>
            <select
              value={selectedInvoiceToPay.id}
              onChange={(e) => {
                const found = studentInvoices.find((inv) => inv.id === e.target.value);
                if (found) {
                  setSelectedInvoiceToPay(found);
                  setPayAmountInput(found.dueAmount ?? found.totalAmount ?? 0);
                }
              }}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}
            >
              {studentInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.title} (Due: ৳{inv.dueAmount ?? inv.totalAmount ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                Payment Amount (৳)
              </label>
              <input
                type="number"
                min="1"
                max={selectedInvoiceToPay.dueAmount ?? selectedInvoiceToPay.totalAmount ?? 999999}
                value={payAmountInput}
                onChange={(e) => setPayAmountInput(Number(e.target.value))}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                Payment Method
              </label>
              <select
                value={payMethodInput}
                onChange={(e) => setPayMethodInput(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}
              >
                <option value="bKash">bKash Online</option>
                <option value="Nagad">Nagad Online</option>
                <option value="Rocket">Rocket</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit/Debit Card">Credit/Debit Card</option>
                <option value="Cash">Cash at Counter</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
              Transaction ID / Reference (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. TRX-992384729"
              value={payTrxIdInput}
              onChange={(e) => setPayTrxIdInput(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--surface)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="secondary" type="button" onClick={() => setShowPayDueModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={payingDue}>
              {payingDue ? 'Processing Payment...' : `Confirm & Pay ৳${payAmountInput}`}
            </Button>
          </div>
        </form>
      </Modal>
    );
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
        {isAdmin ? (
          /* ============================================================
             ADMIN / PRINCIPAL INSTITUTIONAL OVERVIEW
             ============================================================ */
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

            {/* School Attendance Rate */}
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

            {/* Admissions Review */}
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

            {/* Universal Requests Card (Admin: To Review) */}
            <div
              onClick={() => onNavigate('/requests')}
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
                  Approval Requests
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
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
                  {loading ? '...' : pendingApprovalRequestsCount}
                </span>
                <span style={{ fontSize: '0.75rem', color: pendingApprovalRequestsCount > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                  {pendingApprovalRequestsCount > 0 ? 'Pending Review' : 'All Clear'}
                </span>
              </div>
            </div>
          </>
        ) : isTeacher ? (
          /* ============================================================
             TEACHER DASHBOARD
             ============================================================ */
          <>
            {/* Teacher: Monthly Attendance Rate */}
            <div
              onClick={() => setShowCalendar(!showCalendar)}
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
                  My Monthly Attendance
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
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
                  {loading ? '...' : `${personalAttendance?.summary?.attendanceRate ?? 0}%`}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}>
                  {personalAttendance?.summary ? `${personalAttendance.summary.presentDays}/${personalAttendance.summary.totalDays} Days` : 'Monthly Log'}
                </span>
              </div>
            </div>

            {/* Teacher: Assigned Classes */}
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
                  Teaching Schedule
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
                <span style={{ fontSize: '0.75rem', color: 'var(--status-success)' }}>Active Classes</span>
              </div>
            </div>

            {/* Teacher: Personal Assigned Tasks */}
            <div
              onClick={() => onNavigate('/tasks')}
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
                  My Assigned Duties
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
                  <CheckSquare size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {loading ? '...' : pendingTasksCount}
                </span>
                <span style={{ fontSize: '0.75rem', color: pendingTasksCount > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                  {pendingTasksCount > 0 ? 'Pending Tasks' : 'All Complete'}
                </span>
              </div>
            </div>

            {/* Universal Requests Card (Teacher) */}
            <div
              onClick={() => onNavigate('/requests')}
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
                  My Requests & Leaves
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
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
                  {loading ? '...' : requests.length}
                </span>
                <span style={{ fontSize: '0.75rem', color: myPendingRequestsCount > 0 ? 'var(--status-warning)' : 'var(--brand-primary)' }}>
                  {myPendingRequestsCount > 0 ? `${myPendingRequestsCount} Pending` : '+ New Request'}
                </span>
              </div>
            </div>
          </>
        ) : isEmployee ? (
          /* ============================================================
             EMPLOYEE / NON-TEACHING STAFF DASHBOARD
             ============================================================ */
          <>
            {/* Employee: Monthly Attendance Rate */}
            <div
              onClick={() => setShowCalendar(!showCalendar)}
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
                  Monthly Attendance
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
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
                  {loading ? '...' : `${personalAttendance?.summary?.attendanceRate ?? 0}%`}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--brand-primary)' }}>
                  {personalAttendance?.summary ? `${personalAttendance.summary.presentDays}/${personalAttendance.summary.totalDays} Days` : 'Monthly Log'}
                </span>
              </div>
            </div>

            {/* Employee: Tasks & Work Orders */}
            <div
              onClick={() => onNavigate('/tasks')}
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
                  Work Orders & Tasks
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
                  <CheckSquare size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {loading ? '...' : pendingTasksCount}
                </span>
                <span style={{ fontSize: '0.75rem', color: pendingTasksCount > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                  {pendingTasksCount > 0 ? 'Active Work Orders' : 'All Clear'}
                </span>
              </div>
            </div>

            {/* Employee: Duty & Task Completion Ratio */}
            <div
              onClick={() => onNavigate('/tasks')}
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
                  Task Completion Ratio
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckSquare size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {tasks.length > 0 ? `${Math.round(((tasks.length - pendingTasksCount) / tasks.length) * 100)}%` : '100%'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {tasks.length - pendingTasksCount}/{tasks.length} Completed
                </span>
              </div>
            </div>

            {/* Universal Requests Card (Employee) */}
            <div
              onClick={() => onNavigate('/requests')}
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
                  My Leaves & Requests
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
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
                  {loading ? '...' : requests.length}
                </span>
                <span style={{ fontSize: '0.75rem', color: myPendingRequestsCount > 0 ? 'var(--status-warning)' : 'var(--brand-primary)' }}>
                  {myPendingRequestsCount > 0 ? `${myPendingRequestsCount} Pending` : '+ New Request'}
                </span>
              </div>
            </div>

            {/* Employee: Notices */}
            <div
              onClick={() => onNavigate('/notices')}
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
                  Campus Notices
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: '#ca8a04',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bell size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Circulars
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View Updates</span>
              </div>
            </div>
          </>
        ) : (
          /* ============================================================
             STUDENT / GUARDIAN DASHBOARD
             ============================================================ */
          <>
            {/* Student: Personal Attendance Rate */}
            <div
              onClick={() => setShowCalendar(!showCalendar)}
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
                  My Attendance Rate
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
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
                  {loading ? '...' : `${personalAttendance?.summary?.attendanceRate ?? 0}%`}
                </span>
                <span style={{ fontSize: '0.75rem', color: (personalAttendance?.summary?.attendanceRate ?? 0) >= 80 ? 'var(--status-success)' : 'var(--status-danger)' }}>
                  {personalAttendance?.summary ? `${personalAttendance.summary.presentDays}/${personalAttendance.summary.totalDays} Days` : 'View Calendar'}
                </span>
              </div>
            </div>

            {/* Student: Active Classes */}
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
                  Academic Enrolment
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
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enrolled Classes</span>
              </div>
            </div>

            {/* Student: Homework & Assignments */}
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
                <span style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Coursework
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--status-success)', display: 'flex', alignItems: 'center' }}>
                  <ArrowUpRight size={12} /> Active
                </span>
              </div>
            </div>

            {/* Student: Personal Assigned Tasks */}
            <div
              onClick={() => onNavigate('/tasks')}
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
                  My Assigned Tasks
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#a855f7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckSquare size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {loading ? '...' : pendingTasksCount}
                </span>
                <span style={{ fontSize: '0.75rem', color: pendingTasksCount > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                  {pendingTasksCount > 0 ? 'Due Tasks' : 'All Finished'}
                </span>
              </div>
            </div>

            {/* Universal Requests Card (Student) */}
            <div
              onClick={() => onNavigate('/requests')}
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
                  My Requests
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
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
                  {loading ? '...' : requests.length}
                </span>
                <span style={{ fontSize: '0.75rem', color: myPendingRequestsCount > 0 ? 'var(--status-warning)' : 'var(--brand-primary)' }}>
                  {myPendingRequestsCount > 0 ? `${myPendingRequestsCount} Pending` : '+ Submit Request'}
                </span>
              </div>
            </div>

            {/* Student: Fee Balance & Dues */}
            <div
              onClick={() => {
                if (studentInvoices.length > 0) {
                  setSelectedInvoiceToPay(studentInvoices[0]);
                  setPayAmountInput(studentInvoices[0].dueAmount ?? studentInvoices[0].totalAmount ?? 0);
                  setShowPayDueModal(true);
                } else {
                  onNavigate('/billing');
                }
              }}
              className="glass-panel"
              style={{
                padding: '1rem 1.15rem',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                border: (studentFinance?.totalPending ?? 0) > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)',
                background: (studentFinance?.totalPending ?? 0) > 0 ? 'rgba(239, 68, 68, 0.04)' : undefined,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--brand-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = (studentFinance?.totalPending ?? 0) > 0 ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Fee Dues & Ledger
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: (studentFinance?.totalPending ?? 0) > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: (studentFinance?.totalPending ?? 0) > 0 ? '#ef4444' : '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CreditCard size={18} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 700, color: (studentFinance?.totalPending ?? 0) > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                  ৳{(studentFinance?.totalPending ?? 0).toLocaleString()}
                </span>
                <span style={{ fontSize: '0.75rem', color: (studentFinance?.totalPending ?? 0) > 0 ? '#ef4444' : 'var(--status-success)', fontWeight: 600 }}>
                  {(studentFinance?.totalPending ?? 0) > 0 ? 'Due Pending' : 'Paid in Full'}
                </span>
              </div>
              {(studentFinance?.totalPending ?? 0) > 0 ? (
                <div style={{ marginTop: '0.2rem' }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (studentInvoices.length > 0) {
                        setSelectedInvoiceToPay(studentInvoices[0]);
                        setPayAmountInput(studentInvoices[0].dueAmount ?? studentInvoices[0].totalAmount ?? 0);
                        setShowPayDueModal(true);
                      } else {
                        onNavigate('/billing');
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.6rem',
                      background: 'var(--brand-primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <Wallet size={12} /> Pay Due Online
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--status-success)' }}>
                  ✓ All term fee dues cleared
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Visual Monthly Attendance Calendar (Rendered for Teachers, Employees, and Students) */}
      {!isAdmin && showCalendar && renderAttendanceCalendar()}

      {/* Daily Academic Timetable & Live Period Telemetry */}
      {(isStudent || isGuardian || isTeacher) && renderLiveTimetable()}

      {/* Admin Executive Quick Controls */}
      {isAdmin && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
          <Button
            variant={showAnalytics ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowAnalytics(!showAnalytics)}
          >
            <TrendingUp size={13} style={{ marginRight: '0.35rem' }} />
            {showAnalytics ? t('dashboard.hide_stats', 'Hide Quick Stats') : t('dashboard.quick_stats', 'Quick Stats')}
          </Button>
          {canReadReports && (
            <Button variant="ghost" size="sm" onClick={handleExportFullSchoolReport} title={t('dashboard.export_report', 'Download Executive Report')}>
              <Download size={14} />
            </Button>
          )}
        </div>
      )}

      {/* Interactive School Analytics & Operational Report Panel (Admin only) */}
      {showAnalytics && isAdmin && (
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
                  <span style={{ color: 'var(--text-secondary)' }}>Pending Approval Requests</span>
                  <span style={{ fontWeight: 600, color: pendingApprovalRequestsCount > 0 ? 'var(--status-warning)' : 'var(--status-success)' }}>
                    {pendingApprovalRequestsCount}
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: pendingApprovalRequestsCount > 0 ? '45%' : '100%', height: '100%', background: pendingApprovalRequestsCount > 0 ? 'var(--status-warning)' : 'var(--status-success)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Online Due Payment Modal */}
      {renderPayDueModal()}
    </div>
  );
};

export default SchoolPulseBanner;
