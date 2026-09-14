import React from 'react';
import { useSession } from '../../context/SessionContext';
import {
  LayoutDashboard,
  CalendarCheck,
  Bell,
  Users,
  GraduationCap,
  Layers,
  ChevronRight,
  X,
  Sparkles,
  Sliders,
  UserPlus,
  Award,
  History,
  BookOpen,
  ClipboardList,
  Settings,
  CreditCard,
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
}

const getNavIcon = (path: string) => {
  switch (path) {
    case '/':
      return <LayoutDashboard size={18} />;
    case '/attendance':
      return <CalendarCheck size={18} />;
    case '/examinations':
      return <Award size={18} />;
    case '/assignments':
      return <BookOpen size={18} />;
    case '/notices':
      return <Bell size={18} />;
    case '/students':
      return <GraduationCap size={18} />;
    case '/academic':
      return <Layers size={18} />;
    case '/tasks':
      return <ClipboardList size={18} />;
    case '/members':
      return <UserPlus size={18} />;
    case '/billing':
    case '/invoices':
    case '/finance':
      return <CreditCard size={18} />;
    case '/permission-matrix':
      return <Sliders size={18} />;
    case '/activity-log':
      return <History size={18} />;
    case '/settings':
      return <Settings size={18} />;
    default:
      return <Users size={18} />;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { navItems, user, activeMembership } = useSession();

  const handleItemClick = (path: string) => {
    onNavigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
            display: 'block',
          }}
        />
      )}

      <aside
        style={{
          width: '230px',
          backgroundColor: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          transition: 'transform var(--transition-normal)',
          ...(isOpenMobile
            ? {
                position: 'fixed',
                left: 0,
                top: 0,
                bottom: 0,
                transform: 'translateX(0)',
                boxShadow: 'var(--shadow-modal)',
              }
            : {}),
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: '56px',
            padding: '0 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary)',
                color: 'var(--primary-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Sohopathi
              </div>
            </div>
          </div>

          {/* Close button for mobile */}
          {isOpenMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="btn btn-ghost btn-sm"
              style={{ padding: '0.3rem', color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Dynamic Navigation Menu */}
        <div style={{ flex: 1, padding: '0.75rem 0.65rem', overflowY: 'auto' }}>
          {/* Home / Dashboard Link */}
          <button
            onClick={() => handleItemClick('/')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              padding: '0.55rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '0.25rem',
              background: currentPath === '/' ? 'var(--primary)' : 'transparent',
              color: currentPath === '/' ? 'var(--primary-fg)' : 'var(--text-secondary)',
              fontWeight: currentPath === '/' ? 600 : 400,
              fontSize: '0.85rem',
              border: 'none',
              transition: 'all var(--transition-fast)',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              if (currentPath !== '/') e.currentTarget.style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              if (currentPath !== '/') e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ color: currentPath === '/' ? 'var(--primary-fg)' : 'var(--text-muted)' }}>
              <LayoutDashboard size={17} />
            </span>
            <span style={{ flex: 1 }}>Dashboard</span>
            {currentPath === '/' && <ChevronRight size={14} />}
          </button>

          {/* Dynamic Nav Items resolved from backend permissions */}
          {navItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleItemClick(item.path)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.7rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '0.25rem',
                  background: isActive ? 'var(--primary)' : 'transparent',
                  color: isActive ? 'var(--primary-fg)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.85rem',
                  border: 'none',
                  transition: 'all var(--transition-fast)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ color: isActive ? 'var(--primary-fg)' : 'var(--text-muted)' }}>
                  {getNavIcon(item.path)}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {isActive && <ChevronRight size={14} />}
              </button>
            );
          })}
        </div>

        {/* User Role Footer */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.78rem',
              }}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {activeMembership?.roleName}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
