import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { assertContentLength, CONTENT_LIMITS } from '../../core/validation/content-limits';
import { dispatchNotificationAndTask } from '../core/notification-task-service';

export interface Notice {
  id: string;
  title: string;
  body: string;
  audienceScope: string;
  targetRoles?: string[];
  targetClassIds?: string[];
  targetSectionIds?: string[];
  audienceFilters?: Record<string, any>;
  publishedAt: string;
}

export const noticeRepository = {
  async list(client: PoolClient): Promise<Notice[]> {
    const { rows } = await client.query(
      `select 
        id, 
        title, 
        body, 
        audience_scope as "audienceScope", 
        target_roles as "targetRoles",
        target_class_ids as "targetClassIds",
        target_section_ids as "targetSectionIds",
        audience_filters as "audienceFilters",
        published_at as "publishedAt"
       from notice order by published_at desc limit 100`
    );
    return rows;
  },

  async create(
    client: PoolClient,
    institutionId: string,
    publishedByMembershipId: string,
    data: {
      title: string;
      body: string;
      audienceScope?: string;
      targetRoles?: string[];
      targetClassIds?: string[];
      targetSectionIds?: string[];
      audienceFilters?: Record<string, any>;
    }
  ): Promise<Notice> {
    const cleanTitle = data.title?.trim();
    const cleanBody = data.body?.trim();

    assertContentLength(cleanTitle, 'title', CONTENT_LIMITS.TITLE_MAX, true);
    assertContentLength(cleanBody, 'noticeBody', CONTENT_LIMITS.NOTICE_BODY_MAX, true);

    const { rows } = await client.query(
      `insert into notice (
        institution_id, 
        title, 
        body, 
        audience_scope, 
        target_roles, 
        target_class_ids, 
        target_section_ids, 
        audience_filters, 
        published_by_membership_id
       )
       values ($1, $2, $3, coalesce($4, 'institution'), $5, $6, $7, $8, $9)
       returning 
        id, 
        title, 
        body, 
        audience_scope as "audienceScope", 
        target_roles as "targetRoles",
        target_class_ids as "targetClassIds",
        target_section_ids as "targetSectionIds",
        audience_filters as "audienceFilters",
        published_at as "publishedAt"`,
      [
        institutionId,
        cleanTitle,
        cleanBody,
        data.audienceScope || 'institution',
        data.targetRoles || [],
        data.targetClassIds || [],
        data.targetSectionIds || [],
        JSON.stringify(data.audienceFilters || {}),
        publishedByMembershipId,
      ]
    );
    const notice = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId: publishedByMembershipId,
      action: 'create',
      entityType: 'notice',
      entityId: notice.id,
      after: notice,
    });

    // Dispatch notice notification to audience
    try {
      let recipientMembershipIds: string[] = [];

      if (data.targetClassIds && data.targetClassIds.length > 0) {
        // Fetch memberships of students enrolled in these classes
        const { rows: studentMembers } = await client.query(
          `select distinct m.id
           from enrollment e
           join student s on s.id = e.student_id
           join membership m on m.user_id = s.user_id and m.institution_id = e.institution_id
           where e.institution_id = $1 and e.class_id = any($2::text[]) and m.status = 'active'`,
          [institutionId, data.targetClassIds]
        );
        recipientMembershipIds.push(...studentMembers.map((r: any) => r.id));
      } else if (data.targetRoles && data.targetRoles.length > 0) {
        // Fetch memberships with matching roles
        const { rows: roleMembers } = await client.query(
          `select distinct m.id
           from membership m
           join role r on r.id = m.role_id
           where m.institution_id = $1 and m.status = 'active' and lower(r.name) = any($2::text[])`,
          [institutionId, data.targetRoles.map((r: string) => r.toLowerCase())]
        );
        recipientMembershipIds.push(...roleMembers.map((r: any) => r.id));
      } else {
        // Broad broadcast: active institution members
        const { rows: allMembers } = await client.query(
          `select id from membership where institution_id = $1 and status = 'active' and id != $2 limit 500`,
          [institutionId, publishedByMembershipId]
        );
        recipientMembershipIds.push(...allMembers.map((r: any) => r.id));
      }

      recipientMembershipIds = Array.from(
        new Set(recipientMembershipIds.filter((id) => id && id !== publishedByMembershipId))
      );

      if (recipientMembershipIds.length > 0) {
        await dispatchNotificationAndTask({
          client,
          institutionId,
          creatorMembershipId: publishedByMembershipId,
          recipientMembershipIds,
          title: `Notice: ${cleanTitle}`,
          body: cleanBody.length > 180 ? `${cleanBody.substring(0, 177)}...` : cleanBody,
          type: 'notice',
          priority: 'medium',
          createTask: false,
          metadata: { noticeId: notice.id, audienceScope: data.audienceScope || 'institution' },
        });
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return notice;
  },

  async markRead(client: PoolClient, institutionId: string, noticeId: string, membershipId: string): Promise<void> {
    await client.query(
      `insert into notice_read_receipt (institution_id, notice_id, membership_id)
       values ($1, $2, $3) on conflict do nothing`,
      [institutionId, noticeId, membershipId]
    );
  },
};
