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
import {
  fetchMemberRequests,
  createMemberRequest,
  updateMemberRequestStatus,
  bulkUpdateMemberRequestStatus,
} from '../services/api';
import type { MemberRequestItem } from '../types';

export const RequestsPage: React.FC = () => {
  const { activeMembership } = useSession();

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
        return <Badge tone="warning">Leave / Absence</Badge>;
      case 'break':
        return <Badge tone="neutral">Break Request</Badge>;
      case 'schedule':
      case 'schedule_change':
        return <Badge tone="info">Schedule Adjustment</Badge>;
      case 'resource':
        return <Badge tone="primary">Resource Request</Badge>;
      default:
        return <Badge tone="neutral">General</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
            <XCircle className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      case 'in_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
            <Clock className="w-3.5 h-3.5" /> In Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-indigo-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Manager-Routed Workflow Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Requests & Approvals Hub
          </h1>
          <p className="text-indigo-200 text-sm max-w-xl">
            Submit leave, breaks, schedule swaps, or resources directly to your assigned
            Class Teacher or Department Manager with automated attendance excusal.
          </p>
        </div>

        <div>
          <Button
            variant="primary"
            className="bg-white text-indigo-900 hover:bg-indigo-50 border-0 font-bold shadow-md hover:shadow-lg transition-all"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 w-fit">
          <button
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
              activeTab === 'my'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => {
              setActiveTab('my');
              setSelectedIds([]);
            }}
          >
            My Requests ({myRequests.length})
          </button>
          {!isStudent && (
            <button
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all ${
                activeTab === 'approvals'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              onClick={() => {
                setActiveTab('approvals');
                setSelectedIds([]);
              }}
            >
              Manager Approvals ({incomingApprovals.length})
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search requests..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="leave">Leave / Absence</option>
            <option value="break">Break</option>
            <option value="schedule">Schedule Swap</option>
            <option value="resource">Resource</option>
            <option value="general">General</option>
          </select>

          <select
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <Button variant="secondary" size="sm" onClick={loadRequests}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Bulk Action Toolbar for Manager Approvals */}
      {activeTab === 'approvals' && selectedIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border-2 border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              {selectedIds.length} Request{selectedIds.length > 1 ? 's' : ''} Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-1 h-8"
              onClick={() => handleBulkStatus('approved')}
              disabled={bulkActionLoading}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Bulk Approve
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 font-semibold text-xs py-1 h-8"
              onClick={() => handleBulkStatus('rejected')}
              disabled={bulkActionLoading}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Bulk Reject
            </Button>
          </div>
        </div>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-500">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Loading requests & manager routing...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          title={activeTab === 'my' ? 'No Requests Submitted' : 'No Incoming Approvals'}
          description={
            activeTab === 'my'
              ? 'You have not submitted any leave, break, or schedule requests yet.'
              : 'There are no pending requests assigned to you for review.'
          }
          icon={<GitPullRequest className="w-12 h-12 text-gray-300" />}
          actionLabel={activeTab === 'my' ? 'Submit First Request' : undefined}
          onAction={activeTab === 'my' ? () => setIsCreateOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {activeTab === 'approvals' && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              <button
                className="flex items-center gap-2 hover:text-gray-700 dark:hover:text-gray-200"
                onClick={handleToggleSelectAll}
              >
                {selectedIds.length === filteredList.length ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
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
                className={`p-5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-sm'
                    : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/60 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {activeTab === 'approvals' && (
                      <button
                        className="mt-1 flex-shrink-0 text-indigo-600 focus:outline-none"
                        onClick={() => handleToggleSelect(req.id)}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    )}

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getTypeBadge(req.requestType || req.category)}
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">
                          {req.title}
                        </h3>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line mt-1">
                        {req.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2">
                        {req.requesterName && (
                          <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                            <User className="w-3.5 h-3.5 text-indigo-500" />
                            Requester: {req.requesterName} {req.requesterRole ? `(${req.requesterRole})` : ''}
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5 text-purple-500" />
                          Target Manager: <strong>{req.targetManagerName || req.managerName || 'Class Teacher / Admin'}</strong>
                        </span>

                        {(req.startDate || req.endDate) && (
                          <span className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                            <Calendar className="w-3.5 h-3.5" />
                            {req.startDate} {req.endDate && req.endDate !== req.startDate ? `➔ ${req.endDate}` : ''}
                          </span>
                        )}

                        <span className="text-gray-400">
                          Submitted: {new Date(req.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {req.managerRemarks && (
                        <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">Manager Remarks: </span>
                          <span className="text-gray-600 dark:text-gray-400 italic">"{req.managerRemarks}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 flex-shrink-0">
                    <div>{getStatusBadge(req.status)}</div>

                    {activeTab === 'approvals' && req.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="primary"
                          className="text-xs py-1 h-8 bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            setReviewRequest(req);
                            setReviewAction('approved');
                            setReviewRemarks('');
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs py-1 h-8 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            setReviewRequest(req);
                            setReviewAction('rejected');
                            setReviewRemarks('');
                          }}
                        >
                          Reject
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
        title="Submit New Official Request"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Request Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'leave', label: 'Leave / Absence' },
                { id: 'break', label: 'Break' },
                { id: 'schedule', label: 'Schedule Swap' },
                { id: 'resource', label: 'Resource Request' },
                { id: 'general', label: 'General Inquiry' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                    requestType === cat.id
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setRequestType(cat.id as any)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Title / Subject
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Sick Leave Application / Projector Request"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {(requestType === 'leave' || requestType === 'schedule') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Detailed Description & Justification
            </label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
              placeholder="Provide context for your manager (e.g. medical reason, substitute teacher details, or requested equipment)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span>
              This request is automatically routed to your assigned Class Teacher or Department Manager.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={creating}>
              Submit Request
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
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Requester:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {reviewRequest.requesterName} {reviewRequest.requesterRole ? `(${reviewRequest.requesterRole})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dates:</span>
                <span className="font-semibold text-indigo-600">
                  {reviewRequest.startDate} {reviewRequest.endDate ? `➔ ${reviewRequest.endDate}` : ''}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Description:</span>
                <p className="text-gray-800 dark:text-gray-200 italic">{reviewRequest.description}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                Administrative Decision Remarks
              </label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional explanation, instructions, or substitute details..."
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
              <Button variant="secondary" type="button" onClick={() => setReviewRequest(null)}>
                Cancel
              </Button>
              <Button
                variant={reviewAction === 'approved' ? 'primary' : 'secondary'}
                className={reviewAction === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'border-red-300 text-red-700'}
                type="submit"
                loading={reviewing}
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

