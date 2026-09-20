import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { coreRepository } from '../core/repository';
import { dispatchNotificationAndTask } from '../core/notification-task-service';

export interface InvoiceItem {
  label: string;
  amount: number;
  description?: string;
}

export interface PaymentRecord {
  id: string;
  institutionId: string;
  invoiceId: string;
  receiptNumber: string;
  amount: number;
  paymentDate: string;
  method: string;
  transactionId?: string | null;
  notes?: string | null;
  recordedByName?: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  institutionId: string;
  invoiceNumber: string;
  recipientType: 'student' | 'employee' | 'institution';
  studentId?: string | null;
  studentName?: string | null;
  studentRollNo?: string | null;
  className?: string | null;
  sectionName?: string | null;
  employeeMembershipId?: string | null;
  employeeName?: string | null;
  employeeRole?: string | null;
  category: string;
  title: string;
  description?: string | null;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  status: 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  items: InvoiceItem[];
  notes?: string | null;
  createdAt: string;
  payments?: PaymentRecord[];
}

export interface FinanceSummary {
  totalBilled: number;
  totalCollected: number;
  totalPending: number;
  totalDisbursements: number;
  collectionRate: number;
  monthlyCollection: Array<{ month: string; amount: number }>;
}

export interface FeePolicy {
  id: string;
  institutionId: string;
  name: string;
  description?: string | null;
  category: string;
  amount: number;
  billingCycle: 'monthly' | 'term' | 'annual' | 'one_time' | 'per_absence';
  targetAudience: 'all_students' | 'class' | 'section' | 'custom';
  targetClassId?: string | null;
  targetClassName?: string | null;
  targetSectionId?: string | null;
  targetSectionName?: string | null;
  targetStudentIds?: string[];
  isActive: boolean;
  autoApplyOnAbsence: boolean;
  finePerDay?: number;
  dueDaysAfter: number;
  createdByMembershipId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentLedgerItem {
  id: string;
  institutionId: string;
  invoiceId: string;
  invoiceNumber: string;
  receiptNumber: string;
  amount: number;
  paymentDate: string;
  method: string;
  transactionId?: string | null;
  notes?: string | null;
  payerName: string;
  payerType: string;
  className?: string | null;
  studentRollNo?: string | null;
  category: string;
  invoiceTitle: string;
  cashierName?: string | null;
  createdAt: string;
}

export const financeRepository = {
  async listInvoices(
    client: PoolClient,
    institutionId: string,
    options: {
      status?: string;
      recipientType?: string;
      category?: string;
      studentId?: string;
      employeeMembershipId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ invoices: Invoice[]; total: number }> {
    let whereClause = `where fi.institution_id = $1`;
    const params: any[] = [institutionId];

    if (options.status && options.status !== 'all') {
      params.push(options.status);
      whereClause += ` and fi.status = $${params.length}`;
    }

    if (options.recipientType && options.recipientType !== 'all') {
      params.push(options.recipientType);
      whereClause += ` and fi.recipient_type = $${params.length}`;
    }

    if (options.category && options.category !== 'all') {
      params.push(options.category);
      whereClause += ` and fi.category = $${params.length}`;
    }

    if (options.studentId) {
      params.push(options.studentId);
      whereClause += ` and fi.student_id = $${params.length}`;
    }

    if (options.employeeMembershipId) {
      params.push(options.employeeMembershipId);
      whereClause += ` and fi.employee_membership_id = $${params.length}`;
    }

    if (options.search) {
      params.push(`%${options.search.trim().toLowerCase()}%`);
      whereClause += ` and (
        lower(fi.title) like $${params.length} or 
        lower(coalesce(fi.invoice_number, '')) like $${params.length} or 
        lower(coalesce(s.name, '')) like $${params.length} or 
        lower(coalesce(ep.name, '')) like $${params.length}
      )`;
    }

    const countQuery = `
      select count(*)::int as total
      from fee_invoice fi
      left join student s on s.id = fi.student_id
      left join membership em on em.id = fi.employee_membership_id
      left join profile ep on ep.id = em.user_id
      ${whereClause}
    `;
    const { rows: countRows } = await client.query(countQuery, params);
    const total = countRows[0]?.total || 0;

    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    const queryParams = [...params, limit, offset];

    const dataQuery = `
      select 
        fi.id,
        fi.institution_id as "institutionId",
        coalesce(fi.invoice_number, 'INV-' || substring(fi.id::text, 1, 8)) as "invoiceNumber",
        fi.recipient_type as "recipientType",
        fi.student_id as "studentId",
        s.name as "studentName",
        e.roll_no as "studentRollNo",
        c.name as "className",
        sec.name as "sectionName",
        fi.employee_membership_id as "employeeMembershipId",
        ep.name as "employeeName",
        er.name as "employeeRole",
        fi.category,
        fi.title,
        fi.description,
        coalesce(fi.total_amount, fi.amount, 0)::numeric as "totalAmount",
        coalesce(fi.discount_amount, 0)::numeric as "discountAmount",
        coalesce(fi.paid_amount, 0)::numeric as "paidAmount",
        (coalesce(fi.total_amount, fi.amount, 0) - coalesce(fi.discount_amount, 0) - coalesce(fi.paid_amount, 0))::numeric as "dueAmount",
        fi.due_date as "dueDate",
        fi.status,
        coalesce(fi.items, '[]'::jsonb) as "items",
        fi.notes,
        fi.created_at as "createdAt"
      from fee_invoice fi
      left join student s on s.id = fi.student_id
      left join enrollment e on e.student_id = s.id and e.status = 'active'
      left join class c on c.id = e.class_id
      left join section sec on sec.id = e.section_id
      left join membership em on em.id = fi.employee_membership_id
      left join profile ep on ep.id = em.user_id
      left join role er on er.id = em.role_id
      ${whereClause}
      order by fi.created_at desc
      limit $${queryParams.length - 1} offset $${queryParams.length}
    `;

    const { rows } = await client.query(dataQuery, queryParams);
    return {
      invoices: rows.map((r) => ({
        ...r,
        totalAmount: Number(r.totalAmount),
        discountAmount: Number(r.discountAmount),
        paidAmount: Number(r.paidAmount),
        dueAmount: Math.max(0, Number(r.dueAmount)),
      })),
      total,
    };
  },

  async getInvoiceById(client: PoolClient, institutionId: string, invoiceId: string): Promise<Invoice | null> {
    const { rows } = await client.query(
      `select 
        fi.id,
        fi.institution_id as "institutionId",
        coalesce(fi.invoice_number, 'INV-' || substring(fi.id::text, 1, 8)) as "invoiceNumber",
        fi.recipient_type as "recipientType",
        fi.student_id as "studentId",
        s.name as "studentName",
        e.roll_no as "studentRollNo",
        c.name as "className",
        sec.name as "sectionName",
        fi.employee_membership_id as "employeeMembershipId",
        ep.name as "employeeName",
        er.name as "employeeRole",
        fi.category,
        fi.title,
        fi.description,
        coalesce(fi.total_amount, fi.amount, 0)::numeric as "totalAmount",
        coalesce(fi.discount_amount, 0)::numeric as "discountAmount",
        coalesce(fi.paid_amount, 0)::numeric as "paidAmount",
        (coalesce(fi.total_amount, fi.amount, 0) - coalesce(fi.discount_amount, 0) - coalesce(fi.paid_amount, 0))::numeric as "dueAmount",
        fi.due_date as "dueDate",
        fi.status,
        coalesce(fi.items, '[]'::jsonb) as "items",
        fi.notes,
        fi.created_at as "createdAt"
      from fee_invoice fi
      left join student s on s.id = fi.student_id
      left join enrollment e on e.student_id = s.id and e.status = 'active'
      left join class c on c.id = e.class_id
      left join section sec on sec.id = e.section_id
      left join membership em on em.id = fi.employee_membership_id
      left join profile ep on ep.id = em.user_id
      left join role er on er.id = em.role_id
      where fi.id = $1 and fi.institution_id = $2`,
      [invoiceId, institutionId]
    );
    if (rows.length === 0) return null;

    const inv = rows[0];

    // Fetch payments for this invoice
    const { rows: paymentRows } = await client.query(
      `select 
        p.id,
        p.institution_id as "institutionId",
        p.invoice_id as "invoiceId",
        coalesce(p.receipt_number, 'RCP-' || substring(p.id::text, 1, 8)) as "receiptNumber",
        p.amount::numeric as amount,
        p.payment_date as "paymentDate",
        coalesce(p.method, 'cash') as method,
        p.transaction_id as "transactionId",
        p.notes,
        prof.name as "recordedByName",
        p.created_at as "createdAt"
       from payment p
       left join membership m on m.id = p.recorded_by_membership_id
       left join profile prof on prof.id = m.user_id
       where p.invoice_id = $1 and p.institution_id = $2
       order by p.created_at desc`,
      [invoiceId, institutionId]
    );

    return {
      ...inv,
      totalAmount: Number(inv.totalAmount),
      discountAmount: Number(inv.discountAmount),
      paidAmount: Number(inv.paidAmount),
      dueAmount: Math.max(0, Number(inv.dueAmount)),
      payments: paymentRows.map((p) => ({ ...p, amount: Number(p.amount) })),
    };
  },

  async createInvoice(
    client: PoolClient,
    institutionId: string,
    data: {
      recipientType?: 'student' | 'employee' | 'institution';
      studentId?: string;
      employeeMembershipId?: string;
      academicYearId?: string;
      category?: string;
      title: string;
      description?: string;
      totalAmount?: number;
      discountAmount?: number;
      dueDate: string;
      items?: InvoiceItem[];
      notes?: string;
    },
    actorMembershipId?: string
  ): Promise<Invoice> {
    const cleanTitle = data.title?.trim();
    if (!cleanTitle) {
      throw new Error('Invoice title is required');
    }
    if (cleanTitle.length > 120) {
      throw new Error('Invoice title cannot exceed 120 characters');
    }
    if (data.description && data.description.trim().length > 2000) {
      throw new Error('Invoice description cannot exceed 2000 characters');
    }

    const recipientType = data.recipientType || (data.employeeMembershipId ? 'employee' : 'student');
    if (recipientType === 'student' && !data.studentId) {
      throw new Error('Student ID is required for student fee invoices');
    }
    if (recipientType === 'employee' && !data.employeeMembershipId) {
      throw new Error('Employee membership ID is required for employee salary/disbursement invoices');
    }

    const items = data.items || [];
    let computedTotal = Number(data.totalAmount || 0);
    if (items.length > 0 && (!data.totalAmount || data.totalAmount === 0)) {
      computedTotal = items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    }
    if (computedTotal <= 0) {
      throw new Error('Invoice amount must be greater than 0');
    }

    const discountAmount = Math.max(0, Number(data.discountAmount || 0));

    // Generate unique sequential invoice number
    const { rows: countRows } = await client.query(
      `select count(*)::int as cnt from fee_invoice where institution_id = $1`,
      [institutionId]
    );
    const seq = (countRows[0]?.cnt || 0) + 1;
    const prefix = recipientType === 'employee' ? 'PAY' : 'INV';
    const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    const { rows } = await client.query(
      `insert into fee_invoice (
        institution_id,
        invoice_number,
        recipient_type,
        student_id,
        employee_membership_id,
        academic_year_id,
        category,
        title,
        description,
        total_amount,
        amount,
        discount_amount,
        paid_amount,
        due_date,
        status,
        items,
        notes,
        created_by_membership_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, 0, $12, 'pending', $13, $14, $15)
       returning id`,
      [
        institutionId,
        invoiceNumber,
        recipientType,
        data.studentId || null,
        data.employeeMembershipId || null,
        data.academicYearId || null,
        data.category || (recipientType === 'employee' ? 'salary' : 'tuition'),
        cleanTitle,
        data.description?.trim() || null,
        computedTotal,
        discountAmount,
        data.dueDate,
        JSON.stringify(items),
        data.notes?.trim() || null,
        actorMembershipId || null,
      ]
    );

    const created = await financeRepository.getInvoiceById(client, institutionId, rows[0].id);
    if (!created) throw new Error('Failed to retrieve created invoice');

    // Dispatch notification and task
    try {
      if (recipientType === 'student' && data.studentId) {
        const { rows: sRows } = await client.query(
          `select s.user_id, m.id as membership_id 
           from student s 
           left join membership m on m.user_id = s.user_id and m.institution_id = s.institution_id
           where s.id = $1 and s.institution_id = $2 limit 1`,
          [data.studentId, institutionId]
        );
        const uId = sRows[0]?.user_id;
        const mId = sRows[0]?.membership_id;
        if (mId || uId) {
          await dispatchNotificationAndTask({
            client,
            institutionId,
            creatorMembershipId: actorMembershipId,
            recipientMembershipIds: mId ? [mId] : [],
            recipientUserIds: mId ? [] : (uId ? [uId] : []),
            title: `Fee Invoice Issued: ${cleanTitle}`,
            body: `A new fee invoice (${invoiceNumber}) for ৳${(computedTotal - discountAmount).toLocaleString()} is due on ${data.dueDate}.`,
            type: 'fee_invoice',
            priority: 'medium',
            dueDate: data.dueDate,
            createTask: Boolean(mId),
            metadata: { invoiceId: created.id, amount: computedTotal - discountAmount },
          });
        }
      } else if (recipientType === 'employee' && data.employeeMembershipId) {
        await dispatchNotificationAndTask({
          client,
          institutionId,
          creatorMembershipId: actorMembershipId,
          recipientMembershipIds: [data.employeeMembershipId],
          title: `Salary / Billing Entry Issued: ${cleanTitle}`,
          body: `A new payment invoice (${invoiceNumber}) for ৳${computedTotal.toLocaleString()} has been prepared.`,
          type: 'salary_disbursement',
          priority: 'medium',
          dueDate: data.dueDate,
          createTask: true,
          metadata: { invoiceId: created.id, amount: computedTotal },
        });
      }
    } catch {}

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create',
      entityType: 'fee_invoice',
      entityId: created.id,
      after: created,
    });

    return created;
  },

