import { z } from 'zod';
import { ModuleManifest } from '../../core/registry/types.js';
import * as routes from './routes.js';

export const documentsManifest: ModuleManifest = {
  id: 'documents',
  name: 'Document Templates & Generator',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    {
      key: 'templates.read',
      description: 'View document templates and generated certificates',
      scopeOptions: ['institution', 'assigned_sections', 'self'],
    },
    {
      key: 'templates.manage',
      description: 'Create and edit document certificates and print templates',
      scopeOptions: ['institution'],
    },
    {
      key: 'documents.generate',
      description: 'Render and bulk-generate official student & employee documents',
      scopeOptions: ['institution', 'assigned_sections'],
    },
  ],

  routes: [
    // Templates CRUD & Actions
    {
      method: 'GET',
      path: '/templates',
      requiredPermission: 'templates.read',
      handler: routes.listTemplates,
    },
    {
      method: 'GET',
      path: '/templates/:id',
      requiredPermission: 'templates.read',
      handler: routes.getTemplate,
    },
    {
      method: 'POST',
      path: '/templates',
      requiredPermission: 'templates.manage',
      validation: {
        body: z.object({
          type: z.string().min(1),
          context: z.string().optional(),
          name: z.string().min(1),
          description: z.string().optional(),
          content: z.string().min(1),
          pageSize: z.enum(['A4', 'Letter', 'Legal', 'ID_CARD']).optional(),
          orientation: z.enum(['portrait', 'landscape']).optional(),
          margins: z.record(z.string()).optional(),
          isDefault: z.boolean().optional(),
          metadata: z.any().optional(),
        }),
      },
      handler: routes.createTemplate,
    },
    {
      method: 'PUT',
      path: '/templates/:id',
      requiredPermission: 'templates.manage',
      validation: {
        body: z.object({
          type: z.string().optional(),
          context: z.string().optional(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          content: z.string().optional(),
          pageSize: z.enum(['A4', 'Letter', 'Legal', 'ID_CARD']).optional(),
          orientation: z.enum(['portrait', 'landscape']).optional(),
          margins: z.record(z.string()).optional(),
          isDefault: z.boolean().optional(),
          isArchived: z.boolean().optional(),
          metadata: z.any().optional(),
        }),
      },
      handler: routes.updateTemplate,
    },
    {
      method: 'DELETE',
      path: '/templates/:id',
      requiredPermission: 'templates.manage',
      handler: routes.deleteTemplate,
    },
    {
      method: 'POST',
      path: '/templates/:id/duplicate',
      requiredPermission: 'templates.manage',
      validation: {
        body: z
          .object({
            name: z.string().optional(),
          })
          .optional(),
      },
      handler: routes.duplicateTemplate,
    },
    {
      method: 'POST',
      path: '/templates/:id/set-default',
      requiredPermission: 'templates.manage',
      handler: routes.setDefaultTemplate,
    },
    {
      method: 'POST',
      path: '/templates/:id/archive',
      requiredPermission: 'templates.manage',
      validation: {
        body: z
          .object({
            archive: z.boolean().optional(),
          })
          .optional(),
      },
      handler: routes.archiveTemplate,
    },

    // Rendering
    {
      method: 'POST',
      path: '/templates/:id/render',
      requiredPermission: 'templates.read',
      handler: routes.renderTemplate,
    },
    {
      method: 'POST',
      path: '/templates/:id/bulk-render',
      requiredPermission: 'documents.generate',
      handler: routes.bulkRenderTemplate,
    },

    // Central Variable Registry
    {
      method: 'GET',
      path: '/variables',
      requiredPermission: 'templates.read',
      handler: routes.listVariables,
    },

    // Historical Generated Documents (Frozen Snapshots)
    {
      method: 'GET',
      path: '/generated-documents',
      requiredPermission: 'templates.read',
      handler: routes.listGeneratedDocuments,
    },
    {
      method: 'GET',
      path: '/generated-documents/:id',
      requiredPermission: 'templates.read',
      handler: routes.getGeneratedDocument,
    },
  ],

  widgets: [],

  navItem: [
    {
      label: 'Templates & Documents',
      path: '/templates',
      requiredPermission: 'templates.read',
      sortOrder: 6,
    },
  ],
};

