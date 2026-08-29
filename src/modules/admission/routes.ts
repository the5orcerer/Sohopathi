import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { admissionRepository } from './repository';

export async function listApplications(req: Request, res: Response, client: PoolClient) {
  const status = req.query.status as string | undefined;
  const classId = req.query.classId as string | undefined;
  const academicYearId = req.query.academicYearId as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  const result = await admissionRepository.listApplications(client, req.ctx!.institutionId, {
    status,
    classId,
    academicYearId,
    search,
    limit,
    offset,
  });

  res.json(result);
}

export async function getAdmissionStats(req: Request, res: Response, client: PoolClient) {
  const stats = await admissionRepository.getStats(client, req.ctx!.institutionId);
  res.json(stats);
}

export async function getApplicationDetail(req: Request, res: Response, client: PoolClient) {
  const app = await admissionRepository.getApplicationById(client, req.ctx!.institutionId, req.params.id);
  if (!app) {
    return res.status(404).json({ error: 'Admission application not found' });
  }
  res.json(app);
}

export async function createApplication(req: Request, res: Response, client: PoolClient) {
  const created = await admissionRepository.createApplication(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(created);
}

export async function updateApplication(req: Request, res: Response, client: PoolClient) {
  const updated = await admissionRepository.updateApplication(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.json(updated);
}

export async function admitStudent(req: Request, res: Response, client: PoolClient) {
  const result = await admissionRepository.admitAndEnroll(
    client,
    req.ctx!.institutionId,
    req.params.id,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(result);
}

export async function deleteApplication(req: Request, res: Response, client: PoolClient) {
  await admissionRepository.deleteApplication(client, req.ctx!.institutionId, req.params.id, req.ctx?.membershipId);
  res.json({ success: true });
}

