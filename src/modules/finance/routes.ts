import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { financeRepository } from './repository';
import { attendanceRepository } from '../attendance/repository';

export async function listInvoices(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  let studentId = req.query.studentId as string | undefined;
  const status = req.query.status as string | undefined;

  if (grantedScope === 'self') {
    const selfStudentId = await attendanceRepository.getStudentIdForUser(client, req.ctx!.userId);
    if (!selfStudentId) {
      return res.json([]);
    }
    studentId = selfStudentId;
  }

  const invoices = await financeRepository.listInvoices(client, req.ctx!.institutionId, { studentId, status });
  res.json(invoices);
}

export async function createInvoice(req: Request, res: Response, client: PoolClient) {
  const invoice = await financeRepository.createInvoice(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(invoice);
}

export async function recordPayment(req: Request, res: Response, client: PoolClient) {
  const feeInvoiceId = req.params.id;
  const payment = await financeRepository.recordPayment(
    client,
    req.ctx!.institutionId,
    feeInvoiceId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(payment);
}

export async function getFinanceSummary(req: Request, res: Response, client: PoolClient) {
  const grantedScope = req.grantedScope;
  let studentId = req.query.studentId as string | undefined;

  if (grantedScope === 'self') {
    const selfStudentId = await attendanceRepository.getStudentIdForUser(client, req.ctx!.userId);
    if (!selfStudentId) {
      return res.json({
        totalInvoiced: 0,
        totalPaid: 0,
        totalPending: 0,
        paidCount: 0,
        pendingCount: 0,
        partialCount: 0,
      });
    }
    studentId = selfStudentId;
  }

  const summary = await financeRepository.getSummary(client, req.ctx!.institutionId, studentId);
  res.json(summary);
}
