import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { useSession } from '../context/SessionContext';
import {
  fetchInvoices,
  fetchFinanceSummary,
  createInvoice,
  createBulkInvoices,
  recordInvoicePayment,
  fetchReceiptData,
  fetchClasses,
  fetchStudents,
  fetchMembers,
  exportToCsv,
} from '../services/api';
import type {
  Invoice,
  FinanceSummaryData,
  ReceiptData,
  ClassItem,
  StudentItem,
  Member,
  InvoiceItem,
} from '../types';
import {
  SearchBar,
  StatCard,
  DataTable,
  Badge,
  Button,
  Modal,
} from '../components/common';
import {
  DollarSign,
  ArrowUpRight,
  Clock,
  Plus,
  FileSpreadsheet,
  Receipt,
  CreditCard,
  Printer,
  AlertCircle,
  TrendingDown,
} from 'lucide-react';

const PAYMENT_METHODS = [
  'Cash',
  'bKash',
  'Nagad',
  'Rocket',
  'Bank Transfer',
  'Cheque',
  'Credit/Debit Card',
];

const FEE_CATEGORIES = [
  'Tuition Fee',
  'Examination Fee',
  'Admission / Registration',
  'Transport Bus Fee',
  'Library & Books',
  'Laboratory & Science',
  'Sports & Extra-curricular',
  'Employee Salary / Disbursement',
  'Institutional Utilities & Facility',
  'General Miscellaneous',
];

