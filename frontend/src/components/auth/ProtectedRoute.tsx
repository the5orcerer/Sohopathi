import React from 'react';
import { useSession } from '../../context/SessionContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface ProtectedRouteProps {
  requiredPermission?: string;
  children: React.ReactNode;
  onNavigateHome?: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermission,
  children,
  onNavigateHome,
}) => {
  const { hasPermission, currentPersona } = useSession();

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '3.5rem 2rem',
          maxWidth: '560px',
          margin: '3rem auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(244, 63, 94, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f43f5e',
          }}
        >
          <ShieldAlert size={32} />
        </div>

        <div>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Your active role (<strong style={{ color: 'var(--text-primary)' }}>{currentPersona.roleName}</strong>) does not hold the required permission:{' '}
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '0.15rem 0.4rem',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--primary-light)',
              }}
            >
              {requiredPermission}
            </code>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          {onNavigateHome && (
            <button className="btn btn-secondary" onClick={onNavigateHome}>
              <ArrowLeft size={14} /> Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
