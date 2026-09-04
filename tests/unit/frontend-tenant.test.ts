import { describe, it, expect } from 'vitest';
import { getTenantSubdomain, buildTenantUrl } from '../../frontend/src/utils/tenant';

describe('Frontend Tenant Subdomain Resolution', () => {
  describe('getTenantSubdomain', () => {
    it('detects tenant from biddyapith.tech hosted subdomains', () => {
      expect(getTenantSubdomain('dhakamodel.biddyapith.tech')).toBe('dhakamodel');
      expect(getTenantSubdomain('cgs.biddyapith.tech')).toBe('cgs');
      expect(getTenantSubdomain('SCH-01.BIDDYAPITH.TECH')).toBe('sch-01');
      expect(getTenantSubdomain('school.biddyapith.tech:5173')).toBe('school');
    });

    it('returns null on apex domain and reserved prefixes', () => {
      expect(getTenantSubdomain('biddyapith.tech')).toBeNull();
      expect(getTenantSubdomain('www.biddyapith.tech')).toBeNull();
      expect(getTenantSubdomain('api.biddyapith.tech')).toBeNull();
      expect(getTenantSubdomain('admin.biddyapith.tech')).toBeNull();
      expect(getTenantSubdomain('cdn.biddyapith.tech')).toBeNull();
    });

    it('detects tenant on vercel deployment subdomains', () => {
      expect(getTenantSubdomain('dhakamodel.sohopathi-frontend.vercel.app')).toBe('dhakamodel');
      expect(getTenantSubdomain('sohopathi-frontend.vercel.app')).toBeNull();
      expect(getTenantSubdomain('www.sohopathi-frontend.vercel.app')).toBeNull();
    });

    it('returns null for dev / local environments (prompting login field)', () => {
      expect(getTenantSubdomain('localhost')).toBeNull();
      expect(getTenantSubdomain('localhost:5173')).toBeNull();
      expect(getTenantSubdomain('127.0.0.1')).toBeNull();
      expect(getTenantSubdomain('127.0.0.1:5173')).toBeNull();
      expect(getTenantSubdomain('0.0.0.0')).toBeNull();
    });

    it('allows testing subdomains via .localhost', () => {
      expect(getTenantSubdomain('dhakamodel.localhost')).toBe('dhakamodel');
      expect(getTenantSubdomain('dhakamodel.localhost:5173')).toBe('dhakamodel');
    });
  });

  describe('buildTenantUrl', () => {
    it('builds https url for biddyapith.tech', () => {
      expect(buildTenantUrl('dhakamodel')).toBe('https://dhakamodel.biddyapith.tech/');
      expect(buildTenantUrl('dhakamodel', '/login')).toBe('https://dhakamodel.biddyapith.tech/login');
    });
  });
});

