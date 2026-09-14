import React, { useState, useEffect } from 'react';
import { useSession } from '../context/SessionContext';
import { fetchInstitutionSettings, updateInstitutionSettings } from '../services/api';
import type { InstitutionSettingsData } from '../types';
import {
  Settings,
  Building2,
  Sliders,
  Save,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Globe,
  Mail,
  Phone,
  MapPin,
  Layers,
  Shield,
  FileCheck,
} from 'lucide-react';
import { Button, Badge } from '../components/common';

const SYSTEM_FEATURES = [
  { key: 'examinations', label: 'Examinations & Grading', description: 'Marks entry, term schedules, seat plans, and report cards' },
  { key: 'finance', label: 'Tuition & Fee Billing', description: 'Student fee invoices, receipts, payment recording, and ledger' },
  { key: 'timetable', label: 'Class Timetable Schedules', description: 'Weekly period slots, room assignments, and substitutions' },
  { key: 'transport', label: 'Transport Fleet & Routes', description: 'Buses, stops, and driver allocation' },
  { key: 'assignments', label: 'Curriculum Assignments', description: 'Homework tasks and student assignment submissions' },
  { key: 'admissions', label: 'Online Student Admissions', description: 'Public admission applications and verification workflow' },
  { key: 'attendance', label: 'Daily Attendance System', description: 'Student & staff daily attendance check-in rosters' },
  { key: 'notices', label: 'Campus Notice Board', description: 'Official announcements and circular broadcasting' },
  { key: 'tasks', label: 'Staff Work Order Delegation', description: 'Internal staff task assignments and tracking' },
];

const AVAILABLE_ROLES = ['Teacher', 'Staff', 'Student'];

