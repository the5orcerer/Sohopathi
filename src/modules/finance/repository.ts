import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { attendanceRepository } from '../attendance/repository';

export interface FeeInvoice {
  id: string;
  institutionId: string;
  studentId: string;
  title: string;
  amount: number;
  dueDate: string | null;
  status: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  institutionId: string;
  feeInvoiceId: string;
  amount: number;
  paymentMethod: string | null;
  transactionRef: string | null;
  paidAt: string;
}

export interface FinanceSummary {
  totalInvoiced: number;
  totalPaid: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  partialCount: number;
}

export const financeRepository = {
  async createInvoice(
    client: PoolClient,
    institutionId: string,
    data: { studentId: string; title: string; amount: number; dueDate?: string },
    actorMembershipId?: string
  ): Promise<FeeInvoice> {
    const { rows } = await client.query(
      `insert into fee_invoice (institution_id, student_id, title, amount, due_date, status)
       values ($1, $2, $3, $4, $5, 'pending')
       returning id, institution_id as "institutionId", student_id as "studentId", title, amount::float as amount, due_date as "dueDate", status, created_at as "createdAt"`,
      [institutionId, data.studentId, data.title, data.amount, data.dueDate ?? null]
    );
    const invoice = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create',
      entityType: 'fee_invoice',
      entityId: invoice.id,
      after: invoice,
    });
    return invoice;
  },

  async listInvoices(
    client: PoolClient,
    institutionId: string,
    filters: { studentId?: string; status?: string }
  ): Promise<FeeInvoice[]> {
    let invoiceQuery = `select id, institution_id as "institutionId", student_id as "studentId", coalesce(title, 'Tuition Fee') as title, amount::float as amount, due_date as "dueDate", status, coalesce(created_at, now()) as "createdAt" from fee_invoice where 1=1`;
    const params: any[] = [];

    if (filters.studentId) {
      params.push(filters.studentId);
      invoiceQuery += ` and student_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      invoiceQuery += ` and status = $${params.length}`;
    }

    invoiceQuery += ` order by created_at desc`;
    const { rows } = await client.query(invoiceQuery, params);
    return rows;
  },

  async recordPayment(
    client: PoolClient,
    institutionId: string,
    feeInvoiceId: string,
    data: { amount: number; paymentMethod?: string; transactionRef?: string },
    actorMembershipId?: string
  ): Promise<Payment> {
    const { rows: payRows } = await client.query(
      `insert into payment (institution_id, invoice_id, amount, method, status)
       values ($1, $2, $3, $4, 'completed')
       returning id, institution_id as "institutionId", invoice_id as "feeInvoiceId", amount::float as amount, method as "paymentMethod", payment_date as "paidAt"`,
      [institutionId, feeInvoiceId, data.amount, data.paymentMethod ?? 'Cash']
    );
    const payment = payRows[0];

    // Check sum of payments for this invoice and update invoice status
    const { rows: invRows } = await client.query(`select amount from fee_invoice where id = $1`, [feeInvoiceId]);
    if (invRows.length > 0) {
      const invoiceAmount = Number(invRows[0].amount);
      const { rows: sumRows } = await client.query(
        `select coalesce(sum(amount), 0)::float as total_paid from payment where invoice_id = $1`,
        [feeInvoiceId]
      );
      const totalPaid = Number(sumRows[0].total_paid);

      let newStatus = 'pending';
      if (totalPaid >= invoiceAmount) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'partial';
      }

      await client.query(`update fee_invoice set status = $1 where id = $2`, [newStatus, feeInvoiceId]);
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'record_payment',
      entityType: 'payment',
      entityId: payment.id,
      after: payment,
    });

    return payment;
  },

  async getSummary(client: PoolClient, institutionId: string, studentId?: string): Promise<FinanceSummary> {
    let invQuery = `select amount::float as amount, status from fee_invoice where 1=1`;
    let payQuery = `select amount::float as amount from payment where 1=1`;
    const invParams: any[] = [];
    const payParams: any[] = [];

    if (studentId) {
      invParams.push(studentId);
      invQuery += ` and student_id = $${invParams.length}`;

      payParams.push(studentId);
      payQuery += ` and invoice_id in (select id from fee_invoice where student_id = $${payParams.length})`;
    }

    const { rows: invoices } = await client.query(invQuery, invParams);
    const { rows: payments } = await client.query(payQuery, payParams);

    const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPending = Math.max(0, totalInvoiced - totalPaid);

    const paidCount = invoices.filter((i) => i.status === 'paid').length;
    const pendingCount = invoices.filter((i) => i.status === 'pending').length;
    const partialCount = invoices.filter((i) => i.status === 'partial').length;

    return {
      totalInvoiced,
      totalPaid,
      totalPending,
      paidCount,
      pendingCount,
      partialCount,
    };
  },
};
