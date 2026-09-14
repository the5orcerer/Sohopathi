import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { fetchNotices, createNotice, fetchClasses } from '../services/api';
import type { Notice, ClassItem } from '../types';
import { SearchBar, Badge, Button, Modal } from '../components/common';
import { Plus, Info, Calendar, AlertCircle, Users, GraduationCap, CheckSquare, Square } from 'lucide-react';

const ROLE_OPTIONS = [
  { id: 'Teacher', label: 'Teachers / Faculty' },
  { id: 'Staff', label: 'Office & Support Staff' },
  { id: 'Student', label: 'Students' },
  { id: 'Institution Admin', label: 'Institutional Administrators' },
];

export const NoticesPage: React.FC = () => {
  const { hasPermission } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'institution' | 'roles' | 'classes'>('all');
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);

  // Form State with strict limits (120 title, 2000 body)
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceScope, setAudienceScope] = useState<'institution' | 'roles' | 'classes'>('institution');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
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
    fetchClasses()
      .then((cls) => setClasses(cls || []))
      .catch(console.error);
  }, []);

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleClassToggle = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((c) => c !== classId) : [...prev, classId]
    );
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    if (audienceScope === 'roles' && selectedRoles.length === 0) {
      setError('Please select at least one role for this targeted notice.');
      return;
    }
    if (audienceScope === 'classes' && selectedClassIds.length === 0) {
      setError('Please select at least one academic class for this targeted notice.');
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      await createNotice({
        title: title.trim().substring(0, 120),
        body: body.trim().substring(0, 2000),
        audienceScope,
        targetRoles: audienceScope === 'roles' ? selectedRoles : undefined,
        targetClassIds: audienceScope === 'classes' ? selectedClassIds : undefined,
      });
      setShowPublishModal(false);
      setTitle('');
      setBody('');
      setSelectedRoles([]);
      setSelectedClassIds([]);
      setAudienceScope('institution');
      loadNotices();
    } catch (err: any) {
      setError(err.message || 'Failed to publish notice');
    } finally {
      setPublishing(false);
    }
  };

  const filteredNotices = notices.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.body.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'institution') return n.audienceScope === 'institution' || !n.audienceScope;
    if (activeFilter === 'roles') return n.audienceScope === 'roles' || (n.targetRoles && n.targetRoles.length > 0);
    if (activeFilter === 'classes') return n.audienceScope === 'classes' || (n.targetClassIds && n.targetClassIds.length > 0);
    return true;
  });

  return (
    <div className="page-container animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title" style={{ margin: '0 0 0.25rem 0' }}>
            Campus Notice Board
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            Official announcements, circulars, and targeted notifications with audience scoping.
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

      {/* Filter Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--surface-sunken)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeFilter === 'all' ? 600 : 400,
              background: activeFilter === 'all' ? 'var(--surface)' : 'transparent',
              color: activeFilter === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            All Notices ({notices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('institution')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeFilter === 'institution' ? 600 : 400,
              background: activeFilter === 'institution' ? 'var(--surface)' : 'transparent',
              color: activeFilter === 'institution' ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Entire School
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('roles')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeFilter === 'roles' ? 600 : 400,
              background: activeFilter === 'roles' ? 'var(--surface)' : 'transparent',
              color: activeFilter === 'roles' ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Role-Targeted
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('classes')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeFilter === 'classes' ? 600 : 400,
              background: activeFilter === 'classes' ? 'var(--surface)' : 'transparent',
              color: activeFilter === 'classes' ? 'var(--primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Class-Specific
          </button>
        </div>

        <SearchBar
          placeholder="Search circulars, announcements..."
          value={searchQuery}
          onChange={setSearchQuery}
          style={{ maxWidth: '320px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredNotices.length === 0 ? (
          <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No notices published matching this filter.
          </div>
        ) : (
          filteredNotices.map((notice) => {
            const classNames = (notice.targetClassIds || [])
              .map((id) => classes.find((c) => c.id === id)?.name)
              .filter(Boolean);

            return (
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Badge tone={notice.audienceScope === 'institution' ? 'primary' : notice.audienceScope === 'roles' ? 'warning' : 'info'}>
                      {notice.audienceScope === 'institution'
                        ? 'Entire School'
                        : notice.audienceScope === 'roles'
                        ? 'Specific Roles'
                        : notice.audienceScope === 'classes'
                        ? 'Class Specific'
                        : notice.audienceScope || 'General'}
                    </Badge>

                    {notice.targetRoles && notice.targetRoles.length > 0 && (
                      <span style={{ display: 'flex', gap: '0.25rem' }}>
                        {notice.targetRoles.map((r) => (
                          <Badge key={r} tone="neutral">{r}</Badge>
                        ))}
                      </span>
                    )}

                    {classNames.length > 0 && (
                      <span style={{ display: 'flex', gap: '0.25rem' }}>
                        {classNames.map((cn) => (
                          <Badge key={cn} tone="success">{cn}</Badge>
                        ))}
                      </span>
                    )}

                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={12} /> {notice.publishedAt ? new Date(notice.publishedAt).toLocaleDateString() : 'Today'}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {notice.body}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Publish Notice Modal */}
      {showPublishModal && (
        <Modal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          title="Publish Campus Announcement"
          subtitle="Broadcast announcement with granular audience scope filters"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowPublishModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handlePublishSubmit} disabled={publishing}>
                {publishing ? 'Publishing...' : 'Publish Announcement'}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Title with live counter & 120 character limit */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Notice Title <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <span style={{ fontSize: '0.72rem', color: title.length >= 110 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {title.length}/120
                </span>
              </div>
              <input
                type="text"
                className="input"
                maxLength={120}
                placeholder="e.g. Science Fair Registration Open (Max 120 characters)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Audience Scope Selector */}
            <div className="form-group">
              <label className="form-label">Audience Scope & Filter</label>
              <select
                className="select"
                value={audienceScope}
                onChange={(e) => setAudienceScope(e.target.value as any)}
              >
                <option value="institution">Entire School (Institution-Wide)</option>
                <option value="roles">Target Specific User Roles</option>
                <option value="classes">Target Specific Academic Classes</option>
              </select>
            </div>

            {/* Granular Scope 1: Role Checkboxes */}
            {audienceScope === 'roles' && (
              <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Users size={14} /> Select Recipient Roles:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {ROLE_OPTIONS.map((r) => {
                    const isChecked = selectedRoles.includes(r.id);
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleRoleToggle(r.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.35rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                          border: isChecked ? '1px solid var(--primary)' : '1px solid transparent',
                          fontSize: '0.8rem',
                          color: isChecked ? 'var(--primary)' : 'var(--text-primary)',
                        }}
                      >
                        {isChecked ? <CheckSquare size={15} color="var(--primary)" /> : <Square size={15} color="var(--text-muted)" />}
                        <span>{r.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Granular Scope 2: Class Checkboxes */}
            {audienceScope === 'classes' && (
              <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <GraduationCap size={14} /> Select Recipient Classes:
                </div>
                {classes.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No academic classes configured yet.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.4rem', maxHeight: '140px', overflowY: 'auto' }}>
                    {classes.map((cls) => {
                      const isChecked = selectedClassIds.includes(cls.id);
                      return (
                        <div
                          key={cls.id}
                          onClick={() => handleClassToggle(cls.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.3rem 0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            background: isChecked ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                            border: isChecked ? '1px solid var(--primary)' : '1px solid transparent',
                            fontSize: '0.78rem',
                            color: isChecked ? 'var(--primary)' : 'var(--text-primary)',
                          }}
                        >
                          {isChecked ? <CheckSquare size={14} color="var(--primary)" /> : <Square size={14} color="var(--text-muted)" />}
                          <span>{cls.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Announcement Body with live counter & 2000 character limit */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Announcement Content <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <span style={{ fontSize: '0.72rem', color: body.length >= 1900 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {body.length}/2000
                </span>
              </div>
              <textarea
                className="input"
                rows={5}
                maxLength={2000}
                placeholder="Write the full announcement text (Max 2000 characters)..."
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
