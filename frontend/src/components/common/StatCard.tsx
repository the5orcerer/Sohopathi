import React from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  accentColor?: string;
  className?: string;
}

/**
 * Reusable Metric/KPI card.
 * Usage:
 *   <StatCard label="Present Rate" value="94%" sublabel="423 students present" accentColor="var(--status-success)" />
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sublabel,
  icon,
  trend,
  accentColor,
}) => {
  return (
    <div
      className="glass-panel animate-fade-in"
      style={{
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        {icon && (
          <div
            style={{
              color: accentColor || 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
        <span
          style={{
            fontSize: '1.65rem',
            fontWeight: 700,
            color: accentColor || 'var(--text-primary)',
            lineHeight: 1.2,
          }}
        >
          {value}
        </span>
        {trend && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: trend.isPositive ? 'var(--status-success)' : 'var(--status-danger)',
            }}
          >
            {trend.value}
          </span>
        )}
      </div>

      {sublabel && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {sublabel}
        </span>
      )}
    </div>
  );
};
