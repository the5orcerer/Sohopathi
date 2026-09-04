import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '../context/SessionContext';
import { ArrowRight, AlertCircle, Sun, Moon, PlusCircle, CheckCircle2, ShieldCheck, KeyRound, Building2, Globe } from 'lucide-react';
import { provisionInstitution, resolveInstitutionBySubdomain } from '../services/api';
import { getTenantSubdomain } from '../utils/tenant';
// লোগো ইমপোর্ট করুন (পাথ ঠিক রাখতে হবে)
import BiddyapithDarkLogo from '../assets/biddyapith-dark.png';
import BiddyapithLightLogo from '../assets/biddyapith-light.png';

export const LoginPage: React.FC = () => {
  const { login, changePassword, mustChangePassword, theme, toggleTheme } = useSession();

  const detectedSubdomain = useMemo(() => getTenantSubdomain(), []);
  const [institutionCode, setInstitutionCode] = useState(detectedSubdomain || '');
  const [resolvedInstitution, setResolvedInstitution] = useState<any | null>(null);
  const [resolvingTenant, setResolvingTenant] = useState<boolean>(!!detectedSubdomain);
  const [tenantNotFound, setTenantNotFound] = useState<boolean>(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Mandatory Password Change State (if mustChangePassword is true)
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChanging, setPasswordChanging] = useState(false);

  // Platform Provisioning Modal State
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionName, setProvisionName] = useState('');
  const [provisionSubdomain, setProvisionSubdomain] = useState('');
  const [provisionAdminName, setProvisionAdminName] = useState('');
  const [provisionAdminEmail, setProvisionAdminEmail] = useState('');
  const [provisionSuccessData, setProvisionSuccessData] = useState<any | null>(null);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  // Fetch institution metadata if hosted subdomain is present
  useEffect(() => {
    if (!detectedSubdomain) return;
    let active = true;
    setResolvingTenant(true);
    setTenantNotFound(false);

    resolveInstitutionBySubdomain(detectedSubdomain)
      .then((inst) => {
        if (!active) return;
        if (inst) {
          setResolvedInstitution(inst);
          setTenantNotFound(false);
        } else {
          setTenantNotFound(true);
        }
      })
      .catch(() => {
        if (active) setTenantNotFound(true);
      })
      .finally(() => {
        if (active) setResolvingTenant(false);
      });

    return () => {
      active = false;
    };
  }, [detectedSubdomain]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveCode = detectedSubdomain || institutionCode.trim();
    if (!effectiveCode || !username.trim()) {
      setError(detectedSubdomain ? 'Please enter your username and password' : 'Please provide your Institution ID and Username / Email');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await login({
        institutionCode: effectiveCode,
        subdomain: effectiveCode,
        username: username.trim(),
        password,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your institution ID and credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordChangeError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match');
      return;
    }

    setPasswordChanging(true);
    setPasswordChangeError(null);
    try {
      await changePassword(newPassword);
    } catch (err: any) {
      setPasswordChangeError(err.message || 'Failed to update password');
    } finally {
      setPasswordChanging(false);
    }
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provisionName.trim() || !provisionSubdomain.trim() || !provisionAdminEmail.trim()) {
      setProvisionError('Please fill in all required fields');
      return;
    }

    setProvisionLoading(true);
    setProvisionError(null);
    try {
      const res = await provisionInstitution({
        name: provisionName.trim(),
        subdomain: provisionSubdomain.trim().toLowerCase(),
        adminName: provisionAdminName.trim() || 'Principal Admin',
        adminEmail: provisionAdminEmail.trim().toLowerCase(),
        adminUsername: 'admin',
      });
      setProvisionSuccessData(res);
    } catch (err: any) {
      setProvisionError(err.message || 'Failed to provision institution');
    } finally {
      setProvisionLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      {/* Top Bar Actions */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        {import.meta.env.DEV && (
          <button
            onClick={() => {
              setShowProvisionModal(true);
              setProvisionSuccessData(null);
              setProvisionError(null);
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <PlusCircle size={14} />
            <span>Provision School (Dev)</span>
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="btn btn-secondary btn-sm"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{ borderRadius: 'var(--radius-full)' }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span style={{ fontSize: '0.75rem' }}>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Brand Header (লোগো এখানে বসানো হয়েছে) */}
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div
            style={{
              width: '56px', // সাইজ একটু বড় করা হয়েছে
              height: '56px',
              borderRadius: 'var(--radius-sm)',
              background: theme === 'dark' ? 'transparent' : 'transparent', // থিম অনুযায়ী ব্যাকগ্রাউনড
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.85rem',
              overflow: 'hidden',
            }}
          >
            {/* থিম অনুযায়ী লোগো বদলাবে */}
            <img
              src={theme === 'dark' ? BiddyapithDarkLogo : BiddyapithLightLogo}
              alt="Biddyapith Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Biddyapith Institutional Portal
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Educational Operating System
          </p>
        </div>

        {/* Main Auth Card */}
        <div
          className="card"
          style={{
            padding: '1.75rem',
            boxShadow: 'var(--shadow-dropdown)',
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {detectedSubdomain
                ? (resolvedInstitution?.name ? `Sign In to ${resolvedInstitution.name}` : 'Sign In to Your Institution')
                : 'Sign In to Your Institution'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {detectedSubdomain
                ? 'Enter your credentials to access your institutional portal'
                : 'Enter your institution ID and credentials'}
            </p>
          </div>

          {detectedSubdomain && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--surface-sunken)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Building2 size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.92rem',
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {resolvingTenant ? 'Resolving institution...' : (resolvedInstitution?.name || detectedSubdomain)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Globe size={12} />
                  <span>{detectedSubdomain}.biddyapith.tech</span>
                </div>
              </div>
            </div>
          )}

          {tenantNotFound && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 0.85rem',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                marginBottom: '1rem',
              }}
            >
              <AlertCircle size={16} />
              <span>
                Institution <strong>{detectedSubdomain}</strong> was not found. Please verify your domain.
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.85rem',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                marginBottom: '1rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {!detectedSubdomain && (
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Institution ID / Subdomain</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. dhakamodel"
                  value={institutionCode}
                  onChange={(e) => setInstitutionCode(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username or Email</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. admin or employee@school.edu"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus={!!detectedSubdomain}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.65rem' }}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Biddyapith Core Platform • Multi-Tenant RBAC & Field Delegation Active
        </div>
      </div>

      {/* Mandatory First-Login Password Change Modal */}
      {mustChangePassword && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-dropdown)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <KeyRound size={20} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Set Your Permanent Password
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Your account was created with a temporary password. Please set your permanent password to proceed to your dashboard.
            </p>

            {passwordChangeError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  marginBottom: '1rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{passwordChangeError}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={passwordChanging}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {passwordChanging ? 'Updating Password...' : 'Save & Enter Dashboard'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Platform Admin Provisioning Modal */}
      {showProvisionModal && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            className="card animate-fade-in"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-dropdown)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} style={{ color: 'var(--primary)' }} />
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    Platform Provisioning
                  </h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Create a new tenant school</span>
                </div>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            {provisionSuccessData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div
                  style={{
                    padding: '1rem',
                    background: 'var(--success-bg)',
                    border: '1px solid var(--success)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <CheckCircle2 size={18} />
                    <span>School Provisioned Successfully!</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Template roles were cloned and the initial Institution Admin account is ready:
                  </p>
                  <div style={{ background: 'var(--surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div><strong>Institution ID:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{provisionSuccessData.institutionId}</span></div>
                    <div><strong>Admin Username:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{provisionSuccessData.username}</span></div>
                    {provisionSuccessData.temporaryPassword && (
                      <div><strong>Temporary Password:</strong> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>{provisionSuccessData.temporaryPassword}</span></div>
                    )}
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const instCode = provisionSuccessData.institutionId || provisionSuccessData.institutionUuid;
                    const uName = provisionSuccessData.username;
                    const tempPw = provisionSuccessData.temporaryPassword || 'password123';
                    setShowProvisionModal(false);
                    setLoading(true);
                    setError(null);
                    try {
                      await login({
                        institutionCode: instCode,
                        username: uName,
                        password: tempPw,
                      });
                    } catch (err: any) {
                      setError(err.message || 'Failed to sign in as new admin');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Enter School as Administrator
                </button>
              </div>
            ) : (
              <form onSubmit={handleProvisionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {provisionError && (
                  <div
                    style={{
                      padding: '0.6rem 0.75rem',
                      background: 'var(--danger-bg)',
                      color: 'var(--danger)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                    }}
                  >
                    {provisionError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">School Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Chittagong Grammar School"
                    value={provisionName}
                    onChange={(e) => {
                      setProvisionName(e.target.value);
                      if (!provisionSubdomain) {
                        setProvisionSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      }
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Institution ID (Subdomain)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. cgs"
                    value={provisionSubdomain}
                    onChange={(e) => setProvisionSubdomain(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Admin Full Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Principal Farhana"
                    value={provisionAdminName}
                    onChange={(e) => setProvisionAdminName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Admin Contact Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="e.g. principal@cgs.edu.bd"
                    value={provisionAdminEmail}
                    onChange={(e) => setProvisionAdminEmail(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowProvisionModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={provisionLoading}
                    style={{ flex: 1 }}
                  >
                    {provisionLoading ? 'Provisioning...' : 'Provision Institution'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};