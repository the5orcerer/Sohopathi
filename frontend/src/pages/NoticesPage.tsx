import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { fetchNotices, createNotice } from '../services/api';
import type { Notice } from '../types';
import { SearchBar, Badge, Button, Modal } from '../components/common';
import { Plus, Info, Calendar, AlertCircle } from 'lucide-react';

export const NoticesPage: React.FC = () => {
  const { hasPermission } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceScope, setAudienceScope] = useState('institution');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canWriteNotices = hasPermission('notices.write');

  const loadNotices = () => {
    fetchNotices()
      .then((res) => {
        if (Array.isArray(res)) setNotices(res);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setPublishing(true);
    setError(null);
    try {
      await createNotice({
        title: title.trim(),
        body: body.trim(),
        audienceScope,
      });
      setShowPublishModal(false);
      setTitle('');
      setBody('');
      loadNotices();
    } catch (err: any) {
      setError(err.message || 'Failed to publish notice');
    } finally {
      setPublishing(false);
    }
  };

  const filteredNotices = notices.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.body.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 0 0.25rem 0' }}>
            Campus Notice Board
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Official announcements, circulars, and notifications across academic cohorts
          </p>
        </div>

        {canWriteNotices && (
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowPublishModal(true)}>
            Publish Notice
          </Button>
        )}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <SearchBar
          placeholder="Search circulars, announcements..."
          value={searchQuery}
          onChange={setSearchQuery}
        />
        <Badge tone="info">{filteredNotices.length} Published Notices</Badge>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredNotices.length === 0 ? (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No notices published yet.
          </div>
        ) : (
          filteredNotices.map((notice) => (
            <div
              key={notice.id}
              className="card"
              style={{
                padding: '1.25rem',
                borderLeft: '4px solid var(--primary)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Info size={18} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {notice.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge tone="info">{notice.audienceScope || 'institution'}</Badge>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={12} /> {notice.publishedAt ? new Date(notice.publishedAt).toLocaleDateString() : 'Today'}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {notice.body}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Publish Notice Modal */}
      {showPublishModal && (
        <Modal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          title="Publish Campus Announcement"
          subtitle="Broadcast announcement to faculty, students, and staff"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowPublishModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handlePublishSubmit} disabled={publishing}>
                {publishing ? 'Publishing...' : 'Publish Announcement'}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Notice Title</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Science Fair Registration Open"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Audience Scope</label>
              <select className="select" value={audienceScope} onChange={(e) => setAudienceScope(e.target.value)}>
                <option value="institution">Entire School (Institution-Wide)</option>
                <option value="students">Students Only</option>
                <option value="teachers">Faculty / Teachers Only</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Announcement Content</label>
              <textarea
                className="input"
                rows={5}
                placeholder="Write the full announcement text..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
