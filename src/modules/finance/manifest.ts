import { ModuleManifest } from '../../core/registry/types';
import * as routes from './routes';
import { z } from 'zod';

export const financeManifest: ModuleManifest = {
  id: 'finance',
  name: 'Finance',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    { key: 'finance.read', description: 'View fee invoices and payment status', scopeOptions: ['institution', 'self'] },
    { key: 'finance.write', description: 'Create invoices and collect payments', scopeOptions: ['institution'] },
    { key: 'finance.reports', description: 'Access financial collection reports', scopeOptions: ['institution'] },
  ],

  routes: [
    { method: 'GET', path: '/invoices', requiredPermission: 'finance.read', handler: routes.listInvoices },
    {
      method: 'POST',
      path: '/invoices',
      requiredPermission: 'finance.write',
      validation: {
        body: z.object({
          studentId: z.string().uuid(),
          title: z.string().min(1),
          amount: z.number().positive(),
          dueDate: z.string().optional(),
        }),
      },
      handler: routes.createInvoice,
    },
    {
      method: 'POST',
      path: '/invoices/:id/payments',
      requiredPermission: 'finance.write',
      validation: {
        body: z.object({
          amount: z.number().positive(),
          paymentMethod: z.string().optional(),
          transactionRef: z.string().optional(),
        }),
      },
      handler: routes.recordPayment,
    },
    { method: 'GET', path: '/summary', requiredPermission: 'finance.read', handler: routes.getFinanceSummary },
  ],

  widgets: [
    {
      id: 'fee_collection_summary',
      requiredPermissions: ['finance.read'],
      defaultSize: { width: 4, height: 2 },
      dataSource: '/api/finance/summary',
      renderer: 'FeeCollectionSummary',
    },
    {
      id: 'my_invoices',
      requiredPermissions: ['finance.read'],
      defaultSize: { width: 6, height: 3 },
      dataSource: '/api/finance/invoices',
      renderer: 'MyInvoices',
    },
  ],

  navItem: { label: 'Finance', path: '/finance', requiredPermission: 'finance.read', sortOrder: 7 },

  events: {
    publishes: ['finance.invoice_created', 'finance.payment_received'],
    subscribes: ['enrollment.created'],
  },
};
