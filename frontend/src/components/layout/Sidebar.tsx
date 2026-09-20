import React from 'react';
import { useSession } from '../../context/SessionContext';
import { useLanguage } from '../../context/LanguageContext';
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

const getLocalizedNavLabel = (path: string, defaultLabel: string, t: (key: string, fallback?: string) => string): string => {
  switch (path) {
    case '/': return t('nav.dashboard', 'Dashboard');
    case '/students': return t('nav.students', 'Students');
    case '/admissions': return t('nav.admissions', 'Admissions');
    case '/academic': return t('nav.academic', 'Academic & Timetable');
    case '/attendance':
    case '/employee-attendance':
    case '/attendance/employee':
      return t('nav.attendance', 'Attendance');
    case '/examinations': return t('nav.examinations', 'Examinations');
    case '/notices': return t('nav.notices', 'Notices');
    case '/assignments': return t('nav.assignments', 'Assignments');
    case '/tasks': return t('nav.tasks', 'Tasks');
    case '/templates':
    case '/templates/builder':
      return t('nav.templates', 'Templates & Documents');
    case '/requests': return t('nav.requests', 'Requests');
    case '/billing':
    case '/invoices':
    case '/finance':
      if (defaultLabel === 'My Fees & Invoices') return defaultLabel;
      return t('nav.finance', 'Finance & Invoicing');
    case '/reports': return t('nav.reports', 'Reports');
    case '/members': return t('nav.members', 'Members');
    case '/permission-matrix': return t('nav.matrix', 'Permission Matrix');
    case '/activity-log':
    case '/activity-logs':
      return t('nav.activity', 'Activity Log');
    case '/settings': return t('nav.settings', 'Settings');
    default: return defaultLabel;
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed = false,
}) => {
  const { navItems, user, activeMembership, theme, hasPermission } = useSession();
  const { t } = useLanguage();
  const isDarkMode = theme === 'dark';

  const roleName = (activeMembership?.roleName || '').toLowerCase();
  const isAdminOrOwner = roleName.includes('admin') || roleName.includes('owner') || roleName.includes('principal') || roleName.includes('head');

  const canAccessSettings = isAdminOrOwner || (typeof hasPermission === 'function' && hasPermission('settings.manage'));
  const canAccessActivityLog = isAdminOrOwner || (typeof hasPermission === 'function' && hasPermission('audit_logs.read'));

  const uniqueNavItems = React.useMemo(() => {
    const seen = new Set<string>();
    return (navItems || []).filter((item) => {
      if (!item?.path || seen.has(item.path)) return false;
      if (item.requiredPermission && typeof hasPermission === 'function' && !hasPermission(item.requiredPermission)) {
        return false;
      }
      seen.add(item.path);
      return true;
    });
  }, [navItems, hasPermission]);

  const categories = React.useMemo(() => {
    const allItems = [...uniqueNavItems];

    if (canAccessActivityLog && !allItems.some((i) => i.path === '/activity-log' || i.path === '/activity-logs')) {
      allItems.push({ path: '/activity-log', label: 'Activity Log', requiredPermission: 'audit_logs.read' });
    }
    if (canAccessSettings && !allItems.some((i) => i.path === '/settings')) {
      allItems.push({ path: '/settings', label: 'Settings', requiredPermission: 'settings.manage' });
    }

    const mainItems: { label: string; path: string }[] = [
      { label: t('nav.dashboard', 'Dashboard'), path: '/' }
    ];
    const academicItems: { label: string; path: string }[] = [];
    const operationsItems: { label: string; path: string }[] = [];
    const systemItems: { label: string; path: string }[] = [];

    const academicPaths = new Set([
      '/students', '/admissions', '/academic', '/attendance',
      '/employee-attendance', '/attendance/employee', '/examinations', '/assignments'
    ]);
    const operationsPaths = new Set([
      '/billing', '/invoices', '/finance', '/notices', '/tasks',
      '/templates', '/templates/builder', '/requests', '/reports'
    ]);
    const systemPaths = new Set([
      '/members', '/permission-matrix', '/activity-log', '/activity-logs', '/settings'
    ]);

    for (const item of allItems) {
      if (item.path === '/') continue;
      if (academicPaths.has(item.path)) {
        academicItems.push(item);
      } else if (operationsPaths.has(item.path)) {
        operationsItems.push(item);
      } else if (systemPaths.has(item.path)) {
        systemItems.push(item);
      } else {
        operationsItems.push(item);
      }
    }

    const result: { id: string; titleKey: string; defaultTitle: string; items: { label: string; path: string }[] }[] = [
      { id: 'main', titleKey: 'nav.category_main', defaultTitle: 'Main', items: mainItems },
    ];
    if (academicItems.length > 0) {
      result.push({ id: 'academic', titleKey: 'nav.category_academic', defaultTitle: 'Academic', items: academicItems });
    }
    if (operationsItems.length > 0) {
      result.push({ id: 'operations', titleKey: 'nav.category_operations', defaultTitle: 'Operations', items: operationsItems });
    }
    if (systemItems.length > 0) {
      result.push({ id: 'system', titleKey: 'nav.category_system', defaultTitle: 'System', items: systemItems });
    }

    return result;
  }, [uniqueNavItems, canAccessSettings, canAccessActivityLog, t]);

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
        className={`app-sidebar ${isOpenMobile ? 'sidebar-open' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`.trim()}
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
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
                    fontSize: '1.2rem',
                    letterSpacing: '-0.02em',
                    color: 'var(--text-primary)',
                    lineHeight: 1.2,
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

        {/* Categorized Navigation Menu */}
        <div
          className="sidebar-nav-scroll"
          style={{
            flex: 1,
            padding: isCollapsed ? '0.5rem 0.25rem' : '0.5rem 0.65rem',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {categories.map((category, catIdx) => (
            <div key={category.id} style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Category Header or Divider */}
              {!isCollapsed ? (
                <div
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: 'var(--text-muted)',
                    padding: catIdx === 0 ? '0.25rem 0.5rem 0.35rem' : '0.65rem 0.5rem 0.35rem',
                    userSelect: 'none',
                  }}
                >
                  {t(category.titleKey, category.defaultTitle)}
                </div>
              ) : (
                catIdx > 0 && (
                  <div
                    style={{
                      height: '1px',
                      background: 'var(--border-subtle)',
                      margin: '0.35rem 0.25rem',
                    }}
                  />
                )
              )}

              {/* Items in Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {category.items.map((item) => {
                  const isActive = currentPath === item.path;
                  const localizedLabel = getLocalizedNavLabel(item.path, item.label, t);

                  return (
                    <button
                      key={item.path}
                      onClick={() => handleItemClick(item.path)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: isCollapsed ? 0 : '0.65rem',
                        padding: isCollapsed ? '0.6rem' : '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: isActive ? 'var(--brand-primary)' : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: isActive ? 600 : 400,
                        fontSize: '0.80rem',
                        border: 'none',
                        transition: 'all var(--transition-fast)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        position: 'relative',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--surface-hover)';
                          e.currentTarget.style.color = 'var(--text-primary)';
                          const icon = e.currentTarget.querySelector('.nav-icon') as HTMLElement;
                          if (icon) icon.style.color = 'var(--brand-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          const icon = e.currentTarget.querySelector('.nav-icon') as HTMLElement;
                          if (icon) icon.style.color = 'var(--text-muted)';
                        }
                      }}
                      title={isCollapsed ? localizedLabel : ''}
                    >
                      {/* Navigation Icon */}
                      <span
                        className="nav-icon"
                        style={{
                          color: isActive ? '#ffffff' : 'var(--text-muted)',
                          opacity: isActive ? 1 : 0.75,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.2s ease',
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
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {localizedLabel}
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
                            transform: 'translateY(-50%)',
                            width: '3px',
                            height: '22px',
                            background: 'var(--brand-primary)',
                            borderRadius: '0 2px 2px 0',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
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
