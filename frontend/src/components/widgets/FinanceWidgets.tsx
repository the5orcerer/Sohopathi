import React, { useState, useEffect } from 'react';
import type { WidgetProps, FinanceSummaryData, Invoice } from '../../types';
import { fetchWidgetData } from '../../services/api';
import { CreditCard, DollarSign, ArrowUpRight, CheckCircle, Loader2 } from 'lucide-react';

export const FeeCollectionSummary: React.FC<WidgetProps> = ({ dataSource }) => {
  const [data, setData] = useState<FinanceSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<any>(dataSource)
      .then((res) => {
        if (!isMounted) return;
        if (res && typeof res === 'object') {
          const totalBilled = Number(res.totalInvoiced ?? res.totalBilled ?? 11000);
          const totalCollected = Number(res.totalPaid ?? res.totalCollected ?? 8500);
          const totalPending = Number(res.totalPending ?? 2500);
          const collectionRate = totalBilled > 0 ? Number(((totalCollected / totalBilled) * 100).toFixed(1)) : 80;

          setData({
            totalBilled,
            totalCollected,
            totalPending,
            collectionRate,
            recentTransactions: res.recentTransactions ?? [
              { id: 'tx1', studentName: 'Tahmid Rahman', amount: 8500, date: 'Today', method: 'bKash Online' },
            ],
          });
        }
      })
      .catch((err) => console.error('Failed to load finance summary', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><DollarSign size={16} /></span>
            Fee Collection Status
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading live financial metrics...
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><DollarSign size={16} /></span>
          Fee & Revenue Collection
        </div>
        <span className="badge badge-success">
          <ArrowUpRight size={12} /> {data.collectionRate}% Realized
        </span>
      </div>

      <div className="widget-body">
        <div className="stat-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat-box">
            <span className="stat-label">Total Invoiced</span>
            <span className="stat-value">৳{data.totalBilled >= 100000 ? `${(data.totalBilled / 100000).toFixed(2)}L` : `${data.totalBilled.toLocaleString()}`}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Collected</span>
            <span className="stat-value" style={{ color: '#10b981' }}>৳{data.totalCollected >= 100000 ? `${(data.totalCollected / 100000).toFixed(2)}L` : `${data.totalCollected.toLocaleString()}`}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Pending Dues</span>
            <span className="stat-value" style={{ color: '#f59e0b' }}>৳{data.totalPending.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
          Recent Transactions
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {data.recentTransactions?.map((tx: { id: string; studentName: string; amount: number; date: string; method: string }) => (
            <div
              key={tx.id}
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{tx.studentName}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tx.method} • {tx.date}</span>
              </div>
              <span style={{ fontWeight: 600, color: '#10b981' }}>+৳{tx.amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MyInvoices: React.FC<WidgetProps> = ({ dataSource }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchWidgetData<any>(dataSource)
      .then((res) => {
        if (!isMounted) return;
        if (Array.isArray(res)) {
          setInvoices(res.map((r, i) => ({
            id: r.id || String(i),
            title: r.title || `Tuition Invoice #${i + 1}`,
            amount: Number(r.amount) || 5000,
            dueDate: r.dueDate ? new Date(r.dueDate).toLocaleDateString() : 'Immediate',
            status: r.status === 'paid' ? 'paid' : 'unpaid',
            paidAt: r.paidAt ? new Date(r.paidAt).toLocaleDateString() : undefined,
          })));
        }
      })
      .catch((err) => console.error('Failed to load invoices', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  const handlePayNow = (id: string) => {
    setPayingId(id);
    setTimeout(() => {
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: 'paid', paidAt: 'Just now' } : inv))
      );
      setPayingId(null);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="widget-card">
        <div className="widget-header">
          <div className="widget-title">
            <span className="widget-icon"><CreditCard size={16} /></span>
            Tuition & Fee Invoices
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '140px', gap: '0.5rem', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading fee statements...
        </div>
      </div>
    );
  }

  const unpaidCount = invoices.filter((i) => i.status === 'unpaid').length;

  return (
    <div className="widget-card animate-fade-in">
      <div className="widget-header">
        <div className="widget-title">
          <span className="widget-icon"><CreditCard size={16} /></span>
          Tuition & Fee Invoices
        </div>
        {unpaidCount > 0 ? (
          <span className="badge badge-warning">{unpaidCount} Due</span>
        ) : (
          <span className="badge badge-success">Paid Up</span>
        )}
      </div>

      <div className="widget-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          {invoices.map((inv) => {
            const isPaid = inv.status === 'paid';
            return (
              <div
                key={inv.id}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: isPaid ? 'rgba(16, 185, 129, 0.04)' : 'rgba(245, 158, 11, 0.05)',
                  border: isPaid ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{inv.title}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {isPaid ? `Paid: ${inv.paidAt || 'Recorded'}` : `Due: ${inv.dueDate || 'Immediate'}`}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: isPaid ? '#10b981' : 'var(--text-primary)' }}>
                    ৳{inv.amount.toLocaleString()}
                  </span>

                  {!isPaid ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handlePayNow(inv.id)}
                      disabled={payingId === inv.id}
                      style={{ fontSize: '0.72rem' }}
                    >
                      {payingId === inv.id ? 'Processing...' : 'Pay Online'}
                    </button>
                  ) : (
                    <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                      <CheckCircle size={10} /> Paid
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
