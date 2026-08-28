import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { fetchAuditLogs, fetchMembers } from '../services/api';
import type { AuditLogEntry, Member } from '../types';
import { SearchBar, Badge, Button, EmptyState } from '../components/common';
import { History, User, Calendar, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

export const ActivityLogPage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [members, setMembers] = useState<Member[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [selectedActor, setSelectedActor] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await fetchAuditLogs({
        action: selectedAction || undefined,
        entityType: selectedEntity || undefined,
        actorMembershipId: selectedActor || undefined,
        limit: 100,
      });
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    fetchMembers().then(setMembers).catch(console.error);
  }, [selectedAction, selectedEntity, selectedActor]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.actorName && log.actorName.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.entityType && log.entityType.toLowerCase().includes(q)) ||
      (log.entityId && log.entityId.toLowerCase().includes(q))
    );
  });

  const getActionTone = (action: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' => {
    const act = action.toLowerCase();
    if (act.includes('delete')) return 'danger';
    if (act.includes('update') || act.includes('change')) return 'warning';
    if (act.includes('create') || act.includes('invite') || act.includes('submit')) return 'success';
    if (act.includes('permission') || act.includes('matrix')) return 'primary';
    return 'info';
  };

  return (
    <ProtectedRoute requiredPermission="audit_logs.read" onNavigateHome={onNavigateHome}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <History size={24} style={{ color: 'var(--brand-primary)' }} /> Activity Log & Audit Trail
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Transparent timeline of major administrative changes, role permissions updates, and record lifecycles.
            </p>
          </div>

          <Button variant="secondary" icon={<RefreshCw size={14} />} onClick={loadLogs} loading={loading}>
            Refresh Feed
          </Button>
        </div>

        {/* Filter Controls Bar */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: '1 1 250px', minWidth: '220px' }}>
            <SearchBar
              placeholder="Search by actor, entity type, ID..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Action Filter */}
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="bulk_delete">Bulk Delete</option>
              <option value="update_permissions">Matrix Permissions</option>
              <option value="invite_member">Staff Invite</option>
              <option value="mark_attendance">Take Attendance</option>
              <option value="record_marks">Score Exam Marks</option>
            </select>

            {/* Entity Filter */}
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="">All Entities</option>
              <option value="student">Student</option>
              <option value="membership">Staff Member</option>
              <option value="role_permission">Role Permissions</option>
              <option value="exam">Examination</option>
              <option value="mark">Exam Mark</option>
              <option value="assignment">Assignment</option>
              <option value="class_schedule">Class Timetable</option>
              <option value="custom_field_definition">Custom Field</option>
              <option value="notice">Notice</option>
            </select>

            {/* Actor Filter */}
            <select
              value={selectedActor}
              onChange={(e) => setSelectedActor(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            >
              <option value="">All Staff Actors</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.roleName})
                </option>
              ))}
            </select>

            {(selectedAction || selectedEntity || selectedActor || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedAction('');
                  setSelectedEntity('');
                  setSelectedActor('');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Logs Feed */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading audit activity records...
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No activity records found"
            description="Administrative actions and state modifications will automatically be indexed here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Showing <strong>{filteredLogs.length}</strong> of {total} events</span>
              <span>Sorted by Most Recent</span>
            </div>

            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const hasDiff = (log.before && Object.keys(log.before).length > 0) || (log.after && Object.keys(log.after).length > 0);

              return (
                <div
                  key={log.id}
                  className="glass-panel"
                  style={{
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Badge tone={getActionTone(log.action)}>
                        {log.action.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {log.entityType.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        #{log.entityId?.substring(0, 8)}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={13} /> {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <User size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>Performed by: <strong>{log.actorName || 'System Service'}</strong></span>
                      {log.actorRole && <Badge tone="neutral">{log.actorRole}</Badge>}
                    </div>

                    {hasDiff && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        icon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      >
                        {isExpanded ? 'Hide Details' : 'View Payload Diff'}
                      </Button>
                    )}
                  </div>

                  {/* Expandable JSON Diff Viewer */}
                  {isExpanded && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-sunken)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.78rem',
                        fontFamily: 'var(--font-mono)',
                        display: 'grid',
                        gridTemplateColumns: log.before && log.after ? '1fr 1fr' : '1fr',
                        gap: '0.75rem',
                      }}
                    >
                      {log.before && (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--status-danger)', marginBottom: '0.25rem' }}>
                            BEFORE STATE
                          </div>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-secondary)' }}>
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.after && (
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--status-success)', marginBottom: '0.25rem' }}>
                            AFTER STATE
                          </div>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-secondary)' }}>
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};
