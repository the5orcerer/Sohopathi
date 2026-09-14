import { PoolClient } from 'pg';

export interface AuditLogInput {
  institutionId: string;
  actorMembershipId?: string | null;
  action: string; // e.g. "create", "update", "delete", "promote", "grade"
  entityType: string; // e.g. "student", "assignment", "attendance"
  entityId: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  reason?: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logAudit(client: PoolClient, input: AuditLogInput): Promise<void> {
  const safeEntityId = input.entityId && UUID_REGEX.test(input.entityId) ? input.entityId : null;
  await client.query(
    `insert into audit_log (institution_id, actor_membership_id, action, entity_type, entity_id, before, after, reason)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      input.institutionId,
      input.actorMembershipId ?? null,
      input.action,
      input.entityType,
      safeEntityId,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      input.reason ?? null,
    ]
  );
}

export const auditLogger = {
  log: logAudit,
};

