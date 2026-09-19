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
};
