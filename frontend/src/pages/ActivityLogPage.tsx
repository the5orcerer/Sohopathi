import React, { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { fetchAuditLogs, fetchMembers } from '../services/api';
import type { AuditLogEntry, Member } from '../types';
import { SearchBar, Badge, Button, EmptyState, Pagination } from '../components/common';
import { History, User, Calendar, ChevronDown, ChevronUp, RefreshCw, ArrowRight, FileEdit, Clock } from 'lucide-react';

const formatFieldName = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
};

const formatValueDisplay = (val: any): string => {
  if (val === null || val === undefined || val === '') return '(none / empty)';
  if (typeof val === 'boolean') return val ? 'Enabled (Yes)' : 'Disabled (No)';
  if (Array.isArray(val)) {
    if (val.length === 0) return '(empty list)';
    return val.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join(', ');
  }
  if (typeof val === 'object') {
    return Object.entries(val)
      .map(([k, v]) => `${formatFieldName(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('; ');
  }
  return String(val);
};

interface FieldDiff {
  key: string;
  label: string;
  beforeVal: any;
  afterVal: any;
  type: 'modified' | 'added' | 'removed';
}

const computeFieldDiffs = (before: Record<string, any> | null, after: Record<string, any> | null): FieldDiff[] => {
  const diffs: FieldDiff[] = [];
  const b = before || {};
  const a = after || {};
  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));

  for (const key of allKeys) {
    const hasBefore = key in b && b[key] !== undefined;
    const hasAfter = key in a && a[key] !== undefined;
    const beforeVal = b[key];
    const afterVal = a[key];

    if (hasBefore && hasAfter) {
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        diffs.push({
          key,
          label: formatFieldName(key),
          beforeVal,
          afterVal,
          type: 'modified',
        });
      }
    } else if (!hasBefore && hasAfter) {
      diffs.push({
        key,
        label: formatFieldName(key),
        beforeVal: undefined,
        afterVal,
        type: 'added',
      });
    } else if (hasBefore && !hasAfter) {
      diffs.push({
        key,
        label: formatFieldName(key),
        beforeVal,
        afterVal: undefined,
        type: 'removed',
      });
    }
  }

  return diffs;
};

const ChangeLogViewer: React.FC<{ log: AuditLogEntry }> = ({ log }) => {
  const diffs = computeFieldDiffs(log.before, log.after);

  return (
    <div
      style={{
        marginTop: '0.6rem',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-sunken)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <FileEdit size={15} style={{ color: 'var(--primary)' }} />
          <span>Change Log: Details of {log.action.replace(/_/g, ' ')} on {log.entityType.replace(/_/g, ' ')}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Clock size={12} />
          <span>Recorded: {new Date(log.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {diffs.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
          No individual field modifications recorded in payload.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(180px, 2fr) 20px minmax(180px, 2fr)', gap: '0.6rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '0 0.6rem' }}>
            <span>Attribute</span>
            <span>Previous Value</span>
            <span></span>
            <span>Updated Value</span>
          </div>

          {diffs.map((diff) => (
            <div
              key={diff.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(180px, 2fr) 20px minmax(180px, 2fr)',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.45rem 0.6rem',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                {diff.type === 'modified' && <Badge tone="warning">MODIFIED</Badge>}
                {diff.type === 'added' && <Badge tone="success">INITIALIZED</Badge>}
                {diff.type === 'removed' && <Badge tone="danger">REMOVED</Badge>}
                <span>{diff.label}</span>
              </div>

              <div
                style={{
                  color: diff.type === 'added' ? 'var(--text-muted)' : 'var(--status-danger)',
                  textDecoration: diff.type === 'modified' ? 'line-through' : 'none',
                  background: diff.type === 'added' ? 'transparent' : 'rgba(239, 68, 68, 0.08)',
                  padding: '0.25rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  wordBreak: 'break-word',
                  fontSize: '0.78rem',
                }}
              >
                {diff.beforeVal !== undefined ? formatValueDisplay(diff.beforeVal) : '(Not set)'}
              </div>

              <ArrowRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

              <div
                style={{
                  color: diff.type === 'removed' ? 'var(--text-muted)' : 'var(--status-success)',
                  fontWeight: 600,
                  background: diff.type === 'removed' ? 'transparent' : 'rgba(34, 197, 94, 0.08)',
                  padding: '0.25rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  wordBreak: 'break-word',
                  fontSize: '0.78rem',
                }}
              >
                {diff.afterVal !== undefined ? formatValueDisplay(diff.afterVal) : '(Deleted)'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

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

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedAction, selectedEntity, selectedActor]);

  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

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
              <span>Showing <strong>{paginatedLogs.length}</strong> of {filteredLogs.length} events (Total in DB: {total})</span>
              <span>Sorted by Most Recent</span>
            </div>

            {paginatedLogs.map((log) => {
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
                        {isExpanded ? 'Close Change Log' : 'View Change Log'}
                      </Button>
                    )}
                  </div>

                  {/* Human-Readable Change Log Viewer */}
                  {isExpanded && <ChangeLogViewer log={log} />}
                </div>
              );
            })}

            <div style={{ padding: '0.75rem 0.25rem' }}>
              <Pagination
                currentPage={page}
                totalItems={filteredLogs.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
};
