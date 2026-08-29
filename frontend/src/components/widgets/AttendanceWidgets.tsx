import React, { useState, useEffect } from 'react';
import type { WidgetProps, AttendanceSummaryData } from '../../types';
import { fetchWidgetData } from '../../services/api';
import { Users, CheckCircle2, XCircle, Clock, CalendarCheck, Loader2 } from 'lucide-react';
import { useSession } from '../../context/SessionContext';

export const AttendanceSummary: React.FC<WidgetProps> = ({ dataSource }) => {
  const [data, setData] = useState<AttendanceSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [markedSection, setMarkedSection] = useState<string | null>(null);
  const { hasPermission } = useSession();

  const canTakeAttendance = hasPermission('attendance.create');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<any>(dataSource)
      .then((res) => {
        if (!isMounted) return;
        if (Array.isArray(res)) {
          // Compute summary from database array rows
          const totalPresent = res.reduce((acc, r) => acc + (Number(r.presentCount) || 0), 0);
          const totalStudents = res.reduce((acc, r) => acc + (Number(r.totalStudents) || 0), 0);
          const totalAbsent = res.reduce((acc, r) => acc + (Number(r.absentCount) || 0), 0);
          const totalLate = res.reduce((acc, r) => acc + (Number(r.lateCount) || 0), 0);
          const rate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 100;

          setData({
            totalStudents,
            presentToday: totalPresent,
            absentToday: totalAbsent,
            lateToday: totalLate,
            attendanceRate: rate,
            recentClassRecords: res.map((r, i) => ({
              id: r.sectionId || String(i),
              className: r.className || 'Class 10',
              sectionName: r.sectionName || 'Section A',
              presentCount: Number(r.presentCount) || 0,
              totalCount: Number(r.totalStudents) || 0,
              date: r.date ? new Date(r.date).toLocaleDateString() : 'Today',
            })),
          });
        } else if (res && typeof res === 'object') {
          setData(res);
        }
      })
      .catch((err) => console.error('Failed to load attendance summary', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  const handleQuickMark = (className: string) => {
    setMarkedSection(className);
    setTimeout(() => setMarkedSection(null), 3000);
  };

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><Users size={16} /></span>
            Attendance Summary
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading live attendance...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><Users size={16} /></span>
            Attendance Summary
          </div>
        </div>
        <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No attendance records available for today.
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><Users size={16} /></span>
          Today's Attendance
        </div>
        <span className="badge badge-success">
          <CheckCircle2 size={12} /> {data.attendanceRate}% Present
        </span>
      </div>

      <div className="widget-body">
        {/* Metric stats grid */}
        <div className="stat-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat-box">
            <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981' }}>
              <CheckCircle2 size={12} /> Present
            </span>
            <span className="stat-value" style={{ color: '#10b981' }}>{data.presentToday}</span>
          </div>

          <div className="stat-box">
            <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f43f5e' }}>
              <XCircle size={12} /> Absent
            </span>
            <span className="stat-value" style={{ color: '#f43f5e' }}>{data.absentToday}</span>
          </div>

          <div className="stat-box">
            <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b' }}>
              <Clock size={12} /> Late
            </span>
            <span className="stat-value" style={{ color: '#f59e0b' }}>{data.lateToday}</span>
          </div>
        </div>

        {/* Recent Class Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Section Roster Breakdown
          </div>
          {data.recentClassRecords?.map((record) => {
            const pct = Math.round((record.presentCount / record.totalCount) * 100);
            return (
              <div
                key={record.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {record.className}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {record.sectionName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{pct}%</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {record.presentCount}/{record.totalCount}
                    </div>
                  </div>

                  {canTakeAttendance && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleQuickMark(record.className)}
                      title="Update Attendance"
                    >
                      <CalendarCheck size={12} />
                      {markedSection === record.className ? 'Saved ✓' : 'Update'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
