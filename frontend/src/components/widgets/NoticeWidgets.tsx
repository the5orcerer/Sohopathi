import React, { useState, useEffect } from 'react';
import type { WidgetProps, Notice } from '../../types';
import { fetchWidgetData } from '../../services/api';
import { Bell, AlertTriangle, Info, Check, Plus, Loader2 } from 'lucide-react';
import { useSession } from '../../context/SessionContext';

export const NoticeBoard: React.FC<WidgetProps> = ({ dataSource }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newBody, setNewBody] = useState<string>('');
  const { hasPermission } = useSession();

  const canWriteNotices = hasPermission('notices.write');

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<Notice[]>(dataSource)
      .then((res) => {
        if (isMounted && Array.isArray(res)) {
          setNotices(res);
          const initialRead = new Set<string>();
          res.forEach((n) => {
            if (n.isRead) initialRead.add(n.id);
          });
          setReadIds(initialRead);
        }
      })
      .catch((err) => console.error('Failed to load notices', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  const toggleRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePostNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;

    const created: Notice = {
      id: `notice-${Date.now()}`,
      title: newTitle,
      body: newBody,
      audienceScope: 'all',
      createdAt: new Date().toISOString(),
      priority: 'high',
      isRead: false,
    };

    setNotices([created, ...notices]);
    setNewTitle('');
    setNewBody('');
    setShowPostModal(false);
  };

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><Bell size={16} /></span>
            Institution Notices
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading announcements...
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><Bell size={16} /></span>
          Campus Announcements
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-info">
            {notices.filter((n) => !readIds.has(n.id)).length} New
          </span>
          {canWriteNotices && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowPostModal(true)}
              title="Post Announcement"
            >
              <Plus size={13} /> Post
            </button>
          )}
        </div>
      </div>

      <div className="widget-body">
        {showPostModal && (
          <form
            onSubmit={handlePostNotice}
            style={{
              padding: '0.75rem',
              marginBottom: '0.75rem',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid var(--border-accent)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-light)' }}>
              Publish Campus Notice
            </div>
            <input
              type="text"
              placeholder="Notice title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
              }}
              required
            />
            <textarea
              placeholder="Details and audience instruction..."
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={2}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '0.4rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                resize: 'none',
              }}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPostModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm">
                Publish
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem' }}>
          {notices.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No notices published yet.
            </div>
          ) : (
            notices.map((notice) => {
              const isRead = readIds.has(notice.id);
              const isUrgent = notice.priority === 'urgent';
              return (
                <div
                  key={notice.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: isRead ? 'rgba(255, 255, 255, 0.02)' : 'rgba(99, 102, 241, 0.05)',
                    border: isRead ? '1px solid var(--border-subtle)' : '1px solid rgba(99, 102, 241, 0.25)',
                    opacity: isRead ? 0.75 : 1,
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, fontSize: '0.85rem' }}>
                      {isUrgent ? (
                        <AlertTriangle size={14} color="#f43f5e" />
                      ) : (
                        <Info size={14} color="var(--primary-light)" />
                      )}
                      <span>{notice.title}</span>
                    </div>

                    <button
                      onClick={() => toggleRead(notice.id)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                      title={isRead ? 'Mark as Unread' : 'Mark as Read'}
                    >
                      {isRead ? <Check size={12} color="#10b981" /> : 'Read'}
                    </button>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.4rem' }}>
                    {notice.body}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Audience: {notice.audienceScope || 'All Campus'}</span>
                    <span>{new Date(notice.createdAt || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
