import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchAdmissions,
  fetchAdmissionStats,
  createAdmission,
  updateAdmission,
  admitStudent,
  deleteAdmission,
  fetchClasses,
  fetchSections,
  exportToCsv,
} from '../services/api';
import type {
  AdmissionApplicationItem,
  AdmissionStatsData,
  ClassItem,
  SectionItem,
} from '../types';
import {
  UserPlus,
  Plus,
  Search,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Edit2,
  Copy,
  Check,
  Sparkles,
  DollarSign,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { Button, Badge, Modal, SearchBar, EmptyState, Pagination } from '../components/common';
import { useSession } from '../context/SessionContext';

export const AdmissionsPage: React.FC = () => {
  const [applications, setApplications] = useState<AdmissionApplicationItem[]>([]);
  const [stats, setStats] = useState<AdmissionStatsData | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setPage(1);
  }, [selectedStatus, selectedClassId, searchTerm]);

  const paginatedApplications = useMemo(() => {
    const start = (page - 1) * pageSize;
    return applications.slice(start, start + pageSize);
  }, [applications, page, pageSize]);

  // Create Application Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addClassId, setAddClassId] = useState('');
  const [addDob, setAddDob] = useState('2011-01-01');
  const [addGender, setAddGender] = useState('Male');
  const [addGuardianName, setAddGuardianName] = useState('');
  const [addGuardianPhone, setAddGuardianPhone] = useState('');
  const [addGuardianEmail, setAddGuardianEmail] = useState('');
  const [addGuardianRelation, setAddGuardianRelation] = useState('Parent');
  const [addPreviousSchool, setAddPreviousSchool] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addFee, setAddFee] = useState('500');
  const [addFeeStatus, setAddFeeStatus] = useState<'paid' | 'unpaid' | 'waived' | 'pending'>('paid');
  const [addNotes, setAddNotes] = useState('');
  const [savingApp, setSavingApp] = useState(false);

  // Review / Edit Modal
  const [reviewApp, setReviewApp] = useState<AdmissionApplicationItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'submitted' | 'under_review' | 'shortlisted' | 'admitted' | 'rejected'>('submitted');
  const [reviewFeeStatus, setReviewFeeStatus] = useState<'paid' | 'unpaid' | 'waived' | 'pending'>('unpaid');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewClassId, setReviewClassId] = useState('');
  const [updatingApp, setUpdatingApp] = useState(false);

  // Admit & Enroll Modal
  const [admitTargetApp, setAdmitTargetApp] = useState<AdmissionApplicationItem | null>(null);
  const [admitSectionId, setAdmitSectionId] = useState('');
  const [admitRollNo, setAdmitRollNo] = useState('');
  const [admitAdmNo, setAdmitAdmNo] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Admitted Success Modal
  const [admittedResult, setAdmittedResult] = useState<{
    studentName: string;
    username: string;
    defaultPassword: string;
    admissionNo: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete Modal
  const [deleteTargetApp, setDeleteTargetApp] = useState<AdmissionApplicationItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { hasPermission } = useSession();
  const canWrite = hasPermission('admissions.write');
  const canApprove = hasPermission('admissions.approve');

  const resetCreateForm = () => {
    setAddName('');
    setAddGuardianName('');
    setAddGuardianPhone('');
    setAddGuardianEmail('');
    setAddGuardianRelation('Parent');
    setAddPreviousSchool('');
    setAddAddress('');
    setAddNotes('');
    setAddFee('500');
    setAddFeeStatus('paid');
    setAddGender('Male');
    setAddDob('2011-01-01');
    setAddClassId('');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [appsRes, statsRes, classesRes] = await Promise.all([
        fetchAdmissions({
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          classId: selectedClassId || undefined,
          search: searchTerm || undefined,
        }),
        fetchAdmissionStats(),
        fetchClasses(),
      ]);
      setApplications(appsRes.applications || []);
      setStats(statsRes);
      setClasses(classesRes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load admissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedClassId]);

  useEffect(() => {
    if (admitTargetApp?.classId) {
      fetchSections(admitTargetApp.classId)
        .then((secs) => {
          setSections(secs || []);
          if (secs && secs.length > 0) setAdmitSectionId(secs[0].id);
        })
        .catch(() => setSections([]));
    }
  }, [admitTargetApp]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addGuardianName.trim() || !addGuardianPhone.trim()) {
      setError('Please provide applicant name, guardian name, and guardian phone');
      return;
    }

    try {
      setSavingApp(true);
      setError(null);
      await createAdmission({
        studentName: addName.trim(),
        applicantName: addName.trim(),
        classId: addClassId || undefined,
        dateOfBirth: addDob || undefined,
        gender: addGender,
        guardianName: addGuardianName.trim(),
        guardianPhone: addGuardianPhone.trim(),
        guardianEmail: addGuardianEmail.trim() || undefined,
        guardianRelation: addGuardianRelation,
        previousSchool: addPreviousSchool.trim() || undefined,
        address: addAddress.trim() || undefined,
        applicationFee: Number(addFee) || 0,
        feeStatus: addFeeStatus,
        notes: addNotes.trim() || undefined,
      });

      setShowAddModal(false);
      resetCreateForm();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create admission application');
    } finally {
      setSavingApp(false);
    }
  };

  const handleOpenReview = (app: AdmissionApplicationItem) => {
    setReviewApp(app);
    setReviewStatus(app.status);
    setReviewFeeStatus((app.feeStatus as 'paid' | 'unpaid' | 'waived' | 'pending') || 'unpaid');
    setReviewNotes(app.notes || '');
    setReviewClassId(app.classId || '');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewApp) return;

    try {
      setUpdatingApp(true);
      setError(null);
      await updateAdmission(reviewApp.id, {
        status: reviewStatus,
        feeStatus: reviewFeeStatus,
        notes: reviewNotes,
        classId: reviewClassId || undefined,
      });

      setReviewApp(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update application review');
    } finally {
      setUpdatingApp(false);
    }
  };

  const handleOpenAdmit = (app: AdmissionApplicationItem) => {
    setAdmitTargetApp(app);
    setAdmitRollNo('');
    setAdmitAdmNo('');
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitTargetApp || !admitSectionId) {
      setError('Please select a section for enrollment');
      return;
    }

    try {
      setEnrolling(true);
      setError(null);
      const res = await admitStudent(admitTargetApp.id, {
        classId: admitTargetApp.classId || '',
        sectionId: admitSectionId,
        rollNo: admitRollNo.trim() || undefined,
        admissionNo: admitAdmNo.trim() || undefined,
        generateCredentials: true,
      });

      setAdmitTargetApp(null);
      setAdmittedResult({
        studentName: res.student.name,
        username: res.username,
        defaultPassword: res.defaultPassword || 'changeme',
        admissionNo: res.student.admissionNo,
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to admit & enroll student');
    } finally {
      setEnrolling(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteTargetApp) return;
    try {
      setDeleting(true);
      setError(null);
      await deleteAdmission(deleteTargetApp.id);
      setDeleteTargetApp(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete application');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!admittedResult) return;
    const text = `Student Account Created:\nUsername: ${admittedResult.username}\nDefault Password: ${admittedResult.defaultPassword}\nAdmission No: ${admittedResult.admissionNo}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportCsv = () => {
    const exportRows = applications.map((a) => ({
      'Application No': a.applicationNo,
      'Applicant Name': a.applicantName || a.studentName || '',
      'Grade/Class': a.className || 'Unassigned',
      'Gender': a.gender || '',
      'Guardian Name': a.guardianName,
      'Guardian Phone': a.guardianPhone,
      'Guardian Email': a.guardianEmail || '',
      'Status': a.status,
      'Application Fee': a.applicationFee,
      'Fee Status': a.feeStatus,
      'Applied Date': a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '',
    }));
    exportToCsv('admissions-register.csv', exportRows);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'admitted':
        return <Badge tone="success">Admitted</Badge>;
      case 'shortlisted':
        return <Badge tone="primary">Shortlisted</Badge>;
      case 'under_review':
        return <Badge tone="warning">Under Review</Badge>;
      case 'rejected':
        return <Badge tone="danger">Rejected</Badge>;
      default:
        return <Badge tone="neutral">Submitted</Badge>;
    }
  };

  const getFeeStatusBadge = (status?: string) => {
    if (!status) return <Badge tone="neutral">N/A</Badge>;
    const configs: Record<string, { tone: string; label: string }> = {
      paid: { tone: 'success', label: 'Paid' },
      unpaid: { tone: 'danger', label: 'Unpaid' },
      waived: { tone: 'neutral', label: 'Waived' },
      pending: { tone: 'warning', label: 'Pending' },
    };
    const config = configs[status] || configs.pending;
    return <Badge tone={config.tone as any}>{config.label}</Badge>;
  };

  const summary = stats?.summary || {
    total: 0,
    submitted: 0,
    under_review: 0,
    shortlisted: 0,
    admitted: 0,
    rejected: 0,
    total_fees_collected: 0,
  };

  if (loading && applications.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        <span style={{ marginLeft: '1rem', color: 'var(--text-muted)' }}>Loading admissions...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <UserPlus size={24} style={{ color: 'var(--brand-primary)' }} />
            Admissions & Student Intake
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '0.2rem' }}>
            Track prospective applicants, manage admissions workflow, and automatically enroll students with institutional records.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleExportCsv} disabled={applications.length === 0}>
            <Download size={15} /> Export CSV
          </Button>

          {canWrite && (
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus size={15} /> New Application
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Funnel Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--brand-primary)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Total Inquiries</span>
            <UserPlus size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{summary.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Registered prospective applications</div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--brand-accent)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>In Review / Shortlist</span>
            <Clock size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{summary.under_review + summary.shortlisted}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{summary.under_review} review, {summary.shortlisted} shortlisted</div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#10b981' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Admitted & Enrolled</span>
            <CheckCircle size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{summary.admitted}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Converted into active student body</div>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--brand-primary)' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Application Fees</span>
            <DollarSign size={18} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>৳{summary.total_fees_collected.toLocaleString()}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Collected admission processing fees</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            {(['all', 'submitted', 'under_review', 'shortlisted', 'admitted', 'rejected'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: selectedStatus === st ? 600 : 400,
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  background: selectedStatus === st ? 'var(--brand-primary)' : 'transparent',
                  color: selectedStatus === st ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
            }}
          >
            <option value="">All Applied Grades</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadData();
          }}
          style={{ display: 'flex', gap: '0.4rem' }}
        >
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search applicants, phone, app no..."
          />
          <Button variant="secondary" size="sm" type="submit">
            <Search size={14} />
          </Button>
        </form>
      </div>

      {/* Applications Register Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            Loading admission applications...
          </div>
        ) : applications.length === 0 ? (
          <EmptyState
            title="No admission applications found"
            description="There are currently no prospective student applications matching the selected criteria."
            actionLabel={canWrite ? 'Submit New Application' : undefined}
            onAction={canWrite ? () => setShowAddModal(true) : undefined}
          />
        ) : (
          <div className="table-responsive" style={{ width: '100%', overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}>App #</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}>Applicant Name</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}>Grade Applied</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}>Guardian Info</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}>Fee Status</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedApplications.map((app) => (
                  <tr
                    key={app.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--brand-primary)' }}>
                      {app.applicationNo}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{app.applicantName || app.studentName}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        {app.gender || 'Unknown'} &bull; DOB: {app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.84rem' }}>
                      <Badge tone="neutral">{app.className || 'General'}</Badge>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                      <div style={{ fontWeight: 500 }}>{app.guardianName} ({app.guardianRelation || 'Parent'})</div>
                      <div style={{ color: 'var(--text-muted)' }}>{app.guardianPhone}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontSize: '0.82rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 600 }}>৳{app.applicationFee}</span>
                        {getFeeStatusBadge(app.feeStatus)}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      {getStatusBadge(app.status)}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                        {canWrite && (
                          <Button variant="ghost" size="sm" onClick={() => handleOpenReview(app)} title="Review Application">
                            <Edit2 size={14} />
                          </Button>
                        )}

                        {canApprove && app.status !== 'admitted' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenAdmit(app)}
                            title="Admit & Enroll Student"
                            style={{ background: '#10b981', borderColor: '#10b981' }}
                          >
                            <Sparkles size={14} /> Admit & Enroll
                          </Button>
                        )}

                        {canWrite && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTargetApp(app)} title="Delete Application">
                            <Trash2 size={14} style={{ color: '#ef4444' }} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ padding: '1rem 0.5rem 0.5rem' }}>
              <Pagination
                currentPage={page}
                totalItems={applications.length}
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

      {/* 1. New Application Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); resetCreateForm(); }} title="New Admission Application">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Applicant Full Name *
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Zubair Al Mahfuz"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Class / Grade Applied *
              </label>
              <select className="input" value={addClassId} onChange={(e) => setAddClassId(e.target.value)} required>
                <option value="">Select Grade</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Date of Birth
              </label>
              <input type="date" className="input" value={addDob} onChange={(e) => setAddDob(e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Gender
              </label>
              <select className="input" value={addGender} onChange={(e) => setAddGender(e.target.value)}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--brand-primary)' }}>
              Guardian & Contact Details
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Guardian Name *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Mahfuzur Rahman"
                  value={addGuardianName}
                  onChange={(e) => setAddGuardianName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Guardian Phone *
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="+880 1800-000000"
                  value={addGuardianPhone}
                  onChange={(e) => setAddGuardianPhone(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Guardian Email
                </label>
                <input
                  type="email"
                  className="input"
                  placeholder="guardian@gmail.com"
                  value={addGuardianEmail}
                  onChange={(e) => setAddGuardianEmail(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Relation
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Parent / Guardian"
                  value={addGuardianRelation}
                  onChange={(e) => setAddGuardianRelation(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Previous School
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Dhanmondi Govt Boys High School"
                value={addPreviousSchool}
                onChange={(e) => setAddPreviousSchool(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Residential Address
              </label>
              <input
                type="text"
                className="input"
                placeholder="Road 27, Dhanmondi, Dhaka"
                value={addAddress}
                onChange={(e) => setAddAddress(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Application Fee (BDT)
              </label>
              <input
                type="number"
                className="input"
                value={addFee}
                onChange={(e) => setAddFee(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Fee Payment Status
              </label>
              <select className="input" value={addFeeStatus} onChange={(e) => setAddFeeStatus(e.target.value as any)}>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="waived">Waived</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
              Notes / Special Instructions
            </label>
            <textarea
              className="input"
              rows={2}
              placeholder="Candidate academic achievements, interview remarks..."
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Button variant="ghost" onClick={() => { setShowAddModal(false); resetCreateForm(); }}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={savingApp}>
              {savingApp ? 'Submitting...' : 'Create Application'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 2. Review / Status Update Modal */}
      <Modal isOpen={!!reviewApp} onClose={() => setReviewApp(null)} title={`Review Application: ${reviewApp?.applicationNo}`}>
        {reviewApp && (
          <form onSubmit={handleReviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.96rem' }}>{reviewApp.applicantName || reviewApp.studentName}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Applied Grade: {reviewApp.className || 'General'} &bull; Guardian: {reviewApp.guardianName} ({reviewApp.guardianPhone})
              </div>
              {reviewApp.previousSchool && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Previous School: {reviewApp.previousSchool}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Application Review Status
                </label>
                <select
                  className="input"
                  value={reviewStatus}
                  onChange={(e: any) => setReviewStatus(e.target.value)}
                >
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="shortlisted">Shortlisted</option>
                  <option value="admitted">Admitted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Fee Status
                </label>
                <select
                  className="input"
                  value={reviewFeeStatus}
                  onChange={(e: any) => setReviewFeeStatus(e.target.value)}
                >
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="waived">Waived</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Assigned Grade / Class
              </label>
              <select className="input" value={reviewClassId} onChange={(e) => setReviewClassId(e.target.value)}>
                <option value="">Select Grade</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Review Notes / Interview Remarks
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Enter evaluation notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setReviewApp(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={updatingApp}>
                {updatingApp ? 'Saving...' : 'Save Review'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 3. Admit & Enroll Modal */}
      <Modal
        isOpen={!!admitTargetApp}
        onClose={() => setAdmitTargetApp(null)}
        title={`Admit & Auto-Enroll: ${admitTargetApp?.applicantName || admitTargetApp?.studentName}`}
      >
        {admitTargetApp && (
          <form onSubmit={handleAdmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.85rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>
                <Sparkles size={16} /> Automated Student Account Creation
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0', lineHeight: 1.4 }}>
                Admitting this student will automatically create their Student profile, generate a unique student login username based on their name, and set the default password to <strong style={{ color: 'var(--brand-accent)' }}>changeme</strong>.
              </p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Assign Section Division *
              </label>
              <select
                className="input"
                value={admitSectionId}
                onChange={(e) => setAdmitSectionId(e.target.value)}
                required
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (Capacity: {s.capacity || 'N/A'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Roll Number
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 05"
                  value={admitRollNo}
                  onChange={(e) => setAdmitRollNo(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Custom Admission No (Optional)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. ADM-2026-042"
                  value={admitAdmNo}
                  onChange={(e) => setAdmitAdmNo(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button variant="ghost" onClick={() => setAdmitTargetApp(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={enrolling} style={{ background: '#10b981', borderColor: '#10b981' }}>
                {enrolling ? 'Enrolling & Provisioning...' : 'Confirm Admission'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 4. Admitted Credentials Success Modal */}
      <Modal
        isOpen={!!admittedResult}
        onClose={() => setAdmittedResult(null)}
        title="Student Successfully Admitted & Account Provisioned!"
      >
        {admittedResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <GraduationCap size={28} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                {admittedResult.studentName} is Enrolled!
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginTop: '0.25rem' }}>
                Admission No: <strong>{admittedResult.admissionNo}</strong>
              </p>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-accent)', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Student Login Credentials
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Generated Username:</span>
                <strong style={{ fontFamily: 'monospace', color: 'var(--brand-primary)', fontSize: '0.95rem' }}>
                  {admittedResult.username}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Default Initial Password:</span>
                <strong style={{ fontFamily: 'monospace', color: 'var(--brand-accent)', fontSize: '0.95rem' }}>
                  {admittedResult.defaultPassword}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={handleCopyCredentials}>
                {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copied ? 'Copied Credentials!' : 'Copy Credentials'}
              </Button>
              <Button variant="primary" onClick={() => setAdmittedResult(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 5. Delete Application Modal */}
      <Modal isOpen={!!deleteTargetApp} onClose={() => setDeleteTargetApp(null)} title="Delete Admission Application">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            Are you sure you want to permanently delete application <strong>{deleteTargetApp?.applicationNo}</strong> for applicant <strong>{deleteTargetApp?.applicantName || deleteTargetApp?.studentName}</strong>?
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="ghost" onClick={() => setDeleteTargetApp(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteSubmit} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Application'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdmissionsPage;