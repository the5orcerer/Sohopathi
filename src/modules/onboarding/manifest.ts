import { ModuleManifest } from '../../core/registry/types';
import { onboardInstitution, listInstitutions } from './routes';
import { z } from 'zod';

const onboardValidation = {
  body: z.object({
    name: z.string().min(1),
    subdomain: z.string().min(1),
    adminEmail: z.string().email().optional(),
    ownerEmail: z.string().email().optional(),
    adminName: z.string().optional(),
    ownerName: z.string().optional(),
    username: z.string().optional(),
    adminUsername: z.string().optional(),
    branding: z.any().optional(),
  }),
};

export const onboardingManifest: ModuleManifest = {
  id: 'onboarding',
  name: 'Institution Onboarding & Platform Provisioning',
  version: '1.0.0',
  dependsOn: [],

  permissions: [],

  routes: [
    {
      method: 'POST',
      path: '/institutions',
      skipAuth: true,
      skipContext: true,
      validation: onboardValidation,
      handler: onboardInstitution,
    },
    {
      method: 'POST',
      path: '/api/onboarding/institutions',
      skipAuth: true,
      skipContext: true,
      validation: onboardValidation,
      handler: onboardInstitution,
    },
    {
      method: 'POST',
      path: '/api/auth/onboard',
      skipAuth: true,
      skipContext: true,
      validation: onboardValidation,
      handler: onboardInstitution,
    },
    {
      method: 'GET',
      path: '/institutions',
      skipAuth: true,
      skipContext: true,
      handler: listInstitutions,
    },
    {
      method: 'GET',
      path: '/api/onboarding/institutions',
      skipAuth: true,
      skipContext: true,
      handler: listInstitutions,
    },
  ],

  widgets: [],
};