  async createBulkClassInvoices(
    client: PoolClient,
    institutionId: string,
    data: {
      classId: string;
      sectionId?: string;
      category?: string;
      title: string;
      description?: string;
      totalAmount?: number;
      dueDate: string;
      items?: InvoiceItem[];
    },
    actorMembershipId?: string
  ): Promise<{ issuedCount: number; invoices: Invoice[] }> {
    let studentQuery = `
      select e.student_id
      from enrollment e
      where e.institution_id = $1 and e.class_id = $2 and e.status = 'active'
    `;
    const params: any[] = [institutionId, data.classId];
    if (data.sectionId && data.sectionId !== 'all') {
      params.push(data.sectionId);
      studentQuery += ` and e.section_id = $${params.length}`;
    }

    const { rows: studentRows } = await client.query(studentQuery, params);
    if (studentRows.length === 0) {
      throw new Error('No enrolled students found matching the selected class/section');
    }

    const invoices: Invoice[] = [];
    for (const s of studentRows) {
      const inv = await financeRepository.createInvoice(
        client,
        institutionId,
        {
          recipientType: 'student',
          studentId: s.student_id,
          category: data.category || 'tuition',
          title: data.title,
          description: data.description,
          totalAmount: data.totalAmount,
          dueDate: data.dueDate,
          items: data.items,
        },
        actorMembershipId
      );
      invoices.push(inv);
    }

    return { issuedCount: invoices.length, invoices };
  },

