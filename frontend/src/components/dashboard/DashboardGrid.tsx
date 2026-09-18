import React from 'react';
import type { DashboardWidget } from '../../types';
import { WIDGET_REGISTRY, isWidgetAvailable } from '../widgets/registry';
import { LayoutGrid } from 'lucide-react';
import { useSession } from '../../context/SessionContext';

interface DashboardGridProps {
  widgets: DashboardWidget[];
  className?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ 
  widgets, 
  className = '',
  emptyStateTitle = 'No Active Dashboard Widgets',
  emptyStateDescription = 'No widgets match the permission set for your active role'
}) => {
  const { currentPersona, user, activeMembership, permissions } = useSession();

  // ✅ permissions ব্যবহার করুন currentPersona.permissions এর বদলে
  const userPermissions = permissions || [];

  // Filter widgets based on permissions (if needed)
  const filteredWidgets = widgets?.filter((w) => {
    // যদি requiredPermissions থাকে, চেক করুন
    if (w.requiredPermissions && w.requiredPermissions.length > 0) {
      const hasPermission = w.requiredPermissions.some((perm) =>
        userPermissions.includes(perm)
      );
      if (!hasPermission) return false;
    }
    return true;
  });

  // যদি widgets না থাকে অথবা খালি হয়
  if (!filteredWidgets || filteredWidgets.length === 0) {
    return (
      <div
        className="glass-panel animate-fade-in"
        style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          maxWidth: '600px',
          margin: '2rem auto',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand-primary)',
          }}
        >
          <LayoutGrid size={32} />
        </div>
        <div>
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: 600,
            marginBottom: '0.4rem',
            color: 'var(--text-primary)'
          }}>
            {emptyStateTitle}
          </h3>
          <p style={{ 
            fontSize: '0.875rem', 
            color: 'var(--text-secondary)', 
            lineHeight: 1.6,
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            {emptyStateDescription}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {currentPersona?.roleName || activeMembership?.roleName || 'Unknown'}
            </strong>
            . Contact your institution administrator or switch personas using the header selector to explore other roles.
          </p>
          {user?.name && (
            <p style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)',
              marginTop: '0.5rem'
            }}>
              Logged in as: {user.name} • {activeMembership?.institutionName || 'Institution'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-grid animate-fade-in ${className}`}>
      {filteredWidgets.map((w) => {
        // Check if widget renderer exists in registry
        if (!isWidgetAvailable(w.renderer)) {
          console.warn(`[DashboardGrid] Renderer '${w.renderer}' not found in WIDGET_REGISTRY.`);
          return (
            <div 
              key={w.id} 
              className="grid-cell widget-error"
              style={{
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
              }}
            >
              <p>⚠️ Widget "{w.renderer}" not available</p>
              <p style={{ fontSize: '0.7rem' }}>ID: {w.id}</p>
            </div>
          );
        }

        const Component = WIDGET_REGISTRY[w.renderer];

        // Responsive grid column span calculation:
        // Ensure widgets fit clean, balanced proportions (span 6 for paired cards, 12 for full width)
        const rawWidth = w.layout?.width || w.layout?.w || w.defaultSize?.width || 6;
        const normalizedWidth = rawWidth >= 10 ? 12 : 6;
        const colClass = `col-span-${normalizedWidth}`;

        return (
          <div 
            key={w.id} 
            className={`grid-cell ${colClass}`}
          >
            <Component 
              dataSource={w.dataSource} 
              id={w.id}
            />
          </div>
        );
      })}
    </div>
  );
};

export default DashboardGrid;