import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { Sun, Moon, LogOut, Menu, Search, Building2, UserCheck, Bell } from 'lucide-react';
import { UserProfileModal } from '../common/UserProfileModal';
import { NotificationDrawer } from '../common/NotificationDrawer';
import { fetchNotifications } from '../../services/api';

interface HeaderProps {
  onOpenMobileNav?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileNav,
  onOpenCommandPalette,
}) => {
  const { user, activeMembership, institutionName, theme, toggleTheme, logout } = useSession();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Poll notifications count periodically
  useEffect(() => {
    let mounted = true;
    const checkUnread = async () => {
      try {
        const res = await fetchNotifications(10);
        if (mounted) {
          setUnreadNotificationCount(res.unreadCount || 0);
        }
      } catch {}
    };

    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <header
        style={{
          height: '56px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        {/* Left side: Mobile Toggle & School Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {onOpenMobileNav && (
            <button
              onClick={onOpenMobileNav}
              className="btn btn-ghost btn-sm"
              style={{ padding: '0.35rem' }}
              title="Open Menu"
            >
              <Menu size={18} />
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              {institutionName}
            </span>
          </div>
        </div>

        {/* Right side: Search Quick-Key, Notifications, Theme Switcher, User Details, Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Search size={14} />
              <span>Search...</span>
              <kbd
                style={{
                  fontSize: '0.68rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '3px',
                  padding: '0.1rem 0.35rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Ctrl+K
              </kbd>
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={() => setShowNotificationDrawer(true)}
            className="btn btn-ghost btn-sm"
            title="Notifications"
            style={{
              padding: '0.4rem',
              color: unreadNotificationCount > 0 ? 'var(--primary)' : 'var(--text-secondary)',
              position: 'relative',
            }}
          >
            <Bell size={17} />
            {unreadNotificationCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'var(--danger, #ef4444)',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: 'var(--radius-full)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  boxShadow: '0 0 0 2px var(--surface)',
                }}
              >
                {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
              </span>
            )}
          </button>

          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-sm"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ padding: '0.4rem', color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <div
            style={{
              height: '24px',
              width: '1px',
              backgroundColor: 'var(--border)',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => setShowProfileModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'right',
                padding: '0.2rem 0.4rem',
                borderRadius: 'var(--radius-sm)',
              }}
              title="Edit Profile"
            >
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {activeMembership?.roleName || 'Member'}
                </div>
              </div>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'rgba(30, 95, 91, 0.15)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : <UserCheck size={14} />}
              </div>
            </button>

            <button
              onClick={logout}
              className="btn btn-ghost btn-sm"
              title="Sign Out"
              style={{ padding: '0.4rem', color: 'var(--danger)' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <UserProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      <NotificationDrawer
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        onUnreadCountChange={(count) => setUnreadNotificationCount(count)}
      />
    </>
  );
};
