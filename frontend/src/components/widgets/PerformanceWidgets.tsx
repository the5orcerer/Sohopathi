import React, { useState, useEffect } from 'react';
import type { WidgetProps, ClassPerformanceData, ClassPerformanceItem } from '../../types';
import { fetchWidgetData } from '../../services/api';
import { Trophy, Loader2 } from 'lucide-react';

/**
 * Ranked list of best-performing classes/sections, matching the
 * "Top Performing Classes" card in the reference dashboard design.
 * Expects dataSource to resolve to either a ClassPerformanceData object
 * ({ classes: [...] }) or a raw array of class performance rows.
 */
export const TopPerformingClasses: React.FC<WidgetProps> = ({ dataSource }) => {
  const [data, setData] = useState<ClassPerformanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<any>(dataSource)
      .then((res) => {
        if (!isMounted) return;
        const rows = Array.isArray(res) ? res : res?.classes;
        if (Array.isArray(rows)) {
          const classes: ClassPerformanceItem[] = rows
            .map((r: any, i: number) => ({
              id: r.id || String(i),
              className: r.className || r.name || `Class ${i + 1}`,
              sectionName: r.sectionName || r.section,
              score: Number(r.score ?? r.performanceScore ?? r.attendanceRate ?? 0),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);
          setData({ classes });
        }
      })
      .catch((err) => console.error('Failed to load class performance', err))
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
            <span className="widget-icon"><Trophy size={16} /></span>
            Top Performing Classes
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading performance data...
        </div>
      </div>
    );
  }

  if (!data || data.classes.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><Trophy size={16} /></span>
            Top Performing Classes
          </div>
        </div>
        <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No class performance data available yet.
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><Trophy size={16} /></span>
          Top Performing Classes
        </div>
      </div>

      <div className="widget-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {data.classes.map((cls, idx) => (
            <div key={cls.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', width: '1.1rem', flexShrink: 0 }}>
                {idx + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cls.className}{cls.sectionName ? ` - ${cls.sectionName}` : ''}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--status-success)', flexShrink: 0 }}>
                    {Math.round(cls.score)}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', borderRadius: 'var(--radius-full)', background: 'var(--surface-sunken)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(Math.max(cls.score, 0), 100)}%`,
                      height: '100%',
                      background: 'var(--status-success)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
