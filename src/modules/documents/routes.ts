import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { documentsRepo } from './repository.js';
import { getVariablesForContext, getVariablesByCategory } from './variable-registry.js';

export async function listTemplates(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const { type, context, isArchived, search } = req.query;

  const templates = await documentsRepo.listTemplates(client, institutionId, {
    type: type as string | undefined,
    context: context as string | undefined,
    isArchived: isArchived !== undefined ? isArchived === 'true' : undefined,
    search: search as string | undefined,
  });

  res.json(templates);
}

export async function getTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const template = await documentsRepo.getTemplateById(client, institutionId, req.params.id);

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(template);
}

export async function createTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx?.membershipId;

  const template = await documentsRepo.createTemplate(
    client,
    institutionId,
    req.body,
    actorMembershipId
  );

  res.status(201).json(template);
}

export async function updateTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx?.membershipId;

  try {
    const updated = await documentsRepo.updateTemplate(
      client,
      institutionId,
      req.params.id,
      req.body,
      actorMembershipId
    );
    res.json(updated);
  } catch (err: any) {
    if (err.message && err.message.includes('SYSTEM_TEMPLATE_READONLY')) {
      return res.status(403).json({
        error: err.message,
        code: 'SYSTEM_TEMPLATE_READONLY',
      });
    }
    throw err;
  }
}

export async function deleteTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx?.membershipId;

  try {
    const result = await documentsRepo.deleteTemplate(
      client,
      institutionId,
      req.params.id,
      actorMembershipId
    );
    res.json(result);
  } catch (err: any) {
    if (err.message && err.message.includes('SYSTEM_TEMPLATE_READONLY')) {
      return res.status(403).json({
        error: err.message,
        code: 'SYSTEM_TEMPLATE_READONLY',
      });
    }
    throw err;
  }
}

export async function duplicateTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx?.membershipId;
  const { name } = req.body || {};

  const cloned = await documentsRepo.duplicateTemplate(
    client,
    institutionId,
    req.params.id,
    name,
    actorMembershipId
  );

  res.status(201).json(cloned);
}

export async function setDefaultTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx?.membershipId;

  const result = await documentsRepo.setDefaultTemplate(
    client,
    institutionId,
    req.params.id,
    actorMembershipId
  );

  res.json(result);
}

export async function archiveTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx?.membershipId;
  const { archive = true } = req.body || {};

  try {
    const result = await documentsRepo.archiveTemplate(
      client,
      institutionId,
      req.params.id,
      archive,
      actorMembershipId
    );
    res.json(result);
  } catch (err: any) {
    if (err.message && err.message.includes('SYSTEM_TEMPLATE_READONLY')) {
      return res.status(403).json({
        error: err.message,
        code: 'SYSTEM_TEMPLATE_READONLY',
      });
    }
    throw err;
  }
}

export async function renderTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx?.membershipId;

  const rendered = await documentsRepo.renderTemplate(
    client,
    institutionId,
    req.params.id,
    req.body,
    actorMembershipId
  );

  res.json(rendered);
}

export async function bulkRenderTemplate(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const actorMembershipId = req.ctx?.membershipId;
  const { entityIds, entityType, customVariables, saveSnapshots } = req.body;

  if (!entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
    return res.status(400).json({ error: 'entityIds must be a non-empty array' });
  }

  const result = await documentsRepo.bulkRenderTemplate(
    client,
    institutionId,
    {
      templateId: req.params.id,
      entityType: entityType || 'student',
      entityIds,
      customVariables,
      saveSnapshots,
    },
    actorMembershipId
  );

  res.json(result);
}

export async function listVariables(req: Request, res: Response) {
  const context = req.query.context as string | undefined;
  const variables = getVariablesForContext(context);
  const grouped = getVariablesByCategory(variables);

  res.json({
    context: context || 'all',
    total: variables.length,
    variables,
    grouped,
  });
}

export async function listGeneratedDocuments(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const { entityType, entityId, documentType, templateId, limit, offset } = req.query;

  const docs = await documentsRepo.listGeneratedDocuments(client, institutionId, {
    entityType: entityType as string | undefined,
    entityId: entityId as string | undefined,
    documentType: documentType as string | undefined,
    templateId: templateId as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
    offset: offset ? parseInt(offset as string, 10) : undefined,
  });

  res.json(docs);
}

export async function getGeneratedDocument(req: Request, res: Response, client: PoolClient) {
  const institutionId = req.ctx!.institutionId;
  const doc = await documentsRepo.getGeneratedDocumentById(client, institutionId, req.params.id);

  if (!doc) {
    return res.status(404).json({ error: 'Generated document not found' });
  }

  res.json(doc);
}

