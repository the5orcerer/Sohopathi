import React from 'react';
import { useSession } from '../../context/SessionContext';
import BiddyapithDarkLogo from '../../assets/biddyapith-dark.png';
import BiddyapithLightLogo from '../../assets/biddyapith-light.png';
import {
  LayoutDashboard,
  CalendarCheck,
  Bell,
  Users,
  GraduationCap,
  Layers,
  ChevronRight,
  X,
  Sliders,
  UserPlus,
  Award,
  History,
  BookOpen,
  ClipboardList,
  Settings,
  BarChart3,
  CreditCard,
  FileText,
  GitPullRequest,
} from 'lucide-react';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const getNavIcon = (path: string) => {
  switch (path) {
    case '/': return <LayoutDashboard size={20} />;
    case '/attendance':
    case '/employee-attendance':
    case '/attendance/employee':
      return <CalendarCheck size={20} />;
    case '/admissions': return <UserPlus size={20} />;
    case '/examinations': return <Award size={20} />;
    case '/assignments': return <BookOpen size={20} />;
    case '/notices': return <Bell size={20} />;
    case '/students': return <GraduationCap size={20} />;
    case '/academic': return <Layers size={20} />;
    case '/reports': return <BarChart3 size={20} />;
    case '/tasks': return <ClipboardList size={20} />;
    case '/members': return <Users size={20} />;
    case '/billing':
    case '/invoices':
    case '/finance':
      return <CreditCard size={20} />;
    case '/templates':
    case '/templates/builder':
      return <FileText size={20} />;
    case '/requests':
      return <GitPullRequest size={20} />;
    case '/permission-matrix': return <Sliders size={20} />;
    case '/activity-log':
    case '/activity-logs':
      return <History size={20} />;
    case '/settings': return <Settings size={20} />;
    default: return <Users size={20} />;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed = false,
}) => {
  const { navItems, user, activeMembership, theme } = useSession();
  const isDarkMode = theme === 'dark';

  const handleItemClick = (path: string) => {
    onNavigate(path);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarWidth = isCollapsed ? 64 : 240;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
            animation: 'fadeIn 0.3s ease',
          }}
        />
      )}

      <aside
        style={{
          width: `${sidebarWidth}px`,
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          height: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1000,
          transform: isOpenMobile ? 'translateX(0)' : 'translateX(0)',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isOpenMobile ? 'var(--shadow-xl)' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: '56px',
            padding: isCollapsed ? '0 0.75rem' : '0 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            flexShrink: 0,
            transition: 'padding 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? 0 : '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                boxShadow: isDarkMode ? '0 0 10px rgba(139, 92, 246, 0.2)' : 'none',
              }}
            >
              <img 
                src={isDarkMode ? BiddyapithDarkLogo : BiddyapithLightLogo} 
                alt="Logo"
                style={{ 
                  width: '100%', 
                  height: '100%',
                  objectFit: 'contain' 
                }} 
              />
            </div>

            {!isCollapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontFamily: 'bold',
                    fontSize: '1.25rem',
                    textTransform: 'uppercase',
                    background: isDarkMode 
                      ? 'linear-gradient(135deg, #a78bfa, #60a5fa)' 
                      : 'linear-gradient(135deg, var(--brand-primary), #60a5fa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Biddyapith
                </div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  {activeMembership?.institutionName || 'Education Platform'}
                </div>
              </div>
            )}
          </div>

          {/* Close button for mobile */}
          {isOpenMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              style={{
                padding: '0.3rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Dynamic Navigation Menu */}
        <div
          style={{
            flex: 1,
            padding: isCollapsed ? '0.5rem 0.25rem' : '0.75rem 0.75rem',
            overflow: 'hidden',
            transition: 'padding 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Home / Dashboard Link */}
          <button
            onClick={() => handleItemClick('/')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? 0 : '0.65rem',
              padding: isCollapsed ? '0.6rem' : '0.6rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '0',
              background:
                currentPath === '/'
                  ? 'var(--brand-primary)'
                  : 'transparent',
              color:
                currentPath === '/'
                  ? '#ffffff'
                  : 'var(--text-secondary)',
              fontWeight: currentPath === '/' ? 600 : 400,
              fontSize: '0.80rem',
              border: 'none',
              transition: 'all var(--transition-fast)',
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              position: 'relative',
            }}
            onMouseEnter={(e) => {
              if (currentPath !== '/') {
                e.currentTarget.style.background =
                  'var(--surface-hover)';

                e.currentTarget.style.color =
                  'var(--text-primary)';

                const icon = e.currentTarget.querySelector(
                  '.nav-icon'
                ) as HTMLElement;

                if (icon) {
                  icon.style.color =
                    'var(--text-primary)';
                }
              }
            }}
            onMouseLeave={(e) => {
              if (currentPath !== '/') {
                e.currentTarget.style.background =
                  'transparent';

                e.currentTarget.style.color =
                  'var(--text-secondary)';

                const icon = e.currentTarget.querySelector(
                  '.nav-icon'
                ) as HTMLElement;

                if (icon) {
                  icon.style.color =
                    'var(--text-secondary)';
                }
              }
            }}
            title={isCollapsed ? 'Dashboard' : ''}
          >
            {/* Dashboard Icon */}
            <span
              className="nav-icon"
              style={{
                color:
                  currentPath === '/'
                    ? '#ffffff'
                    : 'var(--text-secondary)',
                opacity:
                  currentPath === '/'
                    ? 1
                    : 0.6,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s ease',
              }}
            >
              <LayoutDashboard size={20} />
            </span>

            {!isCollapsed && (
              <>
                {/* Dashboard Text */}
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Dashboard
                </span>

                {/* Active Arrow */}
                {currentPath === '/' && (
                  <ChevronRight
                    size={14}
                    style={{
                      opacity: 0.7,
                      flexShrink: 0,
                    }}
                  />
                )}
              </>
            )}

            {/* Active Indicator */}
            {isCollapsed && currentPath === '/' && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '3px',
                  height: '20px',
                  background: 'var(--brand-primary)',
                  borderRadius: '0 2px 2px 0',
                }}
              />
            )}
          </button>

          {/* Dynamic Nav Items */}
          {navItems && navItems.length > 0 && (
            <div
              style={{
                marginTop: '0',
                overflow: 'hidden',
                flex: 1,
              }}
            >
              {!isCollapsed && (
                <div
                  style={{
                    fontSize: '0.50rem',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '0',
                    flexShrink: 0,
                  }}
                />
              )}

              {navItems.map((item) => {
                const isActive =
                  currentPath === item.path;

                return (
                  <button
                    key={item.path}
                    onClick={() =>
                      handleItemClick(item.path)
                    }
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed
                        ? 'center'
                        : 'flex-start',
                      gap: isCollapsed
                        ? 0
                        : '0.75rem',
                      padding: isCollapsed
                        ? '0.6rem'
                        : '0.6rem 0.75rem',
                      borderRadius:
                        'var(--radius-sm)',
                      margin: '0',
                      background: isActive
                        ? 'var(--brand-primary)'
                        : 'transparent',
                      color: isActive
                        ? '#ffffff'
                        : 'var(--text-secondary)',
                      fontWeight: isActive
                        ? 600
                        : 400,
                      fontSize: '0.80rem',
                      border: 'none',
                      transition:
                        'all var(--transition-fast)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background =
                          'var(--surface-hover)';

                        e.currentTarget.style.color =
                          'var(--text-primary)';

                        const icon =
                          e.currentTarget.querySelector(
                            '.nav-icon'
                          ) as HTMLElement;

                        if (icon) {
                          icon.style.color =
                            'var(--brand-primary)';
                        }
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background =
                          'transparent';

                        e.currentTarget.style.color =
                          'var(--text-secondary)';

                        const icon =
                          e.currentTarget.querySelector(
                            '.nav-icon'
                          ) as HTMLElement;

                        if (icon) {
                          icon.style.color =
                            'var(--text-secondary)';
                        }
                      }
                    }}
                    title={
                      isCollapsed
                        ? item.label
                        : ''
                    }
                  >
                    {/* Navigation Icon */}
                    <span
                      className="nav-icon"
                      style={{
                        color: isActive
                          ? '#ffffff'
                          : 'var(--text-muted)',
                        opacity: isActive
                          ? 1
                          : 0.6,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition:
                          'color 0.2s ease',
                      }}
                    >
                      {getNavIcon(item.path)}
                    </span>

                    {!isCollapsed && (
                      <>
                        {/* Navigation Label */}
                        <span
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.label}
                        </span>

                        {/* Active Arrow */}
                        {isActive && (
                          <ChevronRight
                            size={14}
                            style={{
                              opacity: 0.7,
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* Active Indicator */}
                    {isCollapsed && isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: '50%',
                          transform:
                            'translateY(-50%)',
                          width: '3px',
                          height: '24px',
                          background:
                            'var(--brand-primary)',
                          borderRadius:
                            '0 2px 2px 0',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* User Role Footer */}
        <div
          style={{
            padding: isCollapsed ? '0.75rem' : '0.85rem 1.25rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            transition: 'padding 0.3s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? 0 : '0.6rem', width: '100%' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--brand-primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '0.8rem',
                flexShrink: 0,
              }}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!isCollapsed && (
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ 
                  fontSize: '0.8rem', 
                  fontWeight: 500, 
                  color: 'var(--text-primary)', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis' 
                }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ 
                  fontSize: '0.65rem', 
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {activeMembership?.roleName || 'Member'}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .sidebar-tooltip {
          position: fixed;
          background: var(--bg-secondary);
          color: var(--text-primary);
          padding: 0.4rem 0.8rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-subtle);
          box-shadow: var(--shadow-md);
          font-size: 0.8rem;
          white-space: nowrap;
          z-index: 2000;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .sidebar-tooltip.visible {
          opacity: 1;
        }
      `}</style>
    </>
  );
};

export default Sidebar;
