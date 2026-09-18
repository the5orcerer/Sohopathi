import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../common';
import {
  Clock,
  UserCheck,
  AlertCircle,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { recordPeriodSubstitution, fetchMembers } from '../../services/api';
import type { Member } from '../../types';

interface PeriodSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: any | null;
  onSuccess?: () => void;
}

export const PeriodSubstitutionModal: React.FC<PeriodSubstitutionModalProps> = ({
  isOpen,
  onClose,
  schedule,
  onSuccess,
}) => {
  const [subDate, setSubDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'substitute' | 'cancelled' | 'normal'>('substitute');
  const [substituteTeacherId, setSubstituteTeacherId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [teachers, setTeachers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchMembers()
        .then((members) => {
          const faculty = members.filter(
            (m) =>
              m.roleName?.toLowerCase().includes('teacher') ||
              m.roleName?.toLowerCase().includes('faculty') ||
              m.roleName?.toLowerCase().includes('admin')
          );
          setTeachers(faculty);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedule?.id) return;
    if (status === 'substitute' && !substituteTeacherId) {
      setError('Please select a substitute faculty member.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await recordPeriodSubstitution(schedule.id, {
        substitutionDate: subDate,
        substituteTeacherMembershipId: status === 'substitute' ? substituteTeacherId : null,
        status,
        reason: reason.trim() || undefined,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to record period substitution:', err);
      setError(err.message || 'Failed to apply period substitution');
    } finally {
      setSaving(false);
    }
  };

  if (!schedule) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Period Substitution & Excusal Management"
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Schedule Context Banner */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            background: 'rgba(99, 102, 241, 0.08)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={16} style={{ color: 'var(--brand-primary)' }} />
            <span>{schedule.subjectName || 'Current Subject'}</span>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 7px',
                borderRadius: '4px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--brand-primary)',
              }}
            >
              {schedule.sectionName || 'Section'}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={13} style={{ color: 'var(--text-muted)' }} />
              {schedule.startTime} - {schedule.endTime}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <UserCheck size={13} style={{ color: 'var(--text-muted)' }} />
              Regular: <strong>{schedule.teacherName || 'Assigned Faculty'}</strong>
            </span>
          </div>
        </div>

        {/* Action Type */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Substitution Action
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <button
              type="button"
              style={{
                padding: '0.5rem 0.6rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: status === 'substitute' ? '1.5px solid var(--brand-primary)' : '1px solid var(--border)',
                background: status === 'substitute' ? 'var(--brand-primary)' : 'var(--surface)',
                color: status === 'substitute' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onClick={() => setStatus('substitute')}
            >
              Assign Substitute
            </button>
            <button
              type="button"
              style={{
                padding: '0.5rem 0.6rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: status === 'cancelled' ? '1.5px solid #ef4444' : '1px solid var(--border)',
                background: status === 'cancelled' ? '#ef4444' : 'var(--surface)',
                color: status === 'cancelled' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onClick={() => setStatus('cancelled')}
            >
              Cancel Period
            </button>
            <button
              type="button"
              style={{
                padding: '0.5rem 0.6rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: status === 'normal' ? '1.5px solid #10b981' : '1px solid var(--border)',
                background: status === 'normal' ? '#10b981' : 'var(--surface)',
                color: status === 'normal' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onClick={() => setStatus('normal')}
            >
              Restore Normal
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Date
          </label>
          <input
            type="date"
            value={subDate}
            onChange={(e) => setSubDate(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Substitute Faculty Dropdown */}
        {status === 'substitute' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              Designate Substitute Faculty
            </label>
            <select
              value={substituteTeacherId}
              onChange={(e) => setSubstituteTeacherId(e.target.value)}
              required={status === 'substitute'}
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="">{loading ? 'Loading faculty list...' : 'Select Faculty Member...'}</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name || t.email || 'Teacher'} ({t.roleName})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reason / Remarks */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
            Reason / Administrative Remarks
          </label>
          <textarea
            rows={2}
            placeholder="e.g. Instructor on approved medical leave, substituting for period 3"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? (
              <>
                <RefreshCw size={14} className="animate-spin" style={{ marginRight: '6px' }} />
                Updating...
              </>
            ) : (
              'Apply Substitution'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
