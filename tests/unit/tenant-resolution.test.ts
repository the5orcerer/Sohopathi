import { describe, it, expect } from 'vitest';
import { extractSubdomainFromHostname, extractTenantFromRequest } from '../../src/core/tenant-utils';
import { Request } from 'express';

describe('Tenant Subdomain Extraction', () => {
  describe('extractSubdomainFromHostname', () => {
    it('extracts orgname from biddyapith.tech subdomains', () => {
      expect(extractSubdomainFromHostname('dhakamodel.biddyapith.tech')).toBe('dhakamodel');
      expect(extractSubdomainFromHostname('oxford-high.biddyapith.tech')).toBe('oxford-high');
      expect(extractSubdomainFromHostname('DHAKAMODEL.BIDDYAPITH.TECH')).toBe('dhakamodel');
      expect(extractSubdomainFromHostname('school.biddyapith.tech:3000')).toBe('school');
    });

    it('returns null for biddyapith.tech apex and reserved subdomains', () => {
      expect(extractSubdomainFromHostname('biddyapith.tech')).toBeNull();
      expect(extractSubdomainFromHostname('www.biddyapith.tech')).toBeNull();
      expect(extractSubdomainFromHostname('api.biddyapith.tech')).toBeNull();
      expect(extractSubdomainFromHostname('admin.biddyapith.tech')).toBeNull();
      expect(extractSubdomainFromHostname('cdn.biddyapith.tech')).toBeNull();
    });

    it('extracts orgname from vercel deployment subdomains', () => {
      expect(extractSubdomainFromHostname('dhakamodel.sohopathi-frontend.vercel.app')).toBe('dhakamodel');
      expect(extractSubdomainFromHostname('sohopathi-frontend.vercel.app')).toBeNull();
      expect(extractSubdomainFromHostname('www.sohopathi-frontend.vercel.app')).toBeNull();
    });

    it('handles local development environments', () => {
      expect(extractSubdomainFromHostname('localhost')).toBeNull();
      expect(extractSubdomainFromHostname('localhost:5173')).toBeNull();
      expect(extractSubdomainFromHostname('127.0.0.1')).toBeNull();
      expect(extractSubdomainFromHostname('127.0.0.1:3000')).toBeNull();
      expect(extractSubdomainFromHostname('0.0.0.0')).toBeNull();
      expect(extractSubdomainFromHostname('dhakamodel.localhost')).toBe('dhakamodel');
      expect(extractSubdomainFromHostname('dhakamodel.localhost:5173')).toBe('dhakamodel');
    });
  });

  describe('extractTenantFromRequest', () => {
    it('prioritizes x-institution-subdomain header', () => {
      const req = {
        headers: {
          'x-institution-subdomain': 'dhakamodel',
          origin: 'https://other.biddyapith.tech',
        },
      } as unknown as Request;
      expect(extractTenantFromRequest(req)).toBe('dhakamodel');
    });

    it('falls back to x-institution-id header', () => {
      const req = {
        headers: {
          'x-institution-id': 'f2c10000-0000-0000-0000-000000000001',
        },
      } as unknown as Request;
      expect(extractTenantFromRequest(req)).toBe('f2c10000-0000-0000-0000-000000000001');
    });

    it('extracts from Origin header when no custom header present', () => {
      const req = {
        headers: {
          origin: 'https://oxford.biddyapith.tech',
        },
      } as unknown as Request;
      expect(extractTenantFromRequest(req)).toBe('oxford');
    });

    it('extracts from Referer header when Origin is absent', () => {
      const req = {
        headers: {
          referer: 'https://ideal-school.biddyapith.tech/login',
        },
      } as unknown as Request;
      expect(extractTenantFromRequest(req)).toBe('ideal-school');
    });

    it('extracts from Host header when Origin/Referer absent', () => {
      const req = {
        headers: {
          host: 'greenwood.biddyapith.tech',
        },
      } as unknown as Request;
      expect(extractTenantFromRequest(req)).toBe('greenwood');
    });

    it('returns null when request is from local without tenant headers', () => {
      const req = {
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:5173',
        },
      } as unknown as Request;
      expect(extractTenantFromRequest(req)).toBeNull();
    });
  });
});

