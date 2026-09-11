import React, { useState, useEffect } from 'react';
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
  ChevronDown,
  X,
  Sliders,
  UserPlus,
  Award,
  History,
  BookOpen,
  ClipboardList,
  Settings,
  BarChart3,
  FileText,
  Shield,
  Sparkles,
  School,
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

interface NavCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: {
    label: string;
    path: string;
    icon: React.ReactNode;
    requiredPermission?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPath,
  onNavigate,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed = false,
  isMobile = false,
}) => {
  const { navItems, user, activeMembership, theme } = useSession();
  const isDarkMode = theme === 'dark';

  // Master categorized navigation structure
  const categories: NavCategory[] = [
    {
      id: 'overview',
      label: 'Overview & Analytics',
      icon: <Sparkles size={14} />,
      items: [
        { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={18} /> },
        { label: 'Reports & Analytics', path: '/reports', icon: <BarChart3 size={18} />, requiredPermission: 'students.read' },
      ],
    },
    {
      id: 'students',
      label: 'Student Lifecycle',
      icon: <GraduationCap size={14} />,
      items: [
        { label: 'Students Directory', path: '/students', icon: <GraduationCap size={18} />, requiredPermission: 'students.read' },
        { label: 'Admissions Funnel', path: '/admissions', icon: <UserPlus size={18} />, requiredPermission: 'admissions.read' },
      ],
    },
    {
      id: 'academics',
      label: 'Academic Engine',
      icon: <School size={14} />,
      items: [
        { label: 'Academic Setup', path: '/academic', icon: <Layers size={18} />, requiredPermission: 'classes.manage' },
        { label: 'Examinations & Marks', path: '/examinations', icon: <Award size={18} />, requiredPermission: 'marks.read' },
        { label: 'Assignments', path: '/assignments', icon: <BookOpen size={18} />, requiredPermission: 'assignments.read' },
        { label: 'Daily Attendance', path: '/attendance', icon: <CalendarCheck size={18} />, requiredPermission: 'attendance.read' },
      ],
    },
    {
      id: 'campus',
      label: 'Documents & Campus',
      icon: <FileText size={14} />,
      items: [
        { label: 'Document Templates', path: '/templates', icon: <FileText size={18} />, requiredPermission: 'templates.read' },
        { label: 'Campus Notices', path: '/notices', icon: <Bell size={18} />, requiredPermission: 'notices.read' },
        { label: 'Staff Tasks', path: '/tasks', icon: <ClipboardList size={18} />, requiredPermission: 'tasks.read' },
      ],
    },
    {
      id: 'admin',
      label: 'Administration',
      icon: <Shield size={14} />,
      items: [
        { label: 'Staff Members', path: '/members', icon: <Users size={18} />, requiredPermission: 'memberships.manage' },
        { label: 'Permission Matrix', path: '/permission-matrix', icon: <Sliders size={18} />, requiredPermission: 'roles.manage' },
        { label: 'Audit Logs', path: '/activity-log', icon: <History size={18} />, requiredPermission: 'audit_logs.read' },
        { label: 'Institution Settings', path: '/settings', icon: <Settings size={18} />, requiredPermission: 'settings.manage' },
      ],
    },
  ];

  // Determine active category based on currentPath
  const getActiveCategoryId = (): string => {
    for (const cat of categories) {
      if (cat.items.some((item) => item.path === currentPath)) {
        return cat.id;
      }
    }
    return 'overview';
  };

  // State to track which categories are open
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    return {
      overview: true,
      students: true,
      academics: true,
      campus: true,
      admin: true,
    };
  });

  // Ensure active category is open when path changes
  useEffect(() => {
    const activeCat = getActiveCategoryId();
    setOpenCategories((prev) => ({ ...prev, [activeCat]: true }));
  }, [currentPath]);

  const toggleCategory = (catId: string) => {
    setOpenCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleItemClick = (path: string) => {
    onNavigate(path);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  // Check if a path is permitted
  const isItemPermitted = (item: { path: string; requiredPermission?: string }) => {
    if (item.path === '/') return true;
    if (item.path === '/templates') return true;
    if (!item.requiredPermission) return true;
    if (!navItems || navItems.length === 0) return true;
    return navItems.some((n) => n.path === item.path);
  };

  const sidebarWidth = isMobile ? 270 : isCollapsed ? 64 : 250;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobile && isOpenMobile && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 1040,
            animation: 'fadeIn 0.2s ease',
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
          zIndex: 1050,
          transform: isMobile
            ? isOpenMobile
              ? 'translateX(0)'
              : 'translateX(-100%)'
            : 'translateX(0)',
          transition: isMobile
            ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isMobile && isOpenMobile ? '0 20px 40px rgba(0,0,0,0.3)' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            height: '64px',
            padding: !isMobile && isCollapsed ? '0 0.75rem' : '0 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: !isMobile && isCollapsed ? 'center' : 'space-between',
            flexShrink: 0,
            transition: 'padding 0.3s ease',
          }}
        >
          <div
            onClick={() => handleItemClick('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: !isMobile && isCollapsed ? 0 : '0.65rem',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <img
                src={isDarkMode ? BiddyapithDarkLogo : BiddyapithLightLogo}
                alt="Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>

            {(isMobile || !isCollapsed) && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: '1.15rem',
                    letterSpacing: '-0.02em',
                    textTransform: 'uppercase',
                    background: 'linear-gradient(135deg, var(--brand-primary), #60a5fa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Biddyapith
                </div>
                <div
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '150px',
                  }}
                >
                  {activeMembership?.institutionName || 'Education Platform'}
                </div>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          {isMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              style={{
                padding: '0.4rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
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

        {/* Categorized Navigation Container */}
        <div
          className="sidebar-scrollable-content"
          style={{
            flex: 1,
            padding: !isMobile && isCollapsed ? '0.5rem 0.25rem' : '0.75rem 0.65rem',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {categories.map((cat) => {
            // Filter items user can access
            const permittedItems = cat.items.filter(isItemPermitted);
            if (permittedItems.length === 0) return null;

            const isOpen = openCategories[cat.id] ?? true;
            const hasActiveItem = permittedItems.some((item) => item.path === currentPath);

            // In collapsed desktop mode: render icons with dividers
            if (!isMobile && isCollapsed) {
              return (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                    paddingBottom: '0.4rem',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  {permittedItems.map((item) => {
                    const isActive = currentPath === item.path;
                    return (
                      <button
                        key={item.path}
                        onClick={() => handleItemClick(item.path)}
                        title={item.label}
                        style={{
                          width: '42px',
                          height: '42px',
                          margin: '0 auto',
                          borderRadius: '8px',
                          border: 'none',
                          background: isActive ? 'var(--brand-primary)' : 'transparent',
                          color: isActive ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {item.icon}
                      </button>
                    );
                  })}
                </div>
              );
            }

            // Expanded Desktop & Mobile Accordion Category
            return (
              <div key={cat.id} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(cat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.35rem 0.6rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: hasActiveItem ? 'var(--brand-primary)' : 'var(--text-muted)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ opacity: 0.8 }}>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </div>
                  <span style={{ opacity: 0.6 }}>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>

                {/* Category Nav Items */}
                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', marginTop: '0.2rem' }}>
                    {permittedItems.map((item) => {
                      const isActive = currentPath === item.path;

                      return (
                        <button
                          key={item.path}
                          onClick={() => handleItemClick(item.path)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '0.55rem 0.75rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: isActive ? 'var(--brand-primary)' : 'transparent',
                            color: isActive ? '#ffffff' : 'var(--text-secondary)',
                            fontWeight: isActive ? 600 : 450,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'var(--surface-hover)';
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                                opacity: isActive ? 1 : 0.75,
                                flexShrink: 0,
                              }}
                            >
                              {item.icon}
                            </span>
                            <span
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.label}
                            </span>
                          </div>

                          {isActive && (
                            <ChevronRight
                              size={14}
                              style={{ opacity: 0.8, flexShrink: 0 }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* User Footer Profile Strip */}
        <div
          style={{
            padding: !isMobile && isCollapsed ? '0.75rem' : '0.85rem 1.15rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: !isMobile && isCollapsed ? 'center' : 'flex-start',
            transition: 'padding 0.3s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: !isMobile && isCollapsed ? 0 : '0.65rem',
              width: '100%',
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--brand-primary)',
                color: '#ffffff',
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
            {(isMobile || !isCollapsed) && (
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user?.name || 'User'}
                </div>
                <div
                  style={{
                    fontSize: '0.68rem',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {activeMembership?.roleName || 'Member'}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .sidebar-scrollable-content::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-scrollable-content::-webkit-scrollbar-thumb {
          background: var(--border-subtle);
          border-radius: 4px;
        }
      `}</style>
    </>
  );
};

export default Sidebar;