  async createBulkInvoices(
    client: PoolClient,
    institutionId: string,
    data: {
      classId: string;
      sectionId?: string;
      category?: string;
      title: string;
      description?: string;
      amount?: number;
      totalAmount?: number;
      dueDate: string;
      items?: InvoiceItem[];
      notes?: string;
    },
    actorMembershipId?: string
  ): Promise<{ issuedCount: number; invoices: Invoice[]; count: number }> {
    const res = await financeRepository.createBulkClassInvoices(
      client,
      institutionId,
      {
        classId: data.classId,
        sectionId: data.sectionId,
        category: data.category,
        title: data.title,
        description: data.description || data.notes,
        totalAmount: data.totalAmount ?? data.amount,
        dueDate: data.dueDate,
        items: data.items,
      },
      actorMembershipId
    );
    return { ...res, count: res.issuedCount };
  },

  async recordPayment(
    client: PoolClient,
    institutionId: string,
    invoiceId: string,
    data: {
      amount: number;
      paymentDate?: string;
      method?: string;
      transactionId?: string;
      notes?: string;
    },
    actorMembershipId?: string
  ): Promise<{ payment: PaymentRecord; invoice: Invoice }> {
    const payAmount = Number(data.amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    const invoice = await financeRepository.getInvoiceById(client, institutionId, invoiceId);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status === 'cancelled') throw new Error('Cannot record payment on cancelled invoice');

    // Generate unique receipt code
    const { rows: payCount } = await client.query(
      `select count(*)::int as cnt from payment where institution_id = $1`,
      [institutionId]
    );
    const seq = (payCount[0]?.cnt || 0) + 1;
    const receiptNumber = `RCP-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;

    const { rows: pRows } = await client.query(
      `insert into payment (
        institution_id,
        invoice_id,
        receipt_number,
        amount,
        payment_date,
        method,
        transaction_id,
        notes,
        recorded_by_membership_id,
        status
       )
       values ($1, $2, $3, $4, coalesce($5, current_date), coalesce($6, 'cash'), $7, $8, $9, 'completed')
       returning id, institution_id as "institutionId", invoice_id as "invoiceId", receipt_number as "receiptNumber", amount::numeric as amount, payment_date as "paymentDate", method, transaction_id as "transactionId", notes, created_at as "createdAt"`,
      [
        institutionId,
        invoiceId,
        receiptNumber,
        payAmount,
        data.paymentDate || null,
        data.method || 'cash',
        data.transactionId?.trim() || null,
        data.notes?.trim() || null,
        actorMembershipId || null,
      ]
    );

    const payment = { ...pRows[0], amount: Number(pRows[0].amount) };

    // Update invoice paid_amount and status
    const newPaidAmount = Number(invoice.paidAmount) + payAmount;
    const netTotal = Math.max(0, Number(invoice.totalAmount) - Number(invoice.discountAmount));
    const nextStatus = newPaidAmount >= netTotal ? 'paid' : 'partially_paid';

    await client.query(
      `update fee_invoice set
         paid_amount = $1,
         status = $2,
         updated_at = now()
       where id = $3 and institution_id = $4`,
      [newPaidAmount, nextStatus, invoiceId, institutionId]
    );

    const updatedInvoice = (await financeRepository.getInvoiceById(client, institutionId, invoiceId))!;

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'record_payment',
      entityType: 'payment',
      entityId: payment.id,
      after: { payment, invoiceStatus: nextStatus, newPaidAmount },
    });

    // Dispatch payment receipt notification
    try {
      const recipientMembershipIds: string[] = [];
      const recipientUserIds: string[] = [];

      if (invoice.recipientType === 'student' && invoice.studentId) {
        const { rows: sRows } = await client.query(
          `select s.user_id, m.id as membership_id 
           from student s 
           left join membership m on m.user_id = s.user_id and m.institution_id = s.institution_id
           where s.id = $1 and s.institution_id = $2 limit 1`,
          [invoice.studentId, institutionId]
        );
        if (sRows[0]?.membership_id) recipientMembershipIds.push(sRows[0].membership_id);
        else if (sRows[0]?.user_id) recipientUserIds.push(sRows[0].user_id);
      } else if (invoice.recipientType === 'employee' && invoice.employeeMembershipId) {
        recipientMembershipIds.push(invoice.employeeMembershipId);
      }

      if (recipientMembershipIds.length > 0 || recipientUserIds.length > 0) {
        await dispatchNotificationAndTask({
          client,
          institutionId,
          creatorMembershipId: actorMembershipId,
          recipientMembershipIds,
          recipientUserIds,
          title: `Payment Receipt: ৳${payAmount.toLocaleString()}`,
          body: `Payment of ৳${payAmount.toLocaleString()} recorded via ${data.method || 'cash'} (Receipt: ${receiptNumber}). Invoice ${invoice.invoiceNumber} remaining balance: ৳${Math.max(0, netTotal - newPaidAmount).toLocaleString()}.`,
          type: 'payment_receipt',
          priority: 'low',
          createTask: false,
          metadata: {
            paymentId: payment.id,
            invoiceId,
            receiptNumber,
            amount: payAmount,
            status: nextStatus,
          },
        });
      }
    } catch {}

    return { payment, invoice: updatedInvoice };
  },

  async getFinanceSummary(client: PoolClient, institutionId: string): Promise<FinanceSummary> {
    const { rows: invStats } = await client.query(
      `select 
        coalesce(sum(case when fi.status != 'cancelled' then coalesce(fi.total_amount, fi.amount, 0) - coalesce(fi.discount_amount, 0) else 0 end), 0)::numeric as "totalBilled",
        coalesce(sum(case when fi.status != 'cancelled' then fi.paid_amount else 0 end), 0)::numeric as "totalCollected",
        coalesce(sum(case when fi.recipient_type = 'employee' and fi.status = 'paid' then fi.paid_amount else 0 end), 0)::numeric as "totalDisbursements"
       from fee_invoice fi
       where fi.institution_id = $1`,
      [institutionId]
    );

    const totalBilled = Number(invStats[0]?.totalBilled || 0);
    const totalCollected = Number(invStats[0]?.totalCollected || 0);
    const totalDisbursements = Number(invStats[0]?.totalDisbursements || 0);
    const totalPending = Math.max(0, totalBilled - totalCollected);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    // Monthly collection trend for last 6 months
    const { rows: monthlyRows } = await client.query(
      `select 
        to_char(p.payment_date, 'Mon YYYY') as month,
        sum(p.amount)::numeric as amount
       from payment p
       where p.institution_id = $1
       group by to_char(p.payment_date, 'Mon YYYY'), date_trunc('month', p.payment_date)
       order by date_trunc('month', p.payment_date) desc
       limit 6`,
      [institutionId]
    );

    return {
      totalBilled,
      totalCollected,
      totalPending,
      totalDisbursements,
      collectionRate,
      monthlyCollection: monthlyRows.map((r) => ({ month: r.month, amount: Number(r.amount) })),
    };
  },

  async getReceiptData(client: PoolClient, institutionId: string, paymentId: string): Promise<any> {
    const { rows: pRows } = await client.query(
      `select 
        p.id as "paymentId",
        p.receipt_number as "receiptNumber",
        p.amount::numeric as amount,
        p.payment_date as "paymentDate",
        p.method,
        p.transaction_id as "transactionId",
        p.notes,
        p.created_at as "recordedAt",
        p.invoice_id as "invoiceId",
        rec_prof.name as "recordedByName",
        rec_r.name as "recordedByRole"
       from payment p
       left join membership rec_m on rec_m.id = p.recorded_by_membership_id
       left join profile rec_prof on rec_prof.id = rec_m.user_id
       left join role rec_r on rec_r.id = rec_m.role_id
       where p.id = $1 and p.institution_id = $2`,
      [paymentId, institutionId]
    );
    if (pRows.length === 0) throw new Error('Receipt not found');
    const payment = pRows[0];

    const invoice = await financeRepository.getInvoiceById(client, institutionId, payment.invoiceId);
    const instSettings = await coreRepository.getInstitutionSettings(client, institutionId);

    return {
      payment: {
        ...payment,
        amount: Number(payment.amount),
      },
      invoice,
      institution: {
        id: instSettings.institution.id,
        name: instSettings.institution.name,
        instituteCode: instSettings.institution.instituteCode,
        address: instSettings.settings.address,
        contactEmail: instSettings.settings.contactEmail,
        contactPhone: instSettings.settings.contactPhone,
        currency: instSettings.settings.currency || 'BDT',
        officialSealUrl: instSettings.settings.officialSealUrl,
        principalSignatureUrl: instSettings.settings.principalSignatureUrl,
      },
    };
  },

  async getStudentFinanceSummary(client: PoolClient, institutionId: string, studentId: string): Promise<FinanceSummary> {
    const { rows: invStats } = await client.query(
      `select 
        coalesce(sum(case when fi.status != 'cancelled' then coalesce(fi.total_amount, fi.amount, 0) - coalesce(fi.discount_amount, 0) else 0 end), 0)::numeric as "totalBilled",
        coalesce(sum(case when fi.status != 'cancelled' then fi.paid_amount else 0 end), 0)::numeric as "totalCollected"
       from fee_invoice fi
       where fi.institution_id = $1 and fi.student_id = $2`,
      [institutionId, studentId]
    );

    const totalBilled = Number(invStats[0]?.totalBilled || 0);
    const totalCollected = Number(invStats[0]?.totalCollected || 0);
    const totalPending = Math.max(0, totalBilled - totalCollected);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    const { rows: monthlyRows } = await client.query(
      `select 
        to_char(p.payment_date, 'Mon YYYY') as month,
        sum(p.amount)::numeric as amount
       from payment p
       join fee_invoice fi on fi.id = p.invoice_id
       where p.institution_id = $1 and fi.student_id = $2
       group by to_char(p.payment_date, 'Mon YYYY'), date_trunc('month', p.payment_date)
       order by date_trunc('month', p.payment_date) desc
       limit 6`,
      [institutionId, studentId]
    );

    return {
      totalBilled,
      totalCollected,
      totalPending,
      totalDisbursements: 0,
      collectionRate,
      monthlyCollection: monthlyRows.map((r) => ({ month: r.month, amount: Number(r.amount) })).reverse(),
    };
  },

  async getFeeSettings(client: PoolClient, institutionId: string): Promise<{
    enableAbsentFine: boolean;
    absentFinePerDay: number;
    enableLatePaymentFine: boolean;
    latePaymentFine: number;
    customFeeCategories: string[];
  }> {
    const { rows } = await client.query(
      `select settings from institution_setting where institution_id = $1`,
      [institutionId]
    );
    const settings = rows[0]?.settings?.feeSettings || {};
    return {
      enableAbsentFine: settings.enableAbsentFine ?? true,
      absentFinePerDay: Number(settings.absentFinePerDay ?? 50),
      enableLatePaymentFine: settings.enableLatePaymentFine ?? false,
      latePaymentFine: Number(settings.latePaymentFine ?? 100),
      customFeeCategories: settings.customFeeCategories || [
        'Tuition Fee',
        'Examination Fee',
        'Admission / Registration',
        'Transport Bus Fee',
        'Library & Books',
        'Laboratory & Science',
        'Sports & Extra-curricular',
        'Absenteeism Fine',
        'Late Payment Fine',
        'General Miscellaneous',
      ],
    };
  },

  async updateFeeSettings(
    client: PoolClient,
    institutionId: string,
    data: {
      enableAbsentFine?: boolean;
      absentFinePerDay?: number;
      enableLatePaymentFine?: boolean;
      latePaymentFine?: number;
      customFeeCategories?: string[];
    }
  ): Promise<any> {
    const current = await financeRepository.getFeeSettings(client, institutionId);
    const updated = {
      ...current,
      ...data,
      absentFinePerDay: data.absentFinePerDay !== undefined ? Number(data.absentFinePerDay) : current.absentFinePerDay,
      latePaymentFine: data.latePaymentFine !== undefined ? Number(data.latePaymentFine) : current.latePaymentFine,
    };

    await client.query(
      `insert into institution_setting (institution_id, settings, updated_at)
       values ($1, jsonb_build_object('feeSettings', $2::jsonb), now())
       on conflict (institution_id) do update
       set settings = coalesce(institution_setting.settings, '{}'::jsonb) || jsonb_build_object('feeSettings', $2::jsonb),
           updated_at = now()`,
      [institutionId, JSON.stringify(updated)]
    );

    return updated;
  },

  async generateAbsentFines(
    client: PoolClient,
    institutionId: string,
    data: { month: string; classId?: string; sectionId?: string },
    actorMembershipId?: string
  ): Promise<{ issuedCount: number; invoices: Invoice[] }> {
    const feeSettings = await financeRepository.getFeeSettings(client, institutionId);
    if (!feeSettings.enableAbsentFine || feeSettings.absentFinePerDay <= 0) {
      throw new Error('Absenteeism fine policy is currently disabled or rate is 0 in Fee Settings');
    }

    const monthStr = data.month;
    if (!/^\d{4}-\d{2}$/.test(monthStr)) {
      throw new Error('Valid month format (YYYY-MM) is required');
    }

    const startDate = `${monthStr}-01`;

    let studentFilter = `where s.institution_id = $1 and e.status = 'active'`;
    const params: any[] = [institutionId, startDate];

    if (data.classId) {
      params.push(data.classId);
      studentFilter += ` and e.class_id = $${params.length}`;
    }
    if (data.sectionId) {
      params.push(data.sectionId);
      studentFilter += ` and e.section_id = $${params.length}`;
    }

    const { rows: absentRows } = await client.query(
      `select 
        s.id as student_id,
        s.name as student_name,
        count(a.id)::int as absent_days
       from student s
       join enrollment e on e.student_id = s.id
       join attendance a on a.student_id = s.id and a.session_type = 'daily' and a.status = 'absent'
         and a.date >= $2::date and a.date < ($2::date + interval '1 month')
       ${studentFilter}
       group by s.id, s.name
       having count(a.id) > 0`,
      params
    );

    const invoices: Invoice[] = [];
    const dueDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const r of absentRows) {
      const fineAmount = Number(r.absent_days) * feeSettings.absentFinePerDay;
      const title = `Absenteeism Fine (${r.absent_days} Days) - ${monthStr}`;
      const desc = `Penalty fine for ${r.absent_days} unexcused absent days during ${monthStr} at ৳${feeSettings.absentFinePerDay}/day.`;

      const inv = await financeRepository.createInvoice(
        client,
        institutionId,
        {
          recipientType: 'student',
          studentId: r.student_id,
          category: 'Absenteeism Fine',
          title,
          description: desc,
          totalAmount: fineAmount,
          dueDate,
          items: [
            {
              label: `Unexcused Absences (${r.absent_days} days × ৳${feeSettings.absentFinePerDay})`,
              amount: fineAmount,
            },
          ],
        },
        actorMembershipId
      );
      invoices.push(inv);
    }

    return { issuedCount: invoices.length, invoices };
  },

  // --- Fee Policy Management ---
  async listFeePolicies(client: PoolClient, institutionId: string): Promise<FeePolicy[]> {
    const { rows } = await client.query(
      `select 
        fp.id,
        fp.institution_id as "institutionId",
        fp.name,
        fp.description,
        fp.category,
        fp.amount::numeric as amount,
        fp.billing_cycle as "billingCycle",
        fp.target_audience as "targetAudience",
        fp.target_class_id as "targetClassId",
        c.name as "targetClassName",
        fp.target_section_id as "targetSectionId",
        sec.name as "targetSectionName",
        fp.target_student_ids as "targetStudentIds",
        fp.is_active as "isActive",
        fp.auto_apply_on_absence as "autoApplyOnAbsence",
        fp.fine_per_day::numeric as "finePerDay",
        fp.due_days_after as "dueDaysAfter",
        fp.created_by_membership_id as "createdByMembershipId",
        fp.created_at as "createdAt",
        fp.updated_at as "updatedAt"
      from fee_policy fp
      left join class c on c.id = fp.target_class_id
      left join section sec on sec.id = fp.target_section_id
      where fp.institution_id = $1
      order by fp.created_at desc`,
      [institutionId]
    );
    return rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      finePerDay: r.finePerDay ? Number(r.finePerDay) : undefined,
    }));
  },

  async createFeePolicy(
    client: PoolClient,
    institutionId: string,
    data: Partial<FeePolicy>,
    actorMembershipId?: string
  ): Promise<FeePolicy> {
    const { rows } = await client.query(
      `insert into fee_policy (
        institution_id, name, description, category, amount, billing_cycle,
        target_audience, target_class_id, target_section_id, target_student_ids,
        is_active, auto_apply_on_absence, fine_per_day, due_days_after, created_by_membership_id
      ) values (
        $1, $2, $3, coalesce($4, 'Tuition Fee'), coalesce($5, 0), coalesce($6, 'monthly'),
        coalesce($7, 'all_students'), $8, $9, coalesce($10::jsonb, '[]'::jsonb),
        coalesce($11, true), coalesce($12, false), coalesce($13, 0), coalesce($14, 15), $15
      )
      returning
        id, institution_id as "institutionId", name, description, category,
        amount::numeric as amount, billing_cycle as "billingCycle",
        target_audience as "targetAudience", target_class_id as "targetClassId",
        target_section_id as "targetSectionId", target_student_ids as "targetStudentIds",
        is_active as "isActive", auto_apply_on_absence as "autoApplyOnAbsence",
        fine_per_day::numeric as "finePerDay", due_days_after as "dueDaysAfter",
        created_by_membership_id as "createdByMembershipId", created_at as "createdAt", updated_at as "updatedAt"`,
      [
        institutionId,
        data.name?.trim() || 'New Fee Policy',
        data.description?.trim() || null,
        data.category || 'Tuition Fee',
        Number(data.amount) || 0,
        data.billingCycle || 'monthly',
        data.targetAudience || 'all_students',
        data.targetClassId || null,
        data.targetSectionId || null,
        data.targetStudentIds ? JSON.stringify(data.targetStudentIds) : '[]',
        data.isActive ?? true,
        data.autoApplyOnAbsence ?? false,
        Number(data.finePerDay) || 0,
        Number(data.dueDaysAfter) || 15,
        actorMembershipId || null,
      ]
    );

    const created = { ...rows[0], amount: Number(rows[0].amount) };

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create_fee_policy',
      entityType: 'fee_policy',
      entityId: created.id,
      after: created,
    });

    return created;
  },

  async updateFeePolicy(
    client: PoolClient,
    institutionId: string,
    policyId: string,
    data: Partial<FeePolicy>,
    actorMembershipId?: string
  ): Promise<FeePolicy> {
    const { rows: existing } = await client.query(
      `select * from fee_policy where id = $1 and institution_id = $2`,
      [policyId, institutionId]
    );
    if (existing.length === 0) throw new Error('Fee policy not found');

    const cur = existing[0];
    const { rows } = await client.query(
      `update fee_policy set
        name = coalesce($1, name),
        description = coalesce($2, description),
        category = coalesce($3, category),
        amount = coalesce($4, amount),
        billing_cycle = coalesce($5, billing_cycle),
        target_audience = coalesce($6, target_audience),
        target_class_id = case when $7::text is not null then $7::uuid else target_class_id end,
        target_section_id = case when $8::text is not null then $8::uuid else target_section_id end,
        target_student_ids = coalesce($9::jsonb, target_student_ids),
        is_active = coalesce($10, is_active),
        auto_apply_on_absence = coalesce($11, auto_apply_on_absence),
        fine_per_day = coalesce($12, fine_per_day),
        due_days_after = coalesce($13, due_days_after),
        updated_at = now()
      where id = $14 and institution_id = $15
      returning
        id, institution_id as "institutionId", name, description, category,
        amount::numeric as amount, billing_cycle as "billingCycle",
        target_audience as "targetAudience", target_class_id as "targetClassId",
        target_section_id as "targetSectionId", target_student_ids as "targetStudentIds",
        is_active as "isActive", auto_apply_on_absence as "autoApplyOnAbsence",
        fine_per_day::numeric as "finePerDay", due_days_after as "dueDaysAfter",
        created_by_membership_id as "createdByMembershipId", created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.name?.trim() || null,
        data.description !== undefined ? data.description?.trim() || null : null,
        data.category || null,
        data.amount !== undefined ? Number(data.amount) : null,
        data.billingCycle || null,
        data.targetAudience || null,
        data.targetClassId || null,
        data.targetSectionId || null,
        data.targetStudentIds ? JSON.stringify(data.targetStudentIds) : null,
        data.isActive !== undefined ? data.isActive : null,
        data.autoApplyOnAbsence !== undefined ? data.autoApplyOnAbsence : null,
        data.finePerDay !== undefined ? Number(data.finePerDay) : null,
        data.dueDaysAfter !== undefined ? Number(data.dueDaysAfter) : null,
        policyId,
        institutionId,
      ]
    );

    const updated = { ...rows[0], amount: Number(rows[0].amount) };

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'update_fee_policy',
      entityType: 'fee_policy',
      entityId: updated.id,
      before: cur,
      after: updated,
    });

    return updated;
  },

  async deleteFeePolicy(
    client: PoolClient,
    institutionId: string,
    policyId: string,
    actorMembershipId?: string
  ): Promise<void> {
    const { rows } = await client.query(
      `delete from fee_policy where id = $1 and institution_id = $2 returning id, name`,
      [policyId, institutionId]
    );
    if (rows.length === 0) throw new Error('Fee policy not found');

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'delete_fee_policy',
      entityType: 'fee_policy',
      entityId: policyId,
      before: rows[0],
    });
  },

  async applyFeePolicy(
    client: PoolClient,
    institutionId: string,
    policyId: string,
    options: {
      targetMonth?: string;
      dueDate?: string;
      overrideAmount?: number;
      classId?: string;
      sectionId?: string;
    } = {},
    actorMembershipId?: string
  ): Promise<{ appliedCount: number; totalAmount: number; invoices: Invoice[] }> {
    const { rows: polRows } = await client.query(
      `select * from fee_policy where id = $1 and institution_id = $2`,
      [policyId, institutionId]
    );
    if (polRows.length === 0) throw new Error('Fee policy not found');
    const policy = polRows[0];

    const feeAmount = options.overrideAmount !== undefined ? Number(options.overrideAmount) : Number(policy.amount);
    const dueDate =
      options.dueDate ||
      new Date(Date.now() + (Number(policy.due_days_after) || 15) * 86400000).toISOString().split('T')[0];
    const monthStr = options.targetMonth || new Date().toISOString().slice(0, 7);

    // Resolve eligible students based on policy audience or options overrides
    let studentFilter = `where s.institution_id = $1 and s.status = 'active'`;
    const params: any[] = [institutionId];

    const targetClassId = options.classId || policy.target_class_id;
    const targetSectionId = options.sectionId || policy.target_section_id;

    if (targetSectionId) {
      params.push(targetSectionId);
      studentFilter += ` and exists (select 1 from enrollment e where e.student_id = s.id and e.section_id = $${params.length} and e.status = 'enrolled')`;
    } else if (targetClassId) {
      params.push(targetClassId);
      studentFilter += ` and exists (select 1 from enrollment e where e.student_id = s.id and e.class_id = $${params.length} and e.status = 'enrolled')`;
    } else if (policy.target_audience === 'custom' && Array.isArray(policy.target_student_ids) && policy.target_student_ids.length > 0) {
      params.push(policy.target_student_ids);
      studentFilter += ` and s.id = any($${params.length}::uuid[])`;
    }

    const { rows: students } = await client.query(
      `select s.id, s.name, s.admission_no from student s ${studentFilter}`,
      params
    );

    const invoices: Invoice[] = [];
    let totalGeneratedAmount = 0;

    for (const st of students) {
      const title = `${policy.name} - ${monthStr}`;
      const desc = policy.description || `Applied fee policy: ${policy.name} for billing cycle ${monthStr}`;

      const inv = await financeRepository.createInvoice(
        client,
        institutionId,
        {
          recipientType: 'student',
          studentId: st.id,
          category: policy.category || 'Tuition Fee',
          title,
          description: desc,
          totalAmount: feeAmount,
          dueDate,
          items: [
            {
              label: `${policy.name} (${monthStr})`,
              amount: feeAmount,
            },
          ],
          notes: `policy_id:${policy.id};cycle:${monthStr}`,
        },
        actorMembershipId
      );

      invoices.push(inv);
      totalGeneratedAmount += feeAmount;
    }

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'apply_fee_policy',
      entityType: 'fee_policy',
      entityId: policy.id,
      after: {
        policyName: policy.name,
        appliedCount: invoices.length,
        totalAmount: totalGeneratedAmount,
        month: monthStr,
      },
    });

    return { appliedCount: invoices.length, totalAmount: totalGeneratedAmount, invoices };
  },

  // --- Payment Ledger & Cashier Transactions ---
  async listPayments(
    client: PoolClient,
    institutionId: string,
    options: {
      method?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ payments: PaymentLedgerItem[]; totalCount: number; totalCollected: number }> {
    let whereClause = `where p.institution_id = $1`;
    const params: any[] = [institutionId];

    if (options.method && options.method !== 'all') {
      params.push(options.method);
      whereClause += ` and lower(p.method) = lower($${params.length})`;
    }

    if (options.startDate) {
      params.push(options.startDate);
      whereClause += ` and p.payment_date >= $${params.length}::date`;
    }

    if (options.endDate) {
      params.push(options.endDate);
      whereClause += ` and p.payment_date <= $${params.length}::date`;
    }

    if (options.search?.trim()) {
      params.push(`%${options.search.trim().toLowerCase()}%`);
      whereClause += ` and (
        lower(p.receipt_number) like $${params.length} or
        lower(p.transaction_id) like $${params.length} or
        lower(i.invoice_number) like $${params.length} or
        lower(s.name) like $${params.length} or
        lower(coalesce(ep.name, '')) like $${params.length}
      )`;
    }

    // Get aggregates
    const { rows: aggRows } = await client.query(
      `select 
        count(p.id)::int as "totalCount",
        coalesce(sum(p.amount), 0)::numeric as "totalCollected"
      from payment p
      join fee_invoice i on i.id = p.invoice_id
      left join student s on s.id = i.student_id
      left join membership em on em.id = i.employee_membership_id
      left join profile ep on ep.id = em.user_id
      ${whereClause}`,
      params
    );

    const totalCount = aggRows[0]?.totalCount || 0;
    const totalCollected = Number(aggRows[0]?.totalCollected || 0);

    const limit = Math.min(options.limit || 50, 200);
    const offset = options.offset || 0;
    params.push(limit, offset);

    const { rows } = await client.query(
      `select
        p.id,
        p.institution_id as "institutionId",
        p.invoice_id as "invoiceId",
        i.invoice_number as "invoiceNumber",
        p.receipt_number as "receiptNumber",
        p.amount::numeric as amount,
        p.payment_date as "paymentDate",
        p.method,
        p.transaction_id as "transactionId",
        p.notes,
        coalesce(s.name, ep.name, 'Institution') as "payerName",
        i.recipient_type as "payerType",
        c.name as "className",
        e.roll_no as "studentRollNo",
        i.category,
        i.title as "invoiceTitle",
        cp.name as "cashierName",
        p.created_at as "createdAt"
      from payment p
      join fee_invoice i on i.id = p.invoice_id
      left join student s on s.id = i.student_id
      left join enrollment e on e.student_id = s.id
      left join class c on c.id = e.class_id
      left join membership em on em.id = i.employee_membership_id
      left join profile ep on ep.id = em.user_id
      left join membership cm on cm.id = p.recorded_by_membership_id
      left join profile cp on cp.id = cm.user_id
      ${whereClause}
      order by p.payment_date desc, p.created_at desc
      limit $${params.length - 1} offset $${params.length}`,
      params
    );

    const payments: PaymentLedgerItem[] = rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));

    return { payments, totalCount, totalCollected };
  },

  // --- Invoice Voiding ---
  async voidInvoice(
    client: PoolClient,
    institutionId: string,
    invoiceId: string,
    reason?: string,
    actorMembershipId?: string
  ): Promise<Invoice> {
    const inv = await financeRepository.getInvoiceById(client, institutionId, invoiceId);
    if (!inv) throw new Error('Invoice not found');
    if (inv.status === 'cancelled') throw new Error('Invoice is already cancelled/voided');
    if (inv.paidAmount > 0) throw new Error('Cannot void invoice with recorded payments; refund payments first');

    await client.query(
      `update fee_invoice set
        status = 'cancelled',
        notes = coalesce(notes, '') || case when notes is not null and notes != '' then ' | ' else '' end || 'VOIDED: ' || $1,
        updated_at = now()
      where id = $2 and institution_id = $3`,
      [reason?.trim() || 'Voided by accounts officer', invoiceId, institutionId]
    );

    const updated = (await financeRepository.getInvoiceById(client, institutionId, invoiceId))!;

    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'void_invoice',
      entityType: 'fee_invoice',
      entityId: invoiceId,
      before: { status: inv.status },
      after: { status: 'cancelled', reason },
    });

    return updated;
  },
};
