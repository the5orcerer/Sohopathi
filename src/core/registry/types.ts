import { Request, Response } from 'express';
import { PoolClient } from 'pg';

export type Scope = 'institution' | 'assigned_sections' | 'assigned_routes' | 'self';

export interface PermissionDefinition {
  key: string;
  description: string;
  scopeOptions: Scope[] | string[];
}

export interface EntityDefinition {
  table: string;
  tenantScoped: boolean;
  migrationPath?: string;
}

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  requiredPermission?: string;
  scopeCheck?: Scope | string;
  skipAuth?: boolean;
  skipContext?: boolean;
  validation?: {
    body?: any;
    query?: any;
    params?: any;
  };
  handler: (req: Request, res: Response, client: PoolClient) => Promise<any> | any;
}

export interface WidgetDefinition {
  id: string;
  requiredPermissions: string[];
  defaultSize: { width: number; height: number };
  dataSource: string;
  renderer: string;
}

export interface NavItemDefinition {
  label: string;
  path: string;
  requiredPermission: string;
  sortOrder?: number;
}

export interface StoragePathTemplate {
  bucket: string;
  pattern: string;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  dependsOn: string[];
  permissions: PermissionDefinition[];
  entities?: EntityDefinition[];
  routes: RouteDefinition[];
  widgets: WidgetDefinition[];
  navItem?: NavItemDefinition | NavItemDefinition[];
  events?: {
    publishes: string[];
    subscribes: string[];
  };
  storage?: StoragePathTemplate[];
}
