import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../common';
import {
  Users,
  Clock,
  MapPin,
  UserCheck,
  AlertCircle,
  CalendarCheck,
  BookOpen,
  RefreshCw,
  UserX,
} from 'lucide-react';
import { fetchClassOverview } from '../../services/api';
import type { ClassItem, ClassOverviewData } from '../../types';

interface ClassOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  classItem: ClassItem | null;
  onOpenSubstitute?: (schedule: any) => void;
}

export const ClassOverviewModal: React.FC<ClassOverviewModalProps> = ({
  isOpen,
  onClose,
  classItem,
  onOpenSubstitute,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ClassOverviewData | null>(null);

  const loadOverview = async () => {
    if (!classItem) return;
    setLoading(true);
    setError(null);
    try {
      const overview = await fetchClassOverview(classItem.id);
      setData(overview);
    } catch (err: any) {
      console.error('Failed to load class overview:', err);
      setError(err.message || 'Failed to load class metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && classItem) {
      loadOverview();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, classItem?.id]);

  if (!classItem) return null;

  const className = classItem.name;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Class Overview: ${className}`}
      maxWidth="780px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.5rem', display: 'block', color: 'var(--brand-primary)' }} />
            <p style={{ fontSize: '0.85rem', margin: 0 }}>Aggregating real-time class metrics & timetable...</p>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Top KPI Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--card-bg, var(--surface))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                  <Users size={14} style={{ color: 'var(--brand-primary)' }} />
                  <span>Enrolled Students</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {data.totalStudents}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Across {data.sections.length} active section{data.sections.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--card-bg, var(--surface))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                  <CalendarCheck size={14} style={{ color: '#10b981' }} />
                  <span>Attendance Rate Today</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
                    {data.todayAttendance.attendanceRate}%
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({data.todayAttendance.present} Present)
                  </span>
                </div>
                <div style={{ width: '100%', background: 'var(--border)', height: '6px', borderRadius: '3px', marginTop: '0.5rem', overflow: 'hidden' }}>
                  <div
                    style={{
                      background: '#10b981',
                      height: '100%',
                      borderRadius: '3px',
                      width: `${Math.min(100, data.todayAttendance.attendanceRate)}%`,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>

              <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--card-bg, var(--surface))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                  <UserX size={14} style={{ color: '#f59e0b' }} />
                  <span>Absences & Excused</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {data.todayAttendance.absent}
                  <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
                    ({data.todayAttendance.excused} excused)
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.2rem' }}>
                  {data.todayAttendance.late} late check-in{data.todayAttendance.late !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Currently Running Period Card */}
            <div
              style={{
                borderRadius: 'var(--radius-md)',
                border: '1.5px solid rgba(99, 102, 241, 0.3)',
                background: 'rgba(99, 102, 241, 0.05)',
                padding: '1.25rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--brand-primary)' }}>
                    Live Telemetry: Active Period
                  </span>
                </div>
                {data.currentPeriod && onOpenSubstitute && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onOpenSubstitute(data.currentPeriod)}
                    style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                  >
                    Substitute / Excuse
                  </Button>
                )}
              </div>

              {data.currentPeriod ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BookOpen size={18} style={{ color: 'var(--brand-primary)' }} />
                        {data.currentPeriod.subjectName}
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--brand-primary)' }}>
                          {data.currentPeriod.sectionName}
                        </span>
                      </h4>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <UserCheck size={14} style={{ color: 'var(--text-muted)' }} />
                        Instructor: <strong style={{ color: 'var(--text-primary)' }}>{data.currentPeriod.teacherName || 'Assigned Faculty'}</strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <Clock size={14} style={{ color: 'var(--brand-primary)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {data.currentPeriod.startTime} - {data.currentPeriod.endTime}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <MapPin size={14} style={{ color: '#8b5cf6' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {data.currentPeriod.roomNumber || 'Room 4022'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {data.currentPeriod.subStatus === 'substitute' && (
                    <div style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.78rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Substituted Period:</strong> Covered by <em>{data.currentPeriod.substituteTeacherName || 'Substitute Teacher'}</em>
                        {data.currentPeriod.subReason ? ` (${data.currentPeriod.subReason})` : ''}
                      </span>
                    </div>
                  )}

                  {data.currentPeriod.subStatus === 'cancelled' && (
                    <div style={{ padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.78rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={14} style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Period Cancelled:</strong> {data.currentPeriod.subReason || 'Instructor on excused emergency leave.'}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    No active class period right now.
                  </p>
                  {data.nextPeriod && (
                    <div style={{ marginTop: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--brand-primary)', padding: '3px 10px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)' }}>
                      <span>Next upcoming:</span>
                      <strong>{data.nextPeriod.subjectName} ({data.nextPeriod.startTime}) in {data.nextPeriod.roomNumber}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sections & Assigned Class Teachers */}
            <div>
              <h4 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
                Sections & Class Mentors
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
                {data.sections.map((sec: any) => (
                  <div
                    key={sec.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      background: 'var(--card-bg, var(--surface))',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {sec.name}
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg)', color: 'var(--text-muted)' }}>
                        {sec.studentCount || 0} students
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>Class Teacher / Manager:</span>
                      <strong style={{ color: 'var(--brand-primary)' }}>
                        {sec.classTeacherName || 'Unassigned'}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Faculty Allocation */}
            {data.assignedTeachers && data.assignedTeachers.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
                  Subject Faculty
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {data.assignedTeachers.map((teach: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.4rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: 'var(--card-bg, var(--surface))',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{teach.teacherName}</span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: 'var(--brand-primary)' }}>{teach.subjectName}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({teach.sectionName})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
