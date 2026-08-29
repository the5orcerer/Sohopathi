import React, { useState, useEffect } from 'react';
import type { WidgetProps, AdmissionApplicationItem, AdmissionStatsData } from '../../types';
import { fetchWidgetData } from '../../services/api';
import { UserPlus, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '../common';

export const RecentAdmissions: React.FC<WidgetProps> = ({ dataSource }) => {
  const [applications, setApplications] = useState<AdmissionApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<any>(dataSource)
      .then((res) => {
        if (isMounted) {
          const list = res?.applications || (Array.isArray(res) ? res : []);
          setApplications(list);
        }
      })
      .catch((err) => console.error('Failed to load admission widget data', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'admitted':
        return <Badge tone="success">Admitted</Badge>;
      case 'shortlisted':
        return <Badge tone="primary">Shortlisted</Badge>;
      case 'under_review':
        return <Badge tone="warning">Under Review</Badge>;
      case 'rejected':
        return <Badge tone="danger">Rejected</Badge>;
      default:
        return <Badge tone="neutral">Submitted</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><UserPlus size={16} /></span>
            Recent Admissions
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading applications...
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><UserPlus size={16} /></span>
          Recent Admissions Pipeline
        </div>
        <Badge tone="primary">{applications.length} Active</Badge>
      </div>

      <div className="widget-body" style={{ overflowY: 'auto' }}>
        {applications.length === 0 ? (
          <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No recent admission applications.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {applications.slice(0, 5).map((app) => (
              <div
                key={app.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.8rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-bg-subtle, rgba(255, 255, 255, 0.03))',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.86rem' }}>{app.applicantName}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {app.applicationNo}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Grade: {app.className || 'General'} &bull; Guardian: {app.guardianName} ({app.guardianPhone})
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {getStatusBadge(app.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const AdmissionStatsWidget: React.FC<WidgetProps> = ({ dataSource }) => {
  const [stats, setStats] = useState<AdmissionStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<AdmissionStatsData>(dataSource)
      .then((res) => {
        if (isMounted) setStats(res);
      })
      .catch((err) => console.error('Failed to load admission stats', err))
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
            <span className="widget-icon"><UserPlus size={16} /></span>
            Admissions Overview
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading stats...
        </div>
      </div>
    );
  }

  const summary = stats?.summary || {
    total: 0,
    submitted: 0,
    under_review: 0,
    shortlisted: 0,
    admitted: 0,
    rejected: 0,
    total_fees_collected: 0,
  };

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><UserPlus size={16} /></span>
          Admission Funnel Metrics
        </div>
        <Badge tone="success">
          {summary.admitted} Admitted
        </Badge>
      </div>

      <div className="widget-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(30, 95, 91, 0.08)', border: '1px solid rgba(30, 95, 91, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--brand-primary)', fontSize: '0.75rem', fontWeight: 600 }}>
              <UserPlus size={14} /> Total Applied
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.2rem' }}>{summary.total}</div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(227, 160, 8, 0.08)', border: '1px solid rgba(227, 160, 8, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--brand-accent)', fontSize: '0.75rem', fontWeight: 600 }}>
              <Clock size={14} /> In Review
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.2rem' }}>{summary.under_review + summary.submitted}</div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>
              <CheckCircle size={14} /> Admitted
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.2rem' }}>{summary.admitted}</div>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
              <AlertCircle size={14} /> Rejected
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, marginTop: '0.2rem' }}>{summary.rejected}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

