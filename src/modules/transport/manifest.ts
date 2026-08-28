import { ModuleManifest } from '../../core/registry/types';
import * as routes from './routes';
import { z } from 'zod';

export const transportManifest: ModuleManifest = {
  id: 'transport',
  name: 'Transport',
  version: '1.0.0',
  dependsOn: ['core'],

  permissions: [
    { key: 'transport.read', description: 'View routes and vehicle info', scopeOptions: ['institution', 'assigned_routes', 'self'] },
    { key: 'transport.manage', description: 'Create and manage routes, vehicles, and stops', scopeOptions: ['institution'] },
    { key: 'transport.assign_driver', description: 'Assign driver to a vehicle or route', scopeOptions: ['institution'] },
    { key: 'transport.track', description: 'View live vehicle location', scopeOptions: ['assigned_routes', 'self'] },
  ],

  routes: [
    { method: 'GET', path: '/routes', requiredPermission: 'transport.read', handler: routes.listRoutes },
    {
      method: 'POST',
      path: '/routes',
      requiredPermission: 'transport.manage',
      validation: {
        body: z.object({
          name: z.string().min(1),
          vehicleId: z.string().uuid().optional(),
          driverId: z.string().uuid().optional(),
        }),
      },
      handler: routes.createRoute,
    },
    { method: 'GET', path: '/vehicles', requiredPermission: 'transport.read', handler: routes.listVehicles },
    {
      method: 'POST',
      path: '/vehicles',
      requiredPermission: 'transport.manage',
      validation: {
        body: z.object({
          registrationNo: z.string().min(1),
          capacity: z.number().optional(),
        }),
      },
      handler: routes.createVehicle,
    },
    {
      method: 'POST',
      path: '/drivers',
      requiredPermission: 'transport.manage',
      validation: {
        body: z.object({
          name: z.string().min(1),
          userId: z.string().uuid().optional(),
          licenseNo: z.string().optional(),
        }),
      },
      handler: routes.createDriver,
    },
    {
      method: 'POST',
      path: '/routes/:id/driver',
      requiredPermission: 'transport.assign_driver',
      validation: {
        body: z.object({
          driverId: z.string().uuid(),
        }),
      },
      handler: routes.assignDriverToRoute,
    },
    { method: 'GET', path: '/my-route', requiredPermission: 'transport.read', scopeCheck: 'self', handler: routes.getMyRoute },
    {
      method: 'POST',
      path: '/vehicles/:id/location',
      requiredPermission: 'transport.track',
      validation: {
        body: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
      },
      handler: routes.updateVehicleLocation,
    },
    {
      method: 'POST',
      path: '/student-assignments',
      requiredPermission: 'transport.manage',
      validation: {
        body: z.object({
          studentId: z.string().uuid(),
          routeId: z.string().uuid(),
          stopId: z.string().uuid().optional(),
        }),
      },
      handler: routes.assignStudentTransport,
    },
  ],

  widgets: [
    {
      id: 'fleet_overview',
      requiredPermissions: ['transport.manage'],
      defaultSize: { width: 6, height: 3 },
      dataSource: '/api/transport/routes',
      renderer: 'FleetOverview',
    },
    {
      id: 'my_route',
      requiredPermissions: ['transport.read'],
      defaultSize: { width: 4, height: 2 },
      dataSource: '/api/transport/my-route',
      renderer: 'MyRoute',
    },
  ],

  navItem: { label: 'Transport', path: '/transport', requiredPermission: 'transport.read', sortOrder: 6 },

  events: {
    publishes: ['transport.route_created', 'transport.vehicle_location_updated'],
    subscribes: ['enrollment.created'],
  },

  storage: [
    { bucket: 'primary', pattern: 'institutions/{institution_id}/transport/vehicles/{vehicle_id}/{file}' },
  ],
};
