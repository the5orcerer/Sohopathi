import { ModuleManifest } from '../../core/registry/types';
import { getMe, getNav, getDashboard } from './routes';
import { listInstitutions } from '../onboarding/routes';

export const systemManifest: ModuleManifest = {
  id: 'system',
  name: 'System',
  version: '1.0.0',
  dependsOn: [],

  permissions: [],

  routes: [
    { method: 'GET', path: '/api/me', requiredPermission: '', handler: getMe },
    { method: 'GET', path: '/api/system/me', requiredPermission: '', handler: getMe },
    { method: 'GET', path: '/api/nav', requiredPermission: '', handler: getNav },
    { method: 'GET', path: '/api/system/nav', requiredPermission: '', handler: getNav },
    { method: 'GET', path: '/api/dashboard', requiredPermission: '', handler: getDashboard },
    { method: 'GET', path: '/api/system/dashboard', requiredPermission: '', handler: getDashboard },
    { method: 'GET', path: '/api/system/institutions', requiredPermission: '', skipAuth: true, skipContext: true, handler: listInstitutions },
  ],

  widgets: [],
};
