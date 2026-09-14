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
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Schedule Context Banner */}
        <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-sm">
          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>{schedule.subjectName || 'Current Subject'}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              {schedule.sectionName || 'Section'}
            </span>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {schedule.startTime} - {schedule.endTime}
            </span>
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-gray-400" />
              Regular: <strong>{schedule.teacherName || 'Assigned Faculty'}</strong>
            </span>
          </div>
        </div>

        {/* Action Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
            Substitution Action
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                status === 'substitute'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => setStatus('substitute')}
            >
              Assign Substitute
            </button>
            <button
              type="button"
              className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                status === 'cancelled'
                  ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => setStatus('cancelled')}
            >
              Cancel Period
            </button>
            <button
              type="button"
              className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                status === 'normal'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              onClick={() => setStatus('normal')}
            >
              Restore Normal
            </button>
          </div>
        </div>

        {/* Date Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
            Date
          </label>
          <div className="relative">
            <input
              type="date"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={subDate}
              onChange={(e) => setSubDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Substitute Faculty Dropdown */}
        {status === 'substitute' && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
              Designate Substitute Faculty
            </label>
            <select
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={substituteTeacherId}
              onChange={(e) => setSubstituteTeacherId(e.target.value)}
              required={status === 'substitute'}
              disabled={loading}
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
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
            Reason / Administrative Remarks
          </label>
          <textarea
            rows={2}
            className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
            placeholder="e.g. Instructor on approved medical leave, substituting for period 3"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-1" />
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
