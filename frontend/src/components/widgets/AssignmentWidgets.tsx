import React, { useState, useEffect } from 'react';
import type { WidgetProps, Assignment, AssignmentStatisticsData } from '../../types';
import { fetchWidgetData } from '../../services/api';
import { BookOpen, Clock, BarChart3, CheckCircle2, Upload, Loader2, Award } from 'lucide-react';
import { useSession } from '../../context/SessionContext';

export const AssignmentList: React.FC<WidgetProps> = ({ dataSource }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<Assignment[]>(dataSource)
      .then((res) => {
        if (isMounted && Array.isArray(res)) setAssignments(res);
      })
      .catch((err) => console.error('Failed to load assignments', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><BookOpen size={16} /></span>
            Active Assignments
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading assignments...
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><BookOpen size={16} /></span>
          Coursework & Assignments
        </div>
        <span className="badge badge-primary">{assignments.length} Active</span>
      </div>

      <div className="widget-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto' }}>
          {assignments.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No current assignments.
            </div>
          ) : (
            assignments.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  <span className="badge badge-muted">{item.subjectName || 'General'}</span>
                </div>

                {item.description && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {item.description}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No deadline'}
                  </span>
                  {item.totalSubmissions !== undefined && (
                    <span>{item.totalSubmissions} submitted</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const PendingAssignments: React.FC<WidgetProps> = ({ dataSource }) => {
  const [pending, setPending] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const { hasPermission } = useSession();

  const canSubmit = hasPermission('assignments.submit');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<Assignment[]>(dataSource)
      .then((res) => {
        if (isMounted && Array.isArray(res)) setPending(res);
      })
      .catch((err) => console.error('Failed to load pending assignments', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  const handleSubmitWork = (id: string) => {
    setSubmittedId(id);
    setTimeout(() => {
      setPending((prev) => prev.filter((p) => p.id !== id));
      setSubmittedId(null);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><Clock size={16} /></span>
            Pending Submissions
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading due work...
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><Clock size={16} /></span>
          Due For Submission
        </div>
        <span className="badge badge-warning">{pending.length} Pending</span>
      </div>

      <div className="widget-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', overflowY: 'auto' }}>
          {pending.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#10b981', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={24} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>All caught up! No pending submissions.</span>
            </div>
          ) : (
            pending.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.title}</span>
                  <span className="badge badge-warning">{item.subjectName || 'Coursework'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} color="#f59e0b" /> Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'Soon'}
                  </span>

                  {canSubmit && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSubmitWork(item.id)}
                      disabled={submittedId === item.id}
                    >
                      <Upload size={12} />
                      {submittedId === item.id ? 'Submitted! ✓' : 'Submit Work'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export const AssignmentStatistics: React.FC<WidgetProps> = ({ dataSource }) => {
  const [stats, setStats] = useState<AssignmentStatisticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<AssignmentStatisticsData>(dataSource)
      .then((res) => {
        if (isMounted) setStats(res);
      })
      .catch((err) => console.error('Failed to load assignment stats', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><BarChart3 size={16} /></span>
            Academic Assignment Analytics
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading grading analytics...
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><BarChart3 size={16} /></span>
          Evaluation & Grading Analytics
        </div>
        <span className="badge badge-success">
          <Award size={12} /> {stats.averageScore}% Avg Class Score
        </span>
      </div>

      <div className="widget-body">
        <div className="stat-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat-box">
            <span className="stat-label">Total Assigned</span>
            <span className="stat-value">{stats.totalAssignments}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Submissions</span>
            <span className="stat-value" style={{ color: 'var(--primary-light)' }}>{stats.totalSubmissions}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Graded</span>
            <span className="stat-value" style={{ color: '#10b981' }}>{stats.gradedCount}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Pending Review</span>
            <span className="stat-value" style={{ color: '#f59e0b' }}>{stats.pendingGradingCount}</span>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
          Section Completion & Performance
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {stats.sectionPerformances?.map((sp: { sectionName: string; completionRate: number; avgScore: number }, idx: number) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--text-primary)' }}>{sp.sectionName}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {sp.completionRate}% completion • {sp.avgScore}% avg
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${sp.completionRate}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent-cyan) 100%)',
                    borderRadius: '9999px',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
