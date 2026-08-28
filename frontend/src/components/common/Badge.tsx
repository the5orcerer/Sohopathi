import React from 'react';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  tone = 'primary',
  icon,
  size = 'md',
  style,
}) => {
  const getBadgeClass = () => {
    switch (tone) {
      case 'success':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'danger':
        return 'badge-danger';
      case 'info':
        return 'badge-info';
      case 'neutral':
        return 'badge-muted';
      default:
        return 'badge-primary';
    }
  };

  return (
    <span
      className={`badge ${getBadgeClass()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: size === 'sm' ? '0.15rem 0.45rem' : '0.25rem 0.6rem',
        fontSize: size === 'sm' ? '0.68rem' : '0.75rem',
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
};
