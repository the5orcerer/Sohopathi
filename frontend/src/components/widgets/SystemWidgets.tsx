import React, { useState, useEffect } from 'react';
import type { WidgetProps, SystemAlertsData, SystemAlertItem } from '../../types';
import { fetchWidgetData } from '../../services/api';
import { AlertTriangle, ClipboardList, CalendarClock, FileClock, UserX, Loader2, ShieldAlert } from 'lucide-react';

const ICONS_BY_SEVERITY: Record<SystemAlertItem['severity'], React.ComponentType<{ size?: number; color?: string }>> = {
  danger: AlertTriangle,
  warning: FileClock,
  info: CalendarClock,
  success: ClipboardList,
};

const COLOR_VAR: Record<SystemAlertItem['severity'], string> = {
  danger: 'var(--status-danger)',
  warning: 'var(--status-warning)',
  info: 'var(--status-info)',
  success: 'var(--status-success)',
};

const BG_VAR: Record<SystemAlertItem['severity'], string> = {
  danger: 'var(--danger-bg)',
  warning: 'var(--warning-bg)',
  info: 'var(--info-bg)',
  success: 'var(--success-bg)',
};

/**
 * Horizontal strip of cross-module alert counters, matching the
 * "System Alerts" row in the reference dashboard design. Expects
 * dataSource to resolve to a SystemAlertsData object ({ alerts: [...] })
 * or a raw array of alert rows with { label, count, severity }.
 */
export const SystemAlertsStrip: React.FC<WidgetProps> = ({ dataSource }) => {
  const [data, setData] = useState<SystemAlertsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<any>(dataSource)
      .then((res) => {
        if (!isMounted) return;
        const rows = Array.isArray(res) ? res : res?.alerts;
        if (Array.isArray(rows)) {
          const alerts: SystemAlertItem[] = rows.map((r: any, i: number) => ({
            id: r.id || String(i),
            label: r.label || r.title || 'Alert',
            count: Number(r.count ?? 0),
            severity: (['danger', 'warning', 'info', 'success'].includes(r.severity) ? r.severity : 'info') as SystemAlertItem['severity'],
          }));
          setData({ alerts });
        }
      })
      .catch((err) => console.error('Failed to load system alerts', err))
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
            <span className="widget-icon"><ShieldAlert size={16} /></span>
            System Alerts
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Checking system alerts...
        </div>
      </div>
    );
  }

  if (!data || data.alerts.length === 0) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><ShieldAlert size={16} /></span>
            System Alerts
          </div>
        </div>
        <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No active alerts right now.
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><ShieldAlert size={16} /></span>
          System Alerts
        </div>
      </div>

      <div className="widget-body">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {data.alerts.map((alert) => {
            const Icon = ICONS_BY_SEVERITY[alert.severity] || UserX;
            return (
              <div
                key={alert.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: BG_VAR[alert.severity],
                  flex: '1 1 200px',
                  minWidth: '180px',
                }}
              >
                <span
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: COLOR_VAR[alert.severity],
                  }}
                >
                  <Icon size={15} color={COLOR_VAR[alert.severity]} />
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: COLOR_VAR[alert.severity] }}>{alert.count}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{alert.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
