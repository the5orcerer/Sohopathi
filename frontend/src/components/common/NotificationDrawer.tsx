import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  UserCheck,
  Megaphone,
  X,
  Clock,
} from 'lucide-react';
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../services/api';
import type { NotificationItem } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onUnreadCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetchNotifications(40);
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
      onUnreadCountChange?.(res.unreadCount || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => {
        const next = Math.max(0, c - 1);
        onUnreadCountChange?.(next);
        return next;
      });
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      onUnreadCountChange?.(0);
    } catch {}
  };

  if (!isOpen) return null;

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
        return <ClipboardList size={16} style={{ color: 'var(--primary)' }} />;
      case 'role_update':
        return <UserCheck size={16} style={{ color: 'var(--status-info, #0284c7)' }} />;
      case 'attendance_alert':
        return <AlertCircle size={16} style={{ color: 'var(--status-warning, #eab308)' }} />;
      case 'notice_published':
        return <Megaphone size={16} style={{ color: 'var(--accent, #f97316)' }} />;
      default:
        return <Bell size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(2px)',
          zIndex: 998,
        }}
      />

      {/* Drawer Panel */}
      <div
        className="animate-fade-in"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--surface)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
          zIndex: 999,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface-sunken)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Notifications
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                title="Mark all as read"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.3rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <CheckCheck size={14} />
                <span>Mark Read</span>
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.35rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Notification List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading updates...
            </div>
          ) : notifications.length === 0 ? (
            <div
              style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--surface-sunken)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={24} style={{ color: 'var(--status-success)' }} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                No notifications right now
              </div>
              <div style={{ fontSize: '0.8rem', maxWidth: '240px' }}>
                You will receive alerts here when staff assignments, attendance records, or role changes occur.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkRead(n.id)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: n.isRead ? 'var(--surface)' : 'var(--primary-subtle)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    gap: '0.75rem',
                    cursor: n.isRead ? 'default' : 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      marginTop: '0.1rem',
                      flexShrink: 0,
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--surface-sunken)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {renderTypeIcon(n.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: n.isRead ? 500 : 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {n.title}
                      </span>
                      {!n.isRead && (
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--primary)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                      {n.body}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <Clock size={11} />
                      <span>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Push Notification Readiness Footer */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-sunken)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Android & WebPush Dispatch Ready</span>
          <span style={{ fontWeight: 600, color: 'var(--status-success)' }}>Active</span>
        </div>
      </div>
    </>
  );
};

