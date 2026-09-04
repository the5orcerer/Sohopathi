import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import type { Session, NavItem, DashboardWidget, User, ActiveMembership } from '../types';
import { setApiAuth, fetchNav, fetchDashboard, buildApiUrl } from '../services/api';
import { getTenantSubdomain } from '../utils/tenant';

interface SessionContextValue {
  isAuthenticated: boolean;
  user: User | null;
  activeMembership: ActiveMembership | null;
  institutionName: string;
  institutionSubdomain: string;
  memberships: any[];
  permissions: string[];
  navItems: NavItem[];
  dashboardWidgets: DashboardWidget[];
  loading: boolean;
  mustChangePassword: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  login: (params: { institutionCode?: string; subdomain?: string; username?: string; email?: string; password?: string; institutionId?: string }) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  signup: (data: { email: string; name: string; phone?: string; roleName?: string; username?: string; password?: string; institutionId?: string }) => Promise<void>;
  logout: () => void;
  switchInstitution: (institutionId: string) => void;
  hasPermission: (permission: string) => boolean;
  refreshSession: () => Promise<void>;
  session: Session;
  currentPersona: {
    id: string;
    label: string;
    roleName: string;
    description: string;
  };
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY_TOKEN = 'sohopathi_auth_token';
const STORAGE_KEY_INST_ID = 'sohopathi_inst_id';
const STORAGE_KEY_THEME = 'sohopathi_theme';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const hostTenant = getTenantSubdomain();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_TOKEN));
  const [institutionId, setInstitutionId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY_INST_ID) || 'f2c10000-0000-0000-0000-000000000001'
  );
  const [user, setUser] = useState<User | null>(null);
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [institutionName, setInstitutionName] = useState<string>('Dhaka Model International Academy');
  const [institutionSubdomain, setInstitutionSubdomain] = useState<string>(hostTenant || 'dhakamodel');
  const [memberships, setMemberships] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Theme setup
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY_THEME, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const loadUserData = useCallback(
    async (authToken: string, instId: string, sub?: string) => {
      const activeSub = sub || hostTenant || institutionSubdomain;
      setApiAuth(authToken, instId, activeSub);
      try {
        const res = await fetch(buildApiUrl('/api/me'), {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'x-institution-id': instId,
            'x-institution-subdomain': activeSub || '',
          },
        });

        if (!res.ok) {
          throw new Error('Failed to load session');
        }

        const data = await res.json();
        setUser(data.user);
        setActiveMembership(data.membership);

        if (data.user) {
          Sentry.setUser({
            id: data.user.id,
            email: data.user.email,
            username: data.user.name || data.user.email,
          });
        }
        if (data.membership?.institutionId) {
          Sentry.setTag('institution_id', data.membership.institutionId);
          Sentry.setTag('role_name', data.membership.roleName);
        }

        if (data.institution?.name) {
          setInstitutionName(data.institution.name);
        }
        if (data.institution?.subdomain) {
          setInstitutionSubdomain(data.institution.subdomain);
        }
        setPermissions(data.permissions || []);

        // Load dynamic nav and dashboard widgets
        const [navData, dashboardData] = await Promise.all([
          fetchNav().catch(() => []),
          fetchDashboard().catch(() => ({ widgets: [] })),
        ]);

        if (Array.isArray(navData)) setNavItems(navData);
        if (dashboardData?.widgets) setDashboardWidgets(dashboardData.widgets);
      } catch (err) {
        console.error('Session validation failed', err);
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    },
    [hostTenant, institutionSubdomain]
  );

  useEffect(() => {
    if (token && institutionId) {
      loadUserData(token, institutionId, hostTenant || undefined);
    } else {
      setLoading(false);
    }
  }, [token, institutionId, hostTenant, loadUserData]);

  const login = async (params: {
    institutionCode?: string;
    subdomain?: string;
    username?: string;
    email?: string;
    password?: string;
    institutionId?: string;
  }) => {
    setLoading(true);
    const effectiveSubdomain = hostTenant || params.subdomain || params.institutionCode;
    const payload = {
      ...params,
      subdomain: effectiveSubdomain,
      institutionCode: params.institutionCode || effectiveSubdomain,
    };

    const res = await fetch(buildApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-institution-subdomain': effectiveSubdomain || '',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      setLoading(false);
      throw new Error(err.error || 'Login failed');
    }

    const data = await res.json();
    const newToken = data.token;
    const newInstId = data.activeMembership.institutionId;

    localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
    localStorage.setItem(STORAGE_KEY_INST_ID, newInstId);

    setToken(newToken);
    setInstitutionId(newInstId);
    setUser(data.user);
    setActiveMembership(data.activeMembership);
    setMemberships(data.memberships || []);
    setMustChangePassword(!!data.mustChangePassword);

    const resolvedSub = data.activeMembership.institutionSubdomain || effectiveSubdomain;
    if (data.activeMembership.institutionName) {
      setInstitutionName(data.activeMembership.institutionName);
    }
    if (resolvedSub) {
      setInstitutionSubdomain(resolvedSub);
    }

    await loadUserData(newToken, newInstId, resolvedSub);
  };

  const changePassword = async (newPassword: string) => {
    if (!token) return;
    const res = await fetch(buildApiUrl('/api/auth/change-password'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ newPassword }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Password change failed' }));
      throw new Error(err.error || 'Password change failed');
    }

    setMustChangePassword(false);
  };

  const signup = async (formData: {
    email: string;
    name: string;
    phone?: string;
    roleName?: string;
    username?: string;
    password?: string;
    institutionId?: string;
  }) => {
    setLoading(true);
    const res = await fetch(buildApiUrl('/api/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Signup failed' }));
      setLoading(false);
      throw new Error(err.error || 'Signup failed');
    }

    const data = await res.json();
    const newToken = data.token;
    const newInstId = data.activeMembership.institutionId;

    localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
    localStorage.setItem(STORAGE_KEY_INST_ID, newInstId);

    setToken(newToken);
    setInstitutionId(newInstId);
    setUser(data.user);
    setActiveMembership(data.activeMembership);
    setMemberships(data.memberships || []);
    if (data.activeMembership.institutionName) {
      setInstitutionName(data.activeMembership.institutionName);
    }

    await loadUserData(newToken, newInstId);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    setToken(null);
    setUser(null);
    setActiveMembership(null);
    setPermissions([]);
    setNavItems([]);
    setDashboardWidgets([]);
    setMustChangePassword(false);
    Sentry.setUser(null);
  };

  const switchInstitution = (newInstId: string) => {
    if (token) {
      localStorage.setItem(STORAGE_KEY_INST_ID, newInstId);
      setInstitutionId(newInstId);
      loadUserData(token, newInstId);
    }
  };

  const hasPermission = useCallback(
    (permissionKey: string): boolean => {
      return permissions.includes(permissionKey);
    },
    [permissions]
  );

  const refreshSession = async () => {
    if (token && institutionId) {
      await loadUserData(token, institutionId);
    }
  };

  const session: Session = {
    token: token || '',
    user: user || { id: '', name: 'User', email: '' },
    activeMembership: activeMembership || { id: '', institutionId: institutionId || '' },
    permissions,
  };

  const currentPersona = {
    id: activeMembership?.id || 'active',
    label: activeMembership?.roleName || 'User',
    roleName: activeMembership?.roleName || 'User',
    description: `Active member of ${institutionName}`,
  };

  return (
    <SessionContext.Provider
      value={{
        isAuthenticated: !!token && !!user,
        user,
        activeMembership,
        institutionName,
        institutionSubdomain,
        memberships,
        permissions,
        navItems,
        dashboardWidgets,
        loading,
        mustChangePassword,
        theme,
        toggleTheme,
        login,
        changePassword,
        signup,
        logout,
        switchInstitution,
        hasPermission,
        refreshSession,
        session,
        currentPersona,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
