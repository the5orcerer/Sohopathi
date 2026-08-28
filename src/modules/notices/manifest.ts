import { ModuleManifest } from '../../core/registry/types';
import { listNotices, createNotice, markNoticeRead } from './routes';
import { z } from 'zod';

export const noticesManifest: ModuleManifest = {
  id: 'notices',
  name: 'Notices',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    { key: 'notices.read', description: 'View notices', scopeOptions: ['institution'] },
    { key: 'notices.write', description: 'Publish notices', scopeOptions: ['institution'] },
  ],

  routes: [
    { method: 'GET', path: '', requiredPermission: 'notices.read', handler: listNotices },
    {
      method: 'POST',
      path: '',
      requiredPermission: 'notices.write',
      validation: {
        body: z.object({
          title: z.string().min(1),
          body: z.string().min(1),
          audienceScope: z.string().optional(),
        }),
      },
      handler: createNotice,
    },
    { method: 'POST', path: '/:id/read', requiredPermission: 'notices.read', handler: markNoticeRead },
  ],

  widgets: [
    {
      id: 'notice_board',
      requiredPermissions: ['notices.read'],
      defaultSize: { width: 4, height: 3 },
      dataSource: '/api/notices',
      renderer: 'NoticeBoard',
    },
  ],

  navItem: { label: 'Notices', path: '/notices', requiredPermission: 'notices.read', sortOrder: 4 },

  events: {
    publishes: ['notice.published'],
    subscribes: [],
  },
};
