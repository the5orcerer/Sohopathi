import { Request } from 'express';

const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'auth',
  'mail',
  'docs',
  'status',
  'cdn',
  'assets',
]);

/**
 * Extracts tenant subdomain from a given hostname.
 * Examples:
 * - "dhakamodel.biddyapith.tech" -> "dhakamodel"
 * - "school.sohopathi-frontend.vercel.app" -> "school"
 * - "school.localhost" -> "school"
 * - "biddyapith.tech" -> null
 * - "www.biddyapith.tech" -> null
 * - "localhost" -> null
 */
export function extractSubdomainFromHostname(rawHost: string): string | null {
  if (!rawHost) return null;

  // Strip port if present (e.g., localhost:3000 -> localhost)
  const host = rawHost.split(':')[0].toLowerCase().trim();

  // Local or IP address
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  ) {
    return null;
  }

  // Handle .localhost domains (e.g., dhakamodel.localhost)
  if (host.endsWith('.localhost')) {
    const parts = host.split('.');
    if (parts.length >= 2) {
      const sub = parts[0];
      return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
    }
    return null;
  }

  // Local development domain: biddyapith.local
  const biddyapithLocal = 'biddyapith.local';
  if (host.endsWith(biddyapithLocal)) {
    if (host === biddyapithLocal || host === `www.${biddyapithLocal}`) {
      return null;
    }
    const prefix = host.slice(0, -(biddyapithLocal.length + 1));
    const sub = prefix.split('.').pop() || prefix;
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }

  // Primary production domain: biddyapith.tech
  const biddyapithDomain = 'biddyapith.tech';
  if (host.endsWith(biddyapithDomain)) {
    if (host === biddyapithDomain || host === `www.${biddyapithDomain}`) {
      return null;
    }
    const prefix = host.slice(0, -(biddyapithDomain.length + 1));
    const sub = prefix.split('.').pop() || prefix;
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }

  // Vercel deployment domain: biddyapith-frontend.vercel.app
  const vercelDomain = 'biddyapith-frontend.vercel.app';
  if (host.endsWith(vercelDomain)) {
    if (host === vercelDomain || host === `www.${vercelDomain}`) {
      return null;
    }
    const prefix = host.slice(0, -(vercelDomain.length + 1));
    const sub = prefix.split('.').pop() || prefix;
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }

  // Generic multi-tenant domain fallback (sub.domain.tld)
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }

  return null;
}

/**
 * Extracts tenant identifier (subdomain or UUID) from request headers, origin, or referer.
 */
export function extractTenantFromRequest(req: Request): string | null {
  // 1. Explicit custom headers
  const headerTenant =
    (req.headers['x-institution-subdomain'] as string) ||
    (req.headers['x-subdomain'] as string) ||
    (req.headers['x-institution-id'] as string);

  if (headerTenant && headerTenant.trim()) {
    return headerTenant.trim().toLowerCase();
  }

  // 2. Inspect Origin header (e.g. "https://dhakamodel.biddyapith.tech")
  const origin = req.headers['origin'] as string;
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const sub = extractSubdomainFromHostname(originHost);
      if (sub) return sub;
    } catch {}
  }

  // 3. Inspect Referer header
  const referer = req.headers['referer'] as string;
  if (referer) {
    try {
      const refererHost = new URL(referer).hostname;
      const sub = extractSubdomainFromHostname(refererHost);
      if (sub) return sub;
    } catch {}
  }

  // 4. Host header
  const host = req.headers['host'] as string;
  if (host) {
    const sub = extractSubdomainFromHostname(host);
    if (sub) return sub;
  }

  return null;
}

