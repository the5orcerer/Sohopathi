import { PoolClient } from 'pg';
import { pino } from 'pino';

const logger = pino({ level: 'info' });

export interface DispatchNotificationTaskParams {
  client: PoolClient;
  institutionId: string;
  creatorMembershipId?: string;
  recipientMembershipIds?: string[];
  recipientUserIds?: string[];
  title: string;
  body: string;
  type?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  metadata?: Record<string, any>;
  createTask?: boolean;
}

export interface DispatchResult {
  notificationsSent: number;
  tasksCreated: number;
}

/**
 * Universal service to dispatch in-app notifications and actionable staff/student tasks
 * across Examinations, Assignments, Attendance, Requests, and Staff workflows.
 */
export async function dispatchNotificationAndTask(
  params: DispatchNotificationTaskParams
): Promise<DispatchResult> {
  const {
    client,
    institutionId,
    creatorMembershipId,
    recipientMembershipIds = [],
    recipientUserIds = [],
    title,
    body,
    type = 'general',
    priority = 'medium',
    dueDate,
    metadata = {},
    createTask = true,
  } = params;

  let notificationsSent = 0;
  let tasksCreated = 0;

  // Resolve user IDs for membership IDs if needed
  const targetMemberships = Array.from(new Set(recipientMembershipIds.filter(Boolean)));
  const targetUsers = Array.from(new Set(recipientUserIds.filter(Boolean)));

  // 1. Dispatch for memberships
  for (const memId of targetMemberships) {
    // Look up user_id for this membership
    const { rows: memRows } = await client.query(
      `select user_id from membership where id = $1 and institution_id = $2 limit 1`,
      [memId, institutionId]
    );
    const userId = memRows[0]?.user_id || null;

    // Insert Notification
    await client.query(
      `insert into notification (institution_id, recipient_user_id, recipient_membership_id, title, body, type, data)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        institutionId,
        userId,
        memId,
        title,
        body,
        type,
        JSON.stringify({ ...metadata, creatorMembershipId }),
      ]
    );
    notificationsSent++;

    // Insert Task if requested
    if (createTask) {
      await client.query(
        `insert into user_task (institution_id, creator_membership_id, assignee_membership_id, title, description, priority, due_date, status)
         values ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [
          institutionId,
          creatorMembershipId || null,
          memId,
          title,
          body,
          priority,
          dueDate || null,
        ]
      );
      tasksCreated++;
    }
  }

  // 2. Dispatch for direct user IDs (e.g. students/guardians without explicit staff membership)
  for (const uId of targetUsers) {
    await client.query(
      `insert into notification (institution_id, recipient_user_id, recipient_membership_id, title, body, type, data)
       values ($1, $2, null, $3, $4, $5, $6)`,
      [
        institutionId,
        uId,
        title,
        body,
        type,
        JSON.stringify({ ...metadata, creatorMembershipId }),
      ]
    );
    notificationsSent++;
  }

  logger.info(
    { notificationsSent, tasksCreated, title, type },
    'Successfully dispatched notifications and tasks'
  );

  return { notificationsSent, tasksCreated };
}

