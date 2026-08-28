import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';

export interface Notice {
  id: string;
  title: string;
  body: string;
  audienceScope: string;
  publishedAt: string;
}

export const noticeRepository = {
  async list(client: PoolClient): Promise<Notice[]> {
    const { rows } = await client.query(
      `select id, title, body, audience_scope as "audienceScope", published_at as "publishedAt"
       from notice order by published_at desc limit 50`
    );
    return rows;
  },

  async create(
    client: PoolClient,
    institutionId: string,
    publishedByMembershipId: string,
    data: { title: string; body: string; audienceScope: string }
  ): Promise<Notice> {
    const { rows } = await client.query(
      `insert into notice (institution_id, title, body, audience_scope, published_by_membership_id)
       values ($1, $2, $3, $4, $5)
       returning id, title, body, audience_scope as "audienceScope", published_at as "publishedAt"`,
      [institutionId, data.title, data.body, data.audienceScope, publishedByMembershipId]
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
