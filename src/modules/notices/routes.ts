import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { noticeRepository } from './repository';

export async function listNotices(req: Request, res: Response, client: PoolClient) {
  const notices = await noticeRepository.list(client);
  res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');
  res.json(notices);
}

export async function createNotice(req: Request, res: Response, client: PoolClient) {
  const { title, body, audienceScope, targetRoles, targetClassIds, targetSectionIds, audienceFilters } = req.body;
  const notice = await noticeRepository.create(
    client,
    req.ctx!.institutionId,
    req.ctx!.membershipId,
    {
      title,
      body,
      audienceScope: audienceScope ?? 'institution',
      targetRoles,
      targetClassIds,
      targetSectionIds,
      audienceFilters,
    }
  );
  res.status(201).json(notice);
}

export async function markNoticeRead(req: Request, res: Response, client: PoolClient) {
  await noticeRepository.markRead(client, req.ctx!.institutionId, req.params.id, req.ctx!.membershipId);
  res.status(204).send();
}
