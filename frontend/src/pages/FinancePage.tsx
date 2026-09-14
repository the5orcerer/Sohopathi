import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { useSession } from '../context/SessionContext';
import { fetchWidgetData } from '../services/api';
import type { FinanceSummaryData, Invoice } from '../types';
import { SearchBar, StatCard, DataTable, Badge, Button, Modal } from '../components/common';
import { Plus, FileSpreadsheet, DollarSign, ArrowUpRight, Clock } from 'lucide-react';

export const FinancePage: React.FC<{ onNavigateHome: () => void }> = ({ onNavigateHome }) => {
  const { hasPermission } = useSession();
  const [summary, setSummary] = useState<FinanceSummaryData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);

  const canWriteFinance = hasPermission('finance.write');
  const canViewReports = hasPermission('finance.reports');

  useEffect(() => {
    fetchWidgetData<FinanceSummaryData>('/api/finance/summary')
      .then(setSummary)
      .catch(console.error);

    fetchWidgetData<Invoice[]>('/api/finance/invoices')
      .then((res) => {
        if (Array.isArray(res)) setInvoices(res);
      })
      .catch(console.error);
  }, []);

  const filteredInvoices = invoices.filter((inv) =>
    inv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute requiredPermission="finance.read" onNavigateHome={onNavigateHome}>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Finance & Tuition Billing</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Institutional fee structures, student invoices, receipts, and ledger reconciliation.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canWriteFinance && (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowGenerateModal(true)}>
                Generate Invoice
              </Button>
            )}
            {canViewReports && (
              <Button variant="secondary" icon={<FileSpreadsheet size={15} />}>
                Export Ledger
              </Button>
            )}
          </div>
        </div>

        {summary && (
          <div className="stat-grid">
            <StatCard
              label="Total Invoiced"
              value={`৳${(summary.totalBilled / 100000).toFixed(2)} Lakh`}
              sublabel="Current term billing"
              icon={<DollarSign size={18} />}
            />
            <StatCard
              label="Collected Revenue"
              value={`৳${(summary.totalCollected / 100000).toFixed(2)} Lakh`}
              sublabel="Reconciled deposits"
              accentColor="var(--status-success)"
              icon={<ArrowUpRight size={18} />}
            />
            <StatCard
              label="Pending Outstanding"
              value={`৳${(summary.totalPending / 1000).toFixed(0)}k`}
              sublabel="Due this month"
              accentColor="var(--status-warning)"
              icon={<Clock size={18} />}
            />
            <StatCard
              label="Collection Rate"
              value={`${summary.collectionRate}%`}
              sublabel="Target: 95%"
              accentColor="var(--primary-light)"
            />
          </div>
        )}

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Invoices & Student Statements</h3>
            <SearchBar
              placeholder="Search invoices by title..."
              value={searchQuery}
              onChange={setSearchQuery}
              style={{ maxWidth: '300px' }}
            />
          </div>

          <DataTable
            data={filteredInvoices}
            keyExtractor={(inv) => inv.id}
            emptyMessage="No invoices found"
            columns={[
              {
                key: 'title',
                header: 'Invoice Description',
                render: (inv) => <span style={{ fontWeight: 600 }}>{inv.title}</span>,
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (inv) => <span style={{ fontWeight: 700 }}>৳{(inv.amount ?? inv.totalAmount ?? 0).toLocaleString()}</span>,
              },
              {
                key: 'dueDate',
                header: 'Due Date',
                render: (inv) => <span style={{ color: 'var(--text-muted)' }}>{inv.dueDate || 'Immediate'}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                render: (inv) => (
                  <Badge tone={inv.status === 'paid' ? 'success' : 'warning'}>
                    {inv.status === 'paid' ? 'Paid' : 'Unpaid'}
                  </Badge>
                ),
              },
              {
                key: 'action',
                header: 'Action',
                align: 'right',
                render: () => <Button variant="ghost" size="sm">Receipt</Button>,
              },
            ]}
          />
        </div>

        {/* Modal */}
        <Modal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          title="Generate Fee Invoice"
          subtitle="Issue tuition or transport invoice to cohort"
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setShowGenerateModal(false)}>Issue Invoice</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Invoice Title
              </label>
              <input
                type="text"
                placeholder="e.g. Monthly Tuition Fee"
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </Modal>
      </div>
    </ProtectedRoute>
  );
};
