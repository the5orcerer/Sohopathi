import React from 'react';
import { Shield, Eye, User } from 'lucide-react';

interface ScopeChipProps {
  scope?: string;
  label?: string;
}

export const ScopeChip: React.FC<ScopeChipProps> = ({ scope = 'institution', label }) => {
  let badgeTone = 'badge-primary';
  let Icon = Shield;
  let scopeLabel = 'Institution-Wide Access';

  if (scope === 'assigned_sections') {
    badgeTone = 'badge-info';
    Icon = Eye;
    scopeLabel = 'Assigned Sections Scope';
  } else if (scope === 'self') {
    badgeTone = 'badge-warning';
    Icon = User;
    scopeLabel = 'Personal / Self Scope';
  }

  return (
    <span
      className={`badge ${badgeTone}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.25rem 0.65rem',
        fontSize: '0.75rem',
        fontWeight: 500,
        borderRadius: 'var(--radius-full)',
      }}
      title={scopeLabel}
    >
      <Icon size={13} />
      <span>{label || scopeLabel}</span>
    </span>
  );
};

