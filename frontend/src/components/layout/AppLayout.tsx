import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { CommandPalette } from '../common/CommandPalette';
import { useSession } from '../../context/SessionContext';
import { ShieldAlert, LogOut } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  currentPath, 
  onNavigate 
}) => {
  const { navItems, isImpersonating, impersonator, stopImpersonating, user, activeMembership } = useSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Close mobile nav on window resize to desktop
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mobileNavOpen]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const sidebarWidth = isSidebarCollapsed ? 64 : 240;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {/* Sidebar */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpenMobile={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      {/* Main Content Area */}
      <div 
        className="app-main-wrapper"
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          minWidth: 0,
          marginLeft: `${sidebarWidth}px`,
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Top Header */}
        <Header
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        {/* Impersonation Alert Banner */}
        {isImpersonating && (
          <div
            style={{
              backgroundColor: '#d97706',
              backgroundImage: 'linear-gradient(90deg, #b45309 0%, #d97706 100%)',
              color: '#ffffff',
              padding: '0.65rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              fontSize: '0.85rem',
              fontWeight: 500,
              zIndex: 90,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, overflow: 'hidden' }}>
              <span style={{ display: 'inline-flex', padding: '0.25rem', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '4px' }}>
                <ShieldAlert size={16} />
              </span>
              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <strong>Impersonation Active:</strong> Viewing workspace as <strong>{user?.name || 'User'}</strong> ({activeMembership?.roleName || 'Member'}).
                {impersonator && <span style={{ opacity: 0.9, marginLeft: '0.35rem' }}>(Initiated by {impersonator.name} &bull; {impersonator.roleName})</span>}
              </span>
            </div>
            <button
              onClick={() => stopImpersonating()}
              style={{
                backgroundColor: '#ffffff',
                color: '#92400e',
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef3c7')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              <LogOut size={14} />
              Exit Impersonation
            </button>
          </div>
        )}

        {/* Page Content Container */}
        <main
          style={{
            flex: 1,
            padding: '1.5rem',
            maxWidth: '1400px',
            width: '100%',
            margin: '0 auto',
            background: 'var(--bg)',
          }}
        >
          {children}
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={onNavigate}
        navItems={navItems}
      />
    </div>
  );
};

export default AppLayout;