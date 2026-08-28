import { PoolClient } from 'pg';

export interface AuditLogInput {
  institutionId: string;
  actorMembershipId?: string | null;
  action: string; // e.g. "create", "update", "delete", "promote", "grade"
  entityType: string; // e.g. "student", "assignment", "attendance"
  entityId: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
}

export async function logAudit(client: PoolClient, input: AuditLogInput): Promise<void> {
  await client.query(
    `insert into audit_log (institution_id, actor_membership_id, action, entity_type, entity_id, before, after)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.institutionId,
      input.actorMembershipId ?? null,
      input.action,
      input.entityType,
      input.entityId,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
    ]
  );
}
