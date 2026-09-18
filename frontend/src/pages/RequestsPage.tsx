import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Calendar,
  User,
  Shield,
  AlertCircle,
  RefreshCw,
  Sparkles,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Button, Badge, Modal, EmptyState } from '../components/common';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';
import {
  fetchMemberRequests,
  createMemberRequest,
  updateMemberRequestStatus,
  bulkUpdateMemberRequestStatus,
} from '../services/api';
import type { MemberRequestItem } from '../types';

export const RequestsPage: React.FC = () => {
  const { activeMembership } = useSession();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<'my' | 'approvals'>('my');
  const [requests, setRequests] = useState<MemberRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Multi-selection for bulk approvals
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState<boolean>(false);

  // Create Request Modal State
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [requestType, setRequestType] = useState<'leave' | 'break' | 'schedule' | 'resource' | 'general'>('leave');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [creating, setCreating] = useState<boolean>(false);

  // Review / Decision Modal State
  const [reviewRequest, setReviewRequest] = useState<MemberRequestItem | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState<string>('');
  const [reviewAction, setReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [reviewing, setReviewing] = useState<boolean>(false);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMemberRequests(statusFilter !== 'all' ? statusFilter : undefined);
      setRequests(data);
    } catch (err: any) {
      console.error('Failed to fetch requests:', err);
      setError(err.message || 'Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    setSelectedIds([]);
  }, [statusFilter]);

  const currentRole = (activeMembership?.roleName || '').toLowerCase();
  const isStudent = currentRole.includes('guardian') || currentRole.includes('student');
  const currentMembershipId = activeMembership?.membershipId || activeMembership?.id;

  // Filter requests into "my" vs "approvals"
  const myRequests = requests.filter(
    (r) => r.requesterMembershipId === currentMembershipId
  );
  const incomingApprovals = requests.filter(
    (r) =>
      r.requesterMembershipId !== currentMembershipId &&
      (r.targetManagerMembershipId === currentMembershipId ||
        r.managerMembershipId === currentMembershipId ||
        currentRole.includes('admin'))
  );

  const currentList = activeTab === 'my' ? myRequests : incomingApprovals;

  const filteredList = currentList.filter((item) => {
    const itemType = item.requestType || item.category;
    if (typeFilter !== 'all' && itemType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchReq = (item.requesterName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchReq) return false;
    }
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createMemberRequest({
        requestType,
        title: title.trim(),
        description: description.trim(),
        startDate: requestType === 'leave' || requestType === 'schedule' ? startDate : undefined,
        endDate: requestType === 'leave' || requestType === 'schedule' ? endDate : undefined,
      });
      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      loadRequests();
    } catch (err: any) {
      console.error('Failed to create request:', err);
      setError(err.message || 'Failed to submit request');
    } finally {
      setCreating(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewRequest) return;
    setReviewing(true);
    try {
      await updateMemberRequestStatus(reviewRequest.id, {
        status: reviewAction,
        managerRemarks: reviewRemarks.trim() || undefined,
      });
      setReviewRequest(null);
      setReviewRemarks('');
      loadRequests();
    } catch (err: any) {
      console.error('Failed to update request:', err);
      setError(err.message || 'Failed to review request');
    } finally {
      setReviewing(false);
    }
  };

  // Bulk Actions
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map((r) => r.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatus = async (status: 'approved' | 'rejected') => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(true);
    try {
      await bulkUpdateMemberRequestStatus({
        ids: selectedIds,
        status,
        managerRemarks: `Bulk ${status} by ${activeMembership?.roleName || 'Manager'}`,
      });
      setSelectedIds([]);
      loadRequests();
    } catch (err: any) {
      console.error('Bulk update failed:', err);
      setError(err.message || 'Failed to execute bulk update');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'leave':
        return <Badge tone="warning">{t('requests.leave', 'Leave / Absence')}</Badge>;
      case 'break':
        return <Badge tone="neutral">{t('requests.break', 'Break Request')}</Badge>;
      case 'schedule':
      case 'schedule_change':
        return <Badge tone="info">{t('requests.schedule', 'Schedule Adjustment')}</Badge>;
      case 'resource':
        return <Badge tone="primary">{t('requests.resource', 'Resource Request')}</Badge>;
      default:
        return <Badge tone="neutral">{t('requests.general', 'General Request')}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 9px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <CheckCircle2 size={13} /> {t('common.approved', 'Approved')}
          </span>
        );
      case 'rejected':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 9px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
            }}
          >
            <XCircle size={13} /> {t('common.rejected', 'Rejected')}
          </span>
        );
      case 'in_review':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 9px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--brand-primary, #6366f1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
          >
            <Clock size={13} /> In Review
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 9px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <Clock size={13} /> {t('common.pending', 'Pending')}
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '1.5rem 2rem',
          color: '#ffffff',
          boxShadow: 'var(--shadow-md)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div style={{ maxWidth: '650px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(8px)',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#c7d2fe',
              marginBottom: '0.5rem',
            }}
          >
            <Sparkles size={13} />
            <span>Manager-Routed Workflow Engine</span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.35rem', letterSpacing: '-0.02em', color: '#ffffff' }}>
            {t('requests.title', 'Requests & Approvals Hub')}
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#c7d2fe', margin: 0, lineHeight: 1.5 }}>
            {t('requests.subtitle', 'Submit leave, breaks, schedule swaps, or resources directly to your assigned Class Teacher or Department Manager with automated attendance excusal.')}
          </p>
        </div>

        <div>
          <Button
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            icon={<Plus size={16} />}
            style={{
              background: '#ffffff',
              color: '#312e81',
              fontWeight: 700,
              border: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}
          >
            {t('requests.new_request', 'New Request')}
          </Button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs & Filter Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Pill Tab Bar */}
        <div className="pill-tab-bar">
          <button
            type="button"
            className={`pill-tab ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('my');
              setSelectedIds([]);
            }}
          >
            {t('requests.my_requests', 'My Requests')} ({myRequests.length})
          </button>
          {!isStudent && (
            <button
              type="button"
              className={`pill-tab ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('approvals');
                setSelectedIds([]);
              }}
            >
              {t('requests.manager_approvals', 'Manager Approvals')} ({incomingApprovals.length})
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder={t('requests.search_placeholder', 'Search requests...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.8rem 0.55rem 2.2rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '0.55rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">{t('requests.all_types', 'All Request Types')}</option>
            <option value="leave">{t('requests.leave', 'Leave / Absence')}</option>
            <option value="break">{t('requests.break', 'Break')}</option>
            <option value="schedule">{t('requests.schedule', 'Schedule Adjustment')}</option>
            <option value="resource">{t('requests.resource', 'Resource')}</option>
            <option value="general">{t('requests.general', 'General')}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.55rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">{t('common.all', 'All Statuses')}</option>
            <option value="pending">{t('common.pending', 'Pending')}</option>
            <option value="approved">{t('common.approved', 'Approved')}</option>
            <option value="rejected">{t('common.rejected', 'Rejected')}</option>
          </select>

          <Button variant="secondary" size="sm" onClick={loadRequests} title="Refresh requests">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Bulk Action Toolbar for Manager Approvals */}
      {activeTab === 'approvals' && selectedIds.length > 0 && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-primary, #6366f1)' }}>
              {selectedIds.length} Request{selectedIds.length > 1 ? 's' : ''} Selected
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleBulkStatus('approved')}
              disabled={bulkActionLoading}
              icon={<CheckCircle2 size={14} />}
              style={{ background: '#059669', color: '#fff', border: 'none' }}
            >
              {t('requests.bulk_approve', 'Bulk Approve')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBulkStatus('rejected')}
              disabled={bulkActionLoading}
              icon={<XCircle size={14} />}
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
            >
              {t('requests.bulk_reject', 'Bulk Reject')}
            </Button>
          </div>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem', display: 'block', color: 'var(--brand-primary)' }} />
          <p style={{ fontSize: '0.9rem', margin: 0 }}>Loading requests & manager routing...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          title={activeTab === 'my' ? t('requests.no_requests', 'No Requests Submitted') : 'No Incoming Approvals'}
          description={
            activeTab === 'my'
              ? t('requests.no_requests_desc', 'You have not submitted any leave, break, or schedule requests yet.')
              : 'There are no pending requests assigned to you for review.'
          }
          icon={<GitPullRequest size={44} style={{ opacity: 0.4 }} />}
          actionLabel={activeTab === 'my' ? t('requests.submit_first', 'Submit First Request') : undefined}
          onAction={activeTab === 'my' ? () => setIsCreateOpen(true) : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {activeTab === 'approvals' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: 'inherit',
                  fontWeight: 600,
                }}
              >
                {selectedIds.length === filteredList.length ? (
                  <CheckSquare size={16} style={{ color: 'var(--brand-primary)' }} />
                ) : (
                  <Square size={16} style={{ color: 'var(--text-muted)' }} />
                )}
                <span>Select All ({filteredList.length})</span>
              </button>
            </div>
          )}

          {filteredList.map((req) => {
            const isSelected = selectedIds.includes(req.id);
            return (
              <div
                key={req.id}
                style={{
                  background: 'var(--card-bg, var(--surface))',
                  border: isSelected ? '1.5px solid var(--brand-primary, #6366f1)' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '1.25rem 1.5rem',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
                    {activeTab === 'approvals' && (
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(req.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          marginTop: '2px',
                          padding: 0,
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare size={18} style={{ color: 'var(--brand-primary)' }} />
                        ) : (
                          <Square size={18} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </button>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {getTypeBadge(req.requestType || req.category)}
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                          {req.title}
                        </h3>
                      </div>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                        {req.description}
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.3rem' }}>
                        {req.requesterName && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <User size={13} style={{ color: 'var(--brand-primary)' }} />
                            Requester: {req.requesterName} {req.requesterRole ? `(${req.requesterRole})` : ''}
                          </span>
                        )}

                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Shield size={13} style={{ color: '#8b5cf6' }} />
                          Target Manager: <strong>{req.targetManagerName || req.managerName || 'Class Teacher / Admin'}</strong>
                        </span>

                        {(req.startDate || req.endDate) && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--brand-primary)' }}>
                            <Calendar size={13} />
                            {req.startDate} {req.endDate && req.endDate !== req.startDate ? `➔ ${req.endDate}` : ''}
                          </span>
                        )}

                        <span>
                          Submitted: {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {req.managerRemarks && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.6rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.78rem',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Manager Remarks: </span>
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{req.managerRemarks}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem', flexShrink: 0 }}>
                    <div>{getStatusBadge(req.status)}</div>

                    {activeTab === 'approvals' && req.status === 'pending' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setReviewRequest(req);
                            setReviewAction('approved');
                            setReviewRemarks('');
                          }}
                          style={{ background: '#059669', color: '#fff', border: 'none', padding: '3px 10px', fontSize: '0.75rem' }}
                        >
                          {t('common.approve', 'Approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setReviewRequest(req);
                            setReviewAction('rejected');
                            setReviewRemarks('');
                          }}
                          style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', padding: '3px 10px', fontSize: '0.75rem' }}
                        >
                          {t('common.reject', 'Reject')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Request Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={t('requests.new_request', 'Submit New Official Request')}
        maxWidth="600px"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Request Category
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
              {[
                { id: 'leave', label: t('requests.leave', 'Leave / Absence') },
                { id: 'break', label: t('requests.break', 'Break') },
                { id: 'schedule', label: t('requests.schedule', 'Schedule Adjustment') },
                { id: 'resource', label: t('requests.resource', 'Resource') },
                { id: 'general', label: t('requests.general', 'General') },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  style={{
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-sm)',
                    border: requestType === cat.id ? '1px solid var(--brand-primary)' : '1px solid var(--border)',
                    background: requestType === cat.id ? 'var(--brand-primary)' : 'var(--surface)',
                    color: requestType === cat.id ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                  onClick={() => setRequestType(cat.id as any)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Title / Subject
            </label>
            <input
              type="text"
              placeholder="e.g. Sick Leave Application / Projector Request"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {(requestType === 'leave' || requestType === 'schedule') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Detailed Description & Justification
            </label>
            <textarea
              rows={4}
              placeholder="Provide context for your manager (e.g. medical reason, substitute teacher details, or requested equipment)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              fontSize: '0.78rem',
              color: 'var(--brand-primary, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Shield size={16} style={{ flexShrink: 0 }} />
            <span>
              This request is automatically routed to your assigned Class Teacher or Department Manager.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button variant="primary" type="submit" loading={creating}>
              {t('common.submit', 'Submit Request')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Review Decision Modal */}
      {reviewRequest && (
        <Modal
          isOpen={true}
          onClose={() => setReviewRequest(null)}
          title={`Review Request: ${reviewRequest.title}`}
          maxWidth="550px"
        >
          <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Requester:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {reviewRequest.requesterName} {reviewRequest.requesterRole ? `(${reviewRequest.requesterRole})` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Dates:</span>
                <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                  {reviewRequest.startDate} {reviewRequest.endDate ? `➔ ${reviewRequest.endDate}` : ''}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Description:</span>
                <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-secondary)' }}>{reviewRequest.description}</p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                Administrative Decision Remarks
              </label>
              <textarea
                rows={3}
                placeholder="Optional explanation, instructions, or substitute details..."
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
              <Button variant="secondary" type="button" onClick={() => setReviewRequest(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant={reviewAction === 'approved' ? 'primary' : 'secondary'}
                type="submit"
                loading={reviewing}
                style={
                  reviewAction === 'approved'
                    ? { background: '#059669', color: '#fff', border: 'none' }
                    : { borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }
                }
              >
                {`Confirm ${reviewAction === 'approved' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

