import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { financeRepository } from './repository';

export async function getSummary(req: Request, res: Response, client: PoolClient) {
  const summary = await financeRepository.getFinanceSummary(client, req.ctx!.institutionId);
  res.json(summary);
}

export async function listInvoices(req: Request, res: Response, client: PoolClient) {
  const { status, recipientType, category, studentId, employeeMembershipId, search, limit, offset } = req.query;

  // Handle self-scope for students
  let effectiveStudentId = studentId as string | undefined;
  if (req.grantedScope === 'self') {
    // If student user, resolve their student record
    const { rows: sRows } = await client.query(
      `select id from student where user_id = $1 and institution_id = $2 limit 1`,
      [req.ctx!.userId, req.ctx!.institutionId]
    );
    if (sRows.length > 0) {
      effectiveStudentId = sRows[0].id;
    }
  }

  const result = await financeRepository.listInvoices(client, req.ctx!.institutionId, {
    status: status as string,
    recipientType: recipientType as string,
    category: category as string,
    studentId: effectiveStudentId,
    employeeMembershipId: employeeMembershipId as string,
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
      `select id from student where user_id = $1 and institution_id = $2 limit 1`,
      [req.ctx!.userId, req.ctx!.institutionId]
    );
    const selfStudentId = sRows[0]?.id;
    if (invoice.studentId && invoice.studentId !== selfStudentId) {
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
