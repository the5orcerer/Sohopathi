import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import type { NavItem } from '../../types';
import {
  LayoutDashboard,
  CalendarCheck,
  Bell,
  GraduationCap,
  Layers,
  UserPlus,
  Sliders,
  Sun,
  Moon,
  LogOut,
  Search,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  navItems?: NavItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  navItems: propNavItems,
}) => {
  const { navItems: contextNavItems, theme, toggleTheme, logout } = useSession();
  const navItems = propNavItems || contextNavItems || [];
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const defaultCommands = [
    { label: 'Dashboard', path: '/', icon: <LayoutDashboard size={16} /> },
    ...navItems.map((item) => {
      let icon = <Layers size={16} />;
      if (item.path === '/attendance') icon = <CalendarCheck size={16} />;
      if (item.path === '/notices') icon = <Bell size={16} />;
      if (item.path === '/students') icon = <GraduationCap size={16} />;
      if (item.path === '/academic') icon = <Layers size={16} />;
      if (item.path === '/members') icon = <UserPlus size={16} />;
      if (item.path === '/permission-matrix') icon = <Sliders size={16} />;
      return { label: item.label, path: item.path, icon };
    }),
  ];

  const filteredCommands = defaultCommands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: 0,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-dropdown)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Type a command or navigate to a page..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              fontSize: '0.92rem',
            }}
          />
          <kbd
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              padding: '0.1rem 0.4rem',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.4rem 0.65rem' }}>
            Navigation
          </div>

          {filteredCommands.map((cmd) => (
            <button
              key={cmd.path}
              onClick={() => {
                onNavigate(cmd.path);
                onClose();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: '0.86rem',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ color: 'var(--primary)' }}>{cmd.icon}</span>
              <span>{cmd.label}</span>
            </button>
          ))}

          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0.6rem 0.65rem 0.4rem 0.65rem', borderTop: '1px solid var(--border)', marginTop: '0.4rem' }}>
            Actions
          </div>

          <button
            onClick={() => {
              toggleTheme();
              onClose();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.55rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: '0.86rem',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ color: 'var(--text-secondary)' }}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </span>
            <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
          </button>

          <button
            onClick={() => {
              logout();
              onClose();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.55rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--danger)',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              fontSize: '0.86rem',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-bg)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

