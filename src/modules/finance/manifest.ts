import { ModuleManifest } from '../../core/registry/types';
import {
  getSummary,
  listInvoices,
  getInvoice,
  createInvoice,
  createBulkInvoices,
  recordPayment,
  getReceipt,
} from './routes';

export const financeManifest: ModuleManifest = {
  id: 'finance',
  name: 'Finance & Invoicing',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    {
      key: 'finance.read',
      description: 'View fee invoices, payments, and financial summaries',
      scopeOptions: ['institution', 'assigned_sections', 'self'],
    },
    {
      key: 'finance.write',
      description: 'Create and manage student invoices and salary disbursements',
      scopeOptions: ['institution'],
    },
    {
      key: 'finance.payment',
      description: 'Record fee and billing payments and generate receipts',
      scopeOptions: ['institution'],
    },
    {
      key: 'finance.reports',
      description: 'View ledger reconciliation, collection metrics, and exports',
      scopeOptions: ['institution'],
    },
  ],

  routes: [
    { method: 'GET', path: '/api/finance/summary', requiredPermission: 'finance.read', handler: getSummary },
    { method: 'GET', path: '/api/finance/invoices', requiredPermission: 'finance.read', handler: listInvoices },
    { method: 'GET', path: '/api/finance/invoices/:id', requiredPermission: 'finance.read', handler: getInvoice },
    { method: 'POST', path: '/api/finance/invoices', requiredPermission: 'finance.write', handler: createInvoice },
    { method: 'POST', path: '/api/finance/invoices/bulk', requiredPermission: 'finance.write', handler: createBulkInvoices },
    { method: 'POST', path: '/api/finance/invoices/:id/payments', requiredPermission: 'finance.payment', handler: recordPayment },
    { method: 'GET', path: '/api/finance/receipts/:paymentId', requiredPermission: 'finance.read', handler: getReceipt },
  ],

  navItem: {
    label: 'Finance & Invoicing',
    path: '/billing',
    requiredPermission: 'finance.read',
    sortOrder: 7,
  },

  widgets: [
    {
      id: 'finance-summary',
      requiredPermissions: ['finance.read'],
      defaultSize: { width: 6, height: 2 },
      dataSource: '/api/finance/summary',
      renderer: 'FinanceSummary',
    },
    {
      id: 'fee-collection-overview',
      requiredPermissions: ['finance.read'],
      defaultSize: { width: 6, height: 2 },
      dataSource: '/api/finance/summary',
      renderer: 'FeeCollectionOverview',
    },
  ],
};
