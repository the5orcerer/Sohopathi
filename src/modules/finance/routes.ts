import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { financeRepository } from './repository';

export async function getSummary(req: Request, res: Response, client: PoolClient) {
  // Handle self-scope for students and guardians
  if (req.grantedScope === 'self') {
    const { rows: sRows } = await client.query(
      `select s.id from student s
       where (s.user_id = $1 or s.id in (select sg.student_id from student_guardian sg join guardian g on g.user_id = $1))
         and s.institution_id = $2
       limit 1`,
      [req.ctx!.userId, req.ctx!.institutionId]
    );
    const selfStudentId = sRows[0]?.id;
    if (selfStudentId) {
      const summary = await financeRepository.getStudentFinanceSummary(client, req.ctx!.institutionId, selfStudentId);
      return res.json(summary);
    }
    return res.json({ totalBilled: 0, totalCollected: 0, totalPending: 0, totalDisbursements: 0, collectionRate: 100, monthlyCollection: [] });
  }

  const summary = await financeRepository.getFinanceSummary(client, req.ctx!.institutionId);
  res.json(summary);
}

export async function listInvoices(req: Request, res: Response, client: PoolClient) {
  const { status, recipientType, category, studentId, employeeMembershipId, search, limit, offset } = req.query;

  // Handle self-scope for students and guardians
  let effectiveStudentId = studentId as string | undefined;
  let effectiveEmployeeMembershipId = employeeMembershipId as string | undefined;

  if (req.grantedScope === 'self') {
    const roleName = (req.ctx?.roleName || '').toLowerCase();
    if (roleName.includes('student') || roleName.includes('guardian')) {
      const { rows: sRows } = await client.query(
        `select s.id from student s
         where (s.user_id = $1 or s.id in (select sg.student_id from student_guardian sg join guardian g on g.user_id = $1))
           and s.institution_id = $2
         limit 1`,
        [req.ctx!.userId, req.ctx!.institutionId]
      );
      if (sRows.length > 0) {
        effectiveStudentId = sRows[0].id;
      }
    } else {
      effectiveEmployeeMembershipId = req.ctx?.membershipId;
    }
  }

  const result = await financeRepository.listInvoices(client, req.ctx!.institutionId, {
    status: status as string,
    recipientType: recipientType as string,
    category: category as string,
    studentId: effectiveStudentId,
    employeeMembershipId: effectiveEmployeeMembershipId,
    search: search as string,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    offset: offset ? parseInt(offset as string, 10) : undefined,
  });

  res.json(result);
}

export async function getInvoice(req: Request, res: Response, client: PoolClient) {
  const invoice = await financeRepository.getInvoiceById(client, req.ctx!.institutionId, req.params.id);
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Enforce self-scope
  if (req.grantedScope === 'self') {
    const { rows: sRows } = await client.query(
      `select s.id from student s
       where (s.user_id = $1 or s.id in (select sg.student_id from student_guardian sg join guardian g on g.user_id = $1))
         and s.institution_id = $2`,
      [req.ctx!.userId, req.ctx!.institutionId]
    );
    const selfStudentIds = sRows.map((r) => r.id);
    if (invoice.studentId && !selfStudentIds.includes(invoice.studentId)) {
      return res.status(403).json({ error: 'Access denied to this invoice' });
    }
    if (invoice.employeeMembershipId && invoice.employeeMembershipId !== req.ctx?.membershipId) {
      return res.status(403).json({ error: 'Access denied to this invoice' });
    }
  }

  res.json(invoice);
}

export async function createInvoice(req: Request, res: Response, client: PoolClient) {
  try {
    const invoice = await financeRepository.createInvoice(
      client,
      req.ctx!.institutionId,
      req.body,
      req.ctx?.membershipId
    );
    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create invoice' });
  }
}

