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
 * Detects the tenant subdomain from the current hostname or URL parameter.
 *
 * Hosted scenarios:
 * - "dhakamodel.biddyapith.tech" -> "dhakamodel"
 * - "school.sohopathi-frontend.vercel.app" -> "school"
 * - "school.localhost" -> "school"
 *
 * Local/Apex scenarios (returns null, which means prompt for subdomain at login):
 * - "biddyapith.tech" -> null (apex domain)
 * - "www.biddyapith.tech" -> null (reserved prefix)
 * - "localhost" / "127.0.0.1" -> null (local development)
 *
 * Dev override:
 * - "?subdomain=dhakamodel" or "?org=dhakamodel" -> "dhakamodel" (enables testing hosted behavior locally)
 */
export function getTenantSubdomain(hostname?: string): string | null {
  // Check for search query override (useful in local dev / testing)
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const querySub = params.get('subdomain') || params.get('org') || params.get('tenant');
      if (querySub && querySub.trim()) {
        const clean = querySub.trim().toLowerCase();
        if (!RESERVED_SUBDOMAINS.has(clean)) {
          return clean;
        }
      }
    } catch {}
  }

  const rawHost = hostname || (typeof window !== 'undefined' ? window.location.hostname : '');
  if (!rawHost) return null;

  // Strip port if present
  const host = rawHost.split(':')[0].toLowerCase().trim();

  // Local development / IP addresses -> prompt at login
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  ) {
    return null;
  }

  // Handle .localhost subdomains (e.g., dhakamodel.localhost)
  if (host.endsWith('.localhost')) {
    const parts = host.split('.');
    if (parts.length >= 2) {
      const sub = parts[0];
      return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
    }
    return null;
  }

  // Production domain: biddyapith.tech
  const biddyapithDomain = 'biddyapith.tech';
  if (host.endsWith(biddyapithDomain)) {
    if (host === biddyapithDomain || host === `www.${biddyapithDomain}`) {
      return null;
    }
    const prefix = host.slice(0, -(biddyapithDomain.length + 1));
    const sub = prefix.split('.').pop() || prefix;
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }

  // Vercel deployment domain: sohopathi-frontend.vercel.app
  const vercelDomain = 'sohopathi-frontend.vercel.app';
  if (host.endsWith(vercelDomain)) {
    if (host === vercelDomain || host === `www.${vercelDomain}`) {
      return null;
    }
    const prefix = host.slice(0, -(vercelDomain.length + 1));
    const sub = prefix.split('.').pop() || prefix;
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }

  // Generic multi-tenant fallback (sub.domain.tld)
  const parts = host.split('.');
  if (parts.length >= 3) {
    const sub = parts[0];
    return RESERVED_SUBDOMAINS.has(sub) ? null : sub;
  }

  return null;
}

/**
 * Builds the canonical tenant URL for a given subdomain.
 */
export function buildTenantUrl(subdomain: string, path: string = ''): string {
  const cleanSub = subdomain.trim().toLowerCase();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If running locally, preserve host/port format if preferred
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${window.location.protocol}//${cleanSub}.localhost${port}${cleanPath}`;
    }
  }

  return `https://${cleanSub}.biddyapith.tech${cleanPath}`;
}

/**
 * Checks if the current environment is running locally or without a tenant subdomain.
 */
export function isLocalOrDev(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname.toLowerCase();
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

