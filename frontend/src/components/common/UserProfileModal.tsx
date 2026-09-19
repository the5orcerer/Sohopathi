import React, { useState, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { updateSelfProfile } from '../../services/api';
import { Modal, Button } from './index';
import { User, Lock, Phone, CheckCircle2, AlertCircle } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { session, refreshSession, hasPermission } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canEditPhoto =
    hasPermission('memberships.manage') ||
    hasPermission('institution.manage') ||
    hasPermission('roles.manage') ||
    session?.activeMembership?.role === 'owner' ||
    session?.activeMembership?.role === 'admin' ||
    session?.activeMembership?.roleName?.toLowerCase().includes('admin');

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '');
      setPhone(session.user.phone || '');
      setAvatarUrl(session.user.avatarUrl || '');
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setSuccess(false);
    }
  }, [session, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }

    if (password) {
      if (password.length < 6) {
        setError('New password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    try {
      setLoading(true);
      await updateSelfProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        avatarUrl: canEditPhoto ? (avatarUrl.trim() || undefined) : undefined,
        password: password ? password : undefined,
      });

      setSuccess(true);
      await refreshSession();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="My Profile Settings" maxWidth="500px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--status-danger)',
              color: 'var(--status-danger)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {success && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid var(--status-success)',
              color: 'var(--status-success)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle2 size={16} /> Profile updated successfully!
          </div>
        )}

        {/* Read-Only System Identity Info */}
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Organization Role & Email (Managed by Admin)</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '0.2rem' }}>
            {session?.user.email} • {session?.activeMembership.roleName || session?.activeMembership.role}
          </div>
        </div>

        {/* Profile Photo Display & Permission Gate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '50%', overflow: 'hidden', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0, border: '2px solid var(--border-subtle)' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={name || 'User'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              name ? name.charAt(0).toUpperCase() : <User size={24} />
            )}
            {!canEditPhoto && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={18} style={{ color: '#fff' }} />
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Institutional Profile Photo</span>
              {!canEditPhoto && (
                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', border: '1px solid var(--status-danger)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <Lock size={10} /> Locked
                </span>
              )}
            </div>

            {canEditPhoto ? (
              <div>
                <input
                  type="url"
                  placeholder="Paste photo URL (https://...)"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.8rem',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface-base)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Authorized administrative photo modification.</span>
              </div>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
                Profile photo is locked by institutional administration. Contact the administration desk to update your verified identification photo.
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
          <div style={{ position: 'relative' }}>
            <User size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>

        {/* Phone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Phone Number</label>
          <div style={{ position: 'relative' }}>
            <Phone size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880 1712-345678"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '0.25rem 0' }} />

        {/* Change Password (Optional) */}
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Security & Password (Optional)
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>New Password</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep unchanged"
              style={{
                width: '100%',
                padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--surface-sunken)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>

        {password && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required={!!password}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem 0.6rem 2.2rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-sunken)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
          <Button variant="secondary" onClick={onClose} type="button" disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading}>
            Save Profile
          </Button>
        </div>
      </form>
    </Modal>
  );
};