export async function createBulkInvoices(req: Request, res: Response, client: PoolClient) {
  try {
    const result = await financeRepository.createBulkClassInvoices(
      client,
      req.ctx!.institutionId,
      req.body,
      req.ctx?.membershipId
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to issue bulk invoices' });
  }
}

export async function recordPayment(req: Request, res: Response, client: PoolClient) {
  try {
    if (req.grantedScope === 'self') {
      const { rows: sRows } = await client.query(
        `select s.id from student s
         where (s.user_id = $1 or s.id in (select sg.student_id from student_guardian sg join guardian g on g.user_id = $1))
           and s.institution_id = $2`,
        [req.ctx!.userId, req.ctx!.institutionId]
      );
      const studentIds = sRows.map((r) => r.id);
      const inv = await financeRepository.getInvoiceById(client, req.ctx!.institutionId, req.params.id);
      if (!inv || !inv.studentId || !studentIds.includes(inv.studentId)) {
        return res.status(403).json({ error: 'Access denied: You can only settle invoices assigned to your student profile' });
      }
    }

    const result = await financeRepository.recordPayment(
      client,
      req.ctx!.institutionId,
      req.params.id,
      req.body,
      req.ctx?.membershipId
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to record payment' });
  }
}

export async function getReceipt(req: Request, res: Response, client: PoolClient) {
  try {
    const receipt = await financeRepository.getReceiptData(client, req.ctx!.institutionId, req.params.paymentId);
    res.json(receipt);
  } catch (err: any) {
    res.status(404).json({ error: err.message || 'Receipt not found' });
  }
}

export async function getFeeSettings(req: Request, res: Response, client: PoolClient) {
  try {
    const settings = await financeRepository.getFeeSettings(client, req.ctx!.institutionId);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to load fee settings' });
  }
}

export async function updateFeeSettings(req: Request, res: Response, client: PoolClient) {
  try {
    const settings = await financeRepository.updateFeeSettings(client, req.ctx!.institutionId, req.body);
    res.json(settings);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update fee settings' });
  }
}

export async function generateAbsentFines(req: Request, res: Response, client: PoolClient) {
  try {
    const result = await financeRepository.generateAbsentFines(
      client,
      req.ctx!.institutionId,
      req.body,
      req.ctx?.membershipId
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to generate absent fine invoices' });
  }
}

export async function listFeePolicies(req: Request, res: Response, client: PoolClient) {
  try {
    const policies = await financeRepository.listFeePolicies(client, req.ctx!.institutionId);
    res.json(policies);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list fee policies' });
  }
}

export async function createFeePolicy(req: Request, res: Response, client: PoolClient) {
  try {
    const policy = await financeRepository.createFeePolicy(
      client,
      req.ctx!.institutionId,
      req.body,
      req.ctx?.membershipId
    );
    res.status(201).json(policy);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create fee policy' });
  }
}

export async function updateFeePolicy(req: Request, res: Response, client: PoolClient) {
  try {
    const policy = await financeRepository.updateFeePolicy(
      client,
      req.ctx!.institutionId,
      req.params.id,
      req.body,
      req.ctx?.membershipId
    );
    res.json(policy);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update fee policy' });
  }
}

export async function deleteFeePolicy(req: Request, res: Response, client: PoolClient) {
  try {
    await financeRepository.deleteFeePolicy(
      client,
      req.ctx!.institutionId,
      req.params.id,
      req.ctx?.membershipId
    );
    res.json({ message: 'Fee policy deleted successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to delete fee policy' });
  }
}

export async function applyFeePolicy(req: Request, res: Response, client: PoolClient) {
  try {
    const result = await financeRepository.applyFeePolicy(
      client,
      req.ctx!.institutionId,
      req.params.id,
      req.body,
      req.ctx?.membershipId
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to apply fee policy' });
  }
}

export async function listPayments(req: Request, res: Response, client: PoolClient) {
  try {
    const { method, startDate, endDate, search, limit, offset } = req.query;
    const result = await financeRepository.listPayments(client, req.ctx!.institutionId, {
      method: method as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list payments ledger' });
  }
}

export async function voidInvoice(req: Request, res: Response, client: PoolClient) {
  try {
    const inv = await financeRepository.voidInvoice(
      client,
      req.ctx!.institutionId,
      req.params.id,
      req.body?.reason,
      req.ctx?.membershipId
    );
    res.json(inv);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to void invoice' });
  }
}