export const InstitutionSettingsPage: React.FC = () => {
  const { hasPermission, refreshSession } = useSession();
  const [, setData] = useState<InstitutionSettingsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [instituteCode, setInstituteCode] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [currency, setCurrency] = useState<string>('BDT');
  const [timezone, setTimezone] = useState<string>('Asia/Dhaka');
  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(75);

  // Sensitive Institutional Artifacts
  const [principalSignatureUrl, setPrincipalSignatureUrl] = useState<string>('');
  const [officialSealUrl, setOfficialSealUrl] = useState<string>('');
  const [officialWatermarkText, setOfficialWatermarkText] = useState<string>('');

  // Feature Limitations Matrix: { [featureKey]: { enabled: boolean; allowedRoles?: string[] } }
  const [featureLimitations, setFeatureLimitations] = useState<Record<string, { enabled: boolean; allowedRoles?: string[] }>>({
    examinations: { enabled: true },
    finance: { enabled: true },
    timetable: { enabled: true },
    transport: { enabled: false },
    assignments: { enabled: true },
    admissions: { enabled: true },
    attendance: { enabled: true },
    notices: { enabled: true },
    tasks: { enabled: true },
  });

  const canManageSettings = hasPermission('settings.manage') || hasPermission('institution.manage') || hasPermission('roles.manage');

  const loadSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetchInstitutionSettings();
      setData(res);
      setName(res.institution?.name || '');
      setInstituteCode(res.institution?.instituteCode || res.settings?.instituteCode || '');
      setAddress(res.settings?.address || '');
      setContactEmail(res.settings?.contactEmail || '');
      setContactPhone(res.settings?.contactPhone || '');
      setWebsite(res.settings?.website || '');
      setCurrency(res.settings?.currency || 'BDT');
      setTimezone(res.settings?.timezone || 'Asia/Dhaka');
      setAttendanceThreshold(res.settings?.attendanceThreshold ?? 75);

      setPrincipalSignatureUrl(res.settings?.principalSignatureUrl || '');
      setOfficialSealUrl(res.settings?.officialSealUrl || '');
      setOfficialWatermarkText(res.settings?.officialWatermarkText || '');

      // Load feature limitations
      const rawLimits = res.settings?.featureLimitations || {};
      const merged: Record<string, { enabled: boolean; allowedRoles?: string[] }> = {};
      for (const feat of SYSTEM_FEATURES) {
        if (rawLimits[feat.key]) {
          merged[feat.key] = rawLimits[feat.key];
        } else {
          // Fallback legacy boolean
          const legacyKey = `enable${feat.key.charAt(0).toUpperCase() + feat.key.slice(1)}`;
          const isEnabled = res.settings?.[legacyKey] ?? (feat.key !== 'transport');
          merged[feat.key] = { enabled: Boolean(isEnabled), allowedRoles: undefined };
        }
      }
      setFeatureLimitations(merged);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load institution settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const toggleFeatureEnabled = (key: string) => {
    setFeatureLimitations((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: !prev[key]?.enabled,
      },
    }));
  };

  const setFeatureRoleLimitation = (key: string, isRestricted: boolean) => {
    setFeatureLimitations((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        allowedRoles: isRestricted ? ['Teacher'] : undefined,
      },
    }));
  };

  const toggleFeatureRole = (featureKey: string, role: string) => {
    setFeatureLimitations((prev) => {
      const current = prev[featureKey]?.allowedRoles || [];
      const updated = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      return {
        ...prev,
        [featureKey]: {
          ...prev[featureKey],
          allowedRoles: updated.length === 0 ? ['Institution Admin'] : updated,
        },
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      await updateInstitutionSettings({
        name: name.trim(),
        instituteCode: instituteCode.trim(),
        settings: {
          address: address.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          website: website.trim(),
          currency,
          timezone,
          attendanceThreshold: Number(attendanceThreshold),
          principalSignatureUrl: principalSignatureUrl.trim(),
          officialSealUrl: officialSealUrl.trim(),
          officialWatermarkText: officialWatermarkText.trim(),
          featureLimitations,
          // Sync boolean flags for backward compatibility
          enableExaminations: featureLimitations.examinations?.enabled ?? true,
          enableAssignments: featureLimitations.assignments?.enabled ?? true,
          enableTransport: featureLimitations.transport?.enabled ?? false,
          enableFinance: featureLimitations.finance?.enabled ?? true,
          enableTimetable: featureLimitations.timetable?.enabled ?? true,
        },
      });

      setSuccessMsg('Institution configurations, EIIN code, and feature limitations saved successfully.');
      await refreshSession();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading settings...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Settings size={26} style={{ color: 'var(--primary)' }} />
          Institution Settings & Feature Controls
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Configure EIIN code, school profile, academic thresholds, sensitive artifacts, and granular role feature limits.
        </p>
      </div>

      {successMsg && (
        <div style={{ padding: '0.85rem 1rem', background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '0.85rem 1rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Section 1: School Profile & EIIN Code */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <Building2 size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>School Profile & Identity</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Institution Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="text"
                required
                disabled={!canManageSettings}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            {/* Institute Code (EIIN) - Replaced unchangeable subdomain */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Institute Code (EIIN) <span style={{ color: 'var(--primary)' }}>*</span>
              </label>
              <input
                type="text"
                disabled={!canManageSettings}
                placeholder="e.g. 108542 or Official EIIN"
                value={instituteCode}
                onChange={(e) => setInstituteCode(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Official Educational Institution Identification Number</span>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Contact Official Email
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  disabled={!canManageSettings}
                  placeholder="admin@school.edu.bd"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.55rem 0.55rem 2rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
                <Mail size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Contact Phone / Hotline
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  disabled={!canManageSettings}
                  placeholder="+880 1700-000000"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.55rem 0.55rem 2rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
                <Phone size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Campus Physical Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  disabled={!canManageSettings}
                  placeholder="e.g. House 12, Road 4, Dhanmondi, Dhaka"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.55rem 0.55rem 2rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
                <MapPin size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Institution Website
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  disabled={!canManageSettings}
                  placeholder="https://school.edu.bd"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.55rem 0.55rem 2rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                />
                <Globe size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Sensitive Official Artifacts */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <FileCheck size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Official Signatures & Watermarks</h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Sensitive assets embedded in student transcripts, certificates, and billing receipts.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Principal Official Signature URL
              </label>
              <input
                type="text"
                disabled={!canManageSettings}
                placeholder="https://.../principal-signature.png"
                value={principalSignatureUrl}
                onChange={(e) => setPrincipalSignatureUrl(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Official Seal / Stamp Stamp URL
              </label>
              <input
                type="text"
                disabled={!canManageSettings}
                placeholder="https://.../official-seal.png"
                value={officialSealUrl}
                onChange={(e) => setOfficialSealUrl(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Official Watermark Text
              </label>
              <input
                type="text"
                disabled={!canManageSettings}
                placeholder="e.g. SOHOPATHI SECURE CAMPUS"
                value={officialWatermarkText}
                onChange={(e) => setOfficialWatermarkText(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Academic Policies & Regional Settings */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <Sliders size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Academic Policies & Regional Settings</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Min. Attendance Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                disabled={!canManageSettings}
                value={attendanceThreshold}
                onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Students below this % will trigger attendance warning indicators.</span>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Default Currency
              </label>
              <select
                disabled={!canManageSettings}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="BDT">BDT (৳) - Bangladeshi Taka</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="GBP">GBP (£) - British Pound</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Timezone
              </label>
              <select
                disabled={!canManageSettings}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
                <option value="America/New_York">America/New York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Feature-Based Settings & Limitation Matrix */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={20} style={{ color: 'var(--primary)' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Feature Controls & Granular Limitation Matrix</h2>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Disable features entirely or limit feature access to specific roles across the institution.
                </p>
              </div>
            </div>
            <Badge tone="info">Enterprise Feature Policy</Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {SYSTEM_FEATURES.map((feat) => {
              const current = featureLimitations[feat.key] || { enabled: true };
              const isEnabled = current.enabled;
              const isRestricted = Array.isArray(current.allowedRoles) && current.allowedRoles.length > 0;
              const allowedRoles = current.allowedRoles || [];

              return (
                <div
                  key={feat.key}
                  style={{
                    padding: '1rem',
                    background: isEnabled ? 'var(--surface)' : 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    opacity: isEnabled ? 1 : 0.65,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{feat.label}</span>
                        <Badge tone={isEnabled ? 'success' : 'neutral'}>
                          {isEnabled ? (isRestricted ? 'RESTRICTED TO ROLES' : 'ENABLED') : 'DISABLED COMPLETELY'}
                        </Badge>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {feat.description}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!canManageSettings}
                      onClick={() => toggleFeatureEnabled(feat.key)}
                      title={isEnabled ? 'Disable Feature Completely' : 'Enable Feature'}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: isEnabled ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                    >
                      {isEnabled ? <ToggleRight size={34} /> : <ToggleLeft size={34} />}
                    </button>
                  </div>

                  {/* Role Limitation Config (Visible when feature is enabled) */}
                  {isEnabled && (
                    <div style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Shield size={14} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>Audience Access:</span>
                        <select
                          disabled={!canManageSettings}
                          value={isRestricted ? 'restricted' : 'everyone'}
                          onChange={(e) => setFeatureRoleLimitation(feat.key, e.target.value === 'restricted')}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface-sunken)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            fontSize: '0.78rem',
                          }}
                        >
                          <option value="everyone">All Allowed Roles (Standard)</option>
                          <option value="restricted">Limit to Specific Roles Only</option>
                        </select>
                      </div>

                      {isRestricted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Allowed:</span>
                          {AVAILABLE_ROLES.map((r) => {
                            const isAllowed = allowedRoles.includes(r);
                            return (
                              <button
                                key={r}
                                type="button"
                                disabled={!canManageSettings}
                                onClick={() => toggleFeatureRole(feat.key, r)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: isAllowed ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                                  background: isAllowed ? 'rgba(79, 70, 229, 0.15)' : 'var(--surface-sunken)',
                                  color: isAllowed ? 'var(--primary)' : 'var(--text-muted)',
                                  fontSize: '0.72rem',
                                  fontWeight: isAllowed ? 600 : 400,
                                  cursor: 'pointer',
                                }}
                              >
                                {isAllowed ? `✓ ${r}` : `+ ${r}`}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Actions */}
        {canManageSettings && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button variant="primary" type="submit" loading={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.5rem' }}>
              <Save size={16} />
              <span>Save Configurations</span>
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};
