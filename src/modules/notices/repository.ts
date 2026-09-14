import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';
import { assertContentLength, CONTENT_LIMITS } from '../../core/validation/content-limits';

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
