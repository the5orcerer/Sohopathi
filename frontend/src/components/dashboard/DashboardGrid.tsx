import React from 'react';
import type { DashboardWidget } from '../../types';
import { WIDGET_REGISTRY } from '../widgets/registry';
import { LayoutGrid } from 'lucide-react';
import { useSession } from '../../context/SessionContext';

interface DashboardGridProps {
  widgets: DashboardWidget[];
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({ widgets }) => {
  const { currentPersona } = useSession();

  if (!widgets || widgets.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          maxWidth: '600px',
          margin: '2rem auto',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary-light)',
          }}
        >
          <LayoutGrid size={28} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>No Active Dashboard Widgets</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            No widgets match the permission set for your active role (<strong style={{ color: 'var(--text-primary)' }}>{currentPersona.roleName}</strong>).
            Contact your institution administrator or switch personas using the header selector to explore other roles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-grid animate-fade-in">
      {widgets.map((w) => {
        const Component = WIDGET_REGISTRY[w.renderer];
        // Fail closed safely if a widget renderer is not registered yet (§3)
        if (!Component) {
          console.warn(`[DashboardGrid] Renderer '${w.renderer}' not found in WIDGET_REGISTRY. Failing closed.`);
          return null;
        }

        const spanWidth = w.layout?.width || w.layout?.w || w.defaultSize?.width || 4;
        const colClass = `col-span-${Math.min(Math.max(spanWidth, 1), 12)}`;

        return (
          <div key={w.id} className={`grid-cell ${colClass}`}>
            <Component dataSource={w.dataSource} id={w.id} />
          </div>
        );
      })}
    </div>
  );
};
