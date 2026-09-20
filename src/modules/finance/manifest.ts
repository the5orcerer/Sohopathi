import { ModuleManifest } from '../../core/registry/types';
import {
  getSummary,
  listInvoices,
  getInvoice,
  createInvoice,
  createBulkInvoices,
  recordPayment,
  getReceipt,
  getFeeSettings,
  updateFeeSettings,
  generateAbsentFines,
  listFeePolicies,
  createFeePolicy,
  updateFeePolicy,
  deleteFeePolicy,
  applyFeePolicy,
  listPayments,
  voidInvoice,
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
      scopeOptions: ['institution', 'self'],
    },
    {
      key: 'finance.reports',
      description: 'View ledger reconciliation, collection metrics, and exports',
      scopeOptions: ['institution'],
    },
  ],

  routes: [
    { method: 'GET', path: '/api/finance/summary', requiredPermission: 'finance.read', handler: getSummary },
    { method: 'GET', path: '/api/finance/settings', requiredPermission: 'finance.read', handler: getFeeSettings },
    { method: 'PATCH', path: '/api/finance/settings', requiredPermission: 'finance.write', handler: updateFeeSettings },
    { method: 'POST', path: '/api/finance/generate-absent-fines', requiredPermission: 'finance.write', handler: generateAbsentFines },
    { method: 'GET', path: '/api/finance/policies', requiredPermission: 'finance.read', handler: listFeePolicies },
    { method: 'POST', path: '/api/finance/policies', requiredPermission: 'finance.write', handler: createFeePolicy },
    { method: 'PATCH', path: '/api/finance/policies/:id', requiredPermission: 'finance.write', handler: updateFeePolicy },
    { method: 'DELETE', path: '/api/finance/policies/:id', requiredPermission: 'finance.write', handler: deleteFeePolicy },
    { method: 'POST', path: '/api/finance/policies/:id/apply', requiredPermission: 'finance.write', handler: applyFeePolicy },
    { method: 'GET', path: '/api/finance/payments', requiredPermission: 'finance.read', handler: listPayments },
    { method: 'POST', path: '/api/finance/invoices/:id/void', requiredPermission: 'finance.write', handler: voidInvoice },
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