export const BillingPage: React.FC<{ onNavigateHome?: () => void }> = ({ onNavigateHome }) => {
  const { hasPermission } = useSession();
  const [summary, setSummary] = useState<FinanceSummaryData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [recipientFilter, setRecipientFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Supporting entities
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  // Create Invoice Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createMode, setCreateMode] = useState<'single' | 'bulk'>('single');
  const [recipientType, setRecipientType] = useState<'student' | 'employee' | 'institution'>('student');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [invoiceCategory, setInvoiceCategory] = useState<string>('Tuition Fee');
  const [invoiceTitle, setInvoiceTitle] = useState<string>('');
  const [invoiceDescription, setInvoiceDescription] = useState<string>('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { label: 'Monthly Academic Tuition', amount: 3500 },
  ]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [bulkAmount, setBulkAmount] = useState<number>(3500);
  const [savingInvoice, setSavingInvoice] = useState<boolean>(false);

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('Cash');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payTransactionId, setPayTransactionId] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');
  const [savingPayment, setSavingPayment] = useState<boolean>(false);

  // Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);

  const canWriteFinance = hasPermission('finance.write') || hasPermission('institution.manage');
  const canMakePayment = hasPermission('finance.payment') || canWriteFinance;
  const canViewReports = hasPermission('finance.reports') || hasPermission('finance.read');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [sumRes, invRes] = await Promise.all([
        fetchFinanceSummary().catch(() => null),
        fetchInvoices({
          status: statusFilter,
          recipientType: recipientFilter,
          category: categoryFilter,
          search: searchQuery || undefined,
        }),
      ]);
      setSummary(sumRes);
      setInvoices(invRes.invoices || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load billing records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, recipientFilter, categoryFilter]);

  useEffect(() => {
    fetchClasses().then(setClasses).catch(console.error);
    fetchStudents({ status: 'enrolled' }).then(setStudents).catch(console.error);
    fetchMembers()
      .then((m) => {
        // Exclude students
        const staff = (m || []).filter(
          (u) =>
            !u.roleName?.toLowerCase().includes('student') &&
            !u.roleName?.toLowerCase().includes('guardian')
        );
        setMembers(staff);
      })
      .catch(console.error);
  }, []);

  const totalItemizedAmount = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { label: 'Additional Fee', amount: 500 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, val: any) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceTitle.trim()) return;

    try {
      setSavingInvoice(true);
      if (createMode === 'bulk') {
        if (!selectedClassId) {
          alert('Please select a target academic class');
          return;
        }
        await createBulkInvoices({
          classId: selectedClassId,
          category: invoiceCategory,
          title: invoiceTitle.trim().substring(0, 120),
          amount: Number(bulkAmount),
          dueDate,
          notes: invoiceDescription.trim().substring(0, 2000) || undefined,
        });
      } else {
        await createInvoice({
          recipientType,
          studentId: recipientType === 'student' ? selectedStudentId || undefined : undefined,
          employeeMembershipId: recipientType === 'employee' ? selectedEmployeeId || undefined : undefined,
          category: invoiceCategory,
          title: invoiceTitle.trim().substring(0, 120),
          description: invoiceDescription.trim().substring(0, 2000) || undefined,
          totalAmount: totalItemizedAmount,
          discountAmount: Number(discountAmount) || 0,
          dueDate,
          items,
        });
      }

      setShowCreateModal(false);
      setInvoiceTitle('');
      setInvoiceDescription('');
      setDiscountAmount(0);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to issue invoice');
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleOpenPayment = (inv: Invoice) => {
    setActiveInvoice(inv);
    setPayAmount(inv.dueAmount || inv.totalAmount || inv.amount || 0);
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice) return;
    if (payAmount <= 0) {
      alert('Payment amount must be greater than zero');
      return;
    }

    try {
      setSavingPayment(true);
      const res = await recordInvoicePayment(activeInvoice.id, {
        amount: Number(payAmount),
        paymentDate: payDate,
        method: payMethod,
        transactionId: payTransactionId.trim() || undefined,
        notes: payNotes.trim() || undefined,
      });

      setShowPaymentModal(false);
      loadData();

      // Show receipt immediately
      if (res.payment?.id) {
        handleViewReceipt(res.payment.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleViewReceipt = async (paymentId: string) => {
    try {
      setLoadingReceipt(true);
      setShowReceiptModal(true);
      const data = await fetchReceiptData(paymentId);
      setReceiptData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load official receipt');
      setShowReceiptModal(false);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      `Sohopathi_Billing_Ledger_${new Date().toISOString().split('T')[0]}`,
      invoices.map((inv) => ({
        InvoiceNumber: inv.invoiceNumber || inv.id,
        Recipient: inv.studentName || inv.employeeName || 'Institution Wide',
        Category: inv.category || 'General',
        Title: inv.title,
        TotalAmount: inv.totalAmount ?? inv.amount ?? 0,
        Discount: inv.discountAmount ?? 0,
        PaidAmount: inv.paidAmount ?? 0,
        DueAmount: inv.dueAmount ?? 0,
        DueDate: inv.dueDate || '',
        Status: inv.status,
      }))
    );
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.title.toLowerCase().includes(q) ||
      (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
      (inv.studentName && inv.studentName.toLowerCase().includes(q)) ||
      (inv.studentRollNo && inv.studentRollNo.toLowerCase().includes(q)) ||
      (inv.className && inv.className.toLowerCase().includes(q)) ||
      (inv.employeeName && inv.employeeName.toLowerCase().includes(q))
    );
  });

  return (
    <ProtectedRoute requiredPermission="finance.read" onNavigateHome={onNavigateHome || (() => {})}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '3rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={26} style={{ color: 'var(--primary)' }} />
              Invoicing & Billing Management
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Institutional fee collection, student invoices, payroll disbursements, and payment receipts.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canWriteFinance && (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowCreateModal(true)}>
                Generate Invoice
              </Button>
            )}
            {canViewReports && (
              <Button variant="secondary" icon={<FileSpreadsheet size={15} />} onClick={handleExportCsv}>
                Export Ledger CSV
              </Button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Telemetry Metrics */}
        {summary && (
          <div className="stat-grid">
            <StatCard
              label="Total Invoiced"
              value={`৳${summary.totalBilled.toLocaleString()}`}
              sublabel="Current term billing"
              icon={<DollarSign size={18} />}
            />
            <StatCard
              label="Reconciled Deposits"
              value={`৳${summary.totalCollected.toLocaleString()}`}
              sublabel="Verified payments"
              accentColor="var(--status-success)"
              icon={<ArrowUpRight size={18} />}
            />
            <StatCard
              label="Outstanding Due"
              value={`৳${summary.totalPending.toLocaleString()}`}
              sublabel="Pending collection"
              accentColor="var(--status-warning)"
              icon={<Clock size={18} />}
            />
            <StatCard
              label="Payroll / Disbursements"
              value={`৳${(summary.totalDisbursements || 0).toLocaleString()}`}
              sublabel="Salaries & expenses"
              accentColor="var(--text-secondary)"
              icon={<TrendingDown size={18} />}
            />
            <StatCard
              label="Collection Efficiency"
              value={`${summary.collectionRate}%`}
              sublabel="Net collection rate"
              accentColor="var(--primary-light)"
            />
          </div>
        )}

        {/* Control Bar: Filters & Search */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <SearchBar
              placeholder="Search by invoice #, student name, roll, or class..."
              value={searchQuery}
              onChange={setSearchQuery}
              style={{ maxWidth: '380px' }}
            />

            {/* Recipient Type Segmented Control */}
            <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--surface-sunken)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
              {(['all', 'student', 'employee', 'institution'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRecipientFilter(t)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: recipientFilter === t ? 600 : 400,
                    background: recipientFilter === t ? 'var(--surface)' : 'transparent',
                    color: recipientFilter === t ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'all' ? 'All Recipients' : t === 'student' ? 'Students' : t === 'employee' ? 'Employees' : 'Institution'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                }}
              >
                <option value="all">All Categories</option>
                {FEE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              Showing {filteredInvoices.length} invoices
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <DataTable
            data={filteredInvoices}
            keyExtractor={(inv) => inv.id}
            emptyMessage={loading ? 'Loading financial records...' : 'No invoices matching the selected criteria.'}
            columns={[
              {
                key: 'invoiceNumber',
                header: 'Invoice #',
                render: (inv) => (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {inv.invoiceNumber || `#${inv.id.substring(0, 8)}`}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(inv.createdAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                ),
              },
              {
                key: 'recipient',
                header: 'Recipient & Target',
                render: (inv) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    {inv.recipientType === 'employee' ? (
                      <>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{inv.employeeName || 'Staff Member'}</span>
                        <Badge tone="neutral">{inv.employeeRole || 'Employee'}</Badge>
                      </>
                    ) : inv.recipientType === 'institution' ? (
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Institution Expense / Vendor</span>
                    ) : (
                      <>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{inv.studentName || 'Student'}</span>
                        <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {inv.className && <span>{inv.className}</span>}
                          {inv.sectionName && <span>({inv.sectionName})</span>}
                          {inv.studentRollNo && <span>Roll: {inv.studentRollNo}</span>}
                        </div>
                      </>
                    )}
                  </div>
                ),
              },
              {
                key: 'title',
                header: 'Particulars',
                render: (inv) => (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{inv.title}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{inv.category || 'Tuition'}</span>
                  </div>
                ),
              },
              {
                key: 'amount',
                header: 'Total / Net',
                render: (inv) => {
                  const total = inv.totalAmount ?? inv.amount ?? 0;
                  const discount = inv.discountAmount ?? 0;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>৳{total.toLocaleString()}</span>
                      {discount > 0 && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--status-success)' }}>
                          -৳{discount.toLocaleString()} disc
                        </span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'paidDue',
                header: 'Paid / Due Balance',
                render: (inv) => {
                  const paid = inv.paidAmount ?? 0;
                  const due = inv.dueAmount ?? 0;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--status-success)', fontWeight: 600 }}>
                        Paid: ৳{paid.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: due > 0 ? 'var(--status-warning)' : 'var(--text-muted)', fontWeight: 600 }}>
                        Due: ৳{due.toLocaleString()}
                      </span>
                    </div>
                  );
                },
              },
              {
                key: 'status',
                header: 'Status',
                render: (inv) => {
                  const isPaid = inv.status === 'paid';
                  const isPartiallyPaid = inv.status === 'partially_paid';
                  const isOverdue = inv.status === 'overdue';
                  return (
                    <Badge tone={isPaid ? 'success' : isPartiallyPaid ? 'warning' : isOverdue ? 'danger' : 'neutral'}>
                      {inv.status ? inv.status.replace('_', ' ').toUpperCase() : 'PENDING'}
                    </Badge>
                  );
                },
              },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (inv) => {
                  const due = inv.dueAmount ?? 0;
                  const hasPayments = inv.payments && inv.payments.length > 0;
                  return (
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      {due > 0 && canMakePayment && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenPayment(inv)}
                          icon={<DollarSign size={13} />}
                        >
                          Collect
                        </Button>
                      )}
                      {hasPayments && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewReceipt(inv.payments![0].id)}
                          icon={<Receipt size={13} />}
                        >
                          Receipt
                        </Button>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        </div>

        {/* Modal 1: Generate Invoice Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Generate Fee Invoice or Payroll Disbursement"
          subtitle="Issue tuition statements to individual students, entire cohorts, or staff"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleCreateSubmit} loading={savingInvoice}>
                Issue Invoice Statement
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Mode Switcher */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-sunken)', padding: '0.3rem', borderRadius: 'var(--radius-sm)' }}>
              <button
                type="button"
                onClick={() => setCreateMode('single')}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: createMode === 'single' ? 600 : 400,
                  background: createMode === 'single' ? 'var(--surface)' : 'transparent',
                  color: createMode === 'single' ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Single Recipient
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('bulk')}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: createMode === 'bulk' ? 600 : 400,
                  background: createMode === 'bulk' ? 'var(--surface)' : 'transparent',
                  color: createMode === 'bulk' ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cohort Bulk Generation (Class-Wide)
              </button>
            </div>

            {createMode === 'single' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Recipient Type <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    value={recipientType}
                    onChange={(e) => setRecipientType(e.target.value as any)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                  >
                    <option value="student">Student (Fee Invoice)</option>
                    <option value="employee">Employee / Faculty (Payroll)</option>
                    <option value="institution">Institutional / Vendor Expense</option>
                  </select>
                </div>

                {recipientType === 'student' && (
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                      Select Student <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Choose Student --</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.className || 'Class'} {s.sectionName ? `· ${s.sectionName}` : ''}) - Roll: {s.rollNumber || 'N/A'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {recipientType === 'employee' && (
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                      Select Staff / Teacher <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      required
                      style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Choose Staff Member --</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.roleName} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Target Academic Class <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                >
                  <option value="">-- Choose Class for Bulk Invoicing --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  An individualized statement with its unique invoice number will be generated for every enrolled student in this class.
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Fee Category
                </label>
                <select
                  value={invoiceCategory}
                  onChange={(e) => setInvoiceCategory(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                >
                  {FEE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Due Date <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Title with live counter & 120 character limit */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>
                  Invoice Title / Subject <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <span style={{ fontSize: '0.72rem', color: invoiceTitle.length >= 110 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {invoiceTitle.length}/120
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={120}
                placeholder="e.g. October 2026 Academic Tuition & Lab Charges"
                value={invoiceTitle}
                onChange={(e) => setInvoiceTitle(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
              />
            </div>

            {/* Itemized Line Items for Single Mode */}
            {createMode === 'single' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--surface-sunken)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Itemized Particulars</span>
                  <Button variant="ghost" size="sm" onClick={handleAddItem}>+ Add Line Item</Button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Item name (e.g. Tuition)"
                      value={item.label}
                      onChange={(e) => handleItemChange(idx, 'label', e.target.value)}
                      style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => handleItemChange(idx, 'amount', Number(e.target.value))}
                      style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--status-danger)', cursor: 'pointer', fontSize: '0.9rem' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.5rem', fontSize: '0.85rem' }}>
                  <span>Subtotal Amount:</span>
                  <strong>৳{totalItemizedAmount.toLocaleString()}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Discount (Waiver / Scholarship):</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Discount ৳"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', fontSize: '0.9rem', fontWeight: 700 }}>
                  <span>Net Payable Amount:</span>
                  <span style={{ color: 'var(--primary)' }}>৳{Math.max(0, totalItemizedAmount - discountAmount).toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Amount Per Student (৳) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>
            )}

            {/* Description with live counter & 2000 character limit */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>
                  Remarks / Payment Instructions
                </label>
                <span style={{ fontSize: '0.72rem', color: invoiceDescription.length >= 1900 ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {invoiceDescription.length}/2000
                </span>
              </div>
              <textarea
                rows={2}
                maxLength={2000}
                placeholder="Optional notes printed on student statement..."
                value={invoiceDescription}
                onChange={(e) => setInvoiceDescription(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>
          </form>
        </Modal>

        {/* Modal 2: Record Payment Modal */}
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title="Record Fee Payment & Issue Receipt"
          subtitle={activeInvoice ? `Payment against invoice ${activeInvoice.invoiceNumber || activeInvoice.id}` : ''}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handlePaymentSubmit} loading={savingPayment}>
                Record Payment & Generate Official Receipt
              </Button>
            </>
          }
        >
          {activeInvoice && (
            <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Billed</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    ৳{(activeInvoice.totalAmount ?? activeInvoice.amount ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Already Paid</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--status-success)' }}>
                    ৳{(activeInvoice.paidAmount ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Outstanding Due</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--status-warning)' }}>
                    ৳{(activeInvoice.dueAmount ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Payment Amount (৳) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeInvoice.dueAmount || activeInvoice.totalAmount || activeInvoice.amount || undefined}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Payment Method <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Payment Date <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Transaction ID / Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TRX-982341 or Bank Slip #"
                    value={payTransactionId}
                    onChange={(e) => setPayTransactionId(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Cashier / Deposit Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received by Accounts Office counter"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}
                />
              </div>
            </form>
          )}
        </Modal>

        {/* Modal 3: Official Printable Payment Receipt */}
        <Modal
          isOpen={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          title="Official Institutional Payment Receipt"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowReceiptModal(false)}>Close</Button>
              <Button variant="primary" icon={<Printer size={15} />} onClick={() => window.print()}>
                Print Official Receipt
              </Button>
            </>
          }
        >
          {loadingReceipt || !receiptData ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading receipt details...
            </div>
          ) : (
            <div
              id="printable-receipt"
              style={{
                padding: '1.5rem',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              {/* Watermark */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  opacity: 0.04,
                  transform: 'rotate(-25deg)',
                  fontSize: '4.5rem',
                  fontWeight: 900,
                  color: 'var(--primary)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                {receiptData.institution.officialWatermarkText || 'OFFICIAL RECEIPT'}
              </div>

              {/* School Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-subtle)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {receiptData.institution.name}
                  </h2>
                  {receiptData.institution.instituteCode && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginTop: '0.2rem' }}>
                      EIIN: {receiptData.institution.instituteCode}
                    </div>
                  )}
                  {receiptData.institution.address && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {receiptData.institution.address}
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Phone: {receiptData.institution.contactPhone || 'N/A'} · Email: {receiptData.institution.contactEmail || 'N/A'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-block', padding: '0.25rem 0.65rem', background: 'rgba(34, 197, 94, 0.12)', color: 'var(--status-success)', border: '1px solid var(--status-success)', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: '0.82rem' }}>
                    MONEY RECEIPT
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem', marginTop: '0.4rem', color: 'var(--text-primary)' }}>
                    {receiptData.payment.receiptNumber}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Date: {new Date(receiptData.payment.paymentDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Recipient Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Received From:</span>
                  <strong style={{ fontSize: '0.9rem' }}>
                    {receiptData.invoice.studentName || receiptData.invoice.employeeName || 'Institution Entity'}
                  </strong>
                  {receiptData.invoice.className && (
                    <div style={{ color: 'var(--text-secondary)' }}>
                      Class: {receiptData.invoice.className} {receiptData.invoice.sectionName ? `· Section ${receiptData.invoice.sectionName}` : ''}
                    </div>
                  )}
                  {receiptData.invoice.studentRollNo && (
                    <div style={{ color: 'var(--text-secondary)' }}>Roll Number: {receiptData.invoice.studentRollNo}</div>
                  )}
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Invoice Statement:</span>
                  <strong>{receiptData.invoice.title}</strong>
                  <div style={{ color: 'var(--text-secondary)' }}>Category: {receiptData.invoice.category}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    Ref: {receiptData.invoice.invoiceNumber || receiptData.invoice.id}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Payment Method:</span>
                  <strong>{receiptData.payment.method}</strong>
                  {receiptData.payment.transactionId && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--primary)' }}>
                      TrxID: {receiptData.payment.transactionId}
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Collector: {receiptData.payment.recordedByName || 'Cashier Counter'}
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.5rem 0' }}>Particulars / Items</th>
                    <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(receiptData.invoice.items && receiptData.invoice.items.length > 0) ? (
                    receiptData.invoice.items.map((it, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '0.45rem 0' }}>{it.label}</td>
                        <td style={{ padding: '0.45rem 0', textAlign: 'right', fontWeight: 600 }}>
                          ৳{Number(it.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '0.45rem 0' }}>{receiptData.invoice.title}</td>
                      <td style={{ padding: '0.45rem 0', textAlign: 'right', fontWeight: 600 }}>
                        ৳{(receiptData.invoice.totalAmount ?? receiptData.invoice.amount ?? 0).toLocaleString()}
                      </td>
                    </tr>
                  )}
                  {receiptData.invoice.discountAmount && receiptData.invoice.discountAmount > 0 && (
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--status-success)' }}>
                      <td style={{ padding: '0.45rem 0' }}>Scholarship / Waiver Discount</td>
                      <td style={{ padding: '0.45rem 0', textAlign: 'right', fontWeight: 600 }}>
                        -৳{receiptData.invoice.discountAmount.toLocaleString()}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ padding: '0.6rem 0', fontWeight: 700 }}>Total Billed</td>
                    <td style={{ padding: '0.6rem 0', textAlign: 'right', fontWeight: 700 }}>
                      ৳{(receiptData.invoice.totalAmount ?? receiptData.invoice.amount ?? 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr style={{ background: 'rgba(34, 197, 94, 0.08)', fontWeight: 800 }}>
                    <td style={{ padding: '0.6rem 0.5rem', color: 'var(--status-success)' }}>AMOUNT RECEIVED ON THIS RECEIPT</td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', color: 'var(--status-success)' }}>
                      ৳{receiptData.payment.amount.toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.45rem 0', color: 'var(--text-muted)' }}>Remaining Due Balance</td>
                    <td style={{ padding: '0.45rem 0', textAlign: 'right', fontWeight: 600, color: (receiptData.invoice.dueAmount ?? 0) > 0 ? 'var(--status-warning)' : 'var(--text-muted)' }}>
                      ৳{(receiptData.invoice.dueAmount ?? 0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures & Seal Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-subtle)' }}>
                <div style={{ textAlign: 'center', minWidth: '140px' }}>
                  {receiptData.institution.officialSealUrl ? (
                    <img src={receiptData.institution.officialSealUrl} alt="Seal" style={{ height: '48px', objectFit: 'contain', marginBottom: '0.25rem' }} />
                  ) : (
                    <div style={{ height: '35px' }} />
                  )}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Official Stamp / Seal
                  </div>
                </div>

                <div style={{ textAlign: 'center', minWidth: '140px' }}>
                  {receiptData.institution.principalSignatureUrl ? (
                    <img src={receiptData.institution.principalSignatureUrl} alt="Signature" style={{ height: '48px', objectFit: 'contain', marginBottom: '0.25rem' }} />
                  ) : (
                    <div style={{ height: '35px' }} />
                  )}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Authorized Cashier / Controller
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </ProtectedRoute>
  );
};
export default BillingPage;
