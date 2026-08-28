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
} from 'lucide-react';
import { Button } from '../components/common';

export const InstitutionSettingsPage: React.FC = () => {
  const { hasPermission, refreshSession } = useSession();
  const [data, setData] = useState<InstitutionSettingsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [currency, setCurrency] = useState<string>('BDT');
  const [timezone, setTimezone] = useState<string>('Asia/Dhaka');
  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(75);

  // Feature Toggles
  const [enableExaminations, setEnableExaminations] = useState<boolean>(true);
  const [enableAssignments, setEnableAssignments] = useState<boolean>(true);
  const [enableTransport, setEnableTransport] = useState<boolean>(false);
  const [enableFinance, setEnableFinance] = useState<boolean>(true);
  const [enableTimetable, setEnableTimetable] = useState<boolean>(true);
  const [notificationSmsEnabled, setNotificationSmsEnabled] = useState<boolean>(false);

  const canManageSettings = hasPermission('settings.manage') || hasPermission('institution.manage') || hasPermission('roles.manage');

  const loadSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetchInstitutionSettings();
      setData(res);
      setName(res.institution?.name || '');
      setAddress(res.settings?.address || '');
      setContactEmail(res.settings?.contactEmail || '');
      setContactPhone(res.settings?.contactPhone || '');
      setWebsite(res.settings?.website || '');
      setCurrency(res.settings?.currency || 'BDT');
      setTimezone(res.settings?.timezone || 'Asia/Dhaka');
      setAttendanceThreshold(res.settings?.attendanceThreshold ?? 75);

      setEnableExaminations(res.settings?.enableExaminations ?? true);
      setEnableAssignments(res.settings?.enableAssignments ?? true);
      setEnableTransport(res.settings?.enableTransport ?? false);
      setEnableFinance(res.settings?.enableFinance ?? true);
      setEnableTimetable(res.settings?.enableTimetable ?? true);
      setNotificationSmsEnabled(res.settings?.notificationSmsEnabled ?? false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load institution settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      await updateInstitutionSettings({
        name: name.trim(),
        settings: {
          address: address.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          website: website.trim(),
          currency,
          timezone,
          attendanceThreshold: Number(attendanceThreshold),
          enableExaminations,
          enableAssignments,
          enableTransport,
          enableFinance,
          enableTimetable,
          notificationSmsEnabled,
        },
      });

      setSuccessMsg('Institution configurations and feature limits saved successfully.');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Settings size={26} style={{ color: 'var(--primary)' }} />
          Institution Settings & Feature Controls
        </h1>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Configure institution profile, academic policies, feature toggles, and notification preferences.
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
        {/* Section 1: School Profile & Branding */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <Building2 size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>School Profile & Contact Details</h2>
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

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                Subdomain / Institution Code
              </label>
              <input
                type="text"
                disabled
                value={data?.institution?.subdomain || ''}
                style={{ width: '100%', padding: '0.55rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', cursor: 'not-allowed' }}
              />
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

        {/* Section 2: Academic Thresholds & Localization */}
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
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Students below this % will trigger attendance warning chips.</span>
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

        {/* Section 3: Feature Toggles & Module Licensing */}
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <Layers size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Feature Controls & Module Toggles</h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Enable or disable modular features for this school institution.</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {/* Examination Suite */}
            <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Examinations & Grading</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Marks entry, term schedules, weightages</div>
              </div>
              <button
                type="button"
                disabled={!canManageSettings}
                onClick={() => setEnableExaminations(!enableExaminations)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: enableExaminations ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                {enableExaminations ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>

            {/* Assignments */}
            <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Curriculum Assignments</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Homework and student deliverables</div>
              </div>
              <button
                type="button"
                disabled={!canManageSettings}
                onClick={() => setEnableAssignments(!enableAssignments)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: enableAssignments ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                {enableAssignments ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>

            {/* Timetable Schedules */}
            <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Class Timetable Schedules</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Weekly period slots & room scheduling</div>
              </div>
              <button
                type="button"
                disabled={!canManageSettings}
                onClick={() => setEnableTimetable(!enableTimetable)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: enableTimetable ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                {enableTimetable ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>

            {/* Fees & Finance */}
            <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Tuition & Fee Billing</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invoices, receipts, online collections</div>
              </div>
              <button
                type="button"
                disabled={!canManageSettings}
                onClick={() => setEnableFinance(!enableFinance)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: enableFinance ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                {enableFinance ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>

            {/* Transport Fleet */}
            <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Transport & Route Fleet</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Buses, stops, driver allocation</div>
              </div>
              <button
                type="button"
                disabled={!canManageSettings}
                onClick={() => setEnableTransport(!enableTransport)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: enableTransport ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                {enableTransport ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>

            {/* SMS Notifications */}
            <div style={{ padding: '0.85rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>SMS / Push Alert Dispatch</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Push notices to guardians & staff</div>
              </div>
              <button
                type="button"
                disabled={!canManageSettings}
                onClick={() => setNotificationSmsEnabled(!notificationSmsEnabled)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: notificationSmsEnabled ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                {notificationSmsEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>
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